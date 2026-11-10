// docs/malice/SAMPLE.md from runtime/malice/sample*.jsonl: score distribution over random 5-card hands,
// without and with an opponent hand trap fired at its first legal window.
import fs from 'node:fs';

const dir=new URL('../runtime/malice/',import.meta.url);
const read=f=>fs.existsSync(new URL(f,dir))?fs.readFileSync(new URL(f,dir),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
const sets=[['誘発なし',read('sample.jsonl')],['相手うらら',read('sample-ash.jsonl')],['相手泡影',read('sample-imperm.jsonl')]].filter(([,r])=>r.length);
const sc=r=>r?.score?.total??0;
const bands=[[4.5,'4.5点以上'],[3.5,'3.5〜4.5'],[2.5,'2.5〜3.5'],[1.5,'1.5〜2.5'],[0,'1.5未満']];
const inBand=(v,i)=>v>=bands[i][0]&&(i===0||v<bands[i-1][0]);
const pct=(n,d)=>`${n}（${Math.round(n/d*100)}%）`;
const md=['# 実戦の5枚手札（自動生成）','',
  '`scripts/malice-sample.mjs` がユーザーのデッキから無作為に5枚を40回配り（固定seed）、手札の札で始まる保存ルートのうち評価器の点が最も高いものを案内に最善を探した結果（誘発なし120秒、誘発あり90秒）。',
  '「相手うらら／泡影」は相手がその1枚を持ち、最初に撃てる機会に撃つ。点は静的見積もり（自分の手札誘発も含む）。','',
  `| 点 | ${sets.map(([n])=>n).join(' | ')} |`,`| --- | ${sets.map(()=>'---').join(' | ')} |`,
  ...bands.map(([,l],i)=>`| ${l} | ${sets.map(([,rows])=>pct(rows.filter(r=>inBand(sc(r),i)).length,rows.length)).join(' | ')} |`),
  `| ネオテン到達 | ${sets.map(([,rows])=>pct(rows.filter(r=>r.score?.field.some(f=>f.includes('ネオテンペスト'))).length,rows.length)).join(' | ')} |`,
  `| アコードも | ${sets.map(([,rows])=>pct(rows.filter(r=>r.score?.field.some(f=>f.includes('アコード'))).length,rows.length)).join(' | ')} |`,
  `| 平均点 | ${sets.map(([,rows])=>(rows.reduce((n,r)=>n+sc(r),0)/rows.length).toFixed(2)).join(' | ')} |`,'',
  `| # | 手札 | 案内 | ${sets.map(([n])=>n).join(' | ')} |`,`| --- | --- | --- | ${sets.map(()=>'---').join(' | ')} |`];
const base=sets[0][1];
for(const r of [...base].sort((a,b)=>sc(a)-sc(b))){
  md.push(`| ${r.i} | ${r.names.join('・')} | ${r.guide??'なし'} | ${sets.map(([,rows])=>sc(rows.find(x=>x.i===r.i)).toFixed(2)).join(' | ')} |`);
}
fs.writeFileSync(new URL('../docs/malice/SAMPLE.md',import.meta.url),md.join('\n')+'\n');
console.log(md.slice(5,15).join('\n'));
