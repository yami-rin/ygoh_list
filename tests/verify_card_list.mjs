// card_list.html スモークテスト:
// ログイン → カード追加 → 通常検索/読み仮名検索/ミス検索 → リロードでIndexedDBキャッシュ確認
// 実行: node tests/verify_card_list.mjs
import { serve, loginLocal, collectErrors, firefox } from './helpers.mjs';

const { server, baseUrl } = serve(8931);
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
const errors = collectErrors(page);
page.on('console', (m) => { if (/master-data|Loaded \d+ card/.test(m.text())) console.log('  >', m.text()); });

const t0 = Date.now();
await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
console.log('load event:', Date.now() - t0, 'ms');
await loginLocal(page, baseUrl);
console.log('main app visible');
await page.waitForTimeout(6000); // マスターCSVロード待ち

// フォームからカード追加
await page.fill('#name', '灰流うらら');
await page.fill('#set_code', 'RC03-JP007');
await page.fill('#rarity', 'SR');
await page.click('#add-form button[type="submit"]');
await page.waitForTimeout(1500);
console.log('first row:', (await page.evaluate(() =>
    document.querySelector('#card-table-body tr')?.innerText || '(no row)')).replace(/\s+/g, ' ').slice(0, 100));

// 通常検索
await page.fill('[name="search_name"]', 'うらら');
await page.waitForTimeout(600);
console.log('search "うらら" rows:', await page.evaluate(() => document.querySelectorAll('#card-table-body tr').length));

// 読み仮名検索（ひらがな → マスターデータの読み経由でヒットするはず）
await page.fill('[name="search_name"]', 'はるうらら');
await page.waitForTimeout(600);
console.log('reading search "はるうらら":', (await page.evaluate(() =>
    document.querySelector('#card-table-body tr')?.innerText || '(no row)')).replace(/\s+/g, ' ').slice(0, 60));

// ミス検索
await page.fill('[name="search_name"]', 'ぜったいにないなまえ');
await page.waitForTimeout(600);
console.log('miss row:', (await page.evaluate(() =>
    document.querySelector('#card-table-body tr')?.innerText || '(no row)')).trim().slice(0, 40));

// リロード: 2回目はIndexedDBキャッシュから読むはず（「IndexedDBキャッシュ」ログを確認）
console.log('--- reload (cache path) ---');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
server.close();
