// Second-card batches: for each extender, the worst window per (replay, trap) from the blank batch, with that card
// replacing one stand-in. node scripts/malice-extenders.mjs [seconds=60] [traps] [extenders]
import {spawnSync} from 'node:child_process';

const [sec='60',traps='ash,imperm,droll,purge,nibiru',ext='20938824,30118811,68337209,96676583,69272449,64865,74652966']=process.argv.slice(2);
for(const code of ext.split(',')){
  const r=spawnSync(process.execPath,['scripts/malice-batch.mjs',`runtime/malice/batch-x${code}.jsonl`,sec,traps,code],
    {stdio:['ignore','inherit','inherit'],env:{...process.env,WORST_FROM:'runtime/malice/batch-blank.jsonl'}});
  if(r.status)process.exit(r.status);
}
