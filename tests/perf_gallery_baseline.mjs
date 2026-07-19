// card_gallery.html の初期ロード性能ベースライン（未ログイン文脈・3回中央値）
// 計測: load イベントまで / cardDetailsMap 充填まで
import { serve, firefox } from './helpers.mjs';

const PORT = 5601;
const RUNS = 3;
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const loadTimes = [];
const dataTimes = [];

try {
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
            { timeout: 30000 });
        dataTimes.push(Date.now() - t0);
        await ctx.close();
    }
    console.log(`load(median of ${RUNS}): ${median(loadTimes)}ms  (all: ${loadTimes.join(', ')})`);
    console.log(`data-ready(median):      ${median(dataTimes)}ms  (all: ${dataTimes.join(', ')})`);
} finally {
    await browser.close();
    server.close();
}
