// docs/malice/SAMPLE.md from runtime/malice/sample.jsonl: score distribution over random 5-card hands.
import fs from 'node:fs';

const rows=fs.readFileSync(new URL('../runtime/malice/sample.jsonl',import.meta.url),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const sc=r=>r.score?.total??0;
const bands=[[4.5,'4.5点以上'],[3.5,'3.5〜4.5'],[2.5,'2.5〜3.5'],[1.5,'1.5〜2.5'],[0,'1.5未満']];
const count=bands.map(([lo],i)=>rows.filter(r=>sc(r)>=lo&&(i===0||sc(r)<bands[i-1][0])).length);
const neo=rows.filter(r=>r.score?.field.some(f=>f.includes('ネオテンペスト'))).length;
const accord=rows.filter(r=>r.score?.field.some(f=>f.includes('アコード'))).length;
const md=['# 実戦の5枚手札（自動生成）','',
  `\`scripts/malice-sample.mjs\` がユーザーのデッキから無作為に5枚を${rows.length}回配り（固定seed）、手札の札で始まる保存ルートのうち評価器の点が最も高いものを案内に、各120秒で最善を探した結果。点は静的見積もり（手札誘発も含む）。`,'',
  '| 点 | 手札数 | 割合 |','| --- | --- | --- |',
  ...bands.map(([,l],i)=>`| ${l} | ${count[i]} | ${Math.round(count[i]/rows.length*100)}% |`),'',
  `ネオテンペストに届いた手札：${neo}/${rows.length}（${Math.round(neo/rows.length*100)}%）、アコードも並んだ手札：${accord}/${rows.length}（${Math.round(accord/rows.length*100)}%）。`,'',
  '| # | 手札 | 案内 | 点 | 最終盤面 |','| --- | --- | --- | --- | --- |',
  ...rows.sort((a,b)=>sc(a)-sc(b)).map(r=>`| ${r.i} | ${r.names.join('・')} | ${r.guide??'なし'} | ${sc(r).toFixed(2)} | ${(r.score?.field||[]).join('・')} |`)];
fs.writeFileSync(new URL('../docs/malice/SAMPLE.md',import.meta.url),md.join('\n')+'\n');
console.log(md.slice(4,12).join('\n'));
