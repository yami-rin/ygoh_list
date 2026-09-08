// Expectations come from an independent WASM replay; the native suite checks
// the actual product policy, native cards/engine, and wire responses against it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadOpeningTemplates,bestOpening} from '../opening-policy.mjs';
import {preset,hash} from './route-harness.mjs';

const seeds=[['rabbit',[69272449]],['backup-ash',[30118811,14558127]],['cat-mag',[96676583,64865]],
  ['mag-dormouse',[64865,32061192]],['mag-ogre',[64865,59438930]],['underground-soul',[68337209,74652966]],
  ['cat-magnamhut',[96676583,33854624]],['hare-tb',[20938824,57111661]],['dormouse-tb',[32061192,57111661]],
  ['rabbit-shifter',[69272449,91800273]],['cat-cat',[96676583,96676583]],['underground-underground',[68337209,68337209]]];
const templates=await loadOpeningTemplates(),fixtures=[];
for(const [id,seed] of seeds){
  const hand=[...seed];
  for(const code of [40366667,40366667,78114463,20726052,94722358]){
    if(hand.length===5)break;
    if(hand.filter(c=>c===code).length<preset.main.filter(c=>c===code).length)hand.push(code);
  }
  assert.equal(hand.length,5);
  const {plan}=await bestOpening(templates,hand);assert(plan,`No playable candidate for ${id}`);
  const own=plan.final.players[0];
  const finalMainHand=own.hand.map(c=>c.code);
  const endPhaseSearch=id==='cat-magnamhut'?{triggerCode:33854624,searchCode:72656408}:undefined;
  if(endPhaseSearch)assert(preset.main.includes(endPhaseSearch.searchCode));
  fixtures.push({id,hand,routeId:plan.id,lp:plan.final.lp[0],monsters:own.monsters.filter(Boolean).map(c=>c.code),
    spells:own.spells.filter(Boolean).map(c=>c.code),finalMainHand,
    terminalHand:endPhaseSearch?[...finalMainHand,endPhaseSearch.searchCode]:finalMainHand,endPhaseSearch,
    wasmFinalHash:plan.finalHash??hash(plan.final),score:plan.score,frames:plan.frames.length});
}
fs.mkdirSync(new URL('../tests/fixtures/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../tests/fixtures/multi-openings-native.json',import.meta.url),JSON.stringify({presetHash:hash(preset),fixtures},null,2)+'\n');
console.log(JSON.stringify(fixtures.map(({id,routeId,frames})=>({id,routeId,frames}))));
