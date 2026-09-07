import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {startRoute,respond,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

// Search evidence, not an opening-book policy. Every prefix recreates the real
// duel from its complete response history; equal visible boards are never merged.
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const RUN=path.join(ROOT,'runtime/search-dormouse');
const OUT=path.join(ROOT,'routes/exhaustive-dormouse.json');
const C={dorm:32061192,rabbit:69272449,cat:96676583,hare:20938824,
  tb:57111661,mtp:94722358,gwc:20726052};
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const clone=x=>structuredClone(x);
const compactCard=c=>({code:c.code,location:c.location,sequence:c.sequence,position:c.position,place:c.place});
const summary=g=>({board:board(g),pending:safe(g.pending),historyHash:hash(g.route.steps.map(s=>s.input))});

async function restore(inputs) {
  const g=await startRoute([C.dorm]);
  try {for(const input of inputs)respond(g,input.input||input);return g;}
  catch(e){g.close();throw e;}
}
function take(g,test) {
  const c=g.prompt.choices.find(test);assert(c,'Required first-stage choice missing');
  respond(g,{action:c.id});
}
function firstStageCandidates(g) {
  if(g.prompt.mode==='single')return g.prompt.choices.map(c=>({action:c.id}));
  assert.equal(g.prompt.mode,'multi');
  assert.equal(g.prompt.min,1);assert.equal(g.prompt.max,1);
  return g.prompt.cards.map((_,i)=>({selection:[i]}));
}
function firstStageBoundary(g) {
  if(g.prompt.type==='SELECT_IDLECMD')return 'next-main-phase-action';
  if(g.prompt.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>[C.tb,C.mtp,C.gwc].includes(c.card?.code)))
    return 'first-trap-response-window';
  return null;
}

async function auditBaselines() {
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/malice-monsters.json')));
  const routes=[...source.routes,...source.probes].filter(r=>r.hand?.length===1&&r.hand[0]===C.dorm);
  const observed=new Map();const records=[];const after=new Map();
  for(const route of routes) {
    await replay(route);
    const g=await startRoute([C.dorm]);
    try {
      for(let step=0;step<=route.steps.length;step++) {
        const history=g.route.steps.map(s=>s.input);const key=hash(history);
        if(!observed.has(key)) {
          const p=g.prompt;
          const record={historyHash:key,depth:step,prompt:p.type,
            choices:p.choices.map(c=>({id:c.id,label:c.label,response:safe(c.response),card:c.card?compactCard(c.card):undefined})),
            cards:p.cards?.map(compactCard),min:p.min,max:p.max,board:board(g)};
          if(p.type==='SELECT_IDLECMD') {
            record.availableExtra=p.choices.filter(c=>c.response.action===1&&c.card?.location===64).map(c=>c.card.code);
            for(const code of record.availableExtra) {
              const group=after.get(code)||{code,name:cards[code]?.name,availableAt:[],selectedAt:[]};
              group.availableAt.push(key);after.set(code,group);
            }
          }
          observed.set(key,record);
        }
        if(step===route.steps.length)break;
        const input=route.steps[step].input;
        const chosen=g.prompt.choices.find(c=>c.id===input.action);
        if(g.prompt.type==='SELECT_IDLECMD'&&chosen?.response.action===1&&chosen.card?.location===64)
          after.get(chosen.card.code).selectedAt.push(key);
        respond(g,input);
      }
      records.push({id:route.id,steps:route.steps.length,finalHash:route.finalHash,verified:true});
    }finally{g.close();}
  }
  fs.writeFileSync(path.join(RUN,'baseline-nodes.json'),JSON.stringify([...observed.values()],null,2)+'\n');
  const extras=[...after.values()].map(x=>({...x,availableAt:[...new Set(x.availableAt)],selectedAt:[...new Set(x.selectedAt)]}));
  return {routes:records,distinctHistoryNodes:observed.size,
    extraAvailability:extras,availableButNeverSelected:extras.filter(x=>!x.selectedAt.length).map(x=>x.code),
    note:'These are exact distinct response histories visited by existing routes, not all reachable states. Availability is not a verified material/placement continuation.'};
}

async function firstStage() {
  const roots=[];const outputs=[];const rootChoices=[];
  for(let zone=0;zone<5;zone++) {
    const g=await startRoute([C.dorm]);
    try {
      if(zone===0)rootChoices.push(...g.prompt.choices.map(c=>({label:c.label,response:c.response})));
      take(g,c=>c.response.action===0&&c.card?.code===C.dorm);
      const i=g.prompt.cards.findIndex(c=>c.place.player===0&&c.place.location===4&&c.place.sequence===zone);
      assert(i>=0);respond(g,{selection:[i]});
      take(g,c=>c.response.action===5&&c.card?.code===C.dorm);
      assert.equal(g.prompt.type,'SELECT_CARD');
      assert.deepEqual(g.prompt.cards.map(c=>c.code).sort((a,b)=>a-b),
        [C.rabbit,C.rabbit,C.rabbit,C.cat,C.cat,C.cat,C.hare].sort((a,b)=>a-b));
      for(let candidate=0;candidate<g.prompt.cards.length;candidate++)roots.push({zone,
        banished:compactCard(g.prompt.cards[candidate]),inputs:[...g.route.steps.map(s=>s.input),{selection:[candidate]}]});
    }finally{g.close();}
  }
  assert.equal(roots.length,35);
  const queue=roots.map(r=>({...r,inputs:clone(r.inputs)}));
  const prefixCountByKind={};let processed=0;let edges=0;
  const file=path.join(RUN,'first-stage-frontier.jsonl');fs.writeFileSync(file,'');
  const examples=new Map();
  while(queue.length) {
    const current=queue.pop();const g=await restore(current.inputs);
    try {
      processed++;
      assert(g.route.steps.length<20,'First-stage boundary unexpectedly escaped');
      assert(!g.log.some(e=>e.text.includes('枚ドロー')),'First-stage draw was unexpected');
      const boundary=firstStageBoundary(g);
      if(boundary) {
        const record={...current,boundary,...summary(g)};
        const key=String(current.banished.code);
        prefixCountByKind[key]=(prefixCountByKind[key]||0)+1;
        fs.appendFileSync(file,JSON.stringify(record)+'\n');
        outputs.push({historyHash:record.historyHash,zone:current.zone,banished:current.banished,
          boundary,inputs:current.inputs,boardHash:hash(record.board),pendingHash:hash(record.pending)});
        if(!examples.has(key))examples.set(key,finishRoute(g,{id:`dorm-first-stage-${key}`,starter:C.dorm,
          name:`Dormouse initial banish ${cards[current.banished.code]?.name}`,requiresDraw:false,
          boundary,scope:'Initial effect chain only; continuation deliberately remains frontier.'}));
      } else {
        const candidates=firstStageCandidates(g);assert(candidates.length>0);
        for(let i=candidates.length-1;i>=0;i--)queue.push({...current,inputs:[...current.inputs,candidates[i]]});
        edges+=candidates.length;
      }
      if(processed%250===0)console.log(JSON.stringify({phase:'first-stage',processed,frontier:queue.length,boundaries:outputs.length}));
    }finally{g.close();}
  }
  for(const route of examples.values())await replay(route);
  return {rootChoices,roots,processedNodes:processed,expandedEdges:edges,leafCount:outputs.length,
    prefixCountByKind,leaves:outputs,representatives:[...examples.values()],
    completeWithinBoundary:true,
    boundary:'After Dormouse normal summon and first deck banish, enumerate every optional return, target instance, summon position, battle position, Rabbit trigger and trap placement until next idle or first trap response window.',
    outsideBoundary:['Initial pass/set or Link-1 before Dormouse activation','All subsequent effect/Extra Deck/material/placement branches','Opponent interruption and later turns','All random draws'],
    runtimeEvidence:'runtime/search-dormouse/first-stage-frontier.jsonl'};
}

async function deepSearch(result) {
  const {search}=await import('./search-kernel.mjs');
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/malice-monsters.json')));
  const routes=[...source.routes,...source.probes].filter(r=>r.hand?.length===1&&r.hand[0]===C.dorm);
  const missing=new Set(result.baselineAudit.availableButNeverSelected);
  const seeds=new Map();
  for(const route of routes) {
    const g=await startRoute([C.dorm]);
    try {
      for(let step=0;step<=route.steps.length;step++) {
        if(g.prompt.type==='SELECT_IDLECMD')for(const choice of g.prompt.choices) {
          if(choice.response.action!==1||!missing.has(choice.card?.code)||choice.card.location!==64)continue;
          const prefix=[...g.route.steps.map(s=>s.input),{action:choice.id}];
          const id=hash(prefix);
          if(!seeds.has(id))seeds.set(id,{id,code:choice.card.code,source:route.id,prefix});
        }
        if(step<route.steps.length)respond(g,route.steps[step].input);
      }
    }finally{g.close();}
  }
  const entries=[];const examples=new Map();const draws=[];
  const limit=Number(process.env.DORM_SEARCH_NODES||100);
  const nextDepth=Number(process.env.DORM_SEARCH_DEPTH||12);
  const start=Date.now();
  for(const seed of seeds.values()) {
    let arrivals=0;
    const checkpoint=path.join(RUN,`extra-${seed.code}-${seed.id.slice(0,12)}.json`);
    const searchResult=await search({hand:[C.dorm],prefix:seed.prefix,seed:123,
      maxNodes:limit,maxDepth:seed.prefix.length+nextDepth,maxMs:6000,maxGenerated:limit*50,
      stopOnDraw:true,checkpointPath:checkpoint,
      onNode(g,info) {
        if(g.log.some(e=>e.text.includes('枚ドロー'))) {
          draws.push({prefix:info.prefix,reason:'draw-handoff',source:seed.id});
          return {stop:true,reason:'draw-handoff'};
        }
        if(board(g).players[0].monsters.some(c=>c?.code===seed.code)) {
          arrivals++;
          if(!examples.has(seed.code))examples.set(seed.code,finishRoute(g,{
            id:`dorm-extra-${seed.code}`,starter:C.dorm,name:`Dormouse verified summon ${cards[seed.code]?.name}`,
            target:seed.code,sourceRoute:seed.source,requiresDraw:false,
            boundary:'Target Extra monster has been summoned; post-summon triggers and all later play remain unresolved.'}));
          return {stop:true,reason:'target-extra-summoned'};
        }
        return null;
      }});
    assert.equal(searchResult.failures.length,0,'Core/tool failure in bounded Extra search');
    const reasons={};for(const f of searchResult.frontier)reasons[f.reason]=(reasons[f.reason]||0)+1;
    entries.push({id:seed.id,code:seed.code,source:seed.source,prefix:seed.prefix,
      visited:searchResult.visited,generated:searchResult.generated,rejected:searchResult.rejected.length,
      terminalCount:searchResult.terminals.length,arrivals,frontier:searchResult.frontier.length,
      reasons,complete:searchResult.complete,checkpoint:path.relative(ROOT,checkpoint).replaceAll('\\','/'),bounds:searchResult.bounds});
    console.log(JSON.stringify({phase:'extra-search',case:entries.length,cases:seeds.size,code:seed.code,
      visited:searchResult.visited,arrivals,frontier:searchResult.frontier.length}));
  }
  for(const route of examples.values())await replay(route);
  fs.writeFileSync(path.join(RUN,'draw-handoffs.json'),JSON.stringify(draws,null,2)+'\n');
  result.deepSearch={scope:'Every exact-history idle node in the six existing Dormouse routes where a previously unselected Extra monster is offered.',
    complete:false,seedCount:seeds.size,entries,representatives:[...examples.values()],
    totalVisited:entries.reduce((n,x)=>n+x.visited,0),totalGenerated:entries.reduce((n,x)=>n+x.generated,0),
    totalFrontier:entries.reduce((n,x)=>n+x.frontier,0),arrivalHistories:entries.reduce((n,x)=>n+x.arrivals,0),
    drawHandoffs:draws.length,elapsedMs:Date.now()-start,
    limitations:['Every configured search preserves unresolved material-selection toggle loops.','Stopping after the requested Extra summon is an observer frontier, not a completed turn.','Only existing-route contexts are seeded; the 2080 first-stage leaves and other unvisited histories are not exhausted.','maxDepth is an absolute response-history bound; each seed permits the configured additional responses.']};
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({result:'DEEP PASS',seeds:seeds.size,visited:result.deepSearch.totalVisited,
    arrivalHistories:result.deepSearch.arrivalHistories,extraSummons:[...examples.keys()],frontier:result.deepSearch.totalFrontier}));
}

async function expandFirstStage(result) {
  const {search}=await import('./search-kernel.mjs');
  const leaves=result.firstStage.leaves;
  const budget=Number(process.env.DORM_FRONTIER_NODES||10000);
  assert(Number.isSafeInteger(budget)&&budget>=0);
  const evidenceFile=path.join(RUN,'continuation-summary.json');
  const old=fs.existsSync(evidenceFile)?JSON.parse(fs.readFileSync(evidenceFile)):null;
  assert(!old||old.schemaVersion<2,'Partition aggregation is active. Continue with --partition --no-publish, then --aggregate.');
  const records=old?.entries||[];const index=new Map(records.map(x=>[x.historyHash,x]));
  const base=Math.floor(budget/leaves.length);const remainder=budget%leaves.length;
  const began=Date.now();let invocationVisited=0;let invocationCases=0;
  const drawFile=path.join(RUN,'continuation-draw-handoffs.jsonl');
  function totals() {
    return {schemaVersion:1,seedCount:leaves.length,processedCases:records.length,
      visited:records.reduce((n,x)=>n+x.visited,0),generated:records.reduce((n,x)=>n+x.generated,0),
      frontier:records.reduce((n,x)=>n+x.frontier,0),unstartedLeaves:leaves.length-records.length,
      terminalCount:records.reduce((n,x)=>n+x.terminalCount,0),
      rejectedCount:records.reduce((n,x)=>n+x.rejected,0),
      linkUiPruningCounts:{
        linkMaterialToggle:records.reduce((n,x)=>n+(x.linkUiPruning?.counts.linkMaterialToggle||0),0),
        cancelledLinkSummon:records.reduce((n,x)=>n+(x.linkUiPruning?.counts.cancelledLinkSummon||0),0)},
      drawBoundaries:records.reduce((n,x)=>n+(x.reasons['draw-handoff']||x.reasons.drawBoundary||0),0),
      complete:false,entries:records,elapsedMs:(old?.elapsedMs||0)+Date.now()-began,
      invocation:{budget,visited:invocationVisited,cases:invocationCases},
      allocation:'Each of the 2080 exact first-stage leaves receives floor(budget/2080) or ceil(budget/2080) additional core nodes per invocation. Each case checkpoints separately.',
      noMerging:'No game-state merging. Every case replays the full fixture response history; the kernel may contract only its audited no-op Link UI transactions, recorded per checkpoint.',
      limitations:['The budget does not prove all later lines.','Each bounded call retains unresolved depth and unsupported-contract frontiers.','Draw results are paused and handed off; no drawn card is assumed guaranteed.','Totals include replayed ancestor work across cases and invocations.']};
  }
  function save() {
    const t=totals();fs.writeFileSync(evidenceFile,JSON.stringify(t,null,2)+'\n');
    result.continuationSearch={...t,entries:undefined,
      manifest:'runtime/search-dormouse/continuation-summary.json',
      drawHandoffs:'runtime/search-dormouse/continuation-draw-handoffs.jsonl'};
    fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
    return t;
  }
  for(let i=0;i<leaves.length;i++) {
    const allowance=base+(i<remainder?1:0);if(!allowance)continue;
    const leaf=leaves[i];const checkpoint=path.join(RUN,`continuation-${leaf.historyHash}.json`);
    const previous=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint)):undefined;
    if(previous?.complete)continue;
    const r=await search({hand:[C.dorm],prefix:leaf.inputs,seed:123,resume:previous,
      maxNodes:allowance,maxMs:30000,maxDepth:180,maxGenerated:Math.max(1000,allowance*50),
      stopOnDraw:true,checkpointPath:checkpoint,
      onNode(g,info) {
        if(g.log.some(e=>e.text.includes('枚ドロー'))) {
          fs.appendFileSync(drawFile,JSON.stringify({seed:123,hand:[C.dorm],historyHash:leaf.historyHash,prefix:info.prefix,reason:'draw-handoff'})+'\n');
          return {stop:true,reason:'draw-handoff'};
        }
      }});
    assert.equal(r.failures.length,0,'Continuation core/tool failure');
    const reasons={};for(const frame of r.frontier)reasons[frame.reason]=(reasons[frame.reason]||0)+1;
    const record={historyHash:leaf.historyHash,firstBanish:leaf.banished.code,zone:leaf.zone,
      visited:r.visited,generated:r.generated,frontier:r.frontier.length,complete:r.complete,
      terminalCount:r.terminals.length,rejected:r.rejected.length,reasons,
      kernelVersion:r.version,linkUiPruning:r.pruning.linkUiLoops?{
        enabled:r.pruning.linkUiLoops.enabled,policy:r.pruning.linkUiLoops.policy,counts:r.pruning.linkUiLoops.counts}:null,
      checkpoint:path.relative(ROOT,checkpoint).replaceAll('\\','/')};
    if(index.has(leaf.historyHash))Object.assign(index.get(leaf.historyHash),record);
    else{records.push(record);index.set(leaf.historyHash,record);}
    invocationVisited+=r.invocation.visited;invocationCases++;
    if(invocationCases%100===0) {
      const t=save();console.log(JSON.stringify({phase:'continuation',cases:invocationCases,totalCases:leaves.length,
        invocationVisited,totalVisited:t.visited,frontier:t.frontier,elapsedMs:Date.now()-began}));
    }
  }
  const t=save();console.log(JSON.stringify({result:'CONTINUATION PASS',visited:t.visited,
    invocationVisited,cases:t.processedCases,frontier:t.frontier,unstarted:t.unstartedLeaves,
    elapsedMs:Date.now()-began,drawBoundaries:t.drawBoundaries}));
}

function partitionTargets(result) {
  assert.equal(result.presetHash,hash(preset),'Preset drift');
  assert.equal(result.firstStage.leaves.length,2080);
  assert.equal(result.rootAlternatives?.prefixes.filter(x=>x.boundary).length,20,
    'Run --roots before partitioning');
  const targets=[...result.firstStage.leaves.map(x=>({...x,kind:'first-stage'})),
    ...result.rootAlternatives.prefixes.filter(x=>x.boundary).map(x=>({...x,kind:'root-alternative',historyHash:hash(x.inputs)}))];
  assert.equal(new Set(targets.map(x=>x.historyHash)).size,2100,'Overlapping root histories');
  return targets.map((target,globalIndex)=>({...target,globalIndex,
    checkpoint:path.join(RUN,`continuation-${target.historyHash}.json`)}));
}

function integerEnv(name,fallback,min=0) {
  const value=process.env[name]===undefined?fallback:Number(process.env[name]);
  assert(Number.isSafeInteger(value)&&value>=min,`${name} must be an integer >= ${min}`);return value;
}
function atomicJson(file,value) {
  const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');fs.renameSync(temporary,file);
}
function exclusiveLock(file) {
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const fd=fs.openSync(file,'wx');
      fs.writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));fs.closeSync(fd);
      return ()=>{if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).pid===process.pid)fs.unlinkSync(file);};
    } catch(error) {
      if(error.code!=='EEXIST')throw error;
      const owner=JSON.parse(fs.readFileSync(file));
      let alive=true;
      try{process.kill(owner.pid,0);}catch(probe){if(probe.code==='ESRCH')alive=false;else throw probe;}
      if(alive)throw new Error(`Search checkpoint is owned by live PID ${owner.pid}: ${file}`);
      fs.unlinkSync(file);
    }
  }
  throw new Error(`Cannot acquire search lock: ${file}`);
}

function checkpointRecord(target,checkpoint) {
  if(!checkpoint)return {globalIndex:target.globalIndex,historyHash:target.historyHash,kind:target.kind,
    started:false,visited:0,generated:0,frontier:1,terminalCount:0,rejected:0,failures:0,complete:false,
    reasons:{unstarted:1},checkpoint:path.relative(ROOT,target.checkpoint).replaceAll('\\','/')};
  assert.equal(checkpoint.presetHash,hash(preset),'Checkpoint preset differs');
  assert.deepEqual(checkpoint.hand,[C.dorm]);assert.equal(checkpoint.seed,123);
  assert.equal(hash(checkpoint.rootPrefix),target.historyHash,'Checkpoint belongs to another root');
  assert.equal(checkpoint.deckOrder??null,null,'Partition requires the fixed fixture deck order');
  const reasons={};for(const f of checkpoint.frontier)reasons[f.reason]=(reasons[f.reason]||0)+1;
  const ui=checkpoint.pruning?.linkUiLoops;
  return {globalIndex:target.globalIndex,historyHash:target.historyHash,kind:target.kind,started:true,
    firstBanish:target.banished?.code,zone:target.zone,id:target.id,
    visited:checkpoint.visited,generated:checkpoint.generated,frontier:checkpoint.frontier.length,
    terminalCount:checkpoint.terminals.length,rejected:checkpoint.rejected.length,
    failures:checkpoint.failures.length,complete:checkpoint.complete,reasons,kernelVersion:checkpoint.version,
    linkUiPruning:ui?{enabled:ui.enabled,policy:ui.policy,counts:ui.counts}:null,
    checkpoint:path.relative(ROOT,target.checkpoint).replaceAll('\\','/')};
}

async function runPartition(result) {
  const count=integerEnv('DORM_PARTITION_COUNT',4,1);const index=integerEnv('DORM_PARTITION_INDEX',0);
  assert(index<count,'DORM_PARTITION_INDEX must be less than DORM_PARTITION_COUNT');
  const budget=integerEnv('DORM_LEAF_NODES',1000);
  const maxMs=integerEnv('DORM_LEAF_MAX_MS',30000,1);assert(maxMs<=30000,'DORM_LEAF_MAX_MS must be <= 30000');
  const maxDepth=integerEnv('DORM_MAX_DEPTH',180,1);
  const offset=integerEnv('DORM_PARTITION_OFFSET',0);
  const limit=integerEnv('DORM_PARTITION_LIMIT',Number.MAX_SAFE_INTEGER);
  const targets=partitionTargets(result);
  const assigned=targets.filter(t=>t.globalIndex%count===index);
  const selected=assigned.slice(offset,offset+limit);
  const layoutHash=hash(targets.map(t=>[t.globalIndex,t.historyHash]));
  if(process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({result:'PARTITION PLAN',count,index,total:targets.length,assigned:assigned.length,
      selected:selected.length,offset,limit,layoutHash,indices:selected.map(t=>t.globalIndex),histories:selected.map(t=>t.historyHash)}));return;
  }
  const folder=path.join(RUN,'partitions');fs.mkdirSync(folder,{recursive:true});
  const partitionName=`p${count}-${index}`;const release=exclusiveLock(path.join(folder,`${partitionName}.lock`));
  const progressFile=path.join(folder,`${partitionName}.json`);const began=Date.now();
  const entries=[];let visited=0;let skippedComplete=0;let skippedBoundaries=0;
  const progress=()=>({schemaVersion:1,presetHash:hash(preset),layoutHash,count,index,totalTargets:targets.length,
    assigned:assigned.length,selected:selected.length,offset,limit,perLeafNodes:budget,maxMs,maxDepth,
    visited,skippedComplete,skippedBoundaries,processed:entries.length,elapsedMs:Date.now()-began,entries,
    sharedPublication:false,publication:'Run --aggregate separately; this worker never writes routes JSON or the shared continuation summary.'});
  try {
    const {search}=await import('./search-kernel.mjs');
    for(const target of selected) {
      const releaseLeaf=exclusiveLock(`${target.checkpoint}.lock`);
      try {
        let previous=fs.existsSync(target.checkpoint)?JSON.parse(fs.readFileSync(target.checkpoint)):undefined;
        if(previous)checkpointRecord(target,previous);
        if(previous?.complete){skippedComplete++;entries.push(checkpointRecord(target,previous));continue;}
        if(previous) {
          const persistent=f=>['drawBoundary','draw-handoff','opponentDecision'].includes(f.reason)||
            (f.reason==='maxDepth'&&f.prefix.length>=maxDepth);
          const held=previous.frontier.filter(persistent);const runnable=previous.frontier.filter(f=>!persistent(f));
          if(!runnable.length&&held.length&&!previous.rejected.some(x=>x.kind==='coreRetry')) {
            skippedBoundaries++;entries.push(checkpointRecord(target,previous));continue;
          }
          // Kernel uses a stack. Preserve every held prefix, but spend the slice
          // on runnable work first instead of repeatedly revisiting a draw.
          previous={...previous,frontier:[...held,...runnable]};
        }
        const r=await search({hand:[C.dorm],prefix:target.inputs,seed:123,resume:previous,
          maxNodes:budget,maxMs,maxDepth,maxGenerated:Math.max(1000,budget*50),stopOnDraw:true,
          checkpointPath:target.checkpoint});
        visited+=r.invocation.visited;entries.push(checkpointRecord(target,r));
        // Draw handoffs remain in this leaf's atomic checkpoint frontier.
        assert.equal(r.failures.length,0,`Partition core/tool failure: ${target.historyHash}`);
      }finally{releaseLeaf();}
      atomicJson(progressFile,progress());
      console.log(JSON.stringify({phase:'partition',count,index,processed:entries.length,total:selected.length,
        globalIndex:target.globalIndex,kind:target.kind,invocationVisited:visited,
        leafVisited:entries.at(-1).visited,leafFrontier:entries.at(-1).frontier,elapsedMs:Date.now()-began}));
    }
    atomicJson(progressFile,progress());
    console.log(JSON.stringify({result:'PARTITION PASS',count,index,visited,processed:entries.length,
      assigned:assigned.length,skippedComplete,skippedBoundaries,elapsedMs:Date.now()-began,sharedPublication:false}));
  }finally{release();}
}

function aggregatePartitions(result) {
  const release=exclusiveLock(path.join(RUN,'aggregate.lock'));
  try {
    const targets=partitionTargets(result);const entries=[];
    for(const target of targets)entries.push(checkpointRecord(target,
      fs.existsSync(target.checkpoint)?JSON.parse(fs.readFileSync(target.checkpoint)):undefined));
    const sum=key=>entries.reduce((n,x)=>n+(x[key]||0),0);
    const reasons={};for(const e of entries)for(const [k,v] of Object.entries(e.reasons))reasons[k]=(reasons[k]||0)+v;
    const summary={schemaVersion:2,presetHash:hash(preset),scope:'2080 first-stage leaves plus all 20 unresolved initial-action alternatives',
      seedCount:targets.length,firstStageCount:2080,rootAlternativeCount:20,processedCases:entries.filter(x=>x.started).length,
      visited:sum('visited'),generated:sum('generated'),frontier:sum('frontier'),unstartedLeaves:entries.filter(x=>!x.started).length,
      terminalCount:sum('terminalCount'),initialFirstTurnTerminals:result.rootAlternatives.firstTurnTerminals,
      rejectedCount:sum('rejected'),failureCount:sum('failures'),reasonCounts:reasons,
      drawBoundaries:(reasons['draw-handoff']||0)+(reasons.drawBoundary||0),
      linkUiPruningCounts:{linkMaterialToggle:entries.reduce((n,x)=>n+(x.linkUiPruning?.counts.linkMaterialToggle||0),0),
        cancelledLinkSummon:entries.reduce((n,x)=>n+(x.linkUiPruning?.counts.cancelledLinkSummon||0),0)},
      complete:entries.every(x=>x.started&&x.complete&&x.failures===0),entries,
      aggregatedAt:new Date().toISOString(),layoutHash:hash(targets.map(t=>[t.globalIndex,t.historyHash])),
      limitations:['Snapshot of atomically written leaf checkpoints; active workers can advance after this read.',
        'Root prefixes are disjoint full response histories; visible board or HOPT state is never used to merge them.',
        'The six already-completed initial pass/end-turn routes are counted separately.',
        'Complete refers only to the kernel fixed-order/no-interruption scope; any draw or unverified-contract frontier prevents completeness.']};
    const manifest=path.join(RUN,'continuation-summary.json');atomicJson(manifest,summary);
    result.continuationSearch={...summary,entries:undefined,
      manifest:'runtime/search-dormouse/continuation-summary.json',
      drawHandoffs:'Each continuation-<historyHash>.json frontier with drawBoundary or draw-handoff reason'};
    atomicJson(OUT,result);
    console.log(JSON.stringify({result:'AGGREGATE PASS',seeds:summary.seedCount,started:summary.processedCases,
      visited:summary.visited,frontier:summary.frontier,terminals:summary.terminalCount,
      initialTerminals:summary.initialFirstTurnTerminals,unstarted:summary.unstartedLeaves,
      failures:summary.failureCount,complete:summary.complete}));
  }finally{release();}
}

async function verifyResult(result) {
  assert.equal(result.presetHash,hash(preset),'Preset drift');
  assert.equal(result.firstStage.leaves.length,2080);
  assert.equal(new Set(result.firstStage.leaves.map(x=>x.historyHash)).size,2080);
  const selected=[];
  for(const root of result.firstStage.roots) {
    const leaf=result.firstStage.leaves.find(x=>JSON.stringify(x.inputs.slice(0,4))===JSON.stringify(root.inputs));
    assert(leaf,'One physical-copy/placement root lost every continuation');selected.push(leaf);
  }
  assert.equal(selected.length,35);
  for(const leaf of result.firstStage.leaves)assert.equal(hash(leaf.inputs),leaf.historyHash,'Stored input history modified');
  for(const leaf of selected) {
    const g=await restore(leaf.inputs);
    try {
      assert.equal(hash(board(g)),leaf.boardHash,'Stored board drift');
      assert.equal(hash(g.pending),leaf.pendingHash,'Stored prompt drift');
      assert.equal(firstStageBoundary(g),leaf.boundary,'Stored boundary drift');
    }finally{g.close();}
  }
  let routes=0;
  for(const route of [...result.firstStage.representatives,...(result.deepSearch?.representatives||[])]) {
    await replay(route);routes++;
  }
  const reachableExtra=new Set(result.baselineAudit.extraAvailability.filter(x=>x.selectedAt.length).map(x=>x.code));
  for(const route of result.deepSearch?.representatives||[]) {
    assert(!route.log.some(e=>e.text.includes('枚ドロー')),'Draw-dependent Extra witness');
    reachableExtra.add(route.target);
  }
  if(result.deepSearch)assert.deepEqual([...reachableExtra].sort((a,b)=>a-b),[...preset.extra].sort((a,b)=>a-b));
  if(result.continuationSearch) {
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,result.continuationSearch.manifest)));
    const expected=manifest.schemaVersion>=2?2100:2080;
    assert.equal(manifest.entries.length,expected,'Continuation allocation omitted leaves');
    for(const record of manifest.entries) {
      if(record.started===false) {
        assert.equal(record.frontier,1);assert.equal(record.complete,false);continue;
      }
      const checkpoint=JSON.parse(fs.readFileSync(path.join(ROOT,record.checkpoint)));
      assert.equal(checkpoint.presetHash,result.presetHash);
      assert.equal(checkpoint.failures.length,0);
      assert.equal(checkpoint.visited,record.visited);
      assert.equal(checkpoint.frontier.length,record.frontier);
    }
  }
  console.log(JSON.stringify({result:'VERIFY PASS',distinctLeafHistories:2080,
    firstStageRootReplays:selected.length,representativeRouteReplays:routes,
    reachableExtraCodes:[...reachableExtra],continuationCheckpoints:result.continuationSearch?.processedCases||0,fullTreeComplete:false}));
}

async function rootAlternatives(result) {
  const roots=[];const summaries=[];
  const first=await startRoute([C.dorm]);
  try {
    take(first,c=>c.response.action===7);
    assert(first.turn>1);roots.push(finishRoute(first,{id:'dorm-initial-pass',terminalReason:'firstTurnEnded'}));
  }finally{first.close();}
  for(let zone=0;zone<5;zone++) {
    const set=await startRoute([C.dorm]);
    try {
      take(set,c=>c.response.action===3&&c.card?.code===C.dorm);
      const i=set.prompt.cards.findIndex(c=>c.place.sequence===zone&&c.place.player===0);
      assert(i>=0);respond(set,{selection:[i]});
      roots.push(finishRoute(set,{id:`dorm-initial-set-${zone}`,boundary:'set-monster-next-action'}));
    }finally{set.close();}
    const normal=await startRoute([C.dorm]);
    let normalInputs;let alternatives;
    try {
      take(normal,c=>c.response.action===0&&c.card?.code===C.dorm);
      const i=normal.prompt.cards.findIndex(c=>c.place.sequence===zone&&c.place.player===0);
      assert(i>=0);respond(normal,{selection:[i]});
      normalInputs=normal.route.steps.map(s=>s.input);
      alternatives=normal.prompt.choices.filter(c=>c.response.action!==5);
      assert.deepEqual(alternatives.filter(c=>c.card).map(c=>c.card.code).sort((a,b)=>a-b),[24842059,30342076,60303245].sort((a,b)=>a-b));
      assert.equal(alternatives.length,4);
    }finally{normal.close();}
    for(const choice of alternatives) {
      const game=await restore([...normalInputs,{action:choice.id}]);
      try {
        const metadata={id:`dorm-before-banish-${zone}-${choice.card?.code||'pass'}`};
        if(game.turn>1)metadata.terminalReason='firstTurnEnded';
        else metadata.boundary='link-1-material-selection-before-dormouse-effect';
        roots.push(finishRoute(game,metadata));
      }finally{game.close();}
    }
  }
  assert.equal(roots.length,26);
  for(const route of roots) {
    await replay(route);
    summaries.push({id:route.id,inputs:route.steps.map(s=>s.input),finalHash:route.finalHash,
      boundary:route.boundary,terminalReason:route.terminalReason});
  }
  fs.writeFileSync(path.join(RUN,'root-alternatives.json'),JSON.stringify(roots,null,2)+'\n');
  result.rootAlternatives={count:26,firstTurnTerminals:summaries.filter(x=>x.terminalReason).length,
    unresolvedFrontier:summaries.filter(x=>x.boundary).length,prefixes:summaries,
    rootCoverage:'All initial actions and all post-normal-summon actions are represented: pass, set at each zone, Link-1 at each zone, or the Dormouse effect covered by firstStage.',
    scope:'These alternatives are preserved and replayed but their future material/placement/effect decisions remain unresolved.',
    evidence:'runtime/search-dormouse/root-alternatives.json'};
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({result:'ROOTS PASS',replayed:roots.length,terminals:result.rootAlternatives.firstTurnTerminals,
    frontier:result.rootAlternatives.unresolvedFrontier}));
}

async function main() {
  fs.mkdirSync(RUN,{recursive:true});
  const modes=['--partition','--aggregate','--verify','--roots','--deep','--frontier'].filter(x=>process.argv.includes(x));
  assert(modes.length<=1,'Choose one execution mode');
  assert(!process.argv.includes('--no-publish')||modes[0]==='--partition',
    '--no-publish is supported only with --partition');
  assert(!process.argv.includes('--dry-run')||modes[0]==='--partition','--dry-run requires --partition');
  if(process.argv.includes('--partition')) {
    await runPartition(JSON.parse(fs.readFileSync(OUT)));return;
  }
  if(process.argv.includes('--aggregate')) {
    aggregatePartitions(JSON.parse(fs.readFileSync(OUT)));return;
  }
  if(process.argv.includes('--verify')) {
    await verifyResult(JSON.parse(fs.readFileSync(OUT)));return;
  }
  if(process.argv.includes('--roots')) {
    await rootAlternatives(JSON.parse(fs.readFileSync(OUT)));return;
  }
  if(process.argv.includes('--deep')) {
    await deepSearch(JSON.parse(fs.readFileSync(OUT)));return;
  }
  if(process.argv.includes('--frontier')) {
    await expandFirstStage(JSON.parse(fs.readFileSync(OUT)));return;
  }
  const began=Date.now();
  const baselineAudit=await auditBaselines();
  console.log(JSON.stringify({phase:'baseline-audit',...baselineAudit,extraAvailability:baselineAudit.extraAvailability.map(x=>({code:x.code,available:x.availableAt.length,selected:x.selectedAt.length}))}));
  const stage=await firstStage();
  const result={schemaVersion:1,date:'2026-09-08',starter:C.dorm,presetHash:hash(preset),seed:123,
    scope:'Fixed 40+15 preset, first-turn own Main 1, exactly Dormouse in hand, empty opponent field and no interruption.',
    complete:false,completionReason:'Only the explicitly bounded first effect chain is exhaustive; all continuation leaves are retained as unresolved frontier.',
    stateIdentity:'Full response history; never merged by visible board, card name, placement symmetry or presumed HOPT equivalence.',
    baselineAudit,firstStage:stage,elapsedMs:Date.now()-began};
  fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',firstStageLeaves:stage.leafCount,processed:stage.processedNodes,
    byBanish:stage.prefixCountByKind,unresolvedContinuationFrontier:stage.leafCount,elapsedMs:result.elapsedMs}));
}
await main();
