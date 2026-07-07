// 遊戯王マスターデータ共通ローダー（card_list / card_gallery 等ページ非依存）
//
// 使い方:
//   import { loadMasterData } from './js/shared/master-data.js';
//   const master = await loadMasterData();
//   master.cardDetailsMap.get('灰流うらら') // → { cardId, reading, level, ... }
//
// 仕組み:
// - CSV(約1.4MB)のパースは Web Worker で実行し、メインスレッドをブロックしない
// - パース結果は IndexedDB にキャッシュし、2回目以降は HEAD リクエストで
//   更新確認のみ（Last-Modified / Content-Length が同じなら再DL・再パースしない）
// - オフラインや HEAD 失敗時はキャッシュがあればそれを使う

import { parseCsvCards } from './csv-worker.js';

const DB_NAME = 'ygoh-master-cache';
const DB_VERSION = 1;
const STORE = 'files';

const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE, { keyPath: 'url' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

const idbGet = async (url) => {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(url);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch { return null; }
};

const idbPut = async (record) => {
    try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(record);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.warn('master-data: IndexedDBへの保存に失敗', e); }
};

// Worker でパース（失敗時はメインスレッドでフォールバック）
const parseInWorker = (csvText) => new Promise((resolve) => {
    let worker;
    try {
        worker = new Worker(new URL('./csv-worker.js', import.meta.url), { type: 'module' });
    } catch {
        resolve(parseCsvCards(csvText));
        return;
    }
    worker.onmessage = (e) => {
        worker.terminate();
        if (e.data.error) {
            console.warn('master-data: Workerパース失敗、メインスレッドで再実行', e.data.error);
            resolve(parseCsvCards(csvText));
        } else {
            resolve(e.data.cards);
        }
    };
    worker.onerror = () => {
        worker.terminate();
        resolve(parseCsvCards(csvText));
    };
    worker.postMessage(csvText);
});

const fileSignature = (headers) =>
    `${headers.get('last-modified') || ''}|${headers.get('content-length') || ''}|${headers.get('etag') || ''}`;

// カタカナ→ひらがな
const toHiragana = (s) => s.replace(/[ァ-ヶ]/g,
    (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));

// パース済みカード配列から各種インデックスを構築（数msで完了）
const buildIndexes = (cards) => {
    const cardDetailsMap = new Map();      // 名前 → details
    const cardIdToDetailsMap = new Map();  // カードID → details
    const cardReadingMap = new Map();      // 読み(小文字/ひらがな) → [名前, ...]
    const nameToIdMap = new Map();         // 名前 → カードID

    for (const card of cards) {
        cardDetailsMap.set(card.name, card);
        if (card.cardId) {
            cardIdToDetailsMap.set(card.cardId, card);
            nameToIdMap.set(card.name, card.cardId);
        }
        if (card.reading) {
            const readingKey = card.reading.toLowerCase();
            if (!cardReadingMap.has(readingKey)) cardReadingMap.set(readingKey, []);
            cardReadingMap.get(readingKey).push(card.name);

            const hiragana = toHiragana(readingKey);
            if (hiragana !== readingKey) {
                if (!cardReadingMap.has(hiragana)) cardReadingMap.set(hiragana, []);
                cardReadingMap.get(hiragana).push(card.name);
            }
        }
    }
    return { cardDetailsMap, cardIdToDetailsMap, cardReadingMap, nameToIdMap };
};

/**
 * マスターデータをロードする。
 * @param {Object} [options]
 * @param {string} [options.csvUrl] CSVのURL（既定: ページ相対の yugioh_cards_master.csv）
 * @param {boolean} [options.forceRefresh] キャッシュを無視して再取得する
 * @returns {Promise<{cards: Array, cardDetailsMap: Map, cardIdToDetailsMap: Map,
 *                    cardReadingMap: Map, nameToIdMap: Map, fromCache: boolean}>}
 */
export async function loadMasterData({ csvUrl = 'yugioh_cards_master.csv', forceRefresh = false } = {}) {
    const absUrl = new URL(csvUrl, document.baseURI).href;
    const t0 = performance.now();
    const cached = forceRefresh ? null : await idbGet(absUrl);

    let cards = null;
    let fromCache = false;

    if (cached) {
        // 更新確認（HEAD）。失敗＝オフライン等はキャッシュをそのまま使う
        let signature = null;
        try {
            const head = await fetch(absUrl, { method: 'HEAD' });
            if (head.ok) signature = fileSignature(head.headers);
        } catch { /* offline: use cache */ }

        if (signature === null || signature === cached.signature) {
            cards = cached.cards;
            fromCache = true;
        }
    }

    if (!cards) {
        const response = await fetch(absUrl);
        if (!response.ok) {
            if (cached) {
                cards = cached.cards;
                fromCache = true;
            } else {
                throw new Error(`マスターCSVの取得に失敗しました (${response.status})`);
            }
        } else {
            const signature = fileSignature(response.headers);
            const text = await response.text();
            cards = await parseInWorker(text);
            idbPut({ url: absUrl, signature, cachedAt: Date.now(), cards });
        }
    }

    const indexes = buildIndexes(cards);
    console.log(`master-data: ${cards.length}件ロード完了 (${fromCache ? 'IndexedDBキャッシュ' : 'ネットワーク'}, ${Math.round(performance.now() - t0)}ms)`);
    return { cards, ...indexes, fromCache };
}
