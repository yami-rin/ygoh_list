import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pairs, selectShard, runPair, runShard, hasFirstTurnDraw, partitionResult} from '../scripts/search-multi-pairs.mjs';
import {enumeratePairs as surveyPairs} from '../scripts/survey-multi-openings.mjs';
import {preset, startRoute, respond, replay} from '../scripts/route-harness.mjs';

const pairIndex = hand => pairs.find(pair => pair.id === [...hand].sort((a,b) => a-b).join('-')).index;
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'astra-pair-search-'));

test('333 roots preserve physical multiplicity and form eight disjoint shards in the existing index order', () => {
  assert.equal(pairs.length, 333);
  assert.deepEqual(pairs.map(({id,hand,physicalWeight}) => ({id,hand,physicalWeight})), surveyPairs(preset.main));
  assert.equal(pairs.reduce((n,p) => n+p.physicalWeight, 0), 780);
  const shards = Array.from({length:8}, (_,i) => selectShard(i,8));
  assert.equal(new Set(shards.flat().map(pair => pair.index)).size, 333);
  assert.deepEqual(shards.map(shard => shard.length), [42,42,42,42,42,41,41,41]);
  assert.throws(() => selectShard(0,8,[1]), /outside shard/);
});

test('draw exclusions and adapter failures have different meanings; turn-2 normal draw remains a terminal', () => {
  assert(hasFirstTurnDraw([{turn:1,text:'YOU が 2 枚ドロー'}]));
  assert(!hasFirstTurnDraw([{turn:2,text:'ASTRA が 1 枚ドロー'}]));
  const result = partitionResult({frontier:[{prefix:[{action:1}],reason:'drawBoundary'}, {prefix:[],reason:'maxNodes'}],
    terminals:[{steps:[{input:{action:2}}],log:[{turn:1,text:'YOU が 2 枚ドロー'}]},
      {steps:[],log:[{turn:2,text:'ASTRA が 1 枚ドロー'}]}],
    rejected:[{prefix:[{action:3}],kind:'invalidResponse'}, {prefix:[{action:4}],kind:'coreRetry'}], failures:[]});
  assert.equal(result.excludedDraw.length, 2);
  assert.equal(result.search.terminals.length, 1);
  assert.equal(result.search.rejected.length, 1);
  assert(result.search.frontier.some(frame => frame.reason === 'unverifiedResponse'));
  assert.equal(result.search.complete, false);
  const onlyDraw = partitionResult({frontier:[{prefix:[{action:1}],reason:'drawBoundary'}],terminals:[],rejected:[],failures:[]});
  assert.equal(onlyDraw.search.complete, true);
  assert.equal(onlyDraw.excludedDraw.length, 1);
});

test('actual core: pair root generates fresh branches, resumes and independently replays a Main 1 winner', async () => {
  const runtimeDir = temporary(), index = pairIndex([40366667,78114463]);
  try {
    const first = await runPair({pairIndex:index,maxNodes:1,maxMs:10000,maxDepth:40,runtimeDir});
    assert.equal(first.summary.visited, 1);
    assert.equal(first.summary.status, 'incomplete');
    assert(first.summary.unresolved > 1);
    assert.equal(first.checkpoint.search.rootPrefix.length, 0);
    const second = await runPair({pairIndex:index,maxNodes:35,maxMs:10000,maxDepth:40,runtimeDir});
    assert(second.summary.visited > first.summary.visited);
    assert(second.checkpoint.bestPlayableMain1);
    assert.equal(second.checkpoint.bestPlayableMain1.final.turn, 1);
    assert.equal(second.checkpoint.bestPlayableMain1.final.phase, 'MAIN 1');
    await replay(second.checkpoint.bestPlayableMain1);
    assert(!hasFirstTurnDraw(second.checkpoint.bestPlayableMain1.log));
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(second.checkpointFile)).search, 'routes'), false);
    await assert.rejects(runPair({pairIndex:index,runtimeDir,resume:false}), /refuses to overwrite/);
    await assert.rejects(runPair({pairIndex:index,runtimeDir,seed:999}), /differs/);
  } finally {fs.rmSync(runtimeDir,{recursive:true,force:true});}
});

test('actual core: Allure draw branches are excluded and never scored, exported or resumed beyond DRAW', async () => {
  const runtimeDir = temporary(), index = pairIndex([1475311,40366667]);
  try {
    const result = await runPair({pairIndex:index,maxNodes:45,maxMs:10000,maxDepth:40,runtimeDir});
    assert(result.checkpoint.excludedDraw.length > 0, 'Actual Allure draws must have been reached');
    const excluded = result.checkpoint.excludedDraw.map(frame => frame.prefix);
    for (const frame of result.checkpoint.search.frontier) {
      assert(!excluded.some(prefix => JSON.stringify(frame.prefix.slice(0,prefix.length)) === JSON.stringify(prefix)));
    }
    for (const route of [result.checkpoint.bestMain1,result.checkpoint.bestPlayableMain1,...result.checkpoint.search.terminals].filter(Boolean)) {
      assert(!hasFirstTurnDraw(route.log));
    }
    // The last response may resolve the unknown draw; not one response follows it.
    const game = await startRoute(pairs[index].hand);
    try {
      for (const input of excluded[0]) { assert(!hasFirstTurnDraw(game.log)); respond(game,input); }
      assert(hasFirstTurnDraw(game.log));
    } finally {game.close();}
    const resumed = await runPair({pairIndex:index,maxNodes:1,maxMs:10000,maxDepth:40,runtimeDir});
    assert(resumed.checkpoint.excludedDraw.length >= excluded.length);
    assert(resumed.checkpoint.search.frontier.every(frame => frame.reason !== 'drawBoundary' && frame.reason !== 'excludedUnknownDraw'));
  } finally {fs.rmSync(runtimeDir,{recursive:true,force:true});}
});

test('actual core: shard output and complete-within-scope naming distinguish a finished small tree from unsearched roots', async () => {
  const runtimeDir = temporary(), index = pairIndex([33854624,72656408]);
  try {
    const report = await runShard({shard:index%8,shards:8,pairIndices:[index],maxNodesPerPair:40,maxMsPerPair:10000,maxDepth:30,runtimeDir});
    assert.equal(report.summary.searched,1);
    assert.equal(report.summary.completeWithinNoDrawScope,1);
    const row = report.pairs.find(pair => pair.index === index);
    assert.equal(row.status,'completeWithinNoDrawScope');
    assert.equal(row.allGamePatternsComplete,false);
    assert(row.terminalPaths > 0);
    assert.equal(report.summary.unresolved,0);
    assert(fs.existsSync(path.join(runtimeDir,'best-routes.json')));
    const exported = JSON.parse(fs.readFileSync(path.join(runtimeDir,'best-routes.json')));
    assert.equal(exported.sourceHash,report.sourceHash);
    assert.equal(exported.pairHash,report.pairHash);
    assert.equal(exported.generation,report.generation);
    assert.equal(report.summary.unsearched,report.assignedPairs-1);
    assert(!fs.existsSync(path.join(runtimeDir,'.search.lock')));
  } finally {fs.rmSync(runtimeDir,{recursive:true,force:true});}
});
