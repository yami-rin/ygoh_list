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

test('Little Knight: ① own M∀LICE only, ② own M∀LICE plus opponent monsters',()=>{
  const rule=TARGET_RULES[29301450],first={min:1},second={min:2};
  assert.equal(rule.allow({code:69272449,controller:0},first),true);
  assert.equal(rule.allow({code:69272449,controller:1},first),false);
  assert.equal(rule.allow({code:78114463,controller:0},first),false);
  assert.equal(rule.allow({code:30118811,controller:1},second),true);
  assert.equal(rule.allow({code:30118811,controller:0},second),false);
  assert(cards[69272449].setcodes.includes(441));
});

test('user Dormouse replay: Neo Tempest ② sends Disablem first, which negates the opponent spell (found within 200 lines)',async()=>{
  const replays=JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes;
  const result=await evaluateRoute(replays.find(r=>r.id==='user-replay-cEErE6ce'),{maxLines:200});
  assert(result.breakdown.some(b=>b.code===92422871&&b.kinds.includes('negate')));
});

test('user-mirror-traps: the opponent holds Ash Blossom and Impermanence and fires them in its turn (Accord answers its Ash)',async()=>{
  const replays=JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes;
  const result=await evaluateRoute(replays.find(r=>r.id==='user-replay-cEErE6ce'),{maxLines:200,scenario:'user-mirror-traps'});
  assert(result.interruptions>=3);
  assert(result.breakdown.some(b=>b.code===39138610&&b.targets.includes('灰流うらら')));
});
