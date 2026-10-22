import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'file:///' + __dirname.replace(/\\/g, '/');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '/battle_records.html');
await page.waitForSelector('#auth-modal.show', { timeout: 8000 });
await page.fill('#email', 'local');
await page.fill('#password', 'x');
await page.click('#login-btn');
await page.waitForSelector('#main-app', { state: 'visible', timeout: 8000 });
await page.waitForTimeout(500);
const result = await page.evaluate(() => {
    const s = document.querySelector('[type=submit].btn-gradient');
    const a = document.getElementById('advanced-search-btn');
    const r1 = s ? s.getBoundingClientRect() : null;
    const r2 = a ? a.getBoundingClientRect() : null;
    const cs1 = s ? window.getComputedStyle(s) : null;
    const cs2 = a ? window.getComputedStyle(a) : null;
    const p = s ? s.parentElement : null;
    const rp = p ? p.getBoundingClientRect() : null;
    return {
        searchBtn: r1 ? { h: r1.height, w: r1.width, top: r1.top, paddingTop: cs1.paddingTop, paddingBottom: cs1.paddingBottom, borderTop: cs1.borderTopWidth, lineHeight: cs1.lineHeight } : null,
        advBtn: r2 ? { h: r2.height, w: r2.width, top: r2.top, paddingTop: cs2.paddingTop, paddingBottom: cs2.paddingBottom, borderTop: cs2.borderTopWidth, lineHeight: cs2.lineHeight } : null,
        parent: rp ? { h: rp.height } : null,
    };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
