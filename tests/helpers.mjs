// card_manager_web ヘッドレス検証の共通ヘルパー
// 再現条件: express.static のローカルHTTP配信 + Playwright Firefox headless。
// card_list は local ログインを使い、localhost から本番Workersへ向かう既知CORSだけを除外する。
// 詳細は knowledge/runbooks/card-manager-playwright-verify.md を参照。
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

export const DOCROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(DOCROOT, 'package.json'));
export const express = require('express');
export const { firefox } = require('playwright');

/** nearest-rank percentile。空配列は null（= UNMEASURED）を返す。 */
export function percentile(values, ratio) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

/** baseline記録用に中央値/p95/sampleを同じ形へ揃える。 */
export function summarizeSamples(values) {
    const samples = values.filter(Number.isFinite);
    if (!samples.length) return 'UNMEASURED';
    return {
        median: percentile(samples, 0.5),
        p95: percentile(samples, 0.95),
        samples,
    };
}

/** 静的サーバを起動して {server, baseUrl} を返す */
export function serve(port, docroot = DOCROOT) {
    const app = express();
    app.use(express.static(docroot));
    return { server: app.listen(port), baseUrl: `http://localhost:${port}` };
}

/** ローカルモードでログインして #main-app 表示まで待つ（リロード後は再ログインが必要） */
export async function loginLocal(page, baseUrl) {
    if (!page.url().startsWith(baseUrl)) {
        await page.goto(`${baseUrl}/card_list.html`, { waitUntil: 'load' });
    }
    await page.waitForSelector('#email', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500); // モーダルのフェードイン完了待ち（"element is not stable"対策）
    await page.fill('#email', 'local');
    await page.fill('#password', 'x');
    // モバイル幅ではモーダルがボタンを遮るため JS クリック
    await page.evaluate(() => document.getElementById('login-btn').click());
    await page.waitForSelector('#main-app', { state: 'visible', timeout: 15000 });
}

/** テストカードを一括インポート経路で投入する（dialogの自動承認を設定しておくこと） */
export async function importCards(page, cards, minRows = 1) {
    const tmp = path.join(os.tmpdir(), `cm_test_import_${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ collection: cards, wishlist: [] }));
    await page.setInputFiles('#import-file-input', tmp);
    await page.waitForFunction(
        (n) => document.querySelectorAll('#card-table-body tr').length >= n,
        minRows, { timeout: 60000 });
    fs.unlinkSync(tmp);
}

/** CORS ノイズ(localhostからのworkers API失敗)を除いたエラー収集 */
export function collectErrors(page) {
    const errors = [];
    page.on('console', (m) => {
        // gamification/rankings はlocalhostからのworkers API失敗（本番オリジン限定）による既知ノイズ
        if (m.type() === 'error' && !/Cross-Origin|CORS|gamification|ranking data/.test(m.text())) errors.push('[console] ' + m.text());
    });
    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
    return errors;
}
