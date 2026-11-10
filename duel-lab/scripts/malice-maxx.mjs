// Against Maxx "C": the best board reachable within N Special Summons, with the order free (guided by a saved route).
// node scripts/malice-maxx.mjs <route id> <limits,comma> [seconds=180]  → prints one line per limit
import {ALL_ROUTES,startLab,passPolicy} from './malice-lab.mjs';
import {searchBest} from './malice-search.mjs';
import {guideOf} from './malice-improve.mjs';

const [id,limits,sec='180']=process.argv.slice(2);
const route=ALL_ROUTES.find(r=>r.id===id);
for(const n of limits.split(',').map(Number)){
  const r=await searchBest(async()=>({g:await startLab({hand:route.hand,seed:route.seed}),policy:passPolicy}),
    {ms:Number(sec)*1000,guide:guideOf(route),ssLimit:n});
  const s=r.best.score;
  console.log(`${route.title||id} 特殊召喚${n}回以内：${s.field.join('・')||'なし'}${s.sets.length?' 伏:'+s.sets.join('・'):''} → ${s.parts.map(p=>p[0]).join('・')||'妨害なし'}（${s.total.toFixed(2)}、${r.lines}手順${r.complete?' 完走':''}）`);
}
