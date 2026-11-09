import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {customCards} from '../custom-cards.mjs';
import {parseDeck} from '../cards.mjs';
import {Duel} from '../engine.mjs';

// Sample decks of the 9 original themes (friend-kit/decks/*.ydk, shipped to MDPro3 by scripts/build-friend-kit.py).
// Each deck must be legal under 2026.7 and play its opening: a mirror match with a greedy player that summons and
// activates whatever it can, for the first 4 turns, without an effect-processing error.
const DECKS=new URL('../friend-kit/decks/',import.meta.url);
const limits=JSON.parse(fs.readFileSync(new URL('../limits-202607.json',import.meta.url)));
const THEMES={CHAIN_CODE:'chain-code.json',DECLINE:'decline.json',STORM_FLOW:'storm-flow.json',GOKASOU:'gokasou.json',
  YOIKOKUJIN:'yoikokujin.json',CANON_WITCH:'canon-witch.json',KAMIORI:'kamiori.json',CHITSUJO:'chitsujo.json',CURSED:'cursed.json'};
const SEEDS=[1,2,3];
const TURNS=4;

function combos(n,k,limit){
  const out=[],idx=[...Array(k).keys()];
  if(k>n)return out;
  for(;;){
    out.push([...idx]);if(out.length>=limit)return out;
    let i=k-1;while(i>=0&&idx[i]===n-k+i)i--;
    if(i<0)return out;
    idx[i]++;for(let j=i+1;j<k;j++)idx[j]=idx[j-1]+1;
  }
}

// One answer to the current prompt; returns false when nothing valid was found.
function act(g,used){
  const player=g.pending.player^g.first,p=g.prompt;
  const send=input=>{
    const revision=g.revision;
    try{g.respond(player,revision,input,{snapshot:false});}catch(e){if(g.status==='error')throw e;return false;}
    return !g.validationError;
  };
  if(p.mode==='single'){
    const label=c=>`${player}:${g.turn}:${c.label}`;
    let choice;
    if(p.type==='SELECT_IDLECMD'||p.type==='SELECT_BATTLECMD'){
      const tries=c=>(used.get(label(c))||0)<2;
      for(const prefix of ['効果発動：','召喚：','特殊召喚：','魔法・罠セット：']){
        choice=p.choices.find(c=>c.label.startsWith(prefix)&&tries(c));if(choice)break;
      }
      if(used.get(`${player}:${g.turn}:actions`)>=30)choice=null;
      choice??=p.choices.find(c=>c.label==='ターンを終了')??p.choices.find(c=>c.label==='メインフェイズ2へ');
      used.set(`${player}:${g.turn}:actions`,(used.get(`${player}:${g.turn}:actions`)||0)+1);
    }else if(p.type==='SELECT_CHAIN'){
      choice=p.choices.find(c=>c.label!=='発動しない'&&(used.get(label(c))||0)<2)??p.choices.find(c=>c.label==='発動しない')??p.choices[0];
    }else if(p.type==='SELECT_UNSELECT_CARD'){
      choice=p.choices.find(c=>c.label.startsWith('選択：'))??p.choices.find(c=>c.label==='選択を確定'||c.label==='キャンセル');
    }else choice=p.choices[0];  // はい / first option / attack position / first number
    if(choice){used.set(label(choice),(used.get(label(choice))||0)+1);if(send({action:choice.id}))return true;}
    for(const c of p.choices)if(c!==choice&&send({action:c.id}))return true;
    return false;
  }
  if(p.mode==='order')return send({selection:p.cards.map((_,i)=>i)});
  if(p.mode==='announce')return send({selection:[0]});
  if(p.mode==='counter'){
    let left=p.count;const counters=p.cards.map(c=>{const n=Math.min(c.count,left);left-=n;return n;});
    return send({selection:[],counters});
  }
  // Prefer the acting player's own original cards outside the field (search, send, revive targets), then the rest.
  const own=c=>c.code>=77700000&&c.code<77800000&&c.controller===g.pending.player&&[1,2,16,32,64].includes(c.location);
  const order=[...p.cards.keys()].sort((a,b)=>own(p.cards[b])-own(p.cards[a]));
  const n=order.length,max=Math.min(p.max??n,n);
  for(let k=Math.max(p.min??1,1);k<=max;k++)for(const pick of combos(n,k,200))if(send({selection:pick.map(i=>order[i])}))return true;
  return p.canCancel?send({selection:[],cancel:true}):false;
}

async function play(text,seed){
  const deck=parseDeck(text,limits);
  const g=await Duel.create([deck,deck],{seed});
  const used=new Map();
  try{
    for(let step=0;step<3000&&g.status==='playing'&&g.turn<=TURNS;step++)assert(act(g,used),`no valid answer: ${g.prompt?.type} ${g.prompt?.title}`);
    assert.deepEqual(g.errors,[]);
    assert.notEqual(g.status,'error',g.failure);
    return {log:g.log,turn:g.turn,status:g.status};
  }finally{g.close();}
}

for(const [name,theme] of Object.entries(THEMES)){
  test(`sample deck ${name}: legal under 2026.7 and opens without engine errors`,async()=>{
    const text=fs.readFileSync(new URL(`${name}.ydk`,DECKS),'utf8');
    const deck=parseDeck(text,limits);
    assert(deck.main.length>=40&&deck.main.length<=60&&deck.extra.length<=15);
    const codes=new Set(customCards.filter(c=>c.custom===theme).map(c=>c.code));
    assert(deck.main.filter(c=>codes.has(c)).length>=18,'theme cards are the core of the deck');
    let opened=0;
    for(const seed of SEEDS){
      const {log,turn,status}=await play(text,seed);
      const summons=log.filter(e=>e.event==='summon'&&codes.has(e.code)).length;
      const effects=log.filter(e=>e.event==='chain'&&codes.has(e.code)).length;
      console.log(`${name} seed ${seed}: turn ${turn} ${status}, theme summons ${summons}, theme activations ${effects}`);
      if(summons&&effects)opened++;
    }
    assert(opened>0,`${name}: no seed summoned and activated a theme card`);
  });
}
