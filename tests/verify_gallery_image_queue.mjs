import { serve, firefox } from './helpers.mjs';

const PORT = 5620;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const cards = Array.from({ length: 120 }, (_, index) => ({
    id: `queue-${index}`,
    data: {
        '名前': `限定カード${String(index).padStart(3, '0')}`,
        '型番': `QUEUE-JP${String(index).padStart(3, '0')}`,
        'レアリティ': 'N',
        '枚数': 1,
        customCardId: String(900000 + index),
        tags: []
    }
}));

let activeRequests = 0;
let maxActiveRequests = 0;
let firstRequestDomCount = null;
const detailRequests = [];
const imageRequests = [];

const waitForQueue = async () => {
    await page.waitForTimeout(150);
    await page.waitForFunction(() => {
        const state = window.__galleryImageQueue?.getDiagnostics();
        return state && state.active === 0 && state.pending === 0;
    }, undefined, { timeout: 30000 });
};

const handleNetwork = async (route, kind) => {
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    try {
        if (firstRequestDomCount === null) {
            firstRequestDomCount = await page.locator('#card-grid .card-name').count();
        }
        await new Promise((resolve) => setTimeout(resolve, 60));
        const requestUrl = new URL(route.request().url());
        if (kind === 'detail') {
            const cid = requestUrl.searchParams.get('cid');
            detailRequests.push(cid);
            const imageUrl = `http://localhost:3000/mock-image/${cid}.png`;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ imageUrl, illustrations: [{ ciid: '1', imageUrl }] })
            });
        } else {
            imageRequests.push(requestUrl.pathname.split('/').pop());
            await route.fulfill({ status: 200, contentType: 'image/png', body: png });
        }
    } finally {
        activeRequests--;
    }
};

try {
    await page.route('**/card-detail?**', (route) => handleNetwork(route, 'detail'));
    await page.route('**/mock-image/**', (route) => handleNetwork(route, 'image'));
    await page.addInitScript((seedCards) => {
        localStorage.setItem('galleryCache_local_user_data', JSON.stringify({
            collection: seedCards,
            wishlist: [],
            bookmarks: [],
            decks: [],
            cachedAt: Date.now()
        }));
    }, cards);

    await page.goto(`${baseUrl}/card_gallery.html?localtest=1`, { waitUntil: 'load' });
    await page.waitForSelector('#card-grid .card-name');
    await page.waitForFunction(() => {
        const state = window.__galleryImageQueue?.getDiagnostics();
        return state?.active === 6 && state.pending > 0;
    });

    const pageCardCount = await page.locator('#card-grid .card-item').count();
    const initialStarted = await page.evaluate(() => window.__galleryImageQueue.getDiagnostics().started);
    if (firstRequestDomCount !== pageCardCount) {
        throw new Error(`画像要求より先にDOMが完成していません: DOM=${firstRequestDomCount}, page=${pageCardCount}`);
    }

    // Keep the initial six active jobs delayed, then replace the pending generation rapidly.
    await page.evaluate(() => {
        const input = document.getElementById('search-input');
        for (const value of ['限定カード119', '限定カード118', '限定カード117']) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await page.waitForFunction(() => document.querySelector('#card-grid .card-name')?.textContent.includes('117'));
    await waitForQueue();

    const afterRapid = await page.evaluate(() => window.__galleryImageQueue.getDiagnostics());
    const oldDetailRequests = detailRequests.filter((cid) => cid !== '900117').length;
    if (afterRapid.cancelledPending === 0) throw new Error('rapid filterで旧queueがcancelされていません');
    if (oldDetailRequests > 6) throw new Error(`旧filterの画像要求が6件を超えました: ${oldDetailRequests}`);
    if (!detailRequests.includes('900117')) throw new Error('最終filterの可視カード画像が取得されていません');

    // The just-fetched card must be served from IndexedDB without another network request.
    const networkBeforeCacheHit = detailRequests.length + imageRequests.length;
    const hitsBefore = afterRapid.cacheHits;
    await page.locator('#search-input').fill('一致しない検索');
    await page.locator('#search-input').fill('限定カード117');
    await page.waitForFunction(() => document.querySelector('#card-grid .card-name')?.textContent.includes('117'));
    await waitForQueue();
    const afterCacheHit = await page.evaluate(() => window.__galleryImageQueue.getDiagnostics());
    const networkAfterCacheHit = detailRequests.length + imageRequests.length;
    if (networkAfterCacheHit !== networkBeforeCacheHit) throw new Error('cache hitでnetwork再取得が発生しました');
    if (afterCacheHit.cacheHits <= hitsBefore) throw new Error('cache hitが記録されていません');

    // Clearing the filter queues only the top viewport; scrolling queues the newly visible cards.
    await page.locator('#search-input').fill('');
    await waitForQueue();
    const requestsBeforeScroll = detailRequests.length;
    const topDiagnostics = await page.evaluate(() => window.__galleryImageQueue.getDiagnostics());
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction((before) => window.__galleryImageQueue.getDiagnostics().started > before, topDiagnostics.started);
    await waitForQueue();
    const requestsAfterScroll = detailRequests.length;
    const finalDiagnostics = await page.evaluate(() => window.__galleryImageQueue.getDiagnostics());

    if (initialStarted >= pageCardCount) throw new Error(`初期描画で非表示カードまでqueueされました: ${initialStarted}/${pageCardCount}`);
    if (requestsAfterScroll <= requestsBeforeScroll) throw new Error('scrollで新しい可視カードがqueueされていません');
    if (maxActiveRequests > 6 || finalDiagnostics.maxActive > 6) {
        throw new Error(`同時画像取得上限を超過: route=${maxActiveRequests}, queue=${finalDiagnostics.maxActive}`);
    }

    console.log(`✓ DOM先行: ${firstRequestDomCount}/${pageCardCount} cards`);
    console.log(`✓ rapid filter: 旧request=${oldDetailRequests}, cancel=${afterRapid.cancelledPending}`);
    console.log(`✓ cache: hit=${finalDiagnostics.cacheHits}, miss=${finalDiagnostics.cacheMisses}, hit時network追加=0`);
    console.log(`✓ scroll: detail request ${requestsBeforeScroll} → ${requestsAfterScroll}`);
    console.log(`✓ concurrency: route最大=${maxActiveRequests}, queue最大=${finalDiagnostics.maxActive}/6`);
    console.log(`request totals: detail=${detailRequests.length}, image=${imageRequests.length}`);
} finally {
    await page.close().catch(() => {});
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
