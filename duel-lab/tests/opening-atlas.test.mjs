import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {parseArgs,resolveOutput} from '../scripts/build-opening-atlas.mjs';
import {describeFrame,placement,publicState,validateReplay,hash} from '../scripts/opening-atlas-model.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/opening-atlas-spell-placement.json',import.meta.url),'utf8'));
const replayFor=plan=>({finalHash:hash(plan.final),states:[...plan.frames.map(frame=>publicState(frame.state.own)),publicState(plan.finalOwn)],
  steps:plan.frames.map(frame=>({label:describeFrame(frame,cards),prompt:frame.request.title??'カード選択',automatic:frame.automatic}))});

test('captured spell-set replay conserves its cards and places Allure in S1',()=>{
  const replay=replayFor(fixture.plan);
  assert.equal(replay.steps[1].label,'闇の誘惑を S1 に置く');
  assert.equal(replay.states[2].spells[0].code,1475311);
  assert.deepEqual(validateReplay(fixture.pair,replay,fixture.plan,fixture.preset,cards),{states:3,steps:2,questions:0,placements:1,placementAfterPosition:0});
});

test('spell masks are local to SpellZone, not global monster masks',()=>{
  const option={controller:1,mask:1,location:'SpellZone'};
  assert.deepEqual(placement(option),{monster:false,sequence:0,label:'S1'});
  assert.equal(placement({...option,location:'MonsterZone'}).label,'M1');
  assert.equal(placement({...option,location:'MonsterZone',mask:32}).label,'EXTRA 1');
  assert.equal(placement({...option,mask:32}).label,'フィールドゾーン');
  assert.throws(()=>placement({...option,mask:3}),/exactly one zone/);
  assert.throws(()=>placement({...option,controller:0}),/own field/);
});

test('wrong zone labels and a choice that disagrees with the core board are rejected',()=>{
  const wrongLabel=structuredClone(replayFor(fixture.plan));wrongLabel.steps[1].label='闇の誘惑を M1 に置く';
  assert.throws(()=>validateReplay(fixture.pair,wrongLabel,fixture.plan,fixture.preset,cards));
  const wrongChoice=structuredClone(fixture.plan);
  wrongChoice.frames[1].request.choices.find(c=>c.id===wrongChoice.frames[1].decision.action).option.mask=2;
  assert.throws(()=>validateReplay(fixture.pair,replayFor(wrongChoice),wrongChoice,fixture.preset,cards),/Placement does not resolve/);
});

test('a captured query losing a card or inventing extra copies is rejected',()=>{
  const lost=structuredClone(fixture.plan);lost.finalOwn.deckCount--;
  assert.throws(()=>validateReplay(fixture.pair,replayFor(lost),lost,fixture.preset,cards),/Unrepresented card/);
  const duplicated=structuredClone(fixture.plan);
  duplicated.finalOwn.hand.push(JSON.stringify({code:1475311}));duplicated.finalOwn.deckCount--;
  assert.throws(()=>validateReplay(fixture.pair,replayFor(duplicated),duplicated,fixture.preset,cards),/Too many copies/);
});

test('native question IDs preserve the explicit no-draw choice',()=>{
  const question={type:'SELECT_YESNO',request:{kind:'single',choices:[{id:0,option:{answer:false,context:{description:1527279939}}}]},decision:{action:0}};
  assert.equal(describeFrame(question,cards),'M∀LICE＜Q＞WHITE BINDER：１枚ドローしますか？ → いいえ');
  const modern=structuredClone(question);modern.request.choices[0].option.context.description=95454996*1048576+3;
  assert.throws(()=>describeFrame(modern,cards),/No verified question text/);
  const implicit={type:'SELECT_EFFECTYN',request:{kind:'single',choices:[{id:1,option:{answer:true,context:{card:{code:18789533},description:-1}}}]},decision:{action:1}};
  assert.equal(describeFrame(implicit,cards),'ドットスケーパーの効果を発動する');
});

test('CLI rejects ambiguous, unknown and incomplete arguments',()=>{
  assert.deepEqual(parseArgs([]),{});assert.deepEqual(parseArgs(['--help']),{help:true});
  assert.deepEqual(parseArgs(['--output','runtime/atlas']),{output:'runtime/atlas'});
  assert.deepEqual(parseArgs(['--verify','runtime/atlas']),{verify:'runtime/atlas'});
  for(const args of [['--output'],['--verify','--output'],['--unknown'],['--help','x'],['--output','a','--verify','b']])assert.throws(()=>parseArgs(args));
});

test('output refuses existing files, directory escape and junction escape without changing sentinels',()=>{
  const runtime=fileURLToPath(new URL('../runtime/',import.meta.url));fs.mkdirSync(runtime,{recursive:true});
  const temporary=fs.mkdtempSync(path.join(runtime,'night-atlas-test-'));
  try{
    const root=path.join(temporary,'repo'),run=path.join(root,'runtime'),outside=path.join(temporary,'outside');
    fs.mkdirSync(run,{recursive:true});fs.mkdirSync(outside);
    const existing=path.join(run,'existing');fs.mkdirSync(existing);fs.writeFileSync(path.join(existing,'keep.txt'),'unchanged');
    assert.equal(resolveOutput('runtime/new',{root}),path.join(run,'new'));
    assert.throws(()=>resolveOutput('runtime/existing',{root}),/already exists/);
    assert.throws(()=>resolveOutput('runtime/../source',{root}),/inside duel-lab\/runtime/);
    assert.throws(()=>resolveOutput('runtime',{root}),/inside duel-lab\/runtime/);
    fs.symlinkSync(outside,path.join(run,'redirect'),process.platform==='win32'?'junction':'dir');
    assert.throws(()=>resolveOutput('runtime/redirect/new',{root}),/outside the repository/);
    assert.equal(fs.readFileSync(path.join(existing,'keep.txt'),'utf8'),'unchanged');
    assert.deepEqual(fs.readdirSync(outside),[]);
  }finally{
    const resolved=fs.realpathSync(temporary);
    assert.equal(resolved,path.resolve(temporary));assert.equal(path.dirname(resolved),path.resolve(runtime));
    assert(path.basename(resolved).startsWith('night-atlas-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
