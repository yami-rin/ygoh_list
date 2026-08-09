// card_gallery.html の初期ロード性能ベースライン（未ログイン文脈・3回中央値）
// 計測: load イベントまで / cardDetailsMap 充填まで
import { serve, firefox, summarizeSamples } from './helpers.mjs';

const PORT = 5601;
const RUNS = Math.max(3, Number(process.argv[2] || 5));
const MODE = process.argv[3] === 'warm' ? 'warm' : 'cold';
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();

const loadTimes = [];
const dataTimes = [];

try {
    if (MODE === 'warm') {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**/card_list.html', (route) => route.abort());
        await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.cardDetailsMap?.size > 0, undefined, { timeout: 30000 });
        await page.waitForTimeout(1500);
        for (let i = 0; i < RUNS; i++) {
            const t0 = Date.now();
            await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
            loadTimes.push(Date.now() - t0);
            await page.waitForFunction(
                () => window.cardDetailsMap && window.cardDetailsMap.size > 0,
                undefined, { timeout: 30000 });
            dataTimes.push(Date.now() - t0);
        }
        await ctx.close().catch(() => {});
    } else {
        for (let i = 0; i < RUNS; i++) {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.accept());
            await page.route('**/card_list.html', (route) => route.abort());
            const t0 = Date.now();
            await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
            loadTimes.push(Date.now() - t0);
            await page.waitForFunction(
                () => window.cardDetailsMap && window.cardDetailsMap.size > 0,
                undefined, { timeout: 30000 });
            dataTimes.push(Date.now() - t0);
            await page.close().catch(() => {});
            await ctx.close().catch(() => {});
        }
    }
    const load = summarizeSamples(loadTimes);
    const data = summarizeSamples(dataTimes);
    console.log(`[${MODE}] load: median ${load.median}ms, p95 ${load.p95}ms (all: ${load.samples.join(', ')})`);
    console.log(`[${MODE}] data-ready: median ${data.median}ms, p95 ${data.p95}ms (all: ${data.samples.join(', ')})`);
    console.log(`[${MODE}] browser=Firefox ${browser.version()}, runs=${RUNS}, auth=unauthenticated, cache=${MODE === 'warm' ? 'prewarmed same context' : 'new context per run'}`);
} finally {
    await browser.close();
    server.close();
}
