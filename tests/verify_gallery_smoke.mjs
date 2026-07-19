import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, firefox, collectErrors } from './helpers.mjs';

// Required by Firefox when this smoke test runs inside the managed Windows
// runner, where its content-process sandbox cannot spawn a tab subprocess.
process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

const PORT = 5602;
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(TEST_DIR, 'shots_gallery');
const { server, baseUrl } = serve(PORT);
const browser = await firefox.launch();

let failed = false;
const ok = (message) => console.log(`✓ ${message}`);
const fail = (message) => {
    failed = true;
    console.error(`✗ ${message}`);
};

async function assertPresent(page, selector, label) {
    if (await page.locator(selector).count() > 0) ok(`${label}: ${selector}`);
    else fail(`${label}がDOMに存在しない: ${selector}`);
}

async function tryAuthGatedInteraction(page, { label, control, visibleState, authGuardSeen }) {
    await page.locator(control).click();
    try {
        await page.waitForFunction(
            ({ selector, activeControl }) => {
                const element = document.querySelector(selector);
                const controlElement = document.querySelector(activeControl);
                return Boolean(element && controlElement &&
                    getComputedStyle(element).display !== 'none' &&
                    controlElement.classList.contains('active'));
            },
            { selector: visibleState, activeControl: control },
            { timeout: 3000 },
        );
        ok(`${label}に切り替え: ${visibleState}が表示`);
        return true;
    } catch {
        if (authGuardSeen()) {
            console.log(`✓ ${label}: 到達不能(要認証)`);
            return false;
        }
        fail(`${label}の表示状態に到達できない: ${visibleState}`);
        return false;
    }
}

try {
    fs.mkdirSync(SHOT_DIR, { recursive: true });

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let authGuardSeen = false;

    // Match verify_gallery_master.mjs: dismiss the login alert and abort the
    // redirect so the gallery keeps running in its own execution context.
    page.on('dialog', (dialog) => {
        authGuardSeen = true;
        dialog.accept();
    });
    await page.route('**/card_list.html', (route) => route.abort());
    const errors = collectErrors(page);

    await page.goto(`${baseUrl}/card_gallery.html`, { waitUntil: 'load' });
    ok('card_gallery.html loadイベント完了');
    await page.waitForFunction(
        () => window.cardDetailsMap && window.cardDetailsMap.size > 0,
        undefined,
        { timeout: 90000 },
    );
    const masterCount = await page.evaluate(() => window.cardDetailsMap.size);
    ok(`マスターデータ展開: cardDetailsMap=${masterCount}件`);

    // 未ログインではコレクション取得が完了せず #loading-overlay が残り続け
    // クリックを遮るため、到達性テストの前に非表示化する(オーバーレイは検証対象外)
    await page.evaluate(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    });

    await assertPresent(page, '#card-grid', 'ギャラリーグリッド');
    await assertPresent(page, '#deck-manager-btn', 'デッキUIコントロール');
    await assertPresent(page, '#community-tab', 'コミュニティタブ');
    await assertPresent(page, '#packOpenFab', 'パック開封コントロール');
    await assertPresent(page, '#playmat-tab', 'プレイマットタブ');
    await assertPresent(page, '#search-input', 'カード名検索入力');
    await assertPresent(page, '#code-search-input', '型番検索入力');
    await assertPresent(page, '#sort-select', '並び替えフィルタ');

    await page.locator('#deck-manager-btn').click();
    await page.waitForSelector('#deckListPanel.active', { state: 'visible', timeout: 5000 });
    ok('デッキUIが開く: #deckListPanel.active');
    await page.locator('#closeDeckListBtn').click();
    await page.waitForFunction(() => !document.querySelector('#deckListPanel')?.classList.contains('active'));

    await tryAuthGatedInteraction(page, {
        label: 'コミュニティUI',
        control: '#community-tab',
        visibleState: '#community-container',
        authGuardSeen: () => authGuardSeen,
    });

    await page.locator('#packOpenFab').click();
    await page.waitForSelector('#packOverlay.visible', { state: 'visible', timeout: 5000 });
    ok('パック開封UIが開く: #packOverlay.visible');
    await page.locator('#packCloseBtn').click();
    await page.waitForFunction(() => !document.querySelector('#packOverlay')?.classList.contains('visible'));

    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'light'));
    await page.screenshot({ path: path.join(SHOT_DIR, 'gallery-light.png'), fullPage: true });
    ok('ライトテーマスクリーンショット保存');

    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'dark'));
    await page.waitForFunction(() => document.documentElement.getAttribute('data-bs-theme') === 'dark');
    await page.screenshot({ path: path.join(SHOT_DIR, 'gallery-dark.png'), fullPage: true });
    ok('ダークテーマスクリーンショット保存');

    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'light'));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(() => window.innerWidth === 375 && window.innerHeight === 812);
    await page.screenshot({ path: path.join(SHOT_DIR, 'gallery-mobile-375x812.png'), fullPage: true });
    ok('モバイル(375x812)スクリーンショット保存');

    if (errors.length === 0) ok('console/pageエラー 0件');
    else errors.forEach((error) => fail(`エラー検出: ${error}`));

    await page.close();
} catch (error) {
    fail(`テスト実行失敗: ${error.stack || error}`);
} finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
}

process.exit(failed ? 1 : 0);
