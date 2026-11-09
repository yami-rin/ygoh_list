// Interruption count (interruption-eval.mjs, scenario malice-mirror) for user replays and saved M∀LICE routes.
// node scripts/malice-eval-routes.mjs <id part,...> [maxLines=600]  → appends runtime/malice/eval.jsonl
import fs from 'node:fs';
import {evaluateRoute} from './interruption-eval.mjs';

const all=[...JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes,
  ...(fs.existsSync(new URL('../routes/malice-routes.json',import.meta.url))?JSON.parse(fs.readFileSync(new URL('../routes/malice-routes.json',import.meta.url))).routes:[])];
const [ids,max='600',scenario='malice-mirror']=process.argv.slice(2);
for(const part of ids.split(',')){
  const route=all.find(r=>r.id.includes(part));
  const r=await evaluateRoute(route,{maxLines:Number(max),scenario});
  const row={id:route.id,title:route.title,scenario,maxLines:Number(max),lines:r.lines,complete:r.complete,ms:r.ms,interruptions:r.interruptions,targets:r.targets,breakdown:r.breakdown};
  fs.appendFileSync(new URL('../runtime/malice/eval.jsonl',import.meta.url),JSON.stringify(row)+'\n');
  console.log(`${route.title}: 妨害${r.interruptions}（${r.breakdown.map(b=>`${b.card}→${b.targets.join('・')}`).join(' / ')}） ${r.lines}手順${r.complete?' 完走':''} ${Math.round(r.ms/1000)}s`);
}
