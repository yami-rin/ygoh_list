// One (route, trap, window) cell with each candidate second card in hand.
// node scripts/malice-cell-extenders.mjs <route id> <trap> <window> [seconds=60] [extra codes,comma]
import {respond} from './malice-respond.mjs';
import {TRAPS} from './malice-traps.mjs';
import {cardInfo} from '../cards.mjs';

const [routeId,trapArg,win,sec='60',ext='30118811,20938824,96676583,69272449,64865,74652966']=process.argv.slice(2);
const trap=TRAPS[trapArg]||Number(trapArg);
for(const code of [0,...ext.split(',').map(Number)]){
  let r;
  try{r=await respond({routeId,trap,window:Number(win),seconds:Number(sec),extra:code?[code]:[]});}
  catch(e){console.log(`${code?cardInfo(code).name:'代役のみ'}: スキップ（${e.message}）`);continue;}
  const s=r.best?.score;
  console.log(`${code?cardInfo(code).name:'代役のみ'}: ${s?.total}（${s?.field.join('・')}${s?.sets.length?' 伏:'+s.sets.join('・'):''}）${r.complete?' 完走':''}`);
}
