import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLAYS,startLab,replaySteps,trapPolicy,passPolicy,hitTable,summary} from '../scripts/malice-lab.mjs';
import {searchBest,score,pointsTo,C} from '../scripts/malice-search.mjs';
import {TRAPS} from '../scripts/malice-traps.mjs';

const route=id=>REPLAYS.find(r=>r.id.includes(id));

test('all five replays replay by label while the opponent holds a hand trap and passes',async()=>{
  for(const r of REPLAYS){
    const g=await startLab({hand:r.hand,oppHand:[TRAPS.ash],seed:r.seed});
    try{assert.equal(replaySteps(g,r,passPolicy).broken,null,r.title);assert.ok(score(g).parts.some(([k])=>k.startsWith('ネオテン')));}
    finally{g.close();}
  }
});

test('Ash Blossom on TB-11 breaks the White Rabbit line at step 7; White Rabbit returns by its ③',async()=>{
  const r=route('G9pZztFA');
  const t=await hitTable(r,TRAPS.ash);
  assert.equal(t.windows.length,6);
  assert.equal(t.windows[0].brokenAt,7);
  assert.deepEqual(t.windows[0].chain,['自:M∀LICE＜C＞TB－１１']);
});

test('the response search finishes the White Rabbit + Ash position and keeps only Ring Ribbon',async()=>{
  const r=route('G9pZztFA');
  const setup=async()=>{const g=await startLab({hand:r.hand,oppHand:[TRAPS.ash],seed:r.seed});const policy=trapPolicy(TRAPS.ash,0);replaySteps(g,r,policy);return {g,policy};};
  const res=await searchBest(setup,{ms:60000});
  assert.equal(res.complete,true);
  assert.deepEqual(res.best.score.field,['リングリボー']);
});

test('link arrows: Accord in the right Extra Monster Zone points at main zones 3-5, Wicked (↓↘) in the right EMZ at main 4-5 and nothing from a main zone',()=>{
  assert.deepEqual(pointsTo(C.accord,6).sort(),[2,3,4]);
  assert.deepEqual(pointsTo(52698008,6).sort(),[3,4]);
  assert.deepEqual(pointsTo(52698008,1),[]);
});
