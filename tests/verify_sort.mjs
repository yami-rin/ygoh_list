// ソートヘッダー回帰テスト: 名前(読み順)/レアリティ(カスタム順)/枚数/型番 の昇降順
// 実行: node tests/verify_sort.mjs
import { serve, loginLocal, importCards, collectErrors, firefox } from './helpers.mjs';

const { server, baseUrl } = serve(8933);
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
const errors = collectErrors(page);

await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
await loginLocal(page, baseUrl);
await page.waitForTimeout(6000); // マスターCSVロード待ち（名前ソートは読みを使う）

await importCards(page, [
    { '名前': '青眼の白龍', '型番': 'B-01', 'レアリティ': 'UR', '枚数': 3 },
    { '名前': 'ブラック・マジシャン', '型番': 'A-02', 'レアリティ': 'N', '枚数': 1 },
    { '名前': '灰流うらら', '型番': 'C-03', 'レアリティ': 'SE', '枚数': 2 },
], 3);

const names = () => page.evaluate(() =>
    [...document.querySelectorAll('#card-table-body tr')].map((tr) => tr.children[1].textContent.trim()));

// 期待値: 読み順 は<ぶら<ぶる / レアリティ N<UR<SE / 枚数 1<2<3 / 型番 A<B<C
console.log('default (名前asc):', await names());
await page.click('th[data-sort="レアリティ"]');
console.log('レアリティ asc:', await names());
await page.click('th[data-sort="レアリティ"]');
console.log('レアリティ desc:', await names());
await page.click('th[data-sort="枚数"]');
console.log('枚数 asc:', await names());
await page.click('th[data-sort="型番"]');
console.log('型番 asc:', await names());
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
server.close();
