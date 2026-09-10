'use strict';
(() => {
  const data = window.MALICE_ATLAS;
  const $ = id => document.getElementById(id);
  if (!data || data.version !== 1 || !Array.isArray(data.pairs) || !data.pairs.length || !data.cards || !data.main) {
    $('load-error').hidden = false;
    document.querySelector('.workspace').hidden = true;
    return;
  }
  const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase();
  const name = code => data.cards[code]?.name || String(code);
  const shortName = code => name(code).replace(/^M∀LICE＜[PC]＞/u, '').replace('M∀LICE IN ', '');
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const pairs = new Map(data.pairs.map(pair => [pair.id, pair]));
  const main = [...data.main].sort((a, b) => Number(name(b.code).includes('M∀LICE')) - Number(name(a.code).includes('M∀LICE')) || name(a.code).localeCompare(name(b.code), 'ja'));
  const counts = new Map(main.map(card => [card.code, card.count]));
  const defaultId = pairs.has('32061192-69272449') ? '32061192-69272449' : data.pairs.find(pair => pair.replay)?.id || data.pairs[0].id;
  let selected, currentStep = 0, timer = null;

  function kind(code) {
    const type = data.cards[code]?.type || 0;
    if (type & 0x4000000) return ['link', 'LINK'];
    if (type & 0x40) return ['fusion', 'FUSION'];
    if (type & 0x800000) return ['xyz', 'XYZ'];
    if (type & 4) return ['trap', 'TRAP'];
    if (type & 2) return ['spell', 'SPELL'];
    return ['monster', 'MONSTER'];
  }

  function endpointLabel(pair) {
    if (!pair.replay) return '保存手順なし';
    const final = pair.replay.states.at(-1);
    const monsters = final.monsters.filter(Boolean);
    if (monsters.some(card => kind(card.code)[0] === 'link')) return 'リンクモンスターあり';
    if (monsters.length) return `モンスター${monsters.length}体`;
    if (final.spells.some(Boolean)) return '魔法・罠のみ';
    return '盤面展開なし';
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    $('play').textContent = '自動で見る';
    $('play').setAttribute('aria-pressed', 'false');
  }

  function showCard(code) {
    stop();
    const card = data.cards[code];
    if (!card) return;
    $('card-kind').textContent = kind(code)[1];
    $('card-name').textContent = card.name;
    $('card-english').textContent = card.enName || '';
    const stat = value => value < 0 ? '?' : String(value);
    $('card-stats').textContent = card.type & 1
      ? `${kind(code)[0] === 'link' ? 'LINK' : 'LEVEL'} ${card.level} / ATK ${stat(card.attack)}${kind(code)[0] === 'link' ? '' : ` / DEF ${stat(card.defense)}`}`
      : kind(code)[0] === 'trap' ? '罠カード' : '魔法カード';
    $('card-text').textContent = card.text.replace(/ (?=[①②③④⑤⑥⑦⑧⑨])/gu, '\n');
    $('card-dialog').showModal();
  }

  function cardButton(card, pill = false, changed = false) {
    const [className, category] = kind(card.code);
    const faceDown = card.faceDown || !!(Number(card.position) & 10);
    const button = make('button', `${pill ? 'card-pill' : 'zone-card'} ${className}${faceDown ? ' face-down' : ''}${changed ? ' changed' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${name(card.code)}のカード情報を開く`);
    button.title = name(card.code);
    if (pill) button.textContent = `${shortName(card.code)}${faceDown ? '（裏側）' : ''}`;
    else {
      button.append(make('span', 'card-category', category), make('strong', '', shortName(card.code)),
        make('span', 'position', faceDown ? '裏側表示' : Number(card.position) === 4 ? '守備表示' : '表側表示'));
    }
    button.addEventListener('click', () => showCard(card.code));
    return button;
  }

  function drawZone(container, values, indexes, labels, previous) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i], card = values[index];
      const zone = make('div', `zone${card ? '' : ' empty'}`);
      zone.setAttribute('aria-label', labels[i]);
      if (card) zone.append(cardButton(card, false, !!currentStep && (previous?.[index]?.code !== card.code || previous?.[index]?.position !== card.position)));
      else zone.append(make('span', 'zone-name', labels[i]));
      fragment.append(zone);
    }
    container.replaceChildren(fragment);
  }

  function drawList(container, cards) {
    const fragment = document.createDocumentFragment();
    for (const card of cards) fragment.append(cardButton(card, true));
    if (!cards.length) fragment.append(make('span', 'nothing', 'なし'));
    container.replaceChildren(fragment);
  }

  function writeHash() {
    if (!selected) return;
    const hash = `#pair=${selected.id}&step=${currentStep}`;
    if (location.hash !== hash) {
      try { history.replaceState(null, '', hash); } catch { /* File viewers may not expose history. */ }
    }
  }

  function setStep(value, pause = true) {
    if (!selected?.replay) return;
    if (pause) stop();
    const replay = selected.replay;
    currentStep = Math.max(0, Math.min(replay.steps.length, Math.trunc(Number(value)) || 0));
    const state = replay.states[currentStep], previous = replay.states[currentStep - 1];
    $('lp').textContent = state.lp.toLocaleString('ja-JP');
    $('deck-count').textContent = state.deck;
    $('extra-count').textContent = state.extra.length;
    $('hand-count').textContent = `${state.hand.length}枚`;
    $('grave-count').textContent = state.grave.length;
    $('banished-count').textContent = state.banished.length;
    drawZone($('extra-zones'), state.monsters, [5, 6], ['EXTRA 1', 'EXTRA 2'], previous?.monsters);
    drawZone($('monster-zones'), state.monsters, [0, 1, 2, 3, 4], ['M1', 'M2', 'M3', 'M4', 'M5'], previous?.monsters);
    drawZone($('spell-zones'), state.spells, [0, 1, 2, 3, 4], ['S1', 'S2', 'S3', 'S4', 'S5'], previous?.spells);
    $('field-zone').replaceChildren();
    state.spells.slice(5).forEach((card, index) => {
      if (card) $('field-zone').append(make('span', '', index === 0 ? 'フィールド' : `追加枠${index}`), cardButton(card, true));
    });
    drawList($('hand-cards'), state.hand);
    drawList($('grave-cards'), state.grave);
    drawList($('banished-cards'), state.banished);
    $('step-range').max = replay.steps.length;
    $('step-range').value = currentStep;
    $('step-label').textContent = currentStep ? replay.steps[currentStep - 1].label : 'まずは、この2枚から。';
    $('step-counter').textContent = `${currentStep} / ${replay.steps.length}`;
    $('next-label').textContent = currentStep < replay.steps.length ? `次の操作：${replay.steps[currentStep].label}` : 'ここが保存手順の停止点です。先攻Main 1の途中で、ターン終了ではありません。';
    $('first-step').disabled = $('previous-step').disabled = currentStep === 0;
    $('last-step').disabled = $('next-step').disabled = currentStep === replay.steps.length;
    $('timeline').querySelectorAll('button').forEach((button, index) => {
      if (index + 1 === currentStep) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    writeHash();
  }

  function fillSecond() {
    const previous = $('second-card').value, first = Number($('first-card').value);
    const placeholder = make('option', '', 'もう1枚を選択'); placeholder.value = '';
    $('second-card').replaceChildren(placeholder);
    for (const card of main) {
      const option = make('option', '', `${name(card.code)}（${card.count}枚）`); option.value = card.code;
      option.disabled = first === card.code && card.count < 2;
      $('second-card').append(option);
    }
    $('second-card').value = first === Number(previous) && counts.get(first) < 2 ? '' : previous;
    $('show-hand').disabled = !$('second-card').value;
  }

  function selectPair(id, step = 0, reveal = false) {
    const pair = pairs.get(id);
    if (!pair) return;
    stop(); selected = pair;
    $('first-card').value = pair.hand[0]; fillSecond(); $('second-card').value = pair.hand[1]; $('show-hand').disabled = false;
    $('hand-error').textContent = '';
    $('hand-title').textContent = pair.hand.map(shortName).join(' ＋ ');
    $('route-badge').textContent = endpointLabel(pair);
    $('supported-view').hidden = !pair.replay;
    $('unsupported').hidden = !!pair.replay;
    if (reveal && window.matchMedia('(max-width: 760px)').matches) $('replay').scrollIntoView({block: 'start'});
    $('pair-list').querySelectorAll('button').forEach(button => button.setAttribute('aria-current', String(button.dataset.pair === pair.id)));
    if (!pair.replay) {
      currentStep = 0; $('usage-note').textContent = '既知の無ドロー手順の適用範囲外です。'; writeHash(); return;
    }
    const replay = pair.replay;
    const usage = {both_initial_cards_left_hand: '2枚とも手札を離れた証拠があります。', single_card_line_partner_retained: '1枚の手順を使い、もう1枚は手札に残ります。', usage_not_fully_identified: '同名カードの個体まで追跡せず、使用を断定できない部分があります。'};
    $('usage-note').textContent = `${usage[replay.usage.kind] || ''}${replay.usage.genericDiscardTemplate ? ' 手札コストを使う手順です。' : ''}`;
    const timeline = document.createDocumentFragment();
    replay.steps.forEach((stepData, index) => {
      const li = make('li'), button = make('button'); button.type = 'button';
      const text = make('span', '', stepData.label);
      text.append(make('span', 'timeline-caption', `${stepData.prompt}${stepData.automatic ? ' / 選択肢が1つの確認' : ''}`));
      button.append(make('span', 'timeline-number', String(index + 1).padStart(2, '0')), text);
      button.addEventListener('click', () => setStep(index + 1)); li.append(button); timeline.append(li);
    });
    $('timeline').replaceChildren(timeline); $('timeline-count').textContent = `${replay.steps.length}操作`;
    const details = document.createDocumentFragment();
    details.append(make('p', '', `この2枚に適合した候補${pair.candidates}件をすべて試し、${pair.attempted - pair.failedApplications}件が適用できました。表示は、その中から重み付き評価で選んだ1手順です。`),
      make('p', '', `評価値 ${replay.score.toFixed(4)}。勝率ではありません。罠を伏せるだけの手順も含みます。`),
      make('p', '', `必要手札として記録されたカード：${replay.requiredHand.map(name).join(' / ')}`));
    const route = make('p', '', '保存手順：'); route.append(make('code', '', replay.routeId)); details.append(route);
    details.append(make('p', '', '各操作の盤面は実coreの再生から保存しています。選択や確認も1操作として表示します。'));
    $('route-details').replaceChildren(details);
    setStep(step);
  }

  function drawPairs() {
    const words = normalize($('pair-search').value).trim().split(/\s+/u).filter(Boolean);
    const visible = data.pairs.filter(pair => words.every(word => normalize(pair.hand.map(code => `${name(code)} ${data.cards[code].enName} ${code}`).join(' ')).includes(word)));
    const fragment = document.createDocumentFragment();
    for (const pair of visible) {
      const button = make('button', 'pair-button'); button.type = 'button'; button.dataset.pair = pair.id;
      button.setAttribute('aria-current', String(pair.id === selected?.id));
      button.append(make('strong', '', pair.hand.map(shortName).join(' ＋ ')), make('span', '', endpointLabel(pair)));
      button.addEventListener('click', () => selectPair(pair.id, 0, true)); fragment.append(button);
    }
    if (!visible.length) fragment.append(make('p', 'empty-search', '一致する組み合わせはありません。'));
    $('pair-list').replaceChildren(fragment); $('list-count').textContent = `${visible.length} / ${data.pairs.length}組`;
  }

  for (const card of main) { const option = make('option', '', `${name(card.code)}（${card.count}枚）`); option.value = card.code; $('first-card').append(option); }
  for (const [hand, label] of [[[32061192, 57111661], 'Dormouse ＋ TB'], [[20938824, 57111661], 'Hare ＋ TB'], [[68337209, 68337209], 'UNDERGROUND 2枚'], [[69272449, 96676583], 'Rabbit ＋ Cat']]) {
    const id = [...hand].sort((a, b) => a - b).join('-');
    if (!pairs.has(id)) continue;
    const button = make('button', '', label); button.type = 'button'; button.addEventListener('click', () => selectPair(id, 0, true)); $('quick-picks').append(button);
  }
  $('pair-count').textContent = data.summary.pairs; $('catalog-count').textContent = data.summary.templates;
  $('main-size').textContent = data.main.reduce((sum, card) => sum + card.count, 0);
  $('verified-at').textContent = `実coreで再生確認：${new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(data.createdAt))} JST`;
  $('first-card').addEventListener('change', fillSecond);
  $('second-card').addEventListener('change', () => { $('show-hand').disabled = !$('second-card').value; });
  $('show-hand').addEventListener('click', () => {
    const hand = [Number($('first-card').value), Number($('second-card').value)], id = hand.sort((a, b) => a - b).join('-');
    if (!pairs.has(id)) { $('hand-error').textContent = 'この構築で持てる2枚を選んでください。'; return; }
    selectPair(id, 0, true);
  });
  $('pair-search').addEventListener('input', drawPairs);
  $('clear-search').addEventListener('click', () => { $('pair-search').value = ''; drawPairs(); $('pair-search').focus(); });
  $('first-step').addEventListener('click', () => setStep(0));
  $('previous-step').addEventListener('click', () => setStep(currentStep - 1));
  $('next-step').addEventListener('click', () => setStep(currentStep + 1));
  $('last-step').addEventListener('click', () => setStep(selected.replay.steps.length));
  $('step-range').addEventListener('input', event => setStep(event.target.value));
  $('play').addEventListener('click', () => {
    if (timer !== null) { stop(); return; }
    if (!selected?.replay) return;
    if (currentStep === selected.replay.steps.length) setStep(0);
    timer = window.setInterval(() => { setStep(currentStep + 1, false); if (currentStep === selected.replay.steps.length) stop(); }, 1100);
    $('play').textContent = '一時停止'; $('play').setAttribute('aria-pressed', 'true');
  });
  $('close-card').addEventListener('click', () => $('card-dialog').close());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  const fromHash = () => {
    const query = new URLSearchParams(location.hash.slice(1));
    // Section links scroll without discarding the selected hand or operation.
    if (selected && !query.has('pair')) return;
    selectPair(pairs.has(query.get('pair')) ? query.get('pair') : defaultId, Number(query.get('step')) || 0);
  };
  window.addEventListener('hashchange', fromHash);
  drawPairs(); fromHash();
})();
