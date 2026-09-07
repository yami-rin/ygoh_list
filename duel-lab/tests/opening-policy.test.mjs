import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOpeningTemplates,prepareOpening,NativeOpeningPolicy} from '../opening-policy.mjs';
import {matchFrame,effectKey} from '../opening-semantics.mjs';
import {preset} from '../scripts/route-harness.mjs';

const templates=await loadOpeningTemplates();
const hand=[69272449,40366667,40366667,78114463,20726052];
const plan=await prepareOpening(templates.find(t=>t.id==='rabbit-no-draw-accord'),hand);
function stateFor(frame){
  const own=structuredClone(frame.state.own);
  for(const zone of ['hand','grave','extra','banished'])own[zone]=own[zone].map(JSON.parse);
  return {turn:1,player:1,phase:'Main1',players:[{player:0,lp:8000,deckCount:35,hand:Array.from({length:5},()=>({code:0})),monsters:[],spells:[],grave:[],banished:[]},{...own,player:1}],
    request:{...structuredClone(frame.request),...(frame.materialContext?{selectionContext:{...frame.materialContext,subtype:'SELECT_UNSELECT_CARD'}}:{})}};
}
function inputFor(frame=plan.frames[0]){return {session:'test',protocolVersion:2,requestId:1,state:stateFor(frame),
  safety:{drawEpoch:2,ownDrawEpoch:1,opponentDrawEpoch:1,opponentEffectEpoch:0,negationEpoch:0,turnEpoch:1,duelEpoch:1},
  ownDeck:Object.entries([...preset.main,...preset.extra].reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{})).map(([code,count])=>({code:Number(code),count}))};}

test('all accepted templates replay without unresolved draws; real five-card hand reaches Accord/Binder',()=>{
  assert(templates.length>=79);assert.equal(plan.drawDependent,false);
  assert.deepEqual(plan.final.players[0].monsters.filter(Boolean).map(c=>c.code).sort(),[39138610,95454996]);
  assert.equal(plan.final.lp[0],6200);
});
test('native option IDs are remapped after legal-choice reordering',()=>{
  const f=plan.frames[0],s=stateFor(f),selected=s.request.choices.find(c=>c.id===f.decision.action);
  s.request.choices.reverse();s.request.choices.forEach((c,i)=>c.id=50+i);
  assert.equal(matchFrame(f,s).action,selected.id);
  s.players[1].lp--;assert.equal(matchFrame(f,s),null);
});
test('modern and legacy effect descriptions identify the same effect',()=>{
  assert.equal(effectKey((69272449n<<20n)+2n,true),effectKey(69272449*16+2));
  assert.notEqual(effectKey(69272449*16+1),effectKey(69272449*16+2));
});
test('legacy extra material cancellation allows only positive selection with identical groups',()=>{
  const f=plan.frames.find(f=>f.materialContext&&!f.materialContext.cancelable&&f.materialContext.unselectCount>0&&f.decision.selection.length===1);
  assert(f);const s=stateFor(f);s.request.canCancel=true;s.request.selectionContext.cancelable=true;
  assert.deepEqual(matchFrame(f,s).selection,f.decision.selection);
  s.request.selectionContext.finishable=!f.materialContext.finishable;assert.equal(matchFrame(f,s),null);
  s.request.selectionContext.finishable=f.materialContext.finishable;s.request.selectionContext.unselectCount++;assert.equal(matchFrame(f,s),null);
  assert.equal(matchFrame({...f,decision:{...f.decision,cancel:true,selection:[]}},s),null);
});
test('first real hand is compiled once; identical HTTP retries do not advance the route',async()=>{
  const p=new NativeOpeningPolicy(templates),i=inputFor(),first=await p.choose(i),cursor=p.cursor;
  assert(first);assert.deepEqual(await p.choose(structuredClone(i)),first);assert.equal(p.cursor,cursor);assert.equal(p.preparations,1);
  const changed=structuredClone(i);changed.state.players[1].lp--;
  await assert.rejects(()=>p.choose(changed),/Repeated request id/);
});
test('draw, opponent effects and negation permanently return control to Astra',async()=>{
  for(const epoch of ['drawEpoch','opponentEffectEpoch','negationEpoch']){
    const p=new NativeOpeningPolicy(templates),i=inputFor();assert(await p.choose(i));
    const next={...inputFor(plan.frames[p.cursor]),requestId:2};next.safety[epoch]++;
    assert.equal(await p.choose(next),null);assert(p.retired);
    assert.equal(await p.choose({...inputFor(),requestId:3}),null);
  }
});
test('different preset and old native protocol never receive a saved action',async()=>{
  for(const change of [i=>i.protocolVersion=1,i=>i.ownDeck[0].count++]){
    const p=new NativeOpeningPolicy(templates),i=inputFor();change(i);assert.equal(await p.choose(i),null);assert.equal(p.preparations,0);
  }
});
test('completed opening hands off; cached model response is reused and shortcut cannot resume',async()=>{
  const p=new NativeOpeningPolicy(templates),i=inputFor();await p.choose(i);p.cursor=p.plan.frames.length;
  const next={...inputFor(),requestId:2};assert.equal(await p.choose(next),null);assert.equal(p.reason,'opening-completed');
  const model={action:12,selection:[],counters:[],cancel:false,plan:'model'};p.rememberFallback(next,model);
  assert.equal(await p.choose(next),model);assert.equal(await p.choose({...next,requestId:3}),null);
});
test('Cat and Code Magician use both known cards with no draw for the saved endpoint',async()=>{
  const t=templates.find(t=>t.id==='cat-mag-crypter-binder-ip-gwc');assert(t);
  const p=await prepareOpening(t,[96676583,64865,40366667,40366667,78114463]);
  assert.deepEqual(p.final.players[0].monsters.filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[21848500,65741786,95454996]);
  assert(p.final.players[0].spells.some(c=>c?.code===20726052));assert.equal(p.drawDependent,false);
});
