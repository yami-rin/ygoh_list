import test from 'node:test';
import assert from 'node:assert/strict';
import {loadOpeningTemplates, prepareOpening} from '../opening-policy.mjs';
import {semanticInput, nativeFrame, matchFrame, reference, publicOwn, requestKey, startDeckCopyAudit} from '../opening-semantics.mjs';
import {startRoute, respond, hash} from '../scripts/route-harness.mjs';

const templates = await loadOpeningTemplates();
const rabbit = templates.find(t => t.id === 'rabbit-no-draw-ip');
const same = (a, b) => JSON.stringify(reference(a)) === JSON.stringify(reference(b));
function stateFor(frame) {
  const own = structuredClone(frame.state.own);
  for (const zone of ['hand', 'grave', 'extra', 'banished']) own[zone] = own[zone].map(JSON.parse);
  return {turn: frame.state.turn, player: frame.state.player, phase: frame.state.phase,
    players: [{player: 0, lp: 8000, deckCount: 40, hand: [], monsters: [], spells: [], grave: [], banished: []}, {...own, player: 1}],
    request: {...structuredClone(frame.request), ...(frame.request.kind === 'multi' ? {sum: -1, exact: true, hint: 512} : {}),
      ...(frame.materialContext ? {selectionContext: {...frame.materialContext, subtype: 'SELECT_UNSELECT_CARD'}} : {})}};
}

test('a decline still belongs to the actual effect card and effect description', () => {
  const source = rabbit.steps.find(s => s.prompt.type === 'SELECT_EFFECTYN' && s.pending.code === 69272449);
  const target = rabbit.steps.find(s => s.prompt.type === 'SELECT_EFFECTYN' && s.pending.code === 32061192);
  assert(source && target);
  const decline = source.prompt.choices.find(c => c.response.yes === false);
  assert.throws(() => semanticInput(source, target, {action: decline.id}), /effect context/);
  assert.deepEqual(semanticInput(source, source, {action: decline.id}), {action: decline.id});
});

test('different optional draw questions cannot be matched just by yes or no', () => {
  const source = rabbit.steps.find(s => s.prompt.type === 'SELECT_YESNO');
  const target = templates.find(t => t.id === 'cat-rabbit-crypter-binder').steps.find(s => s.prompt.type === 'SELECT_YESNO');
  assert(source && target); assert.notEqual(source.pending.description, target.pending.description);
  assert.throws(() => semanticInput(source, target, source.input), /effect context/);
});

test('a Link material add is never remapped into removing the same field card', () => {
  const steps = rabbit.steps.filter(s => s.prompt.type === 'SELECT_UNSELECT_CARD');
  let pair;
  for (const source of steps) {
    const chosen = source.prompt.choices.find(c => c.id === source.input.action);
    if (!chosen?.card || chosen.response.index >= source.pending.select_cards.length) continue;
    for (const target of steps) {
      const removal = target.prompt.choices.find(c => c.card && same(c.card, chosen.card) && c.response.index >= target.pending.select_cards.length);
      if (removal && !target.prompt.choices.some(c => c.card && same(c.card, chosen.card) && c.response.index < target.pending.select_cards.length)) pair = {source, target};
    }
  }
  assert(pair, 'Actual-core route must contain the same material before and after selection');
  assert.throws(() => semanticInput(pair.source, pair.target, pair.source.input), /Required action unavailable/);
});

test('a legal Link material finish never becomes a cancellation of the summon', () => {
  const source = rabbit.steps.find(s => s.prompt.type === 'SELECT_UNSELECT_CARD' && s.pending.can_finish &&
    s.prompt.choices.find(c => c.id === s.input.action)?.response.index === null);
  assert(source, 'Actual-core route must explicitly finish a legal material group');
  const target = structuredClone(source);
  target.pending.can_finish = false; target.pending.can_cancel = true;
  assert.throws(() => semanticInput(source, target, source.input), /Required action unavailable/);
  assert.deepEqual(semanticInput(source, source, source.input), source.input);
});

// Actual core: Cat has two different physical Rabbit copies in its hand-cost
// selection. The native protocol currently has no persistent copy identity.
async function duplicateHandFrame() {
  const g = await startRoute([96676583, 69272449, 69272449]);
  try {
    const action = (code, type) => g.prompt.choices.find(c => c.card?.code === code && c.response.action === type);
    respond(g, {action: action(96676583, 0).id}); respond(g, {selection: [0]});
    respond(g, {action: action(96676583, 5).id});
    assert.equal(g.prompt.type, 'SELECT_CARD'); assert.deepEqual(g.prompt.cards.map(c => c.code), [69272449, 69272449]);
    return nativeFrame(g, {selection: [1]});
  } finally {g.close();}
}
const duplicate = await duplicateHandFrame();
const unique = structuredClone(duplicate);
unique.request.cards[0].code = 96676583;

test('native same-reference partial selection falls back instead of changing physical copies', () => {
  assert.equal(matchFrame(duplicate, stateFor(duplicate)), null);
  const reordered = stateFor(duplicate); reordered.request.cards.reverse();
  assert.equal(matchFrame(duplicate, reordered), null);
});

test('native ordinary card selection accepts the actual bridge defaults and rejects weighted/order requests', () => {
  assert.deepEqual(matchFrame(unique, stateFor(unique)).selection, [1]);
  const tagged = stateFor(unique); tagged.request.subtype = 'SELECT_CARD';
  assert.deepEqual(matchFrame(unique, tagged).selection, [1]);
  for (const change of [r => r.sum = 999, r => r.sum = 0, r => r.exact = false, r => r.order = true,
    r => r.kind = 'order', r => r.amount = 3, r => r.sumMode = true,
    r => r.subtype = 'SELECT_SUM', r => r.subtype = 'SELECT_TRIBUTE',
    r => r.selectionContext = {subtype: 'SORT_CARD'}, r => r.context = {subtype: 'SELECT_COUNTER'}]) {
    const state = stateFor(unique); change(state.request); assert.equal(matchFrame(unique, state), null, JSON.stringify(state.request));
  }
});

test('selecting the entire identical-reference group is an unambiguous unordered set', () => {
  const all = structuredClone(duplicate); all.request.min = all.request.max = 2; all.decision.selection = [1, 0];
  const state = stateFor(all); state.request.cards.reverse();
  const result = matchFrame(all, state); assert(result); assert.deepEqual([...result.selection].sort(), [0, 1]);
});

test('a single-copy search target already in the real opening hand remains unavailable in deck', async () => {
  const template = templates.find(t => t.id === 'backup-alone-wicked'); assert(template);
  const g = await startRoute([30118811, 64865]);
  try {
    let reached = false;
    for (const step of template.steps) {
      if (step.prompt.type === 'SELECT_CARD' && step.input.selection?.some(i => step.prompt.cards[i].code === 64865)) {
        assert.equal(g.prompt.type, 'SELECT_CARD'); assert(!g.prompt.cards.some(c => c.code === 64865));
        assert(g.snapshot().players[0].hand.some(c => c.code === 64865));
        assert.throws(() => semanticInput(step, g, step.input), /Required target unavailable/); reached = true; break;
      }
      respond(g, semanticInput(step, g, step.input));
    }
    assert(reached);
  } finally {g.close();}
});

const deckTemplate = templates.find(t => t.id === 'backup-discard-accord');
const deckIndex = deckTemplate.steps.findIndex(s => s.prompt.type === 'SELECT_CARD' &&
  s.prompt.cards.filter(c => c.code === 30118811 && c.location === 1).length === 2 &&
  s.input.selection?.some(i => s.prompt.cards[i].code === 30118811));
assert(deckIndex >= 0);
async function atDeckSearch() {
  const g = await startRoute(deckTemplate.hand);
  startDeckCopyAudit(g);
  for (const step of deckTemplate.steps.slice(0, deckIndex)) respond(g, step.input);
  return g;
}
const deckGame = await atDeckSearch();
const deckFrame = nativeFrame(deckGame, deckTemplate.steps[deckIndex].input); deckGame.close();
function nativeDeckState() {
  const state = stateFor(deckFrame);
  // Actual AstraDecisionBridge requestId 21 from backup-discard-accord:
  // Deck candidates are native ClientCard lookup entries, with sequence -1 and
  // zero metadata. The matcher may choose either only when every attribute agrees.
  state.request.cards = state.request.cards.map(c => ({...c, sequence: -1, position: 0,
    attack: 0, defense: 0, level: 0, link: 0, disabled: 0, contribution: [0, 0]}));
  state.request.subtype = 'SELECT_CARD'; return state;
}

test('equivalent own Deck copies can satisfy an ordinary search without reading deck order', () => {
  const saved = structuredClone(deckFrame); saved.decision.selection = [1];
  const state = nativeDeckState(); state.request.cards.reverse();
  const result = matchFrame(saved, state); assert(result); assert.deepEqual(result.selection, [0]);
});

test('Deck copy equivalence requires complete history and rejects any returned copy of that code', () => {
  for (const proof of [undefined, {observedFromStart: false, returnedCodes: []},
    {observedFromStart: true, returnedCodes: [30118811]}]) {
    const frame = structuredClone(deckFrame); frame.deckCopyProof = proof;
    assert.equal(matchFrame(frame, nativeDeckState()), null);
  }
});

test('Deck history observation starts before a Shifter opening Draw Phase chain', async () => {
  const g = await startRoute([69272449, 91800273, 40366667, 40366667, 78114463]);
  try {
    assert.equal(g.phase, 1); assert.equal(g.prompt.type, 'SELECT_CHAIN'); startDeckCopyAudit(g);
    const pass = g.prompt.choices.find(c => c.response.index === null); assert(pass);
    const frame = nativeFrame(g, {action: pass.id});
    assert.equal(frame.state.phase, 'DRAW'); assert.equal(frame.deckCopyProof.observedFromStart, true);
  } finally {g.close();}
});

test('actual Crypter return-to-Deck MOVE permanently marks that code as previously used', async () => {
  const template = templates.find(t => t.id === 'cat-rabbit-crypter-binder');
  const g = await startRoute(template.hand); startDeckCopyAudit(g);
  try {
    for (const step of template.steps) respond(g, step.input);
    const activate = g.prompt.choices.find(c => c.card?.code === 21848500 && c.response.action === 5); assert(activate);
    respond(g, {action: activate.id}); assert.equal(g.prompt.type, 'SELECT_CARD');
    const hare = g.prompt.cards.findIndex(c => c.code === 20938824 && c.location === 32); assert(hare >= 0);
    respond(g, {selection: [hare]}); assert.equal(g.prompt.type, 'SELECT_CARD');
    assert.deepEqual(nativeFrame(g, {selection: [0]}).deckCopyProof, {observedFromStart: true, returnedCodes: [20938824]});
    assert(!g.snapshot(0).players[0].banished.some(c => c.code === 20938824));
  } finally {g.close();}
});

test('an unidentified return MOVE or a replaced observer invalidates the entire Deck proof', async () => {
  for (const variant of ['unknown-card', 'missing-position', 'replaced-observer']) {
    const g = await atDeckSearch();
    try {
      if (variant === 'replaced-observer') {const original = g.record; g.record = m => original.call(g, m);}
      else g.record({type: 50, card: variant === 'unknown-card' ? 0 : 30118811,
        from: variant === 'missing-position' ? undefined : {controller: 0, location: 16, sequence: 0, position: 1},
        to: {controller: 0, location: 1, sequence: 0, position: 8}});
      const frame = nativeFrame(g, deckTemplate.steps[deckIndex].input);
      assert.equal(frame.deckCopyProof.observedFromStart, false); assert.equal(matchFrame(frame, nativeDeckState()), null);
    } finally {g.close();}
  }
});

test('Deck copy equivalence rejects unequal or missing native metadata and other zones', () => {
  for (const field of ['position', 'attack', 'defense', 'level', 'link', 'disabled']) {
    const state = nativeDeckState(); state.request.cards[1][field] = 1;
    assert.equal(matchFrame(deckFrame, state), null, `Different ${field}`);
    const missing = nativeDeckState(); delete missing.request.cards[0][field]; delete missing.request.cards[1][field];
    assert.equal(matchFrame(deckFrame, missing), null, `Missing ${field}`);
  }
  for (const change of [c => c.contribution = [1, 0], c => c.extraFlag = 1]) {
    const state = nativeDeckState(); change(state.request.cards[1]); assert.equal(matchFrame(deckFrame, state), null);
  }
  for (const location of ['Hand', 'Grave', 'Removed', 'Extra']) {
    const frame = structuredClone(deckFrame), state = nativeDeckState();
    for (const c of frame.request.cards) c.location = location;
    for (const c of state.request.cards) c.location = location;
    assert.equal(matchFrame(frame, state), null, location);
  }
});

test('both physical Backup deck copies replay to the same actual-core continuation and legal actions', async () => {
  const outcomes = [];
  for (const copy of [0, 1]) {
    const g = await atDeckSearch();
    try {
      assert.equal(g.prompt.cards[copy].code, 30118811); respond(g, {selection: [copy]});
      for (const step of deckTemplate.steps.slice(deckIndex + 1)) respond(g, semanticInput(step, g, step.input));
      assert.equal(g.prompt.type, 'SELECT_IDLECMD'); assert(!g.log.some(e => /\d+\s*枚ドロー/.test(e.text)));
      const end = g.prompt.choices.find(c => c.response.action === 7); assert(end);
      outcomes.push(hash({own: publicOwn(g.snapshot(0).players[0]), request: requestKey(nativeFrame(g, {action: end.id}).request)}));
    } finally {g.close();}
  }
  assert.equal(outcomes[0], outcomes[1]);
});

const initialCopyRoutes = [
  'pair-shard-0-ash-ash-almiraj',
  'pair-shard-4-cat-cat-sp-no-draw',
  'pair7-double-underground-preserve-field',
  'pair-search-263-68337209-68337209',
];
function nativeInitialState(frame, hand) {
  const state = stateFor(frame);
  for (const choice of state.request.choices) {
    const c = choice.option?.card; if (!c || c.location !== 'Hand') continue;
    const actual = hand[c.sequence]; assert.equal(actual.code, c.code);
    Object.assign(c, {position: actual.position, attack: actual.attack, defense: actual.defense,
      level: actual.level, link: 0, disabled: 0, contribution: [0, 0]});
  }
  return state;
}
async function firstHandFrame(template, chosenCopy = 0) {
  const hand = [...template.hand, 40366667, 40366667, 78114463];
  const g = await startRoute(hand); startDeckCopyAudit(g);
  const saved = template.steps[0].prompt.choices.find(c => c.id === template.steps[0].input.action);
  const copies = g.prompt.choices.filter(c => c.card?.code === saved.card.code && c.card.location === 2 &&
    c.response.action === saved.response.action && c.card.description === saved.card.description);
  assert.equal(copies.length, 2);
  const input = {action: copies[chosenCopy].id}, frame = nativeFrame(g, input);
  return {g, input, frame, state: nativeInitialState(frame, g.snapshot(0).players[0].hand)};
}

test('both initial Hand copies of Ash, Cat and Underground have identical actual-core continuations', async () => {
  for (const id of initialCopyRoutes) {
    const template = templates.find(t => t.id === id); assert(template, id); const outcomes = [];
    for (const copy of [0, 1]) {
      const {g, input} = await firstHandFrame(template, copy);
      try {
        respond(g, input);
        for (const step of template.steps.slice(1)) respond(g, semanticInput(step, g, step.input));
        assert.equal(g.prompt.type, 'SELECT_IDLECMD'); assert(!g.log.some(e => /\d+\s*枚ドロー/.test(e.text)));
        const end = g.prompt.choices.find(c => c.response.action === 7); assert(end);
        outcomes.push(hash({own: publicOwn(g.snapshot(0).players[0]), request: requestKey(nativeFrame(g, {action: end.id}).request)}));
      } finally {g.close();}
    }
    assert.equal(outcomes[0], outcomes[1], id);
  }
});

test('the first untouched Main action can select either fully equivalent initial Hand copy', async () => {
  for (const id of initialCopyRoutes) {
    const {g, frame, state} = await firstHandFrame(templates.find(t => t.id === id), 1);
    try {
      const chosen = frame.request.choices.find(c => c.id === frame.decision.action).option;
      state.request.choices.reverse();
      const first = state.request.choices.find(c => c.option?.card?.code === chosen.card.code && c.option.action === chosen.action);
      const decision = matchFrame(frame, state); assert(decision, id); assert.equal(decision.action, first.id);
    } finally {g.close();}
  }
});

test('initial Hand equivalence refuses missing proof, unequal metadata and different effect IDs', async () => {
  const {g, frame, state} = await firstHandFrame(templates.find(t => t.id === initialCopyRoutes[2]), 1);
  try {
    const noProof = structuredClone(frame); delete noProof.initialHandCopyProof;
    assert.equal(matchFrame(noProof, state), null);
    const code = frame.request.choices.find(c => c.id === frame.decision.action).option.card.code;
    for (const mutate of [c => c.option.card.attack += 1, c => delete c.option.card.level,
      c => c.option.card.newFlag = true, c => c.option.description += 1, c => c.option.otherEffectContext = 1]) {
      const target = structuredClone(state); const candidates = target.request.choices.filter(c => c.option?.card?.code === code && c.option.action === 'Activate');
      assert.equal(candidates.length, 2); mutate(candidates[0]); assert.equal(matchFrame(frame, target), null);
    }
  } finally {g.close();}
});

test('a clean Main hand after passing Shifter windows is no longer an untouched first decision', async () => {
  const g = await startRoute([96676583, 96676583, 91800273, 40366667, 78114463]); startDeckCopyAudit(g);
  try {
    for (let i = 0; i < 2; i++) {
      assert.equal(g.prompt.type, 'SELECT_CHAIN'); const pass = g.prompt.choices.find(c => c.response.index === null); assert(pass);
      respond(g, {action: pass.id});
    }
    assert.equal(g.prompt.type, 'SELECT_IDLECMD'); assert.equal(g.inputs.length, 2);
    const summon = g.prompt.choices.find(c => c.card?.code === 96676583 && c.response.action === 0); assert(summon);
    const frame = nativeFrame(g, {action: summon.id});
    assert.equal(frame.initialHandCopyProof, false);
    assert.equal(matchFrame(frame, nativeInitialState(frame, g.snapshot(0).players[0].hand)), null);
  } finally {g.close();}
});

const nativeDescriptionHands = {
  underground: [68337209, 74652966, 40366667, 40366667, 78114463],
  cat: [96676583, 96676583, 40366667, 40366667, 78114463],
  catMagnamhut: [96676583, 33854624, 40366667, 40366667, 78114463],
};
const nativeDescriptionPlans = {
  underground: await prepareOpening(templates.find(t => t.id === 'pair3-underground-soul-accord-binder-ip'), nativeDescriptionHands.underground),
  cat: await prepareOpening(templates.find(t => t.id === 'pair-shard-4-cat-cat-sp-no-draw'), nativeDescriptionHands.cat),
  catMagnamhut: await prepareOpening(templates.find(t => t.id === 'pair-shard-5-cat-magnamhut-binder-crypter'), nativeDescriptionHands.catMagnamhut),
};

test('Underground removal and Cat optional draw use their audited native question descriptions', () => {
  // Native suite 20260908T001729Z-1bf1d1 captured these exact values.
  for (const [name, code] of [['underground', 68337209], ['cat', 96676583]]) {
    const frame = nativeDescriptionPlans[name].frames.find(f => f.type === 'SELECT_YESNO'); assert(frame);
    const state = stateFor(frame);
    for (const c of state.request.choices) c.option.context.description = code * 16 + 3;
    assert(matchFrame(frame, state), name);
    for (const wrong of [code * 16, code * 16 + 1, code * 16 + 2, 69272449 * 16 + 3]) {
      const other = structuredClone(state);
      for (const c of other.request.choices) c.option.context.description = wrong;
      assert.equal(matchFrame(frame, other), null, `${name}: ${wrong}`);
    }
  }
});

test('simultaneous Cat return and Magnamhut registration retain card, location and native effect identity', () => {
  const frame = nativeDescriptionPlans.catMagnamhut.frames.find(f => f.type === 'SELECT_CHAIN' &&
    [96676583, 33854624].every(code => f.request.choices.some(c => c.option?.card?.code === code)));
  assert(frame); const state = stateFor(frame);
  for (const c of state.request.choices) {
    if (c.option?.card?.code === 96676583) c.option.description = 96676583 * 16 + 2;
    if (c.option?.card?.code === 33854624) c.option.description = 0;
  }
  const selectedCode = frame.request.choices.find(c => c.id === frame.decision.action).option.card.code;
  const result = matchFrame(frame, state); assert(result);
  assert.equal(state.request.choices.find(c => c.id === result.action).option.card.code, selectedCode);
  for (const mutate of [
    r => r.choices.find(c => c.option?.card?.code === 96676583).option.description = 96676583 * 16 + 1,
    r => r.choices.find(c => c.option?.card?.code === 33854624).option.description = 33854624 * 16 + 1,
    r => r.choices.find(c => c.option?.card?.code === 33854624).option.card.location = 'Hand',
    r => r.choices.find(c => c.option?.card?.code === 96676583).option.card.location = 'MonsterZone',
  ]) {
    const other = structuredClone(state); mutate(other.request); assert.equal(matchFrame(frame, other), null);
  }
});

test('a real placement retains its immediately preceding HINT card and refuses another monster', async () => {
  const g = await startRoute([69272449]); startDeckCopyAudit(g);
  try {
    const summon = g.prompt.choices.find(c => c.card?.code === 69272449 && c.response.action === 0); assert(summon);
    respond(g, {action: summon.id}); assert.equal(g.prompt.type, 'SELECT_PLACE');
    const frame = nativeFrame(g, {selection: [0]});
    assert(frame.request.choices.every(c => c.option.code === 69272449));
    const state = stateFor(frame); assert(matchFrame(frame, state));
    for (const choice of state.request.choices) choice.option.code = 96676583;
    assert.equal(matchFrame(frame, state), null);
  } finally {g.close();}
});

test('placement without an observed current card HINT is not an opening shortcut', async () => {
  const g = await startRoute([69272449]);
  try {
    const summon = g.prompt.choices.find(c => c.card?.code === 69272449 && c.response.action === 0); assert(summon);
    respond(g, {action: summon.id}); assert.equal(g.prompt.type, 'SELECT_PLACE');
    assert.throws(() => nativeFrame(g, {selection: [0]}), /placement card/);
  } finally {g.close();}
});

test('Accord revival cannot apply Binders saved zone to the natives Transcode placement', async () => {
  const plan = await prepareOpening(templates.find(t => t.id === 'dorm-no-draw-firewall-accord'),
    [32061192, 57111661, 40366667, 40366667, 78114463]);
  const frame = plan.frames.findLast(f => f.type === 'SELECT_PLACE' && f.request.choices.length === 2 &&
    f.request.choices.every(c => c.option.code === 95454996)); assert(frame);
  assert.deepEqual(frame.request.choices.map(c => c.option.mask), [1, 4]);
  const state = stateFor(frame);
  for (const choice of state.request.choices) choice.option.code = 46947713;
  assert.equal(matchFrame(frame, state), null);
});
