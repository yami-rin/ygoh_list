// card_gallery の認証後ホットパス計測（?localtest=1 + galleryCacheシード）
// 計測: シード→グリッド表示までの壁時計時間 / changePage(再描画) / 検索フィルタ
import { serve, firefox, summarizeSamples } from './helpers.mjs';

const PORT = 5603;
const CARD_COUNT = Number(process.argv[2] || 3000);
const RUNS = 5;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();

const seedCards = Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: `t${i}`,
    data: {
        '名前': i % 7 === 0 ? `青眼の白龍${i}` : `テストカード${i}`,
        '型番': `TEST-JP${String(i % 1000).padStart(3, '0')}`,
        'レアリティ': ['N', 'R', 'SR', 'UR', 'SE'][i % 5],
        '枚数': (i % 3) + 1,
        tags: i % 10 === 0 ? ['デッキ用'] : [],
    },
}));

try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    await page.route('**/card_list.html', (route) => route.abort());
    await page.addInitScript(({ cards }) => {
        localStorage.setItem('galleryCache_local_user_data', JSON.stringify({
            collection: cards, wishlist: [], bookmarks: [], decks: [], cachedAt: Date.now(),
        }));
    }, { cards: seedCards });

    const t0 = Date.now();
    await page.goto(`${baseUrl}/card_gallery.html?localtest=1`, { waitUntil: 'load' });
    await page.waitForFunction(
        () => document.querySelectorAll('#card-grid > *').length > 0,
        undefined, { timeout: 60000 });
    const wallToGrid = Date.now() - t0;
    const gridCount = await page.evaluate(() => document.querySelectorAll('#card-grid > *').length);
    console.log(`グリッド表示: ${wallToGrid}ms (表示枚数=${gridCount}, データ${CARD_COUNT}枚)`);

    const renderTimes = [];
    for (let i = 0; i < RUNS; i++) {
        renderTimes.push(await page.evaluate(() => {
            const s = performance.now();
            window.changePage(1);
            return performance.now() - s;
        }));
    }
    const render = summarizeSamples(renderTimes);
    console.log(`changePage再描画: median ${render.median.toFixed(1)}ms, p95 ${render.p95.toFixed(1)}ms (all: ${render.samples.map(t => t.toFixed(1)).join(', ')})`);

    // 検索: input発火→グリッドDOM更新完了までの実時間(デバウンス込み)
    const filterTimes = [];
    for (let i = 0; i < RUNS; i++) {
        const term = i % 2 === 0 ? '青眼' : 'テストカード1';
        const t = await page.evaluate(async (searchTerm) => {
            const grid = document.getElementById('card-grid');
            const input = document.getElementById('search-input');
            input.value = searchTerm;
            const done = new Promise((res) => {
                const mo = new MutationObserver(() => { mo.disconnect(); res(); });
                mo.observe(grid, { childList: true, subtree: true });
                setTimeout(() => { mo.disconnect(); res(); }, 5000);
            });
            const s = performance.now();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await done;
            return performance.now() - s;
        }, term);
        filterTimes.push(t);
        await page.waitForTimeout(150);
    }
    const filter = summarizeSamples(filterTimes);
    console.log(`検索→グリッド更新完了: median ${filter.median.toFixed(1)}ms, p95 ${filter.p95.toFixed(1)}ms (all: ${filter.samples.map(t => t.toFixed(1)).join(', ')})`);
    console.log(`browser=Firefox ${browser.version()}, fixture=${CARD_COUNT} cards, state=warm localtest cache`);

    await page.close().catch(() => {});
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
