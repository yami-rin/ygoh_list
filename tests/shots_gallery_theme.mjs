// card_gallery テーマ確認用スクリーンショット（?localtest=1 + galleryCacheシード）
// light/dark × desktop/mobile の4枚を保存（第1引数省略時は tests/shots_gallery/）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, firefox } from './helpers.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(TEST_DIR, 'shots_gallery');
const PORT = 5614;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();

const seedCards = Array.from({ length: 300 }, (_, i) => ({
    id: `t${i}`,
    data: {
        '名前': i % 7 === 0 ? `青眼の白龍${i}` : `テストカード${i}`,
        '型番': `TEST-JP${String(i % 1000).padStart(3, '0')}`,
        'レアリティ': ['N', 'R', 'SR', 'UR', 'SE'][i % 5],
        '枚数': (i % 3) + 1,
        tags: i % 10 === 0 ? ['デッキ用'] : [],
    },
}));

const variants = [
    { name: 'theme-light-desktop', theme: 'light', viewport: { width: 1440, height: 900 } },
    { name: 'theme-dark-desktop', theme: 'dark', viewport: { width: 1440, height: 900 } },
    { name: 'theme-light-mobile', theme: 'light', viewport: { width: 375, height: 812 } },
    { name: 'theme-dark-mobile', theme: 'dark', viewport: { width: 375, height: 812 } },
];

try {
    for (const v of variants) {
        const page = await browser.newPage({ viewport: v.viewport });
        page.on('dialog', (d) => d.accept());
        await page.route('**/card_list.html', (route) => route.abort());
        await page.addInitScript(({ cards, theme }) => {
            localStorage.setItem('theme', theme);
            localStorage.setItem('galleryCache_local_user_data', JSON.stringify({
                collection: cards, wishlist: [], bookmarks: [], decks: [], cachedAt: Date.now(),
            }));
        }, { cards: seedCards, theme: v.theme });
        await page.goto(`${baseUrl}/card_gallery.html?localtest=1`, { waitUntil: 'load' });
        await page.waitForFunction(
            () => document.querySelectorAll('#card-grid > *').length > 0,
            undefined, { timeout: 60000 });
        await page.waitForTimeout(500);
        // モバイルはfullPageだと縦長すぎて目視不能のためビューポートのみ
        await page.screenshot({ path: path.join(SHOT_DIR, `${v.name}.png`), fullPage: v.viewport.width > 500 });
        console.log(`✓ ${v.name}.png`);
        await page.close().catch(() => {});
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
