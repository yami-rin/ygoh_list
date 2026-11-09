// Static score vs. interruption-eval count for every user replay and saved M∀LICE route.
// node scripts/malice-calibrate.mjs [maxLines=200] [scenario=malice-mirror] → runtime/malice/calibrate.jsonl, docs/malice/CALIBRATION.md
import fs from 'node:fs';
import {evaluateRoute} from './interruption-eval.mjs';
import {startLab} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

const max=Number(process.argv[2]||200),scenario=process.argv[3]||'malice-mirror',tag=scenario==='malice-mirror'?'':'-'+scenario;
const routes=[...JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes,
  ...JSON.parse(fs.readFileSync(new URL('../routes/malice-routes.json',import.meta.url))).routes];
const out=new URL(`../runtime/malice/calibrate${tag}.jsonl`,import.meta.url);
const done=new Map(fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(l=>{const o=JSON.parse(l);return [o.id,o];}):[]);
for(const r of routes){
  if(done.has(r.id))continue;
  const g=await startLab({hand:r.hand,seed:r.seed});
  for(const s of r.steps){g.respond(0^g.first,g.revision,s.input,{snapshot:false});while(g.pending&&(g.pending.player^g.first)===1){const pass=g.prompt.choices.find(c=>c.label==='発動しない')||g.prompt.choices[0];g.respond(g.pending.player^g.first,g.revision,{action:pass.id},{snapshot:false});}}
  const sc=score(g);g.close();
  const e=await evaluateRoute(r,{maxLines:max,scenario});
  const row={id:r.id,title:r.title,score:sc.total,parts:sc.parts.map(p=>p[0]),interruptions:e.interruptions,breakdown:e.breakdown.map(b=>b.card),lines:e.lines};
  fs.appendFileSync(out,JSON.stringify(row)+'\n');done.set(r.id,row);
  console.log(`${r.title}: 点${sc.total} 妨害${e.interruptions}（${row.breakdown.join('・')}）`);
}
const rows=[...done.values()];
const md=['# 静的な点数と妨害評価器の対応（自動生成）','',`\`scripts/malice-calibrate.mjs\`（評価器のシナリオ ${scenario}、${max}手順で打ち切り）。`,'',
  '| ルート | 静的な点 | 評価器の妨害数 | 評価器が使った妨害 |','| --- | --- | --- | --- |',
  ...rows.sort((a,b)=>b.score-a.score).map(r=>`| ${r.title} | ${r.score.toFixed(2)} | ${r.interruptions} | ${r.breakdown.join('・')} |`)];
const n=rows.length,mx=rows.reduce((a,r)=>a+r.score,0)/n,my=rows.reduce((a,r)=>a+r.interruptions,0)/n;
const cov=rows.reduce((a,r)=>a+(r.score-mx)*(r.interruptions-my),0),vx=rows.reduce((a,r)=>a+(r.score-mx)**2,0),vy=rows.reduce((a,r)=>a+(r.interruptions-my)**2,0);
md.push('',`相関係数 ${(cov/Math.sqrt(vx*vy||1)).toFixed(2)}（${n}本）`);
fs.writeFileSync(new URL(`../docs/malice/CALIBRATION${tag}.md`,import.meta.url),md.join('\n')+'\n');
