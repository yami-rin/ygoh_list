import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import createCore,{OcgMessageType as M,OcgQueryFlags as Q,OcgResponseType as R,OcgDuelMode as D} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {DATA,cards} from '../cards.mjs';
import {makePrompt,responseFor} from '../prompts.mjs';
import {patchCoreWrapper} from '../scripts/patch-core.mjs';

const C={warrior:16719140,behemoth:42713844,backup:30118811,wizard:3723262,advance:52112003};
const entry=(code,sequence,location=4)=>({code,team:0,controller:0,sequence,location,position:1});
function answer(g,input) {
 g.respond(g.pending.player^g.first,g.revision,input);
 assert.equal(g.validationError,null);assert.equal(g.errors.length,0);
}
function choose(g,predicate) {
 const option=g.prompt.choices.find(predicate);assert(option,'Expected core choice');answer(g,{action:option.id});
}

test('wrapper patch is idempotent and retains the three legacy fixes',()=>{
 const source=fs.readFileSync(new URL('../node_modules/ocgcore-wasm/dist/index.js',import.meta.url),'utf8');
 assert.equal(patchCoreWrapper(source),source);
 for(const marker of ['/* Astra Duel Lab wrapper fixes */','/* Astra Duel Lab SUM SORT protocol fixes v1 */'])
  assert.equal(source.split(marker).length,2);
 assert(source.includes('e.setUint32(44,t.rscale??0,!0),e.setUint32(48,t.link_marker??0,!0)'));
 assert(source.includes('s===u.TYPE&&o===4)t.type=e.u32()'));
 assert(source.includes('return this.off+=t,new Uint8Array(o)}u8()'));
 const damaged=source.replace('selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()}))','selects_must:[]');
 assert.throws(()=>patchCoreWrapper(damaged),/marker does not match/,'A marker must not conceal damaged patch code');
});

test('actual core SUM: two full location records remain optional and reject a redundant overpayment',async()=>{
 const own={main:[C.behemoth],extra:[]},empty={main:[],extra:[]};
 const g=await Duel.create([own,empty],{seed:924,fixtures:[C.warrior,C.backup,C.wizard].map((c,i)=>entry(c,i))});
 try {
  choose(g,c=>c.card?.code===C.warrior);
  answer(g,{selection:[0]});
  assert.equal(g.pending.type,M.SELECT_SUM);
  assert.equal(g.pending.player,0);assert.equal(g.pending.select_max,1);assert.equal(g.pending.amount,3);
  assert.deepEqual(g.pending.selects_must,[]);
  assert.deepEqual(g.pending.selects.map(c=>[c.code,c.controller,c.location,c.sequence,c.position,c.amount]),
   [[C.backup,0,4,1,1,3],[C.wizard,0,4,2,1,4]]);
  const pending=structuredClone(g.pending);
  g.respond(0,g.revision,{selection:[0,1]});
  assert.match(g.validationError,/拒否/);assert.deepEqual(g.pending,pending);
  answer(g,{selection:[1]});
  assert.equal(g.pending.type,M.SELECT_PLACE);answer(g,{selection:[0]});
  assert.equal(g.pending.type,M.SELECT_POSITION);choose(g,c=>c.response.position===4);
  const s=g.snapshot().players[0];
  assert(s.monsters.some(c=>c?.code===C.behemoth));assert(s.monsters.some(c=>c?.code===C.backup));
  assert(s.grave.some(c=>c?.code===C.wizard));assert(s.grave.some(c=>c?.code===C.warrior));
 }finally{g.close();}
});

for(const selection of [[4,3,2,1,0],[2,0,4,1,3]])test(`actual core SORT: exact top-deck order ${selection.join(',')}`,async()=>{
 const deck={main:[C.backup,C.wizard,74652966,18789533,69272449,32061192],extra:[]};
 const g=await Duel.create([deck,{main:[],extra:[]}],{seed:925,fixtures:[entry(C.advance,0,2)]});
 try {
  choose(g,c=>c.response.action===5&&c.card?.code===C.advance);answer(g,{selection:[0]});
  assert.equal(g.pending.type,M.ANNOUNCE_NUMBER);choose(g,c=>c.response.value===4);
  assert.equal(g.pending.type,M.SORT_CARD);assert.equal(g.prompt.cards.length,5);
  const revealed=g.prompt.cards.map(c=>c.code);
  answer(g,{selection});
  const deckAfter=g.lib.duelQueryLocation(g.handle,{controller:0,location:1,flags:Q.CODE}).map(c=>c.code);
  assert.deepEqual(deckAfter.slice(-5).reverse(),selection.map(i=>revealed[i]));
 }finally{g.close();}
});

// A small test-only Lua effect asks the real core for an exact sum including
// a mandatory level-2 monster. This exercises a protocol branch absent from
// the fixed Link deck without modifying official card scripts or production rules.
const probeCode=700000001;
const probeScript=`local s,id=GetID()
function s.initial_effect(c)
 local e=Effect.CreateEffect(c)
 e:SetType(EFFECT_TYPE_IGNITION)
 e:SetRange(LOCATION_MZONE)
 e:SetOperation(function(e,tp)
  local c=e:GetHandler()
  local g=Duel.GetMatchingGroup(function(tc) return tc~=c end,tp,LOCATION_MZONE,0,nil)
  Duel.SetSelectedCard(Group.FromCards(c))
  local selected=g:SelectWithSumEqual(tp,Card.GetLevel,5,1,1)
  Duel.SendtoGrave(selected,REASON_EFFECT)
 end)
 c:RegisterEffect(e)
end`;

async function sumWithMandatoryFixture() {
 const lib=await createCore({sync:true,wasmBinary:fs.readFileSync(path.join(DATA,'ocgcore.sync.wasm'))});
 const errors=[];
 const readScript=name=>{
  if(name===`c${probeCode}.lua`)return probeScript;
  for(const dir of ['', 'official']) {const f=path.join(DATA,'scripts',dir,name);if(fs.existsSync(f))return fs.readFileSync(f,'utf8');}
  return null;
 };
 const team={startingLP:8000,startingDrawCount:0,drawCountPerTurn:1};
 const handle=lib.createDuel({flags:D.MODE_MR5|D.PSEUDO_SHUFFLE,seed:[926n,2n,3n,4n],team1:team,team2:team,
  cardReader:code=>code===probeCode?{code,alias:0,setcodes:[],type:33,level:2,attribute:1,race:1n,attack:500,defense:500}:
   cards[code]?{...cards[code],race:BigInt(cards[code].race)}:null,
  scriptReader:readScript,errorHandler:(_,message)=>errors.push(message)});
 assert(handle);
 for(const name of ['constant.lua','utility.lua'])lib.loadScript(handle,name,readScript(name));
 for(const [sequence,code] of [probeCode,C.backup,C.wizard].entries())lib.duelNewCard(handle,{...entry(code,sequence),duelist:0});
 function advance() {
  const messages=[];
  for(let n=0;n<100;n++) {
   const result=lib.duelProcess(handle);messages.push(...lib.duelGetMessage(handle).filter(Boolean));
   assert.deepEqual(errors,[]);
   if(result!==2) {
    const last=messages.at(-1);
    if(last?.type===M.SELECT_CHAIN&&!last.selects.length&&!last.forced) {lib.duelSetResponse(handle,{type:R.SELECT_CHAIN,index:null});continue;}
    return messages;
   }
  }assert.fail('Protocol fixture did not yield');
 }
 lib.startDuel(handle);
 const idle=advance().find(m=>m.type===M.SELECT_IDLECMD);assert(idle);
 const index=idle.activates.findIndex(c=>c.code===probeCode);assert(index>=0);
 lib.duelSetResponse(handle,{type:R.SELECT_IDLECMD,action:5,index});
 const resulting=advance();
 const pending=resulting.find(m=>m.type===M.SELECT_SUM);assert(pending,JSON.stringify(resulting,(_,v)=>typeof v==='bigint'?String(v):v));
 return {lib,handle,pending,advance};
}

test('actual core SUM: mandatory and optional cards are distinct and the reply indexes only optional cards',async()=>{
 const {lib,handle,pending,advance}=await sumWithMandatoryFixture();
 try {
  assert.equal(pending.select_max,0);assert.equal(pending.amount,5);
  assert.deepEqual(pending.selects_must.map(c=>[c.code,c.sequence,c.position,c.amount]),[[probeCode,0,1,2]]);
  assert.deepEqual(pending.selects.map(c=>[c.code,c.sequence,c.position,c.amount]),[[C.backup,1,1,3],[C.wizard,2,1,4]]);
  const response=responseFor(pending,makePrompt(pending),{selection:[0]});
  lib.duelSetResponse(handle,response);
  const messages=advance();
  assert(!messages.some(m=>m.type===M.RETRY),'App SUM response must be accepted with mandatory cards');
  assert(lib.duelQueryLocation(handle,{controller:0,location:16,flags:Q.CODE}).some(c=>c?.code===C.backup));
  assert(lib.duelQueryLocation(handle,{controller:0,location:4,flags:Q.CODE}).some(c=>c?.code===C.wizard));
 }finally{lib.destroyDuel(handle);}
});
