// Native engine integration test service. The product's bridge/policy are real;
// the final turn-end handoff is stubbed so this test never spends a model call.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {startNativeBridge} from '../native-bridge.mjs';
import {publicOwn} from '../opening-semantics.mjs';
const file=new URL('../runtime/native-opening-test/policy-trace.jsonl',import.meta.url);
fs.mkdirSync(new URL('../runtime/native-opening-test/',import.meta.url),{recursive:true});fs.writeFileSync(file,'');
let bridge;
const ended=new Set();
const astra={plan:'',lastMs:0,calls:0,stop(){},async choosePayload(input){
  this.calls++;
  fs.appendFileSync(file,JSON.stringify({fallback:true,input,context:input.openingContext,expected:bridge.openings.plan?.frames[bridge.openings.cursor]})+'\n');
  if(ended.has(input.session)){
    const pass=input.state.request.choices?.find(c=>c.option==='チェーンしない');assert(pass,'Expected optional end-phase chain');
    return {action:pass.id,selection:[],counters:[],cancel:false,plan:'Test-only decline after turn end.'};
  }
  assert.equal(input.openingContext.status,'opening-completed','Unexpected early fallback; inspect the native test trace');
  assert.deepEqual(publicOwn(input.state.players.find(p=>p.player===1)),bridge.openings.plan.finalOwn,'Actual native endpoint differs from core-verified plan');
  const end=input.state.request.choices?.find(c=>c.option==='End Phase');assert(end,'Expected final Main handoff');
  ended.add(input.session);
  return {action:end.id,selection:[],counters:[],cancel:false,plan:'Test-only final End Phase after the verified opening.'};
}};
bridge=await startNativeBridge({astra,onDecision(input,result,policy){
  fs.appendFileSync(file,JSON.stringify({input,result,context:policy.context()})+'\n');
}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{bridge.stop();process.exit(0);});
