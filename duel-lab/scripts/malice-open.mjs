// Search an opening hand from scratch: node scripts/malice-open.mjs <codes,comma> [seconds=300] [guide replay id part] [opp hand trap] [window]
// Unnamed slots should be filled with 6325660 (霆王の閃光, the replays' stand-in card).
import {REPLAYS,startLab,passPolicy,trapPolicy} from './malice-lab.mjs';
import {searchBest} from './malice-search.mjs';
import {guideOf} from './malice-improve.mjs';
import {TRAPS} from './malice-traps.mjs';

export async function open(hand,{seconds=300,guide=null,trap=null,window=0,on=null,log=false}={}) {
  const setup=async()=>{
    const policy=trap?trapPolicy(trap,window,{on}):passPolicy;
    return {g:await startLab({hand,oppHand:trap?[trap]:[],seed:123}),policy};
  };
  return searchBest(setup,{ms:seconds*1000,guide,log});
}

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const [codes,sec='300',gid,trapArg,win,onArg]=process.argv.slice(2);
  const hand=codes.split(',').map(Number);
  const route=gid&&gid!=='-'?REPLAYS.find(r=>r.id.includes(gid)):null;
  const r=await open(hand,{seconds:Number(sec),guide:route?guideOf(route):null,trap:trapArg?TRAPS[trapArg]||Number(trapArg):null,window:Number(win||0),on:onArg?onArg.split(',').map(Number):null,log:true});
  console.log(JSON.stringify({hand,lines:r.lines,nodes:r.nodes,cut:r.cut,ms:r.ms,open:r.open,complete:r.complete,best:r.best&&{score:r.best.score,trail:r.best.trail}},null,1));
}
