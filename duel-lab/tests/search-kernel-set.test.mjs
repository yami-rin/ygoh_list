import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OcgMessageType as M,OcgQueryFlags as Q} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {search as legacySearch,auditTributeCancellations as legacyAudit} from '../scripts/search-kernel-tribute.mjs';
import {search,implementation,tributeAuditIdentity,auditTributeCancellations} from '../scripts/search-kernel-set.mjs';
import {startRoute,respond,finishRoute,replay,hash} from '../scripts/route-harness.mjs';

const targets=[72656408,33854624],SARC=75500286,DOT=18789533;
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
const flags=Object.values(Q).reduce((a,b)=>a|b,0);
const pick=(g,predicate)=>{const choice=g.prompt.choices.find(predicate);assert(choice);respond(g,{action:choice.id});};
const action=(g,target,wire)=>{const choice=g.prompt.choices.find(c=>c.card?.code===target&&c.response.action===wire);assert(choice);return choice.id;};
async function setup(target){
  const hand=[target,SARC],g=await startRoute(hand);
  try{
    pick(g,c=>c.card?.code===SARC&&c.response.action===5);respond(g,{selection:[0]});
    const dot=g.prompt.cards.findIndex(c=>c.code===DOT);assert(dot>=0);respond(g,{selection:[dot]});
    pick(g,c=>c.response.yes===true);respond(g,{selection:[0]});
    if(g.prompt.type==='SELECT_POSITION')pick(g,c=>c.response.position===1);
    assert.equal(g.prompt.type,'SELECT_IDLECMD');
    return {hand,prefix:g.route.steps.map(step=>structuredClone(step.input)),setAction:action(g,target,3),summonAction:action(g,target,0)};
  }finally{g.close();}
}
const fixtures=await Promise.all(targets.map(setup));
const options=f=>({hand:f.hand,prefix:f.prefix,maxNodes:4000,maxMs:60000,maxDepth:f.prefix.length+3,stopOnDraw:true});
const cycle=f=>[{action:f.setAction},{cancel:true}];
const withCycles=(f,count,tail=[])=>[...f.prefix,...Array.from({length:count},()=>cycle(f)).flat(),...tail];
const startsWithCycle=(f,inputs)=>hash(inputs.slice(f.prefix.length,f.prefix.length+2))===hash(cycle(f));
const frontierKeys=frontier=>frontier.map(frame=>hash(frame)).sort();
const routeKeys=routes=>routes.map(route=>hash({inputs:route.steps.map(step=>step.input),finalHash:route.finalHash,log:route.log})).sort();
const observe=g=>safe({pending:g.pending,turn:g.turn,phase:g.phase,turnPlayer:g.turnPlayer,lp:g.lp,status:g.status,chain:g.chain,log:g.log,errors:g.errors,
  field:g.lib.duelQueryField(g.handle),zones:[0,1].map(controller=>[1,2,4,8,16,32,64].map(location=>g.lib.duelQueryLocation(g.handle,{controller,location,flags})))});

test('set policy has its own version, baseline and pinned two-card scope',()=>{
  assert.equal(implementation.version,5);assert.equal(implementation.baselineVersion,4);
  assert.equal(tributeAuditIdentity().pinVerified,true);assert.deepEqual(tributeAuditIdentity().cards,targets);
  assert.match(tributeAuditIdentity().policy,/normal-or-set/);
});

test('actual core: non-cancel response trees retain every set, summon and material branch',async()=>{
  for(const f of fixtures){
    const base=await legacySearch(options(f)),contracted=await search(options(f));
    assert.equal(base.failures.length,0);assert.equal(contracted.failures.length,0);
    assert(!base.frontier.some(frame=>['maxMs','maxNodes'].includes(frame.reason)));
    assert(!contracted.frontier.some(frame=>['maxMs','maxNodes'].includes(frame.reason)));
    assert(contracted.pruning.tributeUiLoops.counts.cancelledMonsterSet>0);
    assert(!contracted.frontier.some(frame=>startsWithCycle(f,frame.prefix)));
    assert.deepEqual(frontierKeys(contracted.frontier),frontierKeys(base.frontier.filter(frame=>!startsWithCycle(f,frame.prefix))));
    assert.deepEqual(routeKeys(contracted.terminals),routeKeys(base.terminals.filter(route=>!startsWithCycle(f,route.steps.map(step=>step.input)))));
    assert.deepEqual(contracted.rejected,base.rejected.filter(row=>!startsWithCycle(f,row.prefix)));
    for(const wireAction of [f.setAction,f.summonAction]){
      const wanted=[...f.prefix,{action:wireAction},{selection:[0]}];
      assert(contracted.frontier.some(frame=>hash(frame.prefix.slice(0,wanted.length))===hash(wanted))||
        contracted.terminals.some(route=>hash(route.steps.slice(0,wanted.length).map(step=>step.input))===hash(wanted)));
    }
  }
});

test('actual core: set and summon continuations after 0, 1 and 64 set cancellations agree',async()=>{
  for(const f of fixtures)for(const wireAction of [f.setAction,f.summonAction]){
    const observations=[],eventSequences=[];
    for(const count of [0,1,64]){
      const g=await startRoute(f.hand),events=[];const record=g.record.bind(g);g.record=m=>{events.push(safe(m));record(m);};
      try{
        for(const input of withCycles(f,count))respond(g,input);
        const baseline=observe(g);events.length=0;
        respond(g,{action:wireAction});assert.equal(g.prompt.type,'SELECT_TRIBUTE');
        respond(g,{selection:[0]});assert.equal(g.prompt.type,'SELECT_PLACE');respond(g,{selection:[0]});
        assert.equal(g.prompt.type,'SELECT_IDLECMD');
        const route=finishRoute(g),audit=await auditTributeCancellations(route);
        assert.equal(audit.pairs.length,count);assert(audit.witnesses.every(w=>w.kind==='cancelledMonsterSet'));
        assert.equal((await legacyAudit(route)).pairs.length,0);
        assert.deepEqual(audit.pairs,Array.from({length:count},(_,i)=>[f.prefix.length+i*2,f.prefix.length+i*2+1]));
        assert.equal(route.final.players[0].monsters.find(c=>c?.code===f.hand[0]).position,wireAction===f.setAction?8:1);
        assert(events.some(event=>event.type===(wireAction===f.setAction?M.SET:M.SUMMONING)));
        assert(!g.log.some(event=>/\d+\s*枚ドロー/.test(event.text)));
        observations.push(hash({baseline,final:observe(g)}));eventSequences.push(hash(events));
        await replay(route);
      }finally{g.close();}
    }
    assert.equal(new Set(observations).size,1);assert.equal(new Set(eventSequences).size,1);
  }
});

test('actual core: a long v4 history stops at the first audited set cancellation',async()=>{
  for(const f of fixtures){
    const previous=await legacySearch({...options(f),maxNodes:0});
    previous.frontier=[{prefix:withCycles(f,64,[{action:f.setAction}]),nextCandidate:0,reason:'maxDepth'}];
    const before=hash(previous),result=await search({resume:previous,maxNodes:1,maxDepth:200,maxMs:60000,stopOnDraw:true});
    assert.equal(hash(previous),before);assert.equal(result.version,5);
    assert.equal(result.checkpointCompatibility.loadedVersion,4);
    assert.equal(result.pruning.tributeUiLoops.counts.cancelledMonsterSet,1);
    assert.equal(result.pruning.tributeUiLoops.examples[0].depth,f.prefix.length+2);
    assert(result.execution.replayedResponses<previous.frontier[0].prefix.length);
  }
});

test('actual core: a set cancellation outside or crossing the immutable root is retained',async()=>{
  for(const f of fixtures)for(const prefix of [withCycles(f,1),[...f.prefix,{action:f.setAction}]]){
    const result=await search({hand:f.hand,prefix,maxNodes:1000,maxDepth:prefix.length+3,maxMs:60000,stopOnDraw:true});
    assert.equal(result.failures.length,0);assert(result.terminals.length+result.frontier.length>0);
    assert(result.pruning.tributeUiLoops.examples.every(w=>w.ancestorDepth>=prefix.length));
    if(prefix.length===f.prefix.length+1)assert(result.frontier.some(frame=>frame.prefix[prefix.length]?.cancel===true)||
      result.terminals.some(route=>route.steps[prefix.length]?.input.cancel===true));
  }
});

test('actual core: sliced resume retains the uninterrupted response coverage',async()=>{
  const f=fixtures[0],direct=await search(options(f));let result=await search({...options(f),maxNodes:7});
  for(let i=0;i<100&&result.frontier.some(frame=>frame.reason!=='maxDepth');i++)
    result=await search({resume:result,maxNodes:40,maxDepth:options(f).maxDepth,maxMs:60000,stopOnDraw:true});
  assert.deepEqual(frontierKeys(result.frontier),frontierKeys(direct.frontier));
  assert.deepEqual(routeKeys(result.terminals),routeKeys(direct.terminals));
  assert.deepEqual(result.pruning.tributeUiLoops.counts,direct.pruning.tributeUiLoops.counts);
  await assert.rejects(search({resume:result,pruneTributeUiLoops:false}),/disabled Tribute/);
  const wrong=structuredClone(result);wrong.pruning.tributeUiLoops.policy='fresh-initial-hand-bystial-normal-tribute-cancel-v1';
  await assert.rejects(search({resume:wrong}),/Tribute UI policy/);
});

test('actual core: moved cards, ambiguous movement and extra raw messages forbid set contraction',async()=>{
  const original=Duel.prototype.record;
  for(const f of fixtures)for(const extra of [
    {type:M.HINT,player:0,hint_type:3,hint:999n},
    {type:M.MOVE,card:0,from:{controller:0,location:2},to:{controller:0,location:2}},
    {type:M.MOVE,card:f.hand[0],from:{controller:0,location:2},to:{controller:0,location:4}},
  ]){
    let injected=false;
    Duel.prototype.record=function(message){original.call(this,message);if(!injected&&message.type===M.SELECT_TRIBUTE){injected=true;this.record(extra);}};
    try{
      const g=await startRoute(f.hand);
      let route;
      try{for(const input of withCycles(f,1))respond(g,input);route=finishRoute(g);}
      finally{g.close();}
      injected=false;const result=await auditTributeCancellations(route);
      assert(injected);assert.equal(result.pairs.length,0);
    }finally{Duel.prototype.record=original;}
  }
});

test('set guard fails closed on asset drift without changing any installed asset',async()=>{
  const f=fixtures[0],previous=await search(options(f));assert(previous.pruning.tributeUiLoops.counts.cancelledMonsterSet>0);
  const read=fs.readFileSync;
  fs.readFileSync=function(file,...args){const data=read.call(this,file,...args);return String(file).endsWith('/engine.mjs')?
    Buffer.isBuffer(data)?Buffer.concat([data,Buffer.from('\n')]):data+'\n':data;};
  try{
    assert.equal(tributeAuditIdentity().pinVerified,false);
    const fresh=await search({...options(f),maxDepth:f.prefix.length+2});assert.equal(fresh.pruning.tributeUiLoops.enabled,false);
    assert(fresh.frontier.some(frame=>startsWithCycle(f,frame.prefix)));
    await assert.rejects(search({resume:previous,maxNodes:1}),/Tribute UI policy\/source pin/);
    assert.deepEqual((await auditTributeCancellations({verified:true})).pairs,[]);
  }finally{fs.readFileSync=read;}
});

test('actual core: ordinary Link and draw-boundary behavior stays equal to v4',async()=>{
  for(const hand of [[1475311,64865],[3723262]]){
    const limits={hand,stopOnDraw:true,maxNodes:300,maxDepth:30,maxMs:60000};
    const base=await legacySearch(limits),result=await search(limits);
    assert.deepEqual(result.frontier,base.frontier);assert.deepEqual(result.terminals,base.terminals);
    assert.deepEqual(result.pruning.linkUiLoops,base.pruning.linkUiLoops);
    assert.equal(result.pruning.tributeUiLoops.counts.cancelledMonsterSet,0);
  }
});
