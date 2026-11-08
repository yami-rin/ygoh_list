// Fixes for two Chain Code cards reported from MDPro3 play:
// Terminator ② is activated only from the GY, and Overclock ① can Set a monster (face-down Defense Position).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../custom-cards.mjs';
import {Duel} from '../engine.mjs';

const LOC={hand:2,mzone:4,szone:8,grave:16,removed:32};
async function duel({deck0=[],extra0=[],deck1=[],extra1=[],p0={},p1={}}){
  const fixtures=[];
  for(const [player,zones] of [[0,p0],[1,p1]])for(const [zone,codes] of Object.entries(zones))
    codes.forEach((code,sequence)=>fixtures.push({code,team:player,controller:player,location:LOC[zone],position:zone==='hand'?8:1,sequence}));
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
const pass=g=>{auto(g);while(g.prompt?.type==='SELECT_CHAIN'&&g.prompt.choices.some(c=>c.label==='発動しない')){pick(g,'発動しない');auto(g);}};
function play(g,steps){for(const s of steps){if(s==='PASS'){pass(g);continue;}auto(g,s);pick(g,s);}auto(g);}

const chainDeck=[77700001,77700002,77700004,77700007,77700008,77700009,77700010,77700011,77700012].flatMap(c=>[c,c]);
// Chain 1 Initiator ①, Chain 2 Extender ①, Chain 3 Assembler ①: the next window is "Chain Link 3 or higher".
const toChain3=['PASS','召喚：連鎖律－イニシエータ','はい','発動：連鎖律－エクステンダー','発動：連鎖律－アセンブラ'];

test('Terminator ② is offered from the GY only, not from the hand',async()=>{
  const g=await duel({deck0:chainDeck,deck1:[77700202,77700202],p0:{hand:[77700001,77700002,77700004,77700003],grave:[77700003]},p1:{mzone:[77700202]}});
  try{
    play(g,toChain3);
    const banish=g.prompt.choices.filter(c=>c.label.includes('発動：連鎖律－ターミネータ / 相手のカードを除外'));
    assert.equal(banish.length,1,labels(g).join(' / '));
    assert.equal(banish[0].card.location,16,'② comes from the GY copy');
    play(g,['発動：連鎖律－ターミネータ / 相手のカードを除外','PASS','P2 モンスター 1']);
    assert(g.log.some(e=>/CHAIN 4：連鎖律－ターミネータ/.test(e.text)));
    assert.equal(g.snapshot(0).players[1].banished.filter(Boolean).length,1,'the opponent card was banished');
  }finally{g.close();}
});

test('Terminator ② cannot be activated from the hand or from banishment',async()=>{
  const g=await duel({deck0:chainDeck,deck1:[77700202,77700202],p0:{hand:[77700001,77700002,77700004,77700003],removed:[77700003]},p1:{mzone:[77700202]}});
  try{
    play(g,toChain3);
    assert(!labels(g).some(l=>l.includes('相手のカードを除外')),labels(g).join(' / '));
    // ① ("Special Summon from hand/banishment") is still available by its own text.
    assert(labels(g).some(l=>l.includes('発動：連鎖律－ターミネータ / 特殊召喚して無効')));
  }finally{g.close();}
});

for(const [kind,from,expect] of [['monster','エクステンダー','連鎖律－エクステンダー'],['deck monster','アセンブラ','連鎖律－アセンブラ']]){
  test(`Overclock ① Sets a ${kind} face-down in Defense Position`,async()=>{
    const g=await duel({deck0:chainDeck,deck1:chainDeck,extra1:[],p0:{hand:[77700001]},p1:{mzone:[77700006],hand:[77700002]}});
    try{
      play(g,['PASS','召喚：連鎖律－イニシエータ','はい','発動：連鎖律－オーバークロック','PASS']);
      // Monster or Spell/Trap is chosen first, so monsters are not buried in the list.
      assert.equal(g.prompt.type,'SELECT_OPTION');
      assert.deepEqual(g.prompt.choices.map(c=>c.label),['モンスターを裏側守備表示でセット','魔法・罠カードをセット']);
      pick(g,'モンスターを裏側守備表示でセット');
      assert(g.prompt.cards.every(c=>c.type&1),'only monsters are listed');
      pick(g,from);auto(g);
      const set=g.snapshot(1).players[1].monsters.filter(Boolean).find(c=>c.name===expect);
      assert(set,`${expect} is on the field`);
      assert.equal(set.position,8,'face-down Defense Position');
    }finally{g.close();}
  });
}

test('Overclock ① still Sets a "Chain Code" Spell/Trap',async()=>{
  const g=await duel({deck0:chainDeck,deck1:chainDeck,p0:{hand:[77700001]},p1:{mzone:[77700006]}});
  try{
    play(g,['PASS','召喚：連鎖律－イニシエータ','はい','発動：連鎖律－オーバークロック','PASS','魔法・罠カードをセット','連鎖律の執行']);auto(g);
    const set=g.snapshot(1).players[1].spells.filter(Boolean).find(c=>c.name==='連鎖律の執行');
    assert(set);assert.equal(set.position,10,'face-down');
  }finally{g.close();}
});
