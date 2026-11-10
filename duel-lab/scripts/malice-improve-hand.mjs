// Search a hand guided by a saved route (e.g. a stronger line for a subset of the hand); save if it beats `min`.
// node scripts/malice-improve-hand.mjs <guide route id> <hand codes,comma> <new id> [seconds=300]
import fs from 'node:fs';
import {ALL_ROUTES} from './malice-lab.mjs';
import {improve} from './malice-improve.mjs';
import {buildRoute} from './malice-route.mjs';
import {cardInfo} from '../cards.mjs';

const [gid,handArg,nid,sec='300']=process.argv.slice(2);
const guide=ALL_ROUTES.find(r=>r.id===gid),hand=handArg.split(',').map(Number);
const r=await improve(guide,{seconds:Number(sec),hand});
const best=r.best?.score;
console.log(`${hand.filter(c=>c!==6325660).map(c=>cardInfo(c).name).join('＋')}（案内 ${gid}）: ${best?.total}（${best?.parts.map(p=>p[0]).join('・')}） ${r.lines}手順`);
if(best){
  const file=new URL('../routes/malice-routes.json',import.meta.url);
  const route=await buildRoute({id:nid,title:`${hand.filter(c=>c!==6325660).map(c=>cardInfo(c).name).join('＋')}（${gid}を案内、${best.total}点）`,hand,trail:r.best.trail});
  const s=JSON.parse(fs.readFileSync(file,'utf8'));s.routes=s.routes.filter(x=>x.id!==nid).concat(route);
  fs.writeFileSync(file,JSON.stringify(s,null,1)+'\n');
  console.log(`保存 ${nid}`);
}
