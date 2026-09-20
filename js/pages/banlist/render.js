export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
}

export function tierButton(tier, selected, action) {
    const button = element('button', 'tier-choice', tier.name);
    button.style.setProperty('--tier-color', tier.color);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', action);
    return button;
}

export function createBanlistRenderer({ getState, getDestination, onCardClick, onAddToTier, onMove, onSearch, queueImages }) {
    let draggedName = null;
    function makeCard(name, sourceTier = null) {
        const card = element('button', 'tier-card');
        card.type = 'button';
        card.dataset.name = name;
        card.draggable = true;
        const assigned = getState().tierState.findIndex(cards => cards.includes(name));
        const action = sourceTier === null && assigned < 0 ? `${getDestination().name}に追加` : '分類を変更';
        card.setAttribute('aria-label', `${name}：${action}`);
        card.title = `${name}：${action}`;
        const art = element('span', 'card-art');
        art.append(element('span', 'card-placeholder', name));
        card.append(art);
        if (sourceTier === null) card.append(element('span', assigned < 0 ? 'card-add' : 'assigned-badge', assigned < 0 ? '+' : '追加済'));
        card.addEventListener('click', () => onCardClick(name, sourceTier));
        card.addEventListener('dragstart', event => {
            draggedName = name;
            event.dataTransfer.setData('text/plain', name);
            event.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => { draggedName = null; card.classList.remove('dragging'); });
        return card;
    }

    function renderBoard() {
        const { tierConfig, tierState } = getState();
        const container = document.getElementById('tier-container');
        container.replaceChildren();
        tierConfig.forEach((tier, index) => {
            const row = element('section', 'tier-row');
            row.dataset.tierId = tier.id;
            row.style.setProperty('--tier-color', tier.color);
            row.setAttribute('aria-label', `${tier.name} ${tierState[index].length}枚`);
            const label = element('div', 'tier-label');
            label.append(element('h3', '', tier.name), element('span', 'tier-count', `${tierState[index].length} 枚`));
            const cards = element('div', 'tier-cards');
            cards.dataset.tierIdx = index;
            for (const name of tierState[index]) cards.append(makeCard(name, index));
            if (!tierState[index].length) {
                const add = element('button', 'empty-tier');
                add.append(icon('plus'), element('span', '', 'カードを追加'));
                add.setAttribute('aria-label', `${tier.name}にカードを追加`);
                add.addEventListener('click', () => onAddToTier(index));
                cards.append(add);
            }
            cards.addEventListener('dragover', event => { if (!draggedName) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; cards.classList.add('drag-over'); });
            cards.addEventListener('dragleave', event => { if (!cards.contains(event.relatedTarget)) cards.classList.remove('drag-over'); });
            cards.addEventListener('drop', event => {
                event.preventDefault();
                cards.classList.remove('drag-over');
                const before = event.target.closest('.tier-card')?.dataset.name;
                if (draggedName) onMove(draggedName, index, before);
                draggedName = null;
            });
            row.append(label, cards);
            container.append(row);
        });
        queueImages(container, 'board');
    }

    function renderPool(names, query, { ready, failed, total }) {
        const pool = document.getElementById('pool-cards');
        pool.replaceChildren();
        pool.setAttribute('aria-busy', String(!ready && !failed));
        document.getElementById('search-stats').textContent = !ready ? (failed ? '読み込みに失敗しました' : 'カードデータを読み込み中…') : query ? `${total.toLocaleString()}件${total > names.length ? `・先頭${names.length}件を表示` : ''}` : 'カード名・よみがなに対応';
        if (!names.length) {
            const empty = element('div', 'pool-empty');
            empty.append(icon('search'));
            empty.append(element('strong', '', !ready ? (failed ? 'データを読み込めませんでした' : 'カードを準備しています') : query ? '該当するカードがありません' : 'まずはカードを検索'));
            empty.append(element('p', '', query ? '短い名前や、よみがなでも検索できます。' : '予想する規制を選び、カードを追加してください。'));
            if (ready && !query) {
                const suggestions = element('div', 'suggestions');
                for (const name of ['灰流うらら', '青眼', 'ブラック・マジシャン']) {
                    const button = element('button', '', name);
                    button.addEventListener('click', () => onSearch(name));
                    suggestions.append(button);
                }
                empty.append(suggestions);
            }
            pool.append(empty);
        } else names.forEach(name => pool.append(makeCard(name)));
        queueImages(pool, 'search');
    }
    return { renderBoard, renderPool };
}
