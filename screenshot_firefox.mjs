import { firefox } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'file:///' + __dirname.replace(/\\/g, '/');
const mobile = { width: 390, height: 844 };

async function shot(page, name, fullPage = false) {
    await page.screenshot({ path: name, fullPage });
    console.log('saved:', name);
}

const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();

// Inject test data + isLocalMode flag BEFORE page loads
await page.addInitScript(() => {
    const records = [
        { id: '1', date: '2025-09-06', tournament: 'ランキングデュエル', store: 'ネクプロ2号', myDeck: 'M∀LICE', opponentDeck: 'ティアラメンツ', result: 'win', round: '1' },
        { id: '2', date: '2025-09-06', tournament: 'ランキングデュエル', store: 'ネクプロ2号', myDeck: 'M∀LICE', opponentDeck: 'スネークアイ', result: 'lose', round: '2' },
        { id: '3', date: '2025-08-30', tournament: 'セレブレーション', store: '大須193', myDeck: 'M∀LICE', opponentDeck: 'ピュアリィ', result: 'win', round: '1' },
        { id: '4', date: '2025-08-17', tournament: 'ランキングデュエル', store: '名駅193', myDeck: 'M∀LICE', opponentDeck: 'ドラグマ', result: 'win', round: '1' },
    ];
    localStorage.setItem('battleRecords', JSON.stringify(records));
    localStorage.setItem('isLocalMode', 'true');
});

await page.setViewportSize(mobile);
await page.goto(`${base}/battle_records.html`);
await page.waitForSelector('#main-app', { state: 'visible', timeout: 10000 });
await page.waitForTimeout(2000);

const debug = await page.evaluate(() => ({
    tbodyRows: document.getElementById('records-tbody')?.children.length,
    noRecordsDisplay: document.getElementById('no-records-message')?.style.display,
}));
console.log('debug:', JSON.stringify(debug));

await shot(page, 'ff_battle_full.png', true);

// Clip records table area
const recPos = await page.evaluate(() => {
    const el = document.getElementById('records-tbody')?.closest('.records-card');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    return { top: r.top + scrollY, height: r.height };
});
console.log('recPos:', JSON.stringify(recPos));
if (recPos && recPos.height > 50) {
    const clipY = Math.max(0, recPos.top - 5);
    await page.screenshot({ path: 'ff_records_table.png', fullPage: true, clip: { x: 0, y: clipY, width: 390, height: Math.min(recPos.height + 10, 800) } });
    console.log('saved: ff_records_table.png');
}

// Clip filter area
const filterPos = await page.evaluate(() => {
    const el = document.querySelector('.controls-bar');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    return { top: r.top + scrollY, height: r.height };
});
console.log('filterPos:', JSON.stringify(filterPos));
if (filterPos && filterPos.height > 0) {
    const clipY = Math.max(0, filterPos.top - 5);
    await page.screenshot({ path: 'ff_filter_zoom.png', fullPage: true, clip: { x: 0, y: clipY, width: 390, height: filterPos.height + 10 } });
    console.log('saved: ff_filter_zoom.png');
}

// Measure action buttons
const btnMeasure = await page.evaluate(() => {
    const btns = document.querySelectorAll('.action-btns .btn');
    return Array.from(btns).slice(0, 3).map(b => {
        const r = b.getBoundingClientRect();
        const cs = window.getComputedStyle(b);
        return {
            class: b.className,
            h: r.height, w: r.width,
            top: r.top,
            paddingTop: cs.paddingTop,
            paddingBottom: cs.paddingBottom,
            lineHeight: cs.lineHeight,
            fontSize: cs.fontSize,
            display: cs.display,
            verticalAlign: cs.verticalAlign,
        };
    });
});
console.log('action btns:', JSON.stringify(btnMeasure, null, 2));

// Screenshot of action column area (scroll table right)
const actionColPos = await page.evaluate(() => {
    const firstActionBtn = document.querySelector('.action-btns');
    if (!firstActionBtn) return null;
    const r = firstActionBtn.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    return { top: r.top + scrollY - 30, left: Math.max(0, r.left + scrollX - 10), width: r.width + 20, height: r.height + 60 };
});
if (actionColPos) {
    await page.screenshot({ path: 'ff_action_btns.png', fullPage: true, clip: { x: actionColPos.left, y: actionColPos.top, width: Math.min(actionColPos.width, 390), height: actionColPos.height } });
    console.log('saved: ff_action_btns.png');
}

await browser.close();
console.log('Done.');
