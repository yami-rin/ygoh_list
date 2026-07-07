// card_list 読み仮名検索の誤検出リグレッションテスト
// バグ: possibleName.includes(cardName) の逆方向判定で、候補名に内包される短い名が誤ヒット
//   「トゥーン」→ サイバー・ドラゴン が誤ヒット / 「シャドール」→ 融合 が誤ヒット
import { serve, loginLocal, collectErrors, firefox } from './helpers.mjs';

const { server, baseUrl } = serve(8934);
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
collectErrors(page);
let failed = false;
const check = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failed = true; };

await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
await loginLocal(page, baseUrl);
await page.waitForTimeout(6000); // マスターCSVロード待ち

const addCard = async (name) => {
    await page.fill('#name', name);
    await page.fill('#set_code', 'TEST-JP001');
    await page.fill('#rarity', 'N');
    await page.click('#add-form button[type="submit"]');
    await page.waitForTimeout(800);
};
for (const n of ['融合', '影依融合', 'サイバー・ドラゴン', 'トゥーン・サイバー・ドラゴン']) await addCard(n);

const rowNames = async () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#card-table-body tr'))
        .map(tr => (tr.querySelector('td')?.innerText || tr.innerText || '').trim())
        .join(' | '));

const search = async (term) => {
    await page.fill('[name="search_name"]', term);
    await page.waitForTimeout(700);
    return rowNames();
};

console.log('\n[検索: トゥーン]');
const toon = await search('トゥーン');
console.log('  結果:', toon);
check(/トゥーン・サイバー・ドラゴン/.test(toon), 'トゥーン・サイバー・ドラゴン はヒットする（正）');
check(!/(^|\| )サイバー・ドラゴン( \||$)/.test(toon), 'トゥーンの付かない サイバー・ドラゴン はヒットしない（誤検出でない）');

console.log('\n[検索: シャドール]');
const shadoll = await search('シャドール');
console.log('  結果:', shadoll);
check(/影依融合/.test(shadoll), '影依融合 はヒットする（正）');
check(!/(^|\| )融合( \||$)/.test(shadoll), '融合(ゆうごう) はヒットしない（誤検出でない）');

console.log('\n' + (failed ? '=== NG ===' : '=== OK ==='));
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
