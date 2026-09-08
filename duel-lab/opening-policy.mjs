import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cards,ROOT} from './cards.mjs';
import {startRoute,respond,board,hash,preset} from './scripts/route-harness.mjs';
import {nativeFrame,semanticInput,matchFrame,emptyOpponent,publicOwn,startDeckCopyAudit} from './opening-semantics.mjs';
import {openingSources} from './opening-sources.mjs';
import {buildFinalPlacementBlock,matchPlacementBlock} from './opening-placement.mjs';

const hasHand=(hand,required)=>{const left=[...hand];return required.every(code=>{const i=left.indexOf(code);if(i<0)return false;left.splice(i,1);return true;});};
const drawn=g=>g.log.some(e=>/\d+\s*枚ドロー/.test(e.text));
const weights={39138610:9,65741786:8,95454996:5,21848500:5,29301450:5,5043010:4,4993187:4,46947713:2,52698008:2,86066372:1,13203964:1,24842059:2};
const trapCodes=new Set([94722358,20726052,57111661,40366667,78114463]);
export function openingScore(g) {
  const own=g.snapshot(0).players[0];
  return own.monsters.filter(Boolean).reduce((n,c)=>n+(weights[c.code]||0.7),0)+own.spells.filter(c=>c&&trapCodes.has(c.code)).length*2+
    own.hand.length*0.7+own.lp/16000-g.inputs.length/1000;
}

export async function loadOpeningTemplates() {
  const templates=[],ids=new Set();
  for(const name of openingSources()){const file=new URL(`./routes/${name}.json`,import.meta.url);
    for(const route of JSON.parse(fs.readFileSync(file)).routes||[]){
      if(!route.verified||route.requiresDraw||route.hand.length>3||route.log?.some(e=>/\d+\s*枚ドロー/.test(e.text)))continue;
      assert.equal(typeof route.id,'string');assert(!ids.has(route.id),`Duplicate opening route id: ${route.id}`);ids.add(route.id);
      assert.equal(route.presetHash,hash(preset));assert.equal(hash(route.final),route.finalHash);
      const g=await startRoute(route.hand,{seed:route.seed,deckOrder:route.deckOrder});
      const steps=[];
      try {
        for(const step of route.steps){
          assert.equal(step.before,hash({pending:g.pending,board:board(g)}),'Opening source drift');
          steps.push({prompt:g.prompt,pending:g.pending,input:step.input});respond(g,step.input);
        }
        assert.equal(hash(board(g)),route.finalHash);assert(!drawn(g));
        if(g.turn===1&&g.phase===4&&g.prompt.type==='SELECT_IDLECMD')templates.push({id:route.id,hand:route.hand,steps,source:name,
          score:openingScore(g),genericDiscard:route.id.startsWith('backup-discard-')});
      } finally{g.close();}
    }
  }
  return templates;
}

export async function prepareOpening(template,hand,replacements={}) {
  const required=template.hand.map(code=>replacements[code]||code);assert(hasHand(hand,required));
  const g=await startRoute(hand),frames=[];let resolutionEvents=[];
  const record=g.record;
  g.record=function(message){resolutionEvents.push(structuredClone(message));return record.call(this,message);};
  startDeckCopyAudit(g);
  const take=input=>{const frame=nativeFrame(g,input);frames.push(frame);
    const chain=structuredClone(g.chain);resolutionEvents=[];respond(g,input);
    if(frame.type==='SELECT_PLACE'){
      frame.resolutionEvents=JSON.parse(JSON.stringify(resolutionEvents,(_,v)=>typeof v==='bigint'?String(v):v));frame.resolutionChain=chain;
    }
    assert(!drawn(g),'Opening crosses a draw boundary');};
  try {
    for(const step of template.steps){
      // A replaced hand trap can remove an optional chain window entirely.
      // Only a saved explicit pass has no game action to reproduce.
      if(g.prompt.type!==step.prompt.type&&step.prompt.type==='SELECT_CHAIN'&&!step.pending.forced&&
        step.prompt.choices.find(c=>c.id===step.input.action)?.response.index===null)continue;
      // Additional optional chains supplied by extra hand cards may be declined;
      // their explicit choices are still recorded and matched by the native replayer.
      for(let i=0;g.prompt.type!==step.prompt.type&&g.prompt.type==='SELECT_CHAIN'&&!g.pending.forced&&i<8;i++){
        const pass=g.prompt.choices.find(c=>c.response.index===null);assert(pass);take({action:pass.id});
      }
      // A hand Link material adds another optional material to the candidate
      // group. Finish only when the actual core says the saved selection is legal.
      if(step.prompt.type==='SELECT_PLACE'&&g.prompt.type==='SELECT_UNSELECT_CARD'&&g.pending.can_finish){
        const finish=g.prompt.choices.find(c=>c.response.index===null);assert(finish);take({action:finish.id});
      }
      take(semanticInput(step,g,step.input,replacements));
    }
    for(let i=0;g.prompt.type==='SELECT_CHAIN'&&!g.pending.forced&&i<8;i++){
      const pass=g.prompt.choices.find(c=>c.response.index===null);assert(pass);take({action:pass.id});
    }
    assert(g.turn===1&&g.phase===4&&g.prompt.type==='SELECT_IDLECMD');assert(frames.some(f=>!f.automatic));
    const finalOwn=publicOwn(g.snapshot(0).players[0]);
    return {id:template.id,source:template.source,requiredHand:required,hand:[...hand],frames,score:openingScore(g),final:board(g),
      finalOwn,finalPlacement:buildFinalPlacementBlock(frames,finalOwn),responseCount:g.inputs.length,drawDependent:false};
  }finally{g.close();}
}

export async function bestOpening(templates,hand,{maxCandidates=24}={}) {
  const candidates=[];
  for(const template of templates){
    if(hasHand(hand,template.hand))candidates.push({template,replacements:{}});
    if(template.genericDiscard&&hand.includes(30118811))for(const code of new Set(hand)){
      if(code===14558127)continue;
      const required=template.hand.map(c=>c===14558127?code:c);
      if(hasHand(hand,required))candidates.push({template,replacements:{14558127:code}});
    }
  }
  candidates.sort((a,b)=>b.template.score-a.template.score);
  let best=null;const failures=[];let attempted=0;
  for(const candidate of candidates.slice(0,maxCandidates)){
    attempted++;
    try{const plan=await prepareOpening(candidate.template,hand,candidate.replacements);if(!best||plan.score>best.score)best=plan;}
    catch(error){failures.push({id:candidate.template.id,reason:error.message});}
  }
  return {plan:best,attempted,candidates:candidates.length,failures};
}

export class NativeOpeningPolicy {
  constructor(templates){this.templates=templates;this.reset(null);this.hits=0;this.preparations=0;}
  reset(session){this.session=session;this.plan=null;this.cursor=0;this.placementAnsweredCodes=[];this.retired=false;this.lastId=0;this.lastHash=null;this.lastResult=null;this.safety=null;this.opponent=null;this.reason='not-started';}
  retire(reason){this.retired=true;this.reason=reason;return null;}
  context(){return {status:this.reason,route:this.plan?.id||null,completedSteps:this.cursor,totalSteps:this.plan?.frames.length||0,
    note:'検証済み初動の続き。実際の現在状態を優先し、未確定ドローや妨害後へ保存手順を流用しない。'};}
  rememberFallback(input,result){this.lastResult=result;if(input.state.turn>=1)this.retire('astra-took-over');}
  async choose(input){
    if(input.session!==this.session)this.reset(input.session);
    if(input.protocolVersion!==2)return this.retire('native-protocol-upgrade-required');
    const id=input.requestId,digest=hash(input);
    if(!Number.isSafeInteger(id)||id<1)return this.retire('invalid-request-id');
    if(id===this.lastId){if(digest===this.lastHash&&this.lastResult)return this.lastResult;throw new Error('Repeated request id with changed or unfinished state');}
    if(id<this.lastId)throw new Error('Stale native request');
    if(this.lastId&&id!==this.lastId+1)this.retire('request-gap');
    this.lastId=id;this.lastHash=digest;this.lastResult=null;
    if(this.retired)return null;
    const s=input.state,me=s.players?.find(p=>p.player===1),op=s.players?.find(p=>p.player===0),safe=input.safety;
    if(s.turn<1){
      if(s.request.kind==='single'&&s.request.title==='先攻を選ぶか'){
        const first=s.request.choices.find(c=>c.option?.answer===true);
        if(first){this.lastResult={action:first.id,selection:[],counters:[],cancel:false,plan:'固定M∀LICEでは先攻を選び、検証済み初動を優先する。'};return this.lastResult;}
      }
      return null;
    }
    if(s.turn!==1||s.player!==1)return this.retire('outside-first-turn');
    if(!safe||!['drawEpoch','opponentEffectEpoch','negationEpoch','turnEpoch'].every(k=>Number.isSafeInteger(safe[k])))return this.retire('missing-event-guards');
    if(!emptyOpponent(op)||safe.opponentEffectEpoch!==0||safe.negationEpoch!==0)return this.retire('opponent-interruption');
    if((me?.monsters||[]).some(c=>c?.disabled))return this.retire('disabled-card');
    if(!this.plan){
      if(!['DRAW','STANDBY','MAIN1'].includes(String(s.phase).replace(/[ _]/g,'').toUpperCase()))return null;
      if(!me||me.hand.length!==5||me.deckCount!==35||me.lp!==8000||!emptyOpponent(me))return this.retire('not-clean-opening');
      const expected=Object.entries([...preset.main,...preset.extra].reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{})).map(([code,count])=>({code:Number(code),count}));
      if(hash(input.ownDeck?.slice().sort((a,b)=>a.code-b.code))!==hash(expected.sort((a,b)=>a.code-b.code)))return this.retire('different-deck');
      this.preparations++;const prepared=await bestOpening(this.templates,me.hand.map(c=>c.code));
      if(!prepared.plan)return this.retire('no-verified-line');
      this.plan=prepared.plan;this.safety=hash(safe);this.opponent=hash({hand:op.hand.length,deckCount:op.deckCount,lp:op.lp});
    }
    if(hash(safe)!==this.safety)return this.retire('draw-or-history-changed');
    if(hash({hand:op.hand.length,deckCount:op.deckCount,lp:op.lp})!==this.opponent)return this.retire('opponent-state-changed');
    const block=this.plan.finalPlacement;
    while(this.cursor<this.plan.frames.length){
    if(block&&this.cursor>=block.startFrame&&this.cursor<block.endExclusive){
      const matched=matchPlacementBlock(block,s,this.placementAnsweredCodes);
      if(!matched)return this.retire('placement-resolution-mismatch');
      if(matched.kind==='complete'){this.cursor=block.endExclusive;this.placementAnsweredCodes=[];break;}
      else{this.placementAnsweredCodes=[...new Set([...this.placementAnsweredCodes,...matched.observedCodes,matched.code])];this.hits++;this.reason='verified-opening';
        const decision={...matched.decision,plan:`事前検証: ${this.plan.id}。アコードの蘇生対象と予定位置を照合。`};
        this.lastResult=decision;return decision;}
    }
      const frame=this.plan.frames[this.cursor];const decision=matchFrame(frame,s);
      if(decision){this.cursor++;this.hits++;this.reason='verified-opening';
        decision.plan=`事前検証: ${this.plan.id} ${this.cursor}/${this.plan.frames.length}。不一致・追加ドロー・相手干渉では再判断。`;
        this.lastResult=decision;return decision;}
      if(frame.automatic){this.cursor++;continue;}
      return this.retire('state-or-request-mismatch');
    }
    // The last response may resolve several effects without another prompt.
    // Verify that resolution too before calling the saved opening complete.
    if(hash(publicOwn(me))!==hash(this.plan.finalOwn))return this.retire('opening-endpoint-mismatch');
    return this.retire('opening-completed');
  }
}
