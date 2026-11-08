// Convert board-move replays (duel-simulator) into verified engine routes.
// Search is guided by the replay: the engine's summons must follow the replay's summon order,
// and the route ends when our field, Spell/Trap zones and hand equal the replay's final board.
// Usage: node scripts/import-replays.mjs [replayId ...]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {respond,board,hash,finishRoute} from './route-harness.mjs';
import {Duel} from '../engine.mjs';
import {enumerateCandidates} from './search-kernel.mjs';
import {cardInfo} from '../cards.mjs';

const BLANK=6325660; // 霆王の閃光: stands in for hand cards the replay leaves unnamed
const FIELD=new Set(['monsterZone','extraMonsterZone']);
const deckFile=new URL('../presets/user-malice.json',import.meta.url);
const sourceFile=new URL('../routes/user-replays.source.json',import.meta.url);
const outFile=new URL('../routes/user-replays.json',import.meta.url);
const multiset=list=>[...list].sort((a,b)=>a-b);

// Same fixture as route-harness startRoute, for a deck other than preset.json
// (route-harness.mjs is hash-pinned by the search evidence, so it is not changed).
export const deckHash=deck=>hash({main:deck.main,extra:deck.extra});
export async function startDeckRoute(hand,{seed=123,deck}) {
  const own={main:[...deck.main],extra:[...deck.extra]};
  for(const code of hand){const i=own.main.indexOf(code);assert(i>=0,'Hand must be taken from the deck');own.main.splice(i,1);}
  const g=await Duel.create([own,{main:deck.main,extra:deck.extra}],{seed,fixtures:hand.map(code=>({code,team:0,controller:0,location:2,position:8}))});
  g.route={hand:[...hand],seed,presetHash:deckHash(deck),steps:[]};
  return g;
}

export function replayPlan(replay) {
  const hand=replay.hand.length?replay.hand.map(c=>c??BLANK):[replay.events[0].code];
  const summons=replay.events.filter(e=>e.code&&FIELD.has(e.to.type)).map(e=>({code:e.code,to:e.to}));
  const at=new Map();
  for(const e of replay.events)at.set(e.ref,e);
  const final={monsters:[],spells:[],hand:[],grave:[],banished:[]};
  for(const e of at.values()){
    if(!e.code)continue;
    const z=e.to.type;
    if(FIELD.has(z))final.monsters.push(e.code);
    else if(z==='spellTrapZone'||z==='fieldZone')final.spells.push(e.code);
    else if(z==='hand')final.hand.push(e.code);
    else if(z==='graveyard')final.grave.push(e.code);
    else if(z==='banished')final.banished.push(e.code);
  }
  // Starting hand cards that never moved stay in hand.
  const moved=new Set(replay.events.map(e=>e.code));
  for(const c of hand)if(c!==BLANK&&!moved.has(c)&&replay.hand.length)final.hand.push(c);
  for(const k of Object.keys(final))final[k]=multiset(final[k]);
  return {hand,summons,final,events:replay.events.filter(e=>e.code)};
}

function ownBoard(g) {
  const p=board(g).players[0],codes=z=>multiset(p[z].filter(c=>c?.code).map(c=>c.code));
  return {monsters:codes('monsters'),spells:codes('spells'),hand:codes('hand').filter(c=>c!==BLANK),grave:codes('grave'),banished:codes('banished')};
}
const matches=(g,plan)=>{const b=ownBoard(g);return ['monsters','spells','hand'].every(k=>JSON.stringify(b[k])===JSON.stringify(plan.final[k]));};
const summonCodes=g=>g.log.filter(e=>e.event==='summon'&&e.text.startsWith('YOU')).map(e=>e.code);

// Prefer options that involve the next summoned card, then cards the replay moves soon.
function ordered(g,plan,done) {
  const p=g.prompt,next=plan.summons[done],soon=new Set(plan.events.slice(0).map(e=>e.code));
  const cardsOf=input=>input.action!==undefined?[p.choices.find(c=>c.id===input.action)?.card].filter(Boolean):(input.selection||[]).map(i=>p.cards?.[i]).filter(Boolean);
  const score=input=>{
    if(input.action!==undefined){const label=p.choices.find(c=>c.id===input.action)?.label||'';if(/ターンを終了|バトルフェイズ/.test(label))return -1000;}
    if(p.type==='SELECT_PLACE'&&next&&input.selection){
      const place=p.cards[input.selection[0]]?.place,want=next.to;
      const seq=want.type==='extraMonsterZone'?5+want.index:want.index;
      return place&&place.location===4&&place.sequence===seq?10:0;
    }
    return cardsOf(input).reduce((n,c)=>n+(next&&c.code===next.code?10:soon.has(c.code)?2:-1),0)-(input.selection?.length||0)*0.1;
  };
  return [...enumerateCandidates(p,g.pending)].map((input,i)=>({input,s:score(input),i})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.input);
}

export async function importReplay(replay,deck,{maxRuns=Number(process.env.MAX_RUNS||20000),seed=123}={}) {
  const plan=replayPlan(replay);
  const stack=[[]],seen=new Set();let runs=0,best=null;
  while(stack.length&&runs<maxRuns){
    const path=stack.pop();runs++;
    const g=await startDeckRoute(plan.hand,{seed,deck});
    try{
      let ok=true;
      for(const input of path){respond(g,input);}
      const done=summonCodes(g);
      ok=done.every((c,i)=>plan.summons[i]?.code===c);
      if(!ok)continue;
      if(!best||done.length>best.done)best={done:done.length,prompt:g.prompt?.type,title:g.prompt?.title,options:g.prompt?.choices?.map(c=>c.label).concat((g.prompt?.cards||[]).map(c=>c.label)),log:g.log.slice(-12).map(e=>e.text)};
      if(g.turn!==1||!g.pending)continue;
      if(done.length===plan.summons.length&&g.prompt.type==='SELECT_IDLECMD'&&matches(g,plan))
        return {plan,runs,route:finishRoute(g,{id:`user-replay-${replay.id}`,title:replay.title,source:replay.url,deck:'presets/user-malice.json'}),board:ownBoard(g)};
      if(path.length>220)continue;
      const key=hash({b:board(g),p:g.pending,d:done.length,r:g.inputs.slice(-3).map(i=>i.response)});
      if(seen.has(key))continue;seen.add(key);
      const options=ordered(g,plan,done.length);
      for(let i=options.length-1;i>=0;i--)stack.push([...path,options[i]]);
    }catch{/* rejected response: dead branch */}
    finally{g.close();}
  }
  return {plan,runs,route:null,best};
}

if(import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
  const deck=JSON.parse(fs.readFileSync(deckFile));
  const source=JSON.parse(fs.readFileSync(sourceFile));
  const only=process.argv.slice(2);
  const previous=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile)).routes:[];
  const routes=[...previous];
  for(const replay of source.replays.filter(r=>!only.length||only.includes(r.id))){
    const started=Date.now();
    const result=await importReplay(replay,deck);
    const name=c=>cardInfo(c).name;
    console.log(`${replay.title}: ${result.route?'再現':'未再現'} (${result.runs}回, ${Math.round((Date.now()-started)/1000)}秒)`);
    if(!result.route){console.log('  到達:',result.best?.done,'/',result.plan.summons.length,'次:',result.plan.summons.slice(result.best?.done,result.best?.done+3).map(s=>cardInfo(s.code).name).join(' → '));console.log('  ',JSON.stringify(result.best).slice(0,900));continue;}
    const diff=k=>JSON.stringify(result.board[k])===JSON.stringify(result.plan.final[k])?null:{engine:result.board[k].map(name),replay:result.plan.final[k].map(name)};
    result.route.graveDiff=diff('grave');result.route.banishedDiff=diff('banished');
    if(result.route.graveDiff||result.route.banishedDiff)console.log('  墓地・除外の差:',JSON.stringify({grave:result.route.graveDiff,banished:result.route.banishedDiff}));
    const i=routes.findIndex(r=>r.id===result.route.id);if(i>=0)routes[i]=result.route;else routes.push(result.route);
  }
  assert(routes.every(r=>r.presetHash===deckHash(deck)));
  if(routes.length)fs.writeFileSync(outFile,JSON.stringify({schemaVersion:1,deck:'presets/user-malice.json',presetHash:deckHash(deck),routes},null,1)+'\n');
}
