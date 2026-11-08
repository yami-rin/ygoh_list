import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Original theme 業火葬 (custom/gokasou.json, custom/scripts/c777003xx.lua).
const respondAs=(g,input)=>{g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});assert.equal(g.validationError,null);};
// text: a label fragment, or an array of fragments for a multi-card selection
const pick=(g,text)=>{
  const p=g.prompt;
  if(p.mode==='single'){const c=p.choices.find(c=>c.label.includes(text));assert(c,`${text} | ${p.choices.map(c=>c.label).join(' / ')}`);respondAs(g,{action:c.id});return;}
  const selection=[];
  for(const t of [text].flat()){const i=p.cards.findIndex((c,j)=>c.label.includes(t)&&!selection.includes(j));assert(i>=0,`${t} | ${p.cards.map(c=>c.label).join(' / ')}`);selection.push(i);}
  respondAs(g,{selection});
};
const pass=g=>{while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない'))pick(g,'発動しない');};
const run=(g,steps)=>{for(const s of steps)s===pass?pass(g):pick(g,s);};
const fx=(code,{team=0,location=2,position=8,sequence=0}={})=>({code,team,controller:team,location,position,sequence});
const grave=(code,team=1)=>fx(code,{team,location:16,position:1});
const x3=c=>[c,c,c];
const MAIN=[77700301,77700302,77700303,77700304,77700305,77700306,77700307,77700308].flatMap(x3);
// opponent: Blue-Eyes / Raigeki / Monster Reborn / Mirror Force
const FILLER=[89631139,89631139,89631139,12580477,12580477,83764718,83764718,44095762,44095762,89631139,89631139,89631139];
const CYCLONE=5318639,CALLED=24224830,IMPERMANENCE=10045474,BLUE_EYES=89631139,RAIGEKI=12580477,REBORN=83764718,MIRROR=44095762,TORRENTIAL=53582587,ASH=14558127,VEILER=97268402;
const snap=g=>g.snapshot(0).players;
const count=(zone,code)=>zone.filter(c=>c?.code===code).length;

test('Gokasou: 11 original cards are loaded with setcode 0x7c2',()=>{
  const theme=customCards.filter(c=>c.custom==='gokasou.json');
  assert.equal(theme.length,11);
  assert(theme.every(c=>c.setcodes.includes(0x7c2)));
  assert.equal(cards[77700305].name,'業火葬場－『煉獄』');
  assert.equal(cards[77700311].link_marker,8|32|1|4);
});

test('Gokasou: Apprentice → Purgatory → Admission, banishing chains into Scatterer/Bearer, Soul Stoker brings out Remains, Cremator burns',async()=>{
  const hand=[77700304,77700301,77700302];
  const own={main:[...MAIN],extra:[77700309,77700309,77700310,77700311]};
  for(const c of hand)own.main.splice(own.main.indexOf(c),1);
  const g=await Duel.create([own,{main:FILLER,extra:[]}],{seed:1,fixtures:[...hand.map(c=>fx(c)),...[CYCLONE,CALLED,IMPERMANENCE,BLUE_EYES,RAIGEKI].map(c=>grave(c))]});
  try{
    pass(g);
    // Apprentice ①: discard, add Purgatory. Purgatory ①: add Admission. Admission ①: mill 3, add Bonfire.
    run(g,['効果発動：業火葬－点火する見習い',pass,'煉獄','手札に加える',pass,'効果発動：業火葬場',pass,'はい','受入',pass,
      '効果発動：業火葬の受入','自分 魔法・罠 1',pass,'3','焚き火',pass]);
    assert.equal(snap(g)[1].grave.filter(Boolean).length,8,'Admission milled 3');
    // Guide ① searches Bearer, Admission ② mills 2 more
    run(g,['召喚：業火葬－送り火の導き手','自分 モンスター 3','発動：業火葬－送り火の導き手','発動：業火葬の受入',pass,'2','霊柩',pass]);
    assert.equal(count(snap(g)[0].hand,77700303),1);
    // Guide ②: banish Cyclone → Purgatory 300, Apprentice ② returns to hand, Scatterer ① comes out of the hand
    run(g,['効果発動：業火葬－送り火の導き手','サイクロン',pass]);
    assert.equal(g.lp[1],7700);
    assert.equal(snap(g)[0].monsters.find(c=>c?.code===77700301).attack,2200);
    run(g,['はい','発動：業火葬－灰燼の撒き手',pass,'自分 モンスター 2','攻撃表示',pass]);
    assert.equal(count(snap(g)[0].hand,77700304),1,'Apprentice is back in the hand');
    // Scatterer ②: banish Called by the Grave, Special Summon Bearer from the Deck, 2 banished × 200 (+300 Purgatory)
    run(g,['効果発動：業火葬－灰燼の撒き手','墓穴',pass,'霊柩','自分 モンスター 4','攻撃表示',pass]);
    assert.equal(g.lp[1],7000);
    // Soul Stoker (2 FIRE), ①: banish 4 → Link 4 Remains from the Extra Deck; Bearer ② revives from the GY
    run(g,['特殊召喚：業火葬－魂の炉くべ','選択：業火葬－灰燼の撒き手','選択：業火葬－霊柩の担ぎ手','自分 モンスター EX 1',pass,
      '効果発動：業火葬－魂の炉くべ','4',['青眼','青眼','青眼','青眼'],pass,'骸ノ業火葬','自分 モンスター 1','はい',pass,'自分 モンスター 2','攻撃表示',pass]);
    assert(g.log.some(e=>/YOU：骸ノ業火葬 を特殊召喚/.test(e.text)));
    assert(snap(g)[0].monsters.some(c=>c?.code===77700303),'Bearer revived');
    // Inferno Cremator (Guide + Soul Stoker): banish 4 Spells/Traps → 1600 (+300)
    run(g,['特殊召喚：業火葬神','選択：業火葬－送り火の導き手','選択：業火葬－魂の炉くべ','選択を確定','自分 モンスター EX 1',pass]);
    assert.equal(g.lp[1],4800);
    assert.equal(snap(g)[1].grave.filter(Boolean).length,0);
    // Soul Stoker ②: banish 2 FIRE from the GY, revive. Apprentice ① with Purgatory on the field: Special Summon instead
    run(g,['効果発動：業火葬－魂の炉くべ',['導き手','撒き手'],pass,'自分 モンスター 3',pass,
      '効果発動：業火葬－点火する見習い',pass,'はい','霊柩','自分 モンスター 4','攻撃表示',pass]);
    const field=snap(g)[0].monsters;
    assert(field.some(c=>c?.code===77700309)&&count(field,77700303)===2);
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Gokasou: Coffin Bearer destroys, Remains banishes, Forced Execution clears the GY with a Link Monster',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(77700303,{location:4,sequence:0,position:1}),fx(77700301,{location:4,sequence:1,position:1}),fx(77700311,{location:4,sequence:5,position:1}),
    fx(77700308,{location:8,sequence:0,position:8}),
    fx(BLUE_EYES,{team:1,location:4,sequence:0,position:1}),fx(MIRROR,{team:1,location:8,sequence:0,position:8}),
    ...[CYCLONE,CALLED,IMPERMANENCE,RAIGEKI].map(c=>grave(c))]});
  try{
    pass(g);
    run(g,['効果発動：業火葬－霊柩の担ぎ手','選択：業火葬－送り火の導き手','青眼',pass,'はい','サイクロン',pass]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,0);
    assert.equal(count(snap(g)[0].grave,77700301),1,'Guide was Tributed');
    run(g,['効果発動：骸ノ業火葬','墓穴',pass]);
    assert.equal(snap(g)[1].banished.filter(Boolean).length,2);
    run(g,['効果発動：業火葬－強制執行',pass,'ミラーフォース']);
    const opp=snap(g)[1];
    assert.equal(opp.grave.filter(Boolean).length,0,'whole GY banished');
    assert.equal(opp.banished.filter(Boolean).length,6);
    assert.equal(opp.spells.filter(Boolean).length,0);
  }finally{g.close();}
});

test('Gokasou: Inferno Cremator negates a Trap by milling, Purgatory burns the banish',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(77700310,{location:4,sequence:5,position:1}),fx(77700302),fx(77700305,{location:8,sequence:5,position:1}),
    fx(TORRENTIAL,{team:1,location:8,sequence:0,position:8}),...[CYCLONE,CALLED,IMPERMANENCE].map(c=>grave(c))]});
  try{
    pass(g);
    run(g,['召喚：業火葬－灰燼の撒き手','自分 モンスター 1','発動しない','発動：激流葬','発動：業火葬神',pass,'はい','激流葬']);
    assert(g.log.some(e=>/CHAIN 1 無効/.test(e.text)));
    assert.equal(snap(g)[0].monsters.filter(Boolean).length,2,'Torrential Tribute was negated');
    assert.equal(count(snap(g)[1].banished,TORRENTIAL),1);
    assert.equal(g.lp[1],7700);
  }finally{g.close();}
});

test('Gokasou: Purgatory ③ banishes 2 cards instead of the destruction',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(77700301,{location:4,sequence:0,position:1}),fx(77700302),fx(77700305,{location:8,sequence:5,position:1}),
    fx(TORRENTIAL,{team:1,location:8,sequence:0,position:8}),...[CYCLONE,CALLED,IMPERMANENCE].map(c=>grave(c))]});
  try{
    pass(g);
    run(g,['召喚：業火葬－灰燼の撒き手','自分 モンスター 2','発動しない','発動：激流葬',pass,'はい',['サイクロン','墓穴']]);
    assert.equal(snap(g)[0].monsters.filter(Boolean).length,2,'both Gokasou monsters stayed');
    assert.equal(snap(g)[1].banished.filter(Boolean).length,2);
    assert.equal(g.lp[1],7700);
  }finally{g.close();}
});

test('Gokasou: Purifying Bonfire burns and negates Ash Blossom this turn; its ② draws and locks the name; Admission ② recovers a Spell/Trap',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(77700306),fx(77700306),fx(77700301),fx(77700307,{location:8,sequence:0,position:1}),grave(77700308,0),
    fx(ASH,{team:1}),...[ASH,CYCLONE,CALLED].map(c=>grave(c))]});
  try{
    pass(g);
    run(g,['効果発動：業火葬－浄化の焚き火','自分 魔法・罠 2',['灰流','サイクロン','墓穴'],pass]);
    assert.equal(g.lp[1],7100);
    // Ash Blossom from the hand shares a banished name: its activation is negated
    run(g,['召喚：業火葬－送り火の導き手','自分 モンスター 3','発動：業火葬－送り火の導き手','発動：業火葬の受入','発動：灰流うらら',pass,'3','強制執行','霊柩',pass]);
    assert(g.log.some(e=>/CHAIN 3 無効/.test(e.text)));
    const own=snap(g)[0];
    assert.equal(count(own.hand,77700303),1,'Guide search resolved');
    assert.equal(count(own.hand,77700308),1,'Admission ② added Forced Execution from the GY');
    run(g,['効果発動：業火葬－浄化の焚き火 / 除外して１枚ドロー',pass]);
    assert.equal(snap(g)[0].hand.filter(Boolean).length,4);
    assert(snap(g)[1].grave.some(Boolean),'targets exist in the opponent GY');
    assert(!g.prompt.choices.some(c=>c.label.startsWith('効果発動：業火葬－浄化の焚き火')),'Bonfire can no longer be activated');
  }finally{g.close();}
});

test('Gokasou: Remains survives battle, banishes on attack and attacks monsters once per 3 banished cards',async()=>{
  // first:1 → the opponent takes turn 1, so our turn 2 has a Battle Phase. Our cards use core team 1.
  const g=await Duel.create([{main:MAIN,extra:[]},{main:FILLER,extra:[]}],{seed:1,first:1,fixtures:[
    fx(77700311,{team:1,location:4,sequence:5,position:1}),
    fx(BLUE_EYES,{team:0,location:4,sequence:0,position:1}),...[ASH,VEILER,ASH].map((c,i)=>fx(c,{team:0,location:4,sequence:i+1,position:4})),
    ...[CYCLONE,CALLED,IMPERMANENCE].map(c=>grave(c,0)),
    ...[RAIGEKI,RAIGEKI,REBORN,REBORN,MIRROR,MIRROR].map(c=>fx(c,{team:0,location:32,position:1}))]});
  try{
    run(g,[pass,'ターンを終了',pass,'バトルフェイズへ',pass]);
    // 6 banished → 2 attacks on monsters. Blue-Eyes (3000) is destroyed, Remains is not.
    run(g,['攻撃：骸ノ業火葬','青眼','いいえ',pass]);
    assert(snap(g)[0].monsters.some(c=>c?.code===77700311),'not destroyed by battle');
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1);
    // ③ banishes 3 → 9 banished → 3 attacks, ATK 3600
    run(g,['攻撃：骸ノ業火葬','灰流','はい',pass,['サイクロン','墓穴','無限泡影'],pass]);
    assert.equal(snap(g)[0].monsters.find(c=>c?.code===77700311).attack,3600);
    run(g,['攻撃：骸ノ業火葬','ヴェーラー','いいえ',pass]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,1);
    assert(!g.prompt.choices.some(c=>c.label.startsWith('攻撃：')),'no 4th attack');
  }finally{g.close();}
});
