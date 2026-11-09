import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Original theme 秩序 (custom/chitsujo.json, custom/scripts/c777007xx.lua).
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
const LAWRY=77700701,VAPOR=77700702,NOVRY=77700703,SANCTUM=77700704,LOWELL=77700705,CAVALRY=77700706,UNQUELL=77700707,SACRIFICE=77700708,EDURA=77700709;
const MAIN=[LAWRY,VAPOR,NOVRY,SANCTUM,SACRIFICE,EDURA].flatMap(x3);
const EXTRA=[LOWELL,LOWELL,CAVALRY,CAVALRY,UNQUELL];
const FILLER=[89631139,89631139,89631139,12580477,12580477,83764718,83764718,44095762,44095762,89631139,89631139,89631139];
const BLUE_EYES=89631139,SWORDS=72302403,CYCLONE=5318639,MIRROR=44095762,VEILER=97268402;
const without=(list,remove)=>{const a=[...list];for(const c of remove)a.splice(a.indexOf(c),1);return a;};
const snap=g=>g.snapshot(0).players;
const codes=zone=>zone.filter(Boolean).map(c=>c.code);
const count=(zone,code)=>zone.filter(c=>c?.code===code).length;
const offered=(g,label)=>g.prompt.choices.some(c=>c.label.startsWith(label));
const mon=(g,player,code)=>snap(g)[player].monsters.find(c=>c?.code===code);
const mats=(g,player,code)=>mon(g,player,code)?.overlayCards?.length??0;

test('Order: 9 original cards are loaded with setcodes 0x7c6 / 0x17c6 ("Order Knight" is also "Order")',()=>{
  const theme=customCards.filter(c=>c.custom==='chitsujo.json');
  assert.equal(theme.length,9);
  const knights=[LAWRY,VAPOR,NOVRY,LOWELL,CAVALRY,UNQUELL,EDURA];
  assert.deepEqual(theme.filter(c=>c.setcodes.includes(0x17c6)).map(c=>c.code).sort(),knights.sort());
  assert.deepEqual(theme.filter(c=>c.setcodes.includes(0x7c6)).map(c=>c.code).sort(),[SANCTUM,SACRIFICE].sort());
  assert(theme.every(c=>c.name.includes('秩序騎士')===c.setcodes.includes(0x17c6)));
  assert.deepEqual([LOWELL,CAVALRY,UNQUELL].map(c=>[cards[c].level,cards[c].type]),[[9,0x800021],[9,0x800021],[10,0x800021]]);
  assert.equal(cards[NOVRY].attribute,0x20);
  assert.equal(cards[NOVRY].race,'8');
});

test('Order: Sacrifice goes to the opponent\'s field and searches for its owner, the Knights come out, Novry Xyz Summons Cavalry and Vapor grants its search, Cavalry ② and Unquell ①② finish',async()=>{
  const hand=[SACRIFICE,LAWRY,VAPOR];
  const g=await Duel.create([{main:without(MAIN,hand),extra:EXTRA},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    ...hand.map(c=>fx(c)),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1}),
    fx(SWORDS,{team:1,location:8,sequence:1,position:1}),fx(MIRROR,{team:1,location:8,sequence:2,position:8})]});
  try{
    pass(g);
    assert(!offered(g,'特殊召喚：秩序騎士'),'① needs an opponent\'s monster effect during your Main Phase');
    // Sacrifice ①: Special Summon to the opponent's field. ② (mandatory, activated by its controller = the opponent): the owner (you) searches.
    run(g,['特殊召喚：秩序の犠牲','相手 モンスター 1','攻撃表示','エデュラ',pass]);
    assert.equal(snap(g)[1].monsters[0]?.code,SACRIFICE);
    assert(g.log.some(e=>/ASTRA：秩序の犠牲 を特殊召喚/.test(e.text)));
    assert(codes(snap(g)[0].hand).includes(EDURA));
    assert(!offered(g,'特殊召喚：秩序の犠牲'),'Sacrifice ① once per Duel');
    // the opponent activated a monster effect during your Main Phase → the Knights' ① are open (no chain)
    assert(['ロウリー','ヴェイパー','エデュラ'].every(n=>offered(g,`特殊召喚：秩序騎士${n}`)));
    // Lawry ① → ② adds Novry
    run(g,['特殊召喚：秩序騎士ロウリー','自分 モンスター 1','攻撃表示','はい',pass,'ノヴルィ',pass]);
    assert(codes(snap(g)[0].hand).includes(NOVRY));
    assert(!offered(g,'特殊召喚：秩序騎士ロウリー'));
    // Edura ① → ② Special Summons Novry from the Deck
    run(g,['特殊召喚：秩序騎士エデュラ','自分 モンスター 2','攻撃表示','はい',pass,'ノヴルィ','自分 モンスター 3','攻撃表示',pass]);
    assert.deepEqual(codes(snap(g)[0].monsters),[LAWRY,EDURA,NOVRY]);
    // Vapor ① → Novry ② (a monster was Special Summoned): Xyz Summon using only Novry and Vapor
    run(g,['特殊召喚：秩序騎士ヴェイパー','自分 モンスター 4','攻撃表示','はい',pass]);
    assert.deepEqual(g.prompt.cards.map(c=>c.label).sort(),['秩序騎士キャバルリー','秩序騎士キャバルリー','秩序騎士ローウェル','秩序騎士ローウェル'].sort());
    run(g,['キャバルリー','選択：無秩序騎士ノヴルィ','選択：秩序騎士ヴェイパー','自分 モンスター EX 1','守備表示']);
    // the Xyz Summon itself triggers Cavalry ① and the ● Vapor granted
    assert(offered(g,'発動：秩序騎士キャバルリー / 秩序魔法・罠を手札に加える'),'● from Vapor');
    run(g,['モンスターをX素材','秩序魔法・罠',pass,'守護殿','秩序の犠牲',pass]);
    assert(codes(snap(g)[0].hand).includes(SANCTUM));
    assert.equal(mats(g,0,CAVALRY),3,'Novry, Vapor and the Sacrifice from the opponent\'s field');
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,1);
    // Lowell (Lawry + Edura), Sanctum ① adds Vapor
    run(g,['特殊召喚：秩序騎士ローウェル','選択：秩序騎士ロウリー','選択：秩序騎士エデュラ','自分 モンスター 2','攻撃表示',pass]);
    run(g,['発動：秩序の守護殿','自分 魔法・罠 1',pass,'ヴェイパー',pass]);
    assert(codes(snap(g)[0].hand).includes(VAPOR));
    assert(!offered(g,'発動：秩序の守護殿'));
    // Cavalry ②: detach 2 materials on the field (Lowell's), Special Summon Lowell from the Extra Deck; it cannot attack this turn
    run(g,['EXデッキからランク９',pass,['ロウリー','エデュラ'],'ローウェル','自分 モンスター 3','攻撃表示',pass]);
    assert.equal(count(snap(g)[0].monsters,LOWELL),2);
    assert.equal(count(snap(g)[0].grave,SACRIFICE),0,'Cavalry still has the Sacrifice');
    // Unquell (Cavalry + the summoned Lowell): ① attaches Blue-Eyes and Swords (up to 3)
    run(g,['特殊召喚：秩序騎士アンクウェル','選択：秩序騎士キャバルリー','選択：秩序騎士ローウェル','選択を確定','自分 モンスター 4','攻撃表示']);
    assert(g.log.some(e=>/YOU：秩序騎士アンクウェル を特殊召喚/.test(e.text)));
    run(g,['はい',pass]);
    assert.equal(g.prompt.max,3);
    run(g,[['青眼','護封剣'],pass]);
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,0);
    assert.equal(snap(g)[1].spells.filter(Boolean).length,1,'Mirror Force is left');
    const unq=mats(g,0,UNQUELL);
    assert.equal(unq,2+2,'Cavalry and Lowell + 2 attached cards (Cavalry\'s own materials go to the GY)');
    assert.equal(count(snap(g)[0].grave,SACRIFICE),1);
    // Unquell ②: detach 1 → banish up to its material count (3)
    run(g,['効果発動：秩序騎士アンクウェル / フィールドのカードを除外',pass,'青眼']);
    assert.equal(g.prompt.max,unq-1);
    run(g,['ミラーフォース',pass]);
    assert.equal(count(snap(g)[1].banished,MIRROR),1);
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Order: Novry ② Xyz Summons with the opponent\'s Special Summoned monster treated as Level 9, Sacrifice ② still searches for its owner',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[LOWELL]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SACRIFICE),fx(NOVRY,{location:4,sequence:0,position:1})]});
  try{
    pass(g);
    run(g,['特殊召喚：秩序の犠牲','相手 モンスター 3','攻撃表示']);
    // Sacrifice ② (the opponent's mandatory trigger) is Chain Link 1, Novry ② Chain Link 2
    run(g,['発動：無秩序騎士ノヴルィ',pass,'ローウェル','選択：無秩序騎士ノヴルィ','選択：秩序の犠牲','自分 モンスター 2','攻撃表示']);
    assert.equal(mats(g,0,LOWELL),2);
    assert.deepEqual([...mon(g,0,LOWELL).overlayCards].sort(),[NOVRY,SACRIFICE].sort());
    assert.equal(snap(g)[1].monsters.filter(Boolean).length,0,'the opponent\'s Level 3 Sacrifice became material');
    run(g,['エデュラ',pass]);
    assert(codes(snap(g)[0].hand).includes(EDURA),'Sacrifice ② resolved for its owner after it left the field');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Order: Lowell ① protects the other "Order" monsters, Sanctum ② detaches to negate Effect Veiler once per turn, Lowell ② and ③ on the opponent\'s turn',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[LOWELL,CAVALRY]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SACRIFICE),fx(LAWRY,{location:4,sequence:0,position:1}),fx(VAPOR,{location:4,sequence:1,position:1}),
    fx(EDURA,{location:4,sequence:2,position:1}),fx(NOVRY,{location:4,sequence:3,position:1}),fx(SANCTUM,{location:8,sequence:0,position:1}),
    fx(VEILER,{team:1}),fx(CYCLONE,{team:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1})]});
  try{
    pass(g);
    run(g,['特殊召喚：秩序騎士ローウェル','選択：秩序騎士ロウリー','選択：秩序騎士ヴェイパー','選択：秩序騎士エデュラ','選択を確定','自分 モンスター 1','攻撃表示','いいえ',pass]);
    assert.equal(mats(g,0,LOWELL),3);
    // the opponent's Sacrifice ② is answered by the opponent's Effect Veiler: only Lowell can be targeted (Lowell ①)
    run(g,['特殊召喚：秩序の犠牲','相手 モンスター 1','攻撃表示','発動：エフェクト・ヴェーラー']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['秩序騎士ローウェル']);
    run(g,['ローウェル',pass]);
    // Sanctum ②: when Veiler resolves, detach 1 material from Lowell → Veiler is negated
    assert.equal(g.prompt.type,'SELECT_YESNO');
    run(g,['はい','ローウェル','ロウリー']);
    assert(g.log.some(e=>/CHAIN 2 無効/.test(e.text)));
    assert.equal(mats(g,0,LOWELL),2);
    // once per turn: Sacrifice ② (also an opponent's monster effect) resolves without another offer
    run(g,['ノヴルィ',pass]);
    assert(codes(snap(g)[0].hand).includes(NOVRY));
    // opponent's Standby Phase: Lowell ② detaches 1, looks at the opponent's hand and sends 1 card to the GY
    run(g,['ターンを終了',pass,'はい',pass,'ヴェイパー','サイクロン',pass]);
    assert.equal(mats(g,0,LOWELL),1);
    assert.equal(count(snap(g)[1].grave,CYCLONE),1);
    // Blue-Eyes attacks Novry: Lowell ③ banishes up to 1 card (its 1 material), Novry is not destroyed by battle
    run(g,['バトルフェイズへ',pass,'攻撃：青眼','無秩序騎士ノヴルィ','はい',pass,'秩序の犠牲',pass]);
    assert.equal(count(snap(g)[1].banished,SACRIFICE),0,'banished cards go to the owner\'s zone');
    assert.equal(count(snap(g)[0].banished,SACRIFICE),1);
    while(g.prompt?.type==='SELECT_CHAIN')pass(g);
    assert(codes(snap(g)[0].monsters).includes(NOVRY),'Lowell ①: not destroyed by battle');
    assert.equal(g.lp[0],8000-(3000-2300));
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Order: Cavalry ① cannot attach a monster unaffected by its effect (Dusk Hour Blade Yayoi)',async()=>{
  const YAYOI=77700409;
  const g=await Duel.create([{main:MAIN,extra:[CAVALRY]},{main:FILLER,extra:[YAYOI]},],{seed:1,fixtures:[
    fx(LAWRY,{location:4,sequence:0,position:1}),fx(EDURA,{location:4,sequence:1,position:1}),
    fx(YAYOI,{team:1,location:4,sequence:5,position:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1})]});
  try{
    pass(g);
    run(g,['特殊召喚：秩序騎士キャバルリー','選択：秩序騎士ロウリー','選択：秩序騎士エデュラ']);
    if(g.prompt?.choices?.some(c=>c.label==='選択を確定'))pick(g,'選択を確定');
    run(g,['自分 モンスター 1','守備表示','はい',pass]);
    const choices=g.prompt.cards.map(c=>c.label);
    assert(choices.some(l=>l.includes('青眼')),choices.join(' / '));
    assert(!choices.some(l=>l.includes('夜宵')),'Yayoi is unaffected by other cards: '+choices.join(' / '));
  }finally{g.close();}
});

test('Order: Cavalry ③ can be activated on the opponent\'s turn, in response to their monster effect',async()=>{
  const MAXX_C=23434538;
  const g=await Duel.create([{main:MAIN,extra:[LOWELL]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(CAVALRY,{location:4,sequence:5,position:1}),fx(VAPOR,{location:4,sequence:2,position:1}),fx(NOVRY,{location:4,sequence:3,position:1}),
    fx(MAXX_C,{team:1})]});
  try{
    run(g,[pass,'ターンを終了',pass]);
    // the opponent's Main Phase: Maxx "C" is a monster effect, so Cavalry ③ answers it in the chain
    run(g,['発動：増殖するG']);
    assert(offered(g,'発動：秩序騎士キャバルリー'),g.prompt.choices?.map(c=>c.label).join(' / '));
    run(g,['発動：秩序騎士キャバルリー','ローウェル','選択：秩序騎士ヴェイパー','選択：無秩序騎士ノヴルィ']);
    while(g.prompt?.type==='SELECT_PLACE'||g.prompt?.type==='SELECT_POSITION')pick(g,g.prompt.mode==='single'?'攻撃表示':'自分 モンスター');
    pass(g);
    assert(codes(snap(g)[0].monsters).includes(LOWELL),'Lowell was Xyz Summoned on the opponent\'s turn');
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});

test('Order: Unquell ③ detaches to negate Effect Veiler, Cavalry ③ Xyz Summons an immune Lowell, Sanctum ③ revives from the GY',async()=>{
  const g=await Duel.create([{main:MAIN,extra:[LOWELL,CAVALRY]},{main:FILLER,extra:[]}],{seed:1,fixtures:[
    fx(SACRIFICE),fx(LAWRY,{location:4,sequence:0,position:1}),fx(EDURA,{location:4,sequence:1,position:1}),
    fx(VAPOR,{location:4,sequence:2,position:1}),fx(NOVRY,{location:4,sequence:3,position:1}),fx(UNQUELL,{location:4,sequence:6,position:1}),
    fx(SANCTUM,{location:16,position:1}),fx(VEILER,{team:1}),fx(VEILER,{team:1}),fx(BLUE_EYES,{team:1,location:4,sequence:2,position:1})]});
  try{
    pass(g);
    assert(!offered(g,'効果発動：秩序騎士キャバルリー'));
    // Cavalry (Lawry + Edura) ① attaches the opponent's Blue-Eyes
    run(g,['特殊召喚：秩序騎士キャバルリー','選択：秩序騎士ロウリー','選択：秩序騎士エデュラ','選択を確定','自分 モンスター 1','守備表示','はい',pass,'青眼',pass]);
    assert.equal(mats(g,0,CAVALRY),3);
    assert(!offered(g,'効果発動：秩序騎士キャバルリー / X召喚を行う'),'③ needs an opponent\'s monster effect this turn');
    // Sacrifice → the opponent chains Effect Veiler on Vapor → Unquell ③ detaches Blue-Eyes from Cavalry and negates it
    run(g,['特殊召喚：秩序の犠牲','相手 モンスター 1','攻撃表示','発動しない','発動しない','発動：エフェクト・ヴェーラー','ヴェイパー','発動：秩序騎士アンクウェル',pass,'青眼']);
    assert(g.log.some(e=>/CHAIN 2 無効/.test(e.text)));
    assert.equal(mats(g,0,CAVALRY),2);
    assert.equal(count(snap(g)[1].grave,BLUE_EYES),1);
    run(g,['ロウリー',pass]);
    // Cavalry ③: Xyz Summon Lowell with Vapor + Novry; it is unaffected by the opponent's monster effects
    run(g,['効果発動：秩序騎士キャバルリー / X召喚を行う','発動しない','ローウェル','選択：秩序騎士ヴェイパー','選択：無秩序騎士ノヴルィ','自分 モンスター 2','攻撃表示']);
    assert.equal(mats(g,0,LOWELL),2);
    // ● from Vapor, answered by Veiler on Lowell (the only monster Lowell ① lets the opponent target): Veiler does not apply
    run(g,['はい','発動：エフェクト・ヴェーラー']);
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['秩序騎士ローウェル']);
    run(g,['ローウェル',pass,'守護殿',pass]);
    assert(codes(snap(g)[0].hand).includes(SANCTUM),'the granted search resolved: Veiler did not affect Lowell');
    assert(!offered(g,'効果発動：秩序騎士キャバルリー / X召喚を行う'),'Cavalry ③ once per turn');
    // Sanctum ③: banish it from the GY, Special Summon Lawry (hand) and Edura (Deck)
    run(g,['効果発動：秩序の守護殿',pass,['ロウリー','エデュラ']]);
    while(g.prompt?.type==='SELECT_PLACE'||g.prompt?.type==='SELECT_POSITION'||g.prompt?.type==='SELECT_EFFECTYN')pick(g,g.prompt.mode==='single'?(g.prompt.type==='SELECT_EFFECTYN'?'いいえ':'攻撃表示'):'自分 モンスター');
    pass(g);
    assert(codes(snap(g)[0].banished).includes(SANCTUM));
    assert(codes(snap(g)[0].monsters).includes(LAWRY)&&codes(snap(g)[0].monsters).includes(EDURA));
    assert.deepEqual(g.errors,[]);
  }finally{g.close();}
});
