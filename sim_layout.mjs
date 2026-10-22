import { chromium } from 'playwright';
import path from 'path'; import http from 'http'; import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.csv':'text/csv','.json':'application/json' };
const server = http.createServer((req,res)=>{ let f=decodeURIComponent(req.url.split('?')[0]); if(f==='/')f='/duel_simulator.html'; const fp=path.join(__dirname,f); if(!fp.startsWith(__dirname)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
await new Promise(r=>server.listen(8124,r));
const base='http://127.0.0.1:8124';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
await page.setViewportSize({ width: 1366, height: 900 });
await page.goto(`${base}/duel_simulator.html?test=1`);
await page.waitForSelector('#boardRoot .side', { timeout: 8000 });
await page.waitForTimeout(700);
for (const w of [1366, 1024, 820, 390]) {
  await page.setViewportSize({ width: w, height: 1200 });
  await page.waitForTimeout(150);
  // re-seed at THIS width so positions/sizes are computed for it
  await page.evaluate(() => {
    const s = window.__sim; s.seed();
    s.S.self.graveyard = Array.from({length:12},(_,i)=>s.newCard('墓地'+(i+1),null,'1'));
    s.S.self.free = [];
    s.render(); // ensure handzone exists for freeCols measurement
    for(let i=0;i<10;i++) s.placeCard('self.free', s.newCard('手札'+(i+1),null,'1'));
    s.S.showOpponent = false;
    s.render();
  });
  await page.waitForTimeout(200);
  // report any horizontal overflow beyond viewport + rotated cards overflowing their slot
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    let maxRight = 0, offenders = [];
    document.querySelectorAll('.dcard, .stackzone, .side').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 1) { maxRight = Math.max(maxRight, r.right); offenders.push(el.className.split(' ')[0]); }
    });
    // rotated (defense/set) cards must stay within their slot zone
    let defOverflow = [];
    document.querySelectorAll('.zone.slot .dcard.def').forEach(c => {
      const zr = c.closest('.zone').getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      if (cr.left < zr.left - 3 || cr.right > zr.right + 3) defOverflow.push(Math.round(Math.max(zr.left - cr.left, cr.right - zr.right)));
    });
    const pilebar = document.querySelectorAll('.pilebar').length;
    const handH = Math.round((document.querySelector('.side:not(.opp) .handzone')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height);
    return { docW, maxRight: Math.round(maxRight), offenders: [...new Set(offenders)], defOverflowPx: defOverflow, pilebar, handH };
  });
  console.log(`w=${w}`, JSON.stringify(overflow));
  await page.screenshot({ path: `lay_${w}.png`, fullPage: true });
  console.log('saved lay_' + w + '.png');
}
await browser.close(); server.close();
