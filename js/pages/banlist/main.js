import { loadMasterData } from '../../shared/master-data.js';
import { createImageService } from '../../shared/image-service.js';
import { emptyState, loadBanlistState, saveBanlistState, validateState } from './storage.js';
import { createBanlistRenderer, element, tierButton } from './render.js';
import { renderExport } from './export.js';

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60)).replace(/[\s・･－ー\-]/g, '');
let state = emptyState();
let storageReadable = true;
try { state = loadBanlistState(); } catch { storageReadable = false; }
let destination = 0;
let masterReady = false;
let masterFailed = false;
let cardMap = new Map();
let searchIndex = [];
let history = [];
let selectedCard = null;
let settingsDraft = [];
let toastTimer;
let searchTimer;
let titleEditing = false;
let unsaved = false;
let exportController;
let exportBlob = null;
const imageUrls = new Map();
const images = createImageService();

function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
}

function persist() {
    try {
        if (!storageReadable) throw new Error('storage unavailable');
        saveBanlistState(state);
        unsaved = false;
        $('save-status').textContent = 'この端末に保存済み';
        $('save-status').classList.remove('failed');
    } catch {
        unsaved = true;
        $('save-status').textContent = '自動保存できません。「その他」からデータを保存してください';
        $('save-status').classList.add('failed');
    }
}

function checkpoint() {
    history.push(clone(state));
    if (history.length > 40) history.shift();
}

function update(change, message) {
    checkpoint();
    change();
    persist();
    renderAll();
    if (message) toast(message);
}

async function loadImage(name, parentSignal) {
    if (imageUrls.has(name)) return imageUrls.get(name);
    const card = cardMap.get(name);
    if (!card) return null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (parentSignal?.aborted) return null;
    parentSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 12000);
    try {
        const url = await images.getCardImage({ cardId: card.cardId, signal: controller.signal });
        // The shared cache returns data URLs, safe for canvas export without tainting.
        if (url && /^data:(image\/|application\/octet-stream)/.test(url)) { imageUrls.set(name, url); return url; }
        return null;
    } catch { return null; }
    finally { clearTimeout(timeout); parentSignal?.removeEventListener('abort', abort); }
}

function queueImages(container, channel) {
    const apply = (card, url) => {
        if (!url || !card.isConnected) return;
        const image = new Image();
        image.alt = '';
        image.decoding = 'async';
        image.onload = () => { if (card.isConnected) card.querySelector('.card-art').replaceChildren(image); };
        image.src = url;
    };
    const cards = [...container.querySelectorAll('.tier-card')];
    for (const card of cards) if (imageUrls.has(card.dataset.name)) apply(card, imageUrls.get(card.dataset.name));
    images.prefetchVisible({
        channel, elements: cards.filter(card => !imageUrls.has(card.dataset.name)), rootMargin: '120px',
        createRequest: card => ({ load: ({ signal }) => loadImage(card.dataset.name, signal), apply: url => apply(card, url) }),
    });
}

const renderer = createBanlistRenderer({
    getState: () => state,
    getDestination: () => state.tierConfig[destination],
    onCardClick: (name, source) => {
        if (source === null && !state.tierState.some(cards => cards.includes(name))) moveCard(name, destination);
        else openCard(name);
    },
    onAddToTier: index => { destination = index; renderPicker(); renderSearch(); setView('search'); $('search-input').focus(); },
    onMove: (name, target, before) => moveCard(name, target, before, true),
    onSearch: query => { $('search-input').value = query; renderSearch(); },
    queueImages,
});

function renderPicker() {
    $('tier-picker').replaceChildren(...state.tierConfig.map((tier, index) => tierButton(tier, destination === index, () => {
        destination = index;
        renderPicker();
        renderSearch();
        $('tier-picker').children[index].focus({ preventScroll: true });
    })));
}

function renderSearch() {
    const query = $('search-input').value.trim();
    const terms = query.split(/\s+/).map(normalize).filter(Boolean);
    const matches = masterReady && terms.length ? searchIndex.filter(card => terms.every(term => card.key.includes(term))) : [];
    const exact = normalize(query);
    // Exact card names and readings should not be buried in a broad partial match.
    matches.sort((a, b) => Number(b.nameKey === exact || b.readingKey === exact) - Number(a.nameKey === exact || a.readingKey === exact));
    renderer.renderPool(matches.slice(0, 80).map(card => card.name), query, { ready: masterReady, failed: masterFailed, total: matches.length });
}

function renderAll() {
    const focused = document.activeElement;
    const cardName = focused?.dataset.name;
    const focusScope = focused?.closest('#pool-cards') ? $('pool-cards') : $('tier-container');
    destination = Math.min(destination, state.tierConfig.length - 1);
    $('list-title').value = state.title;
    const count = state.tierState.flat().length;
    $('total-count').textContent = count;
    $('mobile-count').textContent = count;
    $('undo-btn').disabled = !history.length;
    renderer.renderBoard();
    renderPicker();
    renderSearch();
    if (cardName) {
        const target = [...focusScope.querySelectorAll('.tier-card')].find(card => card.dataset.name === cardName);
        (target || $('undo-btn')).focus({ preventScroll: true });
    }
}

function setView(view) {
    $('app').dataset.view = view;
    for (const name of ['board', 'search']) {
        $(`view-${name}`).classList.toggle('active', name === view);
        $(`view-${name}`).setAttribute('aria-pressed', String(name === view));
    }
    if (matchMedia('(max-width: 760px)').matches) window.scrollTo({ top: 0, behavior: 'instant' });
}

function moveCard(name, target, before, reorder = false) {
    const source = state.tierState.findIndex(cards => cards.includes(name));
    if (target === source && !reorder || before === name) return;
    if (target === source && !before && state.tierState[source].at(-1) === name) return;
    if (target !== null && !state.tierConfig[target]) return;
    if (source < 0 && !cardMap.has(name)) return;
    if (source < 0 && state.tierState.flat().length >= 2000) { toast('登録できるのは2,000枚までです'); return; }
    const message = target === null ? `${name}をリストから削除しました` : `${state.tierConfig[target].name}に${source < 0 ? '追加' : '移動'}しました`;
    update(() => {
        state.tierState = state.tierState.map(cards => cards.filter(card => card !== name));
        if (target !== null) {
            const list = state.tierState[target];
            const index = before ? list.indexOf(before) : -1;
            list.splice(index < 0 ? list.length : index, 0, name);
        }
    }, message);
}

function openCard(name) {
    selectedCard = name;
    $('selected-card-name').textContent = name;
    const source = state.tierState.findIndex(cards => cards.includes(name));
    $('move-options').replaceChildren(...state.tierConfig.map((tier, index) => tierButton(tier, source === index, () => {
        $('card-dialog').close();
        moveCard(name, index);
    })));
    $('card-dialog').showModal();
}

function renderSettings() {
    $('tier-config-list').replaceChildren();
    settingsDraft.forEach((tier, index) => {
        const row = element('div', 'tier-config-row');
        row.dataset.id = tier.id;
        const color = element('input');
        color.type = 'color'; color.value = tier.color;
        color.setAttribute('aria-label', `分類${index + 1}の色`);
        color.addEventListener('input', () => { tier.color = color.value; });
        const name = element('input');
        name.type = 'text'; name.value = tier.name; name.maxLength = 24;
        name.setAttribute('aria-label', `分類${index + 1}の名前`);
        name.addEventListener('input', () => { tier.name = name.value; });
        row.append(color, name);
        for (const [label, text, delta] of [['上へ', '↑', -1], ['下へ', '↓', 1], ['削除', '×', 0]]) {
            const button = element('button', `row-action${!delta ? ' danger-text' : ''}`, text);
            button.setAttribute('aria-label', `分類${index + 1}を${label}`);
            button.disabled = delta === -1 && index === 0 || delta === 1 && index === settingsDraft.length - 1;
            button.addEventListener('click', () => {
                if (delta) [settingsDraft[index], settingsDraft[index + delta]] = [settingsDraft[index + delta], settingsDraft[index]];
                else settingsDraft.splice(index, 1);
                renderSettings();
                const next = $('tier-config-list').children[Math.max(0, Math.min(index + delta, settingsDraft.length - 1))];
                (next?.querySelector('input[type="text"]') || $('add-tier-btn')).focus();
            });
            row.append(button);
        }
        $('tier-config-list').append(row);
    });
    $('add-tier-btn').disabled = settingsDraft.length >= 30;
}

function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = element('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function openExport() {
    exportController?.abort();
    const controller = new AbortController();
    exportController = controller;
    exportBlob = null;
    $('download-btn').disabled = true;
    $('export-canvas').hidden = true;
    $('export-status').textContent = '画像を準備しています…';
    $('export-dialog').showModal();
    try {
        const result = await renderExport($('export-canvas'), clone(state), name => loadImage(name, controller.signal), controller.signal);
        if (controller.signal.aborted) return;
        exportBlob = result.blob;
        $('export-canvas').hidden = false;
        $('export-status').textContent = result.missing ? `${result.missing}枚の画像を取得できなかったため、カード名で表示しています。` : '予想リストをPNG画像で保存します。';
        $('download-btn').disabled = false;
    } catch (error) {
        if (!controller.signal.aborted) $('export-status').textContent = `画像を作成できませんでした。${error.message}`;
    }
}

async function loadCards() {
    masterFailed = false;
    $('load-error').hidden = true;
    $('retry-btn').disabled = true;
    renderSearch();
    try {
        const master = await loadMasterData();
        if (!master.cards.length) throw new Error('Empty master');
        cardMap = master.cardDetailsMap;
        searchIndex = [...cardMap].map(([name, card]) => ({ name, nameKey: normalize(name), readingKey: normalize(card.reading || ''), key: normalize(name) + ' ' + normalize(card.reading || '') }));
        masterReady = true;
        $('search-input').disabled = false;
        renderAll();
    } catch {
        masterFailed = true;
        $('load-error').hidden = false;
        renderSearch();
    } finally { $('retry-btn').disabled = false; }
}

$('search-input').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 100); });
$('view-board').addEventListener('click', () => setView('board'));
$('view-search').addEventListener('click', () => { setView('search'); $('search-input').focus({ preventScroll: true }); });
$('retry-btn').addEventListener('click', loadCards);
$('undo-btn').addEventListener('click', () => { if (!history.length) return; state = history.pop(); persist(); renderAll(); toast('ひとつ前の状態に戻しました'); });
$('list-title').addEventListener('input', () => {
    if (!titleEditing) { checkpoint(); titleEditing = true; }
    state.title = $('list-title').value;
    persist();
    $('undo-btn').disabled = false;
});
$('list-title').addEventListener('blur', () => { titleEditing = false; });
$('settings-btn').addEventListener('click', () => { settingsDraft = clone(state.tierConfig); $('settings-error').textContent = ''; renderSettings(); $('settings-dialog').showModal(); });
$('add-tier-btn').addEventListener('click', () => {
    if (settingsDraft.length >= 30) return;
    settingsDraft.push({ id: crypto.randomUUID(), name: '新しい分類', color: '#658898' });
    renderSettings();
    const input = $('tier-config-list').lastElementChild.querySelector('input[type="text"]');
    input.focus(); input.select();
});
$('apply-settings-btn').addEventListener('click', () => {
    try {
        const byId = new Map(state.tierConfig.map((tier, index) => [tier.id, state.tierState[index]]));
        const next = validateState({ ...state, tierConfig: settingsDraft, tierState: settingsDraft.map(tier => byId.get(tier.id) || []) });
        $('settings-dialog').close();
        const selectedId = state.tierConfig[destination].id;
        update(() => { state = next; destination = Math.max(0, state.tierConfig.findIndex(tier => tier.id === selectedId)); }, '分類を更新しました');
    } catch (error) { $('settings-error').textContent = error.message; }
});
$('remove-card-btn').addEventListener('click', () => { $('card-dialog').close(); moveCard(selectedCard, null); });
$('reset-btn').addEventListener('click', () => {
    $('data-menu').open = false;
    if (!state.tierState.flat().length) { toast('リストは空です'); return; }
    if (confirm('すべてのカードをリストから外しますか？分類とリスト名は残ります。')) update(() => { state.tierState = state.tierConfig.map(() => []); }, 'リストを空にしました。元に戻すこともできます');
});
$('backup-btn').addEventListener('click', () => { $('data-menu').open = false; download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'banlist.json'); });
$('import-btn').addEventListener('click', () => { $('data-menu').open = false; $('import-file').click(); });
$('import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (file.size > 2 * 1024 * 1024) throw new Error('2MB以下のJSONファイルを選んでください。');
        const next = validateState(JSON.parse(await file.text()));
        if (!confirm('読み込んだデータで現在のリストを置き換えますか？「元に戻す」で取り消せます。')) return;
        update(() => { state = next; destination = 0; }, 'データを読み込みました');
    } catch (error) { alert(`読み込めませんでした。${error.message}`); }
    finally { event.target.value = ''; }
});
$('export-btn').addEventListener('click', openExport);
$('export-dialog').addEventListener('close', () => exportController?.abort());
$('download-btn').addEventListener('click', () => { if (exportBlob) download(exportBlob, 'banlist.png'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
document.addEventListener('click', event => { if (!$('data-menu').contains(event.target)) $('data-menu').open = false; });
document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey && !event.target.matches('input, textarea') && !document.querySelector('dialog[open]')) { event.preventDefault(); $('undo-btn').click(); }
});
window.addEventListener('beforeunload', event => { if (unsaved) { event.preventDefault(); event.returnValue = ''; } });
renderAll();
if (!storageReadable) {
    $('save-status').textContent = '保存データを読み込めません。元データを保護しています。編集後はJSONで保存してください';
    $('save-status').classList.add('failed');
}
loadCards();
