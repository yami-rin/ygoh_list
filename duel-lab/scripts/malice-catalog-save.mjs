// Save every catalog line (runtime/malice/catalog.jsonl) as a replayable route in routes/malice-routes.json.
import fs from 'node:fs';
import {buildRoute} from './malice-route.mjs';

const file=new URL('../routes/malice-routes.json',import.meta.url);
const store=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=fs.readFileSync(new URL('../runtime/malice/catalog.jsonl',import.meta.url),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
for(const r of rows){
  if(!r.trail)continue;
  const id=`malice-open-${r.hand.filter(c=>c!==6325660).join('-')}`;
  const route=await buildRoute({id,title:`${r.names.join('＋')}（初動カタログの最善、${r.score.total}点）`,hand:r.hand,trail:r.trail});
  store.routes=store.routes.filter(x=>x.id!==id).concat(route);
  console.log(id,route.steps.length,route.summary.monsters.join('・'));
}
fs.writeFileSync(file,JSON.stringify(store,null,1)+'\n');
