// Best response after a hand trap: node scripts/malice-respond.mjs <replay id part> <trap passcode|name> <window> [seconds] [extra hand codes,comma]
// Replays the user's route with the opponent firing the trap at that window, then searches our best continuation
// from where the route breaks (malice-search.mjs). Extra hand codes replace stand-in (blank) cards to test extenders.
import fs from 'node:fs';
import {REPLAYS,startLab,replaySteps,trapPolicy,summary} from './malice-lab.mjs';
import {searchBest} from './malice-search.mjs';
import {TRAPS} from './malice-traps.mjs';

export async function respond({routeId,trap,window,seconds=60,extra=[],log=false,prefix}) {
  const route=REPLAYS.find(r=>r.id.includes(routeId));
  const hand=[...route.hand];
  for(const code of extra){const i=hand.indexOf(6325660);if(i>=0)hand[i]=code;else hand.push(code);}
  const r={...route,hand,steps:prefix===undefined?route.steps:route.steps.slice(0,prefix)};
  let broken=null,fired=null;
  const setup=async()=>{
    const g=await startLab({hand,oppHand:[trap],seed:route.seed});
    const policy=trapPolicy(trap,window);
    const res=replaySteps(g,r,policy);
    broken=res;fired=policy.state.firedAt;
    return {g,policy};
  };
  const result=await searchBest(setup,{ms:seconds*1000,log});
  return {route:route.title,hand,trap,window,fired,broken,...result};
}

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const [routeId,trapArg,win,sec,extraArg,prefixArg]=process.argv.slice(2);
  const trap=TRAPS[trapArg]||Number(trapArg);
  const out=await respond({routeId,trap,window:Number(win||0),seconds:Number(sec||60),extra:extraArg?extraArg.split(',').map(Number):[],log:true,prefix:prefixArg===undefined?undefined:Number(prefixArg)});
  console.log(JSON.stringify({...out,best:out.best&&{score:out.best.score,trail:out.best.trail}},null,1));
}
