import assert from 'node:assert/strict';
import {OcgMessageType as M} from 'ocgcore-wasm';
import {cards} from './cards.mjs';

const locations={1:'Deck',2:'Hand',4:'MonsterZone',8:'SpellZone',16:'Grave',32:'Removed',64:'Extra'};
const phase=p=>String(p).replace(/[ _]/g,'').toUpperCase();
export function effectKey(value,modern=false) {
  if(value===undefined||value===null)return null;
  const v=BigInt(value),shift=modern?20n:4n,code=Number(v>>shift),index=Number(v&((1n<<shift)-1n));
  return code&&cards[code]?`card:${code}:${index}`:`system:${v}`;
}
function oldDescription(value){if(value===undefined)return undefined;const v=BigInt(value),code=Number(v>>20n);return code?code*16+Number(v&0xfffffn):Number(v);}
function nativeDescription(value,type,card) {
  const converted=oldDescription(value);
  if(value===undefined)return converted;
  const encoded=BigInt(value),code=Number(encoded>>20n),index=Number(encoded&0xfffffn);
  // Audited data/scripts/official Lua versus MDPro3 Data/script.zip:
  // Underground rmop SelectYesNo(1) / activate SelectYesNo(3): banish one.
  // Cat rmop SelectYesNo(2) / drop SelectYesNo(3): optional two-card draw.
  // These are question IDs only, never global aliases between card effects.
  if(type==='SELECT_YESNO'&&((code===68337209&&index===1)||(code===96676583&&index===2)))return code*16+3;
  if(type==='SELECT_CHAIN'&&card?.controller===0&&card.code===code){
    // Cat EVENT_REMOVE revive: modern description 1, native description 2.
    if(code===96676583&&index===1&&card.location===32)return code*16+2;
    // Magnamhut EVENT_SPSUMMON_SUCCESS registers its End Phase search.
    // The native e3 omits SetDescription, so only this on-field trigger is 0;
    // its separate hand summon effect is not mapped to this operation.
    if(code===33854624&&index===1&&card.location===4)return 0;
  }
  return converted;
}
const loc=value=>typeof value==='number'?locations[value]:({Monster:'MonsterZone',Spell:'SpellZone',Banished:'Removed',Graveyard:'Grave',ExtraDeck:'Extra'}[value]||value);
export function reference(card) {
  if(!card)return null;
  const location=loc(card.location);
  return {code:card.code,controller:card.controller,location,...(['MonsterZone','SpellZone'].includes(location)?{sequence:card.sequence}:{})};
}
const key=value=>JSON.stringify(value);
const ordered=values=>values.map(key).sort();
const toCard=c=>c?{code:c.code,controller:1-c.controller,location:loc(c.location),sequence:c.sequence,position:c.position}:null;
const deckCopyAudits=new WeakMap();
export function startDeckCopyAudit(game) {
  assert(game.fixture&&game.inputs.length===0&&game.turn===1&&[1,2,4].includes(game.phase),
    'Deck copy audit must observe an untouched first-turn fixture');
  const prior=deckCopyAudits.get(game);
  if(prior){assert.equal(game.record,prior.record,'Deck copy observer was replaced');return;}
  const original=game.record,own=game.first;
  const audit={valid:true,returnedCodes:new Set(),record:null,lastMessage:null,placement:null};
  audit.record=function(message){
    if(message.type===M.SELECT_PLACE){
      // The modern packet omits the card ID; its immediately preceding
      // HINT_SELECTMSG supplies that exact card. Bind it to this pending packet.
      const hint=audit.lastMessage,code=Number(hint?.hint);
      audit.placement=hint?.type===M.HINT&&hint.hint_type===3&&hint.player===message.player&&
        Number.isSafeInteger(code)&&cards[code]?{pending:message,code}:null;
    }
    if(message.type===M.MOVE){
      const from=message.from,to=message.to;
      if(!from||!to||![from.location,to.location,from.controller,to.controller].every(Number.isSafeInteger))audit.valid=false;
      else if(to.controller===own&&to.location===1&&(from.location!==1||from.controller!==own)){
        if(!Number.isSafeInteger(message.card)||!(message.card>0)||!cards[message.card])audit.valid=false;
        else audit.returnedCodes.add(message.card);
      }
    }
    audit.lastMessage=message;return original.call(this,message);
  };
  game.record=audit.record;deckCopyAudits.set(game,audit);
}
function deckCopyProof(game) {
  const audit=deckCopyAudits.get(game);
  return {observedFromStart:!!(audit?.valid&&game.record===audit.record),returnedCodes:[...(audit?.returnedCodes||[])].sort((a,b)=>a-b)};
}
function normalOption(option) {
  if(typeof option!=='object'||option===null)return option;
  const out={};
  for(const name of ['action','answer','mask','position','code','controller','location'])if(option[name]!==undefined)out[name]=option[name];
  if(option.card)out.card=reference(option.card);
  if(option.description!==undefined){
    out.effect=effectKey(option.description);
    // Older native scripts leave their default effect description at zero
    // (including Ash's sole hand trigger). Never map this to a nonzero effect.
    if(out.effect==='system:0'&&option.card&&cards[option.card.code])out.effect=`card:${option.card.code}:0`;
  }
  if(option.context)out.context=normalOption(option.context);
  return out;
}
export function requestKey(request) {
  if(request.kind==='single')return {kind:'single',title:request.title,options:ordered(request.choices.map(c=>normalOption(c.option)))};
  if(request.kind==='multi')return {kind:'multi',min:request.min,max:request.max,canCancel:request.canCancel===true,
    cards:ordered(request.cards.map(reference))};
  return {kind:request.kind,unsupported:true};
}
export function publicOwn(player) {
  assert(player,'Missing own player');
  const field=(name,n)=>Array.from({length:n},(_,i)=>{const c=player[name]?.[i];return c?.code?{code:c.code,position:Number(c.position)}:null;});
  const list=(name,position=false)=>ordered((player[name]||[]).filter(Boolean).map(c=>({code:c.code,...(position?{faceDown:!!(Number(c.position)&10)}:{})})));
  return {lp:player.lp,deckCount:player.deckCount,hand:list('hand'),monsters:field('monsters',7),spells:field('spells',8),
    grave:list('grave'),banished:list('banished',true),extra:list('extra')};
}
export function emptyOpponent(player) {
  return player&&['monsters','spells','grave','banished'].every(zone=>(player[zone]||[]).every(c=>!c||!c.code&&Number(c.position)===0));
}
export function stateKey(state,own=1) {
  return {turn:state.turn,phase:phase(state.phase),player:state.player,own:publicOwn(state.players.find(p=>p.player===own))};
}

// Convert only the audited opening prompt subset. Unsupported protocol remains a fallback.
export function nativeFrame(game,input) {
  const p=game.prompt,m=game.pending,choices=[];
  let request,decision={action:-1,selection:[],counters:[],cancel:false,plan:''},automatic=false;
  const add=(option,chosen=false)=>{const id=choices.length;choices.push({id,option});if(chosen)decision.action=id;};
  const selected=p.choices.find(c=>c.id===input.action);
  switch(p.type) {
    case 'SELECT_IDLECMD': {
      const names=['Summon','SpSummon','Repos','SetMonster','SetSpell','Activate'];
      for(const c of p.choices){const a=c.response.action;add(a<6?{action:names[a],card:toCard(c.card),...(a===5?{description:oldDescription(c.card.description)}:{})}:a===6?'Battle Phase':'End Phase',c===selected);}
      request={kind:'single',title:'メインフェイズの行動',choices};break;
    }
    case 'SELECT_CHAIN':
      for(const c of p.choices)add(c.card?{card:toCard(c.card),description:nativeDescription(c.card.description,p.type,c.card)}:'チェーンしない',c===selected);
      request={kind:'single',title:'チェーンの選択',choices};break;
    case 'SELECT_EFFECTYN':case 'SELECT_YESNO': {
      const d=nativeDescription(m.description,p.type,m);
      // WindBot's OnSelectEffectYn maps the native generic trigger IDs 0/221 to -1.
      const context=p.type==='SELECT_EFFECTYN'?{card:toCard(m),description:d===0||d===221?-1:d}:{description:d};
      for(const answer of [false,true])add({answer,context},selected?.response.yes===answer);
      request={kind:'single',title:p.type==='SELECT_EFFECTYN'?'効果を発動するか':'はい／いいえ',choices};break;
    }
    case 'SELECT_OPTION':
      for(const c of p.choices)add({description:oldDescription(m.options[c.response.index])},c===selected);
      request={kind:'single',title:'効果の選択',choices};break;
    case 'SELECT_POSITION': {
      const names={1:'FaceUpAttack',2:'FaceDownAttack',4:'FaceUpDefence',8:'FaceDownDefence'};
      for(const c of p.choices)add({code:m.code,position:names[c.response.position]},c===selected);
      request={kind:'single',title:'表示形式',choices};break;
    }
    case 'SELECT_PLACE': {
      assert.equal(input.selection.length,1);
      const audit=deckCopyAudits.get(game);
      const code=audit?.record===game.record&&audit.placement?.pending===m?audit.placement.code:0;
      assert(cards[code],'Missing observed placement card context');
      const picked=p.cards[input.selection[0]].place;
      const eligible=p.cards.filter(c=>c.place.player===picked.player&&c.place.location===picked.location);
      for(const c of eligible)add({code,controller:1-c.place.player,location:loc(c.place.location),mask:1<<c.place.sequence},c.place.sequence===picked.sequence);
      request={kind:'single',title:'配置先',choices};break;
    }
    case 'SELECT_CARD':
      request={kind:'multi',title:'カード選択',cards:p.cards.map(toCard),min:p.min,max:p.max,canCancel:!!p.canCancel};
      decision.selection=[...(input.selection||[])];decision.cancel=!!input.cancel;
      automatic=!request.canCancel&&request.min===request.cards.length&&request.max===request.cards.length;break;
    case 'SELECT_UNSELECT_CARD': {
      const canCancel=!!(m.can_cancel||m.can_finish)&&m.unselect_cards.length>0;
      request={kind:'multi',title:'カード選択',cards:m.select_cards.map(toCard),min:m.can_finish?0:1,max:1,canCancel};
      assert(selected,'Missing material decision');const i=selected.response.index;
      assert(i===null||i<m.select_cards.length,'Material deselection is not an opening shortcut');
      decision.selection=i===null?[]:[i];decision.cancel=i===null;
      automatic=!canCancel&&request.min===1&&request.cards.length===1;
      break;
    }
    default:throw new Error(`Opening adapter does not support ${p.type}`);
  }
  if(request.kind==='single'){assert(decision.action>=0);automatic=choices.length===1;}
  const snapshot=game.snapshot(0),own=snapshot.players[0];
  const state={turn:game.turn,phase:snapshot.phase,player:1-game.turnPlayer,players:[{...snapshot.players[1],player:0},{...own,player:1}],chain:snapshot.chain};
  const proof=deckCopyProof(game);
  const initialHandCopyProof=!!(p.type==='SELECT_IDLECMD'&&proof.observedFromStart&&game.fixture&&game.inputs.length===0&&
    game.turn===1&&game.phase===4&&game.turnPlayer===game.first&&own.lp===8000&&snapshot.chain.length===0&&
    ['monsters','spells','grave','banished'].every(zone=>own[zone].every(c=>!c))&&Array.isArray(game.route?.hand)&&
    key(ordered(own.hand.map(c=>c.code)))===key(ordered(game.route.hand)));
  return {state:stateKey(state),request,decision,automatic,type:p.type,deckCopyProof:proof,initialHandCopyProof,materialContext:p.type==='SELECT_UNSELECT_CARD'?{
    finishable:!!m.can_finish,cancelable:!!m.can_cancel,selectCount:m.select_cards.length,unselectCount:m.unselect_cards.length}:null};
}

function supportedMulti(request,type) {
  if(request?.kind!=='multi'||!['SELECT_CARD','SELECT_UNSELECT_CARD'].includes(type))return false;
  // SelectCards emits sum:-1/exact:true even for ordinary native selections.
  // Every weighted, ordered or other selection contract needs live reasoning.
  if(request.sum!==undefined&&request.sum!==-1 || request.exact!==undefined&&request.exact!==true ||
    request.order!==undefined&&request.order!==false)return false;
  if(['amount','sumMode','must','selects_must','select_max'].some(k=>request[k]!==undefined))return false;
  for(const subtype of [request.subtype,request.context?.subtype,request.selectionContext?.subtype])
    if(subtype!==undefined&&subtype!==type)return false;
  return Array.isArray(request.cards)&&Number.isSafeInteger(request.min)&&Number.isSafeInteger(request.max)&&
    request.min>=0&&request.max>=request.min;
}

const copyProperties=c=>Object.fromEntries(Object.entries(c).filter(([k])=>k!=='sequence').sort(([a],[b])=>a.localeCompare(b)));
function sameNativeCopyMetadata(saved,actual) {
  if(saved.some(c=>key(copyProperties(c))!==key(copyProperties(saved[0]))))return false;
  const numeric=['position','attack','defense','level','link','disabled'];
  for(const c of actual){
    if(numeric.some(k=>!Number.isSafeInteger(c[k]))||!Array.isArray(c.contribution)||c.contribution.length!==2||
      c.contribution.some(v=>!Number.isSafeInteger(v)))return false;
  }
  // Every transmitted attribute is compared, including future unknown fields.
  return actual.every(c=>key(copyProperties(c))===key(copyProperties(actual[0])));
}
function interchangeableDeckCopies(saved,actual,proof) {
  // NativeOpeningPolicy admits only the fixed deck, its uninterrupted first
  // turn and a no-draw replay. Within an ordinary search, own Deck copies may
  // be chosen arbitrarily when the candidate entries expose no difference.
  // Sequence is deliberately excluded: this must never infer the deck order.
  if(saved.length<2||actual.length!==saved.length||saved.some(c=>loc(c.location)!=='Deck'||c.controller!==1||!(c.code>0)))return false;
  // Cards returned to the Deck may have prior individual history not present
  // in a native ClientCard lookup entry. Missing/partial MOVE history is unsafe.
  if(proof?.observedFromStart!==true||!Array.isArray(proof.returnedCodes)||proof.returnedCodes.includes(saved[0].code))return false;
  return sameNativeCopyMetadata(saved,actual);
}
function interchangeableInitialHandChoices(frame,saved,actual) {
  // Only the untouched first Main decision can rename initial unused copies.
  // Passing an earlier Draw/Standby window already consumes this permission.
  if(frame.initialHandCopyProof!==true||frame.type!=='SELECT_IDLECMD'||frame.state.turn!==1||frame.state.phase!=='MAIN1'||
    frame.state.player!==1||saved.length<2||saved.length!==actual.length)return false;
  const savedCards=saved.map(c=>c.option?.card),actualCards=actual.map(c=>c.option?.card),hand=frame.state.own.hand;
  for(const group of [savedCards,actualCards]){
    if(group.some(c=>!c||loc(c.location)!=='Hand'||c.controller!==1||!(c.code>0)||
      !Number.isSafeInteger(c.sequence)||c.sequence<0||c.sequence>=hand.length)||new Set(group.map(c=>c.sequence)).size!==group.length)return false;
  }
  if(hand.filter(c=>JSON.parse(c).code===savedCards[0].code).length!==savedCards.length||
    !sameNativeCopyMetadata(savedCards,actualCards))return false;
  // Keep action, effect description and every other option property intact.
  // The candidate groups were already matched by their complete effect key.
  const option=c=>({...c.option,card:copyProperties(c.option.card)});
  return saved.every(c=>key(option(c))===key(option(saved[0])))&&actual.every(c=>key(option(c))===key(option(actual[0])));
}

export function matchFrame(frame,state) {
  if(key(frame.state)!==key(stateKey(state)))return null;
  const request=state.request;
  if(frame.request.kind==='multi'&&(!supportedMulti(frame.request,frame.type)||!supportedMulti(request,frame.type)))return null;
  const context=request.context??request.selectionContext;
  // Legacy core offers cancellation after a material was selected, where the
  // modern core may not. A positive selection is identical in both protocols;
  // never relax this for a saved cancel/finish response.
  const extraCancel=!!(frame.materialContext&&!frame.materialContext.cancelable&&context?.cancelable&&
    !frame.decision.cancel&&frame.decision.selection.length===1&&request.canCancel);
  const actual=extraCancel?{...request,canCancel:frame.request.canCancel}:request;
  if(frame.type==='SELECT_PLACE'&&frame.request.choices.some(c=>!cards[c.option?.code]))return null;
  if(key(requestKey(frame.request))!==key(requestKey(actual)))return null;
  if(frame.materialContext){
    if(context?.subtype!=='SELECT_UNSELECT_CARD')return null;
    for(const k of ['finishable','cancelable','selectCount','unselectCount'])if(context[k]!==frame.materialContext[k]&&!(k==='cancelable'&&extraCancel))return null;
  } else if(request.selectionContext?.subtype==='SELECT_UNSELECT_CARD') {
    return null;
  }
  const decision={...frame.decision,selection:[],counters:[]};
  if(request.kind==='single') {
    const wanted=normalOption(frame.request.choices.find(c=>c.id===frame.decision.action).option);
    const matches=request.choices.filter(c=>key(normalOption(c.option))===key(wanted));
    if(matches.length!==1){
      const saved=frame.request.choices.filter(c=>key(normalOption(c.option))===key(wanted));
      if(!interchangeableInitialHandChoices(frame,saved,matches))return null;
    }
    decision.action=matches[0].id;
  } else {
    const indices=frame.decision.selection;
    if(!Array.isArray(indices)||new Set(indices).size!==indices.length||indices.some(i=>!Number.isSafeInteger(i)||i<0||i>=frame.request.cards.length))return null;
    // Outside an audited ordinary Deck selection, a partial identical-reference
    // group would change physical copies. Hand/Grave/Removed remain ambiguous.
    const chosenCounts=new Map();
    for(const i of indices){const k=key(reference(frame.request.cards[i]));chosenCounts.set(k,(chosenCounts.get(k)||0)+1);}
    for(const [wanted,count] of chosenCounts){
      const saved=frame.request.cards.filter(c=>key(reference(c))===wanted);
      if(saved.length>1&&(frame.type!=='SELECT_CARD'||count!==saved.length)){
        const actual=request.cards.filter(c=>key(reference(c))===wanted);
        if(frame.type!=='SELECT_CARD'||!interchangeableDeckCopies(saved,actual,frame.deckCopyProof))return null;
      }
    }
    const used=new Set();
    for(const index of frame.decision.selection){const wanted=reference(frame.request.cards[index]);
      const found=request.cards.findIndex((c,i)=>!used.has(i)&&key(reference(c))===key(wanted));
      if(found<0)return null;used.add(found);decision.selection.push(found);
    }
  }
  return decision;
}

// Semantic remapping between independently initialized WASM duels. Never reuse raw indices.
export function semanticInput(source,target,input,replacements={}) {
  const s=source.prompt,t=target.prompt;assert.equal(t.type,s.type,'Different prompt history');
  const ref=c=>{const r=reference(c);if(r&&replacements[r.code])r.code=replacements[r.code];return r;};
  if(['SELECT_EFFECTYN','SELECT_YESNO'].includes(s.type)) {
    const context=g=>({player:g.pending.player,effect:effectKey(g.pending.description,true),
      ...(s.type==='SELECT_EFFECTYN'?{card:reference(g.pending)}:{})});
    // Negative answers carry no choice.card, but still belong to this exact
    // trigger/question. A generic hand-cost substitution cannot rename effects.
    assert.equal(key(context(source)),key(context(target)),'Different effect context');
  }
  if(input.selection){const used=new Set();return {...input,selection:input.selection.map(i=>{
    const c=s.cards[i];const wanted=c.place?c.place:ref(c);
    const j=t.cards.findIndex((v,n)=>!used.has(n)&&key(v.place||reference(v))===key(wanted));assert(j>=0,'Required target unavailable');used.add(j);return j;
  })};}
  const chosen=s.choices.find(c=>c.id===input.action);assert(chosen);
  const materialKind=(c,g)=>c.response.index===null?(g.pending.can_finish?'finish':'cancel'):
    c.response.index<g.pending.select_cards.length?'select':'unselect';
  const signature=(c,fromSource)=>({card:fromSource?ref(c.card):reference(c.card),
    response:Object.fromEntries(Object.entries(c.response).filter(([k])=>k!=='index')),
    ...(c.card?.description!==undefined?{effect:effectKey(c.card.description,true)}:{}),
    ...(s.type==='SELECT_OPTION'?{option:effectKey((fromSource?source:target).pending.options[c.response.index],true)}:{}),
    ...(s.type==='SELECT_CHAIN'?{empty:c.response.index===null}:{}),
    ...(s.type==='SELECT_UNSELECT_CARD'?{material:materialKind(c,fromSource?source:target)}:{})});
  const wanted=signature(chosen,true),matches=t.choices.filter(c=>key(signature(c,false))===key(wanted));
  assert(matches.length,'Required action unavailable');
  return {action:matches[0].id};
}
