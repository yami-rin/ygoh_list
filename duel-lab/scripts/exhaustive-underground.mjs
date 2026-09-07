import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {OcgQueryFlags as Q} from 'ocgcore-wasm';
import {cards} from '../cards.mjs';
import {startRoute, respond, finishRoute, replay, board, hash, preset} from './route-harness.mjs';

// This worker searches actual response histories. Equal visible boards are only
// grouped in the report; they are never used to prune the engine's hidden state.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'runtime/search-underground');
const ROUTES = path.join(ROOT, 'routes/exhaustive-underground.json');
const C = {underground:68337209, terra:73628505, rabbit:69272449, cat:96676583,
  dormouse:32061192, hare:20938824, contract:37458564, wicked:52698008,
  magician:64865, backup:30118811, binder:95454996};
const ownStarters = new Set([C.underground, C.terra]);
const argv = process.argv.slice(2);
const numberArg = (key, fallback) => {
  const found = argv.find(x => x.startsWith(`--${key}=`));
  const value = found ? Number(found.split('=')[1]) : fallback;
  assert(Number.isFinite(value) && value > 0, `${key} must be positive`);
  return Math.floor(value);
};
const limits = {
  maxNodes: numberArg('nodes', 1200),
  nodesPerJob: numberArg('per-job', 12),
  maxDepth: numberArg('depth', 96),
  maxMs: numberArg('ms', 180000),
  representativeLimit: numberArg('representatives', 160),
};
const safe = x => JSON.parse(JSON.stringify(x, (_, v) => typeof v === 'bigint' ? String(v) : v));
const write = (file, value) => {
  const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,JSON.stringify(safe(value),null,2)+'\n');
  fs.renameSync(temporary,file);
};
fs.mkdirSync(OUT, {recursive:true});
fs.mkdirSync(path.dirname(ROUTES), {recursive:true});

const sourcePath = path.join(ROOT, 'routes/spell-starters.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const knownRoutes = source.routes.filter(r => ownStarters.has(r.starter));
const knownProbes = source.probes.filter(r => ownStarters.has(r.starter));
const jobs = [];
const knownJob = new Set();
const addJob = (hand, steps, metadata) => {
  const inputs = steps.map(step => safe(step.input || step));
  const key = hash({hand, inputs});
  if (knownJob.has(key)) return;
  knownJob.add(key);
  jobs.push({id:key.slice(0,20), hand, prefix:inputs, ...metadata});
};
const initialBanishCoverage = [];
const routeChecks = [];
const drawFrontier = new Map();
const representatives = new Map();
const stableBoards = new Set();
const promptCounts = {};
const priorSummary = argv.includes('--resume') && fs.existsSync(ROUTES)
  ? JSON.parse(fs.readFileSync(ROUTES,'utf8')) : null;
if (priorSummary) {
  assert.equal(priorSummary.presetHash,hash(preset),'Cannot resume a different preset');
  for(const route of priorSummary.routes) representatives.set(route.finalHash,route);
  const priorDrawPath=path.join(OUT,'draw-frontier.json');
  if(fs.existsSync(priorDrawPath)) {
    for(const entry of JSON.parse(fs.readFileSync(priorDrawPath,'utf8'))) drawFrontier.set(entry.id,entry);
  }
}

function remainingDeck(g) {
  return g.lib.duelQueryLocation(g.handle, {controller:0,location:1,flags:Q.CODE})
    .filter(c=>c?.code).map(c=>c.code);
}

// Directly visit every first-banish menu index, including duplicate copies.
// Terraforming's other same-name search-copy choices remain in the root tree;
// they are not asserted equivalent when subsequent draw order is in scope.
for (const starter of ownStarters) {
  addJob([starter], [], {kind:'whole-opening', priority:0, starter});
  const exemplar = knownRoutes.find(r => r.starter === starter && !r.firstBanish);
  assert(exemplar, 'Missing verified source route');
  const g = await startRoute([starter]);
  try {
    for (const step of exemplar.steps) {
      if (g.prompt.type === 'SELECT_CARD' &&
          [C.rabbit,C.cat,C.dormouse,C.hare,C.underground].every(code => g.prompt.cards.some(c=>c.code===code))) break;
      respond(g, step.input);
    }
    assert.equal(g.prompt.type, 'SELECT_CARD');
    const pre = structuredClone(g.route.steps);
    const menu = safe(g.prompt.cards);
    const coverage = {starter, name:cards[starter].name, menuEntries:menu.length,
      distinctNames:new Set(menu.map(c=>c.code)).size, prefix:pre.map(s=>s.input), checked:[]};
    for (let index=0; index<menu.length; index++) {
      const candidate = menu[index];
      const probe = await startRoute([starter]);
      try {
        for (const step of pre) respond(probe, step.input);
        respond(probe, {selection:[index]});
        assert.equal(probe.errors.length,0);
        coverage.checked.push({index,code:candidate.code,name:cards[candidate.code].name,
          afterHash:hash({pending:probe.pending,board:board(probe)}),
          nextPrompt:probe.prompt?.type});
      } finally {probe.close();}
      addJob([starter], [...pre,{input:{selection:[index]}}],
        {kind:'first-banish',priority:1,starter,target:candidate.code,targetIndex:index});
    }
    assert.equal(coverage.checked.length,menu.length);
    initialBanishCoverage.push(coverage);
  } finally {g.close();}
}

// Existing productive paths give deep branches a fair starting point. Every
// response on these paths remains a possible warm root, not an asserted policy.
for (const route of [...knownRoutes,...knownProbes]) {
  await replay(route);
  routeChecks.push({id:route.id,steps:route.steps.length,finalHash:route.finalHash,passed:true});
  const g = await startRoute(route.hand,{seed:route.seed});
  try {
    for (let index=0; index<route.steps.length; index++) {
      const p=g.prompt;
      const width = p.cards?.length || p.choices.length;
      if (index>10 && width>1) {
        // Candidate cardinality is not the combination count. The kernel owns
        // complete response enumeration, including materials and placements.
        addJob(route.hand, g.route.steps, {kind:'known-route-pivot',starter:route.starter,
          priority:p.type==='SELECT_CARD'?2:p.type==='SELECT_UNSELECT_CARD'?3:4,
          sourceRoute:route.id,sourceStep:index,prompt:p.type,title:p.title,candidateCards:width});
      }
      respond(g,route.steps[index].input);
    }
    addJob(route.hand,g.route.steps,{kind:'known-route-continuation',starter:route.starter,
      priority:1,sourceRoute:route.id,prompt:g.prompt?.type});
    const final = finishRoute(g,{id:`underground-source-${route.id}`,starter:route.starter,
      sourceRoute:route.id,requiresDraw:false,classification:route.classification || 'one-card'});
    representatives.set(final.finalHash,final);
  } finally {g.close();}
}
const existingCheckpoints=new Set(fs.readdirSync(OUT));
jobs.sort((a,b)=>
  (argv.includes('--resume')
    ? Number(existingCheckpoints.has(`${a.id}.json`))-Number(existingCheckpoints.has(`${b.id}.json`)) : 0)
  || a.priority-b.priority || a.prefix.length-b.prefix.length || a.id.localeCompare(b.id));
write(path.join(OUT,'manifest.json'),{
  schemaVersion:1,generatedAt:new Date().toISOString(),presetHash:hash(preset),
  sourceHash:hash(source),limits,initialBanishCoverage,routeChecks,jobs,
});
console.log(JSON.stringify({event:'prepared',jobs:jobs.length,verifiedSourceRoutes:routeChecks.length,
  firstBanishMenus:initialBanishCoverage.map(c=>({starter:c.starter,entries:c.checked.length,names:c.distinctNames}))}));
if (argv.includes('--prepare-only')) process.exit(0);

const {search} = await import('./search-kernel.mjs');
const started=Date.now();
const results=[];
let visited=0;
let observedTotal=0;
let jobsRun=0;
let interrupted=false;
process.on('SIGINT',()=>{interrupted=true;});
const drawLog = g => g.log.some(entry=>entry.text.includes('枚ドロー'));

for (const job of jobs) {
  const remainingMs=limits.maxMs-(Date.now()-started);
  if (interrupted || visited>=limits.maxNodes || remainingMs<=0) break;
  const checkpointPath=path.join(OUT,`${job.id}.json`);
  const previous=argv.includes('--resume') && fs.existsSync(checkpointPath)
    ? JSON.parse(fs.readFileSync(checkpointPath,'utf8')) : undefined;
  let observed=0;
  const result = await search({
    hand:job.hand,prefix:job.prefix,seed:123,maxDepth:limits.maxDepth,
    maxNodes:Math.min(limits.nodesPerJob,limits.maxNodes-visited),
    maxMs:Math.max(1,Math.min(remainingMs,15000)),checkpointPath,resume:previous,
    stopOnDraw:true,pruneLinkUiLoops:true,
    onNode:async(g,info)=>{
      observed++;
      const type=g.prompt?.type || g.status;
      promptCounts[type]=(promptCounts[type]||0)+1;
      if (drawLog(g)) {
        // This node's draw was resolved by the fixed fixture. Handoff starts
        // BEFORE its last response; the draw worker enumerates the real pool.
        const key=hash({hand:job.hand,steps:g.route.steps.map(s=>s.input)});
        const prePrefix=g.route.steps.slice(0,-1).map(s=>s.input);
        const beforeDraw=await startRoute(job.hand);
        let remainingDeckCodes;
        try {
          for(const input of prePrefix) respond(beforeDraw,input);
          remainingDeckCodes=remainingDeck(beforeDraw);
        } finally {beforeDraw.close();}
        drawFrontier.set(key,{id:key,starter:job.starter,hand:job.hand,
          prefix:prePrefix,remainingDeckCodes,
          drawResponse:g.route.steps.at(-1)?.input,
          afterDrawDeckCodes:remainingDeck(g),
          afterDrawBoard:board(g),
          scope:'Fixed-order draw already resolved; replay prefix to inspect the pre-draw remaining deck. No post-draw continuation searched.'});
        return {stop:true,reason:'draw-handoff'};
      }
      if (g.prompt?.type==='SELECT_IDLECMD' && g.turn===1) {
        const final=board(g);const key=hash(final);stableBoards.add(key);
        if (!representatives.has(key) && representatives.size<limits.representativeLimit) {
          representatives.set(key,finishRoute(g,{id:`underground-search-${key.slice(0,20)}`,
            starter:job.starter,requiresDraw:false,classification:'one-card',
            sourceJob:job.id,scope:'Engine-verified reachable first-turn board; not an optimality claim.'}));
        }
      }
      return undefined;
    },
  });
  // The full kernel checkpoint contains the actual resumable frontier. This
  // manifest keeps exact callback visits independently of changing stats names.
  visited+=result.invocation.visited;observedTotal+=observed;jobsRun++;
  results.push({id:job.id,kind:job.kind,starter:job.starter,observedNodes:observed,
    checkpoint:`runtime/search-underground/${job.id}.json`,
    complete:result.complete===true,stats:{visited:result.visited,generated:result.generated,
      rejected:result.rejected.length,failures:result.failures.length,
      terminalRoutes:result.terminals.length,invocation:result.invocation},
    frontierEntries:Array.isArray(result.frontier)?result.frontier.length:null});
  write(path.join(OUT,'draw-frontier.json'),[...drawFrontier.values()]);
  if(jobsRun%10===0 || observed===0 || result.failures.length) {
    console.log(JSON.stringify({event:'job',id:job.id,kind:job.kind,jobsRun,observed,total:visited,
      frontier:results.at(-1).frontierEntries,elapsedMs:Date.now()-started}));
  }
}

const savedRoutes=[...representatives.values()];
for (const route of savedRoutes) await replay(route);
const allCheckpoints=[];
for(const job of jobs) {
  const checkpoint=path.join(OUT,`${job.id}.json`);
  if(!fs.existsSync(checkpoint)) continue;
  const content=fs.readFileSync(checkpoint,'utf8');
  const result=JSON.parse(content);
  allCheckpoints.push({id:job.id,kind:job.kind,starter:job.starter,
    checkpoint:`runtime/search-underground/${job.id}.json`,checkpointHash:hash(content),
    complete:result.complete===true,visited:result.visited,generated:result.generated,
    frontierEntries:result.frontier.length,terminalRoutes:result.terminals.length,
    rejected:result.rejected.length,failures:result.failures.length,bounds:result.bounds,
    kernelVersion:result.version,protocol:result.protocol,
    linkUiContraction:result.pruning?.linkUiLoops
      ? {enabled:result.pruning.linkUiLoops.enabled,policy:result.pruning.linkUiLoops.policy,
          counts:result.pruning.linkUiLoops.counts} : null,
    checkpointCompatibility:result.checkpointCompatibility,
    drawBoundaryEntries:result.frontier.filter(f=>['drawBoundary','draw-handoff'].includes(f.reason)).length});
}
const checkpointIds=new Set(allCheckpoints.map(c=>c.id));
const summary={
  schemaVersion:1,generatedAt:new Date().toISOString(),
  scope:'UNDERGROUND / Terraforming one-card first-turn, empty opponent, fixed 40/15 preset. Bounded response-history search, not exhaustive completion.',
  complete:false,
  assumptions:['Exactly one initial hand card removed from the preset main deck.',
    'No opponent interaction; no extra initial hand cost is supplied.',
    'All engine candidate placements and material selections are retained by the shared kernel.',
    'No visible-board transposition pruning. Grouping boards only limits report representatives.',
    'The v2 kernel contracts only audited no-op cycles inside one standard Link UI transaction.',
    'Draws stop at the first resolved draw; fixed fixture results are not treated as draw-independent routes.'],
  limits,elapsedMs:Date.now()-started,presetHash:hash(preset),sourceHash:hash(source),
  kernelHash:hash(fs.readFileSync(path.join(ROOT,'scripts/search-kernel.mjs'),'utf8')),
  initialBanishCoverage:initialBanishCoverage.map(({prefix,...coverage})=>coverage),sourceReplayChecks:routeChecks,
  search:{jobsAvailable:jobs.length,jobsRun,visitedNodes:visited,observedNodes:observedTotal,
    jobsWithCheckpoints:allCheckpoints.length,
    cumulativeCheckpointVisits:allCheckpoints.reduce((n,r)=>n+r.visited,0),
    frontierEntryCount:allCheckpoints.reduce((n,r)=>n+r.frontierEntries,0),
    completedJobs:allCheckpoints.filter(r=>r.complete).length,
    engineFailures:allCheckpoints.reduce((n,r)=>n+r.failures,0),
    coreRejectedResponses:allCheckpoints.reduce((n,r)=>n+r.rejected,0),
    drawBoundaryEntries:allCheckpoints.reduce((n,r)=>n+r.drawBoundaryEntries,0),
    protocolHashes:[...new Set(allCheckpoints.map(r=>r.protocol?.hash).filter(Boolean))],
    protocolVerifiedCheckpoints:allCheckpoints.filter(r=>r.protocol?.sumSortVerified).length,
    linkUiContractions:allCheckpoints.reduce((n,r)=>n+
      Object.values(r.linkUiContraction?.counts||{}).reduce((sum,value)=>sum+value,0),0),
    stableBoardCount:stableBoards.size,
    representativeCount:savedRoutes.length,promptCounts,results:allCheckpoints,
    invocationResults:results,
    deferredJobs:jobs.filter(j=>!checkpointIds.has(j.id)).map(j=>({id:j.id,kind:j.kind,starter:j.starter})),
    runtimeManifest:'runtime/search-underground/manifest.json',
    runtimeManifestHash:hash(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8')),
    checkpointDirectory:'runtime/search-underground',
    drawFrontier:{count:drawFrontier.size,path:'runtime/search-underground/draw-frontier.json',
      hash:hash([...drawFrontier.values()])}},
  routes:savedRoutes,
  unresolved:['Unexpanded response histories and depth/time/node bounds remain in kernel checkpoints.',
    'Terraforming same-name search copies beyond the canonical prefix remain in the whole-opening frontier.',
    'All possible draw outcomes, opponent responses, and future turns are outside this worker.',
    'Neither maximum board strength nor all finite/infinite action sequences have been proven.'],
};
write(ROUTES,summary);
console.log(JSON.stringify({event:'complete',complete:false,jobsRun,visitedNodes:visited,observedNodes:observedTotal,
  routes:savedRoutes.length,drawFrontier:drawFrontier.size,output:ROUTES}));
