// Fair, resumable continuations of already verified Cat/Binder draw outcomes.
// Runs actual core search only; no Astra subprocesses or strategic pruning.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as draws from './exhaustive-draws.mjs';
import {search} from './search-kernel.mjs';
import {hash, board, preset, startRoute, respond, replay, finishRoute} from './route-harness.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME = path.join(ROOT, 'runtime/search-optional-draw');
const SOURCE = path.join(ROOT, 'routes/exhaustive-draws.json');
const OUTPUT = path.join(ROOT, 'routes/optional-draw-continuations.json');
const DOC = path.join(ROOT, 'docs/optional-draw-continuations.md');
const manifestFile = path.join(RUNTIME, 'index.json');
const lockFile = path.join(RUNTIME, 'run.lock');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const safe = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const relative = file => path.relative(ROOT, file).replaceAll('\\', '/');
const drawEvents = g => g.log.filter(e => /\d+\s*枚ドロー/.test(e.text)).length;
function write(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, file);
}
function numberOption(args, name, fallback, min, max) {
  const raw = args.find(arg => arg.startsWith(`--${name}=`));
  const value = raw ? Number(raw.slice(name.length + 3)) : fallback;
  assert(Number.isSafeInteger(value) && value >= min && value <= max, `Invalid --${name}`); return value;
}
function acquireLock() {
  fs.mkdirSync(RUNTIME, {recursive: true});
  try {const fd = fs.openSync(lockFile, 'wx'); fs.writeFileSync(fd, JSON.stringify({pid: process.pid})); fs.closeSync(fd);}
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const old = read(lockFile); assert(Number.isInteger(old.pid));
    let live = true; try {process.kill(old.pid, 0);} catch (error) {if (error.code === 'ESRCH') live = false; else throw error;}
    assert(!live, `An optional-draw search already owns this runtime (PID ${old.pid})`);
    fs.unlinkSync(lockFile); acquireLock();
  }
}
function releaseLock() {if (fs.existsSync(lockFile) && read(lockFile).pid === process.pid) fs.unlinkSync(lockFile);}

const sourceBytes = fs.readFileSync(SOURCE), source = JSON.parse(sourceBytes);
assert.equal(source.presetHash, hash(preset));
const sourceHash = digest(sourceBytes);
const boundaries = source.optionalDraws;
assert(Array.isArray(boundaries) && boundaries.length);
const jobs = boundaries.flatMap((boundary, boundaryIndex) => boundary.outcomes.map((outcome, outcomeIndex) => {
  assert(outcome.actualCore?.verified, 'Only verified draw outcomes may become search roots');
  return {id: hash([boundary.id, outcome.draw]).slice(0, 24), boundaryIndex, outcomeIndex, boundary, outcome};
}));
assert.equal(new Set(jobs.map(job => job.id)).size, jobs.length, 'Duplicate outcome job IDs');
const semanticsCache = new Map();
async function makeRoot(job) {
  // Newer producer versions expose the same semantic replay preparation. The
  // fallback uses its public materializer unchanged, preserving all history.
  if (draws.semanticPrefix && !semanticsCache.has(job.boundary.id))
    semanticsCache.set(job.boundary.id, await draws.semanticPrefix(job.boundary));
  const g = await draws.materializeDrawOutcome(job.boundary, job.outcome.draw,
    semanticsCache.has(job.boundary.id) ? {semantics: semanticsCache.get(job.boundary.id)} : {});
  try {
    assert(Array.isArray(g.route.deckOrder), 'Draw root requires its actual initial deck order');
    const stateHash = hash({pending: g.pending, board: board(g)});
    assert.equal(stateHash, job.outcome.actualCore.stateHash, 'Materialized draw root drift');
    assert.deepEqual(draws.countsOf(draws.remainingDeck(g)), job.outcome.actualCore.remainingCounts);
    assert(g.route.steps.length > job.boundary.prefix.length, 'Full history and draw acceptance must be preserved');
    return {jobId: job.id, sourceHash, presetHash: hash(preset), boundaryId: job.boundary.id, draw: job.outcome.draw,
      hand: g.route.hand, seed: g.route.seed, deckOrder: g.route.deckOrder,
      prefix: g.route.steps.map(s => s.input), stateHash,
      remainingCounts: draws.countsOf(draws.remainingDeck(g)), baselineDrawEvents: drawEvents(g),
      rootPrompt: g.prompt.type, originalDrawPrefixLength: job.boundary.prefix.length};
  } finally {g.close();}
}
function observer(root, evidence) {
  return (g, info) => {
    const events = drawEvents(g);
    if (events > root.baselineDrawEvents) {
      const key = hash(info.prefix);
      evidence.frontiers[key] = {prefix: safe(info.prefix), stateHash: hash({pending: g.pending, board: board(g)}),
        remainingCountsAfter: draws.countsOf(draws.remainingDeck(g)), drawEvents: events,
        status: 'new-chance-frontier-unexpanded', probability: null,
        note: 'One deterministic suffix draw occurred. Its possible outcomes and probabilities are not covered by this continuation.'};
      return {stop: true, reason: 'newChanceFrontier'};
    }
    if (g.prompt.type === 'SELECT_YESNO' && /ドロー/.test(g.prompt.title)) {
      const key = hash(info.prefix);
      evidence.sources[key] = {prefix: safe(info.prefix), pending: safe(g.pending),
        remainingDeck: draws.remainingDeck(g), remainingCounts: draws.countsOf(draws.remainingDeck(g)),
        board: board(g), accept: g.prompt.choices.filter(c => c.response.yes === true).map(c => ({action: c.id})),
        decline: g.prompt.choices.filter(c => c.response.yes === false).map(c => ({action: c.id})),
        status: 'optional-player-choice', knownTopAssumption: 'Not inferred; no new chance probabilities computed.'};
      // Keep both the decline and acceptance branches. Only a later actual
      // draw stops the corresponding child; a decline remains searchable.
    }
    return null;
  };
}
const reasons = frontier => frontier.reduce((out, frame) => {out[frame.reason || 'pending'] = (out[frame.reason || 'pending'] || 0) + 1; return out;}, {});
const blockedReasons = new Set(['newChanceFrontier', 'opponentDecision', 'error', 'noEnumeratedCandidates', 'sumSortContractUnverified']);
function runnable(row) {return !row || (!row.complete && (row.frontier === 0 || Object.keys(row.frontierReasons || {}).some(reason => !blockedReasons.has(reason))) && !row.initializationError);}
function pickJob(rows) {
  return jobs.filter(job => runnable(rows[job.id])).sort((a, b) =>
    (rows[a.id]?.slices || 0) - (rows[b.id]?.slices || 0) ||
    (rows[a.id]?.visited || 0) - (rows[b.id]?.visited || 0) ||
    a.boundaryIndex - b.boundaryIndex || a.outcomeIndex - b.outcomeIndex)[0];
}
function initializeManifest() {
  const manifest = fs.existsSync(manifestFile) ? read(manifestFile) : {schemaVersion: 1, sourceHash, presetHash: hash(preset), began: new Date().toISOString(), rows: {}};
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.sourceHash, sourceHash, 'Source draw coverage changed; preserve this runtime and start a separate audit');
  assert.equal(manifest.presetHash, hash(preset));
  return manifest;
}
async function ensureRootRepresentatives(manifest) {
  manifest.rootRepresentatives ||= [];
  for (const boundaryIndex of [0, 1, 3]) {
    const job = jobs.find(j => j.boundaryIndex === boundaryIndex);
    if (!job || !manifest.rows[job.id]?.initialized || manifest.rootRepresentatives.some(r => r.jobId === job.id)) continue;
    const root = read(path.join(RUNTIME, `${job.id}.root.json`));
    const g = await startRoute(root.hand, {seed: root.seed, deckOrder: root.deckOrder});
    try {
      for (const input of root.prefix) respond(g, input);
      assert.equal(hash({pending: g.pending, board: board(g)}), root.stateHash);
      const route = finishRoute(g, {kind: 'postDrawRoot', continuationComplete: false});
      await replay(route);
      manifest.rootRepresentatives.push({jobId: job.id, boundaryId: job.boundary.id, draw: job.outcome.draw, route});
    } finally {g.close();}
  }
}
function trackedSummary(manifest) {
  const rows = jobs.map(job => ({id: job.id, boundaryId: job.boundary.id, draw: job.outcome.draw,
    conditionalWeight: job.outcome.weight, conditionalDenominator: job.outcome.denominator,
    ...(manifest.rows[job.id] || {initialized: false, complete: false, slices: 0, visited: 0, frontier: null})}));
  const totals = rows.reduce((sum, row) => {
    sum.initialized += row.initialized ? 1 : 0; sum.complete += row.complete ? 1 : 0;
    sum.firstFourNodes += row.visited >= 4 || row.complete ? 1 : 0;
    for (const key of ['visited', 'generated', 'terminals', 'rejected', 'failures', 'newChanceFrontiers']) sum[key] += row[key] || 0;
    sum.frontier += row.frontier || 0; sum.initializationErrors += row.initializationError ? 1 : 0; return sum;
  }, {outcomes: rows.length, initialized: 0, firstFourNodes: 0, complete: 0, visited: 0, generated: 0, terminals: 0, rejected: 0, failures: 0, frontier: 0, newChanceFrontiers: 0, initializationErrors: 0});
  return {schemaVersion: 1, generatedAt: new Date().toISOString(), began: manifest.began,
    source: {path: relative(SOURCE), sha256: sourceHash, boundaries: boundaries.length, outcomes: jobs.length},
    presetHash: hash(preset), kernelVersion: 2, scope: 'Each verified Cat/Binder draw outcome, full original history, fixed remaining deck order, first turn; later draws remain separate chance frontiers.',
    scheduling: {policy: 'Least-served outcome first; one 4-8-node slice per outcome before the next round.',
      maxInvocationMs: 30000, nodesPerOutcome: manifest.lastOptions?.nodes || 4, parallelProcesses: 1,
      allOutcomesInitialized: totals.initialized === jobs.length, allFirstFourNodesVisited: totals.firstFourNodes === jobs.length},
    complete: totals.complete === jobs.length && !totals.initializationErrors && !totals.failures,
    totals, probabilityScope: 'Weights are conditional on each source boundary pool; never sum them across different boundaries or treat them as win rates.',
    rootRepresentatives: manifest.rootRepresentatives || [], representatives: manifest.representatives || [], results: rows,
    remaining: ['Every uninitialized outcome and saved frontier remains unresolved.', 'Any later draw requires its own remaining-pool chance enumeration.', 'A node budget, terminal sample, or one fixed deck order does not establish exhaustive game play.']};
}
function persist(manifest) {
  manifest.updatedAt = new Date().toISOString(); write(manifestFile, manifest);
  const summary = trackedSummary(manifest); write(OUTPUT, summary);
  const t = summary.totals;
  const lines = ['# Cat / Binder ドロー後の公平な後続探索', '',
    `更新: ${summary.generatedAt}。固定デッキの${boundaries.length}ドロー境界、${jobs.length}結果を対象とする。`, '',
    `初回到達 ${t.initialized}/${t.outcomes}、最初の4node到達 ${t.firstFourNodes}/${t.outcomes}、探索完了 ${t.complete}/${t.outcomes}、訪問 ${t.visited}、終端入力列 ${t.terminals}、未探索frontier ${t.frontier}。`,
    `後続ドロー境界 ${t.newChanceFrontiers}、初期化エラー ${t.initializationErrors}、探索エラー ${t.failures}。全網羅: ${summary.complete}。`, '',
    '各ドロー結果へ最初に4〜8nodeずつ配分し、処理回数が少ない結果から再開する。1プロセス、1実行の時計予算は最大30秒。実コアの1回の処理は途中打切りできないため、終了時刻は最後のfixtureと証拠保存の分だけ超過し得る。', '',
    '`materializeDrawOutcome` で最初の手札から実効果を再生し、draw acceptanceまでの全prefixと初期deckOrderを保存する。途中盤面の再配置は行わないため、同名HOPT・通常召喚権・消費した罠・残デッキ枚数は実履歴から復元する。各結果の初期state hashと残デッキ枚数はドロー担当の証拠へ照合する。', '',
    '既存ドローより後で新しくドローした入力列は `newChanceFrontier` として残す。その1回の固定結果を後続ドロー全体の網羅と扱わない。任意ドローの確認時は否認枝も残し、承諾後に実際のドローが発生した枝だけを停止する。残デッキや入力前の任意ドロー確認はruntimeのchance証拠へ記録し、新しい確率は仮定しない。', '',
    '全入力列、初期root、未探索prefix、後続chance証拠は `runtime/search-optional-draw/`。追跡JSONは件数、各ファイルのSHA-256、条件付きドロー重み、少数の代表ルートを保存する。rootRepresentativesはドロー直後までの履歴で、完成盤面ではない。終端の代表はrepresentativesへ別途収録する。代表ルートの選択は表示用であり、元の探索枝を削除しない。', '',
    '## 再開', '', '```powershell', 'node scripts/search-optional-draw-continuations.mjs --max-ms=30000 --nodes=4', '```', '',
    '同じコマンドで未処理結果とcheckpointを継続する。`--nodes` は4〜8、`--extra-depth` はroot以後の初回深さ上限（既定24）。その後のsliceで8ずつ深くする。checkpointがchanceやエラー境界だけになった結果は自動再試行せず、未完として保持する。', '',
    '検証: `node scripts/search-optional-draw-continuations.mjs --self-test`。独立replayでrootの状態・残デッキを比較し、kernelの4+4node再開が8node連続実行と同じ終端・frontierを持つことを確認する。', '',
    '同じruntimeを使う実行器の二重起動はrun.lockで拒否する。2026-09-08の実process検証でも既存PIDへの二重起動が拒否され、元の探索が継続した。', '',
    'この作業はAstra CLIや実対戦用のAstraプロセスを起動しない。全初動・全ドロー後展開の完了はまだ主張しない。', ''];
  write(DOC, lines.join('\n'));
  return summary;
}

async function selfTest() {
  const samples = [jobs.find(j => j.boundary.drawCount === 1), jobs.find(j => j.boundary.drawCount === 2)];
  for (const job of samples) {
    assert(job); const root = await makeRoot(job);
    const g = await startRoute(root.hand, {seed: root.seed, deckOrder: root.deckOrder});
    try {
      for (const input of root.prefix) respond(g, input);
      assert.equal(hash({pending: g.pending, board: board(g)}), root.stateHash);
      assert.deepEqual(draws.countsOf(draws.remainingDeck(g)), root.remainingCounts);
      assert.equal(drawEvents(g), root.baselineDrawEvents);
    } finally {g.close();}
    const options = {hand: root.hand, prefix: root.prefix, seed: root.seed, deckOrder: root.deckOrder,
      maxMs: 30000, maxDepth: root.prefix.length + 24, maxGenerated: 1000, stopOnDraw: false};
    const first = await search({...options, maxNodes: 4, onNode: observer(root, {sources: {}, frontiers: {}})});
    const resumed = await search({...options, resume: first, maxNodes: 4, onNode: observer(root, {sources: {}, frontiers: {}})});
    const direct = await search({...options, maxNodes: 8, onNode: observer(root, {sources: {}, frontiers: {}})});
    const comparable = result => ({visited: result.visited, generated: result.generated, rejected: result.rejected, failures: result.failures,
      terminals: result.terminals.map(r => [r.finalHash, r.steps.map(s => s.input)]),
      frontier: result.frontier.map(f => ({prefix: f.prefix, nextCandidate: f.nextCandidate})).sort((a, b) => hash(a).localeCompare(hash(b)))});
    assert.deepEqual(comparable(resumed), comparable(direct), 'Resume must preserve response-tree coverage');
    assert.equal(resumed.failures.length, 0); assert(first.visited > 1, 'Existing draw must not stop its root');
    console.log(JSON.stringify({test: 'root-history-and-4-plus-4-resume', job: job.id, drawCount: job.boundary.drawCount, visited: resumed.visited, passed: true}));
  }
  const states = Object.fromEntries(jobs.map((job, i) => [job.id, {complete: false, slices: i ? 1 : 0, visited: i ? 4 : 0, frontier: 1, frontierReasons: {maxNodes: 1}}]));
  assert.equal(pickJob(states).id, jobs[0].id);
  console.log(JSON.stringify({test: 'least-served-first', outcomes: jobs.length, passed: true}));
  const drawAgain = jobs.find(job => job.boundary.drawCount === 2 && job.outcome.draw.includes(1475311));
  assert(drawAgain, 'Cat draw outcomes must include Allure');
  const root = await makeRoot(drawAgain), g = await startRoute(root.hand, {seed: root.seed, deckOrder: root.deckOrder});
  const evidence = {sources: {}, frontiers: {}}, inspect = observer(root, evidence);
  try {
    for (const input of root.prefix) respond(g, input);
    assert.equal(inspect(g, {prefix: g.route.steps.map(s => s.input)}), null, 'The known root draw is not a new chance frontier');
    const allure = g.prompt.choices.find(c => c.response.action === 5 && c.card?.code === 1475311);
    assert(allure, 'Drawn Allure must be activatable'); respond(g, {action: allure.id});
    for (let n = 0; n < 15 && drawEvents(g) === root.baselineDrawEvents; n++) {
      if (g.prompt.type === 'SELECT_PLACE') respond(g, {selection: [0]});
      else if (g.prompt.type === 'SELECT_CHAIN') {
        const decline = g.prompt.choices.find(c => !c.card); assert(decline); respond(g, {action: decline.id});
      } else assert.fail(`Unexpected next-draw prompt ${g.prompt.type}`);
    }
    assert(drawEvents(g) > root.baselineDrawEvents);
    assert.deepEqual(inspect(g, {prefix: g.route.steps.map(s => s.input)}), {stop: true, reason: 'newChanceFrontier'});
    assert.equal(Object.keys(evidence.frontiers).length, 1);
    console.log(JSON.stringify({test: 'second-actual-draw-is-new-chance-frontier', passed: true}));
  } finally {g.close();}
}

async function main(args) {
  const allowed = /^(--self-test|--max-ms=\d+|--nodes=\d+|--extra-depth=\d+)$/;
  assert(args.every(arg => allowed.test(arg)), 'Unknown command argument');
  if (args.includes('--self-test')) {await selfTest(); return;}
  const maxMs = numberOption(args, 'max-ms', 30000, 1, 30000);
  const nodes = numberOption(args, 'nodes', 4, 4, 8);
  const extraDepth = numberOption(args, 'extra-depth', 24, 4, 512);
  acquireLock();
  try {
    const started = Date.now(), manifest = initializeManifest(); manifest.lastOptions = {maxMs, nodes, extraDepth};
    let processed = 0;
    while (Date.now() - started < maxMs - 100) {
      const job = pickJob(manifest.rows); if (!job) break;
      const previousRow = manifest.rows[job.id];
      const rootFile = path.join(RUNTIME, `${job.id}.root.json`);
      const checkpoint = path.join(RUNTIME, `${job.id}.checkpoint.json`);
      const chanceFile = path.join(RUNTIME, `${job.id}.chance.json`);
      try {
        const root = fs.existsSync(rootFile) ? read(rootFile) : await makeRoot(job);
        assert.equal(root.sourceHash, sourceHash); assert.equal(root.jobId, job.id); write(rootFile, root);
        const chance = fs.existsSync(chanceFile) ? read(chanceFile) : {sources: {}, frontiers: {}};
        const result = await search({hand: root.hand, prefix: root.prefix, seed: root.seed, deckOrder: root.deckOrder,
          ...(fs.existsSync(checkpoint) ? {resume: checkpoint} : {}), checkpointPath: checkpoint,
          maxNodes: nodes, maxMs: Math.max(1, Math.min(30000, maxMs - (Date.now() - started))), maxGenerated: 1000,
          maxDepth: root.prefix.length + extraDepth + 8 * (previousRow?.slices || 0), stopOnDraw: false, onNode: observer(root, chance)});
        assert.equal(result.version, 2); write(chanceFile, chance);
        const row = {initialized: true, rootVerified: true, complete: result.complete, slices: (previousRow?.slices || 0) + 1,
          visited: result.visited, generated: result.generated, terminals: result.terminals.length,
          rejected: result.rejected.length, failures: result.failures.length, frontier: result.frontier.length,
          frontierReasons: reasons(result.frontier), newChanceFrontiers: Object.keys(chance.frontiers).length,
          lastInvocation: result.invocation, rootPrefixLength: root.prefix.length,
          checkpoint: {path: relative(checkpoint), sha256: digest(fs.readFileSync(checkpoint))},
          root: {path: relative(rootFile), sha256: digest(fs.readFileSync(rootFile)), stateHash: root.stateHash},
          chanceEvidence: {path: relative(chanceFile), sha256: digest(fs.readFileSync(chanceFile))}};
        manifest.rows[job.id] = row;
        manifest.representatives ||= [];
        if (manifest.representatives.length < 3) {
          const route = result.terminals.find(route => !manifest.representatives.some(r => r.route.finalHash === route.finalHash));
          if (route) {await replay(route); manifest.representatives.push({jobId: job.id, boundaryId: job.boundary.id, draw: job.outcome.draw, route});}
        }
      } catch (error) {
        const errorFile = path.join(RUNTIME, `${job.id}.error.json`); write(errorFile, {jobId: job.id, sourceHash, message: error.message, stack: error.stack});
        manifest.rows[job.id] = {...previousRow, initialized: previousRow?.initialized || false, complete: false,
          slices: (previousRow?.slices || 0) + 1, initializationError: error.message, errorEvidence: {path: relative(errorFile), sha256: digest(fs.readFileSync(errorFile))}};
        console.error(JSON.stringify({job: job.id, error: error.message}));
      }
      processed++; write(manifestFile, manifest);
    }
    await ensureRootRepresentatives(manifest);
    const summary = persist(manifest);
    console.log(JSON.stringify({processed, elapsedMs: Date.now() - started, allComplete: summary.complete, ...summary.totals}));
    assert.equal(summary.totals.initializationErrors, 0, 'Outcome initialization failed; retained error evidence');
    assert.equal(summary.totals.failures, 0, 'Search failed; retained unresolved frames');
  } finally {releaseLock();}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
