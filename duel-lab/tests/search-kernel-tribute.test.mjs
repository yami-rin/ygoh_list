import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {search as oldSearch} from '../scripts/search-kernel-fast.mjs';
import {search as v2Search} from '../scripts/search-kernel.mjs';
import {search,implementation,tributeAuditIdentity,auditTributeCancellations} from '../scripts/search-kernel-tribute.mjs';
import {startRoute,respond,finishRoute,replay,hash} from '../scripts/route-harness.mjs';

const hand=[68337209,72656408],BALDRAKE=72656408;
// UG banishes Dormouse, which revives. The still-unused initial-hand Baldrake
// can be normally summoned by releasing that own face-up Dormouse.
const opening=[{action:0},{action:0},{action:0},{selection:[5]},{action:0},{selection:[0]},{action:0}];
const loop=[{action:0},{cancel:true}];
const options={hand,prefix:opening,maxMs:60000,maxNodes:2000,maxDepth:opening.length+3};
const appendLoops=(n,tail=[])=>[...opening,...Array.from({length:n},()=>structuredClone(loop)).flat(),...tail];
const key=x=>hash(x);
const routeKeys=routes=>routes.map(r=>key({inputs:r.steps.map(s=>s.input),finalHash:r.finalHash,log:r.log})).sort();
const frontierKeys=frontier=>frontier.map(f=>key(f)).sort();
const beginsWithLoop=prefix=>hash(prefix.slice(opening.length,opening.length+2))===hash(loop);

async function makeRoute(inputs,fixtureHand=hand) {
  const game=await startRoute(fixtureHand);
  try{for(const input of inputs)respond(game,input);return finishRoute(game);}
  finally{game.close();}
}

test('pinned policy is separately versioned and permits only initial-hand Baldrake/Magnamhut',()=>{
  assert.equal(implementation.version,4);
  assert.equal(tributeAuditIdentity().pinVerified,true);
  assert.match(tributeAuditIdentity().policy,/initial-hand-bystial/);
  assert.deepEqual(tributeAuditIdentity().cards,[72656408,33854624]);
});

test('actual core: local non-cancel response trees and every tribute choice are retained',async()=>{
  const base=await oldSearch(options),contracted=await search(options);
  assert.equal(base.failures.length,0);assert.equal(contracted.failures.length,0);
  assert(!base.frontier.some(f=>['maxMs','maxNodes'].includes(f.reason)));
  assert(!contracted.frontier.some(f=>['maxMs','maxNodes'].includes(f.reason)));
  assert(contracted.pruning.tributeUiLoops.counts.cancelledNormalTribute>0);
  assert(!contracted.frontier.some(f=>beginsWithLoop(f.prefix)));
  assert.deepEqual(frontierKeys(contracted.frontier),frontierKeys(base.frontier.filter(f=>!beginsWithLoop(f.prefix))));
  assert.deepEqual(routeKeys(contracted.terminals),routeKeys(base.terminals.filter(r=>!beginsWithLoop(r.steps.map(s=>s.input)))));
  assert.deepEqual(contracted.rejected,base.rejected.filter(r=>!beginsWithLoop(r.prefix)));
  assert(contracted.terminals.some(r=>r.final.players[0].monsters.some(c=>c?.code===BALDRAKE)) ||
    contracted.frontier.some(f=>hash(f.prefix.slice(opening.length,opening.length+2))===hash([{action:0},{selection:[0]}])));
});

test('actual core: helper returns exact zero-based pairs; normal summon after 0/1/86 cancellations is unchanged',async()=>{
  const suffix=[{action:0},{selection:[0]},{selection:[0]}];
  const direct=await makeRoute(appendLoops(0,suffix));
  for(const repeats of [1,86]){
    const cycled=await makeRoute(appendLoops(repeats,suffix)),before=hash(cycled);
    const audit=await auditTributeCancellations(cycled);
    assert.equal(audit.pinVerified,true);assert.equal(audit.pairs.length,repeats);
    assert.deepEqual(audit.pairs,Array.from({length:repeats},(_,i)=>[opening.length+i*2,opening.length+i*2+1]));
    assert.equal(hash(cycled),before);
    const removed=new Set(audit.pairs.flat());
    const shortened=await makeRoute(cycled.steps.filter((_,i)=>!removed.has(i)).map(s=>s.input));
    assert.equal(shortened.finalHash,direct.finalHash);
    assert.deepEqual(shortened.log,direct.log);
    assert.deepEqual(shortened.steps,direct.steps);
    assert.equal(cycled.finalHash,direct.finalHash);assert.deepEqual(cycled.log,direct.log);
    await replay(shortened);
  }
});

test('actual core: long legacy prefixes stop at the first proven cancellation, keeping prior evidence',async()=>{
  for(const kernel of [v2Search,oldSearch]){
    const previous=await kernel({...options,maxNodes:0});
    previous.frontier=[{prefix:[...opening,{action:0},{selection:[0]}],nextCandidate:0,reason:'maxNodes'},
      {prefix:appendLoops(86,[{action:0}]),nextCandidate:0,reason:'maxDepth'}];
    const result=await search({resume:previous,maxNodes:2,maxDepth:200,maxMs:60000});
    assert.equal(result.version,4);
    assert.equal(result.checkpointCompatibility.loadedVersion,previous.version);
    assert.equal(result.pruning.tributeUiLoops.counts.cancelledNormalTribute,1);
    assert.equal(result.pruning.tributeUiLoops.examples[0].depth,opening.length+2);
    assert(result.frontier.some(f=>f.prefix.length>opening.length+2));
    assert(result.execution.replayedResponses<previous.frontier[1].prefix.length,'Old repeated suffix is never executed');
  }
});

test('actual core: a cancellation before or crossing the immutable root remains available',async()=>{
  for(const prefix of [appendLoops(1),[...opening,{action:0}]]){
    const result=await search({hand,prefix,maxNodes:100,maxDepth:prefix.length+3,maxMs:60000});
    assert.equal(result.failures.length,0);
    assert(result.pruning.tributeUiLoops.examples.every(w=>w.ancestorDepth>=prefix.length));
    assert(result.terminals.length+result.frontier.length>0);
    if(prefix.length===opening.length+1){
      assert(result.frontier.some(f=>f.prefix[prefix.length]?.cancel===true) ||
        result.terminals.some(r=>r.steps[prefix.length]?.input.cancel===true));
    }
  }
});

test('actual core: continuous resume equals one uninterrupted contracted search',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'astra-tribute-test-'));
  try{
    const file=path.join(directory,'checkpoint.json');
    const direct=await search(options);
    let result=await search({...options,maxNodes:5,checkpointPath:file});
    for(let i=0;i<80 && result.frontier.some(f=>f.reason!=='maxDepth');i++)
      result=await search({resume:file,maxNodes:25,maxDepth:options.maxDepth,maxMs:60000,checkpointPath:file});
    // A depth boundary is intentionally held and can be revisited by a resume;
    // compare complete input coverage rather than how often a held node ran.
    assert.deepEqual(routeKeys(result.terminals),routeKeys(direct.terminals));
    assert.deepEqual(frontierKeys(result.frontier),frontierKeys(direct.frontier));
    assert.equal(result.pruning.tributeUiLoops.counts.cancelledNormalTribute,direct.pruning.tributeUiLoops.counts.cancelledNormalTribute);
    assert.equal(result.failures.length,0);
    await assert.rejects(search({resume:result,pruneTributeUiLoops:false}),/disabled Tribute/);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('actual core: DRAW boundaries and unaffected Wizard Link cancellation remain unchanged',async()=>{
  for(const fixtureHand of [[1475311,64865],[3723262]]){
    const base=await oldSearch({hand:fixtureHand,stopOnDraw:true,maxNodes:300,maxDepth:30,maxMs:60000});
    const result=await search({hand:fixtureHand,stopOnDraw:true,maxNodes:300,maxDepth:30,maxMs:60000});
    assert.deepEqual(result.frontier,base.frontier);assert.deepEqual(result.terminals,base.terminals);
    assert.deepEqual(result.pruning.linkUiLoops,base.pruning.linkUiLoops);
    assert.equal(result.pruning.tributeUiLoops.counts.cancelledNormalTribute,0);
  }
});

test('actual core: extra raw events, ambiguous movement and an already moved Baldrake fail closed',async()=>{
  const original=Duel.prototype.record;
  for(const extra of [
    {type:M.HINT,player:0,hint_type:3,hint:999n},
    {type:M.MOVE,card:0,from:{controller:0,location:2},to:{controller:0,location:2}},
    {type:M.MOVE,card:BALDRAKE,from:{controller:0,location:2},to:{controller:0,location:4}},
  ]){
    let injected=false;
    Duel.prototype.record=function(message){
      original.call(this,message);
      if(!injected && message.type===M.SELECT_TRIBUTE){injected=true;this.record(extra);}
    };
    try{
      const result=await search({...options,maxNodes:3,maxDepth:opening.length+2});
      assert(injected);
      assert.equal(result.pruning.tributeUiLoops.counts.cancelledNormalTribute,0);
      assert(result.frontier.some(f=>beginsWithLoop(f.prefix)));
    }finally{Duel.prototype.record=original;}
  }
});

test('source pin drift disables fresh contraction and refuses already contracted resumes without editing assets',async()=>{
  const previous=await search({...options,maxNodes:3});
  assert(previous.pruning.tributeUiLoops.counts.cancelledNormalTribute>0);
  const read=fs.readFileSync;
  fs.readFileSync=function(file,...args){
    const data=read.call(this,file,...args);
    if(String(file).endsWith('/engine.mjs'))return Buffer.isBuffer(data)?Buffer.concat([data,Buffer.from('\n')]):data+'\n';
    return data;
  };
  try{
    assert.equal(tributeAuditIdentity().pinVerified,false);
    const fresh=await search({...options,maxNodes:3,maxDepth:opening.length+2});
    assert.equal(fresh.pruning.tributeUiLoops.enabled,false);
    assert(fresh.frontier.some(f=>beginsWithLoop(f.prefix)));
    await assert.rejects(search({resume:previous,maxNodes:1}),/Tribute UI policy\/source pin/);
    const helper=await auditTributeCancellations({verified:true});
    assert.equal(helper.pinVerified,false);assert.deepEqual(helper.pairs,[]);
  }finally{fs.readFileSync=read;}
});

test('actual core: initially unused Magnamhut cancellation and its successful tribute summon are also certified',async()=>{
  const fixtureHand=[33854624,75500286],game=await startRoute(fixtureHand);
  let prefix,cycled,normal;
  const act=predicate=>{const c=game.prompt.choices.find(predicate);assert(c);respond(game,{action:c.id});};
  try{
    act(c=>c.card?.code===75500286&&c.response.action===5);respond(game,{selection:[0]});
    const dot=game.prompt.cards.findIndex(c=>c.code===18789533);assert(dot>=0);respond(game,{selection:[dot]});
    act(c=>c.response.yes===true);respond(game,{selection:[0]});
    if(game.prompt.type==='SELECT_POSITION')act(c=>c.response.position===1);
    assert.equal(game.prompt.type,'SELECT_IDLECMD');
    prefix=game.route.steps.map(s=>structuredClone(s.input));
    for(let i=0;i<116;i++){act(c=>c.card?.code===33854624&&c.response.action===0);respond(game,{cancel:true});}
    act(c=>c.card?.code===33854624&&c.response.action===0);respond(game,{selection:[0]});respond(game,{selection:[0]});
    cycled=finishRoute(game);
    normal=cycled.steps.slice(prefix.length+232).map(s=>s.input);
  }finally{game.close();}
  const audit=await auditTributeCancellations(cycled);
  assert.equal(audit.pairs.length,116);assert(audit.witnesses.every(w=>w.card===33854624));
  const direct=await makeRoute([...prefix,...normal],fixtureHand);
  assert.equal(direct.finalHash,cycled.finalHash);assert.deepEqual(direct.log,cycled.log);
  assert(!direct.log.some(e=>e.event==='chain'&&e.code===33854624));
  const result=await search({hand:fixtureHand,prefix,maxNodes:3,maxDepth:prefix.length+2,maxMs:60000});
  assert.equal(result.pruning.tributeUiLoops.counts.cancelledNormalTribute,1);
});
