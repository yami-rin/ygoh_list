// M∀LICE lab: replay routes of the user's deck while the opponent holds hand traps (docs/malice/).
// - startLab: duel with our fixed hand and an opponent hand (any passcodes, e.g. hand traps).
// - replaySteps: replay a stored route (routes/user-replays.json) by label, letting the opponent act by policy.
// - windows/hitTable: every point where the opponent could fire a hand trap, and where the route breaks if fired.
// - play: continue with a plan written as option labels (partial match), for response lines.
import fs from 'node:fs';
import {Duel} from '../engine.mjs';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {board,hash} from './route-harness.mjs';
import {cardInfo} from '../cards.mjs';

export const USER_DECK=JSON.parse(fs.readFileSync(new URL('../presets/user-malice.json',import.meta.url)));
export const REPLAYS=JSON.parse(fs.readFileSync(new URL('../routes/user-replays.json',import.meta.url))).routes;
const name=code=>cardInfo(code).name;
const mine=g=>g.pending&&(g.pending.player^g.first)===0;

export async function startLab({hand,oppHand=[],seed=123,deck=USER_DECK}) {
  const own={main:[...deck.main],extra:[...deck.extra]};
  for(const code of hand){const i=own.main.indexOf(code);if(i<0)throw new Error(`手札 ${name(code)} がデッキにない`);own.main.splice(i,1);}
  const g=await Duel.create([own,{main:[...deck.main],extra:[...deck.extra]}],{seed,fixtures:[
    ...hand.map(code=>({code,team:0,controller:0,location:2,position:8})),
    ...oppHand.map(code=>({code,team:1,controller:1,location:2,position:8}))]});
  trackChain(g);
  g.trail=[];g.startHand=[...hand];
  return g;
}

// Chain links currently on the stack (UI player numbers), for describing a hand-trap window.
function trackChain(g) {
  const record=g.record.bind(g);g.stack=[];
  g.record=m=>{
    if(m.type===M.CHAINING)g.stack[m.chain_size-1]={code:m.code,player:m.controller^g.first};
    else if(m.type===M.CHAIN_END)g.stack=[];
    record(m);
  };
}

function send(g,input,label) {
  const who=mine(g)?0:1;
  g.trail.push({who,prompt:g.prompt.type,label});
  g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});
  if(g.validationError)throw new Error(`エンジンが拒否：${label}（${g.validationError}）`);
}
const pass=p=>p.choices.find(c=>c.response?.index===null&&c.label==='発動しない');

// Opponent policy: fire `trap` at its `at`-th legal window (0-based); otherwise pass. Targets: the newest own chain link
// card if offered, else `prefer` codes, else the first card.
export function trapPolicy(trap,at,{prefer=[]}={}) {
  const st={seen:-1,fired:false,windows:[]};
  const fn=g=>{
    const p=g.prompt;
    if(p.type==='SELECT_CHAIN'){
      const c=p.choices.find(c=>c.card?.code===trap);
      if(c&&!st.fired){
        st.seen++;st.windows.push({index:st.seen,chain:g.stack.filter(Boolean).map(l=>`${l.player?'相':'自'}:${name(l.code)}`),last:lastEvent(g),step:g.stepIndex});
        if(st.seen===at){st.fired=true;st.firedAt={...st.windows.at(-1)};return {action:c.id,label:c.label};}
      }
      const x=pass(p);return {action:x.id,label:x.label};
    }
    if(['SELECT_EFFECTYN','SELECT_YESNO'].includes(p.type)){const x=p.choices.find(c=>c.label==='いいえ')||p.choices[0];return {action:x.id,label:x.label};}
    if(p.mode==='single'){const x=p.choices[0];return {action:x.id,label:x.label};}
    if(p.mode==='multi'){
      const top=[...g.stack].reverse().find(l=>l&&l.player===0)?.code;
      let i=p.cards.findIndex(c=>c.code===top&&c.controller===0);
      if(i<0)i=p.cards.findIndex(c=>prefer.includes(c.code));
      if(i<0)i=0;
      const sel=[i,...[...Array(p.cards.length).keys()].filter(k=>k!==i)].slice(0,Math.max(p.min||1,1));
      return {selection:sel,label:sel.map(k=>p.cards[k].label).join(' / ')};
    }
    if(p.mode==='order')return {selection:p.cards.map((_,i)=>i),label:'順番'};
    throw new Error(`相手の未対応の選択 ${p.type}`);
  };
  fn.state=st;return fn;
}
export const passPolicy=trapPolicy(-1,-1);

function lastEvent(g){return g.log.slice(-3).map(e=>e.text).join(' / ');}
function drain(g,policy) {
  for(let i=0;i<200&&g.pending&&g.status==='playing'&&!mine(g);i++){const {label,...input}=policy(g);send(g,input,label);}
}

// Match a stored step against the current prompt by label (indices shift when the opponent holds cards).
function matchStep(p,step) {
  if(p.type!==step.prompt)return null;
  if(p.mode==='single'){const c=p.choices.find(c=>c.label===step.label);return c?{action:c.id}:null;}
  if(p.type==='SELECT_PLACE'||p.type==='SELECT_DISFIELD')return step.input;
  const want=step.label.split(' / '),used=new Set(),sel=[];
  for(const w of want){const i=(p.cards||[]).findIndex((c,k)=>!used.has(k)&&c.label===w);if(i<0)return null;used.add(i);sel.push(i);}
  return {selection:sel};
}

// Replay the route's steps. Our extra chain windows (created by the opponent's chain) are passed.
export function replaySteps(g,route,policy=passPolicy) {
  for(let s=0;s<route.steps.length;s++){
    g.stepIndex=s;
    drain(g,policy);
    if(g.status!=='playing'||!g.pending)return {broken:s,reason:'対戦終了'};
    const step=route.steps[s];
    let input=matchStep(g.prompt,step);
    for(let k=0;!input&&k<5&&g.prompt.type==='SELECT_CHAIN'&&step.prompt!=='SELECT_CHAIN';k++){
      const x=pass(g.prompt);if(!x)break;send(g,{action:x.id},x.label);drain(g,policy);input=g.pending&&mine(g)?matchStep(g.prompt,step):null;
    }
    if(!input)return {broken:s,reason:`「${step.label}」（${step.prompt}）が選べない。今の選択：${g.prompt?.type} ${(g.prompt?.choices||[]).map(c=>c.label).slice(0,8).join(' | ')}`};
    try{send(g,input,step.label);}catch(e){return {broken:s,reason:e.message};}
  }
  drain(g,policy);
  return {broken:null};
}

// Plan entries: 'label text' (partial match on single-choice prompts), {select:['name',...]} for card picks,
// {pass:true} to decline a chain window. Our SELECT_CHAIN windows that the plan does not mention are passed;
// zone/position prompts that the plan does not mention take the first option.
export function play(g,plan,policy=passPolicy) {
  for(let k=0;k<plan.length;k++){
    drain(g,policy);
    if(!g.pending||g.status!=='playing')throw new Error(`計画の${k}手目「${JSON.stringify(plan[k])}」の前に対戦終了`);
    const p=g.prompt,item=plan[k];
    const auto=()=>{ // a prompt the plan does not cover
      if(p.type==='SELECT_CHAIN'&&pass(p)){const x=pass(p);send(g,{action:x.id},x.label);return true;}
      if(p.type==='SELECT_PLACE'||p.type==='SELECT_DISFIELD'){send(g,{selection:[0]},'最初のゾーン');return true;}
      if(p.type==='SELECT_POSITION'){const x=p.choices[0];send(g,{action:x.id},x.label);return true;}
      return false;
    };
    if(typeof item==='string'||item.option!==undefined){
      const text=typeof item==='string'?item:item.option;
      if(p.mode!=='single'){if(auto()){k--;continue;}throw new Error(`計画の${k}手目「${text}」：今はカード選択（${p.type}）：${(p.cards||[]).map(c=>c.label).join(' | ')}`);}
      const exact=p.choices.filter(c=>c.label===text),hits=exact.length?exact:p.choices.filter(c=>c.label.includes(text));
      if(hits.length!==1){if(!hits.length&&auto()){k--;continue;}throw new Error(`計画の${k}手目「${text}」が${hits.length?'複数に':''}一致しない（${p.type}）：${p.choices.map(c=>c.label).join(' | ')}`);}
      send(g,{action:hits[0].id},hits[0].label);
    } else if(item.pass){const x=pass(p);if(!x)throw new Error(`計画の${k}手目：パスできない ${p.type}`);send(g,{action:x.id},x.label);}
    else if(item.select){
      if(p.mode==='single'){if(auto()){k--;continue;}throw new Error(`計画の${k}手目 select：今は1つ選ぶ選択（${p.type}）：${p.choices.map(c=>c.label).join(' | ')}`);}
      const used=new Set(),sel=item.select.map(v=>{
        const i=typeof v==='number'?v:p.cards.findIndex((c,j)=>!used.has(j)&&(c.label===v||c.label.includes(v)));
        if(i<0||!p.cards[i])throw new Error(`計画の${k}手目「${v}」が候補にない：${p.cards.map(c=>c.label).join(' | ')}`);used.add(i);return i;});
      send(g,{selection:sel},sel.map(i=>p.cards[i].label).join(' / '));
    } else throw new Error(`計画の${k}手目の形式が不明`);
  }
  drain(g,policy);
}

// Every window where the opponent could fire `trap` along the route, and what happens if it fires there.
export async function hitTable(route,trap,{seed=route.seed,extraOpp=[]}={}) {
  const probe=await startLab({hand:route.hand,oppHand:[trap,...extraOpp],seed});
  const pol=trapPolicy(trap,-1);
  let base;try{base=replaySteps(probe,route,pol);}finally{probe.close();}
  const rows=[];
  for(const w of pol.state.windows){
    const g=await startLab({hand:route.hand,oppHand:[trap,...extraOpp],seed});
    const fire=trapPolicy(trap,w.index);
    try{
      const r=replaySteps(g,route,fire);
      rows.push({window:w.index,step:w.step,chain:w.chain,last:w.last,brokenAt:r.broken,reason:r.reason,steps:route.steps.length,
        board:summary(g)});
    } finally {g.close();}
  }
  return {route:route.id,title:route.title,trap:name(trap),baseline:base,windows:rows};
}

// Compact board summary from our side.
export function summary(g) {
  const s=g.snapshot(0),me=s.players[0],op=s.players[1];
  const list=z=>z.filter(Boolean).map(c=>c.code?name(c.code)+(c.position&8&&c.location!==2?'(伏)':''):'裏');
  return {lp:me.lp,monsters:list(me.monsters),spells:list(me.spells),hand:list(me.hand),grave:list(me.grave),banished:list(me.banished),
    opp:{hand:list(op.hand),monsters:list(op.monsters),spells:list(op.spells),grave:list(op.grave)}};
}
export {board,hash};
