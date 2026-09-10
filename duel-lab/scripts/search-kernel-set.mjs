/**
 * Exhaustive response-tree search for the fixed opening fixture.
 * Only the actual core decides whether a generated response is legal. No board
 * global equivalence, card-name deduplication or strategic pruning is performed.
 * A result is exhaustive ONLY for its fixed deck order, prefix and scope, and
 * only when complete is true. Audited no-op Link UI cycles may be contracted.
 * Opt-in v5: v4 execution with separately audited fresh initial-hand Bystial
 * MonsterSet cancellation. Ordinary summon and set choices remain branches.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {OcgMessageType as M, OcgQueryFlags as Q} from 'ocgcore-wasm';
import {DATA} from '../cards.mjs';
import {responseFor} from '../prompts.mjs';
import {startRoute, respond, finishRoute, hash, preset} from './route-harness.mjs';
import {patchCoreWrapper} from './patch-core.mjs';

const VERSION = 5;
export const implementation = Object.freeze({
  id: 'fresh-bystial-normal-or-set-cancel-v1', version: VERSION, baselineVersion: 4,
  // The audited baseline is copied deliberately: no modification of the frozen
  // implementation or its checkpoints is required to use this opt-in executor.
  baselineFile: 'scripts/search-kernel-tribute.mjs',
  baselineSha256: '4b3ff3af5f822c4fc9585b5dd1b6b09335fe29248c44dded2125055774ae9f93',
});
const safe = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v));
const inputOf = step => safe(step.input ?? step);
const keyOf = frame => hash([frame.prefix, frame.nextCandidate ?? 0]);
const LINK_UI_POLICY = 'fixed-preset-standard-link-ui-v1';
const AUDITED_SCRIPTS_HASH = '767260fe45ec0d980c1f356639532f859463743713a4662520d9a444c119b41b';
const queryFlags = Object.values(Q).reduce((a, b) => a | b, 0);
const allowedLinkMessages = new Set([M.HINT, M.SELECT_UNSELECT_CARD, M.SELECT_IDLECMD]);
const AUDITED_TRIBUTE_CARDS = [72656408,33854624];
const LEGACY_TRIBUTE_POLICY = 'fresh-initial-hand-bystial-normal-tribute-cancel-v1';
const TRIBUTE_POLICY = 'fresh-initial-hand-bystial-normal-or-set-tribute-cancel-v1';
const TRIBUTE_PIN = '6f43e013f78cf7f9fe40502ab79de5d55f2ca07f2d283c792a5ad705d81cedd6';
const helpers = ('constant card_counter_constants archetype_setcode_constants utility debug_utility chain cards_specific_functions '+
  'proc_fusion proc_fusion_spell proc_ritual proc_synchro proc_union proc_xyz proc_pendulum proc_link proc_equip proc_persistent '+
  'proc_workaround proc_normal proc_skill proc_rush proc_maximum proc_gemini proc_spirit proc_unofficial deprecated_functions').split(' ');

function tributePinHash() {
  try {
    const files = ['engine.mjs','prompts.mjs','cards.mjs','preset.json','scripts/route-harness.mjs',
      'scripts/search-kernel-fast.mjs','node_modules/ocgcore-wasm/dist/index.js','data/cards.json','data/ocgcore.sync.wasm'];
    for (const name of [...helpers.map(x=>`${x}.lua`), ...new Set([...preset.main,...preset.extra].map(code=>`c${code}.lua`))]) {
      const relative = ['', 'official', 'pre-release', 'unofficial'].map(dir=>dir?`${dir}/${name}`:name)
        .find(file=>fs.existsSync(path.join(DATA,'scripts',file)));
      if (!relative) return null;
      files.push(`data/scripts/${relative}`);
    }
    return hash(files.map(file=>[file,crypto.createHash('sha256')
      .update(fs.readFileSync(new URL(`../${file}`,import.meta.url))).digest('hex')]));
  } catch { return null; }
}
const initialTributePin = tributePinHash();
export function tributeAuditIdentity() {
  const installedPin = tributePinHash();
  return {policy:TRIBUTE_POLICY,expectedPin:TRIBUTE_PIN,installedPin,
    pinVerified:initialTributePin===TRIBUTE_PIN && installedPin===TRIBUTE_PIN,
    wasmSha256:'68e0ddde6932df1dc9de39e6eff8afae10a5db0f18ea8a0870a6b7eb80073ea8',
    coreRevision:'46779fbe40e6a9bd8967f5dc6a03f4eaa6550d57',
    cards:[...AUDITED_TRIBUTE_CARDS],
    evidence:'docs/MULTI_SEARCH_DEPTH_AUDIT.md; runtime/set-cancel-audit/source-evidence.json; runtime/set-cancel-audit/experiments/summary.json; MonsterSet core-operations.cpp:2472,2607-2620'};
}

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

function makeTributeAudit(game, hand, enabled, rootDepth) {
  const initialHand=enabled?game.lib.duelQueryLocation(game.handle,{controller:game.first,location:2,flags:Q.CODE}):[];
  const virgin = new Set(AUDITED_TRIBUTE_CARDS.filter(code=>enabled && hand.filter(c=>c===code).length===1 &&
    preset.main.filter(c=>c===code).length===1 && initialHand.filter(card=>card?.code===code).length===1));
  let transaction = null, messages = [];
  const forbiddenMovement = new Set([M.SWAP,M.RELOAD_FIELD,M.TAG_SWAP,M.SWAP_GRAVE_DECK,M.REMOVE_CARDS]);
  const rawHint = m => m?.type===M.HINT && m.hint_type===3 && Number(m.hint)===500 && m.player===game.first;
  const validTribute = () => {
    const p=game.pending;
    if(p?.type!==M.SELECT_TRIBUTE || p.player!==game.first || !p.can_cancel || p.min!==1 || p.max!==1 || !p.selects?.length)return false;
    return p.selects.every(c=>{
      if(c.controller!==game.first || c.location!==4 || c.release_param!==1)return false;
      const card=game.lib.duelQuery(game.handle,{controller:c.controller,location:c.location,sequence:c.sequence,overlaySequence:0,flags:Q.CODE|Q.POSITION});
      return card?.code===c.code && !!(card.position&5);
    });
  };
  return {
    record(message) {
      if (!enabled) return;
      messages.push(message);
      if(forbiddenMovement.has(message.type))virgin.clear();
      if(message.type===M.MOVE){
        if(!Number.isInteger(message.card) || !message.card || !message.from || !message.to)virgin.clear();
        else if(virgin.has(message.card) && message.from.controller===game.first &&
          (message.from.location!==2 || message.to.controller!==game.first || message.to.location!==2))virgin.delete(message.card);
      }
    },
    before(input,index) {
      messages=[];
      if(!enabled)return;
      if(transaction){
        if(transaction.stage!=='cancel' || index!==transaction.entry+1 || input.cancel!==true || !validTribute())transaction=null;
        return;
      }
      if(!virgin.size || game.turn!==1 || game.turnPlayer!==game.first || game.phase!==4 ||
        game.pending?.type!==M.SELECT_IDLECMD || game.pending.player!==game.first || game.chain.length)return;
      const choice=game.prompt.choices.find(c=>c.id===input.action);
      if(![0,3].includes(choice?.response.action) || !virgin.has(choice.card?.code) || choice.card.controller!==game.first || choice.card.location!==2)return;
      const cards=game.lib.duelQueryLocation(game.handle,{controller:game.first,location:2,flags:Q.CODE});
      if(cards.filter(c=>c?.code===choice.card.code).length!==1)return;
      transaction={card:choice.card.code,summonAction:choice.response.action,entry:index,stage:'tribute',state:observedLinkState(game),pending:hash(game.pending)};
    },
    after(_input,index) {
      if(!transaction)return null;
      if(!virgin.has(transaction.card)){transaction=null;return null;}
      if(transaction.stage==='tribute'){
        if(messages.length!==2 || !rawHint(messages[0]) || messages[1].type!==M.SELECT_TRIBUTE ||
          !validTribute() || observedLinkState(game)!==transaction.state){transaction=null;return null;}
        transaction.stage='cancel';
        return null;
      }
      const entry=transaction;transaction=null;
      if(messages.length!==1 || messages[0].type!==M.SELECT_IDLECMD ||
        game.pending?.type!==M.SELECT_IDLECMD || hash(game.pending)!==entry.pending ||
        observedLinkState(game)!==entry.state || entry.entry<rootDepth || index+1<=rootDepth)return null;
      return {kind:entry.summonAction===3?'cancelledMonsterSet':'cancelledNormalTribute',card:entry.card,transactionDepth:entry.entry,
        ancestorDepth:entry.entry,depth:index+1,pair:[entry.entry,index],stateHash:entry.state,pendingHash:entry.pending};
    },
  };
}

function detachPublishedHistory(game) {
  // finishRoute() intentionally returns route.steps by reference; snapshot()
  // also publishes chain. Earlier onNode results must remain stable when the
  // borrowed Duel advances. Entries are immutable in engine.mjs; only these
  // arrays are pushed to or updated. This changes no core/Lua state.
  game.route = {...game.route, steps: [...game.route.steps]};
  for (const key of ['log', 'chain', 'lp', 'inputs', 'errors']) game[key] = [...game[key]];
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

async function replayPrefix(hand, prefix, seed, {deckOrder, pruneLinkUiLoops, pruneTributeUiLoops, rootDepth, auditOnly=false}, execution) {
  const game = await startRoute(hand, {seed, deckOrder});
  execution.coreStarts++;
  let transaction = null, emitted = [];
  const tributeAudit=makeTributeAudit(game,hand,pruneTributeUiLoops,rootDepth);
  const tributeWitnesses=[];
  const record = game.record.bind(game);
  game.record = message => { emitted.push(message.type); tributeAudit.record(message); record(message); };
  // This closure and the actual Duel travel together to the immediate first
  // child. No query snapshot, board key or inferred hidden state is restored.
  const advance = (input, i) => {
      if(auditOnly && game.log.some(e=>e.turn===1 && /\d+\s*枚ドロー/.test(e.text))){
        return {game,rejected:{kind:'drawBoundary',at:i,message:'Audit does not continue after an unknown first-turn draw'}};
      }
      if (game.turn > 1 || game.status === 'ended') {
        return {game, rejected: {kind: 'outsideScope', at: i, message: 'Response follows the end of the first turn'}};
      }
      tributeAudit.before(input,i);
      if (pruneLinkUiLoops && game.pending.type === M.SELECT_IDLECMD) {
        const choice = game.prompt.choices.find(c => c.id === input.action);
        if (choice?.response.action === 1 && choice.card?.location === 64 &&
            (choice.card.type & 0x4000000) && preset.extra.includes(choice.card.code)) {
          transaction = {card: choice.card.code, entry: i, state: observedLinkState(game),
            ancestors: new Map([[hash(game.pending), {depth: i, idle: true}]])};
        }
      }
      emitted = [];
      try { respond(game, input); }
      catch (error) {
        if (game.validationError) return {game, rejected: {kind: 'coreRetry', at: i, message: game.validationError}};
        if (game.status === 'error' || game.errors.length) throw error;
        return {game, rejected: {kind: 'invalidResponse', at: i, message: error.message}};
      }
      const tributeWitness=tributeAudit.after(input,i);
      if(tributeWitness){
        tributeWitnesses.push(tributeWitness);
        if(!auditOnly)return {game,pruned:tributeWitness};
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
    return {game};
  };
  try {
    for (let i = 0; i < prefix.length; i++) {
      execution.replayedResponses++;
      const result = advance(prefix[i], i);
      if (result.rejected || result.pruned) return {...result, advance, tributeWitnesses};
    }
    return {game, advance, tributeWitnesses};
  } catch (error) { game.close(); throw error; }
}

/** Read-only witnesses for an already verified full route from its original
 * hand. Indices are zero-based route.steps indices. Callers MUST independently
 * replay a shortened candidate; this function never modifies the given route.
 */
export async function auditTributeCancellations(route) {
  const identity=tributeAuditIdentity();
  if(!identity.pinVerified || !route?.verified || route.presetHash!==hash(preset))
    return {...identity,pairs:[],witnesses:[],reason:'unverifiedSourceOrRoute'};
  let game;
  try {
    const result=await replayPrefix(route.hand,route.steps.map(inputOf),route.seed??123,
      {deckOrder:route.deckOrder,pruneLinkUiLoops:false,pruneTributeUiLoops:true,rootDepth:0,auditOnly:true},
      {coreStarts:0,replayedResponses:0});
    game=result.game;
    const current=tributeAuditIdentity();
    if(result.rejected || !current.pinVerified)return {...current,pairs:[],witnesses:[],reason:result.rejected?.kind??'sourceChanged'};
    return {...current,pairs:result.tributeWitnesses.map(w=>w.pair),witnesses:result.tributeWitnesses};
  }catch(error){return {...identity,pairs:[],witnesses:[],reason:'auditError',message:error.message};}
  finally{game?.close();}
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
 * The onNode Duel is borrowed for the callback; retain finishRoute()/snapshot()
 * values for later use, not a live native handle. Published histories remain
 * stable across first-child reuse. Logical baseline counters are unchanged;
 * execution reports the actual starts and responses performed by this version.
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
  const tributeIdentity=tributeAuditIdentity();
  const requestedTributePruning=options.pruneTributeUiLoops??true;
  const pruneTributeUiLoops=!!requestedTributePruning && tributeIdentity.pinVerified;
  const presetHash = hash(preset);
  if (previous && (![1, 2, 3, 4, VERSION].includes(previous.version) || previous.presetHash !== presetHash ||
      hash(previous.hand) !== hash(hand) || previous.seed !== seed || hash(previous.rootPrefix) !== hash(prefix) ||
      hash(previous.deckOrder ?? null) !== hash(deckOrder ?? null))) {
    throw new Error('Checkpoint version, preset, hand, seed, deck order or root prefix differs');
  }
  if (previous?.version === VERSION && previous.implementation?.id !== implementation.id) {
    throw new Error('Checkpoint execution implementation differs');
  }
  if(previous?.version===3 && previous.implementation?.id!=='exact-first-child-duel-reuse-v1')
    throw new Error('Checkpoint execution implementation differs');
  if(previous?.version===4 && previous.implementation?.id!=='fresh-bystial-tribute-cancel-v1')
    throw new Error('Checkpoint execution implementation differs');
  if(previous?.pruning?.tributeUiLoops?.enabled && (!pruneTributeUiLoops ||
    ![TRIBUTE_POLICY,...(previous.version===4?[LEGACY_TRIBUTE_POLICY]:[])].includes(previous.pruning.tributeUiLoops.policy) || previous.pruning.tributeUiLoops.expectedPin!==TRIBUTE_PIN))
    throw new Error('Cannot resume a contracted checkpoint with a different or disabled Tribute UI policy/source pin');
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
    tributeUi: pruneTributeUiLoops ? 'Only pinned, unique initial-hand Baldrake/Magnamhut that never left hand: exact ordinary one-tribute normal summon or MonsterSet cancellation; no other procedure' : 'Raw normal-tribute response histories; no Tribute UI contraction',
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
  const tributeCounts={cancelledNormalTribute:previous?.pruning?.tributeUiLoops?.counts?.cancelledNormalTribute??0,
    cancelledMonsterSet:previous?.pruning?.tributeUiLoops?.counts?.cancelledMonsterSet??0};
  const tributeExamples=[...(previous?.pruning?.tributeUiLoops?.examples??[])];
  let localNodes = 0, localGenerated = 0;
  const started = Date.now();
  const expired = () => Date.now() - started >= maxMs;
  const bounds = {maxNodes, maxDepth, maxGenerated, maxMs, stopOnDraw, pruneLinkUiLoops, pruneTributeUiLoops};
  const execution = {
    coreStarts: previous?.execution?.coreStarts ?? 0,
    replayedResponses: previous?.execution?.replayedResponses ?? 0,
    reusedResponses: previous?.execution?.reusedResponses ?? 0,
  };
  const initialExecution = {...execution};
  let retained = null;

  while (stack.length && localNodes < maxNodes && !expired()) {
    const frame = stack.pop();
    const frameKey = keyOf(frame);
    if (seenFrames.has(frameKey)) {
      duplicates++;
      retained?.game.close(); retained = null;
      continue;
    }
    seenFrames.add(frameKey);
    let game;
    try {
      let context, replayed;
      if (retained?.frame === frame) {
        context = retained; retained = null;
        game = context.game;
        detachPublishedHistory(game);
        execution.reusedResponses++;
        replayed = context.advance(frame.prefix.at(-1), frame.prefix.length - 1);
      } else {
        retained?.game.close(); retained = null;
        context = await replayPrefix(hand, frame.prefix, seed,
          {deckOrder, pruneLinkUiLoops, pruneTributeUiLoops, rootDepth: prefix.length}, execution);
        game = context.game;
        replayed = context;
      }
      visited++; localNodes++;
      replayedResponses += frame.prefix.length;
      if (replayed.pruned) {
        if(['cancelledNormalTribute','cancelledMonsterSet'].includes(replayed.pruned.kind)){
          tributeCounts[replayed.pruned.kind]++;
          if(tributeExamples.length<20)tributeExamples.push({...replayed.pruned,prefix:frame.prefix});
          continue;
        }
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
      if (children.length) {
        // Keep at most one live Duel. Do not respond speculatively: the loop's
        // node/time/duplicate guards run before the child's sole new response.
        retained = {game, advance: context.advance, frame: children[0]};
        game = null;
      }
    } catch (error) {
      // An engine/tool exception is unresolved, not an illegal branch.
      held.push({...frame, reason: 'error', message: error.message});
      failures.push({prefix: frame.prefix, message: error.message});
    } finally { game?.close(); }
  }
  retained?.game.close();
  const boundary = expired() ? 'maxMs' : localNodes >= maxNodes ? 'maxNodes' : 'pending';
  const frontier = [...held, ...stack.map(frame => ({...frame, reason: frame.reason ?? boundary}))];
  const result = {
    version: VERSION, implementation, presetHash, hand, seed, deckOrder, rootPrefix: prefix, scope,
    routes: terminals, terminals, visited, generated, replayedResponses,
    frontier, complete: frontier.length === 0, rejected, failures,
    pruning: {stateMerging: false, strategic: false, exactDuplicatePrefixes: duplicates,
      tributeUiLoops:{...tributeIdentity,enabled:pruneTributeUiLoops,requested:requestedTributePruning,
        counts:tributeCounts,examples:tributeExamples,
        guard:'Only unique initial-hand Baldrake/Magnamhut never moved out of hand; Idle wire action0 or action3, HINT 3/500 + SELECT_TRIBUTE(cancelable,min=max=1,own face-up MZONE release_param=1), cancel, Idle; identical full state and pending; ancestor at/after rootPrefix'},
      linkUiLoops: {enabled: pruneLinkUiLoops, requested: requestedPruning, policy: LINK_UI_POLICY,
        auditedScriptsHash: AUDITED_SCRIPTS_HASH, installedScriptsHash: currentScriptsHash, counts: linkCounts,
        examples: linkExamples, evidence: 'tests/search-enumeration-audit.test.mjs; proc_link.lua Link.Target',
        guard: 'Fixed preset Extra Deck only; same transaction; only HINT/SELECT_UNSELECT_CARD/SELECT_IDLECMD; unchanged full queries, LP, phase, chain and log; same pending'},
      selectionToggleLoops: pruneLinkUiLoops ? 'Audited no-op Link UI loops only; every other loop remains in frontier' : 'Not pruned'},
    checkpointCompatibility: {loadedVersion: previous?.version ?? null,
      migration: previous && previous.version !== VERSION ? `Raw v${previous.version} frontier is replayed with identical inputs under the v2 audited Link UI policy` : null,
      recoveredProtocolRetries: recoveredRetries.length,
      legacyProtocolIdentityUnrecorded: !!previous && !previous.protocol?.hash,
      legacyGuarantee: 'Legacy migration assumes SUM was retained at its contract frontier and SORT candidate lists were complete; rechecking retries repairs reply encoding only, not arbitrary parser candidate omissions'},
    protocol: {revision: protocolIdentity.revision, hash: protocolIdentity.hash,
      sumSortVerified: protocolVerified, staleProcessRequiresRestart: !protocolVerified},
    execution: {...execution, scope: 'Actual operations since first use of this executor; earlier baseline operations are not inferred'},
    bounds, invocation: {visited: localNodes, generated: localGenerated, elapsedMs: Date.now() - started,
      execution: Object.fromEntries(Object.keys(execution).map(key => [key, execution[key] - initialExecution[key]]))},
  };
  if(pruneTributeUiLoops && !tributeAuditIdentity().pinVerified)
    throw new Error('Tribute source pin changed during search; result cannot be saved as complete');
  saveCheckpoint(options.checkpointPath, result);
  return result;
}
