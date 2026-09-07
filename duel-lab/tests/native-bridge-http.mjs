import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startNativeBridge} from '../native-bridge.mjs';

test('real HTTP bridge enforces auth, serializes inference and hands unknown state to Astra',async()=>{
  let release,entered;const started=new Promise(resolve=>entered=resolve);
  const astra={calls:0,plan:'',lastMs:0,stop(){},async choosePayload(input){
    this.calls++;assert.equal(input.openingContext.status,'outside-first-turn');entered();
    await new Promise(resolve=>release=resolve);
    return {action:0,selection:[],counters:[],cancel:false,plan:'stubbed Astra fallback'};
  }};
  const b=await startNativeBridge({astra});
  try{
    const cfg=JSON.parse(fs.readFileSync(b.configPath));
    const input={session:'http-test',protocolVersion:2,requestId:1,state:{turn:2,player:1,players:[],request:{kind:'single',title:'test',choices:[{id:0,option:'End Phase'}]}}};
    const post=(extra={},token=cfg.token)=>fetch(cfg.url,{method:'POST',headers:{'content-type':'application/json','x-astra-token':token,...extra},body:JSON.stringify(input)});
    assert.equal((await post({},'wrong')).status,403);assert.equal((await post({origin:'https://example.invalid'})).status,403);
    const pending=post();await started;
    assert.equal((await post()).status,409);assert.equal(astra.calls,1);
    release();const response=await pending;assert.equal(response.status,200);assert.equal((await response.json()).source,'astra');
    const retry=await post();assert.equal(retry.status,200);assert.equal((await retry.json()).source,'astra');
    assert.equal(astra.calls,1,'Same request must reuse the completed model response');
  }finally{release?.();b.server.closeAllConnections();b.stop();}
});
