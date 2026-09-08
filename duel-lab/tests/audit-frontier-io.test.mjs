import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runPair,pairs} from '../scripts/search-multi-pairs-tribute.mjs';
import {auditShard} from '../scripts/audit-tribute-frontier.mjs';

const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
test('isolated IO: lock, durable before/after proof, exact checkpoint update and canonical report',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'astra-frontier-audit-'));
  const pair=pairs.find(p=>p.hand.includes(68337209)&&p.hand.includes(72656408));
  const file=path.join(directory,`pair-${String(pair.index).padStart(3,'0')}-${pair.id}.checkpoint.json`);
  const lock=path.join(directory,'.search.lock');
  try{
    await runPair({pairIndex:pair.index,maxNodes:0,runtimeDir:directory});
    const cp=JSON.parse(fs.readFileSync(file));
    const opening=[{action:0},{action:0},{action:0},{selection:[5]},{action:0},{selection:[0]},{action:0}];
    cp.search.frontier=[{prefix:opening,nextCandidate:2,reason:'maxGenerated'},
      {prefix:[...opening,{action:0},{cancel:true},{action:0}],nextCandidate:0,reason:'maxDepth'}];
    fs.writeFileSync(file,JSON.stringify(cp,null,2)+'\n');
    const before=fs.readFileSync(file);
    fs.writeFileSync(lock,'test owner');
    const options={shard:pair.index%8,pairIndices:[pair.index],runtimeDir:directory,maxMs:30000};
    await assert.rejects(auditShard(options),{code:'EEXIST'});
    assert.equal(fs.readFileSync(lock,'utf8'),'test owner');
    assert.equal(digest(fs.readFileSync(file)),digest(before));
    fs.unlinkSync(lock);
    const audited=await auditShard(options);
    assert.equal(audited.records.length,1);assert.equal(audited.records[0].removed,1);
    assert(!fs.existsSync(lock));
    const ledger=path.join(audited.ledger,`pair-${pair.index}`);
    assert.equal(digest(fs.readFileSync(path.join(ledger,'before.json'))),digest(before));
    assert.equal(digest(fs.readFileSync(path.join(ledger,'after.json'))),digest(fs.readFileSync(file)));
    const proof=JSON.parse(fs.readFileSync(path.join(ledger,'proof.json')));
    assert.equal(proof.beforeHash,digest(before));assert.equal(proof.afterHash,digest(fs.readFileSync(file)));
    assert.equal(proof.result.generated,0);assert.equal(proof.deltas.tribute,1);
    const after=JSON.parse(fs.readFileSync(file));
    assert.deepEqual(after.search.frontier,[cp.search.frontier[0]]);
    assert.equal(after.search.visited,cp.search.visited);
    const report=JSON.parse(fs.readFileSync(path.join(directory,'summary.json')));
    assert.equal(report.pairs.find(p=>p.index===pair.index).unresolved,1);
    assert.equal(audited.summary.unresolved,1);
  }finally{
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith('astra-frontier-audit-'));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
