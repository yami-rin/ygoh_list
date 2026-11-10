// Where to stop against Maxx "C": replay a saved route and, at each idle point, show how many Special Summons have
// happened (= cards the opponent drew) and what board we would end with if we stopped there.
// node scripts/malice-stop-points.mjs <route id,...>
import {ALL_ROUTES,startLab,passPolicy} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

for(const id of process.argv[2].split(',')){
  const r=ALL_ROUTES.find(x=>x.id===id);
  const g=await startLab({hand:r.hand,seed:r.seed});
  const rows=[];let last=null;
  try{
    for(const s of r.steps){
      if(g.prompt.type==='SELECT_IDLECMD'){
        const ss=g.log.filter(e=>/を特殊召喚/.test(e.text)).length,sc=score(g);
        const key=sc.parts.map(p=>p[0]).join('・');
        if(key!==last)rows.push(`特殊召喚${ss}回で止める：${sc.field.join('・')||'なし'}${sc.sets.length?' 伏:'+sc.sets.join('・'):''} → ${key||'妨害なし'}（${sc.total.toFixed(2)}）`);
        last=key;
      }
      g.respond(0^g.first,g.revision,s.input,{snapshot:false});
      for(let i=0;i<50&&g.pending&&(g.pending.player^g.first)===1;i++){const {label,...x}=passPolicy(g);g.respond(g.pending.player^g.first,g.revision,x,{snapshot:false});}
    }
    const ss=g.log.filter(e=>/を特殊召喚/.test(e.text)).length,sc=score(g);
    rows.push(`最後まで（特殊召喚${ss}回）：${sc.field.join('・')}${sc.sets.length?' 伏:'+sc.sets.join('・'):''} → ${sc.parts.map(p=>p[0]).join('・')}（${sc.total.toFixed(2)}）`);
  } finally {g.close();}
  console.log(`## ${r.title||r.id}`);rows.forEach(x=>console.log('- '+x));
}
