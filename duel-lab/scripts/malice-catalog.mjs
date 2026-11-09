// Opening catalogue: best line found per starting hand (other slots = stand-in 霆王の閃光), guided by the closest replay.
// node scripts/malice-catalog.mjs [seconds=300] → runtime/malice/catalog.jsonl (resumable)
import fs from 'node:fs';
import {REPLAYS} from './malice-lab.mjs';
import {open} from './malice-open.mjs';
import {guideOf} from './malice-improve.mjs';
import {cardInfo} from '../cards.mjs';

const WR=69272449,CAT=96676583,MH=20938824,DM=32061192,UG=68337209,BK=30118811,CM=64865,SOUL=74652966,DROLL=94145021,COFFER=75500286,B=6325660;
export const HANDS=[
  {hand:[WR,MH],guide:'G9pZztFA'},{hand:[WR,CAT],guide:'G9pZztFA'},{hand:[WR,UG],guide:'3tnYxZAt'},
  {hand:[DM,MH],guide:'cEErE6ce'},{hand:[DM,CAT],guide:'cEErE6ce'},{hand:[UG,MH],guide:'3tnYxZAt'},
  {hand:[UG,CAT],guide:'3tnYxZAt'},{hand:[BK],guide:'Q5Vc2nzV'},{hand:[BK,MH],guide:'Q5Vc2nzV'},
  {hand:[MH,MH],guide:'BmA74rcx'},{hand:[CAT,CAT],guide:'BmA74rcx'},{hand:[DROLL,CM,MH],guide:'Q5Vc2nzV'},
];
const sec=Number(process.argv[2]||300),out=new URL('../runtime/malice/catalog.jsonl',import.meta.url);
const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l).hand.join(',')):[]);
for(const h of HANDS){
  const hand=[...h.hand];while(hand.length<4)hand.push(B);
  if(done.has(hand.join(',')))continue;
  const r=await open(hand,{seconds:sec,guide:guideOf(REPLAYS.find(x=>x.id.includes(h.guide)))});
  const row={hand,names:h.hand.map(c=>cardInfo(c).name),guide:h.guide,lines:r.lines,ms:r.ms,score:r.best?.score,trail:r.best?.trail};
  fs.appendFileSync(out,JSON.stringify(row)+'\n');
  console.log(`${row.names.join('＋')}: ${r.best?.score.total}（${r.best?.score.parts.map(p=>p[0]).join('・')}） 場:${r.best?.score.field.join('・')} 伏:${r.best?.score.sets.join('・')} LP${r.best?.score.lp}`);
}
