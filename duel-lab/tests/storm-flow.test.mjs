// 嵐気流（ストーム・フロー） original cards: custom/storm-flow.json + custom/scripts/c777002xx.lua
import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {Duel} from '../engine.mjs';

const WESTERLIES=77700201,FRONT=77700202,TURBULENCE=77700203,EYE=77700204,ATMOSPHERE=77700205,BLOWBACK=77700206,
  ABSOLUTE_ZERO=77700207,GALE=77700208,CYCLONE=77700209,GUST_MAX=77700210,RAIGEKI=12580477;
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

test('Storm Flow original cards are loaded with their theme code 0x7c1',()=>{
  const cards=customCards.filter(c=>c.custom==='storm-flow.json');
  assert.equal(cards.length,10);
  assert(cards.every(c=>c.setcodes.includes(0x7c1)&&c.code>=77700201&&c.code<=77700210));
  assert(cards.filter(c=>c.type&1).every(c=>c.attribute===8),'all monsters are WIND');
});

test('Storm Flow combo: Front → Westerlies → Turbulence bounce chain, then Cyclone with Atmosphere',async()=>{
  const g=await duel({
    deck0:[WESTERLIES,WESTERLIES,FRONT,TURBULENCE,TURBULENCE,EYE,EYE,ATMOSPHERE,ATMOSPHERE,BLOWBACK,ABSOLUTE_ZERO,ABSOLUTE_ZERO],
    extra0:[GALE,CYCLONE,GUST_MAX],deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[FRONT,WESTERLIES,TURBULENCE,BLOWBACK,EYE]},p1:{mzone:[FRONT],szone:[ABSOLUTE_ZERO]}});
  try{
    // Front ①: search Atmosphere, Front returns to hand → Front ② Special Summons itself + Westerlies.
    play(g,['PASS','召喚：嵐気流－停滞する前線','はい','発動しない','極地的大気圏','発動：嵐気流－停滞する前線','発動しない','偏西風']);
    assert.deepEqual(names(g,0,'monsters').sort(),['嵐気流－停滞する前線','嵐気流－偏西風'].sort());
    // Westerlies ②: search Eye, Westerlies returns → Turbulence ② Special Summons itself + Westerlies.
    play(g,['はい','PASS','嵐気流－眼の観測者','発動：嵐気流－乱気流の発生源','PASS','偏西風','PASS']);
    // Turbulence ①: discard Blowback, add Westerlies + Turbulence, Turbulence returns to hand.
    play(g,['はい','PASS','強烈な吹き返し','偏西風|乱気流','PASS']);
    assert(names(g,0,'grave').includes('嵐気流－強烈な吹き返し'));
    assert.deepEqual(names(g,0,'monsters').sort(),['嵐気流－停滞する前線','嵐気流－偏西風'].sort());
    // Atmosphere, then Synchro Summon Cyclone (WIND Tuner Westerlies + Front) → Atmosphere ② returns the opponent's Front → ③ draws 1.
    play(g,['効果発動：嵐気流－極地的大気圏','PASS','特殊召喚：嵐気流－暴風圏','選択：嵐気流－偏西風','選択：嵐気流－停滞する前線',
      '発動：嵐気流－極地的大気圏','P2 モンスター 1','PASS','はい','PASS']);
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－暴風圏']);
    assert.equal(zone(g,1,'monsters').length,0,'the opponent Front went back to the hand');
    assert(logged(g,/YOU が 1 枚ドロー/),'Atmosphere ③ drew 1');
  }finally{g.close();}
});

test('Blowback returns your WIND Synchro and two opponent cards',async()=>{
  const g=await duel({deck0:[WESTERLIES,FRONT],extra0:[CYCLONE],deck1:[FRONT,FRONT],
    p0:{hand:[BLOWBACK],mzone:[GALE]},p1:{hand:[FRONT,TURBULENCE,WESTERLIES],mzone:[FRONT],szone:[ABSOLUTE_ZERO]}});
  try{
    play(g,['PASS','効果発動：嵐気流－強烈な吹き返し','P2 モンスター 1|P2 魔法・罠 1','PASS','疾風圏','PASS']);
    assert(names(g,0,'extra').includes('嵐気流－疾風圏'),'Gale went back to the Extra Deck');
    assert.equal(zone(g,1,'hand',1).length,5);
    assert.equal(zone(g,1,'monsters').length+zone(g,1,'spells').length,0);
  }finally{g.close();}
});

test('Westerlies ① ② and Eye ① ②: bounce, search, swap in and strip the Spell & Trap Zones',async()=>{
  const g=await duel({deck0:[WESTERLIES,FRONT,TURBULENCE],extra0:[CYCLONE],deck1:[FRONT,FRONT],
    p0:{hand:[EYE,WESTERLIES],mzone:[FRONT]},p1:{hand:[FRONT,TURBULENCE,ATMOSPHERE],mzone:[FRONT],szone:[ABSOLUTE_ZERO]}});
  try{
    // Westerlies ① targets the opponent's Front, ② searches Turbulence and returns Westerlies.
    play(g,['PASS','効果発動：嵐気流－偏西風','P2 モンスター 1','PASS','はい','PASS','乱気流の発生源','PASS']);
    assert.equal(zone(g,1,'monsters').length,0);
    assert(names(g,0,'hand').includes('嵐気流－乱気流の発生源')&&names(g,0,'hand').includes('嵐気流－偏西風'));
    // Eye ① returns Front and comes out; Eye ② returns Absolute Zero and discards 1 random card.
    play(g,['効果発動：嵐気流－眼の観測者','PASS','停滞する前線','PASS','はい','PASS']);
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－眼の観測者']);
    assert.equal(zone(g,1,'spells').length,0);
    assert.equal(zone(g,1,'grave').length,1,'one random card from the opponent hand');
  }finally{g.close();}
});

test('Eye ② is once per turn: a second Eye summoned with a face-up Spell on the field offers nothing',async()=>{
  const MESSENGER=44656491,REBORN=83764718;
  const g=await duel({deck0:[WESTERLIES,WESTERLIES],deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[EYE,MESSENGER,REBORN],mzone:[FRONT],grave:[EYE]},p1:{hand:[FRONT,TURBULENCE],szone:[ABSOLUTE_ZERO]}});
  try{
    play(g,['PASS','効果発動：嵐気流－眼の観測者','PASS','停滞する前線','PASS','はい','PASS']);
    assert.equal(zone(g,1,'grave').length,1,'the first Eye ② resolved');
    play(g,['発動：平和の使者','PASS','発動：死者蘇生','PASS','眼の観測者','PASS']);
    assert.equal(names(g,0,'monsters').filter(n=>n==='嵐気流－眼の観測者').length,2);
    assert(names(g,0,'spells').includes('平和の使者'),'a face-up Spell is there to return');
    assert(!(g.prompt.choices||[]).some(c=>/眼の観測者/.test(c.label)&&!/召喚|特殊召喚：/.test(c.label)),'Eye ② is not offered again');
    assert.equal(zone(g,1,'grave').length,1,'no second discard');
  }finally{g.close();}
});

test('Eye ② chooses how many random cards to discard, up to the number returned',async()=>{
  const g=await duel({deck0:[WESTERLIES],deck1:[FRONT,FRONT,FRONT],
    p0:{hand:[EYE],mzone:[FRONT]},p1:{hand:[FRONT,TURBULENCE,ATMOSPHERE],szone:[ABSOLUTE_ZERO,ABSOLUTE_ZERO]}});
  try{
    play(g,['PASS','効果発動：嵐気流－眼の観測者','PASS','停滞する前線','PASS','はい','PASS']);
    assert.equal(g.prompt.type,'ANNOUNCE_NUMBER');
    assert.deepEqual(g.prompt.choices.map(c=>c.label),['1','2']);
    play(g,['2']);
    assert.equal(zone(g,1,'spells').length,0);
    assert.equal(zone(g,1,'grave').length,2);
    assert.equal(zone(g,1,'hand',1).length,3,'3 + 2 returned - 2 discarded');
  }finally{g.close();}
});

test('Westerlies ③ Synchro Summons Gale in the opponent Main Phase; Gale ① sets and bounces, ② recycles itself',async()=>{
  const g=await duel({deck0:[BLOWBACK,ABSOLUTE_ZERO,WESTERLIES],extra0:[GALE,GALE],deck1:[FRONT,FRONT,FRONT],
    p0:{mzone:[WESTERLIES,TURBULENCE]},p1:{mzone:[FRONT],szone:[ABSOLUTE_ZERO]}});
  try{
    play(g,['PASS','ターンを終了','PASS','バトルフェイズへ','発動：嵐気流－偏西風','PASS','疾風圏','選択：嵐気流－偏西風','選択：嵐気流－乱気流の発生源']);
    assert(logged(g,/YOU：嵐気流－疾風圏 を特殊召喚/));
    // Gale ①: Set Blowback, return the opponent's Absolute Zero.
    play(g,['はい','PASS','強烈な吹き返し','P2 魔法・罠 1']);
    assert(names(g,0,'spells').includes('嵐気流－強烈な吹き返し'));
    assert.equal(zone(g,1,'spells').length,0);
    // Gale ② (opponent's turn): back to the Extra Deck, return the opponent's Front, Special Summon Gale again.
    play(g,['発動：嵐気流－疾風圏','P2 モンスター 1','PASS','疾風圏','PASS']);
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－疾風圏']);
    assert.equal(zone(g,1,'monsters').length,0);
    assert.equal(zone(g,1,'hand',1).length,3);
  }finally{g.close();}
});

test('Absolute Zero negates an opponent Synchro Summon and brings out a lower-Level Storm Flow Synchro',async()=>{
  const g=await duel({deck0:[BLOWBACK,WESTERLIES],extra0:[CYCLONE,GALE],deck1:[FRONT,FRONT,FRONT],extra1:[CYCLONE],
    p0:{mzone:[GUST_MAX],szone:[ABSOLUTE_ZERO]},p1:{mzone:[WESTERLIES,FRONT]}});
  try{
    play(g,['PASS','ターンを終了','PASS','特殊召喚：嵐気流－暴風圏','選択：嵐気流－偏西風','選択：嵐気流－停滞する前線',
      '発動：嵐気流－絶対零度嵐','最大瞬間風速','暴風圏','PASS']);
    assert(logged(g,/CHAIN 1：嵐気流－絶対零度嵐/));
    assert.equal(zone(g,1,'monsters').length,0,'the Summon was negated');
    assert.equal(zone(g,1,'extra',1).length,1,'the negated Cyclone went back to its Extra Deck');
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－暴風圏'],'Gust Max (Lv10) was exchanged for Cyclone (Lv7)');
    assert(names(g,0,'extra').includes('嵐気流－最大瞬間風速'));
  }finally{g.close();}
});

test('Cyclone ① answers an opponent effect, ② calls Gust Max, Gust Max ① clears the field and ② negates',async()=>{
  const g=await duel({deck0:[BLOWBACK,WESTERLIES],extra0:[GUST_MAX],deck1:[FRONT,FRONT,FRONT],
    p0:{mzone:[CYCLONE,FRONT],szone:[ABSOLUTE_ZERO]},p1:{szone:[ABSOLUTE_ZERO],hand:[RAIGEKI,WESTERLIES]}});
  try{
    // Opponent: Raigeki. Cyclone ① chains: Front back to hand, opponent's Absolute Zero back to hand.
    play(g,['PASS','ターンを終了','PASS','効果発動：サンダー・ボルト','発動：嵐気流－暴風圏','PASS','停滞する前線','P2 魔法・罠','PASS']);
    assert(names(g,0,'hand').includes('嵐気流－停滞する前線'));
    assert.equal(zone(g,1,'spells').length,0);
    // Raigeki destroys Cyclone → Cyclone ② Special Summons Gust Max → Gust Max ① returns every other card (own Absolute Zero).
    play(g,['はい','PASS','最大瞬間風速','PASS']);
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－最大瞬間風速']);
    assert(names(g,0,'hand').includes('嵐気流－絶対零度嵐'));
    assert.equal(zone(g,0,'spells').length,0);
    // Gust Max ②: the opponent's Westerlies ① is negated and shuffled into the Deck.
    const deckBefore=g.snapshot(1).players[1].deckCount;
    play(g,['効果発動：嵐気流－偏西風','P1 モンスター','発動：嵐気流－最大瞬間風速','PASS']);
    assert(logged(g,/CHAIN 1 無効/));
    assert.equal(g.snapshot(1).players[1].deckCount,deckBefore+1);
    assert.deepEqual(names(g,0,'monsters'),['嵐気流－最大瞬間風速']);
  }finally{g.close();}
});

test('Atmosphere ① keeps WIND Synchros from being targeted by the opponent',async()=>{
  const g=await duel({deck0:[WESTERLIES],deck1:[FRONT,FRONT,FRONT],
    p0:{mzone:[CYCLONE,FRONT],szone:[`${ATMOSPHERE}@5`]},p1:{mzone:[WESTERLIES],szone:[BLOWBACK]},set:[BLOWBACK]});
  try{
    play(g,['PASS','ターンを終了','PASS','効果発動：嵐気流－強烈な吹き返し']);
    const targets=labels(g);
    assert(targets.some(l=>l.includes('嵐気流－停滞する前線')),targets.join(' / '));
    assert(!targets.some(l=>l.includes('嵐気流－暴風圏')),'Cyclone (WIND Synchro) cannot be targeted');
  }finally{g.close();}
});
