import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Astra} from '../astra.mjs';
import {acquireInferenceLock} from '../inference-lock.mjs';
import {compactNativePayload} from '../native-payload.mjs';

test('kernel lock rejects another process and releases after close',async()=>{
  const release=await acquireInferenceLock();
  try {
    const child=spawnSync(process.execPath,['--input-type=module','-e',
      `import {acquireInferenceLock} from ${JSON.stringify(new URL('../inference-lock.mjs',import.meta.url).href)};
       try { const close=await acquireInferenceLock(); await close(); process.exit(9); } catch { process.exit(0); }`],{windowsHide:true});
    assert.equal(child.status,0);
  } finally { await release(); }
  const next=await acquireInferenceLock();await next();
});

test('same instance and separate instance cannot launch concurrent CLI; stop waits for exit',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'astra-lock-test-'));
  const fake=path.join(dir,'cli.cjs');
  fs.writeFileSync(fake,'process.stdin.resume(); setTimeout(()=>{},60000);');
  const previous=process.env.DUEL_CODEX_JS;process.env.DUEL_CODEX_JS=fake;
  const a=new Astra(),b=new Astra();
  try {
    const pending=a.choosePayload({});
    const rejected=assert.rejects(pending,/接続に失敗/);
    for(let n=0;n<100&&!a.child;n++)await new Promise(r=>setTimeout(r,10));
    assert(a.child);
    await assert.rejects(a.choosePayload({}),/既に思考中/);
    await assert.rejects(b.choosePayload({}),/別のAstra/);
    assert.equal(b.calls,0);
    a.stop();
    assert.equal(a.busy,true);
    await rejected;
    assert.equal(a.busy,false);
    const release=await acquireInferenceLock();await release();
  } finally {
    a.stop();b.stop();
    if(previous===undefined)delete process.env.DUEL_CODEX_JS;else process.env.DUEL_CODEX_JS=previous;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('native payload retains dynamic card state and stores rules once',()=>{
  const input={ownDeck:[{code:69272449,count:3}],state:{players:[{hand:[{code:0}]}],request:{cards:[{code:69272449,attack:999,disabled:1},{code:69272449,attack:0,position:2}]}}};
  const compact=compactNativePayload(input);
  assert.deepEqual(compact.state,input.state);
  assert.deepEqual(Object.keys(compact.cardCatalog),['69272449']);
  assert(compact.cardCatalog[69272449].text);
  assert.equal(compact.cardCatalog[0],undefined);
});
