// node tests/verify_banlist.mjs [firefox|edge|webkit]
// Real CSV and UI paths; only the remote card-image service is stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { serve, firefox } from './helpers.mjs';

const engine = process.argv[2] || 'firefox';
const { server, baseUrl } = serve(0);
await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));
const url = `http://localhost:${server.address().port}/banlist_editor.html`;
const browser = await (engine === 'edge' ? chromium : engine === 'webkit' ? webkit : firefox).launch(engine === 'edge' ? { channel: 'msedge' } : {});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const errors = [];
const contexts = [];
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('banlist_editor_v4')));
const card = (page, scope, name) => page.locator(`${scope} .tier-card`).filter({ has: page.locator('.card-name', { hasText: new RegExp(`^${name}$`) }) });
async function makePage(options = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    contexts.push(context);
    await context.route('**/card-detail?**', route => route.fulfill({ json: { imageUrl: 'http://localhost:3000/banlist-test-image.png' } }));
    await context.route('**/banlist-test-image.png', route => route.fulfill({ contentType: 'image/png', body: png }));
    if (options.offlineMaster) await context.route('**/yugioh_cards_master.csv', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    if (options.seed) await context.addInitScript(seed => {
        if (!sessionStorage.getItem('seeded')) {
            for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value));
            sessionStorage.setItem('seeded', 'yes');
        }
    }, options.seed);
    if (options.storageFailure) await context.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); }; });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url);
    if (!options.offlineMaster) await page.waitForFunction(() => !document.getElementById('search-input').disabled);
    return page;
}
async function noOverflow(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${page.viewportSize().width}`);
}
async function search(page, text) {
    if (page.viewportSize().width <= 760) await page.locator('#view-search').click();
    await page.locator('#search-input').fill(text);
    await page.waitForFunction(() => document.querySelector('#pool-cards .tier-card'));
}

try {
    const page = await makePage();
    assert.equal(await page.locator('.tier-row').count(), 6);
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await noOverflow(page);
        if (width <= 760) await page.locator('#view-search').click();
        await noOverflow(page);
        if (width <= 760) await page.locator('#view-board').click();
        await page.locator('#settings-btn').click();
        await noOverflow(page);
        const box = await page.locator('#settings-dialog').boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width + 1);
        assert.equal(await page.locator('#settings-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('settings-dialog').open);
        assert.equal(await page.locator('#settings-dialog').evaluate(dialog => dialog.open), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await search(page, 'はるうらら');
    await card(page, '#pool-cards', '灰流うらら').tap();
    assert.deepEqual((await read(page)).tierState[0], ['灰流うらら']);
    assert.equal(await page.locator('#mobile-count').innerText(), '1');
    await card(page, '#pool-cards', '灰流うらら').tap();
    await page.locator('#move-options').getByRole('button', { name: '制限', exact: true }).tap();
    assert.deepEqual((await read(page)).tierState[1], ['灰流うらら']);
    assert.deepEqual((await read(page)).tierState[0], []);
    await page.locator('#view-board').tap();
    await card(page, '#tier-container', '灰流うらら').tap();
    await page.locator('#remove-card-btn').tap();
    assert.equal((await read(page)).tierState.flat().length, 0);
    await page.locator('#undo-btn').tap();
    assert.deepEqual((await read(page)).tierState[1], ['灰流うらら']);
    await page.locator('#list-title').fill('みんなで遊ぶルール');
    await page.locator('#settings-btn').tap();
    await page.getByRole('textbox', { name: '分類2の名前', exact: true }).fill('同じ名前');
    await page.getByRole('button', { name: '分類2を上へ', exact: true }).tap();
    await page.getByRole('textbox', { name: '分類2の名前', exact: true }).fill('同じ名前');
    await page.locator('#apply-settings-btn').tap();
    let saved = await read(page);
    assert.deepEqual(saved.tierState[0], ['灰流うらら']);
    assert.deepEqual(saved.tierState[1], []);
    assert.equal(saved.tierConfig[0].id, 'tier-1');
    await page.locator('#settings-btn').tap();
    await page.getByRole('button', { name: '分類1を削除', exact: true }).tap();
    await page.locator('#apply-settings-btn').tap();
    assert.equal((await read(page)).tierState.flat().length, 0);
    await page.locator('#undo-btn').tap();
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('search-input').disabled);
    assert.equal(await page.locator('#list-title').inputValue(), 'みんなで遊ぶルール');
    assert.equal(await page.locator('#tier-container .tier-card').count(), 1);
    await page.locator('#export-btn').tap();
    await page.waitForFunction(() => !document.getElementById('download-btn').disabled);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-btn').tap();
    const downloaded = await downloadPromise;
    const bytes = await fs.readFile(await downloaded.path());
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert(bytes.length > 5000);
    await page.locator('#export-dialog [data-close]').first().tap();
    await page.locator('#data-menu summary').tap();
    const backupPromise = page.waitForEvent('download');
    await page.locator('#backup-btn').tap();
    const backup = await backupPromise;
    const backupData = JSON.parse(await fs.readFile(await backup.path(), 'utf8'));
    assert.deepEqual(backupData, await read(page));
    await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"tierConfig": []}') });
    await page.waitForTimeout(150);
    assert.deepEqual(await read(page), backupData);
    const imported = { ...backupData, title: '読み込んだリスト' };
    await page.locator('#import-file').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    await page.waitForFunction(() => document.getElementById('list-title').value === '読み込んだリスト');
    await page.locator('#undo-btn').tap();
    assert.equal((await read(page)).title, backupData.title);
    await page.locator('#settings-btn').tap();
    await page.locator('#add-tier-btn').tap();
    await page.getByRole('textbox', { name: '分類7の名前', exact: true }).fill('テスト分類');
    await page.locator('#apply-settings-btn').tap();
    assert.equal((await read(page)).tierConfig[6].name, 'テスト分類');
    assert.deepEqual((await read(page)).tierState[6], []);
    await page.setViewportSize({ width: 1440, height: 900 });
    await search(page, '青眼の白龍');
    await card(page, '#pool-cards', '青眼の白龍').dragTo(page.locator('.tier-cards').nth(0));
    assert.deepEqual((await read(page)).tierState[0], ['灰流うらら', '青眼の白龍']);
    await card(page, '#tier-container', '青眼の白龍').dragTo(card(page, '#tier-container', '灰流うらら'));
    assert.deepEqual((await read(page)).tierState[0], ['青眼の白龍', '灰流うらら']);
    await card(page, '#tier-container', '青眼の白龍').dragTo(page.locator('.tier-cards').nth(2));
    assert.deepEqual((await read(page)).tierState[2], ['青眼の白龍']);
    console.log('PASS desktop drag from search, same-tier reorder, cross-tier move');
    console.log('PASS responsive 320–1440px, touch add/move/remove/undo, rename + reorder + duplicate labels, autosave/reload, PNG/JSON export + import validation');

    const oldConfig = [{ name: '旧禁止', color: '#c0392b' }, { name: '旧制限', color: '#e67e22' }];
    const oldState = [['灰流うらら', 'CSV未収録の保存カード'], ['青眼の白龍']];
    const legacy = await makePage({ seed: { banlist_tier_config: oldConfig, banlist_v3: oldState } });
    assert.equal(await legacy.locator('#tier-container .tier-card').count(), 3);
    await legacy.locator('#list-title').fill('移行済み');
    assert.deepEqual((await read(legacy)).tierState, oldState);
    assert.deepEqual(await legacy.evaluate(() => JSON.parse(localStorage.getItem('banlist_v3'))), oldState);
    const failed = await makePage({ offlineMaster: true, seed: { banlist_tier_config: oldConfig, banlist_v3: oldState } });
    await failed.locator('#load-error').waitFor({ state: 'visible' });
    assert.equal(await failed.locator('#tier-container .tier-card').count(), 3);
    await failed.locator('#export-btn').tap();
    await failed.waitForFunction(() => !document.getElementById('download-btn').disabled);
    assert((await failed.locator('#export-status').innerText()).includes('3枚'));
    const storage = await makePage({ storageFailure: true });
    await storage.locator('#list-title').fill('保存失敗のテスト');
    assert((await storage.locator('#save-status').innerText()).includes('自動保存できません'));
    console.log('PASS legacy migration preserves unknown cards + originals, master failure preserves board, missing-image PNG fallback, storage failure notice');
    assert.deepEqual(errors, []);
    console.log(`PASS ${engine}: no JavaScript errors`);
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
