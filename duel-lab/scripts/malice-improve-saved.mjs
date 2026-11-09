// Improve saved routes (routes/malice-routes.json) once more, each as its own guide; better lines are saved as <id>-2.
// node scripts/malice-improve-saved.mjs <id,...> [seconds=300]
import fs from 'node:fs';
import {improve} from './malice-improve.mjs';
import {buildRoute} from './malice-route.mjs';
import {startLab} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

const file=new URL('../routes/malice-routes.json',import.meta.url);
const [ids,sec='300']=process.argv.slice(2);
for(const id of ids.split(',')){
  const store=JSON.parse(fs.readFileSync(file,'utf8'));
  const route=store.routes.find(r=>r.id===id);
  const g=await startLab({hand:route.hand,seed:route.seed});
  for(const s of route.steps){g.respond(0^g.first,g.revision,s.input,{snapshot:false});while(g.pending&&(g.pending.player^g.first)===1){const p=g.prompt.choices.find(c=>c.label==='発動しない')||g.prompt.choices[0];g.respond(g.pending.player^g.first,g.revision,{action:p.id},{snapshot:false});}}
  const base=score(g).total;g.close();
  const r=await improve(route,{seconds:Number(sec)});
  const best=r.best?.score.total??0;
  console.log(`${route.title}: ${base} → ${best}（${r.best?.score.parts.map(p=>p[0]).join('・')}） ${r.lines}手順`);
  if(best>base+0.05){
    const nid=`${id}-2`;
    const nr=await buildRoute({id:nid,title:`${route.title.replace(/（.*）$/,'')}（2段目の改善、${best}点）`,hand:route.hand,trail:r.best.trail});
    const s2=JSON.parse(fs.readFileSync(file,'utf8'));s2.routes=s2.routes.filter(x=>x.id!==nid).concat(nr);
    fs.writeFileSync(file,JSON.stringify(s2,null,1)+'\n');
    console.log(`  保存 ${nid}`);
  }
}
