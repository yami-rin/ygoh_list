// Isolated search performance experiment. Does not modify Duel or call Astra.
// node --expose-gc scripts/benchmark-core-search.mjs --iterations=200
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import createCore, {OcgDuelMode as D} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {DATA, cards} from '../cards.mjs';
import {responseFor} from '../prompts.mjs';
import {board, hash, preset} from './route-harness.mjs';

const iterations = Number(process.argv.find(s => s.startsWith('--iterations='))?.split('=')[1] || 200);
assert(Number.isInteger(iterations) && iterations >= 4 && iterations <= 2000);
const wasmFile = path.join(DATA, 'ocgcore.sync.wasm');
const wasmBytes = fs.readFileSync(wasmFile);
const compileStart = performance.now();
const wasmModule = await WebAssembly.compile(wasmBytes);
const compileMs = performance.now() - compileStart;
const scriptCache = new Map();
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return {count: values.length, meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))]};
};
function scriptReader(name) {
  if (scriptCache.has(name)) return scriptCache.get(name);
  if (!/^[a-zA-Z0-9_./-]+\.lua$/.test(name) || name.includes('..')) return null;
  for (const dir of ['', 'official', 'pre-release', 'unofficial']) {
    const file = path.join(DATA, 'scripts', dir, name);
    if (fs.existsSync(file)) {
      const source = fs.readFileSync(file, 'utf8'); scriptCache.set(name, source); return source;
    }
  }
  return null;
}
const team = {startingLP: 8000, startingDrawCount: 0, drawCountPerTurn: 1};
const modes = ['fresh-file', 'cached-bytes', 'compiled-module', 'reuse-32', 'reuse-200', 'compiled-no-snapshot', 'reuse-32-no-snapshot'];
function factory(mode) {
  let shared = null, uses = 0, memory = null;
  const cap = mode.startsWith('reuse-32') ? 32 : 200;
  return async () => {
    if (mode.startsWith('reuse-') && shared && uses < cap) { uses++; return {lib: shared, bytes: memory?.buffer.byteLength}; }
    const options = {sync: true, wasmBinary: mode === 'fresh-file' ? fs.readFileSync(wasmFile) : wasmBytes};
    if (mode.startsWith('compiled-') || mode.startsWith('reuse-')) {
      options.instantiateWasm = (imports, receive) => {
        const instance = new WebAssembly.Instance(wasmModule, imports);
        memory = Object.values(instance.exports).find(value => value instanceof WebAssembly.Memory);
        receive(instance, wasmModule); return instance.exports;
      };
    }
    const lib = await createCore(options);
    if (mode.startsWith('reuse-')) { shared = lib; uses = 1; }
    return {lib, bytes: memory?.buffer.byteLength};
  };
}

// Match fixture semantics in Duel.create, with timing at each boundary.
// A fresh Duel JS object and fresh native duel handle are ALWAYS allocated.
async function fixture(getCore, decks, fixtures, seed = 123) {
  const metric = {}, start = performance.now();
  const {lib, bytes} = await getCore(); metric.libraryMs = performance.now() - start;
  const g = new Duel(); Object.assign(g, {lib, decks, seed, first: 0, fixture: true});
  let cardReads = 0, scriptReads = 0, callbackMs = 0;
  const tick = performance.now();
  g.handle = lib.createDuel({flags: D.MODE_MR5 | D.PSEUDO_SHUFFLE, seed: [BigInt(seed), 2n, 3n, 4n], team1: team, team2: team,
    cardReader: code => {const t = performance.now(); cardReads++; const card = cards[code] ? {...cards[code], race: BigInt(cards[code].race)} : null; callbackMs += performance.now() - t; return card;},
    scriptReader: name => {const t = performance.now(); scriptReads++; const text = scriptReader(name); callbackMs += performance.now() - t; return text;},
    errorHandler: (_type, text) => g.errors.push(String(text))});
  assert(g.handle, 'Core fixture creation failed'); metric.createHandleMs = performance.now() - tick;
  try {
    let t = performance.now();
    for (const name of ['constant.lua', 'utility.lua']) assert(lib.loadScript(g.handle, name, scriptReader(name)), name);
    metric.baseScriptsMs = performance.now() - t; t = performance.now();
    for (let player = 0; player < 2; player++) for (const [key, location] of [['main', 1], ['extra', 64]])
      for (const code of decks[player][key]) lib.duelNewCard(g.handle, {code, team: player, controller: player, duelist: 0, location, position: 8, sequence: 0});
    for (const card of fixtures) lib.duelNewCard(g.handle, {duelist: 0, position: 1, sequence: 0, ...card});
    metric.newCardsMs = performance.now() - t; t = performance.now();
    lib.startDuel(g.handle); g.advance(); metric.startAdvanceMs = performance.now() - t;
    metric.createTotalMs = performance.now() - start;
    return {g, metric, readStats: () => ({cardReads, scriptReads, callbackMs}), wasmBytes: bytes};
  } catch (e) {g.close(); throw e;}
}
function routeInputs(route) {
  const own = structuredClone(preset);
  for (const code of route.hand) {const index = own.main.indexOf(code); assert(index >= 0); own.main.splice(index, 1);}
  return {decks: [own, preset], fixtures: route.hand.map(code => ({code, team: 0, controller: 0, location: 2, position: 8}))};
}
const malice = JSON.parse(fs.readFileSync(new URL('../routes/malice-monsters.json', import.meta.url)));
const routeIds = ['rabbit-no-draw-ip', 'dorm-no-draw-crypter', 'cat-alone-30342076'];
const routes = routeIds.map(id => {const route = malice.routes.find(r => r.id === id); assert(route, id); assert.equal(route.presetHash, hash(preset)); return route;});
const stateHash = g => hash({pending: g.pending, board: board(g)});
function play(g, route, length, checkBefore = true, noSnapshot = false) {
  for (let n = 0; n < length; n++) {
    const step = route.steps[n];
    if (checkBefore) assert.equal(stateHash(g), step.before, `${route.id} before ${n}`);
    assert.equal(g.prompt.type, step.prompt);
    if (noSnapshot) {
      // Search already owns the current prompt. Preserve normal responseFor
      // validation and core processing; skip only API snapshot serialization.
      const response = responseFor(g.pending, g.prompt, step.input);
      g.validationError = null; g.lib.duelSetResponse(g.handle, response); g.advance();
    } else g.respond(g.pending.player ^ g.first, g.revision, step.input);
    assert.equal(g.validationError, null); assert.deepEqual(g.errors, []);
  }
  if (length === route.steps.length) assert.equal(hash(board(g)), route.finalHash);
  return stateHash(g);
}

// Independent baseline uses the project's actual public constructor.
const baseline = new Map();
for (const route of routes) {
  const input = routeInputs(route);
  const g = await Duel.create(input.decks, {seed: route.seed, fixtures: input.fixtures});
  try {
    baseline.set(`${route.id}/0`, stateHash(g));
    for (let n = 0; n < route.steps.length; n++) {
      assert.equal(stateHash(g), route.steps[n].before);
      g.respond(g.pending.player ^ g.first, g.revision, route.steps[n].input);
      assert.equal(g.validationError, null); assert.deepEqual(g.errors, []);
      baseline.set(`${route.id}/${n + 1}`, stateHash(g));
    }
    assert.equal(hash(board(g)), route.finalHash);
  } finally {g.close();}
}
const tasks = Array.from({length: iterations}, (_, i) => {
  const route = routes[i % routes.length];
  const depth = [0, Math.min(8, route.steps.length), Math.min(32, route.steps.length), route.steps.length][Math.floor(i / routes.length) % 4];
  return {route, depth};
});
const summaries = [];
for (const mode of modes) {
  global.gc?.();
  const rssBefore = process.memoryUsage().rss, getCore = factory(mode), results = [];
  const started = performance.now();
  for (const {route, depth} of tasks) {
    const input = routeInputs(route), sample = await fixture(getCore, input.decks, input.fixtures, route.seed);
    try {
      const t = performance.now();
      // Timed replay omits the expensive evidence hashing done by route-harness.
      const end = play(sample.g, route, depth, false, mode.endsWith('-no-snapshot'));
      sample.metric.replayMs = performance.now() - t;
      assert.equal(end, baseline.get(`${route.id}/${depth}`));
      sample.metric.prefixDepth = depth;
      Object.assign(sample.metric, sample.readStats());
    } finally {const t = performance.now(); sample.g.close(); sample.metric.destroyMs = performance.now() - t;}
    results.push(sample.metric);
  }
  const elapsedMs = performance.now() - started;
  global.gc?.();
  const summary = {mode, fixtures: results.length, allStateHashesEqual: true, elapsedMs, fixturesPerSecond: results.length * 1000 / elapsedMs,
    stages: Object.fromEntries(['libraryMs', 'createHandleMs', 'baseScriptsMs', 'newCardsMs', 'startAdvanceMs', 'createTotalMs', 'replayMs', 'destroyMs', 'callbackMs'].map(key => [key, stats(results.map(r => r[key]))])),
    meanCardReads: results.reduce((n, r) => n + r.cardReads, 0) / results.length,
    meanScriptReads: results.reduce((n, r) => n + r.scriptReads, 0) / results.length,
    byDepth: Object.fromEntries([...new Set(results.map(r => r.prefixDepth))].map(depth => [depth, stats(results.filter(r => r.prefixDepth === depth).map(r => r.replayMs))])),
    rssBefore, rssAfter: process.memoryUsage().rss};
  summaries.push(summary);
  console.error(JSON.stringify({mode, fixtures: summary.fixtures, fixturesPerSecond: summary.fixturesPerSecond, createMs: summary.stages.createTotalMs.meanMs, replayMs: summary.stages.replayMs.meanMs}));
}

// Real card HOPT: two face-up Dormouse instances share the name limit in ONE
// duel, then both regain the legal ignition action in the NEXT fresh handle.
const DORM = 32061192, RABBIT = 69272449, CAT = 96676583;
const hoptCore = factory('reuse-200');
const hoptDecks = [{main: [RABBIT, CAT], extra: []}, {main: [CAT], extra: []}];
const hoptFixtures = [0, 1].map(sequence => ({code: DORM, team: 0, controller: 0, location: 4, sequence, position: 1}));
let hoptTests = 0;
for (let i = 0; i < iterations; i++) {
  const {g} = await fixture(hoptCore, hoptDecks, hoptFixtures);
  try {
    const actions = () => g.prompt.choices.filter(c => c.response.action === 5 && c.card?.code === DORM);
    assert.equal(g.prompt.type, 'SELECT_IDLECMD'); assert.equal(actions().length, 2, 'Prior duel HOPT leaked');
    g.respond(0, g.revision, {action: actions()[i % 2].id});
    for (let n = 0; n < 15 && g.prompt.type !== 'SELECT_IDLECMD'; n++) {
      let input;
      if (g.prompt.type === 'SELECT_CARD') {const index = g.prompt.cards.findIndex(c => c.code === RABBIT); assert(index >= 0); input = {selection: [index]};}
      else if (g.prompt.type === 'SELECT_EFFECTYN' || g.prompt.type === 'SELECT_YESNO') {const c = g.prompt.choices.find(c => c.response.yes === false); assert(c); input = {action: c.id};}
      else if (g.prompt.type === 'SELECT_CHAIN') {const c = g.prompt.choices.find(c => !c.card); assert(c); input = {action: c.id};}
      else assert.fail(`Unexpected HOPT prompt ${g.prompt.type}`);
      g.respond(g.pending.player, g.revision, input); assert.equal(g.validationError, null);
    }
    assert.equal(g.prompt.type, 'SELECT_IDLECMD');
    assert.equal(g.lib.duelQueryCount(g.handle, 0, 1), 1, 'Cat remains a legal deck target');
    assert.equal(actions().length, 0, 'HOPT failed across identical card copies');
    const own = g.snapshot().players[0];
    assert.equal(own.monsters.filter(Boolean).length, 2);
    assert(own.monsters.filter(Boolean).every(c => c.attack === cards[DORM].attack + 600));
    assert.equal(own.banished[0].code, RABBIT); assert.deepEqual(g.errors, []);
    hoptTests++;
  } finally {g.close();}
}

// Callback lifetime probe: a closed native duel is not enough to release the
// callback payload while its unpatched wrapper library remains reachable.
let retainedAfterDestroy = null;
if (global.gc) {
  const {lib} = await factory('compiled-module')();
  function makeWeakPayload() {
    const payload = {marker: crypto.randomUUID()};
    const handle = lib.createDuel({flags: D.MODE_MR5, seed: [1n, 2n, 3n, 4n], team1: team, team2: team,
      cardReader: () => null, scriptReader, errorHandler: () => payload.marker});
    assert(handle); lib.destroyDuel(handle); return new WeakRef(payload);
  }
  const weak = makeWeakPayload();
  await new Promise(resolve => setImmediate(resolve)); global.gc();
  await new Promise(resolve => setImmediate(resolve)); global.gc();
  retainedAfterDestroy = !!weak.deref(); assert.equal(retainedAfterDestroy, true, 'Wrapper retention behavior changed; re-review pooling advice');
  assert.deepEqual(lib.getVersion().length, 2); // Keep the library live through GC.
}
console.log(JSON.stringify({schemaVersion: 1, date: new Date().toISOString(), node: process.version, iterations,
  wasmSha256: crypto.createHash('sha256').update(wasmBytes).digest('hex'), presetHash: hash(preset), compileMs,
  routes: routes.map(r => ({id: r.id, steps: r.steps.length})), summaries,
  hopt: {duels: hoptTests, sameNameCopies: 2, perDuelActionsBefore: 2, perDuelActionsAfter: 0, passed: true},
  callbackPayloadRetainedAfterDestroy: retainedAfterDestroy,
  warning: 'reuse-200 is a bounded experiment, not proof of safe unlimited reuse. RSS deltas include GC and cannot prove absence of a native allocator leak.'}, null, 2));
