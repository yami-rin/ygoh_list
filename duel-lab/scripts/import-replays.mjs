// Convert board-move replays (duel-simulator) into verified engine routes.
// Search is guided by the replay: the engine's summons must follow the replay's summon order,
// and the route ends when our field, Spell/Trap zones and hand equal the replay's final board.
// Usage: node scripts/import-replays.mjs [replayId ...]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {respond,board,hash,finishRoute} from './route-harness.mjs';
import {Duel} from '../engine.mjs';
import {enumerateCandidates} from './search-kernel.mjs';
import {dedupeCopies,pointless} from './prune-rules.mjs';
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
  // One-card starters are recorded without the rest of the hand, but costs such as
  // Backup@Ignister's discard need it: fill with dead cards (the deck has three BLANKs).
  const hand=replay.hand.length?replay.hand.map(c=>c??BLANK):[replay.events[0].code,BLANK,BLANK,BLANK];
  // Each summon remembers the monsters the replay sent from the field since the previous summon (its materials).
  const summons=[];let leaving=[];
  for(const e of replay.events){
    if(!e.code)continue;
    if(FIELD.has(e.from.type)&&!FIELD.has(e.to.type))leaving.push(e.code);
    if(FIELD.has(e.to.type)){summons.push({code:e.code,to:e.to,materials:leaving});leaving=[];}
  }
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
// Draws are unknown to the replay (e.g. WHITE BINDER ③): the engine hand may hold that many extra cards.
const drawn=g=>g.log.filter(e=>/^YOU が \d+ 枚ドロー/.test(e.text)&&e.turn===1).reduce((n,e)=>n+Number(/(\d+) 枚/.exec(e.text)[1]),0);
const matches=(g,plan)=>{
  const b=ownBoard(g);
  if(!['monsters','spells'].every(k=>JSON.stringify(b[k])===JSON.stringify(plan.final[k])))return false;
  return contains(b.hand,plan.final.hand)&&b.hand.length-plan.final.hand.length<=drawn(g);
};
const contains=(big,small)=>{const left=[...big];return small.every(c=>{const i=left.indexOf(c);if(i<0)return false;left.splice(i,1);return true;});};
// Summons logged back to back by one resolution (e.g. Wizard@Ignister ① summons two monsters at once)
// form a group whose order is not meaningful. Separate effects must keep the replay's order.
export function summonGroups(log) {
  const groups=[];let last=null;
  for(const e of log){
    const ours=e.event==='summon'&&e.text.startsWith('YOU');
    if(ours){if(last===groups.length-1&&last>=0&&groups[last].open)groups[last].codes.push(e.code);else groups.push({codes:[e.code],open:true});last=groups.length-1;}
    else if(groups.length)groups.at(-1).open=false;
  }
  return groups.map(g=>g.codes);
}
export const sameOrderish=(groups,want)=>{
  let i=0;
  for(const codes of groups){const part=want.slice(i,i+codes.length);if(part.length<codes.length||!contains(part,codes))return false;i+=codes.length;}
  return true;
};
const summonCodes=g=>summonGroups(g.log).flat();

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
    const value=cardsOf(input).reduce((n,c)=>n+(next&&c.code===next.code?10:soon.has(c.code)?2:-1),0);
    // Discarding is a cost: keep the cards the replay still needs.
    if(/捨て/.test(p.title)){
      // Discard what the replay discards (hand → graveyard); otherwise keep cards the replay still needs.
      const discarded=new Set(plan.events.filter(e=>e.from.type==='hand'&&e.to.type==='graveyard').map(e=>e.code));
      return cardsOf(input).reduce((n,c)=>n+(discarded.has(c.code)?20:0),0)-value;
    }
    return value-(input.selection?.length||0)*0.1;
  };
  return prune(g,plan,done,[...enumerateCandidates(p,g.pending)]).map((input,i)=>({input,s:score(input),i})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.input);
}

// Shared rules (prune-rules.mjs) plus replay-specific ones: never touch a card the replay never moves,
// and place a summoned monster only in the zone the replay used.
function prune(g,plan,done,inputs) {
  const p=g.prompt,moved=new Set(plan.events.map(e=>e.code)),next=plan.summons[done];
  let kept=dedupeCopies(p,inputs).filter(input=>!pointless(p,input,{summonsLeft:plan.summons.length-done}));
  if(p.type==='SELECT_IDLECMD')kept=kept.filter(input=>{const c=p.choices.find(x=>x.id===input.action)?.card;return !c||moved.has(c.code);});
  // Link materials: only the monsters the replay sent off the field for this summon.
  if(p.type==='SELECT_UNSELECT_CARD'&&next?.materials.length){
    const want=new Set(next.materials);
    const fit=kept.filter(input=>{const c=p.choices.find(x=>x.id===input.action);return !c?.label.startsWith('選択：')||want.has(c.card?.code);});
    const isPick=input=>p.choices.find(x=>x.id===input.action)?.label.startsWith('選択：');
    if(fit.some(isPick))kept=fit;
    // The replay's materials are all chosen: finish instead of adding extra ones.
    else if(kept.some(input=>!isPick(input)))kept=kept.filter(input=>!isPick(input));
  }
  if(p.type==='SELECT_PLACE'&&next){
    const seq=next.to.type==='extraMonsterZone'?5+next.to.index:next.to.index;
    const exact=kept.filter(input=>{const place=p.cards[input.selection?.[0]]?.place;return place?.location===4&&place.sequence===seq;});
    if(exact.length)kept=exact;
  }
  return kept;
}

export async function importReplay(replay,deck,{maxRuns=Number(process.env.MAX_RUNS||20000),seconds=Number(process.env.TIME_LIMIT||900),seed=123}={}) {
  const deadline=Date.now()+seconds*1000;
  const plan=replayPlan(replay);
  // Progress-first search: always expand a line that has matched the most replay summons so far.
  const buckets=[[[]]],seen=new Set();let runs=0,best=null;
  const pop=()=>{for(let d=buckets.length-1;d>=0;d--)if(buckets[d]?.length)return buckets[d].pop();return null;};
  let path;
  while(runs<maxRuns&&Date.now()<deadline&&(path=pop())){
    runs++;
    const g=await startDeckRoute(plan.hand,{seed,deck});
    try{
      let ok=true;
      for(const input of path){respond(g,input);}
      const done=summonCodes(g);
      // Simultaneous summons (e.g. Wizard@Ignister ①) may be logged in either order: allow adjacent swaps.
      ok=sameOrderish(summonGroups(g.log),plan.summons.map(s=>s.code));
      if(!ok)continue;
      if(!best||done.length>best.done)best={path,done:done.length,summoned:[...done],prompt:g.prompt?.type,title:g.prompt?.title,options:g.prompt?.choices?.map(c=>c.label).concat((g.prompt?.cards||[]).map(c=>c.label)),log:g.log.slice(-12).map(e=>e.text)};
      // All summons matched but the board differs: remember the closest final board.
      if(done.length===plan.summons.length&&g.prompt?.type==='SELECT_IDLECMD'&&!best.finalBoard)best.finalBoard=ownBoard(g);
      if(g.turn!==1||!g.pending)continue;
      if(done.length===plan.summons.length&&contains(done,plan.summons.map(x=>x.code))&&g.prompt.type==='SELECT_IDLECMD'&&matches(g,plan))
        return {plan,runs,route:finishRoute(g,{id:`user-replay-${replay.id}`,title:replay.title,source:replay.url,deck:'presets/user-malice.json'}),board:ownBoard(g)};
      if(path.length>220)continue;
      const key=hash({b:board(g),p:g.pending,d:done.length,r:g.inputs.slice(-3).map(i=>i.response)});
      if(seen.has(key))continue;seen.add(key);
      const options=ordered(g,plan,done.length);
      const bucket=(buckets[done.length]??=[]);
      for(let i=options.length-1;i>=0;i--)bucket.push([...path,options[i]]);
    }catch{/* rejected response: dead branch */}
    finally{g.close();}
  }
  return {plan,runs,route:null,best};
}

// Human-readable account of where an unreproduced replay stopped, for feedback from the deck owner.
export function explain(result) {
  const name=c=>cardInfo(c).name,b=result.best,done=b?.done??0,{summons}=result.plan;
  const lines=summons.map((s,i)=>`  ${i<done?'✓':i===done?'✗':'・'} ${i+1}. ${name(s.code)}${s.materials.length?`（素材：${s.materials.map(name).join('＋')}）`:''}`);
  const out=[`  リプレイの召喚 ${done}/${summons.length} まで再現`,...lines];
  if(b){
    out.push(`  エンジンの召喚順：${b.summoned.map(name).join(' → ')}`);
    if(b.finalBoard)for(const [k,label] of [['monsters','場'],['spells','魔法罠'],['hand','手札']])
      if(JSON.stringify(b.finalBoard[k])!==JSON.stringify(result.plan.final[k]))
        out.push(`  最終盤面の差（${label}）：エンジン ${b.finalBoard[k].map(name).join('、')||'なし'} ／ リプレイ ${result.plan.final[k].map(name).join('、')||'なし'}`);
    out.push(`  エンジンの直前の動き：${b.log.filter(t=>/召喚|CHAIN \d+：|ドロー|LP/.test(t)).slice(-5).join(' / ')}`);
    out.push(`  止まった局面：${b.title}`);
    out.push(`  選べた行動：${(b.options||[]).join(' / ')}`);
  }
  return out.join('\n');
}

if(process.argv[1]&&import.meta.url===`file:///${process.argv[1].replace(/\\/g,'/')}`){
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
    if(!result.route){console.log(explain(result));continue;}
    const diff=k=>JSON.stringify(result.board[k])===JSON.stringify(result.plan.final[k])?null:{engine:result.board[k].map(name),replay:result.plan.final[k].map(name)};
    result.route.graveDiff=diff('grave');result.route.banishedDiff=diff('banished');
    if(result.route.graveDiff||result.route.banishedDiff)console.log('  墓地・除外の差:',JSON.stringify({grave:result.route.graveDiff,banished:result.route.banishedDiff}));
    const i=routes.findIndex(r=>r.id===result.route.id);if(i>=0)routes[i]=result.route;else routes.push(result.route);
    // Save after every reproduced replay so a later interruption keeps it.
    assert(routes.every(r=>r.presetHash===deckHash(deck)));
    fs.writeFileSync(outFile,JSON.stringify({schemaVersion:1,deck:'presets/user-malice.json',presetHash:deckHash(deck),routes},null,1)+'\n');
  }
}
