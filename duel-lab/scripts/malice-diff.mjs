// Cause and effect of one card: compare two saved routes (same opening, with / without a card) step by step.
// node scripts/malice-diff.mjs <route id A (without)> <route id B (with)> [card name part]
// Prints the actions (summons and effect activations) of each line, where the card is used in B, and the final-board difference.
import {ALL_ROUTES,startLab,replaySteps} from './malice-lab.mjs';
import {score} from './malice-search.mjs';

const ACT=/^(SELECT_IDLECMD|SELECT_CHAIN)$/;
const short=s=>s.replace(/M∀LICE＜.＞|M∀LICE IN |サイバース・|＠イグニスター|ファイアウォール・ドラゴン・ダークフルード－|・トーカー|：効果 \d| \/ [^/]+$/g,'');
export function actions(route) {
  // One line per summon / activation; the card picks right after it are folded in.
  const out=[];
  for(const s of route.steps){
    if(s.label==='キャンセル'){if(out.length&&out.at(-1).cancel!==false)out.pop();continue;}
    if(ACT.test(s.prompt)&&s.label!=='発動しない'&&!/^魔法・罠セット/.test(s.label))out.push({act:short(s.label.replace(/^発動：|^効果発動：/,'')),picks:[]});
    else if(/^(SELECT_CARD|SELECT_UNSELECT_CARD)$/.test(s.prompt)&&out.length&&s.label!=='選択を確定')out.at(-1).picks.push(short(s.label.replace(/^選択：/,'')));
    else if(s.prompt==='SELECT_EFFECTYN'&&s.label==='はい'&&out.length)out.at(-1).picks.push('はい');
  }
  return out.map(a=>a.picks.length?`${a.act}（${a.picks.join('・')}）`:a.act);
}
export async function finalOf(route) {
  const g=await startLab({hand:route.hand,seed:route.seed});
  try{replaySteps(g,route);const s=score(g),b=g.snapshot(0).players[0];
    return {score:s,grave:b.grave.map(c=>c.code),banished:b.banished.map(c=>c.code)};}
  finally{g.close();}
}

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const [a,b,card]=process.argv.slice(2);
  const pick=x=>ALL_ROUTES.find(r=>r.id===x)||ALL_ROUTES.find(r=>r.id.includes(x));const A=pick(a),B=pick(b);
  const [fa,fb]=[await finalOf(A),await finalOf(B)];
  const la=actions(A),lb=actions(B);
  console.log(`A ${A.id}（${la.length}動作）: 場 ${fa.score.field.join('・')} 伏 ${fa.score.sets.join('・')} LP${fa.score.lp} 手${fa.score.hand} 点${fa.score.total.toFixed(2)} [${fa.score.parts.map(p=>p[0]).join('・')}]`);
  console.log(`B ${B.id}（${lb.length}動作）: 場 ${fb.score.field.join('・')} 伏 ${fb.score.sets.join('・')} LP${fb.score.lp} 手${fb.score.hand} 点${fb.score.total.toFixed(2)} [${fb.score.parts.map(p=>p[0]).join('・')}]`);
  console.log('--- A'),la.forEach((x,i)=>console.log(`${i+1}. ${x}`));
  console.log('--- B'),lb.forEach((x,i)=>console.log(`${i+1}. ${x}${card&&x.includes(card)?'   ←':''}`));
}
