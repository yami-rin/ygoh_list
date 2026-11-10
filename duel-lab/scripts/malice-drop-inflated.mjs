// Remove result rows scored before the revival-limit fix (2026-11-10): GWC－06 counted 1.0 for a HEARTS OF CRYPTER that
// reached the GY without being Link Summoned (e.g. sent by Neo Tempest ②). Removed rows go to runtime/malice/inflated.jsonl;
// the resumable scripts then search those cells again with the corrected score.
// node scripts/malice-drop-inflated.mjs [--apply]  (also drops sample rows with i >= 40 from interrupted runs if given --from40 <file>)
import fs from 'node:fs';

const apply=process.argv.includes('--apply');
const dir='runtime/malice/';
let dropped=0;
for(const f of fs.readdirSync(dir).filter(f=>/\.jsonl$/.test(f)&&f!=='inflated.jsonl')){
  const lines=fs.readFileSync(dir+f,'utf8').split('\n').filter(Boolean);
  const keep=[],gone=[];
  for(const l of lines){
    const o=JSON.parse(l),parts=o.score?.parts||o.best?.parts;
    const gwc=parts?.find(p=>p[0]==='GWC－06');
    const linked=(o.trail||[]).some(t=>/特殊召喚：M∀LICE＜Q＞HEARTS/.test(t));
    (gwc&&gwc[1]===1&&!linked?gone:keep).push(l);
  }
  if(!gone.length)continue;
  dropped+=gone.length;
  console.log(`${f}: ${gone.length}行`);
  if(apply){fs.appendFileSync(dir+'inflated.jsonl',gone.map(l=>JSON.stringify({file:f,row:JSON.parse(l)})).join('\n')+'\n');fs.writeFileSync(dir+f,keep.join('\n')+(keep.length?'\n':''));}
}
console.log(`計${dropped}行${apply?'を退避':'（--apply で退避）'}`);
