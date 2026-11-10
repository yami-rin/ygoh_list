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

test('Ash Blossom cannot answer UNDERGROUND or Dormouse ① (banish from the deck), only the later deck effects',async()=>{
  const tops=async id=>(await hitTable(route(id),TRAPS.ash)).windows.map(w=>w.chain.at(-1));
  assert.deepEqual(await tops('cEErE6ce'),['自:M∀LICE＜C＞TB－１１','自:サイバース・ウィキッド','自:バックアップ＠イグニスター','自:ファイアウォール・ドラゴン・ダークフルード－ネオテンペスト']);
  const ug=await tops('3tnYxZAt');
  assert(!ug.some(t=>/UNDERGROUND|Dormouse/.test(t)));
  assert(ug.includes('自:M∀LICE＜Q＞WHITE BINDER'));
});

test('Astra instructions carry the engine-checked M∀LICE points',async()=>{
  const {maliceGuide}=await import('../astra.mjs');
  const text=maliceGuide();
  for(const k of ['カード名ごとに1ターン1度','うららで止まらない','ディセーブルム','リンク先に自分のLモンスター','ドットスケーパー（地）'])assert(text.includes(k),k);
});

test('saved M∀LICE routes (routes/malice-routes.json) replay to their stored final board',async()=>{
  const fs=await import('node:fs');const {board,hash}=await import('../scripts/route-harness.mjs');
  const routes=JSON.parse(fs.readFileSync(new URL('../routes/malice-routes.json',import.meta.url))).routes;
  assert(routes.length>=4);
  for(const r of routes){
    const g=await startLab({hand:r.hand,seed:r.seed});
    try{
      for(const s of r.steps){assert.equal(g.prompt.type,s.prompt,r.id);g.respond(0^g.first,g.revision,s.input,{snapshot:false});assert.equal(g.validationError,null,`${r.id} ${s.label}`);}
      assert.equal(hash(board(g)),r.finalHash,r.id);
    } finally {g.close();}
  }
});

test('revival limit: a HEARTS sent from the Extra Deck is not a GWC－06 target, a Link Summoned one is',()=>{
  const board=log=>({log,startHand:[],snapshot:()=>({players:[{lp:8000,hand:[],extra:[],banished:[],
    grave:[{code:C.hearts}],monsters:[{code:C.neo,position:1},null,null,null,null,null,null],
    spells:[{code:C.gwc,position:10},null,null,null,null,null,null,null]}]})});
  const gwc=g=>score(g).parts.find(p=>p[0]==='GWC－06')?.[1];
  assert.equal(gwc(board([])),0);
  assert.equal(gwc(board([{event:'summon',code:C.hearts}])),1);
});

test('link arrows: Accord in the right Extra Monster Zone points at main zones 3-5, Wicked (↓↘) in the right EMZ at main 4-5 and nothing from a main zone',()=>{
  assert.deepEqual(pointsTo(C.accord,6).sort(),[2,3,4]);
  assert.deepEqual(pointsTo(52698008,6).sort(),[3,4]);
  assert.deepEqual(pointsTo(52698008,1),[]);
});
