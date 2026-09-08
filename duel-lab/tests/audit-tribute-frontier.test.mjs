import test from 'node:test';
import assert from 'node:assert/strict';
import {auditFrontier,selectAuditFrames} from '../scripts/audit-tribute-frontier.mjs';
import {search} from '../scripts/search-kernel-tribute.mjs';
import {startRoute,respond,finishRoute,hash} from '../scripts/route-harness.mjs';

const hand=[68337209,72656408];
const opening=[{action:0},{action:0},{action:0},{selection:[5]},{action:0},{selection:[0]},{action:0}];
const loop=[{action:0},{cancel:true}];
const root=[...opening,...loop];
const key=frame=>hash([frame.prefix,frame.nextCandidate??0]);
let fixturePromise;

async function fixture(){
  fixturePromise??=(async()=>{
    const run=await search({hand,prefix:root,maxNodes:0});
    const game=await startRoute(hand);let end,best,terminal;
    try{
      for(const input of root)respond(game,input);
      best=structuredClone(finishRoute(game));
      end=game.prompt.choices.find(c=>c.response.action===7).id;
      respond(game,{action:end});terminal=finishRoute(game,{terminalReason:'firstTurnEnded'});
    }finally{game.close();}
    const frames=[
      {prefix:root,nextCandidate:0,reason:'maxGenerated',tag:'cursor-0'},
      {prefix:root,nextCandidate:1,reason:'maxGenerated',tag:'cursor-1'},
      {prefix:[...root,{action:0},{selection:[]}],nextCandidate:0,reason:'maxDepth',tag:'coreRetry'},
      {prefix:[...root,{action:999999}],nextCandidate:0,reason:'maxDepth',tag:'invalidResponse'},
      {prefix:[...root,{action:end}],nextCandidate:0,reason:'maxNodes',tag:'terminal'},
      {prefix:[...root,...Array.from({length:86},()=>structuredClone(loop)).flat(),{action:0}],
        nextCandidate:0,reason:'maxDepth',tag:'audited-loop'},
    ];
    return {search:{...run,frontier:frames,complete:false,visited:101,generated:203,replayedResponses:407,
      terminals:[terminal],rejected:[],failures:[],
      execution:{coreStarts:17,replayedResponses:307,reusedResponses:19},
      pruning:{...run.pruning,exactDuplicatePrefixes:2,
        linkUiLoops:{...run.pruning.linkUiLoops,counts:{cancelledLinkSummon:7,linkMaterialToggle:11}},
        tributeUiLoops:{...run.pruning.tributeUiLoops,counts:{cancelledNormalTribute:23}}}},
      migration:{kind:'test-fixture'},excludedDraw:[],bestMain1:best,bestPlayableMain1:best,
      main1Observations:3,failureHistory:[],updatedAt:'2026-09-08T00:00:00.000Z'};
  })();
  return structuredClone(await fixturePromise);
}

function assertPreserved(before,after){
  for(const name of ['visited','generated','replayedResponses','terminals','rejected','failures','bounds','invocation','execution'])
    assert.deepEqual(after.search[name],before.search[name],name);
  for(const name of ['migration','excludedDraw','bestMain1','bestPlayableMain1','main1Observations','failureHistory'])
    assert.deepEqual(after[name],before[name],name);
}

test('actual core: a mixed frontier loses only proven loops; input, history and cursor distinctions remain intact',async()=>{
  const checkpoint=await fixture(),before=hash(checkpoint);
  assert.equal(selectAuditFrames(checkpoint).length,6);
  const audit=await auditFrontier(checkpoint,{maxMs:30000});
  assert.equal(hash(checkpoint),before,'The supplied checkpoint is immutable');
  assert.equal(audit.changed,true);assert.equal(audit.selected,6);
  assert.deepEqual(audit.removed.map(f=>f.tag),['audited-loop']);
  assert.deepEqual(audit.proof.deltas,{tribute:1,linkCancel:0,linkToggle:0});
  assert.equal(audit.proof.result.generated,0);assert.equal(audit.proof.auditVisits,6);
  assert.equal(audit.proof.result.terminals.length,1);
  assert.deepEqual(audit.proof.result.rejected.map(r=>r.kind).sort(),['coreRetry','invalidResponse']);
  assert.deepEqual(audit.checkpoint.search.frontier,checkpoint.search.frontier.slice(0,-1));
  assert.equal(new Set(audit.checkpoint.search.frontier.map(key)).size,5);
  assert.deepEqual(audit.checkpoint.search.frontier.slice(0,2).map(f=>f.nextCandidate),[0,1]);
  assert(audit.checkpoint.search.frontier.every(f=>f.reason!=='frontierAuditHold'),'Keep original reasons and metadata');
  assertPreserved(checkpoint,audit.checkpoint);
  assert.equal(audit.checkpoint.search.pruning.exactDuplicatePrefixes,2);
  assert.equal(audit.checkpoint.search.pruning.tributeUiLoops.counts.cancelledNormalTribute,24);
});

test('actual core: zero node or time budgets preserve every original frame, without generating children',async()=>{
  for(const budget of [{maxNodes:0,maxMs:30000},{maxMs:0}]){
    const checkpoint=await fixture(),before=hash(checkpoint);
    const audit=await auditFrontier(checkpoint,budget);
    assert.equal(audit.changed,false);assert.deepEqual(audit.removed,[]);
    assert.strictEqual(audit.checkpoint,checkpoint);
    assert.equal(audit.proof.auditVisits,0);assert.equal(audit.proof.result.generated,0);
    assert.deepEqual(audit.proof.deltas,{tribute:0,linkCancel:0,linkToggle:0});
    assert.equal(hash(checkpoint),before);
  }
});

test('actual core: a partial budget removes the witnessed loop and leaves all unfinished original frames',async()=>{
  const checkpoint=await fixture(),before=hash(checkpoint);
  const audit=await auditFrontier(checkpoint,{maxNodes:2,maxMs:30000});
  assert.equal(audit.proof.auditVisits,2);assert.equal(audit.proof.result.generated,0);
  assert.equal(audit.removed.length,1);assert.equal(audit.removed[0].tag,'audited-loop');
  assert.deepEqual(audit.checkpoint.search.frontier,checkpoint.search.frontier.slice(0,-1));
  assert.equal(audit.checkpoint.search.complete,false);assert.equal(hash(checkpoint),before);
  assertPreserved(checkpoint,audit.checkpoint);
});

test('actual core: cancellations inside an immutable root remain even after all selected frames were audited',async()=>{
  const checkpoint=await fixture();checkpoint.search.frontier=checkpoint.search.frontier.slice(0,2);
  const before=hash(checkpoint),audit=await auditFrontier(checkpoint,{maxMs:30000});
  assert.equal(audit.selected,2);assert.equal(audit.proof.auditVisits,2);
  assert.equal(audit.changed,false);assert.deepEqual(audit.removed,[]);
  assert.deepEqual(audit.proof.deltas,{tribute:0,linkCancel:0,linkToggle:0});
  assert.equal(hash(checkpoint),before);
});

test('actual core: terminal and rejected replay outcomes never replace original frontier frames or mark them complete',async()=>{
  const checkpoint=await fixture();checkpoint.search.frontier=checkpoint.search.frontier.slice(2,5);
  const audit=await auditFrontier(checkpoint,{maxMs:30000});
  assert.equal(audit.proof.result.complete,true,'The isolated probe exhausted its own queue');
  assert.equal(audit.proof.result.terminals.length,1);assert.equal(audit.proof.result.rejected.length,2);
  assert.equal(audit.changed,false);assert.strictEqual(audit.checkpoint,checkpoint);
  assert.equal(audit.checkpoint.search.complete,false,'The actual frontier must retain terminal/RETRY outcomes');
  assertPreserved(checkpoint,audit.checkpoint);
});

test('failure-prefix exclusions protect all candidate cursors, and error reasons never enter the audit subset',async()=>{
  const checkpoint=await fixture(),frames=checkpoint.search.frontier;
  checkpoint.search.failures=[{prefix:root,message:'Preserved historical engine failure'}];
  for(const reason of ['error','unverifiedResponse','unverifiedPastFailure'])
    frames.push({prefix:[...root,...structuredClone(loop),...structuredClone(loop)],nextCandidate:frames.length,reason});
  const before=hash(checkpoint),selected=selectAuditFrames(checkpoint);
  assert.deepEqual(selected.map(f=>f.tag),['coreRetry','invalidResponse','terminal','audited-loop']);
  const audit=await auditFrontier(checkpoint,{maxMs:30000});
  assert.equal(audit.selected,4);assert.equal(audit.removed.length,1);
  assert(audit.checkpoint.search.frontier.some(f=>f.tag==='cursor-0'));
  assert(audit.checkpoint.search.frontier.some(f=>f.tag==='cursor-1'));
  assert.deepEqual(audit.checkpoint.search.frontier.slice(-3),frames.slice(-3));
  assert.deepEqual(audit.checkpoint.search.failures,checkpoint.search.failures);
  assert.equal(hash(checkpoint),before);
});

test('no eligible card, no cancellation, and repeated audits cannot create extra pruning contributions',async()=>{
  const checkpoint=await fixture();
  const noCard={...checkpoint,search:{...checkpoint.search,hand:[69272449]}};
  assert.deepEqual(selectAuditFrames(noCard),[]);
  const none=await auditFrontier(noCard);assert.equal(none.selected,0);assert.equal(none.proof,null);
  const noCancel={...checkpoint,search:{...checkpoint.search,frontier:[{prefix:opening,nextCandidate:0}]}};
  assert.deepEqual(selectAuditFrames(noCancel),[]);
  const first=await auditFrontier(checkpoint,{maxMs:30000});
  const before=hash(first.checkpoint),again=await auditFrontier(first.checkpoint,{maxMs:30000});
  assert.equal(again.changed,false);assert.equal(again.removed.length,0);
  assert.deepEqual(again.proof.deltas,{tribute:0,linkCancel:0,linkToggle:0});
  assert.equal(hash(first.checkpoint),before);
});

test('duplicate logical frame keys and unsupported checkpoint versions fail before any transformation',async()=>{
  const checkpoint=await fixture(),before=hash(checkpoint);
  const duplicate=structuredClone(checkpoint);
  duplicate.search.frontier.push({...duplicate.search.frontier[0],nextCandidate:undefined,tag:'duplicate-default-cursor'});
  await assert.rejects(auditFrontier(duplicate),/Duplicate input frame keys/);
  const legacy=structuredClone(checkpoint);legacy.search.version=3;
  await assert.rejects(auditFrontier(legacy),/Only current v4/);
  const unverified=structuredClone(checkpoint);unverified.search.protocol.sumSortVerified=false;
  await assert.rejects(auditFrontier(unverified),/Verified protocol/);
  assert.equal(hash(checkpoint),before);
});
