import {firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('./artifacts/',import.meta.url);fs.mkdirSync(root,{recursive:true});
const browser=await firefox.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:8787');await page.waitForFunction(()=>document.getElementById('human-deck').value.length>0);
 if(!(await page.locator('#setup').evaluate(e=>e.open)))await page.click('#new-game');
 await page.screenshot({path:new URL('setup.png',root).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 // Test no external AI calls: use a legal vanilla deck for the opponent; human starts.
 const vanilla=['ジェネティック・ワーウルフ','アレキサンドライドラゴン','幻殻竜','メガロスマッシャーX','フロストザウルス','青眼の白龍','ブラック・マジシャン','デーモンの召喚','暗黒騎士ガイア','真紅眼の黒竜','エルフの剣士','岩石の巨兵','ホーリー・エルフ','ルイーズ'];
 await page.fill('#astra-deck',vanilla.map((n,i)=>`${n} ${i===13?1:3}`).join('\n')+'\n#extra');
 // Deterministic human opening is not exposed as a production endpoint. Retry shuffled starts until a summonable card appears.
 for(let i=0;i<12;i++) {
  await page.selectOption('#first','0');await page.click('#start');
  await page.waitForFunction(()=>!document.getElementById('setup').open || document.getElementById('setup-error').textContent);
  assert.equal(await page.locator('#setup-error').textContent(),'');
  if(await page.locator('#actions button').filter({hasText:/^召喚：/}).count())break;
  await page.click('#new-game');
 }
 const summon=page.locator('#actions button').filter({hasText:/^召喚：/}).first();assert(await summon.count());
 assert.equal(await page.locator('#your-hand .mini-card').count(),5);assert.equal(await page.locator('#enemy-hand .card-back').count(),5);
 await page.locator('#your-hand .mini-card').first().click();assert((await page.locator('#card-text').textContent()).length>10);
 await summon.click();await page.waitForSelector('[data-select]');await page.locator('[data-select]').first().click();await page.click('#confirm');
 await page.waitForFunction(()=>document.querySelectorAll('#your-field .mini-card').length>0);
 await page.screenshot({path:new URL('duel-desktop.png',root).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const imgs=await page.locator('#your-hand img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.src})));
 assert(imgs.length>0);assert(imgs.every(i=>i.loaded));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:new URL('duel-mobile.png',root).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',errors,loadedImages:imgs.length}));
}finally{await browser.close();}
