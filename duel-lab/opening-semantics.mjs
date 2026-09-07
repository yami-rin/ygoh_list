import assert from 'node:assert/strict';
import {cards} from './cards.mjs';

const locations={1:'Deck',2:'Hand',4:'MonsterZone',8:'SpellZone',16:'Grave',32:'Removed',64:'Extra'};
const phase=p=>String(p).replace(/[ _]/g,'').toUpperCase();
export function effectKey(value,modern=false) {
  if(value===undefined||value===null)return null;
  const v=BigInt(value),shift=modern?20n:4n,code=Number(v>>shift),index=Number(v&((1n<<shift)-1n));
  return code&&cards[code]?`card:${code}:${index}`:`system:${v}`;
}
function oldDescription(value){if(value===undefined)return undefined;const v=BigInt(value),code=Number(v>>20n);return code?code*16+Number(v&0xfffffn):Number(v);}
const loc=value=>typeof value==='number'?locations[value]:({Monster:'MonsterZone',Spell:'SpellZone',Banished:'Removed',Graveyard:'Grave',ExtraDeck:'Extra'}[value]||value);
export function reference(card) {
  if(!card)return null;
  const location=loc(card.location);
  return {code:card.code,controller:card.controller,location,...(['MonsterZone','SpellZone'].includes(location)?{sequence:card.sequence}:{})};
}
const key=value=>JSON.stringify(value);
const ordered=values=>values.map(key).sort();
const toCard=c=>c?{code:c.code,controller:1-c.controller,location:loc(c.location),sequence:c.sequence,position:c.position}:null;
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
      for(const c of p.choices)add(c.card?{card:toCard(c.card),description:oldDescription(c.card.description)}:'チェーンしない',c===selected);
      request={kind:'single',title:'チェーンの選択',choices};break;
    case 'SELECT_EFFECTYN':case 'SELECT_YESNO': {
      const d=oldDescription(m.description);
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
      const picked=p.cards[input.selection[0]].place;
      const eligible=p.cards.filter(c=>c.place.player===picked.player&&c.place.location===picked.location);
      for(const c of eligible)add({code:m.code||0,controller:1-c.place.player,location:loc(c.place.location),mask:1<<c.place.sequence},c.place.sequence===picked.sequence);
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
  return {state:stateKey(state),request,decision,automatic,type:p.type,materialContext:p.type==='SELECT_UNSELECT_CARD'?{
    finishable:!!m.can_finish,cancelable:!!m.can_cancel,selectCount:m.select_cards.length,unselectCount:m.unselect_cards.length}:null};
}

export function matchFrame(frame,state) {
  if(key(frame.state)!==key(stateKey(state)))return null;
  const request=state.request;
  const context=request.context??request.selectionContext;
  // Legacy core offers cancellation after a material was selected, where the
  // modern core may not. A positive selection is identical in both protocols;
  // never relax this for a saved cancel/finish response.
  const extraCancel=!!(frame.materialContext&&!frame.materialContext.cancelable&&context?.cancelable&&
    !frame.decision.cancel&&frame.decision.selection.length===1&&request.canCancel);
  // Placement packets omit card id in modern core; the native client supplies it from its move queue.
  const scrub=r=>r.title==='配置先'?{...r,choices:r.choices.map(c=>({...c,option:{...c.option,code:0}}))}:r;
  const actual=extraCancel?{...request,canCancel:frame.request.canCancel}:request;
  if(key(requestKey(scrub(frame.request)))!==key(requestKey(scrub(actual))))return null;
  if(frame.materialContext){
    if(context?.subtype!=='SELECT_UNSELECT_CARD')return null;
    for(const k of ['finishable','cancelable','selectCount','unselectCount'])if(context[k]!==frame.materialContext[k]&&!(k==='cancelable'&&extraCancel))return null;
  } else if(request.selectionContext?.subtype==='SELECT_UNSELECT_CARD') {
    return null;
  }
  const decision={...frame.decision,selection:[],counters:[]};
  if(request.kind==='single') {
    const wanted=normalOption(scrub(frame.request).choices.find(c=>c.id===frame.decision.action).option);
    const matches=scrub(request).choices.filter(c=>key(normalOption(c.option))===key(wanted));
    if(matches.length!==1)return null;decision.action=matches[0].id;
  } else {
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
  if(input.selection){const used=new Set();return {...input,selection:input.selection.map(i=>{
    const c=s.cards[i];const wanted=c.place?c.place:ref(c);
    const j=t.cards.findIndex((v,n)=>!used.has(n)&&key(v.place||reference(v))===key(wanted));assert(j>=0,'Required target unavailable');used.add(j);return j;
  })};}
  const chosen=s.choices.find(c=>c.id===input.action);assert(chosen);
  const signature=(c,fromSource)=>({card:fromSource?ref(c.card):reference(c.card),
    response:Object.fromEntries(Object.entries(c.response).filter(([k])=>k!=='index')),
    ...(c.card?.description!==undefined?{effect:effectKey(c.card.description,true)}:{}),
    ...(s.type==='SELECT_OPTION'?{option:effectKey((fromSource?source:target).pending.options[c.response.index],true)}:{}),
    ...(s.type==='SELECT_CHAIN'||s.type==='SELECT_UNSELECT_CARD'?{empty:c.response.index===null}:{})});
  const wanted=signature(chosen,true),matches=t.choices.filter(c=>key(signature(c,false))===key(wanted));
  assert(matches.length,'Required action unavailable');
  return {action:matches[0].id};
}
