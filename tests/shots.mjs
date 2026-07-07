// UIスクリーンショット取得: デスクトップ(ライト/ダーク) + モバイル
// 実行: node tests/shots.mjs  → tests/screenshots/ に出力
import fs from 'fs';
import path from 'path';
import { serve, loginLocal, importCards, firefox, DOCROOT } from './helpers.mjs';

const { server, baseUrl } = serve(8934);
const OUT = path.join(DOCROOT, 'tests', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const cards = [
    { '名前': '青眼の白龍', '型番': 'SDK-001', 'レアリティ': 'UR', '枚数': 3, 'tags': ['ドラゴン'] },
    { '名前': 'ブラック・マジシャン', '型番': 'YAP1-JP001', 'レアリティ': 'SE', '枚数': 1, 'tags': [] },
    { '名前': '灰流うらら', '型番': 'RC03-JP007', 'レアリティ': 'SR', '枚数': 2, 'tags': ['手札誘発'] },
    { '名前': '増殖するG', '型番': 'RC03-JP008', 'レアリティ': 'R', '枚数': 3, 'tags': ['手札誘発'] },
    { '名前': '無限泡影', '型番': 'RC03-JP048', 'レアリティ': 'QCSE', '枚数': 1, 'tags': [] },
    { '名前': 'サンダー・ボルト', '型番': 'RC03-JP041', 'レアリティ': 'HR', '枚数': 1, 'tags': [] },
    { '名前': 'おろかな埋葬', '型番': 'SR03-JP030', 'レアリティ': 'N', '枚数': 2, 'tags': [] },
];

const browser = await firefox.launch({ headless: true });

async function setup(page) {
    page.on('dialog', (d) => d.accept());
    await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
    await loginLocal(page, baseUrl);
    await page.waitForTimeout(3000);
    await importCards(page, cards, 7);
}

// デスクトップ ライト
let page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await setup(page);
await page.screenshot({ path: `${OUT}/desktop_light.png` });
// デスクトップ ダーク（リロード後は再ログイン+再インポートが必要）
await page.evaluate(() => localStorage.setItem('theme', 'dark'));
await page.reload({ waitUntil: 'load' });
await loginLocal(page, baseUrl);
await page.waitForTimeout(2000);
await importCards(page, cards, 7);
await page.screenshot({ path: `${OUT}/desktop_dark.png` });
try { await page.close(); } catch {} // Firefoxのclose時Protocol errorは無害

// モバイル ライト
page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await setup(page);
await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.querySelector('#card-table').scrollIntoView(); });
await page.screenshot({ path: `${OUT}/mobile_table.png` });
try { await page.close(); } catch {}

console.log('screenshots saved to', OUT);
await browser.close();
server.close();
