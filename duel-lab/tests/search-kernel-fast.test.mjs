import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {OcgQueryFlags as Q} from 'ocgcore-wasm';
import {search as baseline, enumerateCandidates as baselineCandidates} from '../scripts/search-kernel.mjs';
import {search as accelerated, enumerateCandidates, implementation} from '../scripts/search-kernel-fast.mjs';
import {startRoute, respond, hash, board, finishRoute, replay} from '../scripts/route-harness.mjs';

const C = {wizard:3723262, magician:64865, decoder:30342076, wicked:52698008,
  rabbit:69272449, tb:57111661, allure:1475311, spirit:40366667, accusation:78114463, soul:74652966};
const flags = Object.values(Q).reduce((a,b)=>a|b,0);
const safe = x => JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const semanticResult = r => Object.fromEntries(['presetHash','hand','seed','deckOrder','rootPrefix','scope',
  'terminals','visited','generated','replayedResponses','frontier','complete','rejected','failures',
  'pruning','protocol','bounds'].filter(key=>r[key]!==undefined).map(key=>[key,safe(r[key])]));

function observed(g,info) {
  return {info:safe(info),state:hash({pending:g.pending,board:board(g),log:g.log,
    field:g.lib.duelQueryField(g.handle),zones:[0,1].map(controller=>[1,2,4,8,16,32,64].map(location=>
      g.lib.duelQueryLocation(g.handle,{controller,location,flags})))})};
}

async function differential(options={}) {
  const run = async search => {
    const nodes=[],progress=[],terminals=[];
    const started=performance.now();
    const result=await search({maxMs:60000,...options,onNode:async(g,info)=>{
      assert.deepEqual([...enumerateCandidates(g.prompt,g.pending)],[...baselineCandidates(g.prompt,g.pending)]);
      nodes.push(observed(g,info));
      return options.onNode?.(g,info);
    },onProgress:async info=>{progress.push(safe(info));await options.onProgress?.(info);},
    onTerminal:async route=>{terminals.push(hash(route));await options.onTerminal?.(route);}});
    assert(!result.frontier.some(f=>f.reason==='maxMs'),'Time cutoffs cannot prove equal deterministic prefixes');
    return {result,nodes,progress,terminals,elapsedMs:performance.now()-started};
  };
  const base=await run(baseline),fast=await run(accelerated);
  assert.deepEqual(semanticResult(fast.result),semanticResult(base.result));
  assert.deepEqual(fast.nodes,base.nodes,'Every accepted nonterminal prefix, pending, query state and observer counter must match');
  assert.deepEqual(fast.progress,base.progress);
  assert.deepEqual(fast.terminals,base.terminals);
  return {base,fast};
}

const choose=(g,predicate)=>{
  const c=g.prompt.choices.find(predicate);assert(c,JSON.stringify(safe(g.prompt)));
  respond(g,{action:c.id});
};
async function wickedPrefix() {
  const g=await startRoute([C.wizard,C.magician]);
  try {
    choose(g,c=>c.response.action===0&&c.card?.code===C.wizard);
    respond(g,{selection:[0]});
    choose(g,c=>c.response.action===1&&c.card?.code===C.decoder);
    choose(g,c=>c.card?.code===C.wizard);
    respond(g,{selection:[0]});
    choose(g,c=>c.response.action===1&&c.card?.code===C.wicked);
    assert.equal(g.prompt.type,'SELECT_UNSELECT_CARD');
    return safe(g.route.steps.map(s=>s.input));
  } finally {g.close();}
}

test('accelerator is versioned separately and its copied enumerator matches the pinned audited baseline',()=>{
  const source=fs.readFileSync(new URL('../scripts/search-kernel.mjs',import.meta.url));
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),implementation.baselineSha256);
  assert.equal(implementation.version,3);
  assert.equal(enumerateCandidates.toString(),baselineCandidates.toString());
});

test('actual core: complete Wizard tree retains all cancellation proofs and every logical node',async t=>{
  const {base,fast}=await differential({hand:[C.wizard],maxNodes:300,maxDepth:30});
  assert(fast.result.complete);
  assert(fast.result.pruning.linkUiLoops.counts.cancelledLinkSummon>0);
  assert(fast.result.execution.reusedResponses>0);
  assert(fast.result.execution.coreStarts<base.result.visited);
  t.diagnostic(JSON.stringify({case:'Wizard complete',logicalNodes:base.result.visited,
    baselineMs:base.elapsedMs,acceleratedMs:fast.elapsedMs,execution:fast.result.execution}));
});

test('actual core: first-child reuse preserves deterministic node, depth and generated-tail boundaries',async()=>{
  for(const limits of [
    {maxNodes:1,maxDepth:30}, {maxNodes:37,maxDepth:30},
    {maxNodes:200,maxDepth:3}, {maxNodes:200,maxDepth:30,maxGenerated:7},
    {maxNodes:0,maxDepth:30}, {maxNodes:10,maxGenerated:0},
  ])await differential({hand:[C.rabbit,C.tb],...limits});
});

test('actual core: retained hand-Link material transaction matches toggle/cancel exits at a fixed shard root',async()=>{
  const prefix=await wickedPrefix();
  const {fast}=await differential({hand:[C.wizard,C.magician],prefix,maxNodes:200,maxDepth:30,
    onNode:g=>g.prompt.type!=='SELECT_UNSELECT_CARD'?{stop:true,reason:'transactionExit'}:undefined});
  assert.equal(fast.result.failures.length,0);
  assert(fast.result.pruning.linkUiLoops.counts.linkMaterialToggle>0);
  assert.equal(fast.result.pruning.linkUiLoops.counts.cancelledLinkSummon,0);
  assert(fast.result.frontier.some(f=>f.prompt==='SELECT_PLACE'));
  assert(fast.result.frontier.some(f=>f.prompt==='SELECT_IDLECMD'));
  assert(fast.result.pruning.linkUiLoops.examples.every(e=>e.ancestorDepth>=prefix.length));

  // Continue through the summon and hand material's grave trigger; retain
  // maxNodes rather than using any board equality as an acceptance criterion.
  let magicianGraveTrigger=false;
  const continued=await differential({hand:[C.wizard,C.magician],prefix,maxNodes:150,maxDepth:prefix.length+10,
    onNode:g=>{if(g.prompt.choices.some(c=>c.card?.code===C.magician&&c.card?.location===16))magicianGraveTrigger=true;}});
  assert(continued.fast.nodes.some(n=>n.info.depth>prefix.length+3));
  assert(magicianGraveTrigger,'The hand Link material must reach its actual grave effect choice');
});

test('actual core: an immutable prefix may itself contain a cancelled Link transaction',async()=>{
  const prefix=await wickedPrefix(),g=await startRoute([C.wizard,C.magician]);
  let cycled;
  try {
    for(const input of prefix)respond(g,input);
    choose(g,c=>c.response.index===null);
    choose(g,c=>c.response.action===1&&c.card?.code===C.wicked);
    cycled=safe(g.route.steps.map(s=>s.input));
  }finally{g.close();}
  const {fast}=await differential({hand:[C.wizard,C.magician],prefix:cycled,maxNodes:100,maxDepth:cycled.length+4});
  assert(fast.nodes.length>1);
  assert(fast.result.pruning.linkUiLoops.examples.every(e=>e.ancestorDepth>=cycled.length));
});

test('actual core: unknown DRAW is observed but no later decision is executed',async()=>{
  const {fast}=await differential({hand:[C.allure,C.magician],stopOnDraw:true,maxNodes:300,maxDepth:30});
  const boundaries=fast.result.frontier.filter(f=>f.reason==='drawBoundary');
  assert(boundaries.length>0);
  for(const boundary of boundaries)assert(!fast.nodes.some(n=>n.info.prefix.length>boundary.prefix.length&&
    hash(n.info.prefix.slice(0,boundary.prefix.length))===hash(boundary.prefix)));
  const resumed=await differential({hand:[C.allure,C.magician],prefix:boundaries[0].prefix,
    stopOnDraw:true,maxNodes:3,maxDepth:30});
  assert.equal(resumed.fast.result.invocation.visited,1);
  assert.equal(resumed.fast.result.execution.reusedResponses,0);
});

test('actual core: previously published Main1 routes and snapshots cannot grow when their Duel is reused',async()=>{
  const saved=[];
  const result=await accelerated({hand:[C.wizard],maxNodes:200,maxDepth:30,maxMs:60000,
    onNode(g){
      const published={route:finishRoute(g),snapshot:g.snapshot(0),log:g.log,inputs:g.inputs,lp:g.lp};
      saved.push({published,hash:hash(published)});
    }});
  assert(result.complete);
  assert(saved.length>1);
  for(const savedState of saved)assert.equal(hash(savedState.published),savedState.hash);
  for(const savedState of saved.filter(s=>s.published.route.final.phase==='MAIN 1').slice(0,3)){
    await replay(savedState.published.route);
  }
});

test('actual core: visually unchanged Code of Soul use remains a distinct effect-used node',async()=>{
  const g=await startRoute([C.soul]);let prefix;
  try {
    choose(g,c=>c.response.action===0&&c.card?.code===C.soul);respond(g,{selection:[0]});
    prefix=safe(g.route.steps.map(s=>s.input));
  }finally{g.close();}
  const observations=[];
  await differential({hand:[C.soul],prefix,maxNodes:200,maxDepth:prefix.length+1,onNode:(game,info)=>{
    observations.push({depth:info.depth,board:hash(board(game)),canUse:game.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.soul)});
  }});
  const before=observations.find(o=>o.depth===prefix.length);
  assert(before.canUse);
  assert(observations.some(o=>o.depth>prefix.length&&o.board===before.board&&!o.canUse));
});

test('actual core: baseline migration, accelerated checkpoint reload and generation-tail resume preserve all results',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'astra-fast-kernel-'));
  try {
    const file=path.join(folder,'checkpoint.json');
    let base=await baseline({hand:[C.wizard],maxNodes:1,maxGenerated:1,maxMs:60000});
    let fast=await accelerated({resume:base,maxNodes:0,checkpointPath:file,maxMs:60000});
    assert.equal(fast.version,3);assert.equal(fast.checkpointCompatibility.loadedVersion,2);
    assert(!Object.hasOwn(JSON.parse(fs.readFileSync(file,'utf8')),'routes'));
    for(let i=0;i<20&&!base.complete;i++){
      const options={maxNodes:17,maxGenerated:50,maxDepth:30,maxMs:60000};
      base=await baseline({...options,resume:base});
      fast=await accelerated({...options,resume:file,checkpointPath:file});
      assert.deepEqual(semanticResult(fast),semanticResult(base));
    }
    assert(base.complete);assert(fast.complete);
    await assert.rejects(accelerated({resume:fast,implementation:'ignored',hand:[C.rabbit]}),/differs/);
    await assert.rejects(accelerated({resume:{...fast,implementation:{id:'unknown'}}}),/implementation differs/);
    await assert.rejects(accelerated({resume:fast,pruneLinkUiLoops:false}),/different or disabled/);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('actual core: error observers and invalid response prefixes stay unresolved/rejected identically',async()=>{
  const error=await differential({hand:[C.wizard],maxNodes:20,maxDepth:10,
    onNode:(_g,info)=>{if(info.depth===1)throw new Error('intentional observer failure');}});
  assert(error.fast.result.failures.length>0);
  const mutation=await differential({hand:[],onNode:g=>{g.revision++;}});
  assert.match(mutation.fast.result.failures[0].message,/must not modify/);
  const invalid=await differential({hand:[],prefix:[{action:999999}],maxNodes:4});
  assert.equal(invalid.fast.result.rejected[0].kind,'invalidResponse');
});

test('actual core: first-child RETRY and duplicate saved frames retain the audited baseline outcomes',async()=>{
  // Minimized from a real UG + Baldrake SELECT_CARD cancellation frontier.
  // Empty selection is a generated syntactic candidate, rejected by the core.
  const hand=[68337209,72656408],prefix=[{action:0},{action:0},{action:0},{selection:[5]},
    {action:0},{selection:[0]},{action:0},{action:0}];
  const checkpoint=await baseline({hand,prefix,maxNodes:0});
  checkpoint.frontier[0].nextCandidate=1; // the remaining tail starts after cancel
  checkpoint.frontier.push(structuredClone(checkpoint.frontier[0]));
  const {fast}=await differential({resume:checkpoint,maxNodes:5,maxDepth:prefix.length+1});
  assert(fast.result.rejected.some(r=>r.kind==='coreRetry'&&r.at===8));
  assert(fast.result.execution.reusedResponses>0);
  assert(fast.result.pruning.exactDuplicatePrefixes>0);
});

test('actual core: a callback that expires the time budget leaves the current prompt untouched',async()=>{
  for(const search of [baseline,accelerated]){
    const result=await search({hand:[C.wizard],maxMs:10,maxNodes:100,
      onNode:async()=>{await new Promise(resolve=>setTimeout(resolve,20));}});
    assert.equal(result.terminals.length,0);
    assert.equal(result.generated,0);
    assert.equal(result.frontier.length,1);
    assert.equal(result.frontier[0].reason,'maxMs');
    if(result.execution)assert.equal(result.execution.reusedResponses,0);
  }
});

test('actual core: explicit deck order, raw UI histories and empty turn completion are preserved',async()=>{
  const g=await startRoute([]);let deckOrder;
  try{deckOrder=[...g.decks[0].main].reverse();}finally{g.close();}
  const {fast}=await differential({hand:[],deckOrder,maxNodes:10});
  assert(fast.result.complete);
  assert.deepEqual(fast.result.terminals[0].deckOrder,deckOrder);
  await assert.rejects(accelerated({resume:fast.result,deckOrder:[...deckOrder].reverse()}),/differs/);
  const raw=await differential({hand:[C.wizard],pruneLinkUiLoops:false,maxNodes:100,maxDepth:10});
  assert(!raw.fast.result.pruning.linkUiLoops.enabled);
});

test('actual core: reduced actual Duel creation cost is measured without observers or inferred branch merging',async t=>{
  const warm=await startRoute([]);warm.close();
  for(const hand of [[C.spirit,C.accusation],[C.rabbit,C.tb]]){
    const options={hand,maxNodes:1000,maxDepth:hand[0]===C.rabbit?6:20,maxMs:60000};
    const start=performance.now(),base=await baseline(options),baseMs=performance.now()-start;
    const next=performance.now(),fast=await accelerated(options),fastMs=performance.now()-next;
    assert(!base.frontier.some(f=>f.reason==='maxMs'));
    assert.deepEqual(semanticResult(fast),semanticResult(base));
    assert(fast.execution.coreStarts<base.visited);
    assert(fast.execution.replayedResponses<base.replayedResponses);
    t.diagnostic(JSON.stringify({hand,logicalNodes:base.visited,terminals:base.terminals.length,
      frontier:base.frontier.length,base:{elapsedMs:baseMs,coreStarts:base.visited,replayedResponses:base.replayedResponses},
      fast:{elapsedMs:fastMs,...fast.execution}}));
  }
});
