// Best continuation search for the user's M∀LICE deck (docs/malice/HANDTRAPS.md).
// From a start position (e.g. a route broken by a hand trap), search our choices depth-first in the real core and keep
// the end-of-turn board with the highest static interruption estimate (`score`). Branches are cut only by
// - prune-rules.mjs (unselect, dead sets) and the rules below (no sets, no own hand traps on our own turn),
// - copies of the same card in one location counted once,
// - zone choices grouped by link relations (which own Link Monsters point at the zone / which the placed Link points at),
// - transposition: the same board, prompt and set of effects used this turn is searched once.
// The score is an estimate; the best lines are rechecked with interruption-eval.mjs.
import {board,hash} from './route-harness.mjs';
import {cards,cardInfo} from '../cards.mjs';
import {TARGET_RULES,pointless} from './prune-rules.mjs';

const C={neo:64211118,accord:39138610,hearts:21848500,binder:95454996,disablem:92422871,soul:74652966,ringo:24842059,firewall:5043010,
  access:86066372,knight:29301450,mtp:94722358,gwc:20726052,tb:57111661,transcode:46947713,imperm:10045474,ash:14558127,droll:94145021,
  maxx:23434538,purge:40366667,spark:6325660,attractor:91800273};
const MALICE=441;
const isMalice=code=>!!cards[code]?.setcodes?.includes(MALICE);
const isLink=code=>!!(cards[code]?.type&0x4000000);
const OWN_HAND_TRAPS=new Set([C.ash,C.droll,C.maxx,C.purge,C.spark,C.imperm,C.attractor]);
const name=code=>cardInfo(code).name;
const mine=g=>g.pending&&(g.pending.player^g.first)===0;

// Link geometry. Monster zone sequences 0-4 (main), 5/6 (Extra Monster Zone above main 1/3).
const ARROWS=[[0x1,-1,1],[0x2,0,1],[0x4,1,1],[0x8,-1,0],[0x20,1,0],[0x40,-1,-1],[0x80,0,-1],[0x100,1,-1]];
const col=seq=>seq===5?1:seq===6?3:seq,row=seq=>seq>=5?0:1;
const at=(c,r)=>r===1&&c>=0&&c<=4?c:r===0&&c===1?5:r===0&&c===3?6:-1;
export function pointsTo(code,seq) {
  const m=cards[code]?.link_marker||0;
  return ARROWS.filter(([bit])=>m&bit).map(([,dc,dr])=>at(col(seq)+dc,row(seq)+dr)).filter(z=>z>=0);
}

// Static estimate of interruptions available in the opponent's next turn, plus small tiebreaks.
export function score(g) {
  const s=g.snapshot(0),me=s.players[0];
  const mons=me.monsters.map((c,seq)=>c?.code?{code:c.code,seq,up:!(c.position&8)}:null).filter(Boolean);
  const has=code=>mons.some(m=>m.code===code);
  const inExtra=code=>me.extra.some(c=>c?.code===code);
  const grave=me.grave.map(c=>c.code),banished=me.banished.map(c=>c.code),hand=me.hand.map(c=>c.code);
  const sets=me.spells.filter(c=>c?.code&&(c.position&8)).map(c=>c.code);
    const parts=[];
  if(has(C.neo)&&inExtra(C.disablem))parts.push(['ネオテン②→ディセーブルム',1]);
  const gwcBody=sets.includes(C.gwc)&&grave.concat(banished).some(isMalice)?1:0;
  if(grave.includes(C.soul)&&mons.length+gwcBody>=2&&(inExtra(C.hearts)||inExtra(C.firewall)))parts.push(['コード・オブ・ソウル③',1]);
  else if(has(C.neo)&&!inExtra(C.disablem)&&!grave.includes(C.soul))parts.push(['ネオテン②→ソウル',0.5]);
  const accord=mons.find(m=>m.code===C.accord);
  if(accord&&pointsTo(C.accord,accord.seq).some(z=>mons.some(m=>m.seq===z&&isLink(m.code))))parts.push(['アコード②',1]);
  if(has(C.hearts)&&banished.some(isMalice))parts.push(['HEARTS①',1]);
  const maliceLink=mons.some(m=>m.up&&isMalice(m.code)&&isLink(m.code));
  // Traps set this turn are activated normally in the opponent's turn (no banish cost needed).
  if(sets.includes(C.mtp))parts.push(['MTP－07',maliceLink?1:0.3]);
  if(sets.includes(C.gwc))parts.push(['GWC－06',(grave.includes(C.hearts)||banished.includes(C.hearts))?1:grave.concat(banished).some(isMalice)?0.3:0]);
  if(sets.includes(C.tb))parts.push(['TB－11',0.3]);
  if(has(C.ringo))parts.push(['リングリボー①',0.5]);
  const fw=mons.find(m=>m.code===C.firewall);
  if(fw&&pointsTo(C.firewall,fw.seq).some(z=>{const o=mons.find(m=>m.seq===z);return o&&isLink(o.code)&&pointsTo(o.code,o.seq).includes(fw.seq);}))parts.push(['ファイアウォール①',1]);
  // Access Code Talker ② is an ignition effect (our Main Phase only): not an interruption.
  if(has(C.knight))parts.push(['S:Pリトルナイト②',1]);
  const freeST=me.spells.slice(0,5).filter(c=>!c).length;
  // Drawn cards depend on the deck order (seed): count them generically, not by identity.
  const start=[...(g.startHand||hand)];
  for(const code of hand){
    const k=start.indexOf(code);
    if(k<0){parts.push(['ドロー分',0.3]);continue;}
    start.splice(k,1);
    if(code===C.ash)parts.push(['うらら',0.8]);
    else if(code===C.imperm&&freeST)parts.push(['泡影（伏せ）',1]);
    else if(code===C.purge)parts.push(['霊王',0.8]);
    else if(code===C.droll||code===C.maxx)parts.push([name(code),0.3]);
  }
  const total=parts.reduce((n,[,v])=>n+v,0);
  return {total:+(total+me.lp/1e6+hand.length/1e3).toFixed(4),parts,lp:me.lp,hand:hand.length,
    field:mons.map(m=>name(m.code)),sets:sets.map(name)};
}

function zoneGroups(g,p,prefer=-1) {
  const s=g.snapshot(0),mons=s.players[0].monsters.map((c,seq)=>c?.code?{code:c.code,seq}:null).filter(Boolean);
  const placing=g.placing&&isLink(g.placing)?g.placing:null;
  const seen=new Map();
  p.cards.forEach((c,i)=>{
    const pl=c.place;if(!pl||pl.player!==0||pl.location!==4){if(!seen.has('other:'+i))seen.set('other:'+i,i);return;}
    const by=mons.filter(m=>isLink(m.code)&&pointsTo(m.code,m.seq).includes(pl.sequence)).map(m=>m.code).sort();
    const to=placing?mons.filter(m=>pointsTo(placing,pl.sequence).includes(m.seq)).map(m=>m.code).sort():[];
    const key=JSON.stringify([by,to,pl.sequence>=5]);
    if(!seen.has(key)||i===prefer)seen.set(key,i);
  });
  return [...seen.values()].map(i=>({selection:[i]}));
}

function optionLabel(p,o){return o.action!==undefined?p.choices.find(c=>c.id===o.action)?.label:(o.selection||[]).map(i=>p.cards?.[i]?.label).join(' / ');}
// The guide (a stored route) is tried first: the first of its next GUIDE_AHEAD steps that matches an option goes to the
// front. Looking ahead lets a guide from a similar opening (other first card) still steer the rest of the line.
const GUIDE_AHEAD=8,GENERIC=new Set(['SELECT_PLACE','SELECT_DISFIELD','SELECT_POSITION','SELECT_EFFECTYN','SELECT_YESNO','SELECT_OPTION']);
function guideStep(g,labels) {
  if(!g.guide||g.guideAt<0)return -1;
  // Zone, position and yes/no labels are too generic to skip ahead for: they match only the very next step.
  const ahead=GENERIC.has(g.prompt.type)?1:GUIDE_AHEAD;
  for(let j=g.guideAt;j<Math.min(g.guide.length,g.guideAt+ahead);j++){
    const st=g.guide[j];if(st.prompt===g.prompt.type&&labels.includes(st.label))return j;
  }
  return -1;
}
function options(g) {
  const list=rawOptions(g);
  const j=guideStep(g,list.map(o=>optionLabel(g.prompt,o)));
  if(j<0)return list;
  const i=list.findIndex(o=>optionLabel(g.prompt,o)===g.guide[j].label);
  if(i>0)list.unshift(...list.splice(i,1));
  return list;
}
function rawOptions(g) {
  const p=g.prompt;
  if(p.type==='SELECT_IDLECMD')return p.choices.filter(c=>!/ターンを終了|バトルフェイズへ|^モンスターセット|^魔法・罠セット|表示形式/.test(c.label)
    &&!pointless(p,{action:c.id})).map(c=>({action:c.id,code:c.card?.code,label:c.label}));
  if(p.type==='SELECT_BATTLECMD')return [];
  if(p.type==='SELECT_CHAIN'){
    const oppOnChain=g.stack?.some(l=>l&&l.player===1);
    return p.choices.filter(c=>!(c.card&&OWN_HAND_TRAPS.has(c.card.code)&&c.card.location===2&&!oppOnChain)).map(c=>({action:c.id,code:c.card?.code}));
  }
  // Cancelling a Link Summon only returns to the same idle state.
  if(p.type==='SELECT_UNSELECT_CARD')return p.choices.filter(c=>!pointless(p,{action:c.id})&&!(c.label==='キャンセル'&&p.choices.length>1)).map(c=>({action:c.id}));
  if(['SELECT_EFFECTYN','SELECT_YESNO','SELECT_OPTION'].includes(p.type))return p.choices.map(c=>({action:c.id}));
  if(p.type==='SELECT_PLACE'||p.type==='SELECT_DISFIELD'){const j=guideStep(g,p.cards.map(c=>c.label));return zoneGroups(g,p,j<0?-1:p.cards.findIndex(c=>c.label===g.guide[j].label));}
  if(p.mode==='single')return p.choices.slice(0,1).map(c=>({action:c.id}));
  if(p.mode==='order')return [{selection:p.cards.map((_,i)=>i)}];
  if(p.mode==='counter')return [{counters:p.cards.map((_,i)=>i===0?p.count:0)}];
  if(p.mode==='multi'){
    const rule=TARGET_RULES[g.activating];
    const seen=new Set(),idx=[];
    p.cards.forEach((c,i)=>{
      if(rule&&!rule.allow(c,p))return;
      const key=[1,2,16,64].includes(c.location)?`${c.controller}:${c.location}:${c.code}`:`i${i}`;
      if(seen.has(key))return;seen.add(key);idx.push(i);
    });
    const lo=Math.max(p.min||1,1),hi=Math.min(p.max||lo,3),out=[];
    const rec=(start,cur)=>{if(cur.length>=lo)out.push([...cur]);if(cur.length>=hi||out.length>=60)return;for(let k=start;k<idx.length;k++){cur.push(idx[k]);rec(k+1,cur);cur.pop();}};
    rec(0,[]);
    return out.map(selection=>({selection}));
  }
  return [];
}

function apply(g,input,policy) {
  const p=g.prompt,c=p.choices?.find(c=>c.id===input.action);
  if(c?.card&&['SELECT_CHAIN','SELECT_IDLECMD'].includes(p.type))g.activating=c.card.code;
  else if(p.type==='SELECT_EFFECTYN'&&g.pending.code)g.activating=g.pending.code;
  if(p.type==='SELECT_IDLECMD'&&c?.card&&/特殊召喚|召喚/.test(c.label))g.placing=c.card.code;
  const label=c?.label||(input.selection||[]).map(i=>p.cards?.[i]?.label).join(' / ');
  {const j=guideStep(g,[label]);if(j>=0)g.guideAt=j+1;}
  g.trail.push({who:0,prompt:p.type,label});
  const {code,label:_,...raw}=input;
  g.respond(0^g.first,g.revision,raw,{snapshot:false});
  if(g.validationError)return false;
  for(let i=0;i<200&&g.pending&&g.status==='playing'&&!mine(g);i++){
    const {label:l,...r}=policy(g);g.trail.push({who:1,prompt:g.prompt.type,label:l});g.respond(g.pending.player^g.first,g.revision,r,{snapshot:false});
  }
  return true;
}

// setup(): async () => {g, policy} at our decision. Returns the best line found within the budget.
export async function searchBest(setup,{ms=60000,maxLines=50000,log=false,guide=null,maxDev=Infinity}={}) {
  const started=Date.now(),seen=new Set();
  let best=null,lines=0,nodes=0,cut=0,invalid=0;
  // Limited discrepancy order: lines with fewer non-first choices (deviations from the guide/heuristic order) first.
  const levels=[[{path:[],dev:0}]];
  const pending=()=>levels.reduce((n,l)=>n+(l?l.length:0),0);
  while(pending()&&Date.now()-started<ms&&lines<maxLines){
    const {path,dev}=levels.find(l=>l&&l.length).pop();
    const {g,policy}=await setup();
    try{
      g.trail=[];g.activating=null;g.placing=null;g.guide=guide;g.guideAt=guide?0:-1;
      let ok=true;
      for(const input of path){if(!g.pending||!mine(g)){ok=false;break;}if(!apply(g,input,policy)){ok=false;break;}}
      if(!ok){invalid++;continue;}
      const taken=[...path];
      for(let guard=0;guard<600;guard++){
        if(!g.pending||g.status!=='playing'||!mine(g)||g.turn>1){break;}
        if(g.prompt.type==='SELECT_IDLECMD'){
          const sc=score(g);
          if(!best||sc.total>best.score.total){best={score:sc,path:[...taken],trail:g.trail.map(t=>`${t.who?'相':'自'} ${t.prompt} ${t.label}`)};if(log)console.error(`best ${sc.total} ${sc.parts.map(p=>p[0]).join('・')} @${Date.now()-started}ms`);}
        }
        const opts=options(g);
        if(!opts.length)break;
        if(opts.length>1){
          nodes++;
          const s=g.snapshot(0);
          const used=g.log.filter(e=>e.event==='chain'&&e.turn===g.turn).map(e=>e.code).sort();
          const key=hash({b:board(g),t:g.prompt.type,c:g.prompt.choices?.map(c=>c.label),k:g.prompt.cards?.map(c=>c.label),used,act:g.activating});
          if(seen.has(key)){cut++;break;}
          seen.add(key);
          if(dev<maxDev)for(let i=opts.length-1;i>=1;i--)(levels[dev+1]??=[]).push({path:[...taken,opts[i]],dev:dev+1});
        }
        const input=opts[0];
        if(!apply(g,input,policy)){invalid++;break;}
        taken.push(input);
      }
      lines++;
    } finally {g.close();}
  }
  return {best,lines,nodes,cut,invalid,complete:pending()===0&&maxDev===Infinity,ms:Date.now()-started,open:pending()};
}
export {C};
