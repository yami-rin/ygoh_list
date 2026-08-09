import { serve, firefox, collectErrors } from './helpers.mjs';

const PORT = 5623;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = collectErrors(page);
const requests = { GET: 0, HEAD: 0 };
let abortHead = false;

page.on('request', (request) => {
    if (request.url().endsWith('/tests/fixtures/master-card.csv')) {
        requests[request.method()] = (requests[request.method()] || 0) + 1;
    }
});
await page.route('**/tests/fixtures/master-card.csv', (route) => {
    if (abortHead && route.request().method() === 'HEAD') return route.abort();
    return route.continue();
});

const clearMasterDb = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('ygoh-master-cache');
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
}));

try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await clearMasterDb();

    const cold = await page.evaluate(async () => {
        const module = await import('./js/shared/master-data.js');
        const loads = await Promise.all(Array.from({ length: 3 }, () => module.loadMasterData({
            csvUrl: 'tests/fixtures/master-card.csv'
        })));
        const comma = loads[0].cardDetailsMap.get('引用符,カンマ');
        const empty = loads[0].cardDetailsMap.get('空フィールド');
        return {
            lengths: loads.map((master) => master.cards.length),
            fromCache: loads.map((master) => master.fromCache),
            comma,
            empty,
            parserVersion: module.MASTER_PARSER_VERSION
        };
    });

    if (requests.GET !== 1) throw new Error(`同一URL並列loadのGETが1回ではありません: ${requests.GET}`);
    if (cold.lengths.some((length) => length !== 2) || cold.fromCache.some(Boolean)) {
        throw new Error(`cold戻り値が不正です: ${JSON.stringify(cold)}`);
    }
    if (cold.comma?.cardText !== '効果,説明' || cold.comma?.race !== '' || cold.comma?.defense !== '') {
        throw new Error(`BOM/quoted comma/empty fieldのparse結果が不正です: ${JSON.stringify(cold.comma)}`);
    }
    if (cold.empty?.reading !== '' || cold.empty?.attack !== '' || cold.empty?.defense !== '') {
        throw new Error(`empty fieldの位置が保持されていません: ${JSON.stringify(cold.empty)}`);
    }

    const getAfterCold = requests.GET;
    const headBeforeWarm = requests.HEAD;
    const warm = await page.evaluate(async () => {
        const { loadMasterData } = await import('./js/shared/master-data.js');
        return Promise.all([
            loadMasterData({ csvUrl: 'tests/fixtures/master-card.csv' }),
            loadMasterData({ csvUrl: 'tests/fixtures/master-card.csv' })
        ]).then((loads) => loads.map((master) => master.fromCache));
    });
    if (requests.GET !== getAfterCold || requests.HEAD - headBeforeWarm !== 1 || warm.some((value) => !value)) {
        throw new Error(`warm contract違反: requests=${JSON.stringify(requests)}, fromCache=${warm}`);
    }

    const fixtureUrl = `${baseUrl}/tests/fixtures/master-card.csv`;
    await page.evaluate(async ({ url, staleVersion }) => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('ygoh-master-cache', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const record = await new Promise((resolve, reject) => {
            const request = db.transaction('files', 'readonly').objectStore('files').get(url);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        record.parserVersion = staleVersion;
        await new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            tx.objectStore('files').put(record);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }, { url: fixtureUrl, staleVersion: cold.parserVersion - 1 });

    const getBeforeReparse = requests.GET;
    const reparsed = await page.evaluate(async () => {
        const { loadMasterData } = await import('./js/shared/master-data.js');
        const master = await loadMasterData({ csvUrl: 'tests/fixtures/master-card.csv' });
        return { fromCache: master.fromCache, count: master.cards.length };
    });
    if (requests.GET - getBeforeReparse !== 1 || reparsed.fromCache || reparsed.count !== 2) {
        throw new Error(`parserVersion変更時だけ再parseされません: ${JSON.stringify(reparsed)}`);
    }

    const getBeforeOffline = requests.GET;
    abortHead = true;
    const offline = await page.evaluate(async () => {
        const { loadMasterData } = await import('./js/shared/master-data.js');
        const master = await loadMasterData({ csvUrl: 'tests/fixtures/master-card.csv' });
        return { fromCache: master.fromCache, count: master.cards.length };
    });
    if (!offline.fromCache || offline.count !== 2 || requests.GET !== getBeforeOffline) {
        throw new Error(`HEAD失敗時のcache fallback違反: ${JSON.stringify(offline)}`);
    }
    if (errors.length) throw new Error(`console/page error: ${errors.join(' | ')}`);

    console.log('✓ 同一URL並列call: CSV GET 1回・Promise共有');
    console.log('✓ warm: CSV本文GET 0回・fromCache=true・HEAD 1回');
    console.log('✓ parserVersion変更時のみ再parse・新recordへ一方向更新');
    console.log('✓ HEAD失敗時: 旧store/keyのcache fallback');
    console.log('✓ BOM / quoted comma / empty field');
} finally {
    await context.close().catch(() => {});
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
