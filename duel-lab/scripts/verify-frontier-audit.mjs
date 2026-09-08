/** Independent structural verification of the latest frontier-audit ledgers.
 * Does not import or execute the producer, search kernel, runner, or duel core.
 * Byte hashes establish which artifacts were checked, not a new rules proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');
const SCHEMA='astra-multi-pair-search-tribute-v1';
const PRODUCER_FILES=['scripts/audit-tribute-frontier.mjs','scripts/search-kernel-tribute.mjs',
  'scripts/search-multi-pairs-tribute.mjs','scripts/search-kernel-fast.mjs','scripts/search-multi-pairs-fast.mjs',
  'scripts/search-kernel.mjs','scripts/search-multi-pairs.mjs'];
const IDENTITY_FILES=['scripts/search-multi-pairs-tribute.mjs','scripts/search-kernel-tribute.mjs',
  'scripts/search-multi-pairs-fast.mjs','scripts/search-kernel-fast.mjs','scripts/search-multi-pairs.mjs',
  'scripts/search-kernel.mjs','scripts/route-harness.mjs','scripts/patch-core.mjs','engine.mjs','prompts.mjs',
  'cards.mjs','node_modules/ocgcore-wasm/dist/index.js'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const omit=(object,names)=>Object.fromEntries(Object.entries(object).filter(([key])=>!names.includes(key)));
const eq=(a,b,message)=>assert.deepEqual(a,b,message);
const integer=(value,label)=>{assert(Number.isSafeInteger(value)&&value>=0,`Invalid ${label}`);return value;};
const sum=values=>integer(values.reduce((a,b)=>a+integer(b,'summand'),0),'sum');
const frameKey=frame=>hash([frame.prefix,frame.nextCandidate??0]);
const prefixKey=frame=>hash(frame.prefix);
const relative=file=>path.relative(ROOT,file).replaceAll('\\','/');
const unique=(values,label)=>assert.equal(new Set(values).size,values.length,`Duplicate ${label}`);

function readContext(){
  const stamps=new Map();
  const read=file=>{const bytes=fs.readFileSync(file),digest=sha(bytes);
    if(stamps.has(file))assert.equal(stamps.get(file),digest,`File changed during verification: ${relative(file)}`);
    stamps.set(file,digest);return bytes;};
  return {stamps,read,json:file=>JSON.parse(read(file)),assertUnchanged:()=>{
    for(const [file,digest] of stamps)assert.equal(sha(fs.readFileSync(file)),digest,`File changed: ${relative(file)}`);
  }};
}
function currentIdentity(io){
  const preset=io.json(path.join(ROOT,'preset.json')),cards=io.json(path.join(ROOT,'data/cards.json'));
  const copies=new Map();for(const code of preset.main)copies.set(code,(copies.get(code)??0)+1);
  const codes=[...copies.keys()].sort((a,b)=>a-b),pairs=[];
  for(let i=0;i<codes.length;i++)for(let j=i;j<codes.length;j++){
    const a=codes[i],b=codes[j];if(a===b&&copies.get(a)<2)continue;
    pairs.push({id:`${a}-${b}`,hand:[a,b],physicalWeight:a===b?copies.get(a)*(copies.get(a)-1)/2:copies.get(a)*copies.get(b),index:pairs.length});
  }
  assert.equal(sum(pairs.map(p=>p.physicalWeight)),preset.main.length*(preset.main.length-1)/2);
  const data=path.join(ROOT,'data'),lua=fs.readdirSync(path.join(data,'scripts'),{recursive:true}).filter(n=>n.endsWith('.lua')).sort();
  const assetsHash=hash([...['cards.json','strings.conf','ocgcore.sync.wasm'].map(n=>[n,sha(io.read(path.join(data,n)))]),
    ...lua.map(n=>[n.replaceAll('\\','/'),sha(io.read(path.join(data,'scripts',n)))])]);
  const identity={schema:SCHEMA,presetHash:hash(preset),pairHash:hash(pairs),
    sourceHash:hash([...IDENTITY_FILES.map(n=>[n,sha(io.read(path.join(ROOT,n)))]),['assets',assetsHash]]),assetsHash};
  return {identity,pairs:pairs.map(p=>({...p,names:p.hand.map(c=>cards[c]?.name??String(c))})),
    producerSources:PRODUCER_FILES.map(file=>({file,sha256:sha(io.read(path.join(ROOT,file)))}))};
}
function eligibleFrames(checkpoint){
  const run=checkpoint.search;
  if(!run.hand.some(c=>c===72656408||c===33854624))return [];
  const failed=new Set((run.failures??[]).map(prefixKey));
  return run.frontier.filter(f=>!failed.has(prefixKey(f))&&
    !['error','unverifiedResponse','unverifiedPastFailure'].includes(f.reason)&&f.prefix.some(input=>input.cancel===true));
}
const countGroups={tribute:['tributeUiLoops','cancelledNormalTribute'],
  linkCancel:['linkUiLoops','cancelledLinkSummon'],linkToggle:['linkUiLoops','linkMaterialToggle']};
function pruningDeltas(before,result,removed){
  const deltas={};
  for(const [name,[group,key]] of Object.entries(countGroups)){
    const a=integer(before[group]?.counts?.[key]??0,`${group}.${key} before`);
    const b=integer(result[group]?.counts?.[key]??0,`${group}.${key} after`);
    deltas[name]=integer(b-a,`${group}.${key} delta`);
  }
  for(const group of ['linkUiLoops','tributeUiLoops']){
    const a=before[group],b=result[group];assert(a&&b,`Missing ${group}`);
    eq(omit(a,['counts','examples']),omit(b,['counts','examples']),`Changed ${group} policy or guards`);
    eq(Object.keys(a.counts).sort(),Object.keys(b.counts).sort(),`Changed ${group} counter keys`);
    const growth=group==='linkUiLoops'?deltas.linkCancel+deltas.linkToggle:deltas.tribute;
    assert(Array.isArray(a.examples)&&Array.isArray(b.examples));assert(a.examples.length<=20&&b.examples.length<=20);
    eq(b.examples.slice(0,a.examples.length),a.examples,`Changed historical ${group} examples`);
    assert.equal(b.examples.length-a.examples.length,Math.min(growth,20-a.examples.length),`Wrong ${group} example growth`);
    const removedPrefixes=new Set(removed.map(prefixKey));
    for(const example of b.examples.slice(a.examples.length)){
      assert(removedPrefixes.has(prefixKey(example)),`Pruning example is not a removed prefix`);
      assert((group==='tributeUiLoops'?['cancelledNormalTribute']:['cancelledLinkSummon','linkMaterialToggle']).includes(example.kind));
    }
  }
  eq(omit(before,['linkUiLoops','tributeUiLoops']),omit(result,['linkUiLoops','tributeUiLoops']),'Changed unrelated pruning fields');
  return deltas;
}

/** Pure ledger payload check, exported so an external test harness can inject corruptions. */
export function verifyAuditRecord(before,after,proof,{identity,pair,producerSources}){
  assert(before&&after&&proof?.result,'Missing audit payload');
  eq(proof.identity,identity,'Proof identity differs from current sources');
  eq(proof.producer,{file:PRODUCER_FILES[0],sha256:producerSources[0].sha256,sources:producerSources},'Producer source hashes differ');
  assert.equal(proof.pairIndex,pair.index);assert.equal(before.schema,SCHEMA);
  eq(before.pair,pair,'Wrong checkpoint pair');eq(before.search.hand,pair.hand);eq(before.search.rootPrefix,[]);
  eq(before.identity,{presetHash:identity.presetHash,pairHash:identity.pairHash,pairIndex:pair.index,pairId:pair.id,
    hand:pair.hand,seed:before.search.seed,sourceHash:identity.sourceHash},'Wrong checkpoint identity');
  const original=before.search,result=proof.result;
  assert.equal(original.version,4);assert.equal(result.version,4);assert.equal(original.protocol?.sumSortVerified,true);
  assert.equal(original.complete,original.frontier.length===0);
  assert.equal(original.pruning.stateMerging,false);assert.equal(original.pruning.strategic,false);
  assert.equal(original.pruning.tributeUiLoops.enabled,true);assert.equal(original.pruning.tributeUiLoops.pinVerified,true);
  assert.equal(original.pruning.tributeUiLoops.installedPin,original.pruning.tributeUiLoops.expectedPin);
  for(const name of ['implementation','presetHash','hand','seed','deckOrder','rootPrefix','scope','protocol'])
    eq(result[name],original[name],`Audit result changed ${name}`);
  const beforeKeys=original.frontier.map(frameKey);unique(beforeKeys,'original frontier keys');
  for(const frame of original.frontier){assert(Array.isArray(frame.prefix));integer(frame.nextCandidate??0,'candidate cursor');}
  const selected=eligibleFrames(before);assert(selected.length>0,'Ledger must contain an eligible pair');
  assert.equal(integer(proof.selected,'selected'),selected.length);
  const selectedByKey=new Map(selected.map(f=>[frameKey(f),f]));
  const selectedPrefixKeys=new Set(selected.map(prefixKey)),retained=new Set();
  unique(result.frontier.map(frameKey),'result frontier keys');
  for(const frame of result.frontier){
    const key=frameKey(frame);assert(selectedByKey.has(key),'Result introduced a frame or changed its cursor');
    eq(omit(frame,['reason','prompt','message']),omit(selectedByKey.get(key),['reason','prompt','message']),'Result changed frame data');
    retained.add(key);
  }
  const keepPrefixes=new Set();
  for(const item of [...result.rejected,...result.failures]){
    assert(selectedPrefixKeys.has(prefixKey(item)),'Result introduced a rejection or failure prefix');keepPrefixes.add(prefixKey(item));
  }
  for(const route of result.terminals){
    const k=hash(route.steps.map(s=>s.input));assert(selectedPrefixKeys.has(k),'Result introduced a terminal prefix');keepPrefixes.add(k);
  }
  for(const frame of selected)if(keepPrefixes.has(prefixKey(frame)))retained.add(frameKey(frame));
  const removed=selected.filter(f=>!retained.has(frameKey(f)));
  eq(proof.removedFrames,removed,'Removed frames differ from the independent proof partition');
  assert.equal(integer(proof.removed,'removed'),removed.length);unique(removed.map(frameKey),'removed frames');
  const removedKeys=new Set(removed.map(frameKey));
  const expectedFrontier=original.frontier.filter(f=>!removedKeys.has(frameKey(f)));
  eq(after.search.frontier,expectedFrontier,'Remaining frame content, order, or cursor changed');
  assert.equal(after.search.complete,expectedFrontier.length===0);
  eq(omit(before,['search','updatedAt']),omit(after,['search','updatedAt']),'Changed checkpoint metadata, routes, excludedDraw, or other fields');
  eq(omit(original,['frontier','complete','pruning']),omit(after.search,['frontier','complete','pruning']),
    'Changed search counters, terminals, failures, execution, or other search fields');
  const deltas=pruningDeltas(original.pruning,result.pruning,removed);eq(proof.deltas,deltas,'Wrong pruning deltas');
  assert.equal(sum(Object.values(deltas)),removed.length,'Pruning does not account for exactly the removed frames');
  if(removed.length){
    eq(after.search.pruning,result.pruning,'After checkpoint did not apply precisely the audited pruning metadata');
    assert(typeof after.updatedAt==='string'&&Number.isFinite(Date.parse(after.updatedAt)),'Invalid update timestamp');
  }else eq(after,before,'An unchanged audit changed its checkpoint');
  const auditVisits=integer(proof.auditVisits,'auditVisits');
  assert.equal(result.visited,auditVisits);assert.equal(result.invocation.visited,auditVisits);
  assert(auditVisits<=selected.length&&removed.length<=auditVisits,'Impossible audit visit count');
  assert.equal(result.generated,0);assert.equal(result.invocation.generated,0);assert.equal(result.bounds.maxGenerated,0);
  assert.equal(result.bounds.maxDepth,0);assert.equal(result.bounds.stopOnDraw,true);
  assert.equal(result.bounds.pruneTributeUiLoops,true);
  assert.equal(result.execution.reusedResponses,0);assert.equal(result.invocation.execution.reusedResponses,0);
  for(const key of ['coreStarts','replayedResponses','reusedResponses']){
    integer(result.execution[key],`audit execution ${key}`);eq(result.execution[key],result.invocation.execution[key]);
  }
  integer(result.replayedResponses,'audit replayedResponses');
  assert(result.replayedResponses<=sum(selected.map(f=>f.prefix.length)),'Audit replay count exceeds selected histories');
  assert.equal(result.complete,result.frontier.length===0);
  return {pairIndex:pair.index,selected:selected.length,removed:removed.length,frontierBefore:original.frontier.length,
    frontierAfter:expectedFrontier.length,auditVisits,searchVisited:original.visited,deltas};
}

function latestLedger(directory){
  assert(!fs.existsSync(path.join(directory,'.search.lock')),'Shard is locked or still running');
  const parent=path.join(directory,'frontier-audits');
  const entries=fs.readdirSync(parent,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
  assert(entries.length,'No frontier-audit ledger');
  const id=entries.at(-1);assert(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9]{8}$/.test(id),'Invalid latest audit ID');
  return path.join(parent,id);
}
function checkIdentityFields(value,identity){for(const [name,expected] of Object.entries(identity))eq(value[name],expected,`Wrong ${name}`);}
function verifyShard(directory,shard,shards,current,io){
  const ledger=latestLedger(directory),summaryFile=path.join(ledger,'summary.json'),summary=io.json(summaryFile);
  eq(summary.identity,current.identity);assert(Array.isArray(summary.records));unique(summary.records.map(r=>r.pairIndex),'ledger pair records');
  const folders=fs.readdirSync(ledger,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
  eq(folders,summary.records.map(r=>`pair-${r.pairIndex}`).sort(),'Ledger directories and records differ');
  const published=io.json(path.join(directory,'summary.json')),exports=io.json(path.join(directory,'best-routes.json'));
  checkIdentityFields(published,current.identity);checkIdentityFields(exports,current.identity);
  assert.equal(published.shard,shard);assert.equal(exports.shard,shard);assert.equal(published.shards,shards);assert.equal(exports.shards,shards);
  eq(published.generation,hash(published.pairs),'Published generation hash is invalid');eq(exports.generation,published.generation);
  unique(exports.routes.map(r=>r.pairIndex),'published route pairs');
  const records=[];
  for(const row of summary.records){
    const pair=current.pairs[row.pairIndex];assert(pair&&pair.index%shards===shard,'Pair is outside shard');
    const item=path.join(ledger,`pair-${pair.index}`),beforeFile=path.join(item,'before.json'),afterFile=path.join(item,'after.json');
    const beforeBytes=io.read(beforeFile),afterBytes=io.read(afterFile),proof=io.json(path.join(item,'proof.json'));
    assert.equal(proof.beforeHash,sha(beforeBytes),'before.json SHA mismatch');assert.equal(proof.afterHash,sha(afterBytes),'after.json SHA mismatch');
    eq(row,omit(proof,['result','removedFrames']),'Ledger summary record differs from proof.json');
    const before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes);
    const checked=verifyAuditRecord(before,after,proof,{...current,pair});
    if(!checked.removed)assert.equal(proof.afterHash,proof.beforeHash,'No-op audit changed checkpoint bytes');
    const checkpoint=path.join(directory,`pair-${String(pair.index).padStart(3,'0')}-${pair.id}.checkpoint.json`);
    assert.equal(sha(io.read(checkpoint)),proof.afterHash,'Current checkpoint differs from audited after.json');
    const route=exports.routes.find(r=>r.pairIndex===pair.index);
    eq(route??null,before.bestPlayableMain1??null,'Published saved route changed or disappeared');
    const publishedPair=published.pairs.find(p=>p.index===pair.index);assert(publishedPair,'Audited pair absent from shard summary');
    for(const [name,expected] of Object.entries({visited:before.search.visited,unresolved:after.search.frontier.length,
      terminalPaths:before.search.terminals.length,excludedDraw:before.excludedDraw.length,
      completeWithinNoDrawScope:after.search.complete}))eq(publishedPair[name],expected,`Published ${name} differs`);
    records.push({...checked,beforeHash:proof.beforeHash,afterHash:proof.afterHash,proofHash:io.stamps.get(path.join(item,'proof.json'))});
  }
  assert.equal(latestLedger(directory),ledger,'A newer audit appeared during verification');
  return {shard,status:'PASS',ledger:relative(ledger),summaryHash:io.stamps.get(summaryFile),records};
}

export function verifyLatestAudits({runtimeRoot=path.join(ROOT,'runtime/multi-pair-search-tribute'),shards=8}={}){
  assert(Number.isSafeInteger(shards)&&shards>0,'shards must be a positive integer');
  const started=Date.now(),io=readContext(),current=currentIdentity(io),results=[],errors=[];
  for(let shard=0;shard<shards;shard++){
    try{results.push(verifyShard(path.join(path.resolve(runtimeRoot),`shard-${shard}`),shard,shards,current,io));}
    catch(error){const message=error.message;errors.push({shard,message});results.push({shard,status:'FAIL',message});}
  }
  try{io.assertUnchanged();for(let shard=0;shard<shards;shard++){
    const row=results.find(r=>r.shard===shard);if(row.status==='PASS')eq(relative(latestLedger(path.join(path.resolve(runtimeRoot),`shard-${shard}`))),row.ledger);
  }}catch(error){errors.push({scope:'unchanged-inputs',message:error.message});}
  const records=results.flatMap(r=>r.records??[]);
  return {schema:'astra-frontier-audit-verification-v1',status:errors.length?'FAIL':'PASS',verifiedAt:new Date().toISOString(),
    verifier:{file:relative(SELF),sha256:sha(fs.readFileSync(SELF))},identity:current.identity,
    scope:'Latest ledger in every requested shard; exact preservation of audited checkpoint payloads and current route exports. No new core replay; no claim that unrecorded checkpoints changed or stayed unchanged.',
    totals:{shards,verifiedShards:results.filter(r=>r.status==='PASS').length,pairs:records.length,
      selected:sum(records.map(r=>r.selected)),removed:sum(records.map(r=>r.removed)),
      frontierBefore:sum(records.map(r=>r.frontierBefore)),frontierAfter:sum(records.map(r=>r.frontierAfter)),
      auditVisits:sum(records.map(r=>r.auditVisits)),searchVisitDelta:0,generatedDelta:0,
      pruningDeltas:Object.fromEntries(Object.keys(countGroups).map(k=>[k,sum(records.map(r=>r.deltas[k]))]))},
    checkedFiles:io.stamps.size,elapsedMs:Date.now()-started,shards:results,errors};
}

function cli(argv){
  const options={};let output=path.join(ROOT,'docs/MULTI_SEARCH_FRONTIER_AUDIT_RESULTS.json'),write=true;
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--no-write')write=false;
    else if(arg==='--runtime-root'||arg==='--output'||arg==='--shards'){
      assert(argv[i+1]&&!argv[i+1].startsWith('--'),`Missing value for ${arg}`);const value=argv[++i];
      if(arg==='--runtime-root')options.runtimeRoot=path.resolve(value);else if(arg==='--output')output=path.resolve(value);else options.shards=Number(value);
    }else if(arg==='--help'){
      console.log('node scripts/verify-frontier-audit.mjs [--runtime-root PATH] [--shards 8] [--output PATH] [--no-write]');return;
    }else throw new Error(`Unknown argument ${arg}`);
  }
  const result=verifyLatestAudits(options);
  if(write){fs.mkdirSync(path.dirname(output),{recursive:true});const temporary=`${output}.${process.pid}.tmp`;
    fs.writeFileSync(temporary,JSON.stringify(result,null,2)+'\n');fs.renameSync(temporary,output);}
  console.log(JSON.stringify({status:result.status,totals:result.totals,output:write?output:null,errors:result.errors}));
  if(result.status!=='PASS')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
