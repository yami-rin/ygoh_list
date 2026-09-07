/**
 * Exhaustive response-tree search for the fixed opening fixture.
 * Only the actual core decides whether a generated response is legal. No board
 * global equivalence, card-name deduplication or strategic pruning is performed.
 * A result is exhaustive ONLY for its fixed deck order, prefix and scope, and
 * only when complete is true. Audited no-op Link UI cycles may be contracted.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {OcgMessageType as M, OcgQueryFlags as Q} from 'ocgcore-wasm';
import {DATA} from '../cards.mjs';
import {responseFor} from '../prompts.mjs';
import {startRoute, respond, finishRoute, hash, preset} from './route-harness.mjs';
import {patchCoreWrapper} from './patch-core.mjs';

const VERSION = 2;
const safe = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
const inputOf = step => safe(step.input ?? step);
const keyOf = frame => hash([frame.prefix, frame.nextCandidate ?? 0]);
const LINK_UI_POLICY = 'fixed-preset-standard-link-ui-v1';
const AUDITED_SCRIPTS_HASH = '767260fe45ec0d980c1f356639532f859463743713a4662520d9a444c119b41b';
const queryFlags = Object.values(Q).reduce((a, b) => a | b, 0);
const allowedLinkMessages = new Set([M.HINT, M.SELECT_UNSELECT_CARD, M.SELECT_IDLECMD]);

function installedScriptHash() {
  try {
    const names = ['proc_link.lua', 'utility.lua', ...new Set([...preset.main, ...preset.extra].map(code => `c${code}.lua`))];
    return hash(names.map(name => {
      const relative = ['', 'official', 'pre-release', 'unofficial'].map(dir => dir ? `${dir}/${name}` : name)
        .find(file => fs.existsSync(path.join(DATA, 'scripts', file)));
      return [relative, crypto.createHash('sha256').update(fs.readFileSync(path.join(DATA, 'scripts', relative))).digest('hex')];
    }));
  } catch { return null; }
}
const scriptsHash = installedScriptHash();
const processStarted = Date.now() - process.uptime() * 1000;
const protocolIdentity = (() => {
  try {
    const file = new URL('../node_modules/ocgcore-wasm/dist/index.js', import.meta.url);
    const source = fs.readFileSync(file, 'utf8');
    // A running process may still hold the previous ESM wrapper after a patch.
    // Require a new process and validate patch contents, not just its marker.
    return {revision: 'ocgcore-wasm-0.1.2-sum-sort-v1',
      hash: crypto.createHash('sha256').update(source).update(responseFor.toString()).digest('hex'),
      verified: fs.statSync(file).mtimeMs <= processStarted &&
        source.includes('/* Astra Duel Lab SUM SORT protocol fixes v1 */') && patchCoreWrapper(source) === source};
  } catch { return {revision: 'unknown', hash: null, verified: false}; }
})();
const protocolVerified = protocolIdentity.verified;

function observedLinkState(game) {
  return hash({turn: game.turn, phase: game.phase, turnPlayer: game.turnPlayer, lp: game.lp,
    status: game.status, chain: game.chain, log: game.log,
    field: game.lib.duelQueryField(game.handle),
    zones: [0, 1].map(controller => [1, 2, 4, 8, 16, 32, 64].map(location =>
      game.lib.duelQueryLocation(game.handle, {controller, location, flags: queryFlags}))),
  });
}

function* subsets(n, size, start = 0, picked = []) {
  if (!size) { yield [...picked]; return; }
  for (let i = start; i <= n - size; i++) {
    picked.push(i); yield* subsets(n, size - 1, i + 1, picked); picked.pop();
  }
}

function* permutations(values, picked = []) {
  if (!values.length) { yield [...picked]; return; }
  for (let i = 0; i < values.length; i++) {
    picked.push(values[i]);
    yield* permutations([...values.slice(0, i), ...values.slice(i + 1)], picked);
    picked.pop();
  }
}

function* counters(cards, amount, index = 0, picked = []) {
  if (index === cards.length) { if (amount === 0) yield [...picked]; return; }
  for (let n = 0; n <= Math.min(amount, cards[index].count); n++) {
    picked.push(n); yield* counters(cards, amount - n, index + 1, picked); picked.pop();
  }
}

/**
 * Lazy enumeration. SUM/TRIBUTE deliberately enumerate a superset: their min
 * and max are not uniformly cardinality constraints, so the core checks them.
 * Ordinary selections are unordered card groups; SORT prompts enumerate every
 * permutation. Card indices (including identical copies) are never merged.
 */
export function* enumerateCandidates(prompt, pending = {}) {
  const n = prompt.cards?.length ?? 0;
  if (prompt.mode === 'single') {
    for (const choice of prompt.choices) yield {action: choice.id};
  } else if (prompt.mode === 'order') {
    for (const selection of permutations(Array.from({length: n}, (_, i) => i))) yield {selection};
  } else if (prompt.mode === 'announce') {
    for (let i = 0; i < n; i++) yield {selection: [i]};
  } else if (prompt.mode === 'counter') {
    for (const values of counters(prompt.cards, prompt.count)) yield {selection: [], counters: values};
  } else if (prompt.mode === 'multi') {
    if (prompt.canCancel) yield {cancel: true};
    const weighted = ['SELECT_SUM', 'SELECT_TRIBUTE'].includes(prompt.type);
    const min = weighted ? 0 : Math.max(0, prompt.min ?? pending.min ?? 0);
    const max = weighted ? n : Math.min(n, prompt.max ?? pending.max ?? n);
    for (let size = min; size <= max; size++) {
      for (const selection of subsets(n, size)) yield {selection};
    }
  } else throw new Error(`Unsupported search prompt mode: ${prompt.mode} (${prompt.type})`);
}

function nonNegative(name, value, fallback, minimum = 0) {
  value ??= fallback;
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return value;
}

async function replayPrefix(hand, prefix, seed, {deckOrder, pruneLinkUiLoops, rootDepth}) {
  const game = await startRoute(hand, {seed, deckOrder});
  let transaction = null, emitted = [];
  const record = game.record.bind(game);
  game.record = message => { emitted.push(message.type); record(message); };
  try {
    for (let i = 0; i < prefix.length; i++) {
      if (game.turn > 1 || game.status === 'ended') {
        return {game, rejected: {kind: 'outsideScope', at: i, message: 'Response follows the end of the first turn'}};
      }
      if (pruneLinkUiLoops && game.pending.type === M.SELECT_IDLECMD) {
        const choice = game.prompt.choices.find(c => c.id === prefix[i].action);
        if (choice?.response.action === 1 && choice.card?.location === 64 &&
            (choice.card.type & 0x4000000) && preset.extra.includes(choice.card.code)) {
          transaction = {card: choice.card.code, entry: i, state: observedLinkState(game),
            ancestors: new Map([[hash(game.pending), {depth: i, idle: true}]])};
        }
      }
      emitted = [];
      try { respond(game, prefix[i]); }
      catch (error) {
        if (game.validationError) return {game, rejected: {kind: 'coreRetry', at: i, message: game.validationError}};
        if (game.status === 'error' || game.errors.length) throw error;
        return {game, rejected: {kind: 'invalidResponse', at: i, message: error.message}};
      }
      if (transaction) {
        // This is ONLY the standard Link.Target selection transaction. A chain,
        // cost, move, position choice, extra option or any other message ends it.
        if (emitted.some(type => !allowedLinkMessages.has(type)) ||
            observedLinkState(game) !== transaction.state ||
            ![M.SELECT_IDLECMD, M.SELECT_UNSELECT_CARD].includes(game.pending?.type)) {
          transaction = null;
        } else {
          const pendingKey = hash(game.pending);
          const ancestor = transaction.ancestors.get(pendingKey);
          // Never erase alternatives that lead outside an immutable shard root.
          if (ancestor && ancestor.depth >= rootDepth && i + 1 > rootDepth) {
            return {game, pruned: {kind: ancestor.idle ? 'cancelledLinkSummon' : 'linkMaterialToggle',
              card: transaction.card, transactionDepth: transaction.entry,
              ancestorDepth: ancestor.depth, depth: i + 1}};
          }
          if (!ancestor || ancestor.depth < rootDepth) transaction.ancestors.set(pendingKey, {depth: i + 1, idle: false});
          if (game.pending.type === M.SELECT_IDLECMD) transaction = null;
        }
      }
    }
    return {game};
  } catch (error) { game.close(); throw error; }
}

function saveCheckpoint(file, result) {
  if (!file) return;
  const destination = path.resolve(file);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const temporary = `${destination}.${process.pid}.tmp`;
  // routes is an in-memory alias; do not duplicate full replay histories on disk.
  const {routes, ...checkpoint} = result;
  fs.writeFileSync(temporary, JSON.stringify(checkpoint, null, 2) + '\n');
  fs.renameSync(temporary, destination);
}

/**
 * DFS through replayable prefixes. Budgets apply to THIS invocation; counters
 * accumulate when resuming. maxDepth counts responses from the original hand,
 * including prefix. maxGenerated bounds child-prefix allocation and preserves
 * the ungenerated tail with nextCandidate. onNode is read-only and may return
 * {stop:true, reason:'...'}; such stops are unresolved frontiers, not terminals.
 *
 * resume accepts a previous result (or checkpoint filename). To continue a
 * custom/draw boundary, remove that callback/stopOnDraw on the next invocation.
 */
export async function search(options = {}) {
  let previous = options.resume;
  if (typeof previous === 'string') previous = JSON.parse(fs.readFileSync(previous, 'utf8'));
  const hand = [...(options.hand ?? previous?.hand ?? [])];
  const prefix = (options.prefix ?? previous?.rootPrefix ?? []).map(inputOf);
  const seed = options.seed ?? previous?.seed ?? 123;
  const deckOrder = options.deckOrder ?? previous?.deckOrder;
  const maxNodes = nonNegative('maxNodes', options.maxNodes, 1000);
  const maxDepth = nonNegative('maxDepth', options.maxDepth, 80);
  const maxGenerated = nonNegative('maxGenerated', options.maxGenerated, Math.max(1000, maxNodes * 50));
  const maxMs = nonNegative('maxMs', options.maxMs, 30000);
  const stopOnDraw = !!options.stopOnDraw;
  const requestedPruning = options.pruneLinkUiLoops ?? true;
  const currentScriptsHash = installedScriptHash();
  const pruneLinkUiLoops = requestedPruning && scriptsHash === AUDITED_SCRIPTS_HASH && currentScriptsHash === AUDITED_SCRIPTS_HASH;
  const presetHash = hash(preset);
  if (previous && (![1, VERSION].includes(previous.version) || previous.presetHash !== presetHash ||
      hash(previous.hand) !== hash(hand) || previous.seed !== seed || hash(previous.rootPrefix) !== hash(prefix) ||
      hash(previous.deckOrder ?? null) !== hash(deckOrder ?? null))) {
    throw new Error('Checkpoint version, preset, hand, seed, deck order or root prefix differs');
  }
  if (previous?.pruning?.linkUiLoops?.enabled &&
      (!pruneLinkUiLoops || previous.pruning.linkUiLoops.policy !== LINK_UI_POLICY)) {
    throw new Error('Cannot resume a contracted checkpoint with a different or disabled Link UI policy');
  }
  if (previous?.protocol?.hash && (previous.protocol.hash !== protocolIdentity.hash ||
      previous.protocol.revision !== protocolIdentity.revision)) {
    throw new Error('Checkpoint protocol differs; restart from the root to recover possibly missing candidates');
  }
  const scope = {
    turn: 'First player turn, including end-phase resolution; stop at first prompt in the next turn',
    opponent: 'Empty opening hand; any opponent decision is an unresolved frontier',
    draws: 'One deterministic fixture deck order only; random outcomes are not enumerated',
    stateMerging: false,
    linkUi: pruneLinkUiLoops ? 'Audited no-op standard Link material toggles and summon cancellations are contracted' : 'Raw response histories, including UI cycles',
  };
  // A pre-fix SORT response could have been falsely rejected by the wrapper.
  // Replay those recorded branches after upgrading instead of inheriting an
  // old false-negative legality result as proof of exhaustive coverage.
  const recheckRetries = previous && !previous.protocol?.sumSortVerified && protocolVerified;
  const recoveredRetries = recheckRetries ? (previous.rejected ?? []).filter(r => r.kind === 'coreRetry') : [];
  const stack = previous ? [
    ...previous.frontier.map(f => ({...f, prefix: f.prefix.map(inputOf)})),
    ...recoveredRetries.map(r => ({prefix: r.prefix.map(inputOf), nextCandidate: 0, reason: 'protocolUpgradeRecheck'})),
  ] : [{prefix, nextCandidate: 0}];
  const terminals = [...(previous?.terminals ?? [])];
  const rejected = (previous?.rejected ?? []).filter(r => !recheckRetries || r.kind !== 'coreRetry');
  const failures = [...(previous?.failures ?? [])];
  const held = [];
  const seenFrames = new Set();
  let visited = previous?.visited ?? 0;
  let generated = previous?.generated ?? 0;
  let replayedResponses = previous?.replayedResponses ?? 0;
  let duplicates = previous?.pruning?.exactDuplicatePrefixes ?? 0;
  const linkCounts = {...{linkMaterialToggle: 0, cancelledLinkSummon: 0}, ...previous?.pruning?.linkUiLoops?.counts};
  const linkExamples = [...(previous?.pruning?.linkUiLoops?.examples ?? [])];
  let localNodes = 0, localGenerated = 0;
  const started = Date.now();
  const expired = () => Date.now() - started >= maxMs;
  const bounds = {maxNodes, maxDepth, maxGenerated, maxMs, stopOnDraw, pruneLinkUiLoops};

  while (stack.length && localNodes < maxNodes && !expired()) {
    const frame = stack.pop();
    const frameKey = keyOf(frame);
    if (seenFrames.has(frameKey)) { duplicates++; continue; }
    seenFrames.add(frameKey);
    let game;
    try {
      const replayed = await replayPrefix(hand, frame.prefix, seed, {deckOrder, pruneLinkUiLoops, rootDepth: prefix.length});
      game = replayed.game;
      visited++; localNodes++;
      replayedResponses += frame.prefix.length;
      if (replayed.pruned) {
        linkCounts[replayed.pruned.kind]++;
        if (linkExamples.length < 20) linkExamples.push({...replayed.pruned, prefix: frame.prefix});
        continue;
      }
      if (replayed.rejected) {
        rejected.push({prefix: frame.prefix, ...replayed.rejected});
        continue;
      }
      if (game.turn > 1 || game.status === 'ended') {
        const route = finishRoute(game, {terminalReason: game.status === 'ended' ? 'duelEnded' : 'firstTurnEnded'});
        terminals.push(route);
        await options.onTerminal?.(route);
        continue;
      }
      const info = {prefix: frame.prefix, depth: frame.prefix.length, visited, generated, nextCandidate: frame.nextCandidate ?? 0};
      const revision = game.revision;
      const decision = await options.onNode?.(game, info);
      if (revision !== game.revision) throw new Error('onNode must not modify the duel');
      let reason = decision?.stop ? decision.reason || 'observerBoundary' : null;
      if (!reason && stopOnDraw && game.log.some(e => /\d+\s*枚ドロー/.test(e.text))) reason = 'drawBoundary';
      if (!reason && (game.pending.player ^ game.first) !== 0) reason = 'opponentDecision';
      if (!reason && !protocolVerified && ['SELECT_SUM', 'SORT_CARD', 'SORT_CHAIN'].includes(game.prompt.type)) {
        reason = 'sumSortContractUnverified';
      }
      if (!reason && frame.prefix.length >= maxDepth) reason = 'maxDepth';
      if (reason) { held.push({...frame, reason, prompt: game.prompt.type}); continue; }
      const children = [];
      let ordinal = 0, unfinished = false;
      for (const input of enumerateCandidates(game.prompt, game.pending)) {
        if (ordinal++ < (frame.nextCandidate ?? 0)) continue;
        if (localGenerated >= maxGenerated || expired()) {
          held.push({...frame, nextCandidate: ordinal - 1, reason: expired() ? 'maxMs' : 'maxGenerated', prompt: game.prompt.type});
          unfinished = true;
          break;
        }
        children.push({prefix: [...frame.prefix, input], nextCandidate: 0});
        generated++; localGenerated++;
      }
      // Reverse to retain the core's original candidate order under DFS.
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      if (!ordinal && !unfinished) {
        held.push({...frame, reason: 'noEnumeratedCandidates', prompt: game.prompt.type});
      }
      await options.onProgress?.({visited, generated, terminals: terminals.length, rejected: rejected.length, frontier: stack.length + held.length});
    } catch (error) {
      // An engine/tool exception is unresolved, not an illegal branch.
      held.push({...frame, reason: 'error', message: error.message});
      failures.push({prefix: frame.prefix, message: error.message});
    } finally { game?.close(); }
  }
  const boundary = expired() ? 'maxMs' : localNodes >= maxNodes ? 'maxNodes' : 'pending';
  const frontier = [...held, ...stack.map(frame => ({...frame, reason: frame.reason ?? boundary}))];
  const result = {
    version: VERSION, presetHash, hand, seed, deckOrder, rootPrefix: prefix, scope,
    routes: terminals, terminals, visited, generated, replayedResponses,
    frontier, complete: frontier.length === 0, rejected, failures,
    pruning: {stateMerging: false, strategic: false, exactDuplicatePrefixes: duplicates,
      linkUiLoops: {enabled: pruneLinkUiLoops, requested: requestedPruning, policy: LINK_UI_POLICY,
        auditedScriptsHash: AUDITED_SCRIPTS_HASH, installedScriptsHash: currentScriptsHash, counts: linkCounts,
        examples: linkExamples, evidence: 'tests/search-enumeration-audit.test.mjs; proc_link.lua Link.Target',
        guard: 'Fixed preset Extra Deck only; same transaction; only HINT/SELECT_UNSELECT_CARD/SELECT_IDLECMD; unchanged full queries, LP, phase, chain and log; same pending'},
      selectionToggleLoops: pruneLinkUiLoops ? 'Audited no-op Link UI loops only; every other loop remains in frontier' : 'Not pruned'},
    checkpointCompatibility: {loadedVersion: previous?.version ?? null,
      migration: previous?.version === 1 ? 'Raw v1 frontier is replayed under the v2 audited Link UI policy' : null,
      recoveredProtocolRetries: recoveredRetries.length,
      legacyProtocolIdentityUnrecorded: !!previous && !previous.protocol?.hash,
      legacyGuarantee: 'Legacy migration assumes SUM was retained at its contract frontier and SORT candidate lists were complete; rechecking retries repairs reply encoding only, not arbitrary parser candidate omissions'},
    protocol: {revision: protocolIdentity.revision, hash: protocolIdentity.hash,
      sumSortVerified: protocolVerified, staleProcessRequiresRestart: !protocolVerified},
    bounds, invocation: {visited: localNodes, generated: localGenerated, elapsedMs: Date.now() - started},
  };
  saveCheckpoint(options.checkpointPath, result);
  return result;
}
