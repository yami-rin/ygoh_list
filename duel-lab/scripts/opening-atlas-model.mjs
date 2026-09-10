import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const json = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item);
export const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const hash = value => digest(json(value));
const counts = rows => rows.reduce((map, code) => (map[code] = (map[code] ?? 0) + 1, map), {});
const actions = {Summon:'召喚する',SpSummon:'特殊召喚する',Repos:'表示形式を変える',SetMonster:'モンスターをセットする',SetSpell:'魔法・罠をセットする',Activate:'発動する'};
const positions = {FaceUpAttack:'表側攻撃表示',FaceDownAttack:'裏側攻撃表示',FaceUpDefence:'表側守備表示',FaceDownDefence:'裏側守備表示'};
const locations = {Hand:'手札',Deck:'デッキ',Grave:'墓地',Removed:'除外',Extra:'EXデッキ'};

export function placement(option) {
  const sequence = Math.log2(option.mask);
  assert(Number.isInteger(sequence) && sequence >= 0, 'Placement must name exactly one zone');
  assert.equal(option.controller, 1, 'The atlas only renders its own field');
  const monster = option.location === 'MonsterZone';
  assert(monster || option.location === 'SpellZone', 'Unsupported placement location');
  assert(sequence < (monster ? 7 : 6), 'Unsupported placement slot');
  return {monster, sequence, label: monster ? (sequence < 5 ? `M${sequence + 1}` : `EXTRA ${sequence - 4}`)
    : sequence < 5 ? `S${sequence + 1}` : 'フィールドゾーン'};
}

export function describeFrame(frame, cards) {
  const name = code => { assert(cards[code], `Missing card ${code}`); return cards[code].name; };
  const cardLabel = card => {
    const location = card.location === 'MonsterZone' ? (card.sequence < 5 ? `M${card.sequence + 1}` : `EXTRA ${card.sequence - 4}`)
      : card.location === 'SpellZone' ? (card.sequence < 5 ? `S${card.sequence + 1}` : 'フィールドゾーン') : locations[card.location];
    return `${name(card.code)}${location ? `（${location}）` : ''}`;
  };
  const {request, decision} = frame;
  if (request.kind === 'multi') {
    if (decision.cancel) return frame.type === 'SELECT_UNSELECT_CARD' && frame.materialContext?.finishable ? '素材選択を終える' : '選択を取り消す';
    return decision.selection.length ? `選ぶ：${decision.selection.map(index => cardLabel(request.cards[index])).join(' / ')}` : '選択を確定する';
  }
  const choice = request.choices.find(row => row.id === decision.action);
  assert(choice, 'Saved choice is not offered');
  const option = choice.option;
  if (typeof option === 'string') return option === 'End Phase' ? 'エンドフェイズへ' : option === 'Battle Phase' ? 'バトルフェイズへ' : option;
  if (option.action) return `${actions[option.action] ?? option.action}：${name(option.card.code)}`;
  if (option.answer !== undefined) {
    if (frame.type === 'SELECT_EFFECTYN') return `${name(option.context.card.code)}の効果を${option.answer ? '発動する' : '発動しない'}`;
    // The semantic request uses native 4-bit descriptions, including the
    // audited YESNO aliases in opening-semantics.mjs. Do not decode these
    // with cards.description(), which expects the modern 20-bit layout.
    const value = option.context.description, code = Math.floor(value / 16), index = value & 15;
    const question = cards[code]?.strings[index];
    assert(question, `No verified question text for ${value}`);
    return `${name(code)}：${question} → ${option.answer ? 'はい' : 'いいえ'}`;
  }
  if (option.position) { assert(positions[option.position]); return `${name(option.code)}：${positions[option.position]}`; }
  if (option.mask !== undefined) return `${name(option.code)}を ${placement(option).label} に置く`;
  if (option.card) return `${name(option.card.code)}の効果を選ぶ`;
  if (option.description !== undefined) return `効果の選択肢 ${request.choices.indexOf(choice) + 1} を選ぶ`;
  throw new Error(`Unsupported decision: ${frame.type}`);
}

export function publicState(own) {
  const list = values => values.map(value => {
    const card = typeof value === 'string' ? JSON.parse(value) : value;
    return typeof card === 'number' ? {code: card} : card;
  });
  return {lp: own.lp, deck: own.deckCount, hand: list(own.hand), monsters: own.monsters, spells: own.spells,
    grave: list(own.grave), banished: list(own.banished), extra: list(own.extra)};
}

/** Match every exported frame against the captured core state. Placement text
 * is also checked against the resulting zone, after the immediate position
 * prompt when one exists; a regex or the selected mask alone is insufficient. */
export function validateReplay(pair, replay, plan, preset, cards) {
  assert.equal(plan.drawDependent, false);
  assert(Number.isFinite(plan.score), 'Opening score must be finite');
  assert.equal(plan.final.turn, 1);
  assert.equal(plan.final.phase, 'MAIN 1');
  assert.deepEqual(counts(plan.hand), counts(pair.hand));
  assert.equal(replay.finalHash, hash(plan.final));
  assert.equal(replay.states.length, replay.steps.length + 1);
  assert.equal(replay.steps.length, plan.frames.length);
  assert.equal(replay.states[0].lp, 8000);
  assert.equal(replay.states[0].deck, preset.main.length - 2);
  assert.deepEqual(counts(replay.states[0].hand.map(card => card.code)), counts(pair.hand));
  const inventory = counts([...preset.main, ...preset.extra]);
  const checked = {states: 0, steps: 0, questions: 0, placements: 0, placementAfterPosition: 0};
  for (let index = 0; index < replay.states.length; index++) {
    const state = replay.states[index];
    assert.deepEqual(state, publicState(index < plan.frames.length ? plan.frames[index].state.own : plan.finalOwn));
    assert.equal(state.monsters.length, 7); assert.equal(state.spells.length, 8);
    const seen = [...state.hand, ...state.monsters, ...state.spells, ...state.grave, ...state.banished, ...state.extra].filter(Boolean);
    for (const card of seen) assert(cards[card.code], `Missing card text ${card.code}`);
    for (const [code, n] of Object.entries(counts(seen.map(card => card.code)))) assert(n <= inventory[code], `Too many copies of ${code}`);
    assert.equal(seen.length + state.deck, preset.main.length + preset.extra.length, `Unrepresented card in ${pair.id}:${index}`);
    checked.states++;
    if (index === replay.steps.length) continue;
    const step = replay.steps[index], frame = plan.frames[index]; checked.steps++;
    assert.equal(step.label, describeFrame(frame, cards));
    assert.equal(step.prompt, frame.request.title ?? 'カード選択');
    assert.equal(step.automatic, frame.automatic);
    if (frame.type === 'SELECT_YESNO') checked.questions++;
    if (frame.type !== 'SELECT_PLACE') continue;
    const option = frame.request.choices.find(choice => choice.id === frame.decision.action).option;
    const {monster, sequence} = placement(option);
    let after = replay.states[index + 1];
    if ((monster ? after.monsters : after.spells)[sequence]?.code !== option.code) {
      const next = plan.frames[index + 1];
      assert.equal(next?.type, 'SELECT_POSITION', `Placement does not resolve at ${pair.id}:${index}`);
      assert(next.request.choices.every(choice => choice.option.code === option.code));
      after = replay.states[index + 2]; checked.placementAfterPosition++;
    }
    assert.equal((monster ? after.monsters : after.spells)[sequence]?.code, option.code, `Core zone mismatch at ${pair.id}:${index}`);
    checked.placements++;
  }
  return checked;
}
