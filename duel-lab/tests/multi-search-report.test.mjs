import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePairSummary,validateSearchIdentity,verifyNoDrawRoute} from '../scripts/build-multi-search-report.mjs';
import {searchIdentity,pairs} from '../scripts/search-multi-pairs.mjs';

test('unsearched or unresolved pairs cannot be published as complete',()=>{
  const base=pairs[0],valid={...base,visited:24,status:'completeWithinNoDrawScope',completeWithinNoDrawScope:true,unresolved:0,terminalPaths:6,excludedDraw:10};
  validatePairSummary(valid,base);
  for(const changes of [{visited:0},{unresolved:99},{status:'unsearched'},{physicalWeight:100},{terminalPaths:-1}]){
    assert.throws(()=>validatePairSummary({...valid,...changes},base));
  }
});
test('wrong or missing search schema and identity fail closed',()=>{
  const r={...searchIdentity,shard:0,shards:8,generation:'test-generation'};validateSearchIdentity(r,0);
  for(const name of Object.keys(searchIdentity)){
    const missing={...r};delete missing[name];assert.throws(()=>validateSearchIdentity(missing,0));
    assert.throws(()=>validateSearchIdentity({...r,[name]:'wrong-version'},0));
  }
  assert.throws(()=>validateSearchIdentity({...r,generation:''},0));
});
test('removing a saved draw log cannot turn a drawing route into a no-draw opening',async()=>{
  const sources=['spell-starters','malice-monsters','cyberse-starters'];
  const route=sources.flatMap(name=>JSON.parse(fs.readFileSync(new URL(`../routes/${name}.json`,import.meta.url))).routes)
    .find(r=>r.log.some(e=>/\d+\s*枚ドロー/.test(e.text)));
  assert(route,'Fixture must actually draw');
  await assert.rejects(()=>verifyNoDrawRoute({...structuredClone(route),requiresDraw:false,drawDependent:false,log:[]}),/Actual replay crossed a draw boundary/);
});
