// Baiting: the opponent fires the hand trap at its FIRST legal window; we may reorder (the guide is only the first line).
// Compares with "the user's order, trap at its worst window" from the blank batch.
// node scripts/malice-bait.mjs [seconds=300] → runtime/malice/bait.jsonl (resumable)
import fs from 'node:fs';
import {REPLAYS} from './malice-lab.mjs';
import {open} from './malice-open.mjs';
import {guideOf} from './malice-improve.mjs';
import {TRAPS} from './malice-traps.mjs';
import {cardInfo} from '../cards.mjs';

const B=6325660,BK=30118811,MH=20938824;
const CASES=[];
for(const r of REPLAYS)for(const t of ['ash','imperm','purge','nibiru','droll'])CASES.push({route:r,trap:t,extra:[]});
for(const r of REPLAYS)for(const t of ['ash','imperm','purge'])CASES.push({route:r,trap:t,extra:[BK]});
const sec=Number(process.argv[2]||300),out=new URL('../runtime/malice/bait.jsonl',import.meta.url);
const key=c=>`${c.route.id}|${c.trap}|${c.extra.join('+')}`;
const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l).key):[]);
for(const c of CASES){
  if(done.has(key(c)))continue;
  const hand=[...c.route.hand];
  for(const code of c.extra){const i=hand.indexOf(B);if(i>=0)hand[i]=code;else hand.push(code);}
  let r;
  try{r=await open(hand,{seconds:sec,guide:guideOf(c.route),trap:TRAPS[c.trap],window:0});}
  catch(e){console.log(`スキップ ${c.route.title} ${c.trap}: ${e.message}`);continue;}
  const row={key:key(c),routeId:c.route.id,title:c.route.title,trap:c.trap,extra:c.extra,hand,lines:r.lines,complete:r.complete,score:r.best?.score,trail:r.best?.trail};
  fs.appendFileSync(out,JSON.stringify(row)+'\n');
  console.log(`${c.route.title}${c.extra.length?'＋'+c.extra.map(x=>cardInfo(x).name).join('＋'):''} × ${cardInfo(TRAPS[c.trap]).name}（最初の窓）→ ${r.best?.score.total}（${r.best?.score.parts.map(p=>p[0]).join('・')}）`);
}
