// Random 5-card opening hands from the user's deck (fixed seed) → best first-turn line found in `seconds`,
// guided by the best saved route whose starting cards are all in the hand. Measures how often the deck reaches
// a given board. node scripts/malice-sample.mjs [count=40] [seconds=120] [hand trap name]
// → runtime/malice/sample.jsonl, or sample-<trap>.jsonl when the opponent holds that hand trap and fires it at its
// first legal window (resumable).
import fs from 'node:fs';
import {USER_DECK,ALL_ROUTES,startLab,passPolicy,trapPolicy} from './malice-lab.mjs';
import {searchBest} from './malice-search.mjs';
import {guideOf} from './malice-improve.mjs';
import {TRAPS} from './malice-traps.mjs';
import {cardInfo} from '../cards.mjs';

const [count='40',sec='120',trapName='']=process.argv.slice(2);
const opp=trapName?TRAPS[trapName]||Number(trapName):null;
const BLANK=6325660;
// Mulberry32: reproducible hands.
let state=20261110;const rand=()=>{state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const hands=[];
for(let i=0;i<Number(count);i++){const d=[...USER_DECK.main];const h=[];for(let k=0;k<5;k++)h.push(d.splice(Math.floor(rand()*d.length),1)[0]);hands.push(h.sort((a,b)=>a-b));}

const cal=new Map((fs.existsSync(new URL('../runtime/malice/calibrate-user-mirror.jsonl',import.meta.url))?fs.readFileSync(new URL('../runtime/malice/calibrate-user-mirror.jsonl',import.meta.url),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[]).map(r=>[r.id,r.score]));
const subset=(need,have)=>{const h=[...have];return need.every(c=>{const i=h.indexOf(c);if(i<0)return false;h.splice(i,1);return true;});};
function guideFor(hand){
  const fits=ALL_ROUTES.filter(r=>subset(r.hand.filter(c=>c!==BLANK),hand)).map(r=>({r,s:cal.get(r.id)??0})).sort((a,b)=>b.s-a.s);
  return fits[0]?.r||null;
}
const out=new URL(`../runtime/malice/sample${opp?'-'+trapName:''}.jsonl`,import.meta.url);
const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l).i):[]);
for(const [i,hand] of hands.entries()){
  if(done.has(i))continue;
  const g0=guideFor(hand);
  const setup=async()=>({g:await startLab({hand,seed:123,oppHand:opp?[opp]:[]}),policy:opp?trapPolicy(opp,0):passPolicy});
  const r=await searchBest(setup,{ms:Number(sec)*1000,guide:g0?guideOf(g0):null});
  const row={i,hand,names:hand.map(c=>cardInfo(c).name),guide:g0?.id??null,opp:trapName||null,score:r.best?.score,lines:r.lines,trail:r.best?.trail};
  fs.appendFileSync(out,JSON.stringify(row)+'\n');
  console.log(`#${i} ${row.names.join('・')} | 案内 ${row.guide??'なし'} → ${r.best?.score.total}（${r.best?.score.field.join('・')}）`);
}
