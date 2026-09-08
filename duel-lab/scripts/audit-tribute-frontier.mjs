/** Read-only core replay followed by a checked frontier-only transformation.
 * No child is generated and no terminal, draw boundary or saved route is removed.
 * The frozen search implementation owns every pruning decision. This producer's
 * source hash, before/after bytes and full result are retained in a separate ledger.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../cards.mjs';
import {hash} from './route-harness.mjs';
import {search,tributeAuditIdentity} from './search-kernel-tribute.mjs';
import {searchIdentity,selectShard,runShard} from './search-multi-pairs-tribute.mjs';

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const self=fileURLToPath(import.meta.url),producerHash=digest(fs.readFileSync(self));
const producerFiles=[self,...['search-kernel-tribute.mjs','search-multi-pairs-tribute.mjs',
  'search-kernel-fast.mjs','search-multi-pairs-fast.mjs','search-kernel.mjs','search-multi-pairs.mjs']
  .map(name=>path.join(ROOT,'scripts',name))];
const producerSources=producerFiles.map(file=>({file:path.relative(ROOT,file).replaceAll('\\','/'),sha256:digest(fs.readFileSync(file))}));
const checkSources=()=>{
  assert.deepEqual(producerFiles.map(file=>digest(fs.readFileSync(file))),producerSources.map(s=>s.sha256),'Audit dependencies changed');
  assert(tributeAuditIdentity().pinVerified,'Tribute source pin is not verified');
};
const key=frame=>hash([frame.prefix,frame.nextCandidate??0]);
const count=pruning=>({
  tribute:pruning.tributeUiLoops?.counts?.cancelledNormalTribute??0,
  linkCancel:pruning.linkUiLoops?.counts?.cancelledLinkSummon??0,
  linkToggle:pruning.linkUiLoops?.counts?.linkMaterialToggle??0,
});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');

export function selectAuditFrames(checkpoint){
  const run=checkpoint.search;
  if(!run.hand.some(code=>[72656408,33854624].includes(code)))return [];
  const failures=new Set((run.failures??[]).map(f=>hash(f.prefix)));
  return run.frontier.filter(f=>!failures.has(hash(f.prefix)) &&
    !['error','unverifiedResponse','unverifiedPastFailure'].includes(f.reason) &&
    f.prefix.some(input=>input.cancel===true));
}

export async function auditFrontier(checkpoint,{maxMs=60000,maxNodes}={}){
  const selected=selectAuditFrames(checkpoint),original=checkpoint.search;
  assert.equal(new Set(original.frontier.map(key)).size,original.frontier.length,'Duplicate input frame keys');
  if(!selected.length)return {checkpoint,changed:false,selected:0,removed:[],proof:null};
  assert.equal(original.version,4,'Only current v4 checkpoints may be audited');
  assert(original.protocol?.sumSortVerified,'Verified protocol required');
  checkSources();
  const policy=tributeAuditIdentity();
  assert.equal(original.pruning.tributeUiLoops.policy,policy.policy);
  assert.equal(original.pruning.tributeUiLoops.expectedPin,policy.expectedPin);
  assert.equal(original.pruning.tributeUiLoops.enabled,true);
  const selectedKeys=new Set(selected.map(key)),originalKeys=new Set(original.frontier.map(key));
  // Long saved cycles get examined first. Ordering never discards a frame.
  const seed={...original,frontier:[...selected].sort((a,b)=>a.prefix.length-b.prefix.length),
    terminals:[],rejected:[],failures:[],visited:0,generated:0,replayedResponses:0,
    execution:{coreStarts:0,replayedResponses:0,reusedResponses:0}};
  const result=await search({resume:seed,maxNodes:maxNodes??selected.length,maxGenerated:0,
    maxDepth:0,maxMs,stopOnDraw:true,onNode:()=>({stop:true,reason:'frontierAuditHold'})});
  checkSources();
  assert.equal(result.generated,0,'Audit must never generate children');
  assert.equal(result.pruning.exactDuplicatePrefixes,original.pruning.exactDuplicatePrefixes);
  const retained=new Set();
  for(const frame of result.frontier){assert(selectedKeys.has(key(frame)),'Audit invented an output frame');retained.add(key(frame));}
  // These results do not expose a candidate cursor. Keep every original frame
  // with the same prefix; a RETRY or terminal is never used as deletion proof.
  const keepPrefixes=new Set([...result.rejected,...result.failures].map(r=>hash(r.prefix)));
  for(const route of result.terminals)keepPrefixes.add(hash(route.steps.map(s=>s.input)));
  for(const prefixHash of keepPrefixes)assert(selected.some(f=>hash(f.prefix)===prefixHash),'Unknown result prefix');
  for(const frame of selected)if(keepPrefixes.has(hash(frame.prefix)))retained.add(key(frame));
  const removed=selected.filter(f=>!retained.has(key(f)));
  const before=count(original.pruning),after=count(result.pruning);
  const deltas=Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));
  assert(Object.values(deltas).every(n=>Number.isSafeInteger(n)&&n>=0));
  assert.equal(removed.length,Object.values(deltas).reduce((a,b)=>a+b,0),'Lost frames are not exactly accounted for by audited pruning');
  const removedKeys=new Set(removed.map(key));
  const frontier=original.frontier.filter(f=>!removedKeys.has(key(f)));
  assert(frontier.every(f=>originalKeys.has(key(f))));
  const next=removed.length?{...checkpoint,search:{...original,frontier,complete:frontier.length===0,
    pruning:{...original.pruning,linkUiLoops:result.pruning.linkUiLoops,tributeUiLoops:result.pruning.tributeUiLoops}},
    updatedAt:new Date().toISOString()}:checkpoint;
  for(const name of ['visited','generated','replayedResponses','terminals','rejected','failures','bounds','invocation','execution'])
    assert.deepEqual(next.search[name],original[name],`Audit modified search ${name}`);
  for(const name of ['migration','excludedDraw','bestMain1','bestPlayableMain1','main1Observations','failureHistory'])
    assert.deepEqual(next[name],checkpoint[name],`Audit modified ${name}`);
  return {checkpoint:next,changed:removed.length>0,selected:selected.length,removed,
    proof:{deltas,auditVisits:result.invocation.visited,result:{...result,routes:undefined},
      scope:'Only source-pinned kernel UI pruning removes frames; all other results retain the exact original frame. Search visit counters exclude this replay-only audit.'}};
}

export async function auditShard({shard=0,shards=8,runtimeDir,maxMs=60000,maxNodes,pairIndices}={}){
  const assigned=selectShard(shard,shards,pairIndices);
  const directory=path.resolve(runtimeDir??path.join(ROOT,`runtime/multi-pair-search-tribute/shard-${shard}`));
  const lockFile=path.join(directory,'.search.lock'),fd=fs.openSync(lockFile,'wx');
  fs.writeFileSync(fd,JSON.stringify({pid:process.pid,purpose:'frontier-audit'}));
  let ledger;
  const records=[];
  try{
    const auditId=new Date().toISOString().replaceAll(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8);
    ledger=path.join(directory,'frontier-audits',auditId);fs.mkdirSync(ledger,{recursive:true});
    for(const pair of assigned){
      const file=path.join(directory,`pair-${String(pair.index).padStart(3,'0')}-${pair.id}.checkpoint.json`);
      if(!fs.existsSync(file))continue;
      const bytes=fs.readFileSync(file),checkpoint=JSON.parse(bytes);
      assert.equal(checkpoint.schema,searchIdentity.schema);
      assert.equal(checkpoint.identity.sourceHash,searchIdentity.sourceHash);
      assert.equal(checkpoint.identity.presetHash,searchIdentity.presetHash);
      assert.equal(checkpoint.identity.pairHash,searchIdentity.pairHash);
      assert.equal(checkpoint.identity.pairIndex,pair.index);
      assert.equal(checkpoint.identity.pairId,pair.id);
      assert.deepEqual(checkpoint.identity.hand,pair.hand);
      assert.deepEqual(checkpoint.pair,pair);
      assert.deepEqual(checkpoint.search.hand,pair.hand);
      assert.equal(checkpoint.identity.seed,checkpoint.search.seed);
      assert.deepEqual(checkpoint.search.rootPrefix,[]);
      assert.equal(checkpoint.search.complete,checkpoint.search.frontier.length===0);
      if(!selectAuditFrames(checkpoint).length)continue;
      const audit=await auditFrontier(checkpoint,{maxMs,maxNodes});
      checkSources();
      assert.equal(digest(fs.readFileSync(file)),digest(bytes),'Checkpoint changed under audit');
      const item=path.join(ledger,`pair-${pair.index}`);fs.mkdirSync(item);
      fs.writeFileSync(path.join(item,'before.json'),bytes);
      const afterBytes=Buffer.from(JSON.stringify(audit.checkpoint,null,2)+'\n');
      fs.writeFileSync(path.join(item,'after.json'),audit.changed?afterBytes:bytes);
      const record={pairIndex:pair.index,selected:audit.selected,removed:audit.removed.length,
        beforeHash:digest(bytes),afterHash:digest(audit.changed?afterBytes:bytes),
        producer:{file:path.relative(ROOT,self).replaceAll('\\','/'),sha256:producerHash,sources:producerSources},identity:searchIdentity,
        removedFrames:audit.removed,...audit.proof};
      write(path.join(item,'proof.json'),record);records.push({...record,result:undefined,removedFrames:undefined});
      if(audit.changed){
        checkSources();
        assert.equal(digest(fs.readFileSync(file)),digest(bytes),'Checkpoint changed while writing audit evidence');
        const temporary=`${file}.${process.pid}.tmp`;fs.writeFileSync(temporary,afterBytes);fs.renameSync(temporary,file);
      }
      console.log(JSON.stringify({pair:pair.index,selected:audit.selected,removed:audit.removed.length,auditVisits:audit.proof?.auditVisits??0}));
    }
    write(path.join(ledger,'summary.json'),{identity:searchIdentity,records});
  }finally{fs.closeSync(fd);fs.unlinkSync(lockFile);}
  // Empty selection only republishes all checkpoints using the canonical
  // writer under its own lock. It does not run search or rewrite checkpoints.
  const summary=await runShard({shard,shards,pairIndices:[],runtimeDir:directory,maxNodesPerPair:0});
  return {ledger,records,summary:summary.summary};
}

if(process.argv[1]&&path.resolve(process.argv[1])===self){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--shard')options.shard=Number(args[++i]);
    else if(args[i]==='--ms-per-pair')options.maxMs=Number(args[++i]);
    else if(args[i]==='--nodes-per-pair')options.maxNodes=Number(args[++i]);
    else if(args[i]==='--runtime-dir')options.runtimeDir=args[++i];
    else if(args[i]==='--pair-indices')options.pairIndices=args[++i].split(',').map(Number);
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  const result=await auditShard(options);
  console.log(JSON.stringify({ledger:result.ledger,removed:result.records.reduce((n,r)=>n+r.removed,0),summary:result.summary}));
}
