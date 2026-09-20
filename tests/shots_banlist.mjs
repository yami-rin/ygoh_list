// Real card-image requests, isolated browser storage. Optional argument: deployed page URL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, firefox, DOCROOT } from './helpers.mjs';
let server;
let url = process.argv[2];
if (!url) {
    ({ server } = serve(0));
    await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));
    url = `http://localhost:${server.address().port}/banlist_editor.html`;
}
const out = path.join(DOCROOT, 'TMP', url.includes('github.io') ? 'banlist-public' : 'banlist-redesign');
fs.mkdirSync(out, { recursive: true });
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
const imageErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', async message => {
    if (message.type() === 'error') {
        const detail = await Promise.all(message.args().map(arg => arg.evaluate(value => value instanceof Error ? `${value.name}: ${value.message}` : String(value)).catch(() => 'closed')));
        imageErrors.push(detail.join(' ').slice(0, 400));
    }
});
if (server) await page.route('http://localhost:3000/**', async route => {
    try {
        const response = await fetch(route.request().url().replace('http://localhost:3000', 'https://ygoh-list.onrender.com'));
        await route.fulfill({ status: response.status, contentType: response.headers.get('content-type'), body: Buffer.from(await response.arrayBuffer()), headers: { 'access-control-allow-origin': '*' } });
    }
    catch { await route.abort().catch(() => {}); }
});
try {
    await page.goto(url);
    await page.waitForFunction(() => !document.getElementById('search-input').disabled);
    await page.screenshot({ path: path.join(out, 'desktop-empty.png'), fullPage: true });
    await page.evaluate(async () => {
        const { emptyState, saveBanlistState } = await import('./js/pages/banlist/storage.js');
        const state = emptyState();
        state.title = '次回 禁止・制限予想';
        state.tierState = [['強欲な壺', '天使の施し'], ['灰流うらら', '増殖するG'], ['サンダー・ボルト'], ['無限泡影', '墓穴の指名者'], ['ブラック・マジシャン'], ['青眼の白龍']];
        saveBanlistState(state);
    });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('search-input').disabled);
    await page.locator('#search-input').fill('ブラック・マジシャン');
    for (const card of await page.locator('#tier-container .tier-card').all()) await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('#tier-container .card-art img').length >= 9, null, { timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });
    const imageCount = await page.locator('#tier-container .card-art img').count();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, 'mobile-board.png'), fullPage: true });
    await page.locator('#view-search').click();
    await page.locator('#search-input').blur();
    await page.waitForFunction(() => document.querySelectorAll('#pool-cards .card-art img').length >= 2);
    await page.screenshot({ path: path.join(out, 'mobile-search.png'), fullPage: true });
    await page.locator('#view-board').click();
    await page.locator('#settings-btn').click();
    await page.screenshot({ path: path.join(out, 'mobile-settings.png') });
    await page.keyboard.press('Escape');
    await page.locator('#export-btn').click();
    await page.waitForFunction(() => !document.getElementById('download-btn').disabled);
    await page.screenshot({ path: path.join(out, 'mobile-export.png') });
    const exportImage = await page.locator('#export-canvas').evaluate(canvas => canvas.toDataURL().split(',')[1]);
    fs.writeFileSync(path.join(out, 'export.png'), Buffer.from(exportImage, 'base64'));
    console.log(JSON.stringify({ url, out, realCardImages: imageCount, exportStatus: await page.locator('#export-status').innerText(), errors }));
    if (errors.length) process.exitCode = 1;
} catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
    console.log(JSON.stringify({ imageErrors, visibleImages: await page.locator('.card-art img').count() }));
    throw error;
} finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
}
