import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'file:///' + __dirname.replace(/\\/g, '/');

const mobile = { width: 390, height: 844 };

async function shot(page, name, fullPage = true) {
    await page.screenshot({ path: name, fullPage });
    console.log('saved:', name);
}

(async () => {
    const browser = await chromium.launch({ headless: true });

    // ---- battle_records ----
    {
        const page = await browser.newPage();
        await page.setViewportSize(mobile);
        await page.goto(`${base}/battle_records.html`);
        await page.waitForSelector('#auth-modal.show', { timeout: 8000 });
        await page.fill('#email', 'local');
        await page.fill('#password', 'x');
        await page.click('#login-btn');
        await page.waitForSelector('#main-app', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(1000);

        await shot(page, 'mob_battle_top.png', false);       // viewport
        await shot(page, 'mob_battle_full.png', true);       // full scroll

        // Open navbar
        await page.click('.navbar-toggler');
        await page.waitForTimeout(400);
        await shot(page, 'mob_battle_nav.png', false);

        await page.close();
    }

    // ---- card_gallery ----
    {
        const page = await browser.newPage();
        await page.setViewportSize(mobile);
        await page.goto(`${base}/card_gallery.html`);
        await page.waitForTimeout(3000);  // gallery loads data
        await shot(page, 'mob_gallery_top.png', false);
        await shot(page, 'mob_gallery_full.png', true);

        // Scroll down to filter area
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.waitForTimeout(300);
        await shot(page, 'mob_gallery_filter.png', false);

        await page.close();
    }

    await browser.close();
    console.log('All done.');
})();
