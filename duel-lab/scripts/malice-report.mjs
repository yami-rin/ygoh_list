// Build docs/malice/HANDTRAPS.md and docs/malice/handtrap-results.json from runtime/malice/batch-*.jsonl.
// node scripts/malice-report.mjs [batch files...]
import fs from 'node:fs';
import {ALL_ROUTES,startLab,replaySteps} from './malice-lab.mjs';
import {score} from './malice-search.mjs';
import {cardInfo} from '../cards.mjs';

const files=process.argv.slice(2).length?process.argv.slice(2):fs.readdirSync(new URL('../runtime/malice/',import.meta.url)).filter(f=>/^batch-.*\.jsonl$/.test(f)).map(f=>`runtime/malice/${f}`);
// The same window searched again with a longer budget (malice-deepen.mjs) keeps its best result.
const byWindow=new Map();
for(const r of files.flatMap(f=>fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)))){
  const k=`${r.routeId}|${r.trap}|${r.window}|${r.extra.join('+')}`,o=byWindow.get(k);
  if(!o||(r.score?.total??0)>(o.score?.total??0))byWindow.set(k,r);
}
const rows=[...byWindow.values()];
const base={};
for(const r of ALL_ROUTES){const id=r.id.replace('user-replay-','');if(!rows.some(x=>x.routeId===id))continue;const g=await startLab({hand:r.hand,seed:r.seed});replaySteps(g,r);base[id]=score(g);g.close();}
const extraName=e=>e.length?e.map(c=>cardInfo(c).name).join('＋'):'なし';
const key=r=>`${r.routeId}|${r.extra.join('+')}`;
const groups=new Map();for(const r of rows){if(!groups.has(key(r)))groups.set(key(r),[]);groups.get(key(r)).push(r);}
const out=['# 手札誘発の当たり所と受け（自動生成）','',
  '`scripts/malice-report.mjs` が `runtime/malice/batch-*.jsonl` から生成する。手で編集しない。',
  '各行は「ユーザーのリプレイの手順を進め、相手がその誘発をその窓で撃った場合に、残りの資源で作れる最善の盤面」。',
  '点数は `malice-search.mjs` の静的見積もり（相手ターンに使える妨害の数の目安、ドローしたカードは0.3）。打切＝制限時間内に全探索が終わらず、見つかった中の最善（下限）。',
  '「最悪の窓」は相手にとって最善の撃ち所＝こちらの点数が最も下がる窓。',''];
const summary=[];
for(const [k,list] of groups){
  const [routeId]=k.split('|');const b=base[routeId];
  out.push(`## ${list[0].route}（追加の手札：${extraName(list[0].extra)}）`,'',`誘発なし：${b.total.toFixed(2)}点（${b.parts.map(p=>p[0]).join('・')}）`,'');
  out.push('| 誘発 | 最悪の窓 | 撃たれる効果 | 最善の盤面 | 点 | 完走 |','| --- | --- | --- | --- | --- | --- |');
  const byTrap=new Map();for(const r of list){if(!byTrap.has(r.trapName))byTrap.set(r.trapName,[]);byTrap.get(r.trapName).push(r);}
  for(const [trap,ws] of byTrap){
    const worst=ws.reduce((a,b)=>(b.score?.total??0)<(a.score?.total??0)?b:a);
    const sc=worst.score;
    out.push(`| ${trap} | 窓${worst.window}（手順${worst.step}） | ${worst.chain.at(-1)||'（チェーンなし）'} | ${sc?[...sc.field,...sc.sets.map(s=>s+'(伏)')].join('・')||'なし':'-'} | ${sc?sc.total.toFixed(2):'-'} | ${worst.complete?'○':'打切'} |`);
    summary.push({routeId,route:worst.route,extra:worst.extra,trap,window:worst.window,step:worst.step,chain:worst.chain,score:sc?.total??0,parts:sc?.parts??[],field:sc?.field??[],sets:sc?.sets??[],complete:worst.complete,
      windows:ws.map(w=>({window:w.window,step:w.step,chain:w.chain.at(-1)||null,score:w.score?.total??0,complete:w.complete}))});
  }
  out.push('');
}
fs.writeFileSync(new URL(`../docs/malice/${process.env.REPORT_NAME||'HANDTRAPS'}.md`,import.meta.url),out.join('\n')+'\n');
fs.writeFileSync(new URL(`../docs/malice/${process.env.REPORT_NAME?process.env.REPORT_NAME.toLowerCase():'handtrap'}-results.json`,import.meta.url),JSON.stringify({generated:new Date().toISOString(),baseline:Object.fromEntries(Object.entries(base).map(([k,v])=>[k,v.total])),cells:summary},null,1)+'\n');
console.log(`${rows.length}行、${summary.length}マス`);
