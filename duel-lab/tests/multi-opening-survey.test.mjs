import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {enumeratePairs,handUsage} from '../scripts/survey-multi-openings.mjs';

const preset=JSON.parse(fs.readFileSync(new URL('../preset.json',import.meta.url),'utf8'));
test('all legal name pairs independently sum to the 780 physical combinations',()=>{
  const pairs=enumeratePairs(preset.main);
  assert.equal(pairs.length,333);assert.equal(pairs.filter(pair=>pair.hand[0]===pair.hand[1]).length,8);
  const physical=new Map();
  for(let i=0;i<preset.main.length;i++)for(let j=i+1;j<preset.main.length;j++) {
    const id=[preset.main[i],preset.main[j]].sort((a,b)=>a-b).join('-');physical.set(id,(physical.get(id)||0)+1);
  }
  assert.equal(physical.size,pairs.length);
  for(const pair of pairs)assert.equal(pair.physicalWeight,physical.get(pair.id));
  assert.equal([...physical.values()].reduce((a,b)=>a+b,0),780);
});

const frame=(hand,chosen=[])=>({state:{own:{hand:hand.map(code=>JSON.stringify({code}))}},type:'SELECT_CARD',
  request:{kind:'multi',cards:chosen.map(code=>({code,controller:1,location:'Hand'}))},
  decision:{selection:chosen.map((_,index)=>index),cancel:false}});
const plan=(hand,requiredHand,states,lastHand)=>({hand,requiredHand,frames:states,final:{players:[{hand:lastHand.map(code=>({code}))}]}});

test('generic discard consumes the second opening card even though it is only a hand cost',()=>{
  const value=plan([30118811,40366667],[30118811,40366667],
    [frame([30118811,40366667],[30118811]),frame([40366667],[40366667]),frame([])],[]);
  const result=handUsage(value,{genericDiscard:true});
  assert.equal(result.kind,'both_initial_cards_left_hand');assert.equal(result.provenOriginalCardsLeftHand,2);
  assert.equal(result.genericDiscardTemplate,true);
});

test('a one-card route keeps a distinct partner separate from a two-card opening',()=>{
  const value=plan([69272449,40366667],[69272449],[frame([69272449,40366667],[69272449]),frame([40366667])],[40366667]);
  const result=handUsage(value,{});
  assert.equal(result.kind,'single_card_line_partner_retained');
  assert.equal(result.provenOriginalCardsLeftHand,1);assert.equal(result.matchingNamesRetainedAtEndpoint,1);
});

test('two required cards alone do not prove both were used, especially for identical copies',()=>{
  const value=plan([69272449,69272449],[69272449,69272449],
    [frame([69272449,69272449],[69272449]),frame([69272449])],[69272449]);
  const result=handUsage(value,{});
  assert.equal(result.kind,'usage_not_fully_identified');assert.equal(result.provenOriginalCardsLeftHand,1);
});

test('returning an opening card does not make its observed prior use disappear',()=>{
  const value=plan([96676583,64865],[96676583,64865],
    [frame([96676583,64865]),frame([64865]),frame([]),frame([96676583])],[96676583]);
  const result=handUsage(value,{});
  assert.equal(result.kind,'both_initial_cards_left_hand');assert.equal(result.matchingNamesRetainedAtEndpoint,1);
});
