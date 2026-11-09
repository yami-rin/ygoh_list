// Fixes from the 2026-11-09 audit of the 99 original cards:
// activation checks (an effect cannot be activated when it cannot be resolved, and "その後、〜する" needs the second half too),
// and the places where the scripts did not follow the card text.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../custom-cards.mjs';
import {Duel} from '../engine.mjs';

const LOC={hand:2,mzone:4,szone:8,grave:16,removed:32};
// zone entries are codes or "code@sequence"; codes listed in `set` are placed face-down in the Spell & Trap Zone
async function duel({deck0=[],extra0=[],deck1=[],extra1=[],p0={},p1={},set=[]}){
  const fixtures=[];
  for(const [player,zones] of [[0,p0],[1,p1]])for(const [zone,codes] of Object.entries(zones))codes.forEach((entry,i)=>{
    const [code,seq]=String(entry).split('@').map(Number);
    fixtures.push({code,team:player,controller:player,location:LOC[zone],position:zone==='hand'?8:zone==='szone'&&set.includes(code)?10:1,sequence:seq===undefined||Number.isNaN(seq)?i:seq});
  });
  return Duel.create([{main:deck0,extra:extra0},{main:deck1,extra:extra1}],{seed:1,fixtures});
}
const labels=g=>!g.prompt?[]:g.prompt.mode==='single'?g.prompt.choices.map(c=>c.label):g.prompt.cards.map(c=>`${c.label} ${c.detail||''}`);
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
const pass=g=>{auto(g);while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない')){pick(g,'発動しない');auto(g);}};
function play(g,steps){for(const s of steps){if(s==='PASS'){pass(g);continue;}auto(g,s);pick(g,s);}auto(g);}
const offered=(g,text)=>labels(g).some(l=>l.includes(text));
const zone=(g,player,key,viewer=player)=>g.snapshot(viewer).players[player][key].filter(Boolean);
const names=(g,player,key,viewer=player)=>zone(g,player,key,viewer).map(c=>c.name);

const FRONT=77700202,RAIGEKI=12580477,RAIOH=71564252,KURIBOH=40640057,BLUE_EYES=89631139;
const HERALD=77700101,DUST=77700102,SHADE=77700103,IDOL=77700104,TYRANT=77700105,GLORY=77700106,EROSION=77700107;

// ---- A. effects that could be activated although they could not be resolved

test('Tyrant ② needs a "Decline" monster to search that is not one of the 2 banished cards',async()=>{
  const g=await duel({deck0:[DUST,GLORY,FRONT,FRONT],deck1:[FRONT],p0:{mzone:[TYRANT]}});
  try{
    pass(g);
    assert(!offered(g,'効果発動：凋落の暴君－タイラント'),labels(g).join(' / '));
  }finally{g.close();}
});

test('Tyrant ② banishes only a pair that leaves a monster to add, then Normal Summons',async()=>{
  const g=await duel({deck0:[DUST,SHADE,GLORY],deck1:[FRONT],p0:{mzone:[TYRANT]}});
  try{
    play(g,['PASS','効果発動：凋落の暴君－タイラント']);
    // banishing Dust and Shade together would leave nothing to add: after Dust, only Glory may join it
    pick(g,'凋落の残滓－ダスト');
    assert.deepEqual(g.prompt.cards.map(c=>c.label),['凋落する栄華'],labels(g).join(' / '));
    pick(g,'凋落する栄華');
    pass(g);
    for(let i=0;i<2&&g.prompt?.mode==='multi';i++){pick(g,'凋落の影－シェイド');auto(g);}
    pass(g);
    assert.equal(names(g,0,'banished').length,2);
    assert.equal(names(g,0,'monsters').length,2,'the added monster was Normal Summoned');
  }finally{g.close();}
});

test('Tyrant ② "then you Normal Summon 1 monster": not activatable when nothing could be Normal Summoned',async()=>{
  // Idol (Level 10) is the only monster to add and there is no Tribute for it
  const g=await duel({deck0:[IDOL,GLORY,EROSION],deck1:[FRONT],p0:{mzone:[TYRANT]}});
  try{
    pass(g);
    assert(!offered(g,'効果発動：凋落の暴君－タイラント'),labels(g).join(' / '));
  }finally{g.close();}
});

test('Zanya ② needs an opponent\'s card in the column of the target',async()=>{
  const ZANYA=77700406;
  for(const [seq,expect] of [[0,false],[4,true]]){
    // your Main Monster Zone 0 faces the opponent's zone 4
    const g=await duel({deck1:[FRONT],p0:{mzone:[`${ZANYA}@0`]},p1:{mzone:[`${FRONT}@${seq}`]}});
    try{
      pass(g);
      assert.equal(offered(g,'効果発動：宵刻刃－残夜'),expect,`opponent at ${seq}: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Idol ② needs a "Decline" monster in the Deck that can be Normal Summoned, and cannot pick the Idol it shuffled in',async()=>{
  let g=await duel({deck0:[TYRANT,FRONT],deck1:[FRONT],p0:{hand:[IDOL]}});
  try{
    pass(g);
    assert(!offered(g,'効果発動：凋落の虚像－アイドル'),'Tyrant (Level 6) has no Tribute');
  }finally{g.close();}
  g=await duel({deck0:[DUST],deck1:[FRONT],p0:{hand:[IDOL],mzone:[FRONT,FRONT]}});
  try{
    play(g,['PASS','効果発動：凋落の虚像－アイドル','PASS']);
    if(g.prompt?.mode==='multi')assert(!offered(g,'アイドル'),labels(g).join(' / '));
    play(g,['凋落の残滓－ダスト']);
    assert(names(g,0,'monsters').includes('凋落の残滓－ダスト'));
    assert(!names(g,0,'monsters').includes('凋落の虚像－アイドル'));
  }finally{g.close();}
});

test('Revert ● Set from the hand needs a second free Spell & Trap Zone',async()=>{
  const S=77700412;
  for(const [filled,expect] of [[4,false],[3,true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT],p0:{hand:[77700010],szone:Array(filled).fill(S),grave:[77700008]},set:[S]});
    try{
      pass(g);
      assert.equal(offered(g,'連鎖律の遡及 / 魔法・罠をセット'),expect,`${filled} zones used: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Unquell ② needs a material left on this card after detaching 1',async()=>{
  const LOWELL=77700705,UNQUELL=77700707;
  const UNQ2='効果発動：秩序騎士アンクウェル / フィールドのカードを除外';
  const g=await duel({deck0:[FRONT,FRONT],extra0:[UNQUELL],deck1:[FRONT],p0:{mzone:[LOWELL,LOWELL]},p1:{mzone:[BLUE_EYES,BLUE_EYES,BLUE_EYES]}});
  try{
    play(g,['PASS','特殊召喚：秩序騎士アンクウェル','選択：秩序騎士ローウェル','選択：秩序騎士ローウェル']);
    if(g.prompt?.choices?.some(c=>c.label==='選択を確定'))pick(g,'選択を確定');
    auto(g);
    if(g.prompt?.type==='SELECT_EFFECTYN')pick(g,'いいえ');
    pass(g);
    // 2 materials: detach 1, banish up to 1
    assert(offered(g,UNQ2),labels(g).join(' / '));
    play(g,[UNQ2,'PASS']);
    if(g.prompt?.mode==='multi'&&offered(g,'ローウェル'))pick(g,'ローウェル');
    pick(g,'青眼');pass(g);
    assert.equal(zone(g,1,'banished',0).length,1);
    // 1 material: detaching it leaves nothing to count
    assert(!offered(g,UNQ2),labels(g).join(' / '));
  }finally{g.close();}
});

const AMP=77700007,CYCLONE=5318639,SWORDS=72302403;
test('Amplification ② places a counter when an effect resolves, not when it is activated',async()=>{
  // a "Chain Code" monster is on the field, so only the counters decide ③
  const g=await duel({deck0:[77700001,FRONT],deck1:[FRONT],p0:{szone:[AMP],mzone:[77700002],hand:[CYCLONE]},p1:{szone:[SWORDS]}});
  try{
    // Chain 1 Amplification ①, Chain 2 Cyclone: nothing has resolved yet, so ③ is not open at Chain 3
    play(g,['PASS','効果発動：連鎖律の増幅','発動：サイクロン','護封剣']);
    assert(!offered(g,'発動：連鎖律の増幅'),labels(g).join(' / '));
    pass(g);
    if(g.prompt?.mode==='multi')pick(g,'連鎖律－イニシエータ');
    pass(g);
    assert(names(g,0,'hand').includes('連鎖律－イニシエータ'));
    assert(offered(g,'効果発動：連鎖律の増幅 / 攻撃力アップ'),labels(g).join(' / '));
  }finally{g.close();}
});

test('Amplification ③ needs a face-up "Chain Code" monster',async()=>{
  const g=await duel({deck0:[77700001,FRONT],deck1:[FRONT],p0:{szone:[AMP],hand:[CYCLONE]},p1:{szone:[SWORDS]}});
  try{
    play(g,['PASS','効果発動：連鎖律の増幅','発動：サイクロン','護封剣']);
    pass(g);
    if(g.prompt?.mode==='multi')pick(g,'連鎖律－イニシエータ');
    pass(g);
    // 2 counters, but no "Chain Code" monster on the field
    assert(!offered(g,'効果発動：連鎖律の増幅 / 攻撃力アップ'),labels(g).join(' / '));
    play(g,['召喚：連鎖律－イニシエータ']);
    if(g.prompt?.type==='SELECT_EFFECTYN')pick(g,'いいえ');
    pass(g);
    assert(offered(g,'効果発動：連鎖律の増幅 / 攻撃力アップ'),labels(g).join(' / '));
  }finally{g.close();}
});

test('Interference ● (send to the GY / add as Chain Link 3+) checks the action its Chain Link needs',async()=>{
  const INTERF=77700008,EXT=77700002,TERM=77700003;
  // Rai-Oh: cards cannot be added from the Deck to the hand
  for(const [opp,expect] of [[RAIOH,false],[FRONT,true]]){
    const g=await duel({deck0:[77700001,FRONT,FRONT,FRONT],deck1:[FRONT,FRONT],p0:{hand:[RAIGEKI,EXT,TERM,INTERF]},p1:{mzone:[opp]}});
    try{
      // Chain 1 Thunder Bolt, Chain 2 Extender ①, Chain 3 Terminator ①: Interference would be Chain Link 4
      play(g,['PASS','発動：サンダー・ボルト','発動：連鎖律－エクステンダー','発動：連鎖律－ターミネータ']);
      assert.equal(offered(g,'連鎖律の干渉 / 連鎖律カードを墓地へ送る'),expect,`${opp}: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
  // as Chain Link 1 it sends to the GY, which Rai-Oh does not stop
  const g=await duel({deck0:[77700001,FRONT],deck1:[FRONT],p0:{hand:[INTERF]},p1:{mzone:[RAIOH]}});
  try{
    pass(g);
    assert(offered(g,'連鎖律の干渉 / 連鎖律カードを墓地へ送る'),labels(g).join(' / '));
  }finally{g.close();}
});

test('Terminator ①: Special Summon, then you can negate 1 face-up opponent card (also activatable with nothing to negate)',async()=>{
  const INIT=77700001,TERM=77700003,INTERF=77700008;
  const flow=['PASS','召喚：連鎖律－イニシエータ','はい','発動：連鎖律－ターミネータ','PASS'];
  // no face-up opponent card
  let g=await duel({deck0:[INTERF,INTERF],deck1:[FRONT],p0:{hand:[INIT,TERM]}});
  try{
    play(g,flow);
    assert(names(g,0,'monsters').includes('連鎖律－ターミネータ'));
  }finally{g.close();}
  for(const answer of ['はい','いいえ']){
    g=await duel({deck0:[INTERF,INTERF],deck1:[FRONT],p0:{hand:[INIT,TERM]},p1:{mzone:[FRONT]}});
    try{
      play(g,flow);
      assert(['SELECT_YESNO','SELECT_EFFECTYN'].includes(g.prompt?.type),`the negation is optional: ${g.prompt?.type} ${labels(g).join(' / ')}`);
      pick(g,answer);
      // "はい" goes on to choose the card to negate, "いいえ" skips it
      const choosing=g.prompt?.mode==='multi'&&offered(g,'嵐気流－停滞する前線');
      assert.equal(choosing,answer==='はい',`${answer}: ${g.prompt?.type} ${labels(g).join(' / ')}`);
      if(choosing)pick(g,'嵐気流－停滞する前線');
      pass(g);
      assert(names(g,0,'monsters').includes('連鎖律－ターミネータ'));
    }finally{g.close();}
  }
});

// ---- rule: "その後、〜する" needs the second half; "その後、〜できる" does not

test('Renzuru ① needs a "Kamiori" monster in the Deck to add',async()=>{
  const RENZURU=77700603;
  for(const [deck,expect] of [[[FRONT],false],[[77700601],true]]){
    const g=await duel({deck0:deck,deck1:[FRONT],p0:{hand:[RENZURU]}});
    try{
      pass(g);
      assert.equal(offered(g,'効果発動：神折の霊鳥－レンヅル'),expect,labels(g).join(' / '));
    }finally{g.close();}
  }
});

test('Mihashira ② needs an unused zone whose column has an opponent\'s card to return',async()=>{
  const MIHASHIRA=77700609;
  // Mihashira in zone 0 (facing the opponent's zone 4), the cost is the monster in zone 1 (facing zone 3)
  for(const [seq,expect] of [[4,true],[3,true],[0,true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT],p0:{mzone:[`${MIHASHIRA}@0`,`${FRONT}@1`]},p1:{mzone:[`${FRONT}@${seq}`]}});
    try{
      pass(g);
      assert.equal(offered(g,'効果発動：神折神－ミハシラ'),expect,`opponent at ${seq}: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Eye ② needs a card to send from the opponent\'s hand: their hand or one of their face-up Spells/Traps',async()=>{
  const EYE=77700204;
  // Declining Glory: a face-up Continuous Spell in the Spell & Trap Zone
  for(const [p1,expect] of [[{},false],[{szone:[GLORY]},true],[{hand:[FRONT]},true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT],p0:{hand:[EYE],mzone:[FRONT,FRONT],szone:[GLORY]},p1});
    try{
      play(g,['PASS','召喚：嵐気流－眼の観測者','停滞する前線|停滞する前線']);
      const choices=g.prompt?.type==='SELECT_EFFECTYN'||offered(g,'嵐気流－眼の観測者');
      assert.equal(!!choices,expect,`${JSON.stringify(p1)}: ${g.prompt?.type} ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Absolute Zero needs a lower-Level "Storm Flow" Synchro Monster in the Extra Deck',async()=>{
  const ZERO=77700207,GALE=77700208,GUST=77700209,PEAK=77700210;
  // Cyclone (Level 7) goes back to the Extra Deck: Gust Max is Level 10, Gale is Level 6
  for(const [extra,expect] of [[[PEAK],false],[[GALE],true]]){
    const g=await duel({deck0:[FRONT,FRONT],extra0:extra,deck1:[FRONT,FRONT],extra1:[GUST],p0:{mzone:[GUST],szone:[ZERO]},p1:{mzone:[77700201,FRONT]}});
    try{
      play(g,['PASS','ターンを終了','PASS','特殊召喚：嵐気流－暴風圏','偏西風','停滞する前線']);
      assert.equal(offered(g,'嵐気流－絶対零度嵐'),expect,`${extra}: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Declining Glory ③ targets a face-up monster whose original ATK gives at least 1 draw',async()=>{
  for(const [opp,expect] of [[KURIBOH,false],[FRONT,true]]){
    const g=await duel({deck0:[FRONT,FRONT],deck1:[FRONT],p0:{szone:[GLORY]},p1:{mzone:[opp]}});
    try{
      pass(g);
      assert.equal(offered(g,'効果発動：凋落する栄華'),expect,`${opp}: ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

test('Admission ② needs a "Gokasou" Spell/Trap in your GY to add',async()=>{
  const ADM=77700307,GUIDE=77700301,BONFIRE=77700306;
  for(const [grave,expect] of [[[],false],[[BONFIRE],true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT,FRONT,FRONT],p0:{hand:[GUIDE],szone:[ADM],grave}});
    try{
      play(g,['PASS','召喚：業火葬－送り火の導き手']);
      const seen=g.prompt?.type==='SELECT_EFFECTYN'||offered(g,'業火葬の受入');
      assert.equal(seen,expect,`${grave}: ${g.prompt?.type} ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});

// ---- B. the scripts follow the text

test('Herald ① lowers ATK only when it added a monster',async()=>{
  for(const [deck,atk] of [[[FRONT,FRONT],1600],[[DUST,FRONT],600]]){
    const g=await duel({deck0:deck,deck1:[FRONT],p0:{hand:[HERALD]},p1:{mzone:[FRONT]}});
    try{
      play(g,['PASS','召喚：凋落の先触れ－ヘラルド','PASS']);
      if(g.prompt?.mode==='multi')pick(g,'凋落の残滓－ダスト');
      pass(g);
      assert.equal(zone(g,1,'monsters',0)[0].attack,atk);
    }finally{g.close();}
  }
});

test('Absolute Definition counts face-up "Chain Code" cards only',async()=>{
  const AD=77700012,INTERF=77700008,INIT=77700001;
  for(const [own,expect] of [[{szone:[AD,INTERF]},false],[{szone:[AD],mzone:[INIT]},true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT],p0:{hand:[RAIGEKI],...own},p1:{mzone:[FRONT]},set:[AD,INTERF]});
    try{
      play(g,['PASS','発動：サンダー・ボルト']);
      let seen=false;
      for(let i=0;i<4&&g.prompt?.type==='SELECT_CHAIN';i++){
        if(offered(g,'連鎖律の絶対定義')){seen=true;break;}
        pick(g,'発動しない');auto(g);
      }
      assert.equal(seen,expect);
    }finally{g.close();}
  }
});

test('Purgatory ① is used up when it resolves, even if you do not add a card',async()=>{
  const PURG=77700305,BONFIRE=77700306;
  const g=await duel({deck0:[BONFIRE,BONFIRE,FRONT],deck1:[FRONT],p0:{hand:[PURG,PURG]}});
  try{
    play(g,['PASS','発動：業火葬場－『煉獄』','PASS']);
    assert(['SELECT_YESNO','SELECT_EFFECTYN'].includes(g.prompt?.type));
    pick(g,'いいえ');pass(g);
    play(g,['発動：業火葬場－『煉獄』','PASS']);
    assert(!['SELECT_YESNO','SELECT_EFFECTYN'].includes(g.prompt?.type),`${g.prompt?.type}`);
    assert(!names(g,0,'hand').includes('業火葬－浄化の焚き火'));
  }finally{g.close();}
});

test('Purifying Bonfire ② locks the card name when it resolves, so ① can still be chained to it',async()=>{
  const BONFIRE=77700306;
  const g=await duel({deck0:[FRONT,FRONT],deck1:[FRONT],p0:{hand:[BONFIRE],grave:[BONFIRE]},p1:{grave:[FRONT,FRONT]}});
  try{
    play(g,['PASS','効果発動：業火葬－浄化の焚き火 / 除外して１枚ドロー']);
    assert(offered(g,'発動：業火葬－浄化の焚き火'),labels(g).join(' / '));
    pass(g);
    assert(!offered(g,'発動：業火葬－浄化の焚き火'),'locked for the rest of the Duel');
  }finally{g.close();}
});

test('Alms ① continues to the Special Summon only when the card was destroyed',async()=>{
  const ALMS=77700608,MIHASHIRA=77700609,HITOGATA=77700602,LOWELL=77700705,LAWRY=77700701;
  for(const [target,expect] of [['秩序騎士ロウリー',false],['青眼',true]]){
    const g=await duel({deck0:[FRONT],deck1:[FRONT],p0:{szone:[ALMS],mzone:[MIHASHIRA,FRONT],grave:[HITOGATA]},p1:{mzone:[LOWELL,LAWRY,BLUE_EYES]}});
    try{
      play(g,['PASS','効果発動：神折の喜捨','停滞する前線','PASS',target]);
      pass(g);
      assert.equal(['SELECT_YESNO','SELECT_EFFECTYN'].includes(g.prompt?.type),expect,`${target}: ${g.prompt?.type} ${labels(g).join(' / ')}`);
    }finally{g.close();}
  }
});
