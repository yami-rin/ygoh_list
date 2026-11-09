// Try a response line: node scripts/malice-try.mjs <file.json>
// file: {route:'replay id part', trap:passcode, window:n, prefix:n (route steps to keep, default = until the break),
//        hand:[codes] (instead of route), oppHand:[codes], plan:[...malice-lab play() entries]}
// Prints where the plan stops, the board, and the prompt waiting at the end.
import fs from 'node:fs';
import {REPLAYS,startLab,replaySteps,trapPolicy,passPolicy,play,summary} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const route=spec.route?REPLAYS.find(r=>r.id.includes(spec.route)):null;
const oppHand=spec.oppHand??(spec.trap?[spec.trap]:[]);
const g=await startLab({hand:spec.hand??route.hand,oppHand,seed:spec.seed??route?.seed??123});
const policy=spec.trap?trapPolicy(spec.trap,spec.window??0):passPolicy;
let result={};
try{
  if(route){
    const r=spec.prefix!==undefined?{...route,steps:route.steps.slice(0,spec.prefix)}:route;
    result.replay=replaySteps(g,r,policy);
  }
  if(spec.plan){try{play(g,spec.plan,policy);result.plan='完了';}catch(e){result.plan=e.message;}}
  result.fired=policy.state?.firedAt;
  result.board=summary(g);
  const sc=score(g);result.score={total:sc.total,parts:sc.parts.map(p=>p.join(':'))};
  result.prompt=g.pending?{who:(g.pending.player^g.first)?'相手':'自分',type:g.prompt.type,choices:g.prompt.choices.map(c=>c.label),cards:(g.prompt.cards||[]).map(c=>c.label)}:g.status;
  result.trail=g.trail.slice(-(spec.tail??12)).map(t=>`${t.who?'相':'自'} ${t.prompt} ${t.label}`);
  console.log(JSON.stringify(result,null,1));
} finally {g.close();}
