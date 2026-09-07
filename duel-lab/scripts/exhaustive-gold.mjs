import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {startRoute,respond,select,selectCard,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=path.join(ROOT,'routes/exhaustive-gold.json');
const RUNTIME=path.join(ROOT,'runtime/search-gold');
const C={gold:75500286,dormouse:32061192,rabbit:69272449,cat:96676583,hare:20938824,tb:57111661,mtp:94722358,decoder:30342076,sp:29301450,binder:95454996};
const args=process.argv.slice(2);
const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));

function run(g,commands){
 for(const [kind,...values] of commands){
  if(kind==='idle')select(g,c=>c.response.action===values[0]&&c.card?.code===values[1]);
  else if(kind==='card')selectCard(g,values[0]);
  else if(kind==='yes'||kind==='no')select(g,c=>c.response.yes===(kind==='yes'));
  else if(kind==='material')select(g,c=>c.label.startsWith('選択：')&&c.card?.code===values[0]);
  else if(kind==='finish')select(g,c=>c.label==='選択を確定');
  else if(kind==='auto')for(let i=0;i<60;i++){
   if(g.prompt.type==='SELECT_CHAIN')select(g,c=>c.label==='発動しない');
   else if(g.prompt.type==='SELECT_PLACE')respond(g,{selection:[0]});
   else if(g.prompt.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
   else break;
  }
  else throw Error(`Unknown command ${kind}`);
 }
}

const dormantTbPrefix=[['idle',5,C.gold],['auto'],['card',C.dormouse],['yes'],['auto'],['idle',5,C.dormouse],['auto'],['card',C.rabbit],['yes'],['auto'],['yes'],['card',C.tb],['auto']];
const probes=[];
const routes=[];
const coverage=[];
for(const cost of [C.dormouse,C.rabbit]){
 let candidates;
 const initial=await startRoute([C.gold]);
 try {
  run(initial,[...dormantTbPrefix,['idle',5,C.tb],['card',cost],['auto']]);
  assert.equal(initial.prompt.type,'SELECT_CARD');
  candidates=[...new Set(initial.prompt.cards.map(c=>c.code))].sort((a,b)=>a-b);
  coverage.push({cost,candidates,copies:initial.prompt.cards.length,scope:'TBの当日発動コスト2種類それぞれについて、初回デッキ特殊召喚対象の全カード名を実coreから列挙。配置は固定したprobeであり、その後の手順木とは区別する。'});
 } finally {initial.close();}
 for(const target of candidates){
  const g=await startRoute([C.gold]);
  try{
   const commands=[...dormantTbPrefix,['idle',5,C.tb],['card',cost],['auto'],['card',target],['auto']];
   run(g,commands);
   assert.equal(g.prompt.type,'SELECT_IDLECMD');
   assert.equal(g.lp[0],7400);
   assert.equal(g.turn,1);
   assert(!g.log.some(e=>e.text.includes('枚ドロー')));
   assert.equal(board(g).players[0].hand.length,0);
   assert.equal(board(g).players[0].monsters.filter(Boolean).length,2);
   const route=finishRoute(g,{id:`gold-dormouse-tb-${cost}-${target}`,starter:C.gold,classification:'one-card-prefix',requiresDraw:false,commands,cost,target,limitations:['TBから出したモンスターはそのままでは効果を発動できない','初回配置は最初の合法ゾーン・攻撃表示を採ったprefixで、全配置の探索証明ではない']});
   await replay(route);
   probes.push(route);
   console.log(`PASS ${route.id}: ${route.steps.length} inputs; LP ${route.final.lp[0]}`);
  }finally{g.close();}
 }
}

{
 const g=await startRoute([C.gold]);
 try{
  const commands=[...dormantTbPrefix,['idle',5,C.tb],['card',C.rabbit],['auto'],['card',C.cat],['auto'],['idle',1,C.decoder],['material',C.dormouse],['auto'],['idle',1,C.sp],['material',C.decoder],['material',C.cat],['auto'],['yes'],['card',C.cat],['auto'],['yes'],['auto'],['idle',1,C.binder],['material',C.sp],['material',C.cat],['auto'],['no'],['idle',5,C.binder],['auto'],['card',C.mtp],['auto']];
  run(g,commands);
  assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.lp[0],7100);
  assert.deepEqual(board(g).players[0].monsters.filter(Boolean).map(c=>c.code),[C.binder]);
  assert.deepEqual(board(g).players[0].spells.filter(Boolean).map(c=>c.code),[C.mtp]);
  assert(!g.route.steps.some(step=>step.label.startsWith('召喚：')),'Normal summon must remain unused');
  assert(!g.log.some(e=>e.text.includes('枚ドロー')));
  const route=finishRoute(g,{id:'gold-dormouse-tb-binder-mtp',starter:C.gold,classification:'one-card',requiresDraw:false,normalSummonUsed:false,commands,summary:'Dormouse先除外→Rabbit/TB→Catを一度SPで除外して帰還→WHITE BINDERと未使用MTP。7100LP、通常召喚未使用。',limitations:['最強盤面の証明ではない','MTPからの継続・相手ターン運用はこの固定ルートの到達点に含めない']});
  await replay(route);routes.push(route);console.log(`PASS ${route.id}: ${route.steps.length} inputs; LP ${route.final.lp[0]}`);
 }finally{g.close();}
}

fs.mkdirSync(RUNTIME,{recursive:true});
const previous=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT)):{};
function compactSearch(entry){
 if(!entry?.result)return entry;
 const searched=entry.result;
 const checkpointPath=path.join(RUNTIME,`${entry.prefix}.checkpoint.json`);
 const content=fs.readFileSync(checkpointPath);
 const {result:_,...metadata}=entry;
 return {...metadata,summary:{visited:searched.visited,generated:searched.generated,replayedResponses:searched.replayedResponses,terminals:searched.terminals.length,rejected:searched.rejected.length,failures:searched.failures.length,frontier:searched.frontier.length,frontierReasons:searched.frontier.reduce((out,frame)=>(out[frame.reason]=(out[frame.reason]||0)+1,out),{}),complete:searched.complete,invocation:searched.invocation,pruning:searched.pruning,scope:searched.scope},checkpoint:{path:`runtime/search-gold/${entry.prefix}.checkpoint.json`,bytes:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex'),contains:['all visited counters','all terminal routes','all rejected prefixes','all unresolved frontier inputs','bounds and scope']}};
}
const result={schemaVersion:2,generatedAt:new Date().toISOString(),starter:C.gold,presetHash:hash(preset),scope:'黄金櫃1枚をpreset40枚から差し引いた39枚の山札、EX15枚、先攻1ターン目・相手空盤面・無妨害。実coreでの全後続探索は予算付きで、未探索frontierを残す。',assumptions:['初期手札は黄金櫃のみ','任意ドローは確定線と分離','同名別コピー、配置、表示形式、素材順も共通カーネルの列挙対象','盤面一致による未証明の状態統合は行わない'],coverage,probes,routes,search:compactSearch(previous.search)||null,searches:Object.fromEntries(Object.entries(previous.searches||{}).map(([key,entry])=>[key,compactSearch(entry)])),complete:false,unresolved:['共通カーネルによる全初回選択・全後続EX/素材/発動/配置の残り木','任意ドローの全結果','相手の妨害と相手ターン分岐','1枚以外の初期手札を使う展開']};
result.drawHandoffs=previous.drawHandoffs||[];
result.representatives=previous.representatives||[];
result.audit=previous.audit||null;
result.extension=previous.extension||null;
const save=()=>{fs.writeFileSync(`${OUT}.tmp`,JSON.stringify(safe(result),null,2)+'\n');fs.renameSync(`${OUT}.tmp`,OUT);};
if(!args.includes('--verify-only')&&!args.includes('--verify-checkpoints')){
 result.audit=null;
 const {search}=await import('./search-kernel.mjs');
 const spellFile=path.join(ROOT,'routes/spell-starters.json');
 const spellData=fs.existsSync(spellFile)?JSON.parse(fs.readFileSync(spellFile)):{};
 const shared=(spellData.routes||[]).filter(route=>route.starter===C.gold);
 const accordSource=shared.find(route=>route.id==='spell-75500286-rabbit-hare-accord');
 let drawSource;
 if(accordSource){
  const drawIndex=accordSource.steps.findIndex(step=>step.prompt==='SELECT_YESNO');
  assert(drawIndex>=0);
  const game=await startRoute([C.gold]);
  try{
   for(const step of accordSource.steps.slice(0,drawIndex))respond(game,step.input);
   assert.equal(game.prompt.type,'SELECT_YESNO');
   assert.equal(BigInt(game.pending.description),(95454996n<<20n)|3n);
   drawSource=finishRoute(game,{id:'gold-wb-before-draw',starter:C.gold,source:`routes/spell-starters.json#${accordSource.id}`,boundary:'WHITE BINDER optional draw before yes/no',drawNotPerformed:true});
   await replay(drawSource);
   if(!result.drawHandoffs.some(route=>hash(route.steps)===hash(drawSource.steps)))result.drawHandoffs.push(drawSource);
   fs.writeFileSync(path.join(RUNTIME,'draw-handoff-gold-wb.json'),JSON.stringify(drawSource,null,2)+'\n');
   console.log(`PASS gold-wb-before-draw: ${drawSource.steps.length} inputs; draw not performed`);
  }finally{game.close();}
 }
 const selected=value('--prefix','root');
 let jobs;
 if(args.includes('--warm')){
  assert(drawSource,'The separately verified Gold Accord line must exist');
  jobs=[{selected:routes[0].id,source:routes[0],sourceFile:'routes/exhaustive-gold.json'},{selected:drawSource.id,source:drawSource,sourceFile:'routes/spell-starters.json'}];
 } else if(args.includes('--all-targets')||args.includes('--focus')){
  jobs=(spellData.probes||[]).filter(route=>route.starter===C.gold).map(route=>{
   const through=route.steps.findIndex(step=>step.prompt==='SELECT_CARD');
   assert(through>=0);
   return {selected:`gold-first-${route.firstBanish}`,source:{...route,steps:route.steps.slice(0,through+1)},sourceFile:'routes/spell-starters.json'};
  });
  assert.equal(jobs.length,25,'Expected all 25 distinct initial Gold targets');
  if(args.includes('--focus'))jobs=[{selected:'root',source:null,sourceFile:null},...jobs.filter(job=>[C.dormouse,C.rabbit].some(code=>job.selected===`gold-first-${code}`))];
 } else {
  const source=selected==='root'?null:[...probes,...routes,...shared,...(drawSource?[drawSource]:[])].find(route=>route.id===selected);
  assert(selected==='root'||source,`Unknown prefix ${selected}`);
  jobs=[{selected,source,sourceFile:shared.includes(source)?'routes/spell-starters.json':'routes/exhaustive-gold.json'}];
 }
 const additionalNodes=Number(value('--additional-nodes',0));
 assert(Number.isSafeInteger(additionalNodes)&&additionalNodes>=0,'additional-nodes must be a non-negative integer');
 let invocationVisited=0,round=0;
 do {
 const roundStart=invocationVisited;round++;
 for(const {selected,source,sourceFile} of jobs){
  if(additionalNodes&&invocationVisited>=additionalNodes)break;
  const checkpointPath=path.join(RUNTIME,`${selected}.checkpoint.json`);
  const maxNodes=Number(value('--max-nodes',100));
  const options={hand:[C.gold],prefix:source?.steps||[],seed:123,maxNodes:additionalNodes?Math.min(maxNodes,additionalNodes-invocationVisited):maxNodes,maxDepth:Number(value('--max-depth',100)),maxMs:Number(value('--max-ms',30000)),stopOnDraw:true,pruneLinkUiLoops:true,checkpointPath,onProgress:stats=>{if(stats.visited%250===0)console.log('SEARCH '+selected+' '+JSON.stringify(safe(stats)));}};
  const held=[];
  if((args.includes('--resume')||round>1)&&fs.existsSync(checkpointPath)){
   options.resume=JSON.parse(fs.readFileSync(checkpointPath));
   options.resume.frontier=options.resume.frontier.filter(frame=>{
    const unchangedBoundary=frame.reason==='drawBoundary'||(frame.reason==='maxDepth'&&frame.prefix.length>=options.maxDepth)||(round>1&&['opponentDecision','sumSortContractUnverified','noEnumeratedCandidates','error'].includes(frame.reason));
    if(unchangedBoundary)held.push(frame);
    return !unchangedBoundary;
   });
   // Drain legacy temporary boundaries through the audited v2 policy first.
   options.resume.frontier.sort((a,b)=>Number(a.reason==='cancelBoundary')-Number(b.reason==='cancelBoundary'));
  }
  const searched=await search(options);
  invocationVisited+=searched.invocation.visited;
  if(held.length){
   searched.frontier=[...held,...searched.frontier];searched.complete=false;
   searched.invocation.previouslyHeld=held.length;
   fs.writeFileSync(`${checkpointPath}.tmp`,JSON.stringify(safe(searched),null,2)+'\n');
   fs.renameSync(`${checkpointPath}.tmp`,checkpointPath);
  }
  result.search=compactSearch({prefix:selected,prefixSource:source?{id:source.id,steps:source.steps.length,presetHash:source.presetHash,sourceFile}:null,bounds:{...searched.bounds,cancelBoundary:false},result:searched});
  result.searches[selected]=result.search;
  result.extension={requestedAdditionalNodes:additionalNodes,visitedThisInvocation:invocationVisited,round,jobIds:jobs.map(job=>job.selected)};
  save();
  console.log('SLICE '+JSON.stringify({prefix:selected,visited:searched.visited,generated:searched.generated,terminal:searched.terminals.length,frontier:searched.frontier.length,failures:searched.failures.length,complete:searched.complete,elapsedMs:searched.invocation.elapsedMs}));
 }
 if(!additionalNodes||invocationVisited>=additionalNodes||roundStart===invocationVisited)break;
 }while(true);
}
if(args.includes('--verify-checkpoints')){
 const examples=[];
 const drawHandoffs=[...(result.drawHandoffs||[])];
 for(const [id,entry] of Object.entries(result.searches)){
  const content=fs.readFileSync(path.join(ROOT,entry.checkpoint.path));
  assert.equal(content.length,entry.checkpoint.bytes);
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),entry.checkpoint.sha256);
  const stored=JSON.parse(content);
  assert.equal(stored.presetHash,hash(preset));
  assert.deepEqual(stored.hand,[C.gold]);
  assert.equal(stored.visited,entry.summary.visited);
  assert.equal(stored.frontier.length,entry.summary.frontier);
  assert.equal(stored.terminals.length,entry.summary.terminals);
  assert.equal(stored.failures.length,0);
  assert.equal(stored.complete,stored.frontier.length===0);
  for(const frame of stored.frontier.filter(frame=>frame.reason==='drawBoundary')){
   const game=await startRoute(stored.hand,{seed:stored.seed});
   try{
    for(const input of frame.prefix){
     if(game.prompt.type==='SELECT_YESNO'&&BigInt(game.pending.description)===(95454996n<<20n|3n)){
      assert(!game.log.some(event=>event.text.startsWith('YOU')&&event.text.includes('枚ドロー')));
      const handoff=finishRoute(game,{id:`${id}-before-white-binder-draw`,starter:C.gold,sourceCheckpoint:entry.checkpoint.path,boundary:'WHITE BINDER optional draw before yes/no',drawNotPerformed:true});
      await replay(handoff);
      if(!drawHandoffs.some(route=>hash(route.steps)===hash(handoff.steps)))drawHandoffs.push(handoff);
      fs.writeFileSync(path.join(RUNTIME,`${id}.draw-handoff.json`),JSON.stringify(handoff,null,2)+'\n');
      break;
     }
     respond(game,input);
    }
   }finally{game.close();}
  }
  const signatures=new Set();
  const ordered=stored.terminals.filter(route=>!route.steps.some(step=>step.label==='キャンセル'||step.label.startsWith('解除：'))).sort((a,b)=>b.final.players[0].monsters.filter(Boolean).length-a.final.players[0].monsters.filter(Boolean).length||a.steps.length-b.steps.length);
  for(const route of ordered){
   // Grouping chooses verification examples only; search states are not merged.
   const player=route.final.players[0];
   const signature=hash([route.final.lp[0],...['hand','monsters','spells'].map(zone=>player[zone].filter(Boolean).map(card=>card.code).sort((a,b)=>a-b))]);
   if(signatures.has(signature))continue;
   await replay(route);signatures.add(signature);
   examples.push({...route,id:`${id}-terminal-example-${signatures.size}`,starter:C.gold,sourceCheckpoint:entry.checkpoint.path,requiresDraw:route.log.some(event=>event.text.startsWith('YOU')&&event.text.includes('枚ドロー'))});
   if(signatures.size>=2)break;
  }
 }
 result.representatives=examples;
 result.drawHandoffs=drawHandoffs;
 result.audit={verifiedAt:new Date().toISOString(),checkpoints:Object.keys(result.searches).length,independentlyReplayedTerminalExamples:examples.length,failures:0};
 console.log(`PASS checkpoint SHA/state audit: ${result.audit.checkpoints} checkpoints; ${examples.length} independently replayed terminal examples`);
}
save();
console.log(`Saved ${probes.length} independently replayed TB probes and ${routes.length} independently replayed continuation; complete=false.`);
