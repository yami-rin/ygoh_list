import test from 'node:test';
import assert from 'node:assert/strict';
import {OcgQueryFlags as Q} from 'ocgcore-wasm';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Original theme 連弾魔女 (custom/canon-witch.json, custom/scripts/c777005xx.lua).
const respondAs=(g,input)=>{g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});assert.equal(g.validationError,null);};
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
const x3=c=>[c,c,c];
const FORTE=77700501,PIANO=77700502,SONATA=77700503,CODA=77700504,IMPROMPTU=77700505,HALL=77700506,CONNECT=77700507,BARLINE=77700508;
const MAIN=[FORTE,PIANO,SONATA,CODA,IMPROMPTU,HALL,CONNECT,BARLINE].flatMap(x3);
const EXTRA=[77700509,77700510,77700511,77700512,77700513];
const FILLER=[89631139,89631139,89631139,12580477,12580477,83764718,83764718,44095762,44095762,89631139,89631139,89631139];
const BLUE_EYES=89631139,SWORDS=72302403,CYCLONE=5318639,RAIGEKI=12580477,ASH=14558127,VEILER=97268402;
const without=(list,remove)=>{const a=[...list];for(const c of remove)a.splice(a.indexOf(c),1);return a;};
const snap=g=>g.snapshot(0).players;
const codes=zone=>zone.filter(Boolean).map(c=>c.code);
const disabled=(g,uiPlayer,location,sequence)=>!!(g.lib.duelQuery(g.handle,{controller:uiPlayer^g.first,location,sequence,overlaySequence:0,flags:Q.STATUS}).status&1);

test('Canon Witch: 13 original cards are loaded with setcode 0x7c4',()=>{
  const theme=customCards.filter(c=>c.custom==='canon-witch.json');
  assert.equal(theme.length,13);
  assert(theme.every(c=>c.setcodes.includes(0x7c4)));
  assert.equal(theme.filter(c=>c.type&0x40).length,5);
  assert.equal(cards[77700509].name,'連弾魔女－フォルテ＆ピアノ');
});

test('Canon Witch: Sonata ② "この効果の発動後" locks the Extra Deck to Fusion Monsters even when the effect is negated (Effect Veiler)',async()=>{
  const PROXY=22862454;
  const g=await Duel.create([{main:without(MAIN,[SONATA]),extra:[PROXY]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SONATA),fx(BLUE_EYES,{location:4,sequence:0,position:1}),fx(VEILER,{team:1})]});
  try{
    pass(g);
    run(g,['召喚：連弾魔女－ソナタ','自分 モンスター 2','はい','発動：エフェクト・ヴェーラー','ソナタ',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[BLUE_EYES,SONATA].sort(),'Sonata ② was negated: nothing was Special Summoned');
    pass(g);
    assert(!g.prompt.choices.some(c=>c.label.startsWith('特殊召喚：プロキシー・ドラゴン')),'only Fusion Monsters from the Extra Deck: '+g.prompt.choices.map(c=>c.label).join(' / '));
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Canon Witch: Hall → Piano sets Connect, Sonata + Connect fill the field, contact Fusions draw with Hall and split again',async()=>{
  const hand=[SONATA,HALL];
  const g=await Duel.create([{main:without(MAIN,hand),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    ...hand.map(c=>fx(c)),fx(BLUE_EYES,{team:1,location:4,sequence:0,position:1}),fx(SWORDS,{team:1,location:8,sequence:0,position:1}),
    fx(ASH,{team:1}),fx(VEILER,{team:1})]});
  try{
    pass(g);
    // Hall ①: Piano from the Deck. Piano ②: Set Connect, which is activated the same turn.
    run(g,['効果発動：連弾魔女の音楽堂',pass,'はい','ピアノ','自分 モンスター 1','攻撃表示','はい',pass,'協調','自分 魔法・罠 1',pass,'効果発動：連弾魔女の協調',pass]);
    // Sonata ② (Coda) and Connect ② (a different name: Forte)
    run(g,['召喚：連弾魔女－ソナタ','自分 モンスター 2','発動：連弾魔女－ソナタ','発動：連弾魔女の協調',pass,'フォルテ','自分 モンスター 3','攻撃表示',pass,'コーダ','自分 モンスター 4','攻撃表示',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[FORTE,PIANO,SONATA,CODA]);
    assert.equal(snap(g)[1].monsters[0].attack,3000-4*300,'Connect ①: 4 names × 300');
    // Sonata & Coda: shuffle both from the field into the Deck. ① opponent's hand → Deck, Hall ③ draws 1.
    const deck=snap(g)[1].deckCount;
    run(g,['特殊召喚：連弾魔女－ソナタ＆コーダ','ソナタ','コーダ','自分 モンスター 2','攻撃表示','発動：連弾魔女－ソナタ＆コーダ','発動：連弾魔女の音楽堂',pass]);
    assert.equal(snap(g)[1].hand.filter(Boolean).length,1);
    assert.equal(snap(g)[1].deckCount,deck+1);
    assert.deepEqual(codes(snap(g)[0].hand),[CODA],'Hall drew 1');
    // Forte & Piano ①: negate Blue-Eyes and Swords of Revealing Light
    run(g,['特殊召喚：連弾魔女－フォルテ＆ピアノ','フォルテ','ピアノ','自分 モンスター 1','攻撃表示','はい',pass]);
    // Blue-Eyes is a Normal Monster (nothing to negate); Swords of Revealing Light is negated
    assert(disabled(g,1,8,0)&&!disabled(g,1,4,0),'opponent face-up effects are negated');
    // Forte & Piano ②: Tribute it, Forte and Piano come back from the Deck
    run(g,['効果発動：連弾魔女－フォルテ＆ピアノ',pass,'自分 モンスター 1','攻撃表示','自分 モンスター 3','攻撃表示',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[FORTE,PIANO,77700510].sort());
    assert(!g.prompt.choices.some(c=>c.label==='特殊召喚：連弾魔女－フォルテ＆ピアノ'),'Forte & Piano only once per turn');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Canon Witch: Barline negates Cyclone, Forte answers from the hand, Coda recycles, Impromptu returns at the End Phase, Hall protects from Raigeki',async()=>{
  const hand=[FORTE,IMPROMPTU];
  const g=await Duel.create([{main:without(MAIN,hand),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    ...hand.map(c=>fx(c)),fx(CODA,{location:4,sequence:0,position:1}),fx(BARLINE,{location:8,sequence:0,position:8}),fx(HALL,{location:8,sequence:5,position:1}),
    fx(PIANO,{location:16,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:0,position:1}),fx(CYCLONE,{team:1,location:8,sequence:0,position:8}),fx(CYCLONE,{team:1,location:8,sequence:1,position:8}),
    fx(RAIGEKI,{team:1,location:16,position:1})]});
  try{
    pass(g);
    // CL1 Coda ② / CL2 Cyclone → Barline / CL3 Barline / CL4 Cyclone → Barline / CL5 Forte ①
    run(g,['効果発動：連弾魔女－コーダ',['ピアノ','サンダー'],'発動：サイクロン','終止線','発動：連弾魔女の終止線','発動：サイクロン','終止線','発動：連弾魔女－フォルテ',pass,
      '自分 モンスター 2','攻撃表示',pass,'はい','コーダ','自分 モンスター 3','攻撃表示',pass,'はい','ピアノ',pass]);
    assert(g.log.some(e=>/CHAIN 2 無効/.test(e.text)),'Barline negated Cyclone');
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[FORTE,CODA,CODA].sort());
    assert.deepEqual(codes(snap(g)[0].hand).sort(),[PIANO,IMPROMPTU],'Coda added Piano');
    assert.equal(snap(g)[1].deckCount,13,'Raigeki went back to the Deck');
    // Impromptu: Sonata from the Deck. Forte ② destroys Blue-Eyes.
    run(g,['効果発動：連弾魔女の即興曲','自分 魔法・罠 1',pass,'ソナタ','自分 モンスター 4','攻撃表示','いいえ',pass,'効果発動：連弾魔女－フォルテ',pass,'青眼',pass]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,0);
    run(g,['ターンを終了',pass]);
    assert(codes(snap(g)[0].hand).includes(SONATA),'Sonata returned to the hand');
    assert(!codes(snap(g)[0].monsters).includes(SONATA));
    // Opponent's turn: Raigeki (drawn back) cannot destroy Canon Witch monsters under Hall ②
    run(g,['効果発動：サンダー・ボルト','自分 魔法・罠 1',pass]);
    assert.equal(snap(g)[0].monsters.filter(Boolean).length,3);
    assert(codes(snap(g)[1].grave).includes(RAIGEKI),'Raigeki resolved');
  }finally{g.close();}
});

const FUSIONS={77700509:[FORTE,PIANO],77700510:[SONATA,CODA],77700511:[FORTE,SONATA],77700512:[PIANO,CODA],77700513:[FORTE,CODA]};
for(const [code,mats] of Object.entries(FUSIONS).map(([c,m])=>[+c,m])){
  test(`Canon Witch: ${cards[code].name} is contact-summoned from the hand, its ① resolves and ② splits it into its materials`,async()=>{
    const g=await Duel.create([{main:without(MAIN,mats),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
      ...mats.map(c=>fx(c)),fx(BLUE_EYES,{team:1,location:4,sequence:0,position:1}),fx(SWORDS,{team:1,location:8,sequence:0,position:1}),
      fx(ASH,{team:1}),fx(VEILER,{team:1})]});
    try{
      pass(g);
      run(g,[`特殊召喚：${cards[code].name}`,cards[mats[0]].name,cards[mats[1]].name,'自分 モンスター 1','攻撃表示','はい',pass]);
      if(code===77700511)run(g,[['青眼','護封剣'],pass]);
      if(code===77700512)run(g,['終止線','自分 魔法・罠 1',pass]);
      const [own,opp]=snap(g);
      assert.deepEqual(codes(own.monsters),[code]);
      assert.equal(own.hand.filter(Boolean).length,0,'materials went back to the Deck');
      if(code===77700509)assert(disabled(g,1,8,0));
      if(code===77700510)assert.equal(opp.hand.filter(Boolean).length,1);
      if(code===77700511)assert.equal(opp.monsters.filter(Boolean).length+opp.spells.filter(Boolean).length,0);
      if(code===77700512)assert.deepEqual(codes(own.spells),[BARLINE]);
      if(code===77700513)assert(g.log.some(e=>/CHAIN 1 解決/.test(e.text)));
      run(g,[`効果発動：${cards[code].name}`,pass,'自分 モンスター 1','攻撃表示','自分 モンスター 2','攻撃表示',pass]);
      assert.deepEqual(codes(snap(g)[0].monsters).sort(),[...mats].sort());
      assert.deepEqual(g.errors,[]);
    }finally{g.close();}
  });
}

test('Canon Witch: Forte & Coda attacks twice in the Battle Phase of the turn it is summoned',async()=>{
  // first:1 → the opponent takes turn 1; our cards use core team 1
  const g=await Duel.create([{main:without(MAIN,[FORTE,CODA]),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,first:1,fixtures:[
    fx(FORTE,{team:1}),fx(CODA,{team:1}),fx(ASH,{team:0,location:4,sequence:0,position:1})]});
  try{
    run(g,[pass,'ターンを終了',pass,'特殊召喚：連弾魔女－フォルテ＆コーダ','フォルテ','コーダ','自分 モンスター 1','攻撃表示','はい',pass,'バトルフェイズへ',pass]);
    run(g,['攻撃：連弾魔女－フォルテ＆コーダ','灰流',pass]);
    run(g,['攻撃：連弾魔女－フォルテ＆コーダ',pass]);
    assert.equal(g.lp[1^g.first],8000-3000-3000);
  }finally{g.close();}
});

test('Canon Witch: Coda ② may add every targeted "Canon Witch" card to the hand',async()=>{
  const g=await Duel.create([{main:MAIN,extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CODA,{location:4,sequence:0,position:1}),fx(PIANO,{location:16,position:1}),fx(SONATA,{location:16,position:1})]});
  try{
    pass(g);
    run(g,['効果発動：連弾魔女－コーダ',['ピアノ','ソナタ'],pass,'はい',['ピアノ','ソナタ'],pass]);
    assert.deepEqual(codes(snap(g)[0].hand).sort(),[PIANO,SONATA].sort());
    assert.equal(snap(g)[0].grave.filter(Boolean).length,0);
  }finally{g.close();}
});
