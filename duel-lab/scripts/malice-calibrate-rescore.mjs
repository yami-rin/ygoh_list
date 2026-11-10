// Refresh the static score of calibration rows (runtime/malice/calibrate*.jsonl) after a scoring fix, keeping the
// evaluator counts (the evaluator plays the opponent turn in the engine and does not use the static score).
// node scripts/malice-calibrate-rescore.mjs, then node scripts/malice-calibrate.mjs <max> <scenario> to rebuild the tables.
import fs from 'node:fs';
import {startLab,replaySteps,ALL_ROUTES} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

const dir=new URL('../runtime/malice/',import.meta.url);
const cache=new Map();
for(const f of fs.readdirSync(dir).filter(f=>/^calibrate.*\.jsonl$/.test(f))){
  const rows=fs.readFileSync(new URL(f,dir),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
  let n=0;
  for(const row of rows){
    const r=ALL_ROUTES.find(x=>x.id===row.id);if(!r)continue;
    if(!cache.has(r.id)){const g=await startLab({hand:r.hand,seed:r.seed});replaySteps(g,r);cache.set(r.id,score(g));g.close();}
    const sc=cache.get(r.id);
    if(Math.abs(sc.total-row.score)>1e-6){row.score=sc.total;row.parts=sc.parts.map(p=>p[0]);n++;}
  }
  fs.writeFileSync(new URL(f,dir),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  console.log(`${f}: ${n}行を再採点`);
}
