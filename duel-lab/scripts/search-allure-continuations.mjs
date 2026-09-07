import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {search} from './search-kernel.mjs';
import {startRoute,respond,finishRoute,board,hash,preset} from './route-harness.mjs';
import {remainingDeck,countsOf,drawBoundary,stackDraw,subtractCopies} from './exhaustive-draws.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=path.join(ROOT,'runtime/search-allure');
const RESULT=path.join(ROOT,'routes/allure-continuations.json');
const STATE=path.join(OUT,'scheduler.json');
const ALLURE=1475311;
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.tmp`;fs.writeFileSync(temporary,JSON.stringify(safe(data),null,2)+'\n');fs.renameSync(temporary,file);}
const args=process.argv.slice(2);
function integerArg(name,fallback,min,max){const value=Number(args.find(x=>x.startsWith(`--${name}=`))?.split('=')[1]??fallback);assert(Number.isSafeInteger(value)&&value>=min&&value<=max,`Invalid ${name}`);return value;}
for(const arg of args)assert(/^--(ms|nodes|depth|rounds)=\d+$/.test(arg),`Unknown argument ${arg}`);
const limits={sliceMs:integerArg('ms',24000,1000,29000),nodesPerVisit:integerArg('nodes',6,4,8),depth:integerArg('depth',180,20,1000),rounds:integerArg('rounds',1,1,100)};
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/exhaustive-draws.json')));
assert.equal(source.presetHash,hash(preset));
assert.equal(source.allure.strategicAlternatives,353);
const sourceHash=hash(source.allure);
const loaded=fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE)):null;
if(loaded){assert.equal(loaded.sourceHash,sourceHash,'Allure draw coverage changed');assert.equal(loaded.presetHash,hash(preset));}
const state=loaded??{version:1,presetHash:hash(preset),sourceHash,createdAt:new Date().toISOString(),cursor:0,round:0,slices:0,jobs:[],drawFrontiers:[],rootChoices:[]};
const frontierMap=new Map(state.drawFrontiers.map(f=>[f.id,{...f,kind:f.kind??(f.optionalDecision?'chance-source':'new-draw-frontier')}]));

function addJob(job){state.jobs.push({...job,id:hash({hand:job.hand,deckOrder:job.deckOrder,prefix:job.prefix}).slice(0,24),visits:0,visited:0,generated:0,terminals:0,rejected:0,failures:0,frontier:0,complete:false,heldOnly:false});}
if(!loaded){
  for(const outcome of source.allure.outcomes)for(const alternative of outcome.alternatives){
    assert(outcome.fixture?.deckOrder?.length===39);
    addJob({kind:'after-allure',hand:outcome.fixture.hand,seed:outcome.fixture.seed,deckOrder:outcome.fixture.deckOrder,prefix:alternative.inputs,
      draw:outcome.draw,weight:outcome.weight,denominator:outcome.denominator,banish:alternative.banish,
      initialPending:alternative.pending.type,initialStateHash:alternative.stateHash,baselineDrawEvents:1});
  }
  assert.equal(state.jobs.length,353);
  const g=await startRoute([ALLURE]);
  try{
    state.rootChoices=g.prompt.choices.map(c=>({id:c.id,label:c.label,action:c.response.action,card:c.card?.code??null}));
    const activate=g.prompt.choices.filter(c=>c.response.action===5);assert.equal(activate.length,1);assert.equal(activate[0].card.code,ALLURE);
    for(const choice of g.prompt.choices){
      if(choice.response.action===5)continue;
      assert([4,7].includes(choice.response.action),'Unaccounted initial action');
      addJob({kind:choice.response.action===4?'root-set':'root-end',hand:[ALLURE],seed:123,deckOrder:[...preset.main].filter(code=>code!==ALLURE),prefix:[{action:choice.id}],baselineDrawEvents:0});
    }
    assert.deepEqual(state.rootChoices.map(c=>c.action).sort((a,b)=>a-b),[4,5,7]);
  }finally{g.close();}
  assert.equal(new Set(state.jobs.map(j=>j.id)).size,state.jobs.length);
}

// Keep the reverse-order audit independent so adding these roots cannot invalidate
// the already running canonical checkpoints or the frozen draw-source JSON.
const reversePath=path.join(ROOT,'runtime/search-draws/reverse-resolution-audit.json');
assert(fs.existsSync(reversePath),'Run exhaustive-draws.mjs --audit-reverse first');
const reverseAudit=JSON.parse(fs.readFileSync(reversePath));
assert.equal(reverseAudit.sourceAllureHash,sourceHash);assert.equal(reverseAudit.reverseResolutionCases,345);
const reverseHash=hash(reverseAudit.cases);
if(state.reverseSourceHash)assert.equal(state.reverseSourceHash,reverseHash,'Reverse audit changed');
else{
  const firstIndex=state.jobs.length;
  const outcomes=new Map(source.allure.outcomes.map(o=>[[...o.draw].sort((a,b)=>a-b).join(','),o]));
  for(const entry of reverseAudit.cases){
    const outcome=outcomes.get([...entry.draw].sort((a,b)=>a-b).join(','));assert(outcome);
    addJob({kind:'after-allure-reverse',hand:[ALLURE],seed:123,deckOrder:stackDraw(subtractCopies(preset.main,[ALLURE]),entry.draw),prefix:entry.inputs,
      draw:entry.draw,weight:outcome.weight,denominator:outcome.denominator,banish:entry.banish,
      initialPending:entry.pending.type,initialStateHash:entry.stateHash,baselineDrawEvents:1,observedStateEqualsCanonical:entry.observedStateEqualsCanonical});
  }
  assert.equal(state.jobs.length-firstIndex,345);
  state.reverseSourceHash=reverseHash;state.reverseExpansion={added:345,firstIndex,priorRound:state.round,addedAt:new Date().toISOString()};
  // Give the added roots their first fair pass before revisiting the old roots.
  state.cursor=firstIndex;
}
if(!state.copyChoiceSourceHash){
  const cases=[];
  for(const outcome of source.allure.outcomes){
    if(outcome.draw[0]!==outcome.draw[1]||outcome.alternatives[0].banish===null)continue;
    const original=outcome.alternatives[0],g=await startRoute([ALLURE],{seed:123,deckOrder:outcome.fixture.deckOrder});
    try{
      for(const value of original.inputs.slice(0,-1))respond(g,value);
      assert.equal(g.prompt.type,'SELECT_CARD');
      const candidates=g.prompt.cards.map((c,i)=>({code:c.code,index:i})).filter(c=>c.code===original.banish);
      assert.deepEqual(candidates.map(c=>c.index),[0,1]);assert.deepEqual(original.inputs.at(-1),{selection:[0]});
      respond(g,{selection:[1]});
      const prefix=g.route.steps.map(s=>s.input),initialStateHash=hash({pending:g.pending,board:board(g),deck:remainingDeck(g)});
      addJob({kind:'after-allure-copy',hand:[ALLURE],seed:123,deckOrder:outcome.fixture.deckOrder,prefix,draw:outcome.draw,weight:outcome.weight,denominator:outcome.denominator,
        banish:original.banish,banishIndex:1,initialPending:g.pending.type,initialStateHash,baselineDrawEvents:1});
      cases.push(finishRoute(g,{id:`allure-same-name-copy-index-1-${original.banish}`,banishIndex:1,initialStateHash}));
    }finally{g.close();}
  }
  assert.equal(cases.length,3);
  state.copyChoiceSourceHash=hash(cases);write(path.join(OUT,'same-name-copy-audit.json'),{sourceHash,cases});
}
const afterAllure=j=>j.kind.startsWith('after-allure');
const firstUnvisited=state.jobs.findIndex(j=>afterAllure(j)&&j.visits===0);
if(firstUnvisited>=0)state.cursor=firstUnvisited;
const eventWeights=new Map();
for(const job of state.jobs.filter(afterAllure)){
  job.orderedWeight=String(BigInt(job.weight)*(job.draw[0]===job.draw[1]?2n:1n));job.orderedDenominator='1482';
  const key=job.draw.join(',');
  if(eventWeights.has(key))assert.equal(eventWeights.get(key),job.orderedWeight);else eventWeights.set(key,job.orderedWeight);
}
assert.equal(state.jobs.filter(afterAllure).length,701);assert.equal(state.jobs.length,703);
assert.equal(eventWeights.size,608);assert.equal([...eventWeights.values()].reduce((n,w)=>n+BigInt(w),0n),1482n);
assert.equal(new Set(state.jobs.map(j=>j.id)).size,state.jobs.length);

function checkpointPath(job){return path.join(OUT,'checkpoints',`${job.id}.json`);}
function captureLaterDraw(g,info,job){
  if(job.initialStateHash&&info.prefix.length===job.prefix.length)assert.equal(hash({pending:g.pending,board:board(g),deck:remainingDeck(g)}),job.initialStateHash,'Allure continuation root drift');
  const drawEvents=g.log.filter(e=>/\d+\s*枚ドロー/.test(e.text)).length;
  const optional=g.prompt.type==='SELECT_YESNO'&&/ドロー/.test(g.prompt.title);
  if(optional){
    const cardCode=Number(BigInt(g.pending.description)>>20n);
    const drawCount=cardCode===96676583?2:cardCode===95454996?1:null;
    assert(drawCount,'Unknown optional draw needs an explicit cardinality handler');
    const id=hash({job:job.id,prefix:info.prefix,boundary:'before-optional-draw'});
    if(!frontierMap.has(id)){
      const boundary=drawBoundary(g,{cardCode,drawCount,exchangeableUnknownPool:true});
      frontierMap.set(id,{...boundary,id,kind:'chance-source',parentJob:job.id,hand:job.hand,seed:job.seed,deckOrder:job.deckOrder,
        sourceDraw:job.draw??null,sourceWeight:job.weight??null,sourceDenominator:job.denominator??null,sourceBanish:job.banish??null,
        sourceOrderedWeight:job.orderedWeight??null,sourceOrderedDenominator:job.orderedDenominator??null,
        prefix:info.prefix,remainingDeckCodes:remainingDeck(g),beforeDraw:board(g),optionalDecision:{accept:{action:g.prompt.choices.find(c=>c.response.yes===true).id},decline:{action:g.prompt.choices.find(c=>c.response.yes===false).id}},
        scope:'Chance-source metadata before this optional draw. Decline remains in the regular search tree; acceptance is stopped after its new DRAW event. The first Allure draw is already conditioned.'});
    }
    return null;
  }
  if(drawEvents>job.baselineDrawEvents){
    const id=hash({job:job.id,prefix:info.prefix,boundary:'after-new-draw'});
    const sourceChance=hash({job:job.id,prefix:info.prefix.slice(0,-1),boundary:'before-optional-draw'});
    if(!frontierMap.has(id))frontierMap.set(id,{id,kind:'new-draw-frontier',sourceChanceId:frontierMap.has(sourceChance)?sourceChance:null,parentJob:job.id,hand:job.hand,seed:job.seed,deckOrder:job.deckOrder,prefix:info.prefix,
      previousPrefix:info.prefix.slice(0,-1),lastInput:info.prefix.at(-1),sourceDraw:job.draw??null,
      drawEvents,baselineDrawEvents:job.baselineDrawEvents,afterDraw:board(g),remainingDeckCodes:remainingDeck(g),remainingCounts:countsOf(remainingDeck(g)),pending:safe(g.pending),
      scope:'A new mandatory draw has occurred in this one fixture. Recreate previousPrefix and enumerate its full chance distribution before continuing.'});
    return {stop:true,reason:'newMandatoryDraw'};
  }
  return null;
}

function summarize(){
  const total=key=>state.jobs.reduce((sum,j)=>sum+(j[key]??0),0);
  const after=state.jobs.filter(afterAllure),canonical=state.jobs.filter(j=>j.kind==='after-allure'),reverse=state.jobs.filter(j=>j.kind==='after-allure-reverse'),copies=state.jobs.filter(j=>j.kind==='after-allure-copy');
  const overallComplete=state.jobs.every(j=>j.complete)&&frontierMap.size===0;
  const summary={schemaVersion:2,presetHash:hash(preset),sourceHash,reverseSourceHash:reverseHash,copyChoiceSourceHash:state.copyChoiceSourceHash,updatedAt:new Date().toISOString(),kernelVersion:2,
    scope:{starter:ALLURE,openingHand:[ALLURE],remainingMain:39,turn:'Own first turn including End Phase',opponent:'Empty opening hand, no interference',
      conditionedChance:'608 ordered name draw events and all 701 explicit order/banish roots: canonical 353, reverse 345, and the second same-name DARK copy index in 3 pairs. All are separate jobs; none are merged by visible-state equality.',
      probabilityWarning:'orderedWeight/1482 is the physical-copy probability of one ordered draw event. Different banish choices share that event; never sum repeated weights over 701 decision jobs. weight/denominator retains the original unordered source weight.',
      laterOrders:'Both orders of the initial draw are covered as separate roots. Other permutations of the unobserved remaining deck and later chance events are not claimed exhaustive.',
      laterDraws:'Further optional and mandatory draws are held as explicit unresolved chance frontiers.',stateMerging:false,
      optionalDrawDecline:'Decline is enumerated as a regular player decision. Acceptance is held after its new DRAW event; chance-source metadata preserves the pool before drawing.',
      linkUi:'Kernel v2 audited no-op Link UI loops only'},
    totalJobs:state.jobs.length,afterAllureJobs:after.length,canonicalJobs:canonical.length,reverseJobs:reverse.length,copyChoiceJobs:copies.length,
    firstPassVisited:after.filter(j=>j.visits>0).length,canonicalFirstPass:canonical.filter(j=>j.visits>0).length,reverseFirstPass:reverse.filter(j=>j.visits>0).length,copyChoiceFirstPass:copies.filter(j=>j.visits>0).length,
    initialOrderedEventCount:eventWeights.size,initialOrderedWeightTotal:'1482',reverseAudit:{cases:345,observedEqual:reverseAudit.observedStateEqualsCanonical,observedDifferent:345-reverseAudit.observedStateEqualsCanonical},
    reverseExpansion:state.reverseExpansion,round:state.round,cursor:state.cursor,slices:state.slices,
    complete:overallComplete,completeJobs:state.jobs.filter(j=>j.complete).length,heldOnlyJobs:state.jobs.filter(j=>j.heldOnly&&!j.complete).length,
    totals:{visited:total('visited'),generated:total('generated'),terminals:total('terminals'),rejected:total('rejected'),failures:total('failures'),frontier:total('frontier'),drawFrontiers:frontierMap.size},
    fairness:{nodesPerVisit:limits.nodesPerVisit,minimumVisits:Math.min(...state.jobs.map(j=>j.visits)),maximumVisits:Math.max(...state.jobs.map(j=>j.visits)),
      policy:'Persistent round-robin cursor; every nonterminal job receives one bounded visit before the next round. Newly added reverse roots receive their first pass before old jobs are revisited. Complete and held-only chance jobs are retained and skipped.'},
    rootChoices:state.rootChoices,jobs:state.jobs.map(j=>({...j,checkpoint:path.relative(ROOT,checkpointPath(j)).replaceAll('\\','/')})),
    drawFrontierFile:'runtime/search-allure/draw-frontiers.json',
    unresolved:overallComplete?[]:['Resume every noncomplete canonical and reverse job checkpoint.','Expand every new chance frontier; declined optional draws remain in the ordinary tree.','Do not claim all permutations of the future hidden deck; only its current conditional chance pools are represented.'],
    command:['node','scripts/search-allure-continuations.mjs',...args]};
  state.updatedAt=summary.updatedAt;state.drawFrontiers=[...frontierMap.values()];
  write(STATE,state);write(path.join(OUT,'draw-frontiers.json'),state.drawFrontiers);write(RESULT,summary);
  return summary;
}

const started=Date.now(),targetRound=state.round+limits.rounds;
let thisSliceNodes=0,thisSliceJobs=0,scanCount=0;
while(Date.now()-started<limits.sliceMs&&state.round<targetRound){
  const job=state.jobs[state.cursor];state.cursor++;
  const wrapped=state.cursor===state.jobs.length;
  if(wrapped){state.cursor=0;state.round++;}
  scanCount++;
  if(job.complete||job.heldOnly){if(scanCount>=state.jobs.length&&state.jobs.every(j=>j.complete||j.heldOnly))break;continue;}
  const file=checkpointPath(job),previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
  const active=previous?previous.frontier.filter(f=>!['newOptionalDraw','newMandatoryDraw'].includes(f.reason)):null;
  const held=previous?previous.frontier.filter(f=>['newOptionalDraw','newMandatoryDraw'].includes(f.reason)):[];
  if(previous&&!active.length){job.heldOnly=true;continue;}
  const result=await search({hand:job.hand,seed:job.seed,deckOrder:job.deckOrder,prefix:job.prefix,
    ...(previous?{resume:{...previous,frontier:active}}:{}),maxNodes:limits.nodesPerVisit,maxDepth:limits.depth,
    maxMs:Math.max(1,Math.min(3000,limits.sliceMs-(Date.now()-started))),stopOnDraw:false,pruneLinkUiLoops:true,
    onNode:(g,info)=>captureLaterDraw(g,info,job)});
  assert.equal(result.version,2);assert.equal(result.protocol.sumSortVerified,true,'Restart after installing the current SUM/SORT wrapper');
  result.frontier=[...held,...result.frontier];result.complete=result.frontier.length===0;
  const {routes,...raw}=result;write(file,raw);
  job.visits++;job.visited=result.visited;job.generated=result.generated;job.terminals=result.terminals.length;job.rejected=result.rejected.length;job.failures=result.failures.length;job.frontier=result.frontier.length;
  job.complete=result.complete;job.heldOnly=!!result.frontier.length&&result.frontier.every(f=>['newOptionalDraw','newMandatoryDraw'].includes(f.reason));
  job.lastPrompt=result.frontier.at(-1)?.prompt??null;job.lastSlice=result.invocation;job.linkPrunes=result.pruning.linkUiLoops.counts;
  thisSliceNodes+=result.invocation.visited;thisSliceJobs++;
  if(wrapped)console.log(JSON.stringify({round:state.round,firstPass:state.jobs.filter(j=>afterAllure(j)&&j.visits>0).length,visited:state.jobs.reduce((n,j)=>n+j.visited,0),complete:state.jobs.filter(j=>j.complete).length,drawFrontiers:frontierMap.size}));
}
state.slices++;
const result=summarize();
console.log(JSON.stringify({status:result.totals.failures?'CHECK_FAILURES':result.complete?'COMPLETE':'PARTIAL',sliceJobs:thisSliceJobs,sliceNodes:thisSliceNodes,elapsedMs:Date.now()-started,
  round:result.round,cursor:result.cursor,firstPass:result.firstPassVisited,totalAfterAllure:result.afterAllureJobs,completeJobs:result.completeJobs,totals:result.totals}));
