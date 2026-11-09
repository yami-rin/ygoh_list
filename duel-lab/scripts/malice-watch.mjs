// Progress watcher for long M∀LICE jobs (prints one line per change; exits when none run).
// node scripts/malice-watch.mjs
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const files=()=>fs.readdirSync('runtime/malice').filter(f=>/\.jsonl$/.test(f));
const count=f=>fs.readFileSync(`runtime/malice/${f}`,'utf8').split('\n').filter(Boolean).length;
const jobs=()=>execFileSync('powershell',['-NoProfile','-Command',"(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'malice-(extenders|catalog|batch|improve|open)' -and $_.CommandLine -notmatch 'malice-watch' }).Count"],{encoding:'utf8'}).trim();
const seen=new Map(files().map(f=>[f,count(f)]));
let last='';
for(;;){
  const j=jobs();
  if(j!==last){console.log(`実行中のジョブ ${j}（${new Date().toTimeString().slice(0,5)}）`);last=j;}
  const cat=count('catalog.jsonl');
  if(cat!==seen.get('catalog.jsonl')){const r=JSON.parse(fs.readFileSync('runtime/malice/catalog.jsonl','utf8').trim().split('\n').at(-1));console.log(`カタログ ${r.names.join('＋')}: ${r.score?.total} ${r.score?.field.join('・')}`);seen.set('catalog.jsonl',cat);}
  for(const f of files().filter(f=>!seen.has(f))){console.log(`新しい結果ファイル ${f}`);seen.set(f,count(f));}
  if(j==='0'||j==='')break;
  await new Promise(r=>setTimeout(r,60000));
}
