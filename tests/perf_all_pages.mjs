// 全9画面の共通性能ベースライン。
// 例: node tests/perf_all_pages.mjs --mode=cold --sets=2 --runs=3 --output=C:\Temp\cold.json
import fs from 'node:fs';
import path from 'node:path';
import { serve, firefox, loginLocal, collectErrors, summarizeSamples } from './helpers.mjs';

process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
}));
const MODE = options.mode === 'warm' ? 'warm' : 'cold';
const SETS = Math.max(2, Number(options.sets || 2));
const RUNS = Math.max(3, Number(options.runs || 3));
const PORT = Number(options.port || 5620);

const galleryCards = Array.from({ length: 3000 }, (_, i) => ({
    id: `baseline-${i}`,
    data: {
        '名前': i % 7 === 0 ? `青眼の白龍${i}` : `テストカード${i}`,
        '型番': `BASE-JP${String(i % 1000).padStart(3, '0')}`,
        'レアリティ': ['N', 'R', 'SR', 'UR', 'SE'][i % 5],
        '枚数': (i % 3) + 1,
        tags: i % 10 === 0 ? ['baseline'] : [],
    },
}));

const pages = [
    { name: 'index', path: '/index.html', ready: '.portal-container',
        majorReason: '静的portalのため主要render/search操作なし' },
    { name: 'card_list', path: '/card_list.html', ready: '#main-app', loginLocal: true,
        majorReason: '3,000枚fixtureはtests/perf_card_list.mjsで計測' },
    { name: 'card_gallery', path: '/card_gallery.html?localtest=1', ready: '#card-grid > *',
        abortCardListRedirect: true,
        init: { galleryCards },
        majorAction: async (page) => page.evaluate(() => {
            const start = performance.now();
            window.changePage(1);
            return performance.now() - start;
        }) },
    { name: 'battle_records', path: '/battle_records.html', ready: '#main-app',
        init: { battleLocal: true }, majorReason: '空のlocal modeでは主要検索/render負荷を再現できない' },
    { name: 'card_shop', path: '/card_shop.html', ready: null,
        readyReason: 'production Auth/Firestore依存。Phase 8のlocaltest seam追加までUNMEASURED',
        majorReason: 'production Auth/Firestore依存' },
    { name: 'duel_simulator', path: '/duel_simulator.html', ready: '#boardRoot > *',
        majorReason: 'deck fixtureと操作契約testが未整備' },
    { name: 'supply_manager', path: '/supply_manager.html', ready: null,
        readyReason: 'production Auth/Workers API依存。Phase 9のmock追加までUNMEASURED',
        majorReason: 'production Auth/Workers API依存' },
    { name: 'banlist_editor', path: '/banlist_editor.html', ready: '#tier-container .tier-row',
        majorAction: async (page) => page.evaluate(async () => {
            const input = document.getElementById('search-input');
            const start = performance.now();
            input.value = '青眼';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return performance.now() - start;
        }) },
    { name: 'options', path: '/options.html', ready: '#rarityList .rarity-item',
        majorReason: '公開render APIがなく、Phase 10の契約test追加までUNMEASURED' },
];

const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch({ headless: true });
const samples = [];

async function prepareContext(context, descriptor) {
    await context.addInitScript((payload) => {
        window.__baselineLongTasks = [];
        window.__baselineLongTaskSupported = PerformanceObserver.supportedEntryTypes?.includes('longtask') || false;
        try {
            if (window.__baselineLongTaskSupported) {
                const observer = new PerformanceObserver((list) => {
                    window.__baselineLongTasks.push(...list.getEntries().map((entry) => entry.duration));
                });
                observer.observe({ entryTypes: ['longtask'] });
            }
        } catch {}

        if (payload?.galleryCards) {
            localStorage.setItem('galleryCache_local_user_data', JSON.stringify({
                collection: payload.galleryCards,
                wishlist: [], bookmarks: [], decks: [], cachedAt: Date.now(),
            }));
        }
        if (payload?.battleLocal) localStorage.setItem('isLocalMode', 'true');
    }, descriptor.init || null);
}

async function visit(context, descriptor, { prewarm = false } = {}) {
    const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = collectErrors(page);
    page.on('dialog', (dialog) => dialog.accept());
    if (descriptor.abortCardListRedirect) {
        await page.route('**/card_list.html', (route) => route.abort());
    }
    let csvBodyRequests = 0;
    let imageRequests = 0;
    page.on('request', (request) => {
        if (/yugioh_cards_master\.csv(?:$|\?)/.test(request.url()) && request.method() !== 'HEAD') {
            csvBodyRequests += 1;
        }
        if (request.resourceType() === 'image') imageRequests += 1;
    });

    let navigation = null;
    let appReadyMs = 'UNMEASURED';
    let appReadyReason = descriptor.readyReason || null;
    let majorActionMs = 'UNMEASURED';
    let majorActionReason = descriptor.majorReason || null;
    try {
        await page.goto(`${baseUrl}${descriptor.path}`, { waitUntil: 'load', timeout: 90000 });
        navigation = await page.evaluate(() => {
            const entry = performance.getEntriesByType('navigation')[0];
            return entry ? {
                domContentLoadedMs: entry.domContentLoadedEventEnd,
                loadMs: entry.loadEventEnd,
                responseBytes: entry.transferSize || 0,
            } : null;
        });

        if (descriptor.loginLocal) await loginLocal(page, baseUrl);
        if (descriptor.ready) {
            await page.waitForSelector(descriptor.ready, { state: 'visible', timeout: 60000 });
            appReadyMs = await page.evaluate(() => performance.now());
            appReadyReason = null;
        }
        if (!prewarm && descriptor.majorAction && Number.isFinite(appReadyMs)) {
            majorActionMs = await descriptor.majorAction(page);
            majorActionReason = null;
        }
        await page.waitForTimeout(100);
    } catch (error) {
        if (!appReadyReason) appReadyReason = `計測失敗: ${error.message}`;
    }

    const longTasks = await page.evaluate(() => ({
        supported: Boolean(window.__baselineLongTaskSupported),
        values: window.__baselineLongTasks || [],
    })).catch(() => ({ supported: false, values: [] }));
    const result = {
        page: descriptor.name,
        navigation: navigation || {
            domContentLoadedMs: 'UNMEASURED', loadMs: 'UNMEASURED', responseBytes: 'UNMEASURED',
        },
        appReadyMs,
        appReadyReason,
        majorActionMs,
        majorActionReason,
        csvBodyRequests,
        imageRequests,
        longTaskCount: longTasks.supported ? longTasks.values.length : 'UNMEASURED',
        longTaskMaxMs: longTasks.supported && longTasks.values.length
            ? Math.max(...longTasks.values) : 'UNMEASURED',
        errors,
    };
    await page.close().catch(() => {});
    return result;
}

function metricSummary(pageSamples, getter) {
    return summarizeSamples(pageSamples.map(getter).filter(Number.isFinite));
}

try {
    for (let set = 1; set <= SETS; set++) {
        for (const descriptor of pages) {
            let warmContext = null;
            if (MODE === 'warm') {
                warmContext = await browser.newContext();
                await prepareContext(warmContext, descriptor);
                await visit(warmContext, descriptor, { prewarm: true });
            }
            for (let run = 1; run <= RUNS; run++) {
                const context = warmContext || await browser.newContext();
                if (!warmContext) await prepareContext(context, descriptor);
                const result = await visit(context, descriptor);
                samples.push({ mode: MODE, set, run, ...result });
                console.log(`[${MODE} set=${set} run=${run}] ${descriptor.name}: load=${result.navigation.loadMs}ms app=${result.appReadyMs} major=${result.majorActionMs}`);
                if (!warmContext) await context.close();
            }
            if (warmContext) await warmContext.close();
        }
    }

    const summary = pages.map((descriptor) => {
        const values = samples.filter((sample) => sample.page === descriptor.name);
        return {
            page: descriptor.name,
            mode: MODE,
            domContentLoadedMs: metricSummary(values, (sample) => sample.navigation.domContentLoadedMs),
            loadMs: metricSummary(values, (sample) => sample.navigation.loadMs),
            appReadyMs: metricSummary(values, (sample) => sample.appReadyMs),
            appReadyReason: values.find((sample) => sample.appReadyReason)?.appReadyReason || null,
            majorActionMs: metricSummary(values, (sample) => sample.majorActionMs),
            majorActionReason: values.find((sample) => sample.majorActionReason)?.majorActionReason || null,
            csvBodyRequests: metricSummary(values, (sample) => sample.csvBodyRequests),
            imageRequests: metricSummary(values, (sample) => sample.imageRequests),
            longTaskCount: metricSummary(values, (sample) => sample.longTaskCount),
            longTaskMaxMs: metricSummary(values, (sample) => sample.longTaskMaxMs),
            errors: [...new Set(values.flatMap((sample) => sample.errors))],
        };
    });
    const report = {
        measuredAt: new Date().toISOString(),
        environment: {
            platform: `${process.platform} ${process.arch}`,
            node: process.version,
            browser: `Firefox ${browser.version()}`,
            viewport: '1440x900',
            server: 'express.static localhost',
        },
        conditions: { mode: MODE, sets: SETS, runsPerSet: RUNS },
        summary,
        samples,
    };
    console.log(`\n${JSON.stringify({ environment: report.environment, conditions: report.conditions, summary }, null, 2)}`);
    if (options.output) {
        const output = path.resolve(String(options.output));
        fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`report: ${output}`);
    }
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}
