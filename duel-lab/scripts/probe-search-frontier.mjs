// Read-only diagnostic: observed recurrence is NOT an equivalence/pruning rule.
// Does not overwrite checkpoints or modify the shared search implementation.
import fs from 'node:fs';
import {OcgMessageType as M, OcgQueryFlags as Q} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {startRoute, respond, board, hash, preset} from './route-harness.mjs';
import {search} from './search-kernel.mjs';

const files = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!files.length && !process.argv.includes('--material-orders')) throw new Error('Pass checkpoint JSON filenames or --material-orders');
const selectorMessages = new Set([M.HINT, M.SELECT_IDLECMD, M.SELECT_UNSELECT_CARD]);
const totalPruned = r => Object.values(r.pruning?.linkUiLoops?.counts ?? {}).reduce((a, b) => a + b, 0);

for (const file of files) {
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const checkpoint = original.search ?? original.result ?? original;
  if (!Array.isArray(checkpoint.frontier)) throw new Error(`No frontier in ${file}`);
  const sorted = [...checkpoint.frontier].sort((a, b) => b.prefix.length - a.prefix.length);
  const samples = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted.at(-1)].filter(Boolean);
  const report = {file, version: checkpoint.version, rootDepth: checkpoint.rootPrefix.length,
    visited: checkpoint.visited, frontier: checkpoint.frontier.length, samples: []};
  for (const frame of samples) {
    const game = await startRoute(checkpoint.hand, {seed: checkpoint.seed, deckOrder: checkpoint.deckOrder});
    const seen = new Map(), rawMessages = [], recurrence = [], decisions = [];
    const record = game.record.bind(game);
    game.record = message => { rawMessages.push(message.type); record(message); };
    try {
      for (let i = 0; i <= frame.prefix.length; i++) {
        const fingerprint = hash({pending: game.pending, board: board(game), chain: game.chain});
        const previous = seen.get(fingerprint);
        if (previous) {
          const events = rawMessages.slice(previous.messageCount).filter(type => !selectorMessages.has(type));
          recurrence.push({from: previous.depth, to: i, length: i - previous.depth,
            progressMessages: [...new Set(events)].map(type => M[type]),
            decisions: decisions.slice(previous.depth, i).map(d => `${d.prompt}: ${d.label}`)});
        }
        seen.set(fingerprint, {depth: i, messageCount: rawMessages.length});
        if (i === frame.prefix.length) break;
        respond(game, frame.prefix[i]);
        decisions.push(game.route.steps.at(-1));
      }
      let reached = false;
      // In-memory single-frame probe only; its complete flag is intentionally
      // ignored because the other checkpoint frontiers were not included.
      const probe = await search({resume: {...checkpoint, frontier: [frame], terminals: [], routes: [], rejected: [], failures: []},
        maxNodes: 1, maxDepth: frame.prefix.length + 1, maxMs: 30000,
        onNode: () => { reached = true; return {stop: true, reason: 'readOnlyDiagnostic'}; }});
      report.samples.push({depth: frame.prefix.length, reason: frame.reason, currentPrompt: game.prompt?.type,
        recurrenceCount: recurrence.length, recurrencesWithGameMessages: recurrence.filter(r => r.progressMessages.length).length,
        firstRecurrences: recurrence.slice(0, 3), lastRecurrences: recurrence.slice(-2),
        reachedUnderCurrentKernel: reached, prunedDelta: totalPruned(probe) - totalPruned(checkpoint),
        failure: probe.failures[0]?.message, tail: decisions.slice(-10).map(d => `${d.prompt}: ${d.label}`)});
    } finally { game.close(); }
  }
  console.log(JSON.stringify(report));
}

if (process.argv.includes('--material-orders')) {
  const flags = Object.values(Q).reduce((a, b) => a | b, 0);
  const state = g => hash({pending: g.pending, turn: g.turn, phase: g.phase, lp: g.lp, status: g.status,
    chain: g.chain, log: g.log, field: g.lib.duelQueryField(g.handle),
    zones: [0, 1].map(controller => [1, 2, 4, 8, 16, 32, 64].map(location =>
      g.lib.duelQueryLocation(g.handle, {controller, location, flags})))});
  for (const target of [46947713, 95454996]) {
    const material = [30118811, 3723262, 69272449];
    const observations = [];
    for (const order of [[0, 1, 2], [1, 0, 2]]) {
      const g = await Duel.create([preset, preset], {seed: 925, fixtures: material.map((code, sequence) =>
        ({code, team: 0, controller: 0, location: 4, sequence, position: 1}))});
      try {
        const reply = input => { g.respond(0, g.revision, input, {snapshot: false}); if (g.validationError) throw new Error(g.validationError); };
        const start = g.prompt.choices.find(c => c.response.action === 1 && c.card?.code === target);
        if (!start) throw new Error(`Missing target ${target}`);
        reply({action: start.id});
        let selectorState;
        for (let i = 0; i < order.length; i++) {
          const choice = g.prompt.choices.find(c => c.card?.code === material[order[i]] && c.response.index < g.pending.select_cards.length);
          if (!choice) throw new Error('Expected material candidate');
          reply({action: choice.id});
          if (i === 1) selectorState = state(g);
        }
        if (g.prompt.type !== 'SELECT_PLACE') throw new Error(`Unexpected ${g.prompt.type}`);
        reply({selection: [0]});
        observations.push({order: order.map(i => material[i]), selectorState, completedState: state(g), nextPrompt: g.prompt.type});
      } finally { g.close(); }
    }
    console.log(JSON.stringify({candidateOnly: 'Different material-click orders within one standard Link transaction', target,
      sameSelectorState: observations[0].selectorState === observations[1].selectorState,
      sameContinuation: observations[0].completedState === observations[1].completedState,
      observations, genericSafetyProven: false}));
  }
}
