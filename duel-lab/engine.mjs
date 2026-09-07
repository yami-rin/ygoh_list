import fs from 'node:fs';
import path from 'node:path';
import createCore,{OcgDuelMode as D,OcgMessageType as M,OcgQueryFlags as Q} from 'ocgcore-wasm';
import {DATA,cards,cardInfo,description} from './cards.mjs';
import {makePrompt,promptTypes,responseFor,publicPrompt} from './prompts.mjs';

const scripts=new Map();
function scriptReader(name) {
  if(scripts.has(name))return scripts.get(name);
  if(!/^[a-zA-Z0-9_./-]+\.lua$/.test(name)||name.includes('..'))return null;
  for(const dir of ['', 'official','pre-release','unofficial']) {
    const file=path.join(DATA,'scripts',dir,name);
    if(fs.existsSync(file)){const content=fs.readFileSync(file,'utf8');scripts.set(name,content);return content;}
  }
  return null;
}
const jsonSafe = value => JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v));
function shuffle(list,seed) {
  const a=[...list];let state=seed>>>0;
  const random=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
const queryFlags=Q.CODE|Q.POSITION|Q.ATTACK|Q.DEFENSE|Q.LEVEL|Q.RANK|Q.LINK|Q.IS_PUBLIC|Q.OVERLAY_CARD|Q.COUNTERS|Q.TYPE|Q.OWNER;
export const phaseNames={1:'DRAW',2:'STANDBY',4:'MAIN 1',8:'BATTLE',16:'BATTLE',32:'DAMAGE',64:'DAMAGE',128:'BATTLE',256:'MAIN 2',512:'END'};
export class Duel {
  static async create(decks,{seed=Date.now(),first=0,fixtures=null}={}) {
    const lib=await createCore({sync:true,wasmBinary:fs.readFileSync(path.join(DATA,'ocgcore.sync.wasm'))});
    const duel=new Duel();
    duel.lib=lib;duel.decks=decks;duel.seed=seed;duel.first=first;duel.fixture=!!fixtures;
    const team={startingLP:8000,startingDrawCount:fixtures?0:5,drawCountPerTurn:1};
    // Core player zero takes the first turn; UI player zero remains the human.
    duel.handle=lib.createDuel({flags:D.MODE_MR5 | (fixtures?D.PSEUDO_SHUFFLE:0n),seed:[BigInt(seed),2n,3n,4n],team1:team,team2:team,
      cardReader:code=>cards[code]?{...cards[code],race:BigInt(cards[code].race)}:null,
      scriptReader,errorHandler:(type,text)=>duel.errors.push(String(text))});
    if(!duel.handle)throw new Error('ルールエンジンを開始できません');
    for(const name of ['constant.lua','utility.lua'])lib.loadScript(duel.handle,name,scriptReader(name));
    for(let player=0;player<2;player++) {
      const team=player^first;
      for(const [key,location] of [['main',1],['extra',64]])for(const code of key==='main'&&!fixtures?shuffle(decks[player][key],seed+player*7919):decks[player][key])lib.duelNewCard(duel.handle,{code,team,controller:team,duelist:0,location,position:8,sequence:0});
    }
    if(fixtures)for(const c of fixtures)lib.duelNewCard(duel.handle,{duelist:0,position:1,sequence:0,...c});
    lib.startDuel(duel.handle);duel.advance();return duel;
  }
  constructor(){this.revision=0;this.turn=0;this.turnPlayer=0;this.phase=1;this.lp=[8000,8000];this.log=[];this.errors=[];this.inputs=[];this.chain=[];this.pending=null;this.status='playing';this.hint='';}
  emit(text,extra={}){this.log.push({id:this.log.length+1,turn:this.turn,text,...extra});}
  advance() {
    let last=this.pending;
    this.pending=null;
    for(let i=0;i<5000;i++) {
      const result=this.lib.duelProcess(this.handle);
      const messages=this.lib.duelGetMessage(this.handle).filter(Boolean);
      for(const m of messages) {
        if(m.type===M.RETRY){this.pending=last;this.revision++;this.validationError='エンジンがこの選択を拒否しました。素材・対象を選び直してください。';return;}
        if(promptTypes.has(m.type))this.pending=m;
        this.record(m);
      }
      if(this.errors.length) {this.status='error';throw new Error(`効果処理エラー: ${this.errors.at(-1)}`);}
      if(result===0){this.status='ended';this.pending=null;this.revision++;return;}
      if(result===2)continue;
      if(!this.pending)throw new Error('エンジンが未対応の応答を要求しました');
      this.prompt=makePrompt(this.pending,this.hint);
      // Only empty chain windows are mechanically skipped. No optional decision is delegated to a bot.
      if(this.pending.type===M.SELECT_CHAIN && !this.pending.selects.length && !this.pending.forced){this.lib.duelSetResponse(this.handle,this.prompt.choices[0].response);last=this.pending;this.pending=null;continue;}
      this.revision++;return;
    }
    throw new Error('効果処理の上限を超えました');
  }
  record(m) {
    const who=p=>(p^this.first)===0?'YOU':'ASTRA';
    if(m.type===M.HINT && m.hint_type===3)this.hint=description(m.hint);
    switch(m.type) {
      case M.NEW_TURN:this.turn++;this.turnPlayer=m.player;this.emit(`${who(m.player)} のターン`);break;
      case M.NEW_PHASE:this.phase=m.phase;this.emit(phaseNames[m.phase]||`PHASE ${m.phase}`);break;
      case M.DRAW:this.emit(`${who(m.player)} が ${m.drawn.length} 枚ドロー`);break;
      case M.DAMAGE:this.lp[m.player]-=m.amount;this.emit(`${who(m.player)} に ${m.amount} ダメージ`);break;
      case M.RECOVER:this.lp[m.player]+=m.amount;this.emit(`${who(m.player)} が ${m.amount} LP回復`);break;
      case M.PAY_LPCOST:this.lp[m.player]-=m.amount;this.emit(`${who(m.player)} が ${m.amount} LPを支払う`);break;
      case M.LPUPDATE:this.lp[m.player]=m.lp;break;
      case M.SUMMONING:case M.SPSUMMONING:case M.FLIPSUMMONING:this.emit(`${who(m.controller)}：${cardInfo(m.code).name} を${m.type===M.SUMMONING?'召喚':'特殊召喚'}`,{code:m.code,event:'summon'});break;
      case M.CHAINING:this.chain.push({code:m.code,player:m.controller^this.first,size:m.chain_size});this.emit(`CHAIN ${m.chain_size}：${cardInfo(m.code).name}`,{code:m.code,event:'chain'});break;
      case M.CHAIN_SOLVING:this.emit(`CHAIN ${m.chain_size} 解決`,{event:'resolve'});break;
      case M.CHAIN_NEGATED:case M.CHAIN_DISABLED:this.emit(`CHAIN ${m.chain_size} 無効`,{event:'negate'});break;
      case M.CHAIN_END:this.chain=[];break;
      case M.CONFIRM_CARDS:case M.CONFIRM_DECKTOP:case M.CONFIRM_EXTRATOP:
        this.emit(`確認：${m.cards.map(c=>cardInfo(c.code).name).join('、')}`,{audience:m.player^this.first});break;
      case M.WIN:this.winner=m.player===2?2:m.player^this.first;this.reason=m.reason;this.status='ended';this.emit(this.winner===2?'DRAW':`${this.winner===0?'YOU':'ASTRA'} WIN`);break;
    }
  }
  respond(player,revision,input) {
    if(this.status!=='playing'||!this.pending)throw new Error('現在は入力できません');
    if(revision!==this.revision)throw new Error('盤面が更新されました。新しい選択肢で操作してください');
    if((this.pending.player^this.first)!==player)throw new Error('相手の選択待ちです');
    const response=responseFor(this.pending,this.prompt,input);
    this.inputs.push({revision,player,input:jsonSafe(input),response:jsonSafe(response)});
    this.validationError=null;this.lib.duelSetResponse(this.handle,response);
    try{this.advance();}catch(e){this.status='error';this.failure=e.message;this.pending=null;this.revision++;this.emit(e.message,{event:'error'});throw e;}
    return this.snapshot(player);
  }
  snapshot(viewer=0) {
    const players=[0,1].map(uiPlayer=>{
      const controller=uiPlayer^this.first;
      const zones={};
      for(const [key,location] of [['hand',2],['monsters',4],['spells',8],['grave',16],['banished',32],['extra',64]]) {
        zones[key]=this.lib.duelQueryLocation(this.handle,{controller,location,flags:queryFlags}).map((c,sequence)=>{
          if(!c?.code)return null;
          const visible=(location===2?(uiPlayer===viewer || c.isPublic):location===64?(uiPlayer===viewer || !!(c.position&5)):location===16?true:uiPlayer===viewer || !!(c.position&5));
          if(!visible)return {hidden:true,position:c.position,controller:uiPlayer,location,sequence};
          return {...cardInfo(c.code),...jsonSafe(c),controller:uiPlayer,location,sequence};
        });
      }
      return {player:uiPlayer,lp:this.lp[controller],deckCount:this.lib.duelQueryCount(this.handle,controller,1),...zones};
    });
    const mine=this.pending && (this.pending.player^this.first)===viewer;
    let prompt=mine?jsonSafe(publicPrompt(this.prompt)):null;
    if(prompt){
      prompt.player=viewer;
      const remap=c=>{
        if(c.controller!==undefined){
          const ui=c.controller^this.first;
          if(ui!==viewer && [2,4,8,32,64].includes(c.location)){
            const q=this.lib.duelQuery(this.handle,{controller:c.controller,location:c.location,sequence:c.sequence,overlaySequence:0,flags:Q.CODE|Q.POSITION|Q.IS_PUBLIC});
            if(q && !q.isPublic && (c.location===2 || c.location===64 || !(q.position&5))){
              const safe={code:0,name:'非公開カード',label:'非公開カード',hidden:true,controller:c.controller,location:c.location,sequence:c.sequence,position:q.position};
              for(const k of Object.keys(c))delete c[k];Object.assign(c,safe);
            }
          }
          c.controller=ui;
        }
        if(c.place)c.place.player^=this.first;
        if(c.location)c.detail=`${c.controller===0?'YOU':'ASTRA'} / ${{1:'山札',2:'手札',4:'モンスター',8:'魔法・罠',16:'墓地',32:'除外',64:'EX'}[c.location]||c.location} ${c.sequence+1}`;
      };
      prompt.cards?.forEach(remap);prompt.must?.forEach(remap);prompt.choices.forEach(c=>{if(c.card){remap(c.card);if(c.card.hidden)c.label='非公開カードを選択';}});
    }
    return {revision:this.revision,status:this.status,error:this.failure,winner:this.winner,turn:this.turn,turnPlayer:this.turnPlayer^this.first,phase:phaseNames[this.phase]||'—',players,chain:this.chain,
      prompt,waitingFor:this.pending?(this.pending.player^this.first):null,
      log:this.log.filter(e=>e.audience===undefined||e.audience===viewer).slice(-160),validationError:mine?this.validationError:null};
  }
  surrender(player){this.status='ended';this.winner=player^1;this.pending=null;this.revision++;this.emit(`${player===0?'YOU':'ASTRA'} が降参`);}
  close(){if(this.handle){this.lib.destroyDuel(this.handle);this.handle=null;}}
}
