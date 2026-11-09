import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Original theme 呪われた / 希望 (custom/cursed.json, custom/scripts/c777008xx.lua).
const respondAs=(g,input)=>{g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});assert.equal(g.validationError,null);};
const pick=(g,text)=>{
  const p=g.prompt;
  if(p.mode==='single'){const c=p.choices.find(c=>c.label.includes(text));assert(c,`${text} | ${p.choices.map(c=>c.label).join(' / ')}`);respondAs(g,{action:c.id});return;}
  const selection=[];
  for(const t of [text].flat()){const i=p.cards.findIndex((c,j)=>(c.label.includes(t)||c.detail===t)&&!selection.includes(j));assert(i>=0,`${t} | ${p.cards.map(c=>c.label).join(' / ')}`);selection.push(i);}
  respondAs(g,{selection});
};
// pick the choice with this label whose card is at this location (2 hand, 16 GY) / sequence
const pickAt=(g,text,where)=>{
  const c=g.prompt.choices.find(c=>c.label.includes(text)&&Object.entries(where).every(([k,v])=>c.card?.[k]===v));
  assert(c,`${text} ${JSON.stringify(where)} | ${g.prompt.choices.map(c=>c.label).join(' / ')}`);
  respondAs(g,{action:c.id});
};
const pass=g=>{while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない'))pick(g,'発動しない');};
// zones and positions are not under test: take the first free zone and face-up Attack Position
const place=g=>{while(g.prompt?.type==='SELECT_PLACE'||g.prompt?.type==='SELECT_POSITION'){if(g.prompt.mode==='single')pick(g,g.prompt.choices.some(c=>c.label==='攻撃表示')?'攻撃表示':g.prompt.choices[0].label);else respondAs(g,{selection:[0]});}};
// an idle command (召喚／特殊召喚／効果発動／攻撃／フェイズ) first passes the open chain window
const IDLE=/^(召喚|特殊召喚|効果発動|攻撃|バトルフェイズへ|メインフェイズ2へ|ターンを終了)/;
const run=(g,steps)=>{for(const s of steps){place(g);if(s===pass)pass(g);else{if(IDLE.test(s))pass(g);pick(g,s);}}place(g);};
// idle command offered (open chain windows are passed first)
const offered=(g,label)=>{place(g);pass(g);return g.prompt?.mode==='single'&&g.prompt.choices.some(c=>c.label.startsWith(label));};
const fx=(code,{team=0,location=2,position=8,sequence=0}={})=>({code,team,controller:team,location,position,sequence});
const SWORD=77700801,SHIELD=77700802,ARMOR=77700803,CHEST=77700804,CROWN=77700805,LIGHTNING=77700806,AXE=77700807,HOLY=77700808,CHERO=77700809,HERO=77700810,HSWORD=77700811;
const BLUE_EYES=89631139,RAIGEKI=12580477,CYCLONE=5318639,MIRROR=44095762,SWORDS=72302403,MARSHMALLON=31305911;
const FILLER=[89631139,89631139,89631139,12580477,12580477,83764718,83764718,44095762,44095762,89631139,89631139,89631139];
const snap=g=>g.snapshot(0).players;
const codes=zone=>zone.filter(Boolean).map(c=>c.code);
const count=(zone,code)=>zone.filter(c=>c?.code===code).length;
const mon=(g,player,code)=>snap(g)[player].monsters.find(c=>c?.code===code);

test('Cursed: 11 original cards are loaded, "Cursed" 0x7c7 / "Hope" 0x7c8 by setcode (not by name)',()=>{
  const theme=customCards.filter(c=>c.custom==='cursed.json');
  assert.equal(theme.length,11);
  assert.deepEqual(theme.map(c=>c.code),[SWORD,SHIELD,ARMOR,CHEST,CROWN,LIGHTNING,AXE,HOLY,CHERO,HERO,HSWORD]);
  assert(theme.every(c=>c.name.includes('呪われた')===c.setcodes.includes(0x7c7)));
  assert.deepEqual(theme.filter(c=>c.setcodes.includes(0x7c8)).map(c=>c.code),[HERO,HSWORD]);
  // the real card 呪われた棺 is not a "Cursed" card
  assert(!(cards[1804528].setcodes??[]).includes(0x7c7));
  assert.deepEqual([LIGHTNING,AXE,HOLY,CHERO].map(c=>[cards[c].type,cards[c].level,cards[c].link_marker]),[[0x4000021,1,0x2],[0x4000021,2,0x5],[0x4000021,4,0x87],[0x4000021,1,0x2]]);
  assert.deepEqual([SWORD,CHEST,CROWN].map(c=>[cards[c].race,cards[c].attribute]),[['8',0x20],['8',0x20],['8',0x20]]);
  assert.deepEqual([HERO,HSWORD].map(c=>[cards[c].race,cards[c].attribute]),[['1',0x10],['1',0x10]]);
  // only fixes to the original text: "①：" and the "●" of the gained effects
  assert(theme.every(c=>c.text.includes('①：')&&!/ ・/.test(c.text)));
  assert(theme.filter(c=>c.text.includes('以下の効果を得る')).every(c=>c.text.includes('以下の効果を得る。 ●')));
});

test('Cursed: Hero of Hope ①② and Sword ①②③, Cursed Hero and Lightning Sword Link Summons (equipped monsters as material), Lightning Sword ① and Cursed Hero ①, the Hero of Hope GY lock',async()=>{
  const g=await Duel.create([{main:[SHIELD,ARMOR,CROWN,HSWORD,CHEST],extra:[CHERO,LIGHTNING,AXE,HOLY]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(HERO),fx(HERO),fx(SWORD),fx(BLUE_EYES),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(SWORDS,{team:1,location:8,sequence:1,position:1})]});
  try{
    pass(g);
    // Hero of Hope ①: send 1 other card from the hand to the GY, Special Summon from the hand (no chain)
    pickAt(g,'特殊召喚：希望の勇者',{location:2});
    assert.deepEqual(g.prompt.cards.map(c=>c.label).sort(),['呪われた剣','希望の勇者','青眼の白龍'].sort());
    run(g,['青眼']);
    assert.equal(mon(g,0,HERO)?.code,HERO);
    // ②: destroy Swords of Revealing Light, add a self-equipping card (only the theme's self-equipping Main Deck cards)
    run(g,['効果発動：希望の勇者',pass,'光の護封剣']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label).sort(),['呪われた盾','呪われた鎧','呪われた王冠','希望の聖剣'].sort());
    run(g,['呪われた鎧',pass]);
    assert.equal(count(snap(g)[1].grave,SWORDS),1);
    assert(codes(snap(g)[0].hand).includes(ARMOR));
    // Sword ① from the hand onto Hero of Hope: ● +1000 ATK
    run(g,['効果発動：呪われた剣',pass]);
    assert.deepEqual(g.prompt.cards.map(c=>c.label).sort(),['希望の勇者','青眼の白龍'].sort(),'either player\'s monster');
    run(g,['希望の勇者',pass]);
    assert.equal(mon(g,0,HERO).attack,3000);
    assert(codes(snap(g)[0].spells).includes(SWORD));
    // Hero of Hope (not "Cursed") equipped with a "Cursed" card can be Lightning Sword's material; Cursed Hero needs it equipped
    assert(offered(g,'特殊召喚：呪われた勇者')&&offered(g,'特殊召喚：呪われた稲妻の剣'));
    run(g,['特殊召喚：呪われた勇者','希望の勇者']);
    // the Sword lost its equip target (destroyed): ③ Special Summons it from the GY
    assert.equal(g.prompt.type,'SELECT_EFFECTYN');
    run(g,['はい',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[SWORD,CHERO].sort());
    assert(!g.prompt.choices.some(c=>c.label.startsWith('発動：呪われた剣')),'③ once per turn / no ① while it is resolving');
    assert(offered(g,'特殊召喚：呪われたデーモンの斧'),'Cursed Hero + Sword: 2 "Cursed" monsters');
    // Lightning Sword (Sword), then its ① equips it from the field to Cursed Hero
    run(g,['特殊召喚：呪われた稲妻の剣','呪われた剣',pass,'効果発動：呪われた稲妻の剣','呪われた勇者',pass]);
    assert(codes(snap(g)[0].spells).includes(LIGHTNING));
    // ●1 (1 "Cursed" Equip Card): Cursed Hero cannot be Link Material
    run(g,['召喚：呪われた鎧',pass]);
    assert(!offered(g,'特殊召喚：呪われたデーモンの斧'),'Cursed Hero + Armor: Cursed Hero cannot be material');
    // Cursed Hero ①: send Lightning Sword (a "Cursed" card on your field), banish Blue-Eyes
    run(g,['効果発動：呪われた勇者','呪われた稲妻の剣',pass,'青眼',pass]);
    assert.equal(count(snap(g)[1].banished,BLUE_EYES),1);
    assert(!offered(g,'効果発動：呪われた勇者'));
    // Hero of Hope ① from the GY (cost: Armor on the field) → no more "Hero of Hope" Special Summons this turn
    assert(offered(g,'特殊召喚：希望の勇者'));
    pass(g);
    pickAt(g,'特殊召喚：希望の勇者',{location:16});
    run(g,['呪われた鎧',pass]);
    assert.equal(mon(g,0,HERO)?.code,HERO);
    assert(codes(snap(g)[0].hand).includes(HERO));
    assert(!offered(g,'特殊召喚：希望の勇者'),'the copy in the hand cannot be Special Summoned');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Cursed: Treasure Chest ① takes a monster that activated its effect this turn, ② equips Hero of Hope (Level 4 Warrior) from the Deck, ③ Special Summons it back and equips the opponent\'s monster',async()=>{
  const g=await Duel.create([{main:[HERO,SWORD,SHIELD,CROWN],extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CHEST),fx(HERO,{location:4,sequence:0,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:3,position:1})]});
  try{
    assert(!offered(g,'効果発動：呪われた宝箱'),'① needs a monster that activated its effect this turn');
    // Hero of Hope ② (destroy 1 Blue-Eyes, add Sword) → it activated an effect this turn
    run(g,['効果発動：希望の勇者',pass,'青眼','呪われた剣',pass]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,2);
    // ① (from the hand): only Hero of Hope can be targeted; Special Summon the Chest and equip Hero of Hope to it
    run(g,['効果発動：呪われた宝箱']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['希望の勇者']);
    run(g,['希望の勇者',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters),[CHEST]);
    assert(codes(snap(g)[0].spells).includes(HERO));
    // ② (either Main Phase): equip a Level 4 Warrior from the Deck — the other Hero of Hope (Fiend "Cursed" monsters are not)
    run(g,['効果発動：呪われた宝箱 / デッキから戦士族を装備',pass]);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['希望の勇者']);
    run(g,['希望の勇者',pass]);
    assert.equal(count(snap(g)[0].spells,HERO),2);
    // ③: target the opponent's Blue-Eyes; Special Summon one equipped Hero of Hope, then equip Blue-Eyes to the Chest
    run(g,['効果発動：呪われた宝箱 / 装備カードのモンスター','青眼',pass,'希望の勇者','特殊召喚する','このカードに装備する',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[CHEST,HERO].sort());
    assert(codes(snap(g)[0].spells).includes(BLUE_EYES),'the opponent\'s Blue-Eyes is now your Equip Card');
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,1);
    assert(!offered(g,'効果発動：呪われた宝箱'),'①②③ once per turn each');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Cursed: Treasure Chest ① does not count an effect activated in the hand (Renzuru Special Summons itself), only one activated on the field',async()=>{
  const RENZURU=77700603,ORIHIME=77700601;
  const g=await Duel.create([{main:[ORIHIME,ORIHIME,ORIHIME],extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CHEST),fx(RENZURU),fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1})]});
  try{
    // Renzuru ① from the hand: it Special Summons itself and searches, but it activated in the hand
    run(g,['効果発動：神折の霊鳥',pass]);
    place(g);
    while(g.prompt?.mode==='multi')respondAs(g,{selection:[0]});
    pass(g);
    assert(codes(snap(g)[0].monsters).includes(RENZURU),'Renzuru is on the field');
    assert(!offered(g,'効果発動：呪われた宝箱'),'an effect activated in the hand does not count');
  }finally{g.close();}
});

test('Cursed: Treasure Chest ③ cannot target a monster unaffected by its effect (Dusk Hour Blade Yayoi)',async()=>{
  const YAYOI=77700409;
  const g=await Duel.create([{main:[HERO,SWORD,SHIELD,CROWN],extra:[]},{main:FILLER,extra:[YAYOI]}],{seed:1,fixtures:[
    fx(CHEST),fx(HERO,{location:4,sequence:0,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(YAYOI,{team:1,location:4,sequence:5,position:1})]});
  try{
    run(g,['効果発動：希望の勇者',pass,'青眼','呪われた剣',pass]);
    run(g,['効果発動：呪われた宝箱','希望の勇者',pass]);
    run(g,['効果発動：呪われた宝箱 / 装備カードのモンスター']);
    const targets=g.prompt.cards.map(c=>c.label);
    assert(targets.some(l=>l.includes('青眼')),targets.join(' / '));
    assert(!targets.some(l=>l.includes('夜宵')),'Yayoi is unaffected by other cards: '+targets.join(' / '));
  }finally{g.close();}
});

test('Cursed: Treasure Chest ③ "フィールドのモンスター１体" includes the Chest itself: it cannot equip itself, so it is sent to the GY',async()=>{
  const g=await Duel.create([{main:[HERO,SWORD,SHIELD,CROWN],extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CHEST),fx(HERO,{location:4,sequence:0,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1})]});
  try{
    // Hero of Hope ② destroys the only opponent's monster; Chest ① equips the Hero to the Chest: the Chest is the only monster left
    run(g,['効果発動：希望の勇者',pass,'青眼','呪われた剣',pass]);
    run(g,['効果発動：呪われた宝箱','希望の勇者',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters),[CHEST]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,0);
    run(g,['効果発動：呪われた宝箱 / 装備カードのモンスター']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['呪われた宝箱'],'the Chest can target itself');
    run(g,['呪われた宝箱',pass,'希望の勇者','特殊召喚する',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters),[HERO],'the Hero of Hope was Special Summoned');
    assert.equal(count(snap(g)[0].grave,CHEST),1,'then the target (the Chest itself) was sent to the GY');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Cursed: Sword, Shield, Armor and Crown ① cannot equip themselves to a monster unaffected by them (Dusk Hour Blade Yayoi)',async()=>{
  const YAYOI=77700409;
  for(const card of [SWORD,SHIELD,ARMOR,CROWN]){
    const g=await Duel.create([{main:FILLER,extra:[]},{main:FILLER,extra:[YAYOI]}],{seed:1,fixtures:[
      fx(card),fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1}),fx(YAYOI,{team:1,location:4,sequence:5,position:1})]});
    try{
      run(g,['効果発動：'+cards[card].name]);
      const targets=g.prompt.cards.map(c=>c.label);
      assert.deepEqual(targets,['青眼の白龍'],`${cards[card].name}: ${targets.join(' / ')}`);
    }finally{g.close();}
  }
});

test('Cursed: Shield ② (Defense Position, not destroyed by battle), Armor ② and Lightning Sword ① from the GY / ② survive Raigeki',async()=>{
  const g=await Duel.create([{main:FILLER,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SHIELD),fx(ARMOR),fx(RAIGEKI),fx(LIGHTNING,{location:16,position:1}),fx(BLUE_EYES,{location:4,sequence:0,position:1}),
    fx(BLUE_EYES,{team:1,location:4,sequence:1,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:3,position:1})]});
  try{
    // Shield onto your Blue-Eyes: it becomes Defense Position
    run(g,['効果発動：呪われた盾','P1 モンスター 1',pass]);
    assert.equal(snap(g)[0].monsters[0].position,4);
    // Armor onto the opponent's Blue-Eyes (zone 2), Lightning Sword from the GY onto the one in zone 3
    run(g,['効果発動：呪われた鎧','P2 モンスター 2',pass,'効果発動：呪われた稲妻の剣','P2 モンスター 3',pass]);
    assert.equal(count(snap(g)[0].spells,LIGHTNING),1);
    // Raigeki: only the opponent's unequipped Blue-Eyes is destroyed
    run(g,['効果発動：サンダー・ボルト',pass]);
    pass(g);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,2);
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1);
    // the opponent's turn: Blue-Eyes (3000) attacks the shielded Blue-Eyes (DEF 2500): not destroyed by battle, no damage
    run(g,['ターンを終了',pass,'バトルフェイズへ',pass,'攻撃：青眼','青眼の白龍',pass]);
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert.equal(count(snap(g)[0].monsters,BLUE_EYES),1,'not destroyed by battle');
    assert.equal(g.lp[0],8000);
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Cursed: Crown ② negates effects activated in the equipped monster\'s column only; destroyed with its target still on the field, ③ does not trigger',async()=>{
  const g=await Duel.create([{main:FILLER,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CROWN),fx(RAIGEKI),fx(BLUE_EYES,{location:4,sequence:0,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),
    // the opponent's zone 5 is your column 1 (your Blue-Eyes' column), its zone 1 is your column 5
    fx(CYCLONE,{team:1,location:8,sequence:4,position:8}),fx(CYCLONE,{team:1,location:8,sequence:0,position:8})]});
  try{
    run(g,['効果発動：呪われた王冠','P1 モンスター 1',pass]);
    assert(codes(snap(g)[0].spells).includes(CROWN));
    // Raigeki → the opponent chains the Cyclone in your Blue-Eyes' column on the Crown: negated
    run(g,['効果発動：サンダー・ボルト']);
    pickAt(g,'発動：サイクロン',{sequence:4});
    run(g,['呪われた王冠',pass]);
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert(g.log.some(e=>/CHAIN 2 無効/.test(e.text)));
    assert(codes(snap(g)[0].spells).includes(CROWN));
    assert.equal(count(snap(g)[1].grave,CYCLONE),1);
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1,'Raigeki (not in that column) resolved');
    // the other Cyclone (another column) destroys the Crown; its target stayed on the field → no ③
    run(g,['ターンを終了',pass]);
    pass(g);
    pickAt(g,'効果発動：サイクロン',{sequence:0});
    run(g,['呪われた王冠',pass]);
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert(codes(snap(g)[0].grave).includes(CROWN));
    assert.notEqual(g.prompt?.type,'SELECT_EFFECTYN');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Cursed: Demon Axe and Holy Sword Link Summons, Axe ①② halves its controller\'s LP each Standby Phase, Holy Sword ①② equips 3 more, Cursed Hero ●2〜●5',async()=>{
  const g=await Duel.create([{main:[CHEST,...FILLER],extra:[AXE,HOLY]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SWORD,{location:4,sequence:0,position:1}),fx(CHERO,{location:4,sequence:1,position:1}),fx(SHIELD,{location:4,sequence:2,position:1}),
    fx(ARMOR,{location:4,sequence:3,position:1}),fx(CROWN,{location:4,sequence:4,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),
    fx(CYCLONE,{team:1,location:8,sequence:0,position:8}),fx(MIRROR,{team:1,location:8,sequence:1,position:8}),fx(CYCLONE,{team:1,location:8,sequence:2,position:8})]});
  try{
    // Demon Axe: 2 "Cursed" monsters; Holy Sword (materials provisional): Axe (Link 2) + 2 = Link 4
    run(g,['特殊召喚：呪われたデーモンの斧','選択：呪われた剣','選択：呪われた盾']);
    run(g,['特殊召喚：呪われた聖剣','選択：呪われたデーモンの斧','選択：呪われた鎧','選択：呪われた王冠','選択を確定']);
    assert.deepEqual(codes(snap(g)[0].monsters).sort(),[CHERO,HOLY].sort());
    // Axe ① from the GY onto Cursed Hero
    run(g,['効果発動：呪われたデーモンの斧','呪われた勇者',pass]);
    // Holy Sword ① from the field onto Cursed Hero, then 3 "Cursed" monsters from the GY (3 free zones)
    run(g,['効果発動：呪われた聖剣','呪われた勇者',pass,'はい']);
    assert.equal(g.prompt.max,3);
    assert(g.prompt.cards.some(c=>c.label==='呪われた宝箱'),'the Deck too');
    run(g,[['呪われた剣','呪われた鎧','呪われた王冠'],pass]);
    assert.equal(snap(g)[0].spells.filter(Boolean).length,5);
    assert.equal(mon(g,0,CHERO).attack,2000+1000,'Sword ●; ●3 with no LP difference');
    // the opponent's Standby Phase: ● from the Axe (Cursed Hero's controller = you) halves your LP; ●3 adds the difference
    run(g,['ターンを終了',pass]);
    // mandatory: the only choice is the granted effect, activated by Cursed Hero
    assert.deepEqual(g.prompt.choices.map(c=>c.label),['発動：呪われた勇者 / LPを半分にする']);
    run(g,['発動：呪われた勇者',pass]);
    assert(offered(g,'効果発動：サイクロン'));
    assert.equal(g.lp[0],4000);
    assert.equal(mon(g,0,CHERO).attack,2000+1000+4000);
    // ●5: an opponent's Cyclone on the Armor resolves → send the Sword to negate it
    pickAt(g,'効果発動：サイクロン',{sequence:0});
    run(g,['呪われた鎧',pass]);
    assert.equal(g.prompt.type,'SELECT_EFFECTYN');
    run(g,['はい','呪われた剣']);
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert(g.log.some(e=>/CHAIN 1 無効/.test(e.text)));
    assert(codes(snap(g)[0].grave).includes(SWORD));
    assert.equal(mon(g,0,CHERO).attack,2000+4000);
    // 4 left: ●4 keeps the Armor on the field against the other Cyclone (no ●5 offer)
    pass(g);
    pickAt(g,'効果発動：サイクロン',{sequence:2});
    run(g,['呪われた鎧',pass]);
    assert.notEqual(g.prompt.type,'SELECT_EFFECTYN');
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert(codes(snap(g)[0].spells).includes(ARMOR),'●4: not destroyed by card effects');
    // your Standby Phase halves your LP again; Battle Phase: Holy Sword ② keeps Mirror Force from being activated,
    // ●2 doubles the battle damage: (2000 + 6000 - 3000) × 2
    run(g,['ターンを終了',pass,'発動：呪われた勇者',pass]);
    assert(offered(g,'バトルフェイズへ'));
    assert.equal(g.lp[0],2000);
    assert.equal(mon(g,0,CHERO).attack,2000+6000);
    run(g,['バトルフェイズへ',pass,'攻撃：呪われた勇者','青眼の白龍']);
    while(g.prompt?.type==='SELECT_CHAIN'){assert(!g.prompt.choices.some(c=>c.label.includes('ミラーフォース')));pass(g);}
    assert.equal(g.lp[1],8000-(2000+6000-3000)*2,'doubled');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Hope: Holy Sword of Hope ① equips itself, ② while the equipped monster battles the opponent cannot activate effects and its face-up cards are negated',async()=>{
  const g=await Duel.create([{main:FILLER,extra:[]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(HSWORD),fx(BLUE_EYES,{location:4,sequence:0,position:1}),fx(BLUE_EYES,{location:4,sequence:1,position:1}),
    fx(MARSHMALLON,{team:1,location:4,sequence:2,position:4}),fx(MIRROR,{team:1,location:8,sequence:1,position:8})]});
  try{
    run(g,['効果発動：希望の聖剣','P1 モンスター 1',pass]);
    assert(codes(snap(g)[0].spells).includes(HSWORD));
    assert.equal(snap(g)[0].monsters[0].attack,3000,'no ATK change');
    run(g,['ターンを終了',pass]);
    for(let i=0;i<20&&!offered(g,'ターンを終了');i++)pass(g);
    run(g,['ターンを終了',pass]);
    for(let i=0;i<20&&!offered(g,'バトルフェイズへ');i++)pass(g);
    // the equipped Blue-Eyes attacks Marshmallon: no Mirror Force, Marshmallon's "cannot be destroyed by battle" is negated
    run(g,['バトルフェイズへ',pass]);
    pickAt(g,'攻撃：青眼',{sequence:0});
    run(g,['マシュマロン']);
    for(let i=0;i<20&&g.prompt?.type==='SELECT_CHAIN';i++){assert(!g.prompt.choices.some(c=>c.label.includes('ミラーフォース')));pass(g);}
    assert.equal(count(snap(g)[1].grave,MARSHMALLON),1);
    // the other Blue-Eyes (not equipped) attacks directly: Mirror Force can be activated again
    pass(g);
    pickAt(g,'攻撃：青眼',{sequence:1});
    place(g);
    for(let i=0;i<20&&g.prompt?.type==='SELECT_CHAIN'&&!g.prompt.choices.some(c=>c.label.includes('ミラーフォース'));i++)pass(g);
    assert(g.prompt.choices.some(c=>c.label.includes('ミラーフォース')));
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});
