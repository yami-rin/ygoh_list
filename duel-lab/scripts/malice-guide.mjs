// Readable step lists for the recommended first-turn routes → docs/malice/GUIDE.md (generated).
// Each stored step is replayed in the engine and turned into one line per action: what was summoned or activated,
// with the cards chosen for it (materials, targets, searched cards) folded into the same line.
import fs from 'node:fs';
import {startLab,summary} from './malice-lab.mjs';
import {score} from './malice-search.mjs';
import {cardInfo} from '../cards.mjs';

const RECOMMENDED=[
  ['malice-open-68337209-74652966','UNDERGROUND＋コード・オブ・ソウル'],
  ['malice-open-32061192-74652966','Dormouse＋コード・オブ・ソウル'],
  ['malice-open-68337209-30118811','UNDERGROUND＋バックアップ'],
  ['malice-open-32061192-30118811-2','Dormouse＋バックアップ'],
  ['user-replay-cEErE6ce','Dormouse 1枚'],
  ['user-replay-3tnYxZAt','UNDERGROUND 1枚'],
  ['malice-open-30118811','バックアップ 1枚'],
  ['malice-cat-hare-plus-2','Cat＋March Hare（R1b）'],
  ['malice-ns-codemagician-plus','NS＋コード・マジシャン（R3）'],
  ['malice-open-69272449-68337209','White Rabbit＋UNDERGROUND'],
  ['malice-open-32061192-20938824','Dormouse＋March Hare'],
  ['malice-open-68337209-96676583','UNDERGROUND＋Cat'],
  ['malice-open-32061192-96676583','Dormouse＋Cat'],
  ['malice-rabbit-plus-2','White Rabbit 1枚（HEARTS＋ファイアウォール）'],
  ['malice-open-69272449-20938824-2','White Rabbit＋March Hare'],
];
const all=[...JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes,
  ...JSON.parse(fs.readFileSync(new URL('../routes/malice-routes.json',import.meta.url))).routes];
const short=s=>s.replace(/M∀LICE＜.＞|M∀LICE /g,'').replace(/サイバース・|ファイアウォール・ドラゴン・ダークフルード－/g,'').replace(/＠イグニスター/g,'').replace(/ \/ .*$/,'');

function lines(route) {
  const out=[];let cur=null;
  const push=()=>{if(cur)out.push(cur.head+(cur.picks.length?`（${cur.picks.join('、')}）`:''));cur=null;};
  for(const s of route.steps){
    const l=s.label;
    if(s.prompt==='SELECT_IDLECMD'){
      push();
      const m=/^(召喚|特殊召喚|効果発動|発動|魔法・罠セット)：(.*)$/.exec(l);if(!m)continue;
      const verb=m[1]==='特殊召喚'?'リンク召喚/特殊召喚':m[1]==='効果発動'||m[1]==='発動'?'効果':m[1];
      cur={head:`${short(m[2])} ${verb}`,picks:[]};
    } else if(s.prompt==='SELECT_CHAIN'&&l.startsWith('発動：')){push();cur={head:`${short(l.slice(3))} 効果（チェーン）`,picks:[]};}
    else if(s.prompt==='SELECT_EFFECTYN'&&l==='はい'){push();cur={head:s.code?`${short(cardInfo(s.code).name)} 効果`:'誘発効果を発動',picks:[]};}
    else if((s.prompt==='SELECT_CARD'||s.prompt==='SELECT_UNSELECT_CARD')&&cur){
      if(/^(選択を確定|キャンセル)$/.test(l))continue;
      cur.picks.push(short(l.replace(/^選択：/,'')));
    }
  }
  push();
  return out.filter((x,i,a)=>!(x==='誘発効果を発動'&&a[i+1]==='誘発効果を発動'));
}

const md=['# 先攻展開の手順書（自動生成）','','`scripts/malice-guide.mjs` が保存ルートをエンジンで再生して作る。（）は選ぶカード（素材・対象・サーチ先など）。「〇〇 効果」には、発動の確認に「はい」と答える場面（M∀LICE③など）も含む。',
  '点は静的な見積もり、妨害は評価器（相手＝ユーザーのデッキ、200手順、[CALIBRATION-user-mirror.md](CALIBRATION-user-mirror.md)）。',''];
const cal=new Map((fs.existsSync(new URL('../runtime/malice/calibrate-user-mirror.jsonl',import.meta.url))?fs.readFileSync(new URL('../runtime/malice/calibrate-user-mirror.jsonl',import.meta.url),'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[]).map(r=>[r.id,r]));
// Worst-window results per route and hand trap (malice-report outputs).
const trapCells=['handtrap-results.json','handtraps-saved-results.json'].flatMap(f=>{const u=new URL('../docs/malice/'+f,import.meta.url);return fs.existsSync(u)?JSON.parse(fs.readFileSync(u,'utf8')).cells.filter(c=>!c.extra?.length):[];});
for(const [id,name] of RECOMMENDED){
  const r=all.find(x=>x.id===id);if(!r)continue;
  const g=await startLab({hand:r.hand,seed:r.seed});
  const steps=r.steps.map(s=>({...s}));
  for(const s of steps){if(s.prompt==='SELECT_EFFECTYN')s.code=g.pending?.code;g.respond(0^g.first,g.revision,s.input,{snapshot:false});while(g.pending&&(g.pending.player^g.first)===1){const p=g.prompt.choices.find(c=>c.label==='発動しない')||g.prompt.choices[0];g.respond(g.pending.player^g.first,g.revision,{action:p.id},{snapshot:false});}}
  const sc=score(g),sm=summary(g);g.close();
  const c=cal.get(id);
  md.push(`## ${name}`,'',`手札：${r.hand.filter(x=>x!==6325660).map(x=>cardInfo(x).name).join('・')}（残りは代役） / ルート \`${id}\``,'',
    `最終盤面：${sm.monsters.join('・')}${sm.spells.length?' ／ 伏せ '+sm.spells.join('・'):''} ／ LP ${sm.lp} ／ 点 ${sc.total.toFixed(2)}${c?` ／ 評価器の妨害 ${c.interruptions}`:''}`,'');
  lines({...r,steps}).forEach((l,i)=>md.push(`${i+1}. ${l}`));
  const cells=trapCells.filter(c=>c.routeId===id.replace('user-replay-',''));
  if(cells.length)md.push('',`誘発を最も痛い窓に受けた時の最善（他の手札は代役）：${cells.map(c=>`${c.trap} ${c.score.toFixed(2)}（${c.chain.at(-1)?.replace(/^自:/,'')||'チェーンなし'}）`).join('／')}`);
  md.push('');
}
fs.writeFileSync(new URL('../docs/malice/GUIDE.md',import.meta.url),md.join('\n')+'\n');
console.log(md.length,'行');
