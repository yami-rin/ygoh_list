import fs from 'node:fs';
import crypto from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {publicOwn} from './opening-semantics.mjs';

// This adapter covers the audited final Accord revival of Binder + Transcode.
// The two script versions iterate that simultaneous group in different orders.
const ACCORD=39138610, BINDER=95454996, TRANSCODE=46947713;
const sourceChain=[{code:ACCORD,player:0,size:1}];
const pinnedFiles=[
  ['./data/scripts/official/c39138610.lua','7fd75e45f1c9ef731d135b049ab255eb933a6f663119720d363f1f4c9b7d7ef1'],
  ['./runtime/MDPro3-client/Data/script.zip','0234d880943864968c8b6779720480c927b188a75cb51bb78b34800a6ef4e95f'],
];
function versionsMatch(){
  // Recheck only an otherwise eligible block, never each native response.
  // A previous successful compilation is not proof of the current scripts.
  try{return pinnedFiles.every(([file,digest])=>crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex')===digest);}
  catch{return false;}
}
const phase=s=>String(s).replace(/[ _]/g,'').toUpperCase();
const mainTurn=s=>s?.turn===1&&s.player===1&&phase(s.phase)==='MAIN1';
const slotFor=mask=>Number.isSafeInteger(mask)&&mask>0&&mask<=16&&(mask&(mask-1))===0?Math.log2(mask):-1;
const sorted=values=>[...values].sort((a,b)=>a-b);
const cardToken=code=>JSON.stringify({code});
const unique=values=>new Set(values).size===values.length;

function placement(request){
  if(request?.kind!=='single'||request.title!=='配置先'||!Array.isArray(request.choices)||!request.choices.length)return null;
  const choices=request.choices,code=choices[0].option?.code;
  if(!Number.isSafeInteger(code)||code<=0||!choices.every(c=>Number.isSafeInteger(c.id)&&c.id>=0&&
    c.option?.code===code&&c.option.controller===1&&c.option.location==='MonsterZone'&&slotFor(c.option.mask)>=0)||
    !unique(choices.map(c=>c.id))||!unique(choices.map(c=>c.option.mask)))return null;
  return {code,choices,masks:sorted(choices.map(c=>c.option.mask))};
}
function afterMoves(start,targets){
  const own=structuredClone(start);
  for(const target of targets){
    const token=cardToken(target.code),at=own.grave.indexOf(token);
    if(at<0||own.grave.lastIndexOf(token)!==at||own.monsters[target.slot])return null;
    own.grave.splice(at,1);own.monsters[target.slot]={code:target.code,position:target.position};
  }
  return own;
}
function isMove(event,target){
  return event?.type===M.MOVE&&event.card===target.code&&event.from?.controller===0&&event.from.location===16&&
    Number.isSafeInteger(event.from.sequence)&&event.from.sequence>=0&&
    event.to?.controller===0&&event.to.location===4&&event.to.sequence===target.slot&&event.to.position===target.position;
}
function isSummoning(event,target){
  return event?.type===M.SPSUMMONING&&event.code===target.code&&event.controller===0&&event.location===4&&
    event.sequence===target.slot&&event.position===target.position;
}
function firstResolution(events,first,second,secondMasks){
  if(!Array.isArray(events)||events.length!==4||!isMove(events[0],first)||!isSummoning(events[1],first))return false;
  const hint=events[2],place=events[3];
  if(hint.type!==M.HINT||hint.hint_type!==3||hint.player!==0||String(hint.hint)!==String(second.code)||
    place.type!==M.SELECT_PLACE||place.player!==0||place.count!==1||!Number.isSafeInteger(place.field_mask))return false;
  // All bits except the actual available own main monster zones must be masked.
  return (place.field_mask>>>0)===((~secondMasks.reduce((mask,n)=>mask|n,0))>>>0);
}
function finalResolution(events,last){
  if(!Array.isArray(events)||events.length<7||!isMove(events[0],last)||!isSummoning(events[1],last))return false;
  const [,,summoned,hint,solved,end]=events;
  if(summoned.type!==M.SPSUMMONED||hint.type!==M.PLAYER_HINT||hint.player!==0||hint.player_hint!==6||
    String(hint.description)!==String((BigInt(ACCORD)<<20n)+2n)||
    solved.type!==M.CHAIN_SOLVED||solved.chain_size!==1||end.type!==M.CHAIN_END)return false;
  const idle=events.at(-1);
  if(idle.type!==M.SELECT_IDLECMD||idle.player!==0)return false;
  return events.slice(6,-1).every(e=>e.type===M.SELECT_CHAIN&&[0,1].includes(e.player)&&
    e.forced===false&&e.spe_count===0&&Array.isArray(e.selects)&&e.selects.length===0);
}

export function buildFinalPlacementBlock(frames,finalOwn){
  try{
    if(!Array.isArray(frames)||frames.length<2)return null;
    const startFrame=frames.length-2,[first,second]=frames.slice(-2);
    if(first.type!=='SELECT_PLACE'||second.type!=='SELECT_PLACE'||frames[startFrame-1]?.type==='SELECT_PLACE'||
      ![first,second].every(f=>mainTurn(f.state)&&equal(f.resolutionChain,sourceChain)))return null;
    const a=placement(first.request),b=placement(second.request);
    if(!a||!b||a.code!==BINDER||b.code!==TRANSCODE)return null;
    const targets=[first,second].map((frame,i)=>{
      const option=frame.request.choices.find(c=>c.id===frame.decision.action)?.option;
      if(!option||frame.decision.cancel||frame.decision.selection?.length||frame.decision.counters?.length)return null;
      return {code:i===0?a.code:b.code,mask:option.mask,slot:slotFor(option.mask),position:1};
    });
    if(targets.some(t=>!t)||targets[0].slot===targets[1].slot||
      !equal(b.masks,a.masks.filter(mask=>mask!==targets[0].mask)))return null;
    const startOwn=first.state.own;
    if(startOwn.monsters.length!==7||startOwn.spells.length!==8||
      a.masks.some(mask=>startOwn.monsters[slotFor(mask)])||
      startOwn.monsters.filter(c=>c?.code===ACCORD&&c.position===1).length!==1)return null;
    if(!equal(afterMoves(startOwn,[targets[0]]),second.state.own)||!equal(afterMoves(startOwn,targets),finalOwn)||
      !firstResolution(first.resolutionEvents,targets[0],targets[1],b.masks)||
      !finalResolution(second.resolutionEvents,targets[1])||!versionsMatch())return null;
    return {startFrame,endExclusive:frames.length,startOwn:structuredClone(startOwn),endOwn:structuredClone(finalOwn),
      targets,legalMasks:a.masks};
  }catch{return null;}
}

export function matchPlacementBlock(block,state,previousCode=null){
  try{
    if(!block||!mainTurn(state))return null;
    const own=publicOwn(state.players.find(p=>p.player===1));
    let moved=null;
    for(let bits=0;bits<4;bits++){
      const targets=block.targets.filter((_,i)=>bits&(1<<i));
      if(equal(own,afterMoves(block.startOwn,targets))){moved=targets;break;}
    }
    const previousCodes=Array.isArray(previousCode)?previousCode:previousCode===null?[]:[previousCode];
    if(!moved||!unique(previousCodes)||!previousCodes.every(code=>Number.isSafeInteger(code)&&moved.some(t=>t.code===code)))return null;
    if(moved.length===2)return equal(own,block.endOwn)&&Array.isArray(state.chain)&&state.chain.length===0&&
      state.request?.kind==='single'&&state.request.title==='メインフェイズの行動'?{kind:'complete'}:null;
    const chain=state.chain;
    if(!Array.isArray(chain)||chain.length!==1||chain[0].code!==ACCORD||chain[0].controller!==1||
      chain[0].location!=='MonsterZone'||chain[0].disabled||
      own.monsters[chain[0].sequence]?.code!==ACCORD)return null;
    const requested=placement(state.request);
    if(!requested||moved.some(t=>t.code===requested.code))return null;
    const target=block.targets.find(t=>t.code===requested.code);
    if(!target||!equal(requested.masks,block.legalMasks.filter(mask=>!own.monsters[slotFor(mask)])))return null;
    const chosen=requested.choices.find(c=>c.option.mask===target.mask);
    if(!chosen)return null;
    return {kind:'decision',code:target.code,observedCodes:moved.map(t=>t.code),
      decision:{action:chosen.id,selection:[],counters:[],cancel:false,plan:''}};
  }catch{return null;}
}
