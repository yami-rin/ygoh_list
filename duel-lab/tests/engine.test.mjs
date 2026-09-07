import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Duel} from '../engine.mjs';
import {cards,byName,normalize,parseDeck} from '../cards.mjs';
import {astraPayload} from '../astra.mjs';
const preset=JSON.parse(fs.readFileSync(new URL('../preset.json',import.meta.url)));
const limits=JSON.parse(fs.readFileSync(new URL('../limits-202607.json',import.meta.url)));
const id=name=>byName.get(normalize(name)).code;
const rabbit=id('M∀LICE＜P＞White Rabbit'), gold=id('封印の黄金櫃'), terra=id('テラ・フォーミング'), ash=id('灰流うらら');
const empty={main:[],extra:[]};
function respond(g,input){g.respond(g.pending.player^g.first,g.revision,input);assert.equal(g.validationError,null);}
function select(g,match){const c=g.prompt.choices.find(c=>match(c));assert.ok(c,JSON.stringify(g.prompt,(_,v)=>typeof v==='bigint'?String(v):v));respond(g,{action:c.id});}
function cardSelect(g,code){const i=g.prompt.cards?.findIndex(c=>c.code===code);assert.ok(i>=0,JSON.stringify(g.prompt,(_,v)=>typeof v==='bigint'?String(v):v));respond(g,{selection:[i]});}
function pass(g){select(g,c=>c.label==='発動しない');}
test('deck validation: preset legal; limits, counts and wrong zones rejected',()=>{
  assert.equal(parseDeck(preset,limits).main.length,40);
  const d=structuredClone(preset);d.main[0]=id('M∀LICE＜Q＞RED RANSOM');assert.throws(()=>parseDeck(d,limits));
  assert.throws(()=>parseDeck({main:preset.main.slice(1),extra:[]},limits));
  const excess=structuredClone(preset);excess.main.push(ash);assert.throws(()=>parseDeck(excess,limits));
});
test('actual core: shuffle, private views, matching extra link arrows, stale and opponent rejection',async()=>{
  const a=await Duel.create([preset,preset],{seed:123}),b=await Duel.create([preset,preset],{seed:124});
  try{
    const s=a.snapshot(0);assert.equal(s.players[0].hand.length,5);assert.equal(s.players[1].hand.length,5);
    assert(s.players[1].hand.every(c=>c.hidden&&!c.code&&!c.text));
    assert(s.players[1].extra.every(c=>c.hidden&&!c.code));
    assert.notDeepEqual(s.players[0].hand.map(c=>c.code),b.snapshot().players[0].hand.map(c=>c.code));
    const wicked=s.players[0].extra.find(c=>c.code===id('サイバース・ウィキッド'));assert.equal(wicked.link.marker,6);assert.equal(wicked.link.rating,2);
    const payload=astraPayload(a);assert(payload.state.players[0].hand.every(c=>!c.code));assert.equal(payload.state.prompt,null);
    assert(!('seed' in payload));assert(!('deck' in payload.state.players[0]));
    assert.throws(()=>a.respond(1,a.revision,{action:0}),/相手/);
    assert.throws(()=>a.respond(0,a.revision-1,{action:0}),/更新/);
    assert.throws(()=>a.respond(0,a.revision,{action:999}),/無効/);
  }finally{a.close();b.close();}
});
test('actual M∀LICE: Gold Sarcophagus banishes Rabbit, 300 LP return, Rabbit sets trap',async()=>{
  const g=await Duel.create([preset,preset],{seed:123,fixtures:[{code:gold,team:0,controller:0,location:2,position:8}]});
  try{
    select(g,c=>c.response.action===5&&c.card?.code===gold);
    for(let n=0;n<30;n++){
      if(g.prompt.type==='SELECT_PLACE')respond(g,{selection:[0]});
      else if(g.prompt.type==='SELECT_CHAIN'){
        const trigger=g.prompt.choices.find(c=>c.card?.code===rabbit);if(trigger)respond(g,{action:trigger.id});else pass(g);
      }else if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===true);
      else if(g.prompt.type==='SELECT_CARD'){
        if(g.prompt.cards.some(c=>c.code===rabbit))cardSelect(g,rabbit);else respond(g,{selection:[0]});
      }else if(g.prompt.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
      else if(g.prompt.type==='SELECT_IDLECMD')break;
      else assert.fail('Unexpected '+g.prompt.type);
    }
    const s=g.snapshot();assert.equal(s.players[0].lp,7700);
    assert(s.players[0].monsters.some(c=>c?.code===rabbit));
    assert(s.players[0].spells.some(c=>c&&(c.type&4)));
    assert(g.log.some(e=>e.event==='chain'));assert(g.log.some(e=>e.event==='resolve'));
  }finally{g.close();}
});
test('actual chain: Ash negates Terraforming and consumes itself',async()=>{
  const g=await Duel.create([preset,preset],{fixtures:[{code:terra,team:0,controller:0,location:2,position:8},{code:ash,team:1,controller:1,location:2,position:8}]});
  try{
    select(g,c=>c.response.action===5&&c.card?.code===terra);
    let activated=false;
    for(let n=0;n<25;n++){
      if(g.prompt.type==='SELECT_PLACE')respond(g,{selection:[0]});
      else if(g.prompt.type==='SELECT_CHAIN'){
        const c=g.prompt.choices.find(c=>c.card?.code===ash);if(c){activated=true;respond(g,{action:c.id});}else pass(g);
      }else if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===true);
      else if(g.prompt.type==='SELECT_IDLECMD')break;
      else assert.fail('Unexpected '+g.prompt.type);
    }
    assert(activated);assert.equal(g.snapshot().players[0].hand.filter(Boolean).length,0);
    assert(g.snapshot(1).players[1].grave.some(c=>c?.code===ash));assert(g.log.some(e=>e.event==='negate'));
  }finally{g.close();}
});
test('actual combat: direct attacks, damage and victory',async()=>{
  const dragon=id('青眼の白龍');
  const g=await Duel.create([preset,preset],{fixtures:[0,1,2].map(sequence=>({code:dragon,team:0,controller:0,location:4,sequence,position:1}))});
  try{
    for(let n=0;n<50&&g.status==='playing';n++){
      if(g.prompt.type==='SELECT_IDLECMD')select(g,c=>c.response.action===(g.turnPlayer===0&&g.turn>1?6:7));
      else if(g.prompt.type==='SELECT_BATTLECMD')select(g,c=>c.response.action===1||c.response.action===3);
      else if(g.prompt.type==='SELECT_YESNO')select(g,c=>c.response.yes===true);
      else if(g.prompt.type==='SELECT_CHAIN')pass(g);
      else if(g.prompt.type==='SELECT_CARD')respond(g,{selection:[0]});
      else assert.fail('Unexpected '+g.prompt.type);
    }
    assert.equal(g.status,'ended');assert.equal(g.winner,0);assert(g.lp[1]<=0);
  }finally{g.close();}
});
test('actual hand Link material: Cat + Code Magician to Wicked, Dot into arrow, Cat return + Backup search',async()=>{
  const cat=id('M∀LICE＜P＞Cheshire Cat'),mag=id('サイバース・コード・マジシャン'),dot=id('ドットスケーパー'),dec=id('リンク・デコーダー'),wick=id('サイバース・ウィキッド');
  const g=await Duel.create([preset,preset],{fixtures:[cat,mag].map(code=>({code,team:0,controller:0,location:2,position:8}))});
  try{
    for(let n=0;n<40;n++) {
      const p=g.prompt;
      if(p.type==='SELECT_IDLECMD'){
        const c=p.choices.find(c=>c.response.action===0&&c.card?.code===cat)||p.choices.find(c=>c.response.action===1&&c.card?.code===dec)||p.choices.find(c=>c.response.action===1&&c.card?.code===wick);
        if(!c)break;respond(g,{action:c.id});
      }else if(p.type==='SELECT_UNSELECT_CARD')select(g,c=>c.label==='選択を確定'||c.label.startsWith('選択：'));
      else if(p.type==='SELECT_CHAIN')select(g,c=>[mag,dot,wick,cat].includes(c.card?.code)||c.label==='発動しない');
      else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO')select(g,c=>c.response.yes===true);
      else if(p.type==='SELECT_PLACE'){const i=p.cards.findIndex(c=>c.place.sequence===1);respond(g,{selection:[i>=0?i:0]});}
      else if(p.type==='SELECT_CARD'){let i=p.cards.findIndex(c=>c.code===dot);if(i<0)i=p.cards.findIndex(c=>c.code===cat);respond(g,{selection:[i>=0?i:0]});}
      else if(p.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
      else assert.fail('Unexpected '+p.type);
    }
    const s=g.snapshot();assert.equal(s.players[0].lp,7700);
    assert(s.players[0].hand.some(c=>c?.code===id('バックアップ＠イグニスター')));
    assert(s.players[0].monsters.some(c=>c?.code===wick));assert(s.players[0].monsters.some(c=>c?.code===cat));
    assert(s.players[0].grave.some(c=>c?.code===mag));
  }finally{g.close();}
});
