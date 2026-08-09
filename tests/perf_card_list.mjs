// パフォーマンス計測: 3,000枚インポートして 描画(changePage)と検索レイテンシを測る
// 実行: node tests/perf_card_list.mjs [docroot] [label]
//   旧版比較: git worktree add /tmp/cm_old <commit> && node tests/perf_card_list.mjs <worktreeのパス> OLD
import fs from 'fs';
import path from 'path';
import { serve, loginLocal, importCards, firefox, DOCROOT, summarizeSamples } from './helpers.mjs';

const docroot = process.argv[2] || DOCROOT;
const label = process.argv[3] || 'CUR';
const { server, baseUrl } = serve(8932, docroot);

// マスターCSVから実在カード名で3,000枚生成（読み仮名検索の負荷を再現するため実名が必要）
const csv = fs.readFileSync(path.join(DOCROOT, 'yugioh_cards_master.csv'), 'utf8');
const names = csv.split('\n').slice(1).map((l) => {
    const m = l.match(/^\d+,("(?:[^"]|"")*"|[^,]*)/);
    return m ? m[1].replace(/^"|"$/g, '').replace(/""/g, '"') : null;
}).filter(Boolean);
const rarities = ['N', 'R', 'SR', 'UR', 'SE', 'QCSE', 'P+SR'];
const cards = Array.from({ length: 3000 }, (_, i) => ({
    '名前': names[(i * 7) % names.length],
    '型番': `TEST-JP${String(i).padStart(3, '0')}`,
    'レアリティ': rarities[i % rarities.length],
    '枚数': (i % 3) + 1,
    'tags': i % 5 === 0 ? ['テスト'] : [],
}));

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
await loginLocal(page, baseUrl);
await page.waitForTimeout(6000);
await importCards(page, cards, 50);
console.log(`[${label}] imported 3000 cards`);

const printSummary = (name, values) => {
    const summary = summarizeSamples(values);
    console.log(`[${label}] ${name}: median ${summary.median.toFixed(1)}ms, p95 ${summary.p95.toFixed(1)}ms (all: ${summary.samples.map((v) => v.toFixed(1)).join(', ')})`);
};
const renderOnce = () => page.evaluate(() => {
    const t0 = performance.now(); window.changePage(1); return performance.now() - t0;
});

let t = [];
for (let i = 0; i < 7; i++) t.push(await renderOnce());
printSummary('sort+render 100rows', t);

await page.evaluate(() => localStorage.setItem('tableRowsPerPage', 'all'));
t = [];
for (let i = 0; i < 5; i++) t.push(await renderOnce());
printSummary('sort+render ALL(3000)rows', t);
await page.evaluate(() => localStorage.setItem('tableRowsPerPage', '100'));

for (const q of ['うらら', 'どらごん', 'まじしゃん']) {
    const wallTimes = [];
    for (let i = 0; i < 5; i++) {
        await page.fill('[name="search_name"]', '');
        await page.waitForTimeout(500);
        await page.evaluate(() => { document.getElementById('search-result-summary').style.display = 'none'; });
        const t0 = performance.now();
        await page.fill('[name="search_name"]', q);
        await page.waitForFunction(() => {
            const el = document.getElementById('search-result-summary');
            return el && el.style.display !== 'none';
        }, { timeout: 60000 });
        wallTimes.push(performance.now() - t0);
    }
    const kinds = await page.evaluate(() => document.getElementById('search-result-kinds')?.textContent);
    printSummary(`search "${q}" input-to-render`, wallTimes);
    console.log(`[${label}] search "${q}" hits=${kinds}`);
}

console.log(`[${label}] browser=Firefox ${browser.version()}, fixture=3000 cards, state=warm after import`);

await browser.close();
server.close();
