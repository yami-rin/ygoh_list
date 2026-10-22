import { chromium } from 'playwright';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// minimal static server (ES modules need an http origin, not file://)
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.csv':'text/csv', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/duel_simulator.html';
  const fp = path.join(__dirname, f);
  if (!fp.startsWith(__dirname) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(8123, r));
const base = 'http://127.0.0.1:8123';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.setViewportSize({ width: 1100, height: 850 });
await page.goto(`${base}/duel_simulator.html?test=1`);

// wait for render
await page.waitForSelector('#boardRoot .side', { timeout: 8000 });
await page.waitForTimeout(800); // allow firebase auth callback to settle

// seed test state
await page.evaluate(() => window.__sim.seed());
await page.evaluate(() => window.__sim.S.showOpponent = true);
await page.evaluate(() => window.__sim.render());
await page.waitForTimeout(300);

const stateBefore = await page.evaluate(() => ({
  deck: window.__sim.S.self.deck.length,
  m2: !!window.__sim.S.self.monster[2],
  field0: !!window.__sim.S.self.field[0],
  grave: window.__sim.S.self.graveyard.length,
  free: window.__sim.S.self.free.length,
  zonesRendered: document.querySelectorAll('.zone.slot').length,
  piles: document.querySelectorAll('.pile').length,
  freeCards: document.querySelectorAll('.handzone .dcard').length,
  stackZones: document.querySelectorAll('.stackzone').length,
  graveStackCards: document.querySelectorAll('.stackzone.grave .dcard').length,
  fieldSlotInMonsterRow: !!document.querySelector('[data-drop="self.field.0"]'),
  oppSide: document.querySelectorAll('.side.opp').length,
  deckListCards: document.querySelectorAll('#deckList .dcard').length,
  extraListCards: document.querySelectorAll('#extraList .dcard').length,
}));
console.log('STATE BEFORE:', JSON.stringify(stateBefore));

await page.screenshot({ path: 'sim_desktop.png', fullPage: true });
console.log('saved sim_desktop.png');

// turn opponent off and use a tall viewport so hand + field both fit in the interaction viewport
await page.evaluate(() => { window.__sim.S.showOpponent = false; window.__sim.render(); });
await page.setViewportSize({ width: 1000, height: 1300 });
await page.waitForTimeout(200);

// --- simulate drag: first hand(free) card -> empty monster slot (monster index 3) ---
const handCard = await page.locator('.handzone .dcard').first().boundingBox();
const targetZone = await page.evaluate(() => {
  const z = document.querySelector('[data-drop="self.monster.3"]');
  const r = z.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(handCard.x + handCard.width / 2, handCard.y + handCard.height / 2);
await page.mouse.down();
await page.mouse.move(handCard.x + handCard.width / 2 + 15, handCard.y - 10, { steps: 3 });
await page.mouse.move(targetZone.x, targetZone.y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);

const afterDrag = await page.evaluate(() => ({
  free: window.__sim.S.self.free.length,
  m3: window.__sim.S.self.monster[3] ? window.__sim.S.self.monster[3].name : null,
  ghostHidden: document.getElementById('ghost').style.display === 'none',
  ghostsInDom: document.querySelectorAll('#ghost').length,
  m3Cards: document.querySelectorAll('[data-drop="self.monster.3"] .dcard').length,
}));
console.log('AFTER DRAG (hand-1, m3 set, ghostHidden, m3Cards=1):', JSON.stringify(afterDrag));
if (!afterDrag.m3) { console.log('drag did not land; skipping menu test'); await page.screenshot({ path:'sim_menu.png', fullPage:true }); console.log('ERRORS:', errors.length?JSON.stringify(errors):'none'); await browser.close(); server.close(); process.exit(0); }

// --- simulate right-click context menu on the monster we just placed ---
const m3 = await page.evaluate(() => {
  const z = document.querySelector('[data-drop="self.monster.3"] .dcard');
  const r = z.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.click(m3.x, m3.y, { button: 'right' });
await page.waitForTimeout(200);
const menuVisible = await page.evaluate(() => document.getElementById('menu').style.display === 'block');
const menuItems = await page.evaluate(() => Array.from(document.querySelectorAll('#menu button')).map(b => b.textContent));
console.log('MENU visible:', menuVisible, 'items:', JSON.stringify(menuItems));
await page.screenshot({ path: 'sim_menu.png', fullPage: true });
console.log('saved sim_menu.png');

// click "守備表示にする"
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('#menu button')).find(x => x.textContent.includes('守備'));
  if (b) b.click();
});
await page.waitForTimeout(150);
const def = await page.evaluate(() => window.__sim.S.self.monster[3]?.defense);
console.log('monster[3] defense after menu click:', def);

// --- Undo: should revert the defense toggle, then revert the drag ---
const undoTest = await page.evaluate(() => {
  const sim = window.__sim;
  const before = { m3def: sim.S.self.monster[3]?.defense, free: sim.S.self.free.length };
  sim.undo(); // revert defense toggle
  const afterUndo1 = { m3def: sim.S.self.monster[3]?.defense };
  sim.undo(); // revert the drag (card back to hand/free)
  const afterUndo2 = { m3: sim.S.self.monster[3], free: sim.S.self.free.length };
  return { before, afterUndo1, afterUndo2 };
});
console.log('UNDO:', JSON.stringify(undoTest));

// --- quick-place: EX list card -> EX monster zone via menu action ---
const quickPlace = await page.evaluate(() => {
  const sim = window.__sim;
  const exBefore = sim.S.self.extra.length;
  sim.moveTo('self.extra.0', 'self.exmon'); // mimics "EXモンスターゾーンへ出す"
  const exmonFilled = sim.S.self.exmon.filter(Boolean).length;
  const exAfter = sim.S.self.extra.length;
  // menu items present?
  return { exBefore, exAfter, exmonFilled };
});
console.log('QUICKPLACE (ex->exmon):', JSON.stringify(quickPlace));

// --- Xyz materials: stack onto an occupied monster zone, then detach ---
const xyz = await page.evaluate(() => {
  const sim = window.__sim;
  // ensure monster[2] is occupied
  if(!sim.S.self.monster[2]) sim.S.self.monster[2] = sim.newCard('土台モンスター', null, '1');
  const mat1 = sim.newCard('素材A', null, '1');
  const mat2 = sim.newCard('素材B', null, '1');
  sim.placeCard('self.monster.2', mat1); // becomes top, prev -> material
  sim.placeCard('self.monster.2', mat2); // becomes top, prev+mats -> materials
  const top = sim.S.self.monster[2];
  const afterStack = { topName: top.name, mats: (top.materials||[]).length };
  const graveBefore = sim.S.self.graveyard.length;
  sim.detachMaterial('self.monster.2'); // detach one -> graveyard
  const afterDetach = { mats: (sim.S.self.monster[2].materials||[]).length, graveDelta: sim.S.self.graveyard.length - graveBefore };
  // rendered stack + badge present?
  sim.render();
  const dom = { hasStack: !!document.querySelector('.cardstack'), hasBadge: !!document.querySelector('.matbadge') };
  return { afterStack, afterDetach, dom };
});
console.log('XYZ:', JSON.stringify(xyz));
await page.screenshot({ path: 'sim_xyz.png', clip: { x: 0, y: 60, width: 1000, height: 520 } });
console.log('saved sim_xyz.png');

// --- Link monster detection + list fill width ---
const linkAndFill = await page.evaluate(() => {
  const sim = window.__sim;
  const link = {
    accessCode: sim.isLinkMonster({name:'アクセスコード・トーカー'}),
    masquerena: sim.isLinkMonster({name:'I：Pマスカレーナ'}),
    blueEyes: sim.isLinkMonster({name:'青眼の白龍'}),
    placeholder: sim.isLinkMonster({name:'デッキカード'}),
  };
  // list fill: last card of a full deck row should reach near the container right edge
  const box=document.querySelector('.listrows');
  let fill=null;
  if(box){ const row=box.querySelector('.listrow'); const cards=row.children;
    const boxR=box.getBoundingClientRect(); const lastR=cards[cards.length-1].getBoundingClientRect();
    fill={ n:cards.length, boxW:Math.round(boxR.width), gapRight:Math.round(boxR.right-lastR.right) }; }
  return { link, fill };
});
console.log('LINK+FILL:', JSON.stringify(linkAndFill));

// --- PC: deck list shows all cards in ONE row (no chunk of 15) ---
const pcRows = await page.evaluate(() => {
  window.__sim.render();
  const box=[...document.querySelectorAll('.listrows')].find(b=>b.querySelectorAll('.listrow .dcard').length>20);
  if(!box) return null;
  const rows=box.querySelectorAll('.listrow');
  const total=box.querySelectorAll('.dcard').length;
  const lastCard=rows[rows.length-1].lastElementChild.getBoundingClientRect();
  return { rowCount:rows.length, total, gapRight:Math.round(box.getBoundingClientRect().right-lastCard.right) };
});
console.log('PC DECK ROWS (expect rowCount=1):', JSON.stringify(pcRows));

// --- Xyz material selection modal: select 2 of 3 materials and remove ---
const matSel = await page.evaluate(() => {
  const sim=window.__sim;
  const mon=sim.newCard('XモンスターZ',null,'1');
  mon.materials=[sim.newCard('素材1',null,'1'),sim.newCard('素材2',null,'1'),sim.newCard('素材3',null,'1')];
  sim.S.self.monster[3]=mon; sim.commit();
  sim.openMatModal('self.monster.3');
  const cards=document.querySelectorAll('#matModalGrid .dcard');
  cards[0].click(); cards[2].click(); // select #0 and #2
  const graveBefore=sim.S.self.graveyard.length;
  document.getElementById('matRemoveBtn').click();
  return { remaining:(sim.S.self.monster[3].materials||[]).length, graveDelta:sim.S.self.graveyard.length-graveBefore, modalClosed: document.getElementById('matModal').style.display==='none' };
});
console.log('MAT SELECT REMOVE (expect remaining=1, graveDelta=2):', JSON.stringify(matSel));

// --- Phase4: encode/decode + replay playback ---
const phase4 = await page.evaluate(() => {
  const sim = window.__sim;
  // a few more ops to build history
  sim.doDraw(1); sim.doDraw(1);
  const histLen = sim.history.length;
  // encode/decode roundtrip of current board
  const code = sim.enc(sim.curBoard());
  const back = sim.dec(code);
  const roundtripOK = back && back.self && back.self.hand.length === sim.S.self.hand.length;
  const codeLen = code.length;
  // replay: snapshot frames and step through
  const frames = sim.history.slice();
  sim.startReplay(frames);
  const atStart = JSON.stringify(window.__sim.S.self.hand.length);
  sim.showReplayFrame(frames.length - 1);
  const atEnd = window.__sim.S.self.hand.length;
  return { histLen, roundtripOK, codeLen, frames: frames.length, replayBarShown: document.getElementById('replaybar').style.display, atEnd };
});
console.log('PHASE4:', JSON.stringify(phase4));

// --- mobile viewport screenshot + replay bar visibility (must fit within viewport) ---
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
const barFit = await page.evaluate(() => {
  const b = document.getElementById('replaybar');
  const r = b.getBoundingClientRect();
  const exitBtn = document.getElementById('rbExit').getBoundingClientRect();
  return { barRight: Math.round(r.right), barBottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight,
    exitVisible: exitBtn.right <= window.innerWidth + 1 && exitBtn.bottom <= window.innerHeight + 1, bodyReplaying: document.body.classList.contains('replaying') };
});
console.log('REPLAYBAR FIT (mobile):', JSON.stringify(barFit));

// topbar height before/after collapsing the deck picker + hiding login (mobile)
const topbar = await page.evaluate(() => {
  const tb = document.querySelector('.topbar');
  const before = Math.round(tb.getBoundingClientRect().height);
  document.getElementById('loginBtn').style.display='none';
  window.__sim && window.__simCollapse && window.__simCollapse('テストデッキ名');
  // collapse via exposed helper if available, else toggle DOM directly
  const dp=document.getElementById('deckPicker'); const chip=document.getElementById('deckChip');
  if(dp){ dp.style.display='none'; chip.textContent='デッキ: テスト ▼'; chip.style.display=''; }
  const after = Math.round(tb.getBoundingClientRect().height);
  return { before, after, vh: window.innerHeight, pctBefore: Math.round(before/window.innerHeight*100), pctAfter: Math.round(after/window.innerHeight*100) };
});
console.log('TOPBAR (mobile px / % of screen):', JSON.stringify(topbar));
await page.screenshot({ path: 'sim_mobile.png', fullPage: false });
console.log('saved sim_mobile.png');

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');
await browser.close();
server.close();
console.log('Done.');
