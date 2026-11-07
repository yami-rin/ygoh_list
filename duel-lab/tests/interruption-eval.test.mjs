import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateRoute,TARGET_RULES} from '../scripts/interruption-eval.mjs';
import {cards} from '../cards.mjs';

const routes=JSON.parse(fs.readFileSync(new URL('../routes/multi-search-best.json',import.meta.url))).routes;
const route=id=>routes.find(r=>r.id===id);

test('a set God Notice negates the opponent activation once',async()=>{
  const result=await evaluateRoute(route('pair-search-185-30118811-78114463'));
  assert.equal(result.complete,true);
  assert.equal(result.interruptions,1);
  assert.equal(result.breakdown[0].code,78114463);
  assert(result.breakdown[0].kinds.includes('negate'));
});

test('summoning from a set trap alone is not counted as an interruption',async()=>{
  const result=await evaluateRoute(route('pair-search-177-30118811-57111661'));
  assert.equal(result.complete,true);
  assert.equal(result.interruptions,0);
});

test('Little Knight only targets our own M∀LICE cards',()=>{
  const rule=TARGET_RULES[29301450];
  assert.equal(rule.allow({code:69272449,controller:0}),true);
  assert.equal(rule.allow({code:69272449,controller:1}),false);
  assert.equal(rule.allow({code:78114463,controller:0}),false);
  assert(cards[69272449].setcodes.includes(441));
});
