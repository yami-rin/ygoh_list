// Native engine integration test service. The product's bridge/policy are real;
// the final turn-end handoff is stubbed so this test never spends a model call.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startNativeBridge} from '../native-bridge.mjs';
import {publicOwn} from '../opening-semantics.mjs';
const runtime=fileURLToPath(new URL('../runtime/',import.meta.url));
const work=path.resolve(process.env.NATIVE_OPENING_TEST_WORKDIR||path.join(runtime,'native-opening-test'));
assert(work.startsWith(runtime),'Test output must remain under runtime');
const file=path.join(work,'policy-trace.jsonl');
fs.mkdirSync(work,{recursive:true});fs.writeFileSync(file,'');
let bridge;
const ended=new Map();
const fixturePath=path.join(work,'fixture.json');
const fixture=fs.existsSync(fixturePath)?JSON.parse(fs.readFileSync(fixturePath)):null;
const magnahandoff=fixture?.id==='cat-magnamhut'&&fixture?.endPhaseSearch?.triggerCode===33854624&&fixture?.endPhaseSearch?.searchCode===72656408;
const astra={plan:'',lastMs:0,calls:0,stop(){},async choosePayload(input){
  this.calls++;
  fs.appendFileSync(file,JSON.stringify({fallback:true,input,context:input.openingContext,expected:bridge.openings.plan?.frames[bridge.openings.cursor]})+'\n');
  if(ended.has(input.session)){
    const handoff=ended.get(input.session),s=input.state,r=s.request;
    const endPhase=s.turn===1&&s.player===1&&s.phase==='End';
    const nextDraw=s.turn===2&&s.player===0&&s.phase==='Draw';
    assert(endPhase||nextDraw,'Expected end phase or the terminal opponent draw window');
    const pass=r.choices?.find(c=>c.option==='チェーンしない');
    if(pass){
      assert.equal(r.kind,'single');assert.equal(r.title,'チェーンの選択');
      return {action:pass.id,selection:[],counters:[],cancel:false,testHandoff:nextDraw?'opponent-draw-pass':'end-phase-pass',plan:'Test-only decline after turn end.'};
    }
    assert(endPhase,'Only optional passing is allowed in the terminal draw window');
    if(magnahandoff&&!handoff.magnaTriggered&&r.kind==='single'&&r.title==='チェーンの選択'){
      assert.equal(s.chain.length,0);
      const choices=r.choices.filter(c=>c.option?.card?.code===33854624&&c.option.card.controller===1&&c.option.card.location==='Grave'&&c.option.description===0);
      assert.equal(choices.length,1,'Expected the registered Magnamhut end-phase effect');
      assert.deepEqual(publicOwn(s.players.find(p=>p.player===1)),bridge.openings.plan.finalOwn);
      handoff.magnaTriggered=true;
      return {action:choices[0].id,selection:[],counters:[],cancel:false,testHandoff:'magnamhut-delayed-trigger',plan:'Test-only registered Magnamhut end-phase search.'};
    }
    if(magnahandoff&&handoff.magnaTriggered&&!handoff.magnaSearched&&r.kind==='multi'&&r.title==='カード選択'){
      assert.equal(r.subtype,'SELECT_CARD');assert.equal(r.min,1);assert.equal(r.max,1);assert.equal(r.canCancel,false);
      assert.equal(r.sum,-1);assert.equal(r.exact,true);
      assert.equal(s.chain.length,1);assert.equal(s.chain[0].code,33854624);assert.equal(s.chain[0].controller,1);
      const matches=r.cards.map((card,index)=>({card,index})).filter(({card})=>card.code===72656408&&card.controller===1&&card.location==='Deck');
      assert.equal(matches.length,1,'Expected the preset Baldrake search target');
      handoff.magnaSearched=true;
      return {action:-1,selection:[matches[0].index],counters:[],cancel:false,testHandoff:'magnamhut-baldrake-search',plan:'Test-only search one preset Bystial Baldrake.'};
    }
    assert.fail('Unexpected post-opening test handoff request');
  }
  assert.equal(input.openingContext.status,'opening-completed','Unexpected early fallback; inspect the native test trace');
  assert.deepEqual(publicOwn(input.state.players.find(p=>p.player===1)),bridge.openings.plan.finalOwn,'Actual native endpoint differs from core-verified plan');
  const end=input.state.request.choices?.find(c=>c.option==='End Phase');assert(end,'Expected final Main handoff');
  ended.set(input.session,{magnaTriggered:false,magnaSearched:false});
  return {action:end.id,selection:[],counters:[],cancel:false,testHandoff:'end-phase',plan:'Test-only final End Phase after the verified opening.'};
}};
bridge=await startNativeBridge({astra,port:Number(process.env.NATIVE_OPENING_TEST_PORT??8788),
  configPath:process.env.NATIVE_OPENING_TEST_WORKDIR?path.join(work,'bridge-config.json'):path.join(runtime,'astra-bridge.json'),
  onDecision(input,result,policy){
  fs.appendFileSync(file,JSON.stringify({input,result,context:policy.context()})+'\n');
}});
fs.writeFileSync(path.join(work,'ready.json'),JSON.stringify({port:bridge.port,configPath:bridge.configPath}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{bridge.stop();process.exit(0);});
if(process.env.NATIVE_OPENING_TEST_WORKDIR){
  process.stdin.setEncoding('utf8');
  let commands='';process.stdin.on('data',chunk=>{commands+=chunk;if(commands.includes('stop\n')){bridge.stop();process.exit(0);}});
}
