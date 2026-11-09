// Hand-trap hit table for the user's replays: node scripts/malice-hits.mjs [trap passcode,...] [replay id substring]
// Writes runtime/malice/hits-<trap>.json and prints one line per window.
import fs from 'node:fs';
import {REPLAYS,hitTable} from './malice-lab.mjs';
import {cardInfo} from '../cards.mjs';

import {TRAPS} from './malice-traps.mjs';
const traps=(process.argv[2]||Object.values(TRAPS).join(',')).split(',').map(x=>TRAPS[x]||Number(x));
const only=process.argv[3];
fs.mkdirSync(new URL('../runtime/malice/',import.meta.url),{recursive:true});
for(const trap of traps){
  const out=[];
  for(const route of REPLAYS.filter(r=>!only||r.id.includes(only))){
    const t=await hitTable(route,trap);out.push(t);
    console.log(`\n## ${t.trap} × ${t.title}（窓${t.windows.length}、素通し：${t.baseline.broken===null?'完走':'崩れ'+t.baseline.broken}）`);
    for(const w of t.windows)console.log(`  窓${w.window} 手${w.step}/${w.steps} [${w.chain.join(' → ')}] → ${w.brokenAt===null?'完走':`手${w.brokenAt}で崩れ`} | 場:${w.board.monsters.join('・')} 伏:${w.board.spells.join('・')} 手:${w.board.hand.join('・')} LP${w.board.lp}`);
  }
  fs.writeFileSync(new URL(`../runtime/malice/hits-${trap}.json`,import.meta.url),JSON.stringify(out,null,1));
}
