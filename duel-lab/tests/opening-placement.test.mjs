import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {loadOpeningTemplates,prepareOpening} from '../opening-policy.mjs';
import {buildFinalPlacementBlock,matchPlacementBlock} from '../opening-placement.mjs';

if(!fs.existsSync(new URL('../runtime/MDPro3-client/Data/script.zip',import.meta.url))){
  test('audited native placement fixtures require the installed MDPro3 runtime',
    {skip:'Run build-native.ps1 to install the pinned native scripts'},()=>{});
}else{
const templates=await loadOpeningTemplates();
const plan=await prepareOpening(templates.find(t=>t.id==='dorm-no-draw-firewall-accord'),
  [32061192,57111661,40366667,40366667,78114463]);
const block=plan.finalPlacement;
assert(block,'The real core fixture must compile its audited final two-card revival');
const BINDER=95454996,TRANSCODE=46947713;
function ownAfter(codes=[]){
  const own=structuredClone(block.startOwn);
  for(const code of codes){
    const target=block.targets.find(t=>t.code===code);
    own.grave.splice(own.grave.indexOf(JSON.stringify({code})),1);
    own.monsters[target.slot]={code,position:target.position};
  }
  return own;
}
function stateFor(code,moved=[]){
  const own=ownAfter(moved);
  for(const zone of ['hand','grave','extra','banished'])own[zone]=own[zone].map(JSON.parse);
  return {turn:1,player:1,phase:'Main1',players:[{player:1,...own}],
    chain:moved.length===2?[]:[{code:39138610,controller:1,location:'MonsterZone',sequence:1,position:1,disabled:0}],
    request:moved.length===2?{kind:'single',title:'メインフェイズの行動',choices:[]}:
      {kind:'single',title:'配置先',choices:block.legalMasks.filter(mask=>!own.monsters[Math.log2(mask)])
        .map(mask=>({id:70+mask,option:{code,controller:1,location:'MonsterZone',mask}}))}};
}
function expectedDecision(action){return {action,selection:[],counters:[],cancel:false,plan:''};}

test('real core evidence compiles only the final Accord Binder/Transcode moves',()=>{
  assert.equal(block.startFrame,100);assert.equal(block.endExclusive,102);
  assert.deepEqual(block.targets,[{code:BINDER,mask:4,slot:2,position:1},{code:TRANSCODE,mask:1,slot:0,position:1}]);
  assert.deepEqual(block.endOwn,plan.finalOwn);
  assert.deepEqual(plan.frames.at(-2).resolutionEvents.map(e=>e.type),[M.MOVE,M.SPSUMMONING,M.HINT,M.SELECT_PLACE]);
});
for(const order of [[BINDER,TRANSCODE],[TRANSCODE,BINDER]]){
  test(`both legal native summon orders keep exact planned slots: ${order.join(',')}`,()=>{
    const first=matchPlacementBlock(block,stateFor(order[0]));
    assert.equal(first.kind,'decision');assert.equal(first.code,order[0]);
    assert.deepEqual(first.decision,expectedDecision(70+block.targets.find(t=>t.code===order[0]).mask));
    const second=matchPlacementBlock(block,stateFor(order[1],[order[0]]),order[0]);
    assert.equal(second.kind,'decision');assert.equal(second.code,order[1]);
    assert.deepEqual(second.decision,expectedDecision(70+block.targets.find(t=>t.code===order[1]).mask));
    assert.deepEqual(matchPlacementBlock(block,stateFor(null,order),order[1]),{kind:'complete'});
    // Native can automatically place the sole remaining target without HTTP.
    assert.deepEqual(matchPlacementBlock(block,stateFor(null,order),order[0]),{kind:'complete'});
  });
}
const proofFile=new URL('../runtime/native-opening-probes/accord-order-proof/proof.json',import.meta.url);
test('captured native request 94 maps Transcode to slot 0 instead of Binder slot 2',
  {skip:!fs.existsSync(proofFile)},()=>{
    const proof=JSON.parse(fs.readFileSync(proofFile));
    const result=matchPlacementBlock(block,proof.nativeStart.state);
    assert.equal(result?.code,TRANSCODE);assert.deepEqual(result.decision,expectedDecision(0));
    assert.equal(matchPlacementBlock(block,proof.nativeWrongEnd.state,TRANSCODE),null);
  });

const invalidSources={
  'missing resolution history':f=>delete f.at(-2).resolutionEvents,
  'unrelated chain':f=>f.at(-2).resolutionChain[0].code=BINDER,
  'second chain differs':f=>f.at(-1).resolutionChain.push({code:BINDER,player:0,size:2}),
  'longer contiguous placement group':f=>f[f.length-3]=structuredClone(f.at(-2)),
  'non-final placement group':f=>f.push({...f.at(-1),type:'SELECT_IDLECMD'}),
  'duplicate grave copy':f=>f.at(-2).state.own.grave.push(JSON.stringify({code:BINDER})),
  'same requested card':f=>f.at(-1).request.choices.forEach(c=>c.option.code=BINDER),
  'unrelated intermediate LP change':f=>f.at(-1).state.own.lp--,
  'additional intermediate move':f=>f.at(-2).resolutionEvents.splice(1,0,structuredClone(f.at(-2).resolutionEvents[0])),
  'wrong summoning target':f=>f.at(-2).resolutionEvents[1].code=TRANSCODE,
  'wrong move controller':f=>f.at(-2).resolutionEvents[0].to.controller=1,
  'wrong next placement hint':f=>f.at(-2).resolutionEvents[2].hint=String(BINDER),
  'wrong next placement legal mask':f=>f.at(-2).resolutionEvents[3].field_mask=4294967290,
  'extra final draw':f=>f.at(-1).resolutionEvents.splice(2,0,{type:M.DRAW,player:0,cards:[]}),
  'different restriction':f=>f.at(-1).resolutionEvents[3].description='0',
  'extra final nonempty chain':f=>f.at(-1).resolutionEvents.at(-2).selects.push({code:BINDER}),
  'unknown final event':f=>f.at(-1).resolutionEvents.splice(-1,0,{type:999}),
};
for(const [name,mutate] of Object.entries(invalidSources)){
  test(`source proof rejects ${name}`,()=>{
    const frames=structuredClone(plan.frames);mutate(frames);
    assert.equal(buildFinalPlacementBlock(frames,plan.finalOwn),null);
  });
}
test('source proof rejects swapped endpoint slots and unrelated endpoint state',()=>{
  for(const mutate of [own=>[own.monsters[0],own.monsters[2]]=[own.monsters[2],own.monsters[0]],
    own=>own.hand.pop(),own=>own.deckCount--]){
    const final=structuredClone(plan.finalOwn);mutate(final);
    assert.equal(buildFinalPlacementBlock(plan.frames,final),null);
  }
});
const invalidNative={
  'unrelated target':s=>s.request.choices.forEach(c=>c.option.code=39138610),
  'mixed target choices':s=>s.request.choices[0].option.code=BINDER,
  'wrong controller':s=>s.request.choices[0].option.controller=0,
  'wrong location':s=>s.request.choices[0].option.location='SpellZone',
  'missing legal mask':s=>s.request.choices.pop(),
  'extra legal mask':s=>s.request.choices.push({id:90,option:{code:TRANSCODE,controller:1,location:'MonsterZone',mask:8}}),
  'duplicate response ID':s=>s.request.choices[0].id=s.request.choices[1].id,
  'duplicate legal mask':s=>s.request.choices[0].option.mask=s.request.choices[1].option.mask,
  'multi-bit placement mask':s=>s.request.choices[0].option.mask=3,
  'unrelated active chain':s=>s.chain[0].code=BINDER,
  'opponent chain':s=>s.chain[0].controller=0,
  'additional chain link':s=>s.chain.push({...s.chain[0]}),
  'absent chain':s=>s.chain=[],
  'disabled Accord':s=>s.chain[0].disabled=1,
  'unrelated own LP change':s=>s.players[0].lp--,
  'unrelated hand change':s=>s.players[0].hand.pop(),
  'different turn':s=>s.turn=2,
  'different phase':s=>s.phase='End',
};
for(const [name,mutate] of Object.entries(invalidNative)){
  test(`native placement rejects ${name}`,()=>{
    const state=stateFor(TRANSCODE);mutate(state);assert.equal(matchPlacementBlock(block,state),null);
  });
}
test('the previous answered target must actually have moved before advancing',()=>{
  assert.equal(matchPlacementBlock(block,stateFor(BINDER),TRANSCODE),null);
  assert.equal(matchPlacementBlock(block,stateFor(BINDER,[TRANSCODE]),BINDER),null);
  assert.equal(matchPlacementBlock(block,stateFor(BINDER,[TRANSCODE]),123),null);
  assert.equal(matchPlacementBlock(block,stateFor(TRANSCODE,[TRANSCODE]),TRANSCODE),null);
});
test('wrong slot or position cannot pass the intermediate or completed state check',()=>{
  const intermediate=stateFor(BINDER,[TRANSCODE]);
  intermediate.players[0].monsters[2]=intermediate.players[0].monsters[0];intermediate.players[0].monsters[0]=null;
  assert.equal(matchPlacementBlock(block,intermediate,TRANSCODE),null);
  const final=stateFor(null,[BINDER,TRANSCODE]);final.players[0].monsters[0].position=4;
  assert.equal(matchPlacementBlock(block,final,BINDER),null);
  const swapped=stateFor(null,[BINDER,TRANSCODE]),m=swapped.players[0].monsters;
  [m[0],m[2]]=[m[2],m[0]];assert.equal(matchPlacementBlock(block,swapped,TRANSCODE),null);
});
test('completed targets still require an empty chain and a resolved Main Phase prompt',()=>{
  for(const mutate of [s=>s.chain=[{code:39138610,controller:1}],
    s=>s.request.title='効果を発動しますか？',s=>s.request.kind='multi',s=>delete s.chain]){
    const state=stateFor(null,[BINDER,TRANSCODE]);mutate(state);
    assert.equal(matchPlacementBlock(block,state,TRANSCODE),null);
  }
});
test('all previously answered or automatically observed targets must remain in their planned slots',()=>{
  for(const [first,second] of [[BINDER,TRANSCODE],[TRANSCODE,BINDER]]){
    const result=matchPlacementBlock(block,stateFor(second,[first]),[]);
    assert.deepEqual(result.observedCodes,[first]);
    const remembered=[...result.observedCodes,result.code];
    assert.equal(matchPlacementBlock(block,stateFor(first,[second]),remembered),null);
    assert.equal(matchPlacementBlock(block,stateFor(second,[first]),remembered),null);
    assert.deepEqual(matchPlacementBlock(block,stateFor(null,[first,second]),remembered),{kind:'complete'});
    assert.equal(matchPlacementBlock(block,stateFor(second,[first]),[first,123]),null);
  }
});
test('a previously trusted compile does not hide missing or changed scripts',t=>{
  const readFileSync=fs.readFileSync;
  for(const path of ['/data/scripts/official/c39138610.lua','/runtime/MDPro3-client/Data/script.zip']){
    for(const missing of [false,true]){
      const read=t.mock.method(fs,'readFileSync',function(file,...args){
        if(file instanceof URL&&file.pathname.endsWith(path)){
          if(missing)throw new Error('Missing pinned fixture');
          return Buffer.from('different script version');
        }
        return readFileSync.call(this,file,...args);
      });
      assert.equal(buildFinalPlacementBlock(plan.frames,plan.finalOwn),null);
      read.mock.restore();
    }
  }
  assert(buildFinalPlacementBlock(plan.frames,plan.finalOwn));
});
}
