// Batch of response searches: node scripts/malice-batch.mjs <out.jsonl> [seconds=60] [traps=ash,imperm,...] [extra hand codes]
// For each user replay and hand trap, takes the distinct windows from runtime/malice/hits-<trap>.json (a new chain top,
// or for empty chains a gap of 8+ route steps; at most 8 per route) and searches the best continuation (malice-respond.mjs).
// Resumable: cells already in the output file are skipped.
import fs from 'node:fs';
import {respond} from './malice-respond.mjs';
import {TRAPS} from './malice-traps.mjs';

const [out,sec='60',trapArg='ash,imperm,droll,purge,shiki,ogre,shigure,spark,nibiru',extraArg='']=process.argv.slice(2);
const extra=extraArg?extraArg.split(',').map(Number):[];
const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(l=>{const o=JSON.parse(l);return `${o.routeId}:${o.trap}:${o.window}:${o.extra.join('+')}`;}):[]);

export function distinctWindows(rows,max=8) {
  const keep=[];let lastTop=null,lastStep=-99;
  for(const w of rows){
    const top=w.chain.at(-1)||null;
    if(top?top!==lastTop:w.step-lastStep>=8){keep.push(w);lastStep=w.step;}
    lastTop=top;
    if(keep.length>=max)break;
  }
  return keep;
}

for(const trapName of trapArg.split(',')){
  const trap=TRAPS[trapName]||Number(trapName);
  const table=JSON.parse(fs.readFileSync(new URL(`../runtime/malice/hits-${trap}${process.env.HITS_TAG||''}.json`,import.meta.url)));
  for(const t of table){
    const routeId=t.route.replace('user-replay-','');
    // WORST_FROM=<batch.jsonl>: only the window that hurt most there (the opponent's best timing), e.g. to test extenders.
    let windows=distinctWindows(t.windows);
    if(process.env.WORST_FROM){
      const prev=fs.readFileSync(process.env.WORST_FROM,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(o=>o.routeId===routeId&&o.trap===trap);
      if(!prev.length)continue;
      const worst=prev.reduce((a,b)=>(b.score?.total??0)<(a.score?.total??0)?b:a);
      windows=t.windows.filter(w=>w.window===worst.window);
    }
    for(const w of windows){
      const key=`${routeId}:${trap}:${w.window}:${extra.join('+')}`;
      if(done.has(key))continue;
      let r;
      // A hand the deck cannot supply (e.g. a second copy of a 1-of) is skipped.
      try{r=await respond({routeId,trap,window:w.window,seconds:Number(sec),extra});}
      catch(e){console.log(`スキップ ${t.title} ${t.trap}: ${e.message}`);continue;}
      const row={routeId,route:t.title,trap,trapName:t.trap,window:w.window,step:w.step,chain:w.chain,extra,
        brokenAt:r.broken?.broken??null,complete:r.complete,lines:r.lines,ms:r.ms,
        score:r.best?.score??null,trail:r.best?.trail??[]};
      fs.appendFileSync(out,JSON.stringify(row)+'\n');
      console.log(`${t.trap} × ${t.title} 窓${w.window}（手${w.step} ${w.chain.at(-1)||'-'}）→ ${row.score?.total??'-'} ${row.score?.parts.map(p=>p[0]).join('・')||''}${r.complete?'':'（打切）'} ${Math.round(r.ms/1000)}s`);
    }
  }
}
