import test from 'node:test';
import assert from 'node:assert/strict';
import {customCards} from '../custom-cards.mjs';
import {cards} from '../cards.mjs';
import {Duel} from '../engine.mjs';

const pick=(g,text)=>{
  const p=g.prompt;
  if(p.mode==='single'){const c=p.choices.find(c=>c.label.includes(text));assert(c,`${text} | ${p.choices.map(c=>c.label).join(' / ')}`);g.respond(g.pending.player^g.first,g.revision,{action:c.id},{snapshot:false});}
  else{const i=p.cards.findIndex(c=>c.label.includes(text));assert(i>=0,text);g.respond(g.pending.player^g.first,g.revision,{selection:[i]},{snapshot:false});}
  assert.equal(g.validationError,null);
};
const pass=g=>{while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない'))pick(g,'発動しない');};

test('Chain Code original cards are loaded with their theme code',()=>{
  const chain=customCards.filter(c=>c.custom==='chain-code.json');
  assert.equal(chain.length,12);
  assert.equal(cards[77700001].name,'連鎖律－イニシエータ');
  assert(chain.every(c=>c.setcodes.includes(0x1f0)));
});

test('Initiator search chains into Extender and a Chain Link 4 Dominate adds two monsters',async()=>{
  const x3=c=>[c,c,c];
  const main=[77700001,77700002,77700003,77700004,77700007,77700008,77700009,77700010,77700011,77700012].flatMap(x3);
  const hand=[77700001,77700002,77700004,77700008,77700009];
  const own={main:[...main],extra:[77700005,77700006]};
  for(const c of hand)own.main.splice(own.main.indexOf(c),1);
  const g=await Duel.create([own,{main,extra:[]}],{seed:1,fixtures:hand.map(code=>({code,team:0,controller:0,location:2,position:8}))});
  try{
    pass(g);pick(g,'召喚：連鎖律－イニシエータ');pick(g,'自分 モンスター 3');pick(g,'はい');
    // Initiator ② is not offered in the same chain as its ①.
    assert(!g.prompt.choices.some(c=>c.label.includes('発動：連鎖律－イニシエータ')));
    pick(g,'発動：連鎖律－エクステンダー');pick(g,'発動：連鎖律－アセンブラ');pick(g,'発動：連鎖律の掌握 / モンスターを手札に加える');pick(g,'自分 魔法・罠 1');pass(g);
    assert.equal(g.prompt.max,2,'Chain Link 4 Dominate may add two monsters');
    g.respond(0,g.revision,{selection:[2,7]},{snapshot:false});
    assert(g.log.some(e=>/CHAIN 4 解決/.test(e.text)));
  }finally{g.close();}
});

test('Decline: Herald Tribute Summons Tyrant, Tyrant adds Idol, Idol is Tribute Summoned with only Tyrant',async()=>{
  const x3=c=>[c,c,c];
  const main=[77700101,77700102,77700103,77700104,77700105,77700106,77700107,77700108].flatMap(x3);
  const hand=[77700101,77700102,77700105,77700106,77700107];
  const own={main:[...main],extra:[]};
  for(const c of hand)own.main.splice(own.main.indexOf(c),1);
  const g=await Duel.create([own,{main,extra:[]}],{seed:1,fixtures:hand.map(code=>({code,team:0,controller:0,location:2,position:8}))});
  try{
    pass(g);pick(g,'召喚：凋落の先触れ－ヘラルド');pick(g,'自分 モンスター 3');pass(g);pick(g,'凋落の暴君－タイラント');
    pass(g);pick(g,'効果発動：凋落の先触れ－ヘラルド');pick(g,'凋落の暴君－タイラント');pick(g,'凋落の先触れ－ヘラルド');pick(g,'自分 モンスター 3');
    pass(g);pick(g,'効果発動：凋落の暴君－タイラント');
    // the 2 cards to banish are chosen one at a time (the pair must leave a "Decline" monster to add)
    pick(g,'ダスト');pick(g,'シェイド');
    pick(g,'凋落の虚像－アイドル');pick(g,'凋落の虚像－アイドル');pick(g,'凋落の暴君－タイラント');pick(g,'自分 モンスター 3');
    assert(g.log.some(e=>/YOU：凋落の虚像－アイドル を召喚/.test(e.text)));
    assert.equal(g.snapshot(0).players[0].grave.filter(c=>c.code===77700105).length,1,'only Tyrant was Tributed');
  }finally{g.close();}
});
