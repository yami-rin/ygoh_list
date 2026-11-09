// Look for lines that beat the user's replays: node scripts/malice-improve.mjs <replay id part> [seconds=300] [maxDev]
// The replay is the guide (first line), then lines with 1, 2, ... deviations from it are searched (malice-search.mjs).
import {REPLAYS,startLab,passPolicy} from './malice-lab.mjs';
import {searchBest} from './malice-search.mjs';

// Stored replays contain Link Summon attempts that were cancelled; the search never cancels, so drop those pairs.
export function guideOf(route) {
  const out=[];
  for(const s of route.steps){if(s.label==='キャンセル'&&out.at(-1)?.prompt==='SELECT_IDLECMD'){out.pop();continue;}out.push({prompt:s.prompt,label:s.label});}
  return out;
}
export async function improve(route,{seconds=300,maxDev=Infinity,log=false,hand=route.hand}={}) {
  const setup=async()=>({g:await startLab({hand,seed:route.seed}),policy:passPolicy});
  return searchBest(setup,{ms:seconds*1000,guide:guideOf(route),maxDev,log});
}

if(import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const [id,sec='300',dev]=process.argv.slice(2);
  const route=REPLAYS.find(r=>r.id.includes(id));
  const r=await improve(route,{seconds:Number(sec),maxDev:dev===undefined?Infinity:Number(dev),log:true});
  console.log(JSON.stringify({route:route.title,lines:r.lines,nodes:r.nodes,cut:r.cut,ms:r.ms,open:r.open,best:r.best&&{score:r.best.score,trail:r.best.trail}},null,1));
}
