// Audit the Code of Soul ③ term of the static score against the Link material rules:
// HEARTS = exactly 3 monsters incl. a M∀LICE (link sum 3), WHITE BINDER = 2+ incl. a M∀LICE with link sum 3,
// Firewall Dragon = 2+ monsters with link sum 4. Each material counts 1 or, if a Link Monster, its link rating.
// node scripts/malice-audit-soul.mjs → which saved routes / replays the loose rule ("2+ monsters") over-counts.
import fs from 'node:fs';
import {startLab,replaySteps,ALL_ROUTES} from './malice-lab.mjs';
import {score,soulTargets} from './malice-search.mjs';
import {cards} from '../cards.mjs';

const isLink=c=>!!(cards[c]?.type&0x4000000),isMalice=c=>!!cards[c]?.setcodes?.includes(441);
const rating=c=>isLink(c)?cards[c].level:1;

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const rows=[];
  for(const r of ALL_ROUTES){
    const g=await startLab({hand:r.hand,seed:r.seed});
    try{
      if(replaySteps(g,r).broken!==null)continue;
      const sc=score(g);if(!process.env.ALL&&!sc.parts.some(([k])=>k.startsWith('コード・オブ・ソウル')))continue;
      const s=g.snapshot(0).players[0];
      const field=s.monsters.filter(c=>c?.code).map(c=>c.code);
      const extra=new Set(s.extra.filter(c=>c?.code).map(c=>c.code));
      const body=sc.parts.some(([k,v])=>k==='GWC－06'&&v>0)?1:0;
      const t=soulTargets(field,body).filter(n=>extra.has({HEARTS:21848500,'WHITE BINDER':95454996,'ファイアウォール':5043010}[n]));
      rows.push({id:r.id,total:sc.total,targets:t});
      console.log(`${t.length?'○':'×'} ${r.id} ${sc.total} 召喚先:${t.join('・')||'なし'} 場:${field.map(c=>cards[c].name).join('・')}${body?'＋GWC':''}`);
    } finally {g.close();}
  }
  console.log(`ソウル③を数えた ${rows.length}本中、規則上リンク召喚できないもの ${rows.filter(r=>!r.targets.length).length}本`);
}
