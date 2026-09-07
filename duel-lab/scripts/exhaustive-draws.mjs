import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {OcgQueryFlags as Q,OcgMessageType as M} from 'ocgcore-wasm';
import {cards} from '../cards.mjs';
import {preset,hash,board,startRoute,respond} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ALLURE=1475311,CAT=96676583,BINDER=95454996;
const sort=list=>[...list].sort((a,b)=>a-b);
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
export const countsOf=list=>Object.fromEntries(sort([...new Set(list)]).map(code=>[code,list.filter(x=>x===code).length]));
export function choose(n,k) {
  assert(Number.isSafeInteger(n)&&Number.isSafeInteger(k)&&n>=0&&k>=0);
  if(k>n)return 0n;
  let result=1n;
  for(let i=1;i<=Math.min(k,n-k);i++)result=result*BigInt(n-i+1)/BigInt(i);
  return result;
}
function falling(n,k){let result=1n;for(let i=0;i<k;i++)result*=BigInt(n-i);return result;}
export function subtractCopies(deck,removed) {
  const left=[...deck];
  for(const code of removed){const index=left.indexOf(code);assert(index>=0,`No remaining copy of ${code}`);left.splice(index,1);}
  return left;
}

/** Complete finite sampling without replacement; probabilities assume a uniformly shuffled unknown pool. */
export function enumerateDrawOutcomes(deck,drawCount,{ordered=false}={}) {
  assert(Number.isSafeInteger(drawCount)&&drawCount>=0&&drawCount<=deck.length,'Insufficient cards for draw');
  const counts=countsOf(deck),codes=Object.keys(counts).map(Number),outcomes=[];
  const denominator=ordered?falling(deck.length,drawCount):choose(deck.length,drawCount);
  function visitOrdered(prefix,weight){
    if(prefix.length===drawCount){outcomes.push({draw:[...prefix],weight:String(weight),denominator:String(denominator)});return;}
    for(const code of codes)if(counts[code]){const n=counts[code];counts[code]--;prefix.push(code);visitOrdered(prefix,weight*BigInt(n));prefix.pop();counts[code]++;}
  }
  function visitUnordered(index,left,prefix,weight){
    if(left===0){outcomes.push({draw:[...prefix],weight:String(weight),denominator:String(denominator)});return;}
    if(index===codes.length)return;
    const code=codes[index];
    for(let amount=0;amount<=Math.min(left,counts[code]);amount++)visitUnordered(index+1,left-amount,[...prefix,...Array(amount).fill(code)],weight*choose(counts[code],amount));
  }
  if(ordered)visitOrdered([],1n);else visitUnordered(0,drawCount,[],1n);
  assert.equal(outcomes.reduce((n,x)=>n+BigInt(x.weight),0n),denominator,'Probability mass must equal one');
  return outcomes;
}

/** Core fixture uses insertion order bottom-to-top. drawOrder is specified top-to-bottom. */
export function stackDraw(deck,drawOrder){return [...subtractCopies(deck,drawOrder),...[...drawOrder].reverse()];}
export function remainingDeck(g,player=0){return g.lib.duelQueryLocation(g.handle,{controller:player^g.first,location:1,flags:Q.CODE}).filter(Boolean).map(c=>c.code);}
export function drawBoundary(g,{cardCode,drawCount,exchangeableUnknownPool=false,knownTop=[]}={}) {
  const deck=remainingDeck(g);
  assert.equal(deck.length,g.snapshot(0).players[0].deckCount);
  assert(deck.length>=drawCount,'Cannot create a successful draw frontier with insufficient cards');
  if(knownTop.length)assert.deepEqual(deck.slice(-knownTop.length).reverse(),knownTop,'Known top must agree with exact core state');
  const forced=knownTop.slice(0,drawCount),unknownCount=drawCount-forced.length;
  assert(unknownCount===0||exchangeableUnknownPool,'Unknown pool requires explicit exchangeability assertion');
  const pool=subtractCopies(deck,knownTop);
  const outcomes=unknownCount?enumerateDrawOutcomes(pool,unknownCount).map(o=>({...o,draw:[...forced,...o.draw]})):[{draw:forced,weight:'1',denominator:'1'}];
  return {cardCode,drawCount,deckCount:deck.length,remainingCounts:countsOf(deck),knownTop:[...knownTop],exchangeableUnknownPool,
    probabilityCondition:'Conditional on the stated remaining pool and known top; not a starter or win probability.',outcomes,
    prefix:safe(g.route?.steps||[]),stateHash:hash({pending:g.pending,board:board(g),remainingCounts:countsOf(deck)}),
    continuationStatus:'frontier-unexpanded'};
}

function input(g,value){respond(g,value);}
function pick(g,test){const c=g.prompt.choices.find(test);assert(c,`Missing action in ${g.prompt.type}`);input(g,{action:c.id});}
function declineWindows(g,drawn){
  for(let i=0;i<30;i++){
    // Once the draw resolved, leave every new optional trigger for the search kernel.
    if(drawn.length)return;
    if(g.prompt.type==='SELECT_PLACE')input(g,{selection:[0]});
    else if(g.prompt.type==='SELECT_CHAIN')pick(g,c=>!c.card);
    else break;
  }
}
function watchDraws(g){const result=[];const record=g.record.bind(g);g.record=m=>{if(m.type===M.DRAW)result.push({player:m.player,codes:m.drawn.map(c=>c.code)});record(m);};return result;}
async function allureGame(draw,seed=123){
  const own=structuredClone(preset);own.main=stackDraw(subtractCopies(own.main,[ALLURE]),draw);
  const g=await startRoute([ALLURE],{seed,deckOrder:own.main});
  const actualDeck=remainingDeck(g);assert.deepEqual(actualDeck,own.main,'Core insertion order drift');
  const drawn=watchDraws(g);
  pick(g,c=>c.card?.code===ALLURE&&c.response.action===5);declineWindows(g,drawn);
  assert.deepEqual(drawn,[{player:0,codes:draw}],'Core draw order differs from explicitly stacked outcome');
  assert.deepEqual(countsOf(remainingDeck(g)),countsOf(subtractCopies(preset.main,[ALLURE,...draw])));
  return {g,drawn,own};
}
function assertMainConservation(g){
  const s=g.snapshot(0).players[0];const main=[...remainingDeck(g)];
  for(const zone of ['hand','monsters','spells','grave','banished'])for(const c of s[zone])if(c&&!preset.extra.includes(c.code))main.push(c.code);
  assert.deepEqual(countsOf(main),countsOf(preset.main),'Main deck physical copies must be conserved');
}
function frontier(g,extra={}){
  assertMainConservation(g);
  return {...extra,board:board(g),remainingCounts:countsOf(remainingDeck(g)),pending:safe(g.pending),inputs:safe(g.inputs.map(x=>x.input)),
    stateHash:hash({pending:g.pending,board:board(g),deck:remainingDeck(g)}),continuationStatus:'frontier-unexpanded'};
}

function cardKey(c){
  if(c.place)return {place:c.place};
  return {code:c.code,controller:c.controller,location:c.location,...(![1,2].includes(c.location)?{sequence:c.sequence}:{})};
}
function captureSemanticInput(g,value){
  if(value.action!==undefined){const choice=g.prompt.choices.find(c=>c.id===value.action);assert(choice);return {type:g.prompt.type,kind:'action',label:choice.label,card:choice.card?cardKey(choice.card):null};}
  return {type:g.prompt.type,kind:'selection',cards:value.selection.map(i=>cardKey(g.prompt.cards[i]))};
}
function matchesCard(c,key){return key.place?JSON.stringify(c.place)===JSON.stringify(key.place):Object.entries(key).every(([k,v])=>c[k]===v);}
function resolveSemanticInput(g,semantic){
  assert.equal(g.prompt.type,semantic.type,'Reordered deck changed the pre-draw decision sequence');
  if(semantic.kind==='action'){
    const choice=g.prompt.choices.find(c=>c.label===semantic.label&&(!semantic.card||c.card&&matchesCard(c.card,semantic.card)));
    assert(choice,`Cannot remap ${semantic.label}`);return {action:choice.id};
  }
  const used=new Set(),selection=[];
  for(const key of semantic.cards){
    const candidates=g.prompt.cards.map((card,index)=>({card,index})).filter(({card,index})=>!used.has(index)&&matchesCard(card,key));
    // Remove bottommost exchangeable deck copies, preserving the reserved draw copies on top.
    if(key.location===1)candidates.sort((a,b)=>a.card.sequence-b.card.sequence);
    assert(candidates.length,`Cannot remap selected card ${JSON.stringify(key)}`);
    selection.push(candidates[0].index);used.add(candidates[0].index);
  }
  return {selection};
}
export async function semanticPrefix(boundary){
  const g=await startRoute(boundary.hand,{seed:boundary.seed}),inputs=[];
  try{for(const step of boundary.prefix){inputs.push(captureSemanticInput(g,step.input));respond(g,step.input);}return inputs;}finally{g.close();}
}

/** Recreate the full pre-draw history; never rebuild a mid-duel board and lose HOPT/normal-summon state. */
export async function materializeDrawOutcome(boundary,drawOrder,{semantics}={}){
  assert.equal(drawOrder.length,boundary.drawCount);
  subtractCopies(Object.entries(boundary.remainingCounts).flatMap(([code,n])=>Array(n).fill(Number(code))),drawOrder);
  const own=structuredClone(preset);own.main=stackDraw(subtractCopies(preset.main,boundary.hand),drawOrder);
  const g=await startRoute(boundary.hand,{seed:boundary.seed,deckOrder:own.main});
  try{
    for(const step of semantics||await semanticPrefix(boundary))respond(g,resolveSemanticInput(g,step));
    assert.deepEqual(board(g),boundary.beforeDraw,'Pre-draw board must survive semantic replay');
    assert.deepEqual(countsOf(remainingDeck(g)),boundary.remainingCounts);
    assert.deepEqual(remainingDeck(g).slice(-drawOrder.length).reverse(),drawOrder,'Reserved draw copies were removed or shuffled during replay');
    const drawn=watchDraws(g);respond(g,{action:g.prompt.choices.find(c=>c.response.yes===true).id});
    assert.deepEqual(drawn,[{player:0,codes:drawOrder}]);assertMainConservation(g);
    return g;
  }catch(error){g.close();throw error;}
}

async function verifyAllure(){
  const deck=subtractCopies(preset.main,[ALLURE]),outcomes=enumerateDrawOutcomes(deck,2),ordered=enumerateDrawOutcomes(deck,2,{ordered:true});
  const rows=[];let probes=0,noDarkMass=0n,darkMass=0n,strategicAlternatives=0;
  const orderedBuckets=new Map();
  for(const outcome of ordered){const key=sort(outcome.draw).join(',');orderedBuckets.set(key,(orderedBuckets.get(key)||0n)+BigInt(outcome.weight));}
  for(let index=0;index<outcomes.length;index++){
    const outcome=outcomes[index],dark=sort([...new Set(outcome.draw.filter(code=>(cards[code].type&1)&&(cards[code].attribute&32)))]);
    assert.equal(orderedBuckets.get(outcome.draw.join(',')),2n*BigInt(outcome.weight),'Ordered and unordered distributions disagree');
    const alternatives=[];
    for(const banish of dark.length?dark:[null]){
      const {g}=await allureGame(outcome.draw);probes++;
      try{
        if(banish!==null){
          assert.equal(g.prompt.type,'SELECT_CARD');
          assert.deepEqual(sort([...new Set(g.prompt.cards.map(c=>c.code))]),dark,'Allure legal banish choices');
          const selected=g.prompt.cards.findIndex(c=>c.code===banish);input(g,{selection:[selected]});
          assert.deepEqual(sort(g.snapshot().players[0].hand.map(c=>c.code)),sort(subtractCopies(outcome.draw,[banish])));
          assert(g.snapshot().players[0].banished.some(c=>c.code===banish));
        }else{
          assert(['SELECT_IDLECMD','SELECT_EFFECTYN','SELECT_CHAIN'].includes(g.prompt.type),'No-DARK send may trigger a graveyard effect');
          assert.equal(g.snapshot().players[0].hand.length,0);
          assert.deepEqual(sort(g.snapshot().players[0].grave.map(c=>c.code)),sort([ALLURE,...outcome.draw]));
        }
        alternatives.push(frontier(g,{banish}));
      }finally{g.close();}
    }
    // Both draw orders are physically possible for distinct names. Verify the reverse separately;
    // strategic equivalence only applies after the complete simultaneous two-card draw.
    if(outcome.draw[0]!==outcome.draw[1]){
      const {g}=await allureGame([...outcome.draw].reverse(),987);probes++;
      try{
        if(dark.length){assert.deepEqual(sort(g.snapshot().players[0].hand.map(c=>c.code)),outcome.draw);assert.deepEqual(sort([...new Set(g.prompt.cards.map(c=>c.code))]),dark);}
        else assert.equal(g.snapshot().players[0].hand.length,0);
        assertMainConservation(g);
      }finally{g.close();}
    }
    strategicAlternatives+=alternatives.length;
    if(dark.length)darkMass+=BigInt(outcome.weight);else noDarkMass+=BigInt(outcome.weight);
    rows.push({...outcome,names:outcome.draw.map(code=>cards[code].name),fixture:{hand:[ALLURE],seed:123,deckOrder:stackDraw(deck,outcome.draw)},
      orderedDraws:outcome.draw[0]===outcome.draw[1]?[outcome.draw]:[outcome.draw,[...outcome.draw].reverse()],alternatives});
    if((index+1)%50===0)console.log(`Allure ${index+1}/${outcomes.length}: ${probes} actual-core probes`);
  }
  assert.equal(noDarkMass+darkMass,choose(deck.length,2));
  return {starter:ALLURE,hand:[ALLURE],remainingDeck:countsOf(deck),drawCount:2,orderedNames:ordered.length,unorderedNames:outcomes.length,
    physicalUnorderedHands:String(choose(deck.length,2)),physicalOrderedDraws:String(falling(deck.length,2)),actualCoreProbes:probes,strategicAlternatives,
    noDark:{weight:String(noDarkMass),denominator:String(choose(deck.length,2))},withDark:{weight:String(darkMass),denominator:String(choose(deck.length,2))},
    coverage:'Every two-card name multiset, both distinct-name draw orders, and every distinct legal DARK banish after the complete draw. Future plays remain a frontier.',outcomes:rows};
}

async function verifyOptionalBoundaries(handoffs=[]){
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/malice-monsters.json'))),boundaries=[],seen=new Set();
  for(const route of source.routes){
    if(!['rabbit-no-draw-ip','dorm-no-draw-crypter','dorm-hare-first-accord'].includes(route.id))continue;
    const g=await startRoute(route.hand,{seed:route.seed});
    try{
      for(let i=0;i<route.steps.length;i++){
        const step=route.steps[i];assert.equal(g.prompt.type,step.prompt);assert.equal(hash({pending:g.pending,board:board(g)}),step.before);
        if(g.prompt.type==='SELECT_YESNO'&&/ドロー/.test(g.prompt.title)){
          const code=Number(BigInt(g.pending.description)>>20n);assert([CAT,BINDER].includes(code),'Unexpected optional draw');
          const boundary=drawBoundary(g,{cardCode:code,drawCount:code===CAT?2:1,exchangeableUnknownPool:true});
          const key=hash({code,counts:boundary.remainingCounts,board:board(g)});
          if(!seen.has(key)){seen.add(key);boundaries.push({...boundary,id:`${route.id}-step-${i}`,routeId:route.id,hand:route.hand,seed:route.seed,stepIndex:i,optionalDecision:{decline:step.input,accept:{action:g.prompt.choices.find(c=>c.response.yes===true).id}},beforeDraw:board(g),exactFixtureDraw:remainingDeck(g).slice(-boundary.drawCount).reverse()});}
        }
        respond(g,step.input);
      }
    }finally{g.close();}
  }
  // A true Rabbit one-card route: retain Cat, use MTP to search Rabbit instead of Hare,
  // decline Binder's draw, then Cat banishes the searched Rabbit and may draw two.
  const catSource=source.routes.find(r=>r.id==='rabbit-no-draw-ip');
  const cg=await startRoute(catSource.hand,{seed:catSource.seed});
  try{
    let switched=false;
    for(const step of catSource.steps){
      const selected=step.input.selection?.map(i=>cg.prompt.cards?.[i]);
      if(cg.prompt.type==='SELECT_CARD'&&selected?.length===1&&selected[0]?.code===20938824&&selected[0]?.location===1){
        const index=cg.prompt.cards.findIndex(c=>c.code===69272449);assert(index>=0,'MTP must be able to search Rabbit');
        respond(cg,{selection:[index]});switched=true;break;
      }
      respond(cg,step.input);
    }
    assert(switched,'No MTP search branch found in Rabbit route');
    for(let i=0;i<20&&cg.prompt.type!=='SELECT_IDLECMD';i++){
      if(cg.prompt.type==='SELECT_EFFECTYN'){assert.equal(cg.pending.code,BINDER);respond(cg,{action:cg.prompt.choices.find(c=>c.response.yes===true).id});}
      else if(cg.prompt.type==='SELECT_CHAIN'){const choice=cg.prompt.choices.find(c=>c.card?.code===BINDER)||cg.prompt.choices.find(c=>!c.card);assert(choice);respond(cg,{action:choice.id});}
      else if(cg.prompt.type==='SELECT_PLACE')respond(cg,{selection:[0]});
      else if(cg.prompt.type==='SELECT_POSITION')respond(cg,{action:cg.prompt.choices.find(c=>c.response.position===1).id});
      else if(cg.prompt.type==='SELECT_YESNO'){assert.equal(Number(BigInt(cg.pending.description)>>20n),BINDER);respond(cg,{action:cg.prompt.choices.find(c=>c.response.yes===false).id});}
      else assert.fail(`Unexpected Cat-prefix prompt ${cg.prompt.type}`);
    }
    assert.equal(cg.prompt.type,'SELECT_IDLECMD');
    const action=cg.prompt.choices.find(c=>c.response.action===5&&c.card?.code===CAT);assert(action,'Cat has the searched Rabbit as banish resource');respond(cg,{action:action.id});
    assert.equal(cg.prompt.type,'SELECT_CARD');const target=cg.prompt.cards.findIndex(c=>c.code===69272449);assert(target>=0);respond(cg,{selection:[target]});
    assert.equal(cg.prompt.type,'SELECT_YESNO');assert.equal(Number(BigInt(cg.pending.description)>>20n),CAT);
    const boundary=drawBoundary(cg,{cardCode:CAT,drawCount:2,exchangeableUnknownPool:true});
    boundaries.push({...boundary,id:'rabbit-MTP-search-Rabbit-Cat-draw',routeId:'rabbit-MTP-search-Rabbit-Cat',hand:catSource.hand,seed:catSource.seed,stepIndex:cg.route.steps.length,
      optionalDecision:{decline:{action:cg.prompt.choices.find(c=>c.response.yes===false).id},accept:{action:cg.prompt.choices.find(c=>c.response.yes===true).id}},beforeDraw:board(cg),exactFixtureDraw:remainingDeck(cg).slice(-2).reverse()});
    assert(!cg.log.some(x=>x.text.includes('枚ドロー')),'Cat boundary must be reached without previous random draws');
    assertMainConservation(cg);
  }finally{cg.close();}
  const prefixKeys=new Set(boundaries.map(b=>hash({hand:b.hand,inputs:b.prefix.map(s=>s.input)})));
  for(const {entry,file,fileHash} of handoffs){
    const original=source.routes.find(r=>r.id===entry.sourceId);
    const hand=entry.hand||original?.hand;assert(hand,'Handoff must identify its initial hand');
    const seed=entry.seed??123;
    if(entry.presetHash)assert.equal(entry.presetHash,hash(preset),'Handoff preset changed');
    const inputs=(entry.prefix??entry.steps).map(s=>s.input??s),prefixKey=hash({hand,inputs});
    if(prefixKeys.has(prefixKey))continue;
    const g=await startRoute(hand,{seed});
    try{
      for(const value of inputs)respond(g,value);
      assert(!g.log.some(x=>x.text.includes('枚ドロー')),'Imported boundary already depends on a previous draw');
      assert.equal(g.prompt.type,'SELECT_YESNO');
      const code=Number(BigInt(g.pending.description)>>20n);assert([CAT,BINDER].includes(code));
      if(entry.remainingDeckCodes)assert.deepEqual(remainingDeck(g),entry.remainingDeckCodes,'Imported residual deck must reproduce exactly');
      if(entry.finalHash)assert.equal(hash(board(g)),entry.finalHash,'Imported final board must reproduce exactly');
      const boundary=drawBoundary(g,{cardCode:code,drawCount:code===CAT?2:1,exchangeableUnknownPool:true});
      const accept={action:g.prompt.choices.find(c=>c.response.yes===true).id};
      if(entry.drawResponse??entry.yesInput)assert.deepEqual(accept,entry.drawResponse??entry.yesInput,'Handoff must identify the actual optional draw acceptance');
      boundaries.push({...boundary,id:`handoff-${prefixKey.slice(0,20)}`,routeId:entry.sourceId??entry.id,hand,seed,stepIndex:inputs.length,
        importEvidence:{file,fileHash,entryId:entry.id??entry.prefixHash,defaultSeedUsed:entry.seed===undefined,residualDeck:entry.remainingDeckCodes?'matched-source':'queried-after-full-source-replay'},
        optionalDecision:{decline:{action:g.prompt.choices.find(c=>c.response.yes===false).id},accept},beforeDraw:board(g),exactFixtureDraw:remainingDeck(g).slice(-boundary.drawCount).reverse()});
      prefixKeys.add(prefixKey);
    }finally{g.close();}
  }
  // Follow one legal route to each recorded boundary and accept its draw in the actual core.
  for(const boundary of boundaries){
    const g=await startRoute(boundary.hand,{seed:boundary.seed});
    try{
      for(const step of boundary.prefix)respond(g,step.input);
      const drawn=watchDraws(g);respond(g,boundary.optionalDecision.accept);
      assert.deepEqual(drawn,[{player:0,codes:boundary.exactFixtureDraw}]);
      assert.deepEqual(countsOf(remainingDeck(g)),countsOf(subtractCopies(Object.entries(boundary.remainingCounts).flatMap(([code,n])=>Array(n).fill(Number(code))),boundary.exactFixtureDraw)));
      assertMainConservation(g);
      boundary.actualCoreProbe={drawn:boundary.exactFixtureDraw,after:board(g),pending:safe(g.pending),verified:true};
      console.log(`Optional ${cards[boundary.cardCode].name}: remaining ${boundary.deckCount}, ${boundary.outcomes.length} draw multisets`);
    }finally{g.close();}
  }
  // Materialize every optional draw multiset with actual effects and preserved pre-draw history.
  for(const boundary of boundaries){
    const semantics=await semanticPrefix(boundary);let checked=0;
    for(const outcome of boundary.outcomes){
      const g=await materializeDrawOutcome(boundary,outcome.draw,{semantics});
      try{
        outcome.actualCore={verified:true,stateHash:hash({pending:g.pending,board:board(g)}),pendingType:g.prompt.type,
          remainingCounts:countsOf(remainingDeck(g)),hand:countsOf(g.snapshot().players[0].hand.map(c=>c.code))};
        checked++;
      }finally{g.close();}
    }
    boundary.actualCoreOutcomesVerified=checked;
    console.log(`PASS optional ${boundary.id}: ${checked}/${boundary.outcomes.length} actual-core draw outcomes`);
  }
  return boundaries;
}

function testEnumeration(){
  assert.deepEqual(enumerateDrawOutcomes([1,1,2],2).map(x=>[x.draw,x.weight]),[[[1,2],'2'],[[1,1],'1']]);
  assert.throws(()=>subtractCopies([1],[1,1]));assert.throws(()=>enumerateDrawOutcomes([1],2));
  assert.deepEqual(stackDraw([1,1,2,3],[1,3]),[1,2,3,1]);
  assert.equal(enumerateDrawOutcomes([1,2,3],0).length,1);
  for(let n=0;n<8;n++)for(let k=0;k<=n;k++){
    const pool=Array.from({length:n},(_,i)=>i%3);
    const un=enumerateDrawOutcomes(pool,k),ord=enumerateDrawOutcomes(pool,k,{ordered:true});
    assert.equal(un.reduce((s,x)=>s+BigInt(x.weight),0n),choose(n,k));assert.equal(ord.reduce((s,x)=>s+BigInt(x.weight),0n),falling(n,k));
  }
}

async function main(){
  const began=new Date().toISOString();testEnumeration();
  const handoffs=[];
  for(const argument of process.argv.slice(2)){
    assert(argument.startsWith('--handoff='),`Unknown argument ${argument}`);
    const file=path.resolve(argument.slice('--handoff='.length)),data=JSON.parse(fs.readFileSync(file));
    for(const entry of Array.isArray(data)?data:[data])handoffs.push({entry,file:path.relative(ROOT,file).replaceAll('\\','/'),fileHash:hash(data)});
  }
  const allure=await verifyAllure();const optionalDraws=await verifyOptionalBoundaries(handoffs);
  const result={schemaVersion:1,generatedAt:new Date().toISOString(),began,presetHash:hash(preset),scope:'Fixed 40-card preset, one-card opening draw-result coverage. No opponent response and no claim of exhaustive later gameplay.',
    engineEvidence:{fixtureFlags:'MODE_MR5 | PSEUDO_SHUFFLE',insertionOrder:'bottom-to-top; final main element is first drawn',
      chanceIsNotInput:true,orderEquivalence:'Only after all cards in the simultaneous draw have arrived, with no intervening trigger/order-sensitive effect and no distinguishable per-copy history. Preserve ordered draws otherwise.',
      unknownPool:'Conditional uniform sampling without replacement. A deterministic fixture or one seed is not a draw distribution.'},
    command:['node','scripts/exhaustive-draws.mjs',...process.argv.slice(2)],allure,optionalDraws,frontier:{allure:allure.strategicAlternatives,optional:optionalDraws.reduce((n,b)=>n+b.outcomes.length,0),
      laterGameplayExhaustive:false,remaining:['Expand every saved successor through the common search kernel.','Import every newly discovered Cat/Binder draw boundary with its actual remaining deck.','Recompute probability pools after any search, set from deck, banish, send, shuffle, return, or known-top manipulation.','Optional decline is a player decision, not a random event with 50 percent probability.','Actual opening-five other cards must be subtracted; present one-card fixtures intentionally leave all other 39 in the deck.']}};
  fs.mkdirSync(path.join(ROOT,'routes'),{recursive:true});fs.writeFileSync(path.join(ROOT,'routes/exhaustive-draws.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',allureUnordered:allure.unorderedNames,allureOrdered:allure.orderedNames,actualCoreProbes:allure.actualCoreProbes,strategicFrontiers:allure.strategicAlternatives,optionalBoundaries:optionalDraws.length,noDark:allure.noDark}));
}
async function auditReverse(){
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/exhaustive-draws.json')));
  assert.equal(source.presetHash,hash(preset));
  const cases=[];let sameNameCases=0,observedEqual=0;
  for(const outcome of source.allure.outcomes){
    if(outcome.draw[0]===outcome.draw[1]){sameNameCases+=outcome.alternatives.length;continue;}
    const draw=[...outcome.draw].reverse();
    for(const alternative of outcome.alternatives){
      const {g}=await allureGame(draw,123);
      try{
        if(alternative.banish!==null){
          assert.equal(g.prompt.type,'SELECT_CARD');
          const index=g.prompt.cards.findIndex(c=>c.code===alternative.banish);assert(index>=0);
          input(g,{selection:[index]});
          assert.deepEqual(sort(g.snapshot().players[0].hand.map(c=>c.code)),sort(subtractCopies(draw,[alternative.banish])));
          assert(g.snapshot().players[0].banished.some(c=>c.code===alternative.banish));
          assert(g.snapshot().players[0].grave.some(c=>c.code===ALLURE));
        }else{
          assert.equal(g.snapshot().players[0].hand.length,0);
          assert.deepEqual(sort(g.snapshot().players[0].grave.map(c=>c.code)),sort([ALLURE,...draw]));
        }
        const result=frontier(g,{draw,banish:alternative.banish});
        const observedStateEqualsCanonical=result.stateHash===alternative.stateHash;
        if(observedStateEqualsCanonical)observedEqual++;
        cases.push({...result,observedStateEqualsCanonical,canonicalStateHash:alternative.stateHash,verified:true});
      }finally{g.close();}
    }
  }
  assert.equal(cases.length+sameNameCases,source.allure.strategicAlternatives);
  const result={schemaVersion:1,generatedAt:new Date().toISOString(),presetHash:hash(preset),sourceAllureHash:hash(source.allure),
    sourceFileUnchanged:true,reverseResolutionCases:cases.length,sameNameCasesReusingCanonical:sameNameCases,
    combinedOrderedResolutionBranches:source.allure.strategicAlternatives+cases.length,observedStateEqualsCanonical:observedEqual,
    scope:'For every distinct-name reverse draw, fully resolve every distinct DARK banish or the no-DARK hand-to-grave operation in the actual core. Same-name reverse order is the original identical sequence.',
    notProven:'Observed state hashes are a comparison only. Full hidden-state or arbitrary future order-sensitive equivalence is not established.',cases};
  writeAudit(result);
  console.log(JSON.stringify({status:'PASS',reverseResolutionCases:cases.length,sameNameCases,combinedOrderedResolutionBranches:result.combinedOrderedResolutionBranches,observedEqual,sourceAllureHash:result.sourceAllureHash}));
}
function writeAudit(result){const dir=path.join(ROOT,'runtime/search-draws');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'reverse-resolution-audit.json'),JSON.stringify(result,null,2)+'\n');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length===3&&process.argv[2]==='--audit-reverse')await auditReverse();else await main();
}
