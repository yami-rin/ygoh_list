import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OcgMessageType as M,OcgQueryFlags as Q,OcgResponseType as R} from 'ocgcore-wasm';
import {Duel} from '../engine.mjs';
import {makePrompt,responseFor} from '../prompts.mjs';
import {enumerateCandidates,search} from '../scripts/search-kernel.mjs';
import {startRoute,respond as routeRespond,board,hash,replay} from '../scripts/route-harness.mjs';
import {countsOf,remainingDeck,semanticPrefix,materializeDrawOutcome,stackDraw} from '../scripts/exhaustive-draws.mjs';

const preset=JSON.parse(fs.readFileSync(new URL('../preset.json',import.meta.url)));
const C={backup:30118811,wizard:3723262,soul:74652966,wicked:52698008,dragon:89631139,seahorse:17444133};
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
const entry=(code,sequence,extra={})=>({code,controller:0,location:4,sequence,position:1,...extra});
function answer(g,input) {
  g.respond(g.pending.player^g.first,g.revision,input);
  assert.equal(g.validationError,null);
  assert.equal(g.errors.length,0);
}
function choose(g,predicate) {
  const option=g.prompt.choices.find(predicate);
  assert.ok(option,JSON.stringify(safe(g.pending)));
  answer(g,{action:option.id});
}
function observedCoreState(g) {
  const flags=Object.values(Q).reduce((a,b)=>a|b,0);
  return safe({pending:g.pending,turn:g.turn,phase:g.phase,lp:g.lp,status:g.status,
    chain:g.chain,field:g.lib.duelQueryField(g.handle),
    zones:[0,1].map(controller=>[1,2,4,8,16,32,64].map(location=>
      g.lib.duelQueryLocation(g.handle,{controller,location,flags})))});
}
async function materialFixture() {
  const g=await Duel.create([preset,preset],{seed:908,fixtures:
    [C.backup,C.wizard,C.soul].map((code,sequence)=>({team:0,...entry(code,sequence)}))});
  choose(g,c=>c.response.action===1&&c.card?.code===C.wicked);
  assert.equal(g.pending.type,M.SELECT_UNSELECT_CARD);
  return g;
}

test('actual core: reversible Link material loop preserves the transaction and its continuation',async()=>{
  const direct=await materialFixture(),cycled=await materialFixture();
  try {
    const before=observedCoreState(cycled);
    const messages=[];
    const record=cycled.record.bind(cycled);
    cycled.record=m=>{messages.push(safe(m));record(m);};
    choose(cycled,c=>c.card?.code===C.backup&&c.response.index<cycled.pending.select_cards.length);
    assert.equal(cycled.pending.type,M.SELECT_UNSELECT_CARD);
    assert.ok(cycled.pending.unselect_cards.some(c=>c.code===C.backup));
    choose(cycled,c=>c.card?.code===C.backup&&c.response.index>=cycled.pending.select_cards.length);
    assert.deepEqual(observedCoreState(cycled),before);
    assert.ok(messages.every(m=>[M.HINT,M.SELECT_UNSELECT_CARD].includes(m.type)),
      'Only selector/hint messages may occur inside this loop');
    for(const g of [direct,cycled]) {
      choose(g,c=>c.card?.code===C.backup&&c.response.index<g.pending.select_cards.length);
      choose(g,c=>c.card?.code===C.wizard&&c.response.index<g.pending.select_cards.length);
      assert.equal(g.pending.type,M.SELECT_PLACE);
      answer(g,{selection:[0]});
      assert.equal(g.pending.type,M.SELECT_IDLECMD);
      assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===C.wicked));
    }
    assert.deepEqual(observedCoreState(cycled),observedCoreState(direct));
    assert.deepEqual(cycled.log,direct.log);
  } finally {direct.close();cycled.close();}
});

test('actual core: a rejected incomplete tribute is RETRY, and one double-tribute is legal',async()=>{
  const g=await Duel.create([preset,preset],{seed:909,fixtures:[
    {team:0,...entry(C.dragon,0,{location:2,position:8})},
    {team:0,...entry(C.seahorse,0)},
    {team:0,...entry(C.backup,1)},
  ]});
  try {
    choose(g,c=>c.response.action===0&&c.card?.code===C.dragon);
    assert.equal(g.pending.type,M.SELECT_TRIBUTE);
    const before=safe(g.pending);
    const bad=g.pending.selects.findIndex(c=>c.code===C.backup);
    g.respond(0,g.revision,{selection:[bad]});
    assert.match(g.validationError,/拒否/);
    assert.equal(g.status,'playing');
    assert.deepEqual(safe(g.pending),before);
    const good=g.pending.selects.findIndex(c=>c.code===C.seahorse);
    assert.equal(g.pending.selects[good].release_param,2);
    answer(g,{selection:[good]});
    assert.equal(g.pending.type,M.SELECT_PLACE);
    answer(g,{selection:[0]});
    assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===C.dragon));
    assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===C.backup));
  } finally {g.close();}
});

test('actual core: cancelled Link attempt restores idle state and the subsequent summon',async()=>{
  const make=()=>Duel.create([preset,preset],{seed:913,fixtures:
    [C.backup,C.wizard,C.soul].map((code,sequence)=>({team:0,...entry(code,sequence)}))});
  const direct=await make(),cancelled=await make();
  try {
    const before=observedCoreState(cancelled);
    const messages=[];
    const record=cancelled.record.bind(cancelled);
    cancelled.record=m=>{messages.push(safe(m));record(m);};
    choose(cancelled,c=>c.response.action===1&&c.card?.code===C.wicked);
    assert.equal(cancelled.pending.can_cancel,true);
    choose(cancelled,c=>c.response.index===null);
    assert.deepEqual(observedCoreState(cancelled),before);
    assert.ok(messages.every(m=>[M.HINT,M.SELECT_UNSELECT_CARD,M.SELECT_IDLECMD].includes(m.type)));
    for(const g of [direct,cancelled]) {
      choose(g,c=>c.response.action===1&&c.card?.code===C.wicked);
      choose(g,c=>c.card?.code===C.backup&&c.response.index<g.pending.select_cards.length);
      choose(g,c=>c.card?.code===C.wizard&&c.response.index<g.pending.select_cards.length);
      answer(g,{selection:[0]});
    }
    assert.deepEqual(observedCoreState(cancelled),observedCoreState(direct));
    assert.deepEqual(cancelled.log,direct.log);
  } finally {direct.close();cancelled.close();}
});

test('actual core: hand Code Magician material flags survive toggle and cancel/re-enter loops',async()=>{
  const decoder=30342076,magician=64865;
  const make=()=>Duel.create([preset,preset],{seed:917,fixtures:[
    {team:0,...entry(decoder,5)},
    {team:0,...entry(C.backup,1)},
    {team:0,...entry(C.wizard,2)},
    {team:0,...entry(magician,0,{location:2,position:8})},
  ]});
  const direct=await make(),cycled=await make();
  try {
    const idle=observedCoreState(cycled);
    choose(cycled,c=>c.response.action===1&&c.card?.code===C.wicked);
    const selector=observedCoreState(cycled);
    choose(cycled,c=>c.card?.code===magician&&c.response.index<cycled.pending.select_cards.length);
    choose(cycled,c=>c.card?.code===magician&&c.response.index>=cycled.pending.select_cards.length);
    assert.deepEqual(observedCoreState(cycled),selector);
    choose(cycled,c=>c.response.index===null);
    assert.deepEqual(observedCoreState(cycled),idle);
    for(const g of [direct,cycled]) {
      choose(g,c=>c.response.action===1&&c.card?.code===C.wicked);
      choose(g,c=>c.card?.code===magician&&c.response.index<g.pending.select_cards.length);
      choose(g,c=>c.card?.code===decoder&&c.response.index<g.pending.select_cards.length);
      assert.equal(g.pending.type,M.SELECT_PLACE);
      answer(g,{selection:[0]});
      assert.ok(g.snapshot().players[0].grave.some(c=>c?.code===magician));
      assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===C.wicked));
    }
    assert.deepEqual(observedCoreState(cycled),observedCoreState(direct));
    assert.deepEqual(cycled.log,direct.log);
  } finally {direct.close();cycled.close();}
});

test('actual core counterexample: identical visible board does not preserve once-per-turn actions',async()=>{
  const g=await Duel.create([preset,preset],{seed:918,fixtures:[{team:0,...entry(C.soul,0)}]});
  try {
    const before=board(g);
    const activation=c=>c.response.action===5&&c.card?.code===C.soul;
    assert.ok(g.prompt.choices.some(activation));
    choose(g,activation);
    assert.equal(g.pending.type,M.SELECT_IDLECMD);
    assert.deepEqual(board(g),before);
    assert.equal(g.prompt.choices.some(activation),false);
    assert.ok(g.log.some(e=>e.event==='chain'));
  } finally {g.close();}
});

test('actual core: SELECT_SUM parses optional cards and accepts the exact level threshold',async()=>{
  const warrior=16719140,behemoth=42713844;
  const deck={main:[behemoth,C.backup,C.wizard],extra:[]};
  const g=await Duel.create([deck,deck],{seed:914,fixtures:
    [warrior,C.backup,C.wizard].map((code,sequence)=>({team:0,...entry(code,sequence)}))});
  try {
    choose(g,c=>c.card?.code===warrior);
    assert.equal(g.pending.type,M.SELECT_CARD);
    answer(g,{selection:[0]});
    assert.equal(g.pending.type,M.SELECT_SUM);
    assert.equal(g.pending.amount,3);
    assert.equal(g.pending.player,0);
    assert.equal(g.pending.select_max,1);
    assert.equal(g.pending.selects_must.length,0);
    assert.deepEqual(g.pending.selects.map(c=>[c.code,c.amount]),[[C.backup,3],[C.wizard,4]]);
    const candidates=[...enumerateCandidates(g.prompt,g.pending)];
    assert.deepEqual(candidates.map(c=>c.selection),[[],[0],[1],[0,1]]);
    answer(g,{selection:[0]});
    assert.equal(g.pending.type,M.SELECT_PLACE);
    answer(g,{selection:[0]});
    if(g.pending.type===M.SELECT_POSITION)choose(g,c=>c.response.position===4);
    assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===behemoth));
    assert.ok(g.snapshot().players[0].monsters.some(c=>c?.code===C.wizard));
  } finally {g.close();}
});

test('actual core: sorting five revealed cards accepts and preserves the chosen deck order',async()=>{
  const advance=52112003;
  const deck={main:[C.backup,C.wizard,C.soul,18789533,69272449,32061192],extra:[]};
  const g=await Duel.create([deck,deck],{seed:915,fixtures:[
    {team:0,...entry(advance,0,{location:2,position:8})}]});
  try {
    choose(g,c=>c.response.action===5&&c.card?.code===advance);
    answer(g,{selection:[0]});
    assert.equal(g.pending.type,M.ANNOUNCE_NUMBER);
    choose(g,c=>c.response.value===4);
    assert.equal(g.pending.type,M.SORT_CARD);
    assert.equal(g.prompt.cards.length,5);
    const before=g.prompt.cards.map(c=>c.code);
    assert.equal([...enumerateCandidates(g.prompt,g.pending)].length,120);
    answer(g,{selection:[4,3,2,1,0]});
    const after=g.lib.duelQueryLocation(g.handle,{controller:0,location:1,flags:Q.CODE}).map(c=>c.code);
    assert.deepEqual(after.slice(1),before);
  } finally {g.close();}
});

test('response contract: mandatory SUM indices, inverse order, counters and declarations survive conversion',()=>{
  let m={type:M.SELECT_SUM,player:0,select_max:0,amount:6,min:1,max:2,
    selects_must:[entry(C.backup,0,{amount:3})],
    selects:[entry(C.wizard,1,{amount:0x40001}),entry(C.soul,2,{amount:3})]};
  let p=makePrompt(m);
  assert.deepEqual(responseFor(m,p,{selection:[1]}),{type:R.SELECT_SUM,indicies:[1]});
  for(const type of [M.SORT_CARD,M.SORT_CHAIN]) {
    m={type,player:0,cards:[C.backup,C.wizard,C.soul].map((c,i)=>entry(c,i))};p=makePrompt(m);
    assert.deepEqual(responseFor(m,p,{selection:[2,0,1]}),{type:R.SORT_CARD,order:[1,2,0]});
  }
  m={type:M.SELECT_COUNTER,player:0,count:3,cards:[entry(C.backup,0,{count:2}),entry(C.wizard,1,{count:3})]};p=makePrompt(m);
  assert.deepEqual(responseFor(m,p,{selection:[],counters:[1,2]}),{type:R.SELECT_COUNTER,counters:[1,2]});
  assert.throws(()=>responseFor(m,p,{selection:[],counters:[3,0]}),/カウンター/);
  m={type:M.ANNOUNCE_RACE,player:0,count:2,available:0x1000003n};p=makePrompt(m);
  assert.deepEqual(responseFor(m,p,{selection:[0,2]}),{type:R.ANNOUNCE_RACE,races:[1n,0x1000000n]});
  m={type:M.ANNOUNCE_ATTRIB,player:0,count:1,available:0x21};p=makePrompt(m);
  assert.deepEqual(responseFor(m,p,{selection:[1]}),{type:R.ANNOUNCE_ATTRIB,attributes:[0x20]});
});

test('enumerator: every bounded combination, order, counter allocation and declaration is retained',()=>{
  const all=p=>[...enumerateCandidates(p)];
  assert.deepEqual(all({mode:'multi',type:'SELECT_CARD',min:1,max:2,canCancel:true,cards:[{}, {}, {}]}),
    [{cancel:true},{selection:[0]},{selection:[1]},{selection:[2]},{selection:[0,1]},{selection:[0,2]},{selection:[1,2]}]);
  for(const type of ['SELECT_SUM','SELECT_TRIBUTE']) {
    assert.deepEqual(all({mode:'multi',type,min:2,max:2,cards:[{},{}]}),
      [{selection:[]},{selection:[0]},{selection:[1]},{selection:[0,1]}]);
  }
  const orders=all({mode:'order',cards:[{},{},{}]});
  assert.equal(orders.length,6);assert.equal(new Set(orders.map(c=>JSON.stringify(c))).size,6);
  assert.deepEqual(all({mode:'counter',count:3,cards:[{count:2},{count:3}]}),
    [{selection:[],counters:[0,3]},{selection:[],counters:[1,2]},{selection:[],counters:[2,1]}]);
  assert.deepEqual(all({mode:'announce',cards:[{code:1},{code:2}]}),[{selection:[0]},{selection:[1]}]);
  assert.deepEqual(all({mode:'single',choices:[{id:0},{id:1},{id:2}]}),[{action:0},{action:1},{action:2}]);
});

test('search boundary: ending an empty first turn reaches turn two; depth cutoff remains unresolved',async()=>{
  const result=await search({hand:[],maxNodes:20,maxDepth:12,maxGenerated:100,maxMs:10000});
  assert.equal(result.complete,true);
  assert.equal(result.terminals.length,1);
  assert.equal(result.terminals[0].terminalReason,'firstTurnEnded');
  assert.equal(result.terminals[0].final.turn,2);
  const bounded=await search({hand:[C.backup],maxNodes:10,maxDepth:0,maxMs:10000});
  assert.equal(bounded.complete,false);
  assert.ok(bounded.frontier.some(f=>f.reason==='maxDepth'));
});

test('draw boundary: an Allure draw retains an unresolved chance frontier',async()=>{
  const allure=1475311;
  const g=await startRoute([allure],{seed:916});
  try {
    const activate=g.prompt.choices.find(c=>c.response.action===5&&c.card?.code===allure);
    routeRespond(g,{action:activate.id});
    routeRespond(g,{selection:[0]});
    assert.ok(g.log.some(e=>/2 枚ドロー/.test(e.text)));
    const result=await search({hand:[allure],seed:916,prefix:g.route.steps,stopOnDraw:true,
      maxNodes:5,maxDepth:10,maxMs:10000});
    assert.equal(result.complete,false);
    assert.equal(result.terminals.length,0);
    assert.ok(result.frontier.some(f=>f.reason==='drawBoundary'));
    assert.match(result.scope.draws,/not enumerated/);
  } finally {g.close();}
});

test('v2 audit: an unchanged Code of Soul board still reaches the effect-used frontier',async()=>{
  const g=await startRoute([C.soul],{seed:919});
  let prefix,before;
  try {
    const summon=g.prompt.choices.find(c=>c.response.action===0&&c.card?.code===C.soul);
    routeRespond(g,{action:summon.id});routeRespond(g,{selection:[0]});
    prefix=g.route.steps;before=board(g);
  } finally {g.close();}
  const used=[];
  const result=await search({hand:[C.soul],seed:919,prefix,maxNodes:30,maxDepth:10,maxMs:10000,
    onNode:(game,info)=>{
      if(info.depth===prefix.length)return;
      if(game.log.some(e=>e.event==='chain'&&e.code===C.soul)) {
        assert.deepEqual(board(game),before);
        assert.equal(game.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.soul),false);
        used.push(info.prefix);
        return {stop:true,reason:'auditedUsedEffect'};
      }
      return {stop:true,reason:'otherExit'};
    }});
  assert.equal(result.failures.length,0);
  assert.equal(used.length,1);
  assert.ok(result.frontier.some(f=>f.reason==='auditedUsedEffect'));
  assert.equal(result.pruning.linkUiLoops.examples.some(e=>hash(e.prefix)===hash(used[0])),false);
});

test('v2 audit: a cancelled Link cycle inside an immutable root prefix does not erase its subtree',async()=>{
  const g=await startRoute([C.wizard],{seed:920});
  let normalPrefix,cancelledPrefix;
  try {
    const summon=g.prompt.choices.find(c=>c.response.action===0&&c.card?.code===C.wizard);
    routeRespond(g,{action:summon.id});routeRespond(g,{selection:[0]});
    normalPrefix=structuredClone(g.route.steps);
    const decoder=g.prompt.choices.find(c=>c.response.action===1&&c.card?.code===30342076);
    routeRespond(g,{action:decoder.id});
    const cancel=g.prompt.choices.find(c=>c.response.index===null);
    assert.ok(cancel);routeRespond(g,{action:cancel.id});
    assert.equal(g.pending.type,M.SELECT_IDLECMD);
    cancelledPrefix=structuredClone(g.route.steps);
  } finally {g.close();}
  const options={hand:[C.wizard],seed:920,maxNodes:500,maxDepth:35,maxMs:15000};
  const direct=await search({...options,prefix:normalPrefix});
  const cancelled=await search({...options,prefix:cancelledPrefix});
  assert.equal(direct.complete,true);assert.equal(cancelled.complete,true);
  assert.equal(cancelled.frontier.length,0);assert.equal(cancelled.failures.length,0);
  assert.ok(cancelled.terminals.length>0);
  const finalSet=r=>[...new Set(r.terminals.map(t=>hash(t.final)))].sort();
  assert.deepEqual(finalSet(cancelled),finalSet(direct));
  assert.ok(cancelled.pruning.linkUiLoops.examples.every(e=>e.ancestorDepth>=cancelledPrefix.length));
  assert.ok(cancelled.terminals.every(t=>hash(t.steps.slice(0,cancelledPrefix.length).map(s=>s.input))===
    hash(cancelledPrefix.map(s=>s.input))));
});

test('v2 audit: Wizard completes and a raw v1 resume retains prior terminals and frontier work',async()=>{
  const original=await search({hand:[C.wizard],seed:921,pruneLinkUiLoops:false,maxNodes:20,maxDepth:5,maxMs:10000});
  assert.equal(original.complete,false);
  assert.ok(original.frontier.length>0);
  assert.ok(original.terminals.length>0);
  const legacy=structuredClone(original);
  legacy.version=1;
  delete legacy.deckOrder;
  delete legacy.protocol;
  legacy.pruning={stateMerging:false,strategic:false,exactDuplicatePrefixes:0,
    selectionToggleLoops:'Not pruned: bounded by maxDepth and retained in frontier'};
  const resumed=await search({resume:legacy,maxNodes:500,maxDepth:35,maxMs:15000});
  assert.equal(resumed.complete,true);
  assert.equal(resumed.frontier.length,0);assert.equal(resumed.failures.length,0);
  assert.equal(resumed.checkpointCompatibility.loadedVersion,1);
  assert.deepEqual(resumed.terminals.slice(0,original.terminals.length),original.terminals);
  assert.deepEqual(resumed.rejected.slice(0,original.rejected.length),original.rejected);
  assert.ok(resumed.visited>=original.visited);
  assert.ok(resumed.pruning.linkUiLoops.counts.cancelledLinkSummon>0);
  const direct=await search({hand:[C.wizard],seed:921,maxNodes:500,maxDepth:35,maxMs:15000});
  assert.equal(direct.complete,true);
  const finalSet=r=>[...new Set(r.terminals.map(t=>hash(t.final)))].sort();
  assert.deepEqual(finalSet(resumed),finalSet(direct));
  await replay(resumed.terminals.at(-1));
});

test('v2 audit: a changed script read disables contraction without modifying shared assets',async()=>{
  const original=fs.readFileSync;
  let intercepted=0;
  fs.readFileSync=function(file,...args) {
    const value=original.call(this,file,...args);
    if(String(file).replaceAll('\\','/').endsWith('/scripts/utility.lua')) {
      intercepted++;
      return typeof value==='string'?value+'\n-- audit altered source\n':
        Buffer.concat([value,Buffer.from('\n-- audit altered source\n')]);
    }
    return value;
  };
  try {
    const result=await search({hand:[C.wizard],maxNodes:1,maxDepth:5,maxMs:10000});
    assert.ok(intercepted>0);
    assert.equal(result.pruning.linkUiLoops.enabled,false);
    assert.equal(result.complete,false);
  } finally {fs.readFileSync=original;}
});

test('v2 audit: a changed deck order cannot resume an old chance branch',async()=>{
  const g=await startRoute([1475311],{seed:922});
  let deckOrder;
  try {deckOrder=[...g.decks[0].main];} finally {g.close();}
  const result=await search({hand:[1475311],seed:922,deckOrder,maxNodes:1,maxMs:10000});
  assert.deepEqual(result.deckOrder,deckOrder);
  const changed=[...deckOrder].reverse();
  assert.notDeepEqual(changed,deckOrder);
  await assert.rejects(search({resume:result,deckOrder:changed}),/differs/);
});

test('v2 audit: Code Magician material contraction retains summon exits and its graveyard trigger',async()=>{
  const hand=[C.wizard,64865],seed=923;
  const g=await startRoute(hand,{seed});
  let prefix;
  const routeChoice=predicate=>{
    const c=g.prompt.choices.find(predicate);assert.ok(c);routeRespond(g,{action:c.id});
  };
  try {
    routeChoice(c=>c.response.action===0&&c.card?.code===C.wizard);
    routeRespond(g,{selection:[0]});
    routeChoice(c=>c.response.action===1&&c.card?.code===30342076);
    routeChoice(c=>c.card?.code===C.wizard);
    routeRespond(g,{selection:[0]});
    routeChoice(c=>c.response.action===1&&c.card?.code===C.wicked);
    assert.equal(g.pending.type,M.SELECT_UNSELECT_CARD);
    assert.ok(g.pending.select_cards.some(c=>c.code===64865));
    prefix=structuredClone(g.route.steps);
  } finally {g.close();}
  const exits=[];
  const result=await search({hand,seed,prefix,maxNodes:80,maxDepth:25,maxMs:10000,
    onNode:(game,info)=>{
      if(game.pending.type!==M.SELECT_UNSELECT_CARD) {
        exits.push({type:game.prompt.type,prefix:info.prefix});
        return {stop:true,reason:'auditedMaterialExit'};
      }
    }});
  assert.equal(result.failures.length,0);
  assert.ok(result.pruning.linkUiLoops.counts.linkMaterialToggle>0);
  assert.equal(result.pruning.linkUiLoops.counts.cancelledLinkSummon,0);
  assert.ok(exits.some(e=>e.type==='SELECT_IDLECMD'));
  const summon=exits.find(e=>e.type==='SELECT_PLACE');assert.ok(summon);
  const completed=await startRoute(hand,{seed});
  try {
    for(const input of summon.prefix)routeRespond(completed,input);
    routeRespond(completed,{selection:[0]});
    assert.ok(completed.snapshot().players[0].monsters.some(c=>c?.code===C.wicked));
    assert.ok(completed.snapshot().players[0].grave.some(c=>c?.code===64865));
    assert.equal(completed.pending.type,M.SELECT_EFFECTYN);
    assert.equal(completed.pending.code,64865);
  } finally {completed.close();}
});

const drawEvidenceFile=new URL('../routes/exhaustive-draws.json',import.meta.url);
const readDrawEvidence=()=>JSON.parse(fs.readFileSync(drawEvidenceFile));
function assertPhysicalDrawWeights(pool,count,outcomes) {
  assert.ok([1,2].includes(count));
  const physical=new Map();
  const add=codes=>{
    const key=[...codes].sort((a,b)=>a-b).join(',');physical.set(key,(physical.get(key)||0)+1);
  };
  for(let i=0;i<pool.length;i++) {
    if(count===1)add([pool[i]]);
    else for(let j=i+1;j<pool.length;j++)add([pool[i],pool[j]]);
  }
  const denominator=[...physical.values()].reduce((a,b)=>a+b,0);
  assert.equal(outcomes.length,physical.size);
  const found=new Set();
  for(const outcome of outcomes) {
    const key=[...outcome.draw].sort((a,b)=>a-b).join(',');
    assert.equal(found.has(key),false);found.add(key);
    assert.equal(Number(outcome.weight),physical.get(key));
    assert.equal(Number(outcome.denominator),denominator);
  }
}

test('chance audit: every Allure resolution root replays from exactly one original card',async()=>{
  const evidence=readDrawEvidence();
  assert.equal(evidence.presetHash,hash(preset));
  assert.deepEqual(evidence.allure.hand,[1475311]);
  assert.equal(evidence.allure.outcomes.reduce((n,o)=>n+BigInt(o.weight),0n),741n);
  assertPhysicalDrawWeights(preset.main.filter(c=>c!==1475311),2,evidence.allure.outcomes);
  let roots=0,dotTriggers=0;
  for(const outcome of evidence.allure.outcomes) {
    assert.equal(BigInt(outcome.denominator),741n);
    assert.equal(outcome.fixture.hand.length,1);
    assert.equal(outcome.fixture.deckOrder.length,39);
    assert.deepEqual(countsOf([...outcome.fixture.hand,...outcome.fixture.deckOrder]),countsOf(preset.main));
    for(const alternative of outcome.alternatives) {
      const g=await startRoute(outcome.fixture.hand,{seed:outcome.fixture.seed,deckOrder:outcome.fixture.deckOrder});
      try {
        for(const input of alternative.inputs)routeRespond(g,input);
        assert.equal(hash({pending:g.pending,board:board(g),deck:remainingDeck(g)}),alternative.stateHash);
        assert.deepEqual(g.route.hand,[1475311]);
        assert.deepEqual(g.route.deckOrder,outcome.fixture.deckOrder);
        assert.equal(g.log.filter(e=>/\d+\s*枚ドロー/.test(e.text)).length,1);
        assert.deepEqual(g.route.steps.map(s=>s.input),alternative.inputs);
        if(alternative.banish===null&&outcome.draw.includes(18789533)) {
          assert.ok(g.pending.code===18789533||g.pending.selects?.some(c=>c.code===18789533));
          dotTriggers++;
        }
        roots++;
      } finally {g.close();}
    }
  }
  assert.equal(roots,evidence.allure.strategicAlternatives);
  assert.equal(roots,353);
  assert.ok(dotTriggers>0,'No-DARK graveyard triggers must remain player choices');
});

test('chance audit: every optional boundary retains history, draw weights and a post-draw frontier',async()=>{
  const evidence=readDrawEvidence();
  for(const boundary of evidence.optionalDraws) {
    assert.equal(boundary.hand.length,1);
    assert.equal(Object.values(boundary.remainingCounts).reduce((a,b)=>a+b,0),boundary.deckCount);
    assert.equal(boundary.outcomes.reduce((n,o)=>n+BigInt(o.weight),0n),BigInt(boundary.outcomes[0].denominator));
    assert.ok(boundary.outcomes.every(o=>o.denominator===boundary.outcomes[0].denominator));
    assert.deepEqual(boundary.knownTop,[]);
    const pool=Object.entries(boundary.remainingCounts).flatMap(([code,count])=>Array(count).fill(Number(code)));
    assertPhysicalDrawWeights(pool,boundary.drawCount,boundary.outcomes);
    const outcome=boundary.outcomes[0];
    const semantics=await semanticPrefix(boundary);
    const g=await materializeDrawOutcome(boundary,outcome.draw,{semantics});
    let prefix,deckOrder;
    try {
      assert.equal(g.route.hand.length,1);
      assert.equal(g.route.steps.length,boundary.prefix.length+1);
      assert.equal(hash({pending:g.pending,board:board(g)}),outcome.actualCore.stateHash);
      assert.deepEqual(countsOf(remainingDeck(g)),outcome.actualCore.remainingCounts);
      assert.deepEqual(countsOf([...g.route.hand,...g.route.deckOrder]),countsOf(preset.main));
      prefix=g.route.steps.map(s=>s.input);deckOrder=g.route.deckOrder;
    } finally {g.close();}
    let observed=false;
    const result=await search({hand:boundary.hand,seed:boundary.seed,deckOrder,prefix,
      maxNodes:1,maxDepth:prefix.length+1,maxMs:10000,stopOnDraw:false,
      onNode:game=>{
        observed=true;
        assert.equal(hash({pending:game.pending,board:board(game)}),outcome.actualCore.stateHash);
        assert.equal(game.log.filter(e=>/\d+\s*枚ドロー/.test(e.text)).length,1);
        return {stop:true,reason:'auditedPostDrawRoot'};
      }});
    assert.equal(observed,true);
    assert.equal(result.complete,false);
    assert.equal(result.terminals.length,0);
    assert.equal(result.frontier[0].reason,'auditedPostDrawRoot');
    assert.equal(result.failures.length,0);
  }
});

test('chance audit: stored continuation summaries never call unresolved jobs complete',()=>{
  const allure=JSON.parse(fs.readFileSync(new URL('../routes/allure-continuations.json',import.meta.url)));
  const optional=JSON.parse(fs.readFileSync(new URL('../routes/optional-draw-continuations.json',import.meta.url)));
  assert.deepEqual(allure.scope.openingHand,[1475311]);
  assert.equal(allure.scope.remainingMain,39);
  assert.ok(allure.jobs.every(j=>j.hand.length===1&&j.deckOrder.length===39));
  for(const job of allure.jobs)if(job.complete)assert.equal(job.frontier,0);
  if(allure.totals.frontier||allure.totals.drawFrontiers||allure.jobs.some(j=>!j.complete))assert.equal(allure.complete,false);
  for(const row of optional.results)if(row.complete) {
    assert.equal(row.frontier,0);assert.equal(row.newChanceFrontiers,0);
  }
  if(optional.totals.frontier||optional.totals.newChanceFrontiers||optional.totals.initialized<optional.totals.outcomes)
    assert.equal(optional.complete,false);
  assert.match(optional.probabilityScope,/conditional.*never sum/i);
  assert.match(allure.scope.laterOrders,/not proven|not claimed exhaustive/);
});

const reverseAuditFile=new URL('../runtime/search-draws/reverse-resolution-audit.json',import.meta.url);
test('reverse readback: saved resolutions match source and replay equal and differing samples',
  {skip:!fs.existsSync(reverseAuditFile)},async()=>{
    const source=readDrawEvidence();
    const audit=JSON.parse(fs.readFileSync(reverseAuditFile));
    assert.equal(audit.sourceAllureHash,hash(source.allure));
    assert.equal(audit.sourceFileUnchanged,true);
    assert.equal(audit.reverseResolutionCases,345);
    assert.equal(audit.cases.length,345);
    assert.ok(audit.cases.every(c=>c.verified));
    assert.equal(audit.cases.filter(c=>c.observedStateEqualsCanonical).length,240);
    const samples=[audit.cases.find(c=>c.observedStateEqualsCanonical),audit.cases.find(c=>!c.observedStateEqualsCanonical)];
    for(const sample of samples) {
      const deckOrder=stackDraw(preset.main.filter(c=>c!==1475311),sample.draw);
      const g=await startRoute([1475311],{seed:123,deckOrder});
      try {
        for(const input of sample.inputs)routeRespond(g,input);
        assert.equal(hash({pending:g.pending,board:board(g),deck:remainingDeck(g)}),sample.stateHash);
      } finally {g.close();}
    }
  });

test('same-name Allure audit: both hand indices are distinct legal banish responses',async()=>{
  const source=readDrawEvidence();
  const duplicateDark=source.allure.outcomes.filter(o=>o.draw[0]===o.draw[1]&&o.alternatives.some(a=>a.banish!==null));
  assert.deepEqual(duplicateDark.map(o=>o.draw[0]).sort((a,b)=>a-b),[30118811,69272449,96676583]);
  for(const outcome of duplicateDark) {
    const reference=outcome.alternatives.find(a=>a.banish!==null);
    const endings=[];
    for(const handIndex of [0,1]) {
      const g=await startRoute(outcome.fixture.hand,{seed:outcome.fixture.seed,deckOrder:outcome.fixture.deckOrder});
      try {
        for(const input of reference.inputs.slice(0,-1))routeRespond(g,input);
        assert.equal(g.pending.type,M.SELECT_CARD);
        assert.equal(g.prompt.cards.length,2);
        assert.deepEqual(g.prompt.cards.map(c=>c.code),outcome.draw);
        assert.deepEqual([...enumerateCandidates(g.prompt,g.pending)],
          [{selection:[0]},{selection:[1]}]);
        routeRespond(g,{selection:[handIndex]});
        const own=g.snapshot().players[0];
        assert.equal(own.hand.filter(c=>c?.code===outcome.draw[0]).length,1);
        assert.equal(own.banished.filter(c=>c?.code===outcome.draw[0]).length,1);
        endings.push(g.route.steps.map(s=>s.input));
      } finally {g.close();}
    }
    assert.notEqual(hash(endings[0]),hash(endings[1]),'Distinct card-index choices remain different histories');
  }
});
