// Second-card table: blank worst-window score vs. the same window with one extender in hand.
// node scripts/malice-extender-table.mjs  → docs/malice/EXTENDERS.md (generated)
import fs from 'node:fs';
import {cardInfo} from '../cards.mjs';

const dir=new URL('../runtime/malice/',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,dir),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const blank=read('batch-blank.jsonl');
const worst=new Map();
for(const r of blank){const k=`${r.routeId}|${r.trap}`;const w=worst.get(k);if(!w||(r.score?.total??0)<(w.score?.total??0))worst.set(k,r);}
const ext=fs.readdirSync(dir).filter(f=>/^batch-x\d+\.jsonl$/.test(f)).map(f=>({code:Number(f.match(/\d+/)[0]),rows:read(f)}));
const out=['# 2枚目の手札で受けられるか（自動生成）','',
  '`scripts/malice-extender-table.mjs` が生成。各マスは「相手がその誘発を、代役版で最も痛い窓に撃った場合」の最善盤面の点数（[HANDTRAPS.md](HANDTRAPS.md) と同じ静的見積もり）。',
  '左端は代役3枚のとき、右は代役1枚をそのカードに替えたとき。*は60秒で探索が終わらず見つかった中の最善（下限）。','',
  `| リプレイ | 誘発 | 代役 | ${ext.map(e=>cardInfo(e.code).name.replace(/M∀LICE＜P＞|サイバース・|＠イグニスター/g,'')).join(' | ')} |`,
  `| --- | --- | --- | ${ext.map(()=>'---').join(' | ')} |`];
const cell=r=>r?`${(r.score?.total??0).toFixed(2)}${r.complete?'':'*'}`:'';
for(const [k,w] of worst){
  const [routeId,trap]=k.split('|');
  const cells=ext.map(e=>cell(e.rows.find(r=>r.routeId===routeId&&String(r.trap)===trap)));
  if(cells.every(c=>!c))continue;
  out.push(`| ${w.route} | ${w.trapName} | ${cell(w)} | ${cells.join(' | ')} |`);
}
fs.writeFileSync(new URL('../docs/malice/EXTENDERS.md',import.meta.url),out.join('\n')+'\n');
console.log(out.slice(5).join('\n'));
