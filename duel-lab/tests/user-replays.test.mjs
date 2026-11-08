import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startDeckRoute,deckHash,summonGroups,sameOrderish,replayPlan} from '../scripts/import-replays.mjs';
import {respond,board,hash} from '../scripts/route-harness.mjs';
import {pointless,dedupeCopies} from '../scripts/prune-rules.mjs';

const deck=JSON.parse(fs.readFileSync(new URL('../presets/user-malice.json',import.meta.url)));
const routesFile=new URL('../routes/user-replays.json',import.meta.url);
const source=JSON.parse(fs.readFileSync(new URL('../routes/user-replays.source.json',import.meta.url)));

test('user deck is 41 main and 15 extra cards',()=>{
  assert.equal(deck.main.length,41);assert.equal(deck.extra.length,15);
});

test('reproduced replays replay to their stored final board',async()=>{
  const saved=JSON.parse(fs.readFileSync(routesFile));
  assert.equal(saved.presetHash,deckHash(deck));
  assert(saved.routes.length>=1);
  for(const route of saved.routes){
    const g=await startDeckRoute(route.hand,{seed:route.seed,deck});
    try{
      for(const step of route.steps){
        assert.equal(g.prompt.type,step.prompt);
        assert.equal(hash({pending:g.pending,board:board(g)}),step.before,`${route.title}: state drift`);
        respond(g,step.input);
      }
      assert.equal(hash(board(g)),route.finalHash,`${route.title}: final board drift`);
    }finally{g.close();}
  }
});

test('summons from one resolution may come in either order, separate effects may not',()=>{
  const log=[{event:'summon',text:'YOU：A',code:1},{text:'CHAIN 1：X'},{event:'summon',text:'YOU：B',code:2},{event:'summon',text:'YOU：C',code:3}];
  assert.deepEqual(summonGroups(log),[[1],[2,3]]);
  assert.equal(sameOrderish([[1],[3,2]],[1,2,3]),true);
  assert.equal(sameOrderish([[2],[1]],[1,2,3]),false);
});

test('replay plan records link materials and fills one-card starters',()=>{
  const plan=replayPlan(source.replays.find(r=>r.id==='cEErE6ce'));
  assert.equal(plan.hand.length,4);
  const transcode=plan.summons.find(s=>s.code===46947713);
  assert.deepEqual(transcode.materials.sort(),[30342076,52698008].sort());
});

test('prune rules drop material unselect and dead sets',()=>{
  const prompt={type:'SELECT_UNSELECT_CARD',choices:[{id:0,label:'選択：A'},{id:1,label:'解除：B'},{id:2,label:'選択を確定'}]};
  assert.deepEqual([0,1,2].filter(id=>!pointless(prompt,{action:id})),[0,2]);
  const idle={type:'SELECT_IDLECMD',choices:[{id:0,label:'魔法・罠セット：霆王の閃光',card:{code:6325660}},{id:1,label:'ターンを終了'},{id:2,label:'効果発動：アコード・トーカー＠イグニスター',card:{code:39138610}}]};
  assert.equal(pointless(idle,{action:0},{summonsLeft:2}),true);
  assert.equal(pointless(idle,{action:1},{summonsLeft:2}),true);
  assert.equal(pointless(idle,{action:1},{summonsLeft:0}),false);
  // Accode Talker ① summons by itself, so it is never pruned as a summon lock.
  assert.equal(pointless(idle,{action:2},{summonsLeft:1}),false);
  const pick={type:'SELECT_CARD',cards:[{code:5,location:1,controller:0},{code:5,location:1,controller:0},{code:6,location:1,controller:0}]};
  assert.equal(dedupeCopies(pick,[{selection:[0]},{selection:[1]},{selection:[2]}]).length,2);
});
