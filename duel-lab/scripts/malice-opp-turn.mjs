// Show how the interruption evaluator used the board in the opponent's turn (our turn-2 decisions and what they hit).
// node scripts/malice-opp-turn.mjs <route id part> [maxLines=200] [scenario=user-mirror]
import fs from 'node:fs';
import {evaluateRoute} from './interruption-eval.mjs';

const all=[...JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes,
  ...JSON.parse(fs.readFileSync(new URL('../routes/malice-routes.json',import.meta.url))).routes];
const [part,max='200',scenario='user-mirror']=process.argv.slice(2);
const route=all.find(r=>r.id===part)||all.find(r=>r.id.includes(part));
const r=await evaluateRoute(route,{maxLines:Number(max),scenario});
console.log(`${route.title}（${scenario}）：妨害${r.interruptions}`);
for(const b of r.breakdown)console.log(`  ${b.card} → ${b.targets.join('・')}（${b.kinds.join('/')}）`);
console.log('相手ターンの自分の選択：');
for(const p of r.line.filter(p=>p.turn===2&&!/^発動しない$/.test(p.label)))console.log(`  ${p.prompt.replace('SELECT_','')} ${p.label}`);
