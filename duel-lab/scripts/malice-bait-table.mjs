// docs/malice/BAIT.md from runtime/malice/bait.jsonl: reordering against an opponent who fires at the first legal window,
// next to the user's order hit at its worst window (batch-blank / batch-x30118811).
import fs from 'node:fs';
import {TRAPS} from './malice-traps.mjs';
import {cardInfo} from '../cards.mjs';

const dir=new URL('../runtime/malice/',import.meta.url);
const read=f=>fs.existsSync(new URL(f,dir))?fs.readFileSync(new URL(f,dir),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
const worstOf=rows=>{const m=new Map();for(const r of rows){const k=`${r.routeId}|${r.trap}`;const w=m.get(k);if(!w||(r.score?.total??0)<(w.score?.total??0))m.set(k,r);}return m;};
const blank=worstOf(read('batch-blank.jsonl')),backup=worstOf(read('batch-x30118811.jsonl'));
const out=['# 囮と順番（自動生成）','','`scripts/malice-bait-table.mjs` が生成。相手は誘発を「最初に撃てる窓」で撃つ。こちらはユーザーの手順を最初の案内にして順番を組み替えてよい（180秒の探索、下限）。',
  '比較の列は、ユーザーの手順のまま「最も痛い窓」に撃たれた場合（[HANDTRAPS.md](HANDTRAPS.md)・[EXTENDERS.md](EXTENDERS.md)）。','',
  '| リプレイ | 2枚目 | 誘発 | 最初の窓・順番自由 | ユーザー順・最悪の窓 | 最初に誘発を受けた効果 |','| --- | --- | --- | --- | --- | --- |'];
for(const r of read('bait.jsonl')){
  const code=TRAPS[r.trap],id=r.routeId.replace('user-replay-','');
  const cmp=(r.extra.length?backup:blank).get(`${id}|${code}`);
  const hit=(r.trail||[]).findIndex(t=>t.startsWith('相 SELECT_CHAIN 発動'));
  const before=hit>0?[...r.trail.slice(0,hit)].reverse().find(t=>/IDLECMD|CHAIN 発動/.test(t)):null;
  out.push(`| ${r.title} | ${r.extra.map(c=>cardInfo(c).name).join('・')||'なし'} | ${cardInfo(code).name} | ${(r.score?.total??0).toFixed(2)} | ${cmp?cmp.score.total.toFixed(2):'-'} | ${before?before.replace(/^自 \S+ /,''):'（撃たれず）'} |`);
}
fs.writeFileSync(new URL('../docs/malice/BAIT.md',import.meta.url),out.join('\n')+'\n');
console.log(out.slice(5).join('\n'));
