// Run malice-improve.mjs for every user replay and append to runtime/malice/improve.jsonl: node scripts/malice-improve-all.mjs [seconds=300]
import fs from 'node:fs';
import {REPLAYS,startLab,replaySteps} from './malice-lab.mjs';
import {improve} from './malice-improve.mjs';
import {score} from './malice-search.mjs';

const sec=Number(process.argv[2]||300),out=new URL('../runtime/malice/improve.jsonl',import.meta.url);
for(const route of REPLAYS){
  const g=await startLab({hand:route.hand,seed:route.seed});replaySteps(g,route);const base=score(g);g.close();
  const r=await improve(route,{seconds:sec});
  const row={routeId:route.id,title:route.title,base:base.total,baseParts:base.parts,best:r.best?.score,trail:r.best?.trail,lines:r.lines,ms:r.ms,complete:r.complete};
  fs.appendFileSync(out,JSON.stringify(row)+'\n');
  console.log(`${route.title}: リプレイ ${base.total} → 最善 ${r.best?.score.total}（${r.best?.score.parts.map(p=>p[0]).join('・')}） ${r.lines}手順`);
}
