import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Duel} from '../engine.mjs';

export const preset=JSON.parse(fs.readFileSync(new URL('../preset.json',import.meta.url)));
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
export const hash=x=>crypto.createHash('sha256').update(JSON.stringify(safe(x))).digest('hex');
export function board(g) {
  const s=g.snapshot(0);
  return {turn:s.turn,phase:s.phase,lp:s.players.map(p=>p.lp),players:s.players.map(p=>
    Object.fromEntries(['hand','monsters','spells','grave','banished','extra'].map(z=>[z,p[z].map(c=>c?{code:c.code||0,position:c.position,sequence:c.sequence}:null)])))};
}
export async function startRoute(hand,{seed=123,deckOrder}={}) {
  const own=structuredClone(preset);
  for(const code of hand) {
    const i=own.main.indexOf(code);assert(i>=0,'Hand must be taken from preset');own.main.splice(i,1);
  }
  if(deckOrder) {
    assert.deepEqual([...deckOrder].sort((a,b)=>a-b),[...own.main].sort((a,b)=>a-b),'Deck order must preserve every remaining card copy');
    own.main=[...deckOrder];
  }
  const g=await Duel.create([own,preset],{seed,fixtures:hand.map(code=>({code,team:0,controller:0,location:2,position:8}))});
  g.route={hand:[...hand],seed,...(deckOrder?{deckOrder:[...deckOrder]}:{}),presetHash:hash(preset),steps:[]};
  return g;
}
export function respond(g,input) {
  const picked=g.prompt.choices.find(c=>c.id===input.action);
  const label=picked?.label || (input.selection||[]).map(i=>g.prompt.cards?.[i]?.label||g.prompt.cards?.[i]?.code||String(i)).join(' / ');
  const step={prompt:g.prompt.type,label,before:hash({pending:g.pending,board:board(g)}),input:safe(input)};
  g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});
  assert.equal(g.validationError,null,'Core rejected route response');assert.equal(g.errors.length,0);
  g.route.steps.push(step);
}
export function select(g,predicate) {
  const choice=g.prompt.choices.find(predicate);
  assert(choice,`No matching choice: ${JSON.stringify(safe(g.prompt))}`);
  respond(g,{action:choice.id});
}
export function selectCard(g,code) {
  const i=g.prompt.cards.findIndex(c=>c.code===code);assert(i>=0,`Card ${code} absent`);respond(g,{selection:[i]});
}
export function finishRoute(g,metadata={}) {
  assert.equal(g.errors.length,0);
  return {...metadata,...g.route,final:board(g),finalHash:hash(board(g)),log:safe(g.log),verified:true};
}
export async function replay(route) {
  assert.equal(route.presetHash,hash(preset),'Preset changed: re-research route');
  assert.equal(hash(route.final),route.finalHash,'Stored final board was modified');
  const g=await startRoute(route.hand,{seed:route.seed,deckOrder:route.deckOrder});
  try {
    for(const step of route.steps) {
      assert.equal(g.prompt.type,step.prompt);
      assert.equal(hash({pending:g.pending,board:board(g)}),step.before,'Route state drift');
      respond(g,step.input);
      assert.equal(g.route.steps.at(-1).label,step.label,'Stored decision label was modified');
    }
    assert.equal(hash(board(g)),route.finalHash,'Final board drift');
    return board(g);
  } finally {g.close();}
}
