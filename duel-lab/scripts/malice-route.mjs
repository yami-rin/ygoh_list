// Turn a search trail (malice-search best.trail, our steps "自 <prompt> <label>") into a stored route that
// interruption-eval.mjs and the tests can replay: node scripts/malice-route.mjs <id> <title> <hand codes> <trail.json> [routes file]
import fs from 'node:fs';
import {startLab,passPolicy,summary} from './malice-lab.mjs';
import {board,hash} from './route-harness.mjs';

function inputFor(p,prompt,label) {
  if(p.type!==prompt)throw new Error(`手順のずれ：${prompt}「${label}」の位置で ${p.type}`);
  if(p.mode==='single'){const c=p.choices.find(c=>c.label===label);if(!c)throw new Error(`「${label}」がない：${p.choices.map(c=>c.label).join(' | ')}`);return {action:c.id};}
  const used=new Set(),sel=label.split(' / ').map(w=>{const i=p.cards.findIndex((c,k)=>!used.has(k)&&c.label===w);if(i<0)throw new Error(`「${w}」がない`);used.add(i);return i;});
  return {selection:sel};
}

export async function buildRoute({id,title,hand,trail,seed=123,deck='presets/user-malice.json'}) {
  const g=await startLab({hand,seed});
  const steps=[];
  try{
    for(const t of trail){
      const m=/^自 (\S+) (.*)$/.exec(t);if(!m)continue;
      const [,prompt,label]=m;
      const input=inputFor(g.prompt,prompt,label);
      steps.push({prompt,label,before:hash({pending:g.pending,board:board(g)}),input});
      g.respond(0^g.first,g.revision,input,{snapshot:false});
      if(g.validationError)throw new Error(`拒否：${label}`);
      for(let i=0;i<50&&g.pending&&(g.pending.player^g.first)===1;i++){const {label:_,...r}=passPolicy(g);g.respond(g.pending.player^g.first,g.revision,r,{snapshot:false});}
    }
    const final=board(g);
    return {id,title,deck,hand,seed,steps,final,finalHash:hash(final),summary:summary(g),verified:true,deadHand:[6325660]};
  } finally {g.close();}
}

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const [id,title,handArg,trailFile,file='routes/malice-routes.json']=process.argv.slice(2);
  const trail=JSON.parse(fs.readFileSync(trailFile,'utf8'));
  const route=await buildRoute({id,title,hand:handArg.split(',').map(Number),trail});
  const store=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,routes:[]};
  store.routes=store.routes.filter(r=>r.id!==id).concat(route);
  fs.writeFileSync(file,JSON.stringify(store,null,1)+'\n');
  console.log(`${id}: ${route.steps.length}手、場 ${route.summary.monsters.join('・')} 伏 ${route.summary.spells.join('・')} LP${route.summary.lp}`);
}
