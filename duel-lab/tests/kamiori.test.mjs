import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Original theme 神折 (custom/kamiori.json, custom/scripts/c777006xx.lua).
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
const ORIHIME=77700601,HITOGATA=77700602,RENZURU=77700603,KABUTO=77700604,KAGURA=77700605,HOUNOU=77700606,SHIMENAWA=77700607,KISHA=77700608;
const MIHASHIRA=77700609,KOMANU=77700610,IWATO=77700611;
const MAIN=[ORIHIME,HITOGATA,RENZURU,KABUTO,KAGURA,HOUNOU,SHIMENAWA,KISHA].flatMap(x3);
const EXTRA=[MIHASHIRA,KOMANU,IWATO];
const FILLER=[89631139,89631139,89631139,12580477,12580477,83764718,83764718,44095762,44095762,89631139,89631139,89631139];
const BLUE_EYES=89631139,SWORDS=72302403,CYCLONE=5318639,RAIGEKI=12580477,MIRROR=44095762,VEILER=97268402,TRICKY=14778250;
const without=(list,remove)=>{const a=[...list];for(const c of remove)a.splice(a.indexOf(c),1);return a;};
const snap=g=>g.snapshot(0).players;
const codes=zone=>zone.filter(Boolean).map(c=>c.code);
const count=(zone,code)=>zone.filter(c=>c?.code===code).length;
const offered=(g,label)=>g.prompt.choices.some(c=>c.label.startsWith(label));

test('Kamiori: 11 original cards are loaded with setcode 0x7c5 (LIGHT Fairy, provisional Link Arrows)',()=>{
  const theme=customCards.filter(c=>c.custom==='kamiori.json');
  assert.equal(theme.length,11);
  assert(theme.every(c=>c.setcodes.includes(0x7c5)));
  assert(theme.filter(c=>c.type&1).every(c=>c.attribute===0x10&&c.race==='4'));
  assert.equal(cards[ORIHIME].name,'神折の巫女－オリヒメ');
  // Link Arrows are not in the original text: Mihashira ↓, Komanu ↙↘, Iwatogakure ↙↓↘
  assert.deepEqual([MIHASHIRA,KOMANU,IWATO].map(c=>[cards[c].level,cards[c].link_marker]),[[1,2],[2,8|32],[3,1|2|4]]);
});

test('Kamiori: Orihime ① "この効果の発動後" locks to Fairies even when the effect is negated (Effect Veiler)',async()=>{
  const g=await Duel.create([{main:without(MAIN,[ORIHIME]),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(ORIHIME),fx(TRICKY),fx(BLUE_EYES),fx(VEILER,{team:1})]});
  try{
    pass(g);
    assert(offered(g,'特殊召喚：THE トリッキー'),'a non-Fairy can be Special Summoned before Orihime ①');
    run(g,['召喚：神折の巫女','自分 モンスター 3','はい','発動：エフェクト・ヴェーラー','オリヒメ',pass]);
    assert.deepEqual(codes(snap(g)[0].spells),[],'Orihime ① was negated: nothing was placed');
    assert(!offered(g,'特殊召喚：THE トリッキー'),'the lock still applies after the effect was activated');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: Orihime places 2 cards and locks to Fairies, the Deck and Links chain into Iwatogakure, Alms destroys and revives',async()=>{
  const hand=[ORIHIME,RENZURU,TRICKY];
  const g=await Duel.create([{main:without(MAIN,[ORIHIME,RENZURU]),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    ...hand.map(c=>fx(c)),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),
    fx(SWORDS,{team:1,location:8,sequence:1,position:1}),fx(MIRROR,{team:1,location:8,sequence:2,position:8})]});
  try{
    pass(g);
    assert(offered(g,'特殊召喚：THE トリッキー'),'a non-Fairy can be Special Summoned before Orihime ①');
    // Orihime ①: Alms (Continuous Trap) + Kagura (Continuous Spell) from the Deck, face-up
    run(g,['召喚：神折の巫女','自分 モンスター 3','はい',pass,'喜捨','カグラ','自分 魔法・罠 1','自分 魔法・罠 2',pass]);
    assert.deepEqual(codes(snap(g)[0].spells).sort(),[KAGURA,KISHA]);
    assert.equal(snap(g)[0].monsters.find(c=>c?.code===ORIHIME).attack,1800+300,'Kagura ①: 1 Continuous Spell');
    assert(!offered(g,'特殊召喚：THE トリッキー'),'only Fairies after Orihime ①');
    // Orihime ②: send Kagura, Hitogata from the Deck. Hitogata ② adds Kabuto, Kagura ② draws.
    run(g,['効果発動：神折の巫女','カグラ',pass,'ヒトガタ','自分 モンスター 2','攻撃表示','発動：神折の形代－ヒトガタ','発動：神折の演舞台－カグラ',pass,'カブト',pass]);
    assert(codes(snap(g)[0].hand).includes(KABUTO));
    assert.equal(snap(g)[0].hand.filter(Boolean).length,4,'Renzuru, Tricky, Kabuto and 1 draw');
    // Mihashira (Orihime): ① places Offering. Kabuto ① comes out because a "Kamiori" Link Monster is on the field.
    run(g,['特殊召喚：神折神－ミハシラ','選択：神折の巫女','自分 モンスター EX 1','はい',pass,'奉納','自分 魔法・罠 3',pass]);
    assert(codes(snap(g)[0].spells).includes(HOUNOU));
    run(g,['特殊召喚：神折の兜','自分 モンスター 3','攻撃表示',pass]);
    assert(!offered(g,'特殊召喚：神折の兜'),'Kabuto ① once per turn');
    // Offering ①: send Hitogata, Renzuru from the Deck
    run(g,['効果発動：神折の奉納','ヒトガタ',pass,'レンヅル','自分 モンスター 4','攻撃表示',pass]);
    // Iwatogakure (Mihashira + Kabuto + Renzuru): Kabuto ② revives Hitogata negated, Renzuru ② banishes Mirror Force face-down
    run(g,['特殊召喚：神折大神','選択：神折神－ミハシラ','選択：神折の兜','選択：神折の霊鳥','自分 モンスター EX 2',
      '発動：神折の兜','ヒトガタ','発動：神折の霊鳥',pass,'ミラーフォース','自分 モンスター 4','攻撃表示',pass]);
    assert(g.log.some(e=>/YOU：神折大神－イワトガクレ を特殊召喚/.test(e.text)));
    assert.equal(snap(g)[1].banished.filter(Boolean).length,1,'Mirror Force banished');
    assert(snap(g)[1].banished.filter(Boolean).every(c=>c.hidden),'face-down');
    assert(codes(snap(g)[0].monsters).includes(HITOGATA),'Hitogata revived');
    // Alms ①: send Offering (② draws), destroy Blue-Eyes, Iwatogakure is a "Kamiori" Link → revive Orihime
    run(g,['効果発動：神折の喜捨','奉納',pass,'青眼','はい','オリヒメ','自分 モンスター 3','攻撃表示','はい',pass]);
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1);
    assert(codes(snap(g)[0].monsters).includes(ORIHIME),'Alms revived Orihime');
    // Iwatogakure ②: send Hitogata, send Swords of Revealing Light to the GY
    const hand0=snap(g)[0].hand.filter(Boolean).length;
    run(g,['効果発動：神折大神','ヒトガタ',pass,'護封剣']);
    assert.equal(count(snap(g)[1].grave,SWORDS),1);
    assert.equal(snap(g)[0].hand.filter(Boolean).length,hand0);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[ORIHIME,IWATO]);
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: Iwatogakure ② sends itself, ③ brings Mihashira out as a Link Summon, Mihashira ② moves and bounces the column',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[MIHASHIRA,KOMANU]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(IWATO,{location:4,sequence:5,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(VEILER,{team:1,location:4,sequence:3,position:1}),
    fx(SWORDS,{team:1,location:8,sequence:3,position:1}),fx(CYCLONE,{team:1,location:8,sequence:1,position:8})]});
  try{
    pass(g);
    run(g,['効果発動：神折大神','イワトガクレ',pass,'青眼','はい',pass,'ミハシラ','自分 モンスター EX 1']);
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1);
    // treated as a Link Summon: Mihashira ① triggers
    run(g,['はい',pass,'カグラ','自分 魔法・罠 1',pass]);
    assert.deepEqual(codes(snap(g)[0].spells),[KAGURA]);
    // ②: send Kagura, move to Main Monster Zone 2 → the opponent's Veiler and Swords in that column return to the hand
    run(g,['効果発動：神折神－ミハシラ','カグラ',pass,'自分 モンスター 2','はい','はい',pass]);
    const [own,opp]=snap(g);
    assert.equal(own.monsters[1]?.code,MIHASHIRA);
    assert.equal(opp.hand.filter(Boolean).length,2,'Veiler and Swords bounced');
    assert.equal(opp.monsters.filter(Boolean).length,0);
    assert.equal(opp.spells.filter(Boolean).length,1,'Cyclone in another column stays');
    assert.equal(own.hand.filter(Boolean).length,1,'Kagura ② drew');
    assert(!offered(g,'効果発動：神折神－ミハシラ'),'Mihashira ② once per turn');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: on the opponent\'s turn Komanu ② revives to its Link zone, ① makes the attacker send a card, Renzuru ① answers from the hand',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[MIHASHIRA,IWATO]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(KOMANU,{location:4,sequence:2,position:1}),fx(KAGURA,{location:8,sequence:0,position:1}),fx(HITOGATA,{location:16,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(SWORDS,{team:1,location:8,sequence:1,position:1}),fx(CYCLONE,{team:1,location:8,sequence:2,position:1})]});
  try{
    run(g,[pass,'ターンを終了',pass]);
    assert(!g.prompt.choices.some(c=>c.label.includes('コマヌ')),'not on your own turn');
    // opponent moves to the Battle Phase: Komanu ② sends Kagura, Hitogata to a zone Komanu points to (← → from Main Monster Zone 3 = zones 2 and 4)
    run(g,['バトルフェイズへ','発動：神折神－コマヌ','カグラ',pass,'ヒトガタ']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['自分 モンスター 2','自分 モンスター 4'],'only the linked zones');
    run(g,['自分 モンスター 2','守備表示','発動：神折の形代','発動：神折の演舞台',pass,'レンヅル',pass]);
    assert.equal(snap(g)[0].monsters[1]?.code,HITOGATA);
    // ①: Blue-Eyes may attack only after its controller sends 1 of their own cards to the GY
    run(g,['バトルフェイズへ',pass,'攻撃：青眼']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label).sort(),['サイクロン','光の護封剣','青眼の白龍'].sort(),'the attacker pays with its own cards');
    run(g,['サイクロン','コマヌ','発動：神折の霊鳥',pass,'自分 モンスター 1','守備表示','カブト',pass,'いいえ']);
    assert.equal(count(snap(g)[1].grave,CYCLONE),1);
    assert(codes(snap(g)[0].monsters).includes(RENZURU),'Renzuru ① Special Summoned itself');
    assert(codes(snap(g)[0].hand).includes(KABUTO),'and added Kabuto');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: Shimenawa replaces the destruction by Alms and draws, Kagura counts Continuous Spells on the field and in the GY, no revive without a Link',async()=>{
  const g=await Duel.create([{main:MAIN,extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(HITOGATA,{location:4,sequence:0,position:1}),fx(KABUTO),
    fx(KAGURA,{location:8,sequence:0,position:1}),fx(SHIMENAWA,{location:8,sequence:1,position:1}),fx(KISHA,{location:8,sequence:2,position:1}),
    fx(HOUNOU,{location:16,position:1}),fx(ORIHIME,{location:16,position:1})]});
  try{
    pass(g);
    const hito=()=>snap(g)[0].monsters.find(c=>c?.code===HITOGATA);
    assert.equal(hito().attack,1600+3*300,'Kagura + Shimenawa on the field, Offering in the GY');
    assert.equal(hito().defense,1600+3*300);
    assert(!offered(g,'特殊召喚：神折の兜'),'Kabuto ① needs a "Kamiori" Link Monster');
    run(g,['効果発動：神折の喜捨','カグラ',pass,'ヒトガタ','はい']);
    assert(!g.prompt.title?.includes('特殊召喚しますか'),'no revive offer without a "Kamiori" Link Monster');
    run(g,['発動：神折の演舞台','発動：神折の結界',pass]);
    const own=snap(g)[0];
    assert.equal(hito().attack,1600,'Kagura left the field');
    assert(codes(own.grave).includes(SHIMENAWA)&&codes(own.grave).includes(KAGURA));
    assert.equal(own.hand.filter(Boolean).length,3,'Kabuto + 2 draws');
    assert.equal(count(own.grave,ORIHIME),1,'Orihime was not revived');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: Renzuru ① searches, Hitogata ① sends Renzuru, Renzuru ② banishes face-down',async()=>{
  const hand=[RENZURU,HITOGATA];
  const g=await Duel.create([{main:without(MAIN,hand),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    ...hand.map(c=>fx(c)),fx(SWORDS,{team:1,location:8,sequence:1,position:1})]});
  try{
    pass(g);
    run(g,['効果発動：神折の霊鳥',pass,'自分 モンスター 1','攻撃表示','カブト',pass]);
    run(g,['効果発動：神折の形代','レンヅル',pass,'自分 モンスター 2','攻撃表示','発動：神折の形代','発動：神折の霊鳥',pass,'護封剣','オリヒメ',pass]);
    const [own,opp]=snap(g);
    assert.equal(opp.spells.filter(Boolean).length,0);
    assert.equal(opp.banished.filter(Boolean).length,1,'Swords banished');
    assert(opp.banished.filter(Boolean).every(c=>c.hidden),'face-down');
    assert.deepEqual(codes(own.hand).sort(),[ORIHIME,KABUTO].sort());
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Kamiori: Iwatogakure ① protects it from the opponent\'s effects only while it points to a monster',async()=>{
  // first:1 → the opponent takes turn 1 with Raigeki; our cards use core team 1
  const g=await Duel.create([{main:MAIN,extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,first:1,fixtures:[
    fx(IWATO,{team:1,location:4,sequence:5,position:1}),fx(HITOGATA,{team:1,location:4,sequence:1,position:1}),
    fx(IWATO,{team:1,location:4,sequence:4,position:1}),fx(RAIGEKI,{team:0})]});
  try{
    run(g,[pass,'効果発動：サンダー・ボルト','自分 魔法・罠 1']);
    // decline the responses to Raigeki until the triggers of the destroyed cards are offered
    while(g.prompt.type==='SELECT_CHAIN'&&!g.prompt.choices.some(c=>c.label.startsWith('発動：神折の形代')))pick(g,'発動しない');
    assert(g.prompt.choices.some(c=>c.label.startsWith('発動：神折大神')),'Iwatogakure ③ (destroyed copy) is offered');
    const own=snap(g)[0];
    // the Extra Monster Zone copy points to Hitogata; the Main Monster Zone copy points below the field
    assert.deepEqual(codes(own.monsters),[IWATO]);
    assert.equal(count(own.grave,IWATO),1);
    assert(codes(own.grave).includes(HITOGATA));
    // Hitogata ② (sent from the field to the GY) searches
    run(g,['発動：神折の形代',pass,'レンヅル',pass]);
    assert(codes(snap(g)[0].hand).includes(RENZURU));
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});
