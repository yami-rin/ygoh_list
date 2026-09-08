import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runPair as reference,pairs} from '../scripts/search-multi-pairs.mjs';
import {importLegacyShard,runPair,searchIdentity} from '../scripts/search-multi-pairs-fast.mjs';
import {hash,replay} from '../scripts/route-harness.mjs';
import {validateSearchIdentity} from '../scripts/build-multi-search-report.mjs';

const indexOf=hand=>pairs.find(p=>p.id===[...hand].sort((a,b)=>a-b).join('-')).index;
const payload=c=>({search:c.search,excludedDraw:c.excludedDraw,bestMain1:c.bestMain1,
  bestPlayableMain1:c.bestPlayableMain1,main1Observations:c.main1Observations,failureHistory:c.failureHistory});

test('fast publication requires its own identity and cannot silently mix with reference shards',()=>{
  const report={...searchIdentity,shard:0,shards:8,generation:'fast-generation'};
  validateSearchIdentity(report,0,searchIdentity);
  assert.throws(()=>validateSearchIdentity(report,0));
  assert.throws(()=>validateSearchIdentity({...report,sourceHash:'wrong'},0,searchIdentity));
});

test('reference migration preserves real draw boundaries, history and cursors; fast resume cannot be rolled back by reimport',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'astra-fast-migration-'));
  const legacyRoot=path.join(root,'reference'),outputRoot=path.join(root,'fast');
  const index=indexOf([1475311,40366667]),shard=index%8;
  const sourceDir=path.join(legacyRoot,`shard-${shard}`),targetDir=path.join(outputRoot,`shard-${shard}`);
  try{
    const old=await reference({pairIndex:index,maxNodes:45,maxMs:60000,maxDepth:40,runtimeDir:sourceDir});
    assert(old.checkpoint.excludedDraw.length>0);
    assert(old.checkpoint.search.frontier.length>0);
    const bytes=fs.readFileSync(old.checkpointFile);
    await importLegacyShard({shard,pairIndices:[index],legacyRoot,outputRoot});
    const target=path.join(targetDir,path.basename(old.checkpointFile));
    const copied=JSON.parse(fs.readFileSync(target));
    assert.deepEqual(payload(copied),payload(JSON.parse(bytes)));
    assert.equal(copied.identity.sourceHash,searchIdentity.sourceHash);
    assert.equal(copied.migration.payloadHash,hash(payload(old.checkpoint)));
    assert.deepEqual(fs.readFileSync(old.checkpointFile),bytes);
    const resumed=await runPair({pairIndex:index,maxNodes:40,maxMs:60000,maxDepth:40,runtimeDir:targetDir});
    assert(resumed.summary.visited>old.summary.visited);
    assert.equal(resumed.checkpoint.search.version,3);
    assert(resumed.checkpoint.excludedDraw.length>=old.checkpoint.excludedDraw.length);
    if(resumed.checkpoint.bestPlayableMain1)await replay(resumed.checkpoint.bestPlayableMain1);
    const advanced=fs.readFileSync(target);
    await importLegacyShard({shard,pairIndices:[index],legacyRoot,outputRoot});
    assert.deepEqual(fs.readFileSync(target),advanced);
    assert.deepEqual(fs.readFileSync(old.checkpointFile),bytes);
    for(const folder of [sourceDir,targetDir])assert(!fs.existsSync(path.join(folder,'.search.lock')));
    await assert.rejects(importLegacyShard({shard,pairIndices:[index],legacyRoot,outputRoot:legacyRoot}),/independent directories/);

    const broken=structuredClone(old.checkpoint);broken.identity.seed=999;
    fs.writeFileSync(old.checkpointFile,JSON.stringify(broken));
    await assert.rejects(importLegacyShard({shard,pairIndices:[index],legacyRoot,outputRoot}));
    assert.deepEqual(fs.readFileSync(target),advanced);
    for(const folder of [sourceDir,targetDir])assert(!fs.existsSync(path.join(folder,'.search.lock')));
    fs.writeFileSync(old.checkpointFile,bytes);
    const lock=path.join(sourceDir,'.search.lock');fs.writeFileSync(lock,'owned elsewhere');
    await assert.rejects(importLegacyShard({shard,pairIndices:[index],legacyRoot,outputRoot}),/EEXIST/);
    assert.equal(fs.readFileSync(lock,'utf8'),'owned elsewhere');
    assert(!fs.existsSync(path.join(targetDir,'.search.lock')));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
