// Compare interruption counts without / with the opponent's hand traps (scenario user-mirror vs user-mirror-traps).
// node scripts/malice-traps-compare.mjs → prints a markdown table (rows from runtime/malice/eval.jsonl and calibrate-user-mirror.jsonl)
import fs from 'node:fs';

const read=f=>fs.existsSync(new URL(`../runtime/malice/${f}`,import.meta.url))?fs.readFileSync(new URL(`../runtime/malice/${f}`,import.meta.url),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
const base=new Map(read('calibrate-user-mirror.jsonl').map(r=>[r.id,r]));
// Interruptions made by cards we only hold in hand (drawn or kept), not by the board we built.
const HAND=new Set(['無限泡影','霆王の閃光','霊王の波動','灰流うらら','ドロール＆ロックバード','増殖するG']);
const latest=new Map();
for(const r of read('eval.jsonl').filter(r=>r.scenario==='user-mirror-traps')){
  const k=`${r.id}|${r.maxLines}`;latest.set(k,r);
}
const ids=[...new Set([...latest.values()].map(r=>r.id))];
const cell=r=>r?`${r.interruptions}（盤面${r.breakdown.filter(b=>!HAND.has(b.card)).length}）`:'—';
console.log('| ルート | 誘発なし（200） | 誘発あり 200手順 | 誘発あり 600手順 | 誘発ありの中身（600があればそれ） |');
console.log('| --- | --- | --- | --- | --- |');
for(const id of ids){
  const a=latest.get(`${id}|200`),b=latest.get(`${id}|600`),r=b||a;
  console.log(`| ${id} | ${base.get(id)?.interruptions??'—'} | ${cell(a)} | ${cell(b)} | ${r.breakdown.map(x=>`${x.card}→${x.targets.join('・')}`).join(' / ')} |`);
}
