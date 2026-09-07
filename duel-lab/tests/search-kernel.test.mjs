import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {enumerateCandidates, search} from '../scripts/search-kernel.mjs';
import {startRoute, respond} from '../scripts/route-harness.mjs';

const all = p => [...enumerateCandidates(p)];
const rabbit = 69272449;

test('candidate enumeration retains optional choices, duplicate card indices, zones and orders', () => {
  assert.deepEqual(all({mode: 'single', choices: [{id: 0}, {id: 1}]}), [{action: 0}, {action: 1}]);
  assert.deepEqual(all({mode: 'multi', type: 'SELECT_CARD', cards: [{code: 1}, {code: 1}], min: 1, max: 2, canCancel: true}),
    [{cancel: true}, {selection: [0]}, {selection: [1]}, {selection: [0, 1]}]);
  assert.equal(all({mode: 'multi', type: 'SELECT_PLACE', cards: [{}, {}, {}, {}, {}], min: 1, max: 1}).length, 5);
  const ordered = all({mode: 'order', cards: [{}, {}, {}]});
  assert.equal(ordered.length, 6);
  assert.equal(new Set(ordered.map(x => JSON.stringify(x))).size, 6);
  assert.equal(all({mode: 'multi', type: 'SELECT_TRIBUTE', cards: [{}, {}, {}], min: 2, max: 2}).length, 8);
  assert.equal(all({mode: 'multi', type: 'SELECT_SUM', cards: [{}, {}], min: 1, max: 1}).length, 4);
  assert.deepEqual(all({mode: 'counter', cards: [{count: 1}, {count: 2}], count: 2}),
    [{selection: [], counters: [0, 2]}, {selection: [], counters: [1, 1]}]);
});

test('actual core: all Rabbit initial responses become replayable bounded frontier', async () => {
  const game = await startRoute([rabbit]);
  let inputs;
  try { inputs = all(game.prompt); } finally { game.close(); }
  const result = await search({hand: [rabbit], maxNodes: 1, maxDepth: 30, maxMs: 30000});
  assert.equal(result.visited, 1);
  assert.equal(result.complete, false);
  assert.equal(result.frontier.length, inputs.length);
  assert.deepEqual(result.frontier.map(f => f.prefix[0]).reverse(), inputs);
  assert.equal(result.pruning.stateMerging, false);
  for (const frontier of result.frontier) {
    const g = await startRoute([rabbit]);
    try { respond(g, frontier.prefix[0]); } finally { g.close(); }
  }
});

test('actual core: depth boundary, checkpoint resume and end-turn terminal', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-search-test-'));
  try {
    const file = path.join(directory, 'checkpoint.json');
    const bounded = await search({hand: [], maxDepth: 0, checkpointPath: file, maxMs: 30000});
    assert.equal(bounded.complete, false);
    assert.equal(bounded.frontier[0].reason, 'maxDepth');
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(file)), 'routes'), false);
    const resumed = await search({resume: file, maxDepth: 5, maxNodes: 10, maxMs: 30000});
    assert.equal(resumed.complete, true);
    assert.equal(resumed.terminals.length, 1);
    assert.equal(resumed.routes[0].terminalReason, 'firstTurnEnded');
    assert.equal(resumed.routes[0].final.turn, 2);
    assert.equal(resumed.failures.length, 0);
    await assert.rejects(search({resume: bounded, hand: [rabbit]}), /differs/);
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});

test('actual core: generation budget retains ungenerated choices; observer stops remain unresolved', async () => {
  const bounded = await search({hand: [rabbit], maxNodes: 1, maxGenerated: 1, maxMs: 30000});
  assert(bounded.frontier.some(f => f.reason === 'maxGenerated' && f.nextCandidate === 1));
  assert(bounded.frontier.some(f => f.prefix.length === 1));
  const resumed = await search({resume: bounded, maxNodes: 8, maxDepth: 1, maxMs: 30000});
  assert.equal(resumed.complete, false);
  assert.equal(resumed.failures.length, 0);
  assert(resumed.frontier.some(f => f.reason === 'maxDepth'));
  const custom = await search({hand: [rabbit], onNode: () => ({stop: true, reason: 'draw-handoff'}), maxMs: 30000});
  assert.equal(custom.complete, false);
  assert.equal(custom.frontier[0].reason, 'draw-handoff');
});

test('actual core: audited Link cancellation closes the Wizard tree and upgrades v1 checkpoints', async () => {
  const first = await search({hand: [3723262], maxNodes: 1});
  // v1 saved full raw prefixes and did not contract any Link UI cycles.
  const legacy = {...first, version: 1, pruning: {stateMerging: false, exactDuplicatePrefixes: 0}};
  const result = await search({resume: legacy, maxNodes: 200, maxDepth: 30, maxMs: 15000});
  assert.equal(result.version, 2);
  assert.equal(result.checkpointCompatibility.loadedVersion, 1);
  assert.equal(result.complete, true);
  assert.equal(result.frontier.length, 0);
  assert.equal(result.failures.length, 0);
  assert.equal(result.pruning.linkUiLoops.enabled, true);
  assert(result.pruning.linkUiLoops.counts.cancelledLinkSummon > 0);
  assert(result.terminals.some(route => route.final.players[0].monsters.some(c => c?.code === 3723262)));
  assert(result.terminals.some(route => route.final.players[0].monsters.some(c => c?.code === 30342076)));
  await assert.rejects(search({resume: result, pruneLinkUiLoops: false}), /different or disabled/);
});

test('actual core: material toggle contraction stays within a shard and preserves its exit choices', async () => {
  const hand = [3723262, 64865];
  const game = await startRoute(hand);
  let prefix;
  try {
    const summon = game.prompt.choices.find(c => c.response.action === 0 && c.card?.code === 3723262);
    respond(game, {action: summon.id});
    respond(game, {selection: [0]});
    const decoder = game.prompt.choices.find(c => c.response.action === 1 && c.card?.code === 30342076);
    respond(game, {action: decoder.id});
    respond(game, {action: game.prompt.choices.find(c => c.card?.code === 3723262).id});
    respond(game, {selection: [0]});
    const wicked = game.prompt.choices.find(c => c.response.action === 1 && c.card?.code === 52698008);
    assert(wicked);
    respond(game, {action: wicked.id});
    assert.equal(game.prompt.type, 'SELECT_UNSELECT_CARD');
    prefix = game.route.steps;
  } finally { game.close(); }
  const exits = [];
  const result = await search({hand, prefix, maxNodes: 30, maxDepth: 20,
    onNode: (g, info) => {
      if (g.prompt.type !== 'SELECT_UNSELECT_CARD') {
        exits.push({type: g.prompt.type, depth: info.depth});
        return {stop: true, reason: 'transactionExit'};
      }
    }});
  assert.equal(result.failures.length, 0);
  assert(result.pruning.linkUiLoops.counts.linkMaterialToggle > 0);
  assert(exits.some(exit => exit.type === 'SELECT_PLACE'));
  // The entry Idle is before this immutable shard root, so cancellation must
  // remain an exit branch rather than being erased as a cycle outside the root.
  assert(exits.some(exit => exit.type === 'SELECT_IDLECMD'));
  assert.equal(result.pruning.linkUiLoops.counts.cancelledLinkSummon, 0);
  assert(result.pruning.linkUiLoops.examples.every(example => example.ancestorDepth >= prefix.length));
});

test('explicit deck order is preserved and checked across checkpoints', async () => {
  const game = await startRoute([]);
  let deckOrder;
  try { deckOrder = [...game.decks[0].main].reverse(); } finally { game.close(); }
  const result = await search({hand: [], deckOrder, maxNodes: 10});
  assert.equal(result.complete, true);
  assert.deepEqual(result.deckOrder, deckOrder);
  assert.deepEqual(result.terminals[0].deckOrder, deckOrder);
  await assert.rejects(search({resume: result, deckOrder: [...deckOrder].reverse()}), /differs/);
});

test('protocol upgrades recheck previously rejected prefixes instead of inheriting old wrapper failures', async () => {
  const checkpoint = await search({hand: [], maxNodes: 0});
  const game = await startRoute([]);
  let end;
  try { end = game.prompt.choices.find(c => c.response.action === 7).id; } finally { game.close(); }
  const legacy = {...checkpoint, version: 1, protocol: undefined, frontier: [],
    pruning: {stateMerging: false}, rejected: [{kind: 'coreRetry', at: 0, prefix: [{action: end}]}]};
  const result = await search({resume: legacy, maxNodes: 5});
  assert.equal(result.protocol.sumSortVerified, true);
  assert.equal(result.checkpointCompatibility.recoveredProtocolRetries, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.complete, true);
  assert.equal(result.terminals.length, 1);
  await assert.rejects(search({resume: {...result, protocol: {...result.protocol, hash: 'unknown-parser'}}}), /restart from the root/);
});
