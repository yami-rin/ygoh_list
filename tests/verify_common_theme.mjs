// 全9画面のテーマ・layout契約を現行状態のまま観測する。
// 未移行画面の失敗も隠さず終了コード1にし、docs/BASELINE.mdへ既知失敗として記録する。
import { serve, firefox, loginLocal, collectErrors } from './helpers.mjs';

process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

const PORT = 5621;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch({ headless: true });
const pages = [
    { name: 'index', path: '/index.html', surface: '.portal-container', ready: '.portal-container' },
    { name: 'card_list', path: '/card_list.html', surface: '#main-app', ready: '#main-app', loginLocal: true },
    { name: 'card_gallery', path: '/card_gallery.html?localtest=1', surface: '#gallery-content', ready: '#card-grid', abortRedirect: true },
    { name: 'battle_records', path: '/battle_records.html', surface: '#main-app', ready: '#main-app', battleLocal: true },
    { name: 'card_shop', path: '/card_shop.html', surface: '#cards-container', ready: '#cards-container' },
    { name: 'duel_simulator', path: '/duel_simulator.html', surface: '#boardRoot', ready: '#boardRoot' },
    { name: 'supply_manager', path: '/supply_manager.html', surface: '#playmat-list', ready: '#playmat-list' },
    { name: 'banlist_editor', path: '/banlist_editor.html', surface: '#app', ready: '#app' },
    { name: 'options', path: '/options.html', surface: '.container', ready: '#rarityList' },
];
const variants = [
    { theme: 'light', viewport: { width: 1440, height: 900 } },
    { theme: 'dark', viewport: { width: 1440, height: 900 } },
    { theme: 'light', viewport: { width: 375, height: 812 } },
    { theme: 'dark', viewport: { width: 375, height: 812 } },
];
const issues = [];

function rgb(value) {
    const match = value?.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);
    return match ? { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] } : null;
}

function nearlySameColor(a, b) {
    const left = rgb(a);
    const right = rgb(b);
    return left && right && left.a > 0.9 && right.a > 0.9
        && Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b) < 12;
}

try {
    for (const descriptor of pages) {
        for (const variant of variants) {
            const context = await browser.newContext({ viewport: variant.viewport });
            await context.addInitScript(({ theme, battleLocal }) => {
                localStorage.setItem('theme', theme);
                if (battleLocal) localStorage.setItem('isLocalMode', 'true');
                localStorage.setItem('galleryCache_local_user_data', JSON.stringify({
                    collection: [], wishlist: [], bookmarks: [], decks: [], cachedAt: Date.now(),
                }));
            }, { theme: variant.theme, battleLocal: descriptor.battleLocal });
            const page = await context.newPage();
            const errors = collectErrors(page);
            page.on('dialog', (dialog) => dialog.accept());
            if (descriptor.abortRedirect) await page.route('**/card_list.html', (route) => route.abort());
            const label = `${descriptor.name}/${variant.theme}/${variant.viewport.width}`;
            try {
                await page.goto(`${baseUrl}${descriptor.path}`, { waitUntil: 'load', timeout: 90000 });
                if (descriptor.loginLocal) await loginLocal(page, baseUrl);
                await page.waitForSelector(descriptor.ready, { state: 'attached', timeout: 30000 });
                const observed = await page.evaluate((surfaceSelector) => {
                    const bodyStyle = getComputedStyle(document.body);
                    const surface = document.querySelector(surfaceSelector);
                    const surfaceStyle = surface ? getComputedStyle(surface) : null;
                    return {
                        rootTheme: document.documentElement.dataset.bsTheme || null,
                        bodyColor: bodyStyle.color,
                        bodyBackground: bodyStyle.backgroundColor,
                        surfaceColor: surfaceStyle?.color || null,
                        surfaceBackground: surfaceStyle?.backgroundColor || null,
                        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    };
                }, descriptor.surface);

                if (observed.rootTheme !== variant.theme) {
                    issues.push(`${label}: html[data-bs-theme] expected=${variant.theme} actual=${observed.rootTheme}`);
                }
                if (!rgb(observed.bodyColor) || !rgb(observed.bodyBackground)) {
                    issues.push(`${label}: body computed color未定義 color=${observed.bodyColor} bg=${observed.bodyBackground}`);
                }
                if (!observed.surfaceColor || !observed.surfaceBackground) {
                    issues.push(`${label}: 主要surface computed color未定義`);
                } else if (nearlySameColor(observed.surfaceColor, observed.surfaceBackground)) {
                    issues.push(`${label}: 主要surfaceの文字色と背景色が同色`);
                }
                if (observed.overflow > 1) issues.push(`${label}: document横overflow ${observed.overflow}px`);

                await page.reload({ waitUntil: 'load', timeout: 90000 });
                const reloadedTheme = await page.evaluate(() => document.documentElement.dataset.bsTheme || null);
                if (reloadedTheme !== variant.theme) {
                    issues.push(`${label}: reload後theme expected=${variant.theme} actual=${reloadedTheme}`);
                }
                errors.forEach((error) => issues.push(`${label}: ${error}`));
                console.log(`✓ ${label} observed theme=${observed.rootTheme} overflow=${observed.overflow}px`);
            } catch (error) {
                issues.push(`${label}: 実行失敗 ${error.message}`);
                console.error(`✗ ${label}: ${error.message}`);
            } finally {
                await context.close();
            }
        }
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}

if (issues.length) {
    console.error(`\n既知候補を含むテーマ/layout失敗: ${issues.length}件`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
}
console.log('\n全9画面のテーマ/layout契約: OK');
