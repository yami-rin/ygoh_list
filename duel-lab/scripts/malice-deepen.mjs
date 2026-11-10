// Re-search the worst window of each (route, trap) whose 60-second search was cut off, with a longer budget.
// node scripts/malice-deepen.mjs <batch.jsonl> [seconds=300] → appends improved rows to the same file (later rows win in reports)
import fs from 'node:fs';
import {respond} from './malice-respond.mjs';

const [file,sec='300']=process.argv.slice(2);
const rows=fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const worst=new Map();
for(const r of rows){const k=`${r.routeId}|${r.trap}|${r.extra.join('+')}`;const w=worst.get(k);if(!w||(r.score?.total??0)<(w.score?.total??0))worst.set(k,r);}
for(const w of worst.values()){
  if(w.complete||w.deepened)continue;
  const r=await respond({routeId:w.routeId,trap:w.trap,window:w.window,seconds:Number(sec),extra:w.extra});
  const row={...w,deepened:true,complete:r.complete,lines:r.lines,ms:r.ms,score:r.best?.score??w.score,trail:r.best?.trail??w.trail};
  const better=(row.score?.total??0)>(w.score?.total??0);
  if(better)fs.appendFileSync(file,JSON.stringify(row)+'\n');
  console.log(`${w.route} × ${w.trapName} 窓${w.window}: ${w.score?.total} → ${row.score?.total}${r.complete?'（完走）':''}${better?' 更新':''}`);
}
