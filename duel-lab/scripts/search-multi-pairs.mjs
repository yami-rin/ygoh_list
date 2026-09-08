/** Real-core two-card root searches. Unknown first-turn draws end this scope.
 * Checkpoints preserve every in-scope frontier; exported routes stop at Main 1.
 * No known opening templates are loaded or matched by this runner.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards, ROOT, DATA} from '../cards.mjs';
import {preset, hash, finishRoute, replay} from './route-harness.mjs';
import {search} from './search-kernel.mjs';

export function enumeratePairs(main) {
  const copies = new Map();
  for (const code of main) copies.set(code, (copies.get(code) ?? 0) + 1);
  const codes = [...copies.keys()].sort((a, b) => a - b), result = [];
  for (let i = 0; i < codes.length; i++) for (let j = i; j < codes.length; j++) {
    const a = codes[i], b = codes[j];
    if (a === b && copies.get(a) < 2) continue;
    result.push({id: `${a}-${b}`, hand: [a, b], physicalWeight: a === b ? copies.get(a) * (copies.get(a) - 1) / 2 : copies.get(a) * copies.get(b)});
  }
  assert.equal(result.reduce((sum, pair) => sum + pair.physicalWeight, 0), main.length * (main.length - 1) / 2);
  return result;
}
export const SCHEMA = 'astra-multi-pair-search-v1';
export const pairs = enumeratePairs(preset.main).map((pair, index) => ({...pair, index, names: pair.hand.map(code => cards[code]?.name ?? String(code))}));
const pairHash = hash(pairs.map(({id, hand, physicalWeight, index}) => ({id, hand, physicalWeight, index})));
const sourceFiles = ['scripts/search-multi-pairs.mjs', 'scripts/search-kernel.mjs', 'scripts/route-harness.mjs', 'scripts/patch-core.mjs', 'engine.mjs', 'prompts.mjs', 'cards.mjs', 'node_modules/ocgcore-wasm/dist/index.js'];
const digestFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const loadedSourceFiles = sourceFiles.map(name => [name, digestFile(path.join(ROOT, name))]);
// Include all dynamic Lua dependencies, not just the preset card scripts or a
// dated download manifest. A changed rules asset must start a new search run.
const luaFiles = fs.readdirSync(path.join(DATA, 'scripts'), {recursive: true}).filter(name => name.endsWith('.lua')).sort();
const assetsHash = hash([
  ...['cards.json', 'strings.conf', 'ocgcore.sync.wasm'].map(name => [name, digestFile(path.join(DATA, name))]),
  ...luaFiles.map(name => [name.replaceAll('\\', '/'), digestFile(path.join(DATA, 'scripts', name))]),
]);
const currentSourceHash = () => hash([...sourceFiles.map(name => [name, digestFile(path.join(ROOT, name))]), ['assets', assetsHash]]);
const sourceHash = hash([...loadedSourceFiles, ['assets', assetsHash]]);
const assertCurrentSources = () => assert.equal(currentSourceHash(), sourceHash, 'Search sources changed during this process; restart before resuming');
export const searchIdentity = Object.freeze({schema: SCHEMA, presetHash: hash(preset), pairHash, sourceHash, assetsHash});
// Versioned here, including closure data, so unrelated native policy integration
// can proceed while a shard runs. Same explicit heuristic as openingScore v1.
const scoreWeights = {39138610:9,65741786:8,95454996:5,21848500:5,29301450:5,5043010:4,4993187:4,46947713:2,52698008:2,86066372:1,13203964:1,24842059:2};
const scoreTraps = new Set([94722358,20726052,57111661,40366667,78114463]);
function openingScore(game) {
  const own = game.snapshot(0).players[0];
  return own.monsters.filter(Boolean).reduce((sum, card) => sum + (scoreWeights[card.code] || 0.7), 0) +
    own.spells.filter(card => card && scoreTraps.has(card.code)).length * 2 + own.hand.length * 0.7 + own.lp / 16000 - game.inputs.length / 1000;
}
const DRAW_REASON = 'excludedUnknownDraw';
const safe = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
const countBy = (values, key) => values.reduce((map, item) => (map[item[key] ?? 'pending'] = (map[item[key] ?? 'pending'] ?? 0) + 1, map), {});
const integer = (name, value, fallback, min = 0) => {
  const n = value ?? fallback;
  assert(Number.isSafeInteger(n) && n >= min, `${name} must be an integer >= ${min}`);
  return n;
};

export const scope = {
  fixture: 'Exactly the named two cards in hand; remaining fixed preset in deck; opponent has no opening hand',
  turn: 'First player turn including end-phase decisions, until the next turn',
  draws: 'Any first-turn DRAW ends the branch before another response; no outcome or continuation is explored',
  drawBoundary: 'The triggering response may resolve DRAW before the core returns; its resulting board is never scored or exported',
  completeness: 'completeWithinNoDrawScope means no unresolved in-scope prefix remains; it does not cover draw continuations, interference, or five-card hands',
  best: 'Highest openingScore among visited Main 1 decision points, not a proven global optimum or measured win rate',
  ordering: 'Kernel DFS within a slice; shorter pending prefixes are visited first on the next slice; no branch is discarded by ordering',
  stateMerging: false,
};

/** engine.emit attaches a turn to DRAW logs. Unknown legacy metadata fails closed.
 * The opponent's ordinary turn-2 draw is outside the first-turn scope.
 */
export function hasFirstTurnDraw(log) {
  return (log ?? []).some(event => /\d+\s*枚ドロー/.test(event.text ?? '') && (event.turn == null || event.turn <= 1));
}

export function selectShard(shard = 0, shards = 8, pairIndices) {
  integer('shards', shards, 8, 1); integer('shard', shard, 0);
  assert(shard < shards, 'shard must be smaller than shards');
  const selected = pairs.filter(pair => pair.index % shards === shard);
  if (pairIndices == null) return selected;
  assert(Array.isArray(pairIndices) && new Set(pairIndices).size === pairIndices.length, 'pairIndices must be distinct indices');
  for (const index of pairIndices) assert(selected.some(pair => pair.index === index), `Pair ${index} is outside shard ${shard}`);
  return selected.filter(pair => pairIndices.includes(pair.index));
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(safe(value), null, 2) + '\n');
  fs.renameSync(temp, file);
}

function identity(pair, seed) {
  return {presetHash: hash(preset), pairHash, pairIndex: pair.index, pairId: pair.id, hand: pair.hand, seed, sourceHash};
}

export function classifyEndpoint(route) {
  const own = route.final.players[0];
  const monsters = own.monsters.filter(Boolean), spells = own.spells.filter(Boolean);
  if (!route.steps.length) return 'no-action';
  if (monsters.some(card => (cards[card.code]?.type ?? 0) & 0x4000000)) return 'link-development';
  if (monsters.length > 1) return 'multiple-monsters';
  if (monsters.length === 1) {
    const summons = route.log.filter(event => event.turn === 1 && event.event === 'summon');
    return summons.length === 1 && /を召喚$/.test(summons[0].text) && !route.log.some(event => event.event === 'chain') ? 'normal-summon-only' : 'single-monster';
  }
  if (spells.length) return 'set-or-spell-only';
  return route.log.some(event => event.event === 'chain') ? 'effect-only' : 'no-board-development';
}

function main1Route(game, pair) {
  const route = finishRoute(game, {
    id: `pair-search-${String(pair.index).padStart(3, '0')}-${pair.id}`,
    name: pair.names.join(' + '), starter: pair.hand[0], requiredHand: pair.hand,
    pairIndex: pair.index, pairId: pair.id, source: 'multi-pair-real-core-search',
    endpoint: 'firstTurnMain1', requiresDraw: false, drawDependent: false,
    score: openingScore(game), scoreVersion: 'openingScore-v1', scoreMeaning: scope.best,
    limitations: [scope.fixture, scope.draws, 'No opponent interference is simulated.'],
  });
  route.classification = classifyEndpoint(route);
  return route;
}

const better = (candidate, current) => !current || candidate.score > current.score ||
  (candidate.score === current.score && candidate.steps.length < current.steps.length);

/** Separate intentionally excluded DRAW outcomes from genuinely unresolved work.
 * Adapter failures are NOT legality evidence; only native core RETRY is rejected.
 */
export function partitionResult(result, previousExcluded = []) {
  const excluded = new Map(previousExcluded.map(item => [hash(item.prefix), item]));
  const retainDraw = item => excluded.set(hash(item.prefix), {...item, reason: DRAW_REASON, excludedFromScope: true,
    triggeringPrefix: item.prefix.slice(0, -1), continuationExplored: false});
  const frontier = [];
  for (const frame of result.frontier) {
    if ([DRAW_REASON, 'drawBoundary'].includes(frame.reason)) retainDraw(frame);
    else frontier.push(frame);
  }
  const terminals = [];
  for (const route of result.terminals) {
    if (hasFirstTurnDraw(route.log)) retainDraw({prefix: route.steps.map(step => step.input), nextCandidate: 0, observedAs: 'terminalAfterDraw'});
    else terminals.push(route);
  }
  const rejected = [];
  for (const rejection of result.rejected) {
    if (rejection.kind === 'coreRetry') rejected.push(rejection);
    else frontier.push({prefix: rejection.prefix, nextCandidate: 0, reason: 'unverifiedResponse', rejection});
  }
  const unique = [...new Map(frontier.map(frame => [hash([frame.prefix, frame.nextCandidate ?? 0]), frame])).values()];
  // Search errors normally already have a frontier. Keep any orphan as unresolved.
  for (const failure of result.failures ?? []) {
    if (!unique.some(frame => hash(frame.prefix) === hash(failure.prefix))) {
      unique.push({prefix: failure.prefix, nextCandidate: 0, reason: 'unverifiedPastFailure', message: failure.message});
    }
  }
  const {routes, ...checkpoint} = result;
  return {search: {...checkpoint, terminals, rejected, frontier: unique, complete: unique.length === 0}, excludedDraw: [...excluded.values()]};
}

function summarizePair(checkpoint, checkpointFile) {
  const {search: run, pair} = checkpoint;
  const complete = run.complete && run.frontier.length === 0;
  const best = checkpoint.bestMain1, playable = checkpoint.bestPlayableMain1;
  const compact = route => route ? {id: route.id, score: route.score, classification: route.classification, responseCount: route.steps.length, final: route.final, finalHash: route.finalHash} : null;
  return {index: pair.index, id: pair.id, hand: pair.hand, names: pair.names, physicalWeight: pair.physicalWeight,
    status: complete ? 'completeWithinNoDrawScope' : run.visited ? 'incomplete' : 'unsearched',
    completeWithinNoDrawScope: complete, allGamePatternsComplete: false,
    visited: run.visited, generated: run.generated, terminalPaths: run.terminals.length,
    unresolved: run.frontier.length, unresolvedByReason: countBy(run.frontier, 'reason'),
    excludedDraw: checkpoint.excludedDraw.length, coreRejected: run.rejected.length,
    historicalFailures: (checkpoint.failureHistory ?? run.failures).length, main1Observations: checkpoint.main1Observations,
    best: compact(best), bestPlayable: compact(playable), checkpoint: checkpointFile,
    invocation: run.invocation, pruning: {stateMerging: false, linkUiLoops: run.pruning.linkUiLoops.counts}};
}

/** One bounded slice of a new or resumed pair root, never a template application. */
export async function runPair({pairIndex, maxNodes = 100, maxMs = 3000, maxDepth = 100,
  maxGenerated, seed = 123, resume = true, runtimeDir, onProgress} = {}) {
  const pair = pairs[integer('pairIndex', pairIndex, undefined)];
  assert(pair, 'Unknown pair index');
  assertCurrentSources();
  integer('maxNodes', maxNodes, 100); integer('maxMs', maxMs, 3000); integer('maxDepth', maxDepth, 100);
  const directory = path.resolve(runtimeDir ?? path.join(ROOT, 'runtime/multi-pair-search', `shard-${pair.index % 8}`));
  const checkpointFile = path.join(directory, `pair-${String(pair.index).padStart(3, '0')}-${pair.id}.checkpoint.json`);
  let previous;
  if (fs.existsSync(checkpointFile)) {
    assert(resume, `--fresh refuses to overwrite ${checkpointFile}; choose a new runtime directory`);
    previous = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
    assert.equal(previous.schema, SCHEMA, 'Unknown pair checkpoint schema');
    assert.deepEqual(previous.identity, identity(pair, seed), 'Pair checkpoint source, preset, pair ordering or seed differs; use a new run directory');
  }
  let bestMain1 = previous?.bestMain1 ?? null, bestPlayableMain1 = previous?.bestPlayableMain1 ?? null;
  let main1Observations = previous?.main1Observations ?? 0;
  const failureHistory = [...(previous?.failureHistory ?? [])];
  let run = previous?.search;
  if (!run?.complete) {
    // Only ordering changes: every exact frame and its candidate cursor survives.
    // Historical exceptions are kept outside the kernel's current failures;
    // their retained frontier can resolve successfully without being resurrected.
    if (run) run = {...run, failures: [], frontier: [...run.frontier].sort((a, b) => b.prefix.length - a.prefix.length)};
    run = await search({hand: pair.hand, seed, resume: run, maxNodes, maxMs, maxDepth, maxGenerated, stopOnDraw: true,
      onProgress,
      onNode(game) {
        // This MUST precede all scoring: kernel calls observers before its guard.
        if (hasFirstTurnDraw(game.log)) return {stop: true, reason: DRAW_REASON};
        if (game.turn !== 1 || game.phase !== 4 || (game.pending.player ^ game.first) !== 0 || game.prompt.type !== 'SELECT_IDLECMD') return;
        main1Observations++;
        const candidate = main1Route(game, pair);
        if (better(candidate, bestMain1)) bestMain1 = candidate;
        // Native playback needs an actual decision sequence. The zero-action
        // baseline is still retained separately as bestMain1 when it wins.
        if (candidate.steps.length && better(candidate, bestPlayableMain1)) bestPlayableMain1 = candidate;
      },
    });
    failureHistory.push(...run.failures);
  }
  const partitioned = partitionResult(run, previous?.excludedDraw);
  // Re-run only newly changed export winners; proof includes every before hash.
  if (bestPlayableMain1 && hash(bestPlayableMain1) !== hash(previous?.bestPlayableMain1 ?? null)) await replay(bestPlayableMain1);
  const checkpoint = {schema: SCHEMA, identity: identity(pair, seed), pair, scope, ...partitioned,
    bestMain1, bestPlayableMain1, main1Observations, failureHistory, updatedAt: new Date().toISOString()};
  assertCurrentSources();
  atomicWrite(checkpointFile, checkpoint);
  return {summary: summarizePair(checkpoint, checkpointFile), checkpoint, checkpointFile};
}

function writeShardOutputs(directory, shard, shards, selected, checkpoints) {
  const summaries = [], routes = [];
  // Narrow follow-up slices must not erase other already researched pairs from
  // the shard report/export. Unvisited assigned pairs are explicit unsearched rows.
  for (const pair of selectShard(shard, shards)) {
    const file = path.join(directory, `pair-${String(pair.index).padStart(3, '0')}-${pair.id}.checkpoint.json`);
    const checkpoint = checkpoints.get(pair.index) ?? (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
    if (!checkpoint) { summaries.push({...pair, status: 'unsearched', visited: 0, completeWithinNoDrawScope: false}); continue; }
    assert.equal(checkpoint.schema, SCHEMA);
    assert.equal(checkpoint.identity.pairHash, pairHash);
    assert.equal(checkpoint.identity.sourceHash, sourceHash, 'Shard contains a checkpoint from different sources');
    summaries.push(summarizePair(checkpoint, file));
    if (checkpoint.bestPlayableMain1) routes.push(checkpoint.bestPlayableMain1);
  }
  const generation = hash(summaries);
  const report = {...searchIdentity, generation, shard, shards, scope,
    totalPresetPairs: pairs.length, assignedPairs: pairs.filter(pair => pair.index % shards === shard).length,
    selectedPairIndices: selected.map(pair => pair.index),
    summary: {selected: selected.length, searched: summaries.filter(pair => pair.visited > 0).length,
      completeWithinNoDrawScope: summaries.filter(pair => pair.completeWithinNoDrawScope).length,
      incomplete: summaries.filter(pair => pair.status === 'incomplete').length,
      unsearched: summaries.filter(pair => pair.status === 'unsearched').length,
      visited: summaries.reduce((n, pair) => n + (pair.visited ?? 0), 0),
      terminalPaths: summaries.reduce((n, pair) => n + (pair.terminalPaths ?? 0), 0),
      unresolved: summaries.reduce((n, pair) => n + (pair.unresolved ?? 0), 0),
      excludedDraw: summaries.reduce((n, pair) => n + (pair.excludedDraw ?? 0), 0),
      exportedRoutes: routes.length, allGamePatternsComplete: false}, pairs: summaries, updatedAt: new Date().toISOString()};
  atomicWrite(path.join(directory, 'summary.json'), report);
  atomicWrite(path.join(directory, 'best-routes.json'), {...searchIdentity, generation, shard, shards, scope, routes});
  return report;
}

/** All assigned pairs get one budget slice per pass. CLI processes never share
 * an output directory: an exclusive lock prevents accidental duplicate runners.
 */
export async function runShard({shard = 0, shards = 8, pairIndices, maxNodesPerPair = 100,
  maxMsPerPair = 3000, maxDepth = 100, maxGenerated, passes = 1, seed = 123,
  resume = true, outputRoot, runtimeDir, onPair} = {}) {
  const selected = selectShard(shard, shards, pairIndices);
  integer('passes', passes, 1, 1);
  const directory = path.resolve(runtimeDir ?? path.join(outputRoot ?? path.join(ROOT, 'runtime/multi-pair-search'), `shard-${shard}`));
  fs.mkdirSync(directory, {recursive: true});
  const lockPath = path.join(directory, '.search.lock');
  const lock = fs.openSync(lockPath, 'wx');
  fs.writeFileSync(lock, JSON.stringify({pid: process.pid, shard, startedAt: new Date().toISOString()}));
  const checkpoints = new Map();
  try {
    let report = writeShardOutputs(directory, shard, shards, selected, checkpoints);
    for (let pass = 0; pass < passes; pass++) {
      for (const pair of selected) {
        const result = await runPair({pairIndex: pair.index, maxNodes: maxNodesPerPair, maxMs: maxMsPerPair,
          maxDepth, maxGenerated, seed, resume: pass > 0 || resume, runtimeDir: directory});
        checkpoints.set(pair.index, result.checkpoint);
        report = writeShardOutputs(directory, shard, shards, selected, checkpoints);
        await onPair?.({...result.summary, pass: pass + 1});
      }
      if (selected.every(pair => report.pairs.find(row => row.index === pair.index).completeWithinNoDrawScope)) break;
    }
    return report;
  } finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}

async function cli(argv) {
  const options = {}, numeric = {'--shard': 'shard', '--shards': 'shards', '--nodes-per-pair': 'maxNodesPerPair',
    '--ms-per-pair': 'maxMsPerPair', '--depth': 'maxDepth', '--passes': 'passes', '--seed': 'seed', '--max-generated': 'maxGenerated'};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (numeric[flag]) options[numeric[flag]] = Number(argv[++i]);
    else if (flag === '--pair-indices') options.pairIndices = argv[++i].split(',').map(Number);
    else if (flag === '--output-root') options.outputRoot = argv[++i];
    else if (flag === '--runtime-dir') options.runtimeDir = argv[++i];
    else if (flag === '--fresh') options.resume = false;
    else if (flag === '--resume') options.resume = true;
    else if (flag === '--help') {
      console.log('node scripts/search-multi-pairs.mjs --shard 0 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1 [--pair-indices 0,8] [--runtime-dir PATH] [--fresh]'); return;
    } else throw new Error(`Unknown argument ${flag}`);
  }
  options.onPair = pair => console.log(JSON.stringify({pair: pair.index, pass: pair.pass, status: pair.status,
    visited: pair.visited, terminals: pair.terminalPaths, unresolved: pair.unresolved, excludedDraw: pair.excludedDraw,
    bestScore: pair.best?.score, bestPlayableScore: pair.bestPlayable?.score, invocation: pair.invocation}));
  const report = await runShard(options);
  console.log(JSON.stringify({shard: report.shard, ...report.summary}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch(error => {console.error(error.message); process.exitCode = 1;});
}
