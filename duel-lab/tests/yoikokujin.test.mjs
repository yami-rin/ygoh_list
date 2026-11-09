// 宵刻刃 original cards: custom/yoikokujin.json + custom/scripts/c777004xx.lua
// "宵刻" (0x7c3) is the Spell/Trap archetype; "宵刻刃" (0x17c3) monsters belong to "宵刻" as well.
import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {Duel} from '../engine.mjs';

const HIEN=77700401,KASUMI=77700402,OBORO=77700403,TSUKIKAGE=77700404,YASHA=77700405,ZANYA=77700406,BYAKUYA=77700407,
  KYOKUYA=77700408,YAYOI=77700409,ENBU=77700410,BATTO=77700411,SHUKUCHI=77700412,KAGEGAMAE=77700413,ZETTO=77700414;
const FRONT=77700202,ABSOLUTE_ZERO=77700207,RAIGEKI=12580477,DARK_HOLE=53129443;
const LOC={hand:2,mzone:4,szone:8,grave:16,removed:32};
// zones: {hand:[code...], mzone:['code@sequence'...], ...}; set: codes placed face-down in the Spell & Trap Zone
async function duel({deck0=[],extra0=[],deck1=[],extra1=[],p0={},p1={},set=[]}){
  const fixtures=[];
  for(const [player,zones] of [[0,p0],[1,p1]])for(const [zone,codes] of Object.entries(zones))codes.forEach((entry,i)=>{
    const [code,seq]=String(entry).split('@').map(Number);
    fixtures.push({code,team:player,controller:player,location:LOC[zone],position:zone==='hand'?8:zone==='szone'&&set.includes(code)?10:1,sequence:Number.isNaN(seq)||seq===undefined?i:seq});
  });
  return Duel.create([{main:deck0,extra:extra0},{main:deck1,extra:extra1}],{seed:1,fixtures});
}
const labels=g=>g.prompt.mode==='single'?g.prompt.choices.map(c=>c.label):g.prompt.cards.map(c=>`${c.label} ${c.detail||''}`);
function pick(g,text){
  const p=g.prompt,who=g.pending.player^g.first;
  if(p.mode==='single'){
    const c=p.choices.find(c=>c.label.includes(text));assert(c,`${text} | ${labels(g).join(' / ')}`);
    g.respond(who,g.revision,{action:c.id},{snapshot:false});
  }else{
    const picked=[];
    for(const t of text.split('|')){
      const i=p.cards.findIndex((c,k)=>!picked.includes(k)&&(c.label.includes(t)||(c.detail||'').includes(t)));
      assert(i>=0,`${t} | ${labels(g).join(' / ')}`);picked.push(i);
    }
    g.respond(who,g.revision,{selection:picked},{snapshot:false});
  }
  assert.equal(g.validationError,null);
}
// Zone and position prompts take the first offer unless the step names one.
function auto(g,step){
  while(g.pending&&['SELECT_PLACE','SELECT_POSITION'].includes(g.prompt.type)&&!(step&&labels(g).some(l=>l.includes(step)))){
    if(g.prompt.mode==='single')pick(g,g.prompt.choices[0].label);else g.respond(g.pending.player^g.first,g.revision,{selection:[0]},{snapshot:false});
  }
}
// PASS: decline every open chain window (both players) until something else is asked.
const pass=g=>{auto(g);while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない')){pick(g,'発動しない');auto(g);}};
function play(g,steps){for(const s of steps){if(s==='PASS'){pass(g);continue;}auto(g,s);pick(g,s);}auto(g);}
const zone=(g,player,key,viewer=player)=>g.snapshot(viewer).players[player][key].filter(Boolean);
const names=(g,player,key,viewer=player)=>zone(g,player,key,viewer).map(c=>c.name);
const logged=(g,re)=>g.log.some(e=>re.test(e.text));

test('宵刻刃 original cards are loaded: Spell/Trap "宵刻" 0x7c3, monsters "宵刻刃" 0x17c3',()=>{
  const cards=customCards.filter(c=>c.custom==='yoikokujin.json');
  assert.equal(cards.length,14);
  for(const c of cards)assert.deepEqual(c.setcodes,c.type&1?[0x17c3]:[0x7c3],c.name);
  // the sub-archetype keeps the base code in its low 12 bits, so "宵刻" searches also find "宵刻刃" monsters
  assert.equal(0x17c3&0xfff,0x7c3);
});

test('宵刻刃 combo: Hien → Kasumi → Zanya, Sword Dance loop, White Night, Polar Night, then Yayoi from hand',async()=>{
  const g=await duel({deck0:[OBORO,YASHA,YASHA,HIEN,BATTO,ZETTO,SHUKUCHI,KAGEGAMAE],extra0:[ZANYA,BYAKUYA,KYOKUYA,YAYOI],
    deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[HIEN,KASUMI,KASUMI,ENBU,TSUKIKAGE,TSUKIKAGE,YASHA,OBORO]},
    p1:{mzone:[FRONT,FRONT,FRONT,FRONT,FRONT],szone:[ABSOLUTE_ZERO,ABSOLUTE_ZERO,ABSOLUTE_ZERO]}});
  try{
    // Hien ① searches Yasha; Kasumi ① Special Summons itself; Synchro Summon Zanya; Kasumi again.
    play(g,['PASS','召喚：宵刻刃－飛燕','はい','PASS','宵刻刃－夜叉','特殊召喚：宵刻刃－霞','PASS',
      '特殊召喚：宵刻刃－残夜','選択：宵刻刃－霞','選択：宵刻刃－飛燕','PASS','特殊召喚：宵刻刃－霞','PASS']);
    assert(logged(g,/YOU：宵刻刃－残夜 を特殊召喚/));
    // Sword Dance ①: Oboro from the Deck, then Oboro returns → Sword Dance ② (Normal Summon) + Oboro ② (Yasha from the Deck).
    play(g,['効果発動：宵刻の演舞','PASS','宵刻刃－朧','P1 モンスター 3','はい','発動：宵刻刃－朧','PASS','宵刻刃－夜叉','宵刻刃－朧']);
    assert(logged(g,/YOU：宵刻刃－朧 を召喚/),'Sword Dance ② Normal Summoned Oboro');
    // Oboro ① Sets Severing Blade; Yasha ① adds Hien back from the GY.
    play(g,['発動：宵刻刃－朧','発動：宵刻刃－夜叉','宵刻刃－飛燕','PASS','宵刻の絶刀','PASS']);
    assert(names(g,0,'spells').includes('宵刻の絶刀'));
    assert(names(g,0,'hand').includes('宵刻刃－飛燕'));
    // White Night (Kasumi + Yasha) ① adds Unsheathing; Polar Night from Zanya + White Night.
    play(g,['特殊召喚：宵刻刃－白夜','選択：宵刻刃－霞','選択：宵刻刃－夜叉','はい','PASS','宵刻の抜刀','PASS',
      '特殊召喚：宵刻刃－極夜','選択：宵刻刃－残夜','選択：宵刻刃－白夜','PASS']);
    assert(names(g,0,'monsters').includes('宵刻刃－極夜'));
    // Polar Night ①: it has Zanya's ② while Zanya is attached.
    assert(labels(g).some(l=>l==='効果発動：宵刻刃－極夜 / 縦列の相手のカードを破壊'),labels(g).join(' / '));
    // Yayoi: Polar Night + Oboro + 6 "宵刻刃" monsters from the hand.
    play(g,['特殊召喚：宵刻刃－夜宵','選択：宵刻刃－極夜','選択：宵刻刃－朧','選択：宵刻刃－朧','選択：宵刻刃－飛燕',
      '選択：宵刻刃－月影','選択：宵刻刃－月影','選択：宵刻刃－夜叉','選択：宵刻刃－夜叉']);
    assert(logged(g,/YOU：宵刻刃－夜宵 を特殊召喚/));
    assert.equal(zone(g,0,'hand').filter(c=>c.type&1).length,0,'all hand monsters became Link Material');
    // Polar Night left the field → ② grants the destroy effect; Zanya went to the GY → ① revives 5 monsters.
    play(g,['発動：宵刻刃－極夜','発動：宵刻刃－残夜','PASS','白夜|飛燕|霞|霞|月影','いいえ','PASS']);
    assert.equal(zone(g,0,'monsters').length,6);
    assert(!labels(g).some(l=>l.startsWith('効果発動：宵刻刃－夜宵 / 戻して')),'Yayoi is unaffected, so it is not granted the effect');
    play(g,['効果発動：宵刻刃－飛燕 / 戻してカードを破壊','P2 モンスター 1','PASS']);
    assert(names(g,0,'hand').includes('宵刻刃－飛燕'));
    assert.equal(zone(g,1,'monsters').length,4);
  }finally{g.close();}
});

test('Yayoi: Link Summon with hand materials, ② draws 3, recycles and destroys',async()=>{
  const g=await duel({deck0:[OBORO,YASHA,YASHA,HIEN,BATTO,ZETTO,SHUKUCHI,KAGEGAMAE],extra0:[YAYOI],deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[HIEN,KASUMI,OBORO,TSUKIKAGE,YASHA],mzone:[HIEN,KASUMI,OBORO]},p1:{mzone:[FRONT,FRONT],szone:[ABSOLUTE_ZERO]}});
  try{
    play(g,['PASS','特殊召喚：宵刻刃－夜宵','選択：宵刻刃－飛燕','選択：宵刻刃－飛燕','選択：宵刻刃－霞','選択：宵刻刃－霞',
      '選択：宵刻刃－朧','選択：宵刻刃－朧','選択：宵刻刃－月影','選択：宵刻刃－夜叉']);
    assert.deepEqual(names(g,0,'monsters'),['宵刻刃－夜宵']);
    assert.equal(zone(g,0,'hand').length,0);
    assert.equal(zone(g,0,'grave').length,8);
    play(g,['効果発動：宵刻刃－夜宵','PASS','はい','飛燕|飛燕|霞','はい','P2 モンスター 1|P2 モンスター 2|P2 魔法・罠 1']);
    assert(logged(g,/YOU が 3 枚ドロー/));
    assert.equal(zone(g,0,'grave').length,5,'3 cards went back to the Deck');
    assert.equal(zone(g,1,'grave').length,3,'and up to 3 cards were destroyed');
  }finally{g.close();}
});

test('Kasumi ② swaps a monster out (Hien ② then follows), Tsukikage ① ② and Moonshadow search',async()=>{
  let g=await duel({deck0:[OBORO,YASHA,ENBU,BATTO],deck1:[FRONT,FRONT],p0:{mzone:[KASUMI,HIEN]}});
  try{
    play(g,['PASS','効果発動：宵刻刃－霞','P1 モンスター 2','PASS','朧','はい']);
    // Oboro ① (Summoned) is chain 1; Hien ② (returned to the hand) follows as chain 2.
    assert(labels(g).some(l=>l.includes('発動：宵刻刃－飛燕 / 宵刻刃モンスターを特殊召喚')),labels(g).join(' / '));
    play(g,['発動：宵刻刃－飛燕','PASS','宵刻刃－夜叉','PASS','宵刻の抜刀']);
    assert.deepEqual(names(g,0,'monsters').sort(),['宵刻刃－霞','宵刻刃－朧','宵刻刃－夜叉'].sort());
    assert(names(g,0,'spells').includes('宵刻の抜刀'));
  }finally{g.close();}
  g=await duel({deck0:[OBORO,YASHA,ENBU,BATTO],deck1:[FRONT,FRONT],p0:{hand:[TSUKIKAGE],mzone:[HIEN]}});
  try{
    play(g,['PASS','効果発動：宵刻刃－月影','P1 モンスター 1','PASS','はい','PASS','宵刻の演舞']);
    assert.deepEqual(names(g,0,'monsters'),['宵刻刃－月影']);
    assert.deepEqual(names(g,0,'hand').sort(),['宵刻の演舞','宵刻刃－飛燕'].sort());
  }finally{g.close();}
});

test('Unsheathing: both choices',async()=>{
  let g=await duel({deck0:[OBORO,YASHA],deck1:[FRONT,FRONT],p0:{hand:[BATTO],mzone:[HIEN],grave:[TSUKIKAGE]}});
  try{
    play(g,['PASS','効果発動：宵刻の抜刀','戻して入れ替え','宵刻刃－飛燕','PASS','宵刻刃－朧']);
    assert.deepEqual(names(g,0,'monsters'),['宵刻刃－朧']);
    assert(names(g,0,'hand').includes('宵刻刃－飛燕'));
  }finally{g.close();}
  g=await duel({deck0:[OBORO,YASHA],deck1:[FRONT,FRONT],p0:{hand:[BATTO],mzone:[HIEN],grave:[TSUKIKAGE]}});
  try{
    play(g,['PASS','効果発動：宵刻の抜刀','墓地・除外から回収','宵刻刃－月影','PASS']);
    assert(names(g,0,'hand').includes('宵刻刃－月影'));
  }finally{g.close();}
});

test('Flash Step ① ② with Moonshadow ② and Yaksha ②',async()=>{
  const g=await duel({deck0:[OBORO,HIEN,ZETTO],deck1:[FRONT,FRONT],p0:{hand:[SHUKUCHI],mzone:[YASHA],grave:[TSUKIKAGE]},p1:{mzone:[FRONT]}});
  try{
    // ①: Moonshadow from the GY, then Yaksha (on the field) goes back to the hand.
    play(g,['PASS','効果発動：宵刻の縮地','PASS','宵刻刃－月影','P1 モンスター 1','はい','発動：宵刻刃－夜叉','PASS','宵刻刃－朧','PASS','宵刻の絶刀','PASS']);
    assert.deepEqual(names(g,0,'monsters').sort(),['宵刻刃－月影','宵刻刃－朧'].sort());
    assert(names(g,0,'hand').includes('宵刻刃－夜叉')&&names(g,0,'hand').includes('宵刻の絶刀'));
    // ②: banish it from the GY to protect Oboro.
    play(g,['効果発動：宵刻の縮地','宵刻刃－朧','PASS']);
    assert(names(g,0,'banished').includes('宵刻の縮地'));
    assert.equal(zone(g,0,'monsters').find(c=>c.name==='宵刻刃－朧').position,1);
  }finally{g.close();}
});

test('Zanya ② column destruction, Shadow Stance, White Night ② and Severing Blade',async()=>{
  const g=await duel({deck0:[OBORO,YASHA,KASUMI],deck1:[FRONT,FRONT,FRONT],
    p0:{mzone:[`${ZANYA}@0`,`${BYAKUYA}@1`,`${HIEN}@2`],szone:[`${KAGEGAMAE}@0`,`${ZETTO}@1`]},
    p1:{mzone:[`${FRONT}@2`],szone:[`${ABSOLUTE_ZERO}@0`],hand:[RAIGEKI,RAIGEKI]},set:[KAGEGAMAE,ZETTO]});
  try{
    // Zanya ② on Hien: destroys the opponent's card in that column, Hien goes back to the hand.
    play(g,['PASS','効果発動：宵刻刃－残夜','宵刻刃－飛燕','PASS']);
    assert.equal(zone(g,1,'monsters').length,0);
    assert(names(g,0,'hand').includes('宵刻刃－飛燕'));
    // Shadow Stance on Zanya (a Synchro): negate Absolute Zero, then destroy it.
    play(g,['効果発動：宵刻の影構え','宵刻刃－残夜','PASS','絶対零度嵐','はい','PASS']);
    assert(names(g,0,'extra').includes('宵刻刃－残夜'));
    assert(names(g,1,'grave').includes('嵐気流－絶対零度嵐'));
    // Opponent's turn: White Night ② (cost: Hien) negates and destroys Raigeki; Severing Blade (cost: White Night) negates and shuffles the second.
    play(g,['召喚：宵刻刃－飛燕','いいえ','PASS','ターンを終了','PASS','効果発動：サンダー・ボルト','発動：宵刻刃－白夜','宵刻刃－飛燕','PASS','PASS']);
    assert.equal(names(g,1,'grave').filter(n=>n==='サンダー・ボルト').length,1);
    const deckBefore=g.snapshot(1).players[1].deckCount;
    play(g,['効果発動：サンダー・ボルト','発動：宵刻の絶刀','宵刻刃－白夜','PASS']);
    assert.equal(names(g,1,'grave').filter(n=>n==='サンダー・ボルト').length,1,'the second Raigeki went to the Deck');
    assert.equal(g.snapshot(1).players[1].deckCount,deckBefore+1);
    assert(names(g,0,'extra').includes('宵刻刃－白夜'));
  }finally{g.close();}
});

test('Polar Night ● cannot be used again this turn by a monster with the returned monster name: Kasumi ① / Sword Dance ② loop stops, Hien still can',async()=>{
  const g=await duel({deck0:[OBORO,YASHA],extra0:[KYOKUYA],deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[HIEN,KASUMI,DARK_HOLE],mzone:[`${ZANYA}@0`,`${BYAKUYA}@1`],szone:[ENBU]},
    p1:{szone:[ABSOLUTE_ZERO,ABSOLUTE_ZERO,ABSOLUTE_ZERO]},set:[ABSOLUTE_ZERO]});
  try{
    // Xyz Summon Polar Night, destroy it with Dark Hole → Polar Night ② grants ● this turn (Zanya ① is declined).
    play(g,['PASS','特殊召喚：宵刻刃－極夜','選択：宵刻刃－残夜','選択：宵刻刃－白夜','PASS','効果発動：ブラック・ホール']);
    play(g,['発動しない','発動しない','発動：宵刻刃－極夜 / 宵刻刃モンスターに効果を与える','発動しない','PASS']);
    assert(names(g,0,'grave').includes('宵刻刃－極夜'));
    // Hien is Normal Summoned (① declined), Kasumi ① Special Summons itself: both gain ●.
    play(g,['召喚：宵刻刃－飛燕','いいえ','PASS','特殊召喚：宵刻刃－霞','PASS']);
    const grant=l=>l.includes('戻してカードを破壊');
    assert(labels(g).some(l=>l==='効果発動：宵刻刃－霞 / 戻してカードを破壊'),labels(g).join(' / '));
    assert(labels(g).some(l=>l==='効果発動：宵刻刃－飛燕 / 戻してカードを破壊'),labels(g).join(' / '));
    // 1st lap: Kasumi ● (Kasumi to the hand as cost) destroys 1 Set card; Sword Dance ② Normal Summons Kasumi again.
    play(g,['効果発動：宵刻刃－霞 / 戻してカードを破壊','P2 魔法・罠 1','PASS','はい','PASS','宵刻刃－霞','PASS']);
    assert.equal(zone(g,1,'spells').length,2);
    assert(names(g,0,'monsters').includes('宵刻刃－霞'));
    // 2nd lap: the re-summoned Kasumi cannot use ● again this turn, Hien (another name) still can.
    assert(!labels(g).some(l=>l==='効果発動：宵刻刃－霞 / 戻してカードを破壊'),labels(g).join(' / '));
    assert(labels(g).some(l=>l==='効果発動：宵刻刃－飛燕 / 戻してカードを破壊'),labels(g).join(' / '));
    play(g,['効果発動：宵刻刃－飛燕 / 戻してカードを破壊','P2 魔法・罠 2','PASS']);
    assert.equal(zone(g,1,'spells').length,1);
    assert(!labels(g).some(grant),'Hien name is used up too');
  }finally{g.close();}
});

test('Yaksha ①, Unsheathing ● 2 and White Night ① do not add Extra Deck monsters to the hand',async()=>{
  // Yaksha ①: Zanya (Synchro) in the GY is not a target; Moonshadow is.
  let g=await duel({deck0:[OBORO],deck1:[FRONT,FRONT],p0:{hand:[YASHA],grave:[ZANYA,TSUKIKAGE]}});
  try{
    play(g,['PASS','召喚：宵刻刃－夜叉','はい']);
    assert(labels(g).some(l=>l.includes('月影')),labels(g).join(' / '));
    assert(!labels(g).some(l=>l.includes('残夜')),labels(g).join(' / '));
  }finally{g.close();}
  // Unsheathing: with only Zanya in the GY, the recovery choice is not offered (and cannot be activated at all).
  g=await duel({deck0:[OBORO],deck1:[FRONT,FRONT],p0:{hand:[BATTO],grave:[ZANYA,BYAKUYA]}});
  try{
    pass(g);
    assert(!labels(g).some(l=>l.startsWith('効果発動：宵刻の抜刀')),labels(g).join(' / '));
  }finally{g.close();}
  g=await duel({deck0:[OBORO],deck1:[FRONT,FRONT],p0:{hand:[BATTO],grave:[ZANYA,TSUKIKAGE]}});
  try{
    play(g,['PASS','効果発動：宵刻の抜刀','墓地・除外から回収']);
    assert(labels(g).some(l=>l.includes('月影')),labels(g).join(' / '));
    assert(!labels(g).some(l=>l.includes('残夜')),labels(g).join(' / '));
  }finally{g.close();}
  // White Night ①: Zanya in the GY is not offered; Sword Dance in the Deck is.
  g=await duel({deck0:[ENBU],extra0:[BYAKUYA],deck1:[FRONT,FRONT],p0:{mzone:[KASUMI,YASHA],grave:[ZANYA]}});
  try{
    play(g,['PASS','特殊召喚：宵刻刃－白夜','選択：宵刻刃－霞','選択：宵刻刃－夜叉','はい','PASS']);
    assert(labels(g).some(l=>l.includes('宵刻の演舞')),labels(g).join(' / '));
    assert(!labels(g).some(l=>l.includes('残夜')),labels(g).join(' / '));
  }finally{g.close();}
});
