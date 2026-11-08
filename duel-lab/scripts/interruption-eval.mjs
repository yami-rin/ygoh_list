// Interruption evaluator: replay a saved first-turn route, play a scripted opponent turn in the real core,
// and search our responses for the largest number of resolved interferences (docs/INTERRUPTION_EVAL.md).
import assert from 'node:assert/strict';
import {OcgMessageType as M,OcgQueryFlags as Q} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {preset,board,hash} from './route-harness.mjs';
import {cardInfo} from '../cards.mjs';
import {TARGET_RULES,pointless} from './prune-rules.mjs';
export {TARGET_RULES};

const STATUS_DISABLED=0x1;
const FIELD=new Set([4,8]);
const own=b=>b.players[0];

// Opponent scenario: fixed hand taken from the preset, remaining deck in preset order.
export const SCENARIOS={
  'malice-mirror':{label:'相手もM∀LICE（UNDERGROUND・バックアップ・Rabbit・Cat・テラ・フォーミング）',
    hand:[68337209,30118811,69272449,96676583,73628505]},
};

function take(list,codes,what) {
  const left=[...list];
  for(const code of codes){const i=left.indexOf(code);assert(i>=0,`${what} must be taken from preset: ${code}`);left.splice(i,1);}
  return left;
}

async function startScenario(route,scenario) {
  const mine=structuredClone(preset),theirs=structuredClone(preset);
  mine.main=take(mine.main,route.hand,'Hand');
  if(route.deckOrder){assert.deepEqual([...route.deckOrder].sort((a,b)=>a-b),[...mine.main].sort((a,b)=>a-b));mine.main=[...route.deckOrder];}
  theirs.main=take(theirs.main,scenario.hand,'Opponent hand');
  const fixtures=[...route.hand.map(code=>({code,team:0,controller:0,location:2,position:8})),
    ...scenario.hand.map(code=>({code,team:1,controller:1,location:2,position:8}))];
  const g=await Duel.create([mine,theirs],{seed:route.seed,fixtures});
  watch(g);
  return g;
}

// Attribute card moves, chain negations and effect disabling to the chain link that was resolving.
function watch(g) {
  const record=g.record.bind(g);
  g.stack=[];g.solving=null;g.events=[];g.links=0;g.mark=0;
  g.record=m=>{
    if(m.type===M.CHAINING)g.stack[m.chain_size-1]={code:m.code,player:m.controller^g.first,turn:g.turn};
    else if(m.type===M.CHAIN_SOLVING){g.solving={...g.stack[m.chain_size-1],seq:++g.links,disabledBefore:disabledMonsters(g,1)};}
    else if(m.type===M.CHAIN_SOLVED&&g.solving){
      const link=g.solving;g.solving=null;
      if(link.player===0)for(const key of disabledMonsters(g,1))if(!link.disabledBefore.has(key))
        g.events.push({by:link.code,turn:link.turn,seq:link.seq,kind:'disable',target:Number(key.split(':')[2])});
    }
    else if((m.type===M.CHAIN_NEGATED||m.type===M.CHAIN_DISABLED)&&g.solving?.player===0){
      const victim=g.stack[m.chain_size-1];
      if(victim?.player===1)g.events.push({by:g.solving.code,turn:g.solving.turn,seq:g.solving.seq,kind:'negate',target:victim.code});
    }
    else if(m.type===M.MOVE&&g.solving?.player===0&&((m.from.controller^g.first)===1)&&[2,4,8,16].includes(m.from.location)&&m.from.location!==m.to.location)
      g.events.push({by:g.solving.code,turn:g.solving.turn,seq:g.solving.seq,kind:FIELD.has(m.from.location)?'remove':m.from.location===16?'grave':'hand',target:m.card});
    else if(m.type===M.CHAIN_END||m.type===M.NEW_PHASE){g.stack=[];g.mark=g.inputs.length;}
    record(m);
  };
}
function disabledMonsters(g,uiPlayer) {
  const set=new Set();
  g.lib.duelQueryLocation(g.handle,{controller:uiPlayer^g.first,location:4,flags:Q.CODE|Q.STATUS}).forEach((c,i)=>{
    if(c?.code&&(Number(c.status)&STATUS_DISABLED))set.add(`4:${i}:${c.code}`);
  });
  return set;
}

function tryRespond(g,inputs) {
  for(const input of inputs){
    g.respond(g.pending.player^g.first,g.revision,input,{snapshot:false});
    if(!g.validationError)return input;
  }
  throw new Error(`No accepted response for ${g.prompt.type}`);
}

// Deterministic opponent: use effects, then summons, then end. Picks the first accepted option elsewhere.
function opponentInputs(g,state) {
  const p=g.prompt;
  if(p.type==='SELECT_IDLECMD'){
    const end=p.choices.filter(c=>c.response.action===7);
    if(state.actions>=12)return end;
    return [...[5,0,1,3,4].flatMap(action=>p.choices.filter(c=>c.response.action===action)),...end].map(c=>({action:c.id}));
  }
  if(p.type==='SELECT_BATTLECMD')return p.choices.filter(c=>c.response.action===3||c.response.action===2).map(c=>({action:c.id}));
  if(p.type==='SELECT_CHAIN'){
    // Own turn: use our own triggers; first turn: stay passive so the saved route is unchanged.
    const pass=p.choices.filter(c=>c.response.index===null);
    return (g.turn===1?pass:[...p.choices.filter(c=>c.response.index!==null),...pass]).map(c=>({action:c.id}));
  }
  if(p.type==='SELECT_UNSELECT_CARD'){
    const finish=p.choices.filter(c=>c.response.index===null&&c.label==='選択を確定');
    return [...finish,...p.choices.filter(c=>c.label.startsWith('選択'))].map(c=>({action:c.id}));
  }
  return defaultInputs(p);
}
function defaultInputs(p) {
  if(p.mode==='single')return p.choices.map(c=>({action:c.id}));
  if(p.mode==='order')return [{selection:p.cards.map((_,i)=>i)}];
  if(p.mode==='counter')return [{counters:p.cards.map((_,i)=>i===0?p.count:0)}];
  const n=Math.max(p.min||1,1);
  return [{selection:[...Array(n).keys()]},...p.cards.map((_,i)=>({selection:[i]}))].filter(x=>x.selection.every(i=>i<p.cards.length));
}
// Our decisions after the route are searched. Each option is one branch.
function ownOptions(g) {
  const p=g.prompt;
  if(p.type==='SELECT_IDLECMD'||p.type==='SELECT_BATTLECMD')return p.choices.filter(c=>c.label==='ターンを終了').map(c=>({action:c.id}));
  // Unselecting a material only loops back; every material set is reachable by selecting.
  if(p.type==='SELECT_UNSELECT_CARD')return p.choices.map(c=>({action:c.id})).filter(input=>!pointless(p,input));
  if(['SELECT_CHAIN','SELECT_EFFECTYN','SELECT_YESNO','SELECT_OPTION'].includes(p.type))return p.choices.map(c=>({action:c.id}));
  // Zone choice is fixed to the first legal zone (approximation recorded in the doc).
  if(p.mode==='multi'&&p.type!=='SELECT_PLACE'&&p.type!=='SELECT_DISFIELD'&&p.min===p.max&&p.min<=2){
    const rule=TARGET_RULES[g.activating];
    const usable=p.cards.map((c,i)=>({c,i})).filter(({c})=>!rule||rule.allow(c,p));
    // Identical copies in deck, hand, grave or Extra Deck are interchangeable.
    const seen=new Set(),unique=usable.filter(({c})=>{
      if(![1,2,16,64].includes(c.location))return true;
      const key=`${c.controller}:${c.location}:${c.code}`;if(seen.has(key))return false;seen.add(key);return true;
    });
    const sets=p.min===1?unique.map(x=>[x.i]):unique.flatMap((x,k)=>usable.filter(y=>y.i>x.i).map(y=>[x.i,y.i]));
    return sets.map(selection=>({selection}));
  }
  return defaultInputs(p).slice(0,1);
}

function replayRoute(g,route) {
  for(const step of route.steps){
    while(g.pending&&(g.pending.player^g.first)===1)tryRespond(g,opponentInputs(g,{actions:0}));
    assert.equal(g.prompt.type,step.prompt,'Route prompt drift');
    tryRespond(g,[step.input]);
  }
  assert.equal(hash(own(board(g))),hash(own(route.final)),'Own final board drift');
}

// Run one line: `choices` fixes our branch picks in order; returns the branching factor at the next open point.
export async function runLine(route,scenario,choices,visited=new Map()) {
  const g=await startScenario(route,scenario);
  try {
    replayRoute(g,route);
    const opp={actions:0},picks=[],trace=[];let open=null;
    for(let guard=0;guard<4000&&g.status==='playing'&&g.pending&&g.turn<=2;guard++){
      if((g.pending.player^g.first)===1){
        if(g.prompt.type==='SELECT_IDLECMD')opp.actions++;
        tryRespond(g,opponentInputs(g,opp));
        continue;
      }
      const options=ownOptions(g);
      trace.push({turn:g.turn,phase:g.phase,type:g.prompt.type,options:g.prompt.choices.map(c=>c.label).concat((g.prompt.cards||[]).map(c=>c.label))});
      if(options.length>1&&picks.length>=choices.length){
        // Transposition: the same position reached with no more interruptions so far cannot do better.
        // Inputs since the last chain end are part of the state (e.g. a chosen link target is not on the board yet).
        const key=hash({board:board(g),pending:g.pending,chain:g.stack.map(l=>l?.code),opp:opp.actions,recent:g.inputs.slice(g.mark).map(i=>i.response)});
        const sofar=summarize(g.events).length;
        if(visited.has(key)&&visited.get(key)>=sofar)return {pruned:true,picks};
        visited.set(key,sofar);open={count:options.length,prompt:g.prompt.type};break;
      }
      if(!options.length)return {pruned:true,picks};
      const index=options.length>1?choices[picks.length]:0;
      const label=g.prompt.choices.find(c=>c.id===options[index].action)?.label||(options[index].selection||[]).map(i=>g.prompt.cards[i]?.label).join(' / ');
      if(options.length>1)picks.push({prompt:g.prompt.type,label,turn:g.turn});
      const chosen=g.prompt.choices.find(c=>c.id===options[index].action);
      if(chosen?.card&&['SELECT_CHAIN','SELECT_IDLECMD'].includes(g.prompt.type))g.activating=chosen.card.code;
      else if(g.prompt.type==='SELECT_EFFECTYN'&&g.pending.code)g.activating=g.pending.code;
      g.respond(0,g.revision,options[index],{snapshot:false});
      if(g.validationError)return {invalid:true,picks};
    }
    return {open,picks,trace,events:g.events,log:g.log.slice(-80),status:g.status,turn:g.turn};
  } catch(error) {
    return {error:error.message,picks:[]};
  } finally {g.close();}
}

export function summarize(events) {
  const links=new Map();
  for(const e of events.filter(e=>e.turn===2)){
    const link=links.get(e.seq)||{by:e.by,targets:new Set(),kinds:new Set()};
    link.targets.add(e.target);link.kinds.add(e.kind);links.set(e.seq,link);
  }
  return [...links.values()].map(l=>({card:cardInfo(l.by).name,code:l.by,kinds:[...l.kinds],targets:[...l.targets].map(c=>cardInfo(c).name)}));
}

// Depth-first search over our branch points. Returns the line with the most interruptions.
export async function evaluateRoute(route,{scenario='malice-mirror',maxLines=3000}={}) {
  const sc=SCENARIOS[scenario];assert(sc,`Unknown scenario ${scenario}`);
  const stack=[[]],visited=new Map();let best=null,lines=0,errors=0,pruned=0;const started=Date.now();
  while(stack.length&&lines<maxLines){
    const choices=stack.pop();
    const result=await runLine(route,sc,choices,visited);
    if(result.error||result.invalid){errors++;continue;}
    if(result.pruned){pruned++;continue;}
    if(result.open){for(let i=result.open.count-1;i>=0;i--)stack.push([...choices,i]);continue;}
    lines++;
    const interruptions=summarize(result.events);
    const score=[interruptions.length,interruptions.reduce((n,x)=>n+x.targets.length,0)];
    if(!best||score[0]>best.score[0]||(score[0]===best.score[0]&&score[1]>best.score[1]))best={score,interruptions,picks:result.picks};
  }
  return {route:route.id,scenario,lines,pruned,errors,complete:stack.length===0,ms:Date.now()-started,
    interruptions:best?.score[0]??0,targets:best?.score[1]??0,breakdown:best?.interruptions??[],line:best?.picks??[]};
}
