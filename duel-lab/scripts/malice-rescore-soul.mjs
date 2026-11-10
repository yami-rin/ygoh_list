// Re-score stored results after the Code of Soul ③ fix (malice-search.mjs soulTargets), without searching again.
// Every stored score {total, parts, field, sets} whose parts count Code of Soul ③ is checked against the field it records
// (plus a GWC－06 body when GWC was counted). The line itself stays valid, so the corrected value is a lower bound of the
// cell's best under the fixed score. Originals are copied to runtime/malice/stale-soul/. Idempotent (marks soulChecked).
// node scripts/malice-rescore-soul.mjs
import fs from 'node:fs';
import {soulTargets} from './malice-search.mjs';
import {cards} from '../cards.mjs';

const deck=JSON.parse(fs.readFileSync(new URL('../presets/user-malice.json',import.meta.url)));
const byName=new Map([...deck.main,...deck.extra,27204311].map(c=>[cards[c].name,c]));
byName.set('原始生命態トークン',27204312);
const dir=new URL('../runtime/malice/',import.meta.url),stale=new URL('stale-soul/',dir);
fs.mkdirSync(stale,{recursive:true});
let changed=0,checked=0;
function fix(sc){
  if(!sc||!Array.isArray(sc.parts)||!Array.isArray(sc.field)||sc.soulChecked)return;
  sc.soulChecked=true;
  const i=sc.parts.findIndex(([k])=>k==='コード・オブ・ソウル③');if(i<0)return;
  checked++;
  const field=sc.field.map(n=>byName.get(n)??0);
  const body=sc.parts.some(([k,v])=>k==='GWC－06'&&v>0)?1:0;
  const onField=new Set(sc.field);
  const t=soulTargets(field,body).filter(n=>!onField.has({HEARTS:'M∀LICE＜Q＞HEARTS OF CRYPTER','WHITE BINDER':'M∀LICE＜Q＞WHITE BINDER','ファイアウォール':'ファイアウォール・ドラゴン'}[n]));
  if(t.includes('HEARTS')||t.includes('ファイアウォール'))return;
  const v=t.includes('WHITE BINDER')?0.5:0;
  if(v)sc.parts[i]=['コード・オブ・ソウル③（BINDER）',0.5];else sc.parts.splice(i,1);
  sc.total=+(sc.total-1+v).toFixed(4);changed++;
}
const walk=o=>{if(Array.isArray(o))o.forEach(walk);else if(o&&typeof o==='object'){if('total' in o&&'parts' in o)fix(o);Object.values(o).forEach(walk);}};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl'))){
  const text=fs.readFileSync(new URL(f,dir),'utf8');
  if(!fs.existsSync(new URL(f,stale)))fs.writeFileSync(new URL(f,stale),text);
  const before=changed;
  const out=text.split('\n').map(l=>{if(!l.trim())return l;const o=JSON.parse(l);walk(o);return JSON.stringify(o);}).join('\n');
  if(changed>before){fs.writeFileSync(new URL(f,dir),out);console.log(`${f}: ${changed-before}件`);}
}
console.log(`ソウル③を数えていた ${checked} 件中 ${changed} 件を減点`);
