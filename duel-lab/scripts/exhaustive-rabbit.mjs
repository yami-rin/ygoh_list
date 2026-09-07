import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {OcgQueryFlags as Q} from 'ocgcore-wasm';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const C={rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,tb:57111661,mtp:94722358,gwc:20726052,
  decoder:30342076,wicked:52698008,contract:37458564,sp:29301450,ip:65741786,wp:4993187,binder:95454996,
  crypter:21848500,transcode:46947713,firewall:5043010,access:86066372,accord:39138610,perfectron:13203964};
const output=path.join(ROOT,'routes/exhaustive-rabbit.json');
const runtime=path.join(ROOT,'runtime/search-rabbit');
const reportOnly=process.argv.includes('--report-only');
const verifySaved=process.argv.includes('--verify-saved');
const searchOnly=process.argv.includes('--search-only')||reportOnly||verifySaved;
fs.mkdirSync(runtime,{recursive:true});
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/malice-monsters.json'),'utf8'));
const existing=[...source.routes,...source.probes].filter(r=>r.starter===C.rabbit);
// Measured v1 counters immediately before the first v2 resume. These are an
// accounting baseline, not a reconstructed checkpoint or a search-state key.
const legacyV1={root:[1588,280,688],'rabbit-first-94722358-69272449':[1291,356,291],
  'rabbit-first-94722358-96676583':[829,231,202],'rabbit-first-94722358-32061192':[770,213,198],
  'rabbit-first-94722358-20938824':[1004,163,449],'rabbit-first-20726052-self':[1009,268,275],
  'rabbit-tb-first-69272449':[1084,171,489],'rabbit-tb-first-96676583':[1161,174,533],
  'rabbit-tb-first-20938824':[1147,174,525],'rabbit-tb-dorm':[1158,176,529]};
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const compact=g=>safe({type:g.prompt.type,title:g.prompt.title,pending:g.pending,
  choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response})),
  min:g.prompt.min,max:g.prompt.max,cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place}))});
const audit=new Map(),drawFrontiers=new Map(),directed=[];
const savedDrawPath=path.join(runtime,'draw-frontiers.json');
if(fs.existsSync(savedDrawPath))for(const f of JSON.parse(fs.readFileSync(savedDrawPath,'utf8')))drawFrontiers.set(f.prefixHash,f);
function observe(g,sourceId) {
  const prefix=g.route.steps.map(s=>s.input),prefixHash=hash(prefix);
  if(audit.has(prefixHash))return;
  const entry={sourceId,prefixHash,prefix,depth:prefix.length,board:board(g),prompt:compact(g)};
  audit.set(prefixHash,entry);
  const d=BigInt(g.pending.description||0);
  const optionalBinderDraw=g.prompt.type==='SELECT_YESNO' && Number(d>>20n)===C.binder && Number(d&0xfffffn)===3;
  if(optionalBinderDraw)drawFrontiers.set(prefixHash,{...entry,reason:'optional-binder-draw',
    remainingDeckCodes:g.lib.duelQueryLocation(g.handle,{controller:0,location:1,flags:Q.CODE}).filter(Boolean).map(c=>c.code),
    yesInput:{action:g.prompt.choices.find(c=>c.response.yes===true).id}});
}
async function restore(prefix,sourceId) {
  const g=await startRoute([C.rabbit]);
  try {
    for(const step of prefix) {
      observe(g,sourceId);
      if(step.before)assert.equal(hash({pending:g.pending,board:board(g)}),step.before,'Reference route drift');
      respond(g,step.input||step);
    }
    observe(g,sourceId);
    return g;
  }catch(e){g.close();throw e;}
}
function settle(g,{materials=[],picks=[],places=[]}={}) {
  materials=[...materials];picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);places=[...places];
  for(let n=0;n<100;n++) {
    observe(g,'directed-extension');
    const p=g.prompt;
    if(p.type==='SELECT_IDLECMD') {
      assert.equal(materials.length,0);assert.equal(picks.length,0);return;
    }
    if(p.type==='SELECT_CHAIN') {
      const c=p.choices.find(c=>c.card&&([C.binder,C.rabbit,C.cat,C.dorm,C.decoder,C.access,C.accord].includes(c.card.code)||(c.card.code===C.crypter&&c.card.location===32)))||p.choices.find(c=>!c.card);
      assert(c);respond(g,{action:c.id});
    }else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO') {
      const d=BigInt(g.pending.description||0),draw=p.type==='SELECT_YESNO'&&Number(d>>20n)===C.binder&&Number(d&0xfffffn)===3;
      const c=p.choices.find(c=>c.response.yes===!draw);assert(c);respond(g,{action:c.id});
    }else if(p.type==='SELECT_PLACE') {
      const seq=places.shift();const i=seq===undefined?0:p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===seq);
      assert(i>=0,JSON.stringify(compact(g)));respond(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION') {
      respond(g,{action:(p.choices.find(c=>c.response.position===1)||p.choices[0]).id});
    }else if(p.type==='SELECT_CARD') {
      let want=picks.shift();if(!want&&p.cards.length===p.min&&p.min===p.max)want=p.cards.map(c=>c.code);
      assert(want,`Card selection required: ${JSON.stringify(compact(g))}`);
      const selection=[];for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,JSON.stringify(compact(g)));selection.push(i);}respond(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD') {
      const code=materials.shift();const c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.label.startsWith('選択：')&&c.card?.code===code);
      assert(c,`Material ${code}: ${JSON.stringify(compact(g))}`);respond(g,{action:c.id});
    }else assert.fail(`Unhandled directed prompt ${JSON.stringify(compact(g))}`);
  }
  assert.fail('Directed extension response bound');
}
function link(g,code,materials,opts={}) {
  select(g,c=>c.response.action===1&&c.card?.code===code);settle(g,{materials,...opts});
}
function activate(g,code,opts={}) {
  select(g,c=>c.response.action===5&&c.card?.code===code);settle(g,opts);
}
function assertFixture(g) {
  const s=g.snapshot(0),own=s.players[0],opp=s.players[1];
  assert.equal(s.turn,1);assert.equal(s.phase,'MAIN 1');
  for(const z of ['hand','monsters','spells','grave','banished'])assert.equal(opp[z].filter(Boolean).length,0,'Opponent must remain empty');
  const main=own.deckCount+['hand','monsters','spells','grave','banished'].reduce((n,z)=>n+own[z].filter(c=>c&&!(c.type&0x4000000)).length,0);
  assert.equal(main,40,'Do not duplicate the one-card fixture');
  assert(!g.log.some(e=>e.text.includes('枚ドロー')),'Directed routes must not use a particular draw');
}

if(!searchOnly)for(const r of existing) {
  const g=await restore(r.steps,r.id);
  assert.equal(hash(board(g)),r.finalHash);assertFixture(g);g.close();
}
const commonRoute=existing.find(r=>r.id==='rabbit-no-draw-ip');
const endIndex=commonRoute.steps.findIndex(s=>s.label==='特殊召喚：I：Pマスカレーナ');
assert(endIndex>=0,'Missing known three-body prefix');
const commonPrefix=commonRoute.steps.slice(0,endIndex);
if(!searchOnly)for(const endpoint of ['wicked','contract','firewall','access','transcode','wp','perfectron','crypter-self-return']) {
  const id=`rabbit-directed-${endpoint}`;
  const g=await restore(commonPrefix,id);
  try {
    if(endpoint==='wicked'||endpoint==='contract')link(g,C[endpoint],[C.cat,C.hare],{places:[5]});
    else if(endpoint==='firewall')link(g,C.firewall,[C.binder,C.cat],{places:[5]});
    else if(endpoint==='access')link(g,C.access,[C.binder,C.cat],{picks:[C.binder],places:[5]});
    else if(['transcode','wp'].includes(endpoint))link(g,C[endpoint],[C.binder,C.cat,C.hare],{places:[5]});
    else if(endpoint==='perfectron') {
      link(g,C.wicked,[C.cat,C.hare],{places:[5]});
      link(g,C.perfectron,[C.binder,C.wicked],{places:[5]});
    }
    else {
      link(g,C.crypter,[C.binder,C.cat,C.hare],{places:[5]});
      activate(g,C.crypter,{picks:[C.tb,C.crypter],places:[0]});
    }
    assertFixture(g);
    const expected={wicked:[C.binder,C.wicked],contract:[C.binder,C.contract],firewall:[C.firewall,C.hare],
      access:[C.access,C.hare],transcode:[C.transcode],wp:[C.wp],perfectron:[C.perfectron],'crypter-self-return':[C.crypter]}[endpoint];
    const finalMonsters=g.snapshot(0).players[0].monsters.filter(Boolean);
    assert.deepEqual(finalMonsters.map(c=>c.code).sort((a,b)=>a-b),expected.sort((a,b)=>a-b));
    assert.deepEqual(g.lp,[endpoint==='crypter-self-return'?5300:6200,8000]);
    if(endpoint==='access')assert.equal(finalMonsters.find(c=>c.code===C.access).attack,5300);
    if(endpoint==='crypter-self-return')assert.equal(finalMonsters.find(c=>c.code===C.crypter).attack,5600,'5000 plus the active Dormouse 600 buff');
    if(endpoint==='transcode')assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.transcode),'S:P turn must prevent Transcode revival');
    directed.push(finishRoute(g,{id,starter:C.rabbit,name:`Rabbit単独 ${endpoint}`,requiresDraw:false,
      conditions:['固定preset40+15','先攻1ターン目・開始手札Rabbit1枚のみ','相手手札/盤面は空','ドロー不使用'],
      summary:'既存TB→Dormouse→Decoder/S:P→Cat→Binder/MTP→Hare共通部からの追加EX分岐。最適性および全分岐完了は主張しない。'}));
  }finally{g.close();}
}
for(const r of directed)await replay(r);

const artifact=searchOnly?JSON.parse(fs.readFileSync(output,'utf8')):{schemaVersion:1,date:'2026-09-08',presetHash:hash(preset),starter:C.rabbit,hand:[C.rabbit],
  scope:'固定40+15、先攻1枚手札・相手空盤面。応答履歴・位置・同名個体・効果使用履歴を同一視しない。',
  completion:'PARTIAL',exhaustive:false,
  boundaries:['指向的な追加8ルートと既存Rabbit11ルートの選択肢監査。全合法木の完了ではない。','応答候補の列挙と合法入力受理は別物。監査表の候補は未試行を含む。','任意Binderドローの前状態と残り山札をfrontier保存。ドローの全中身分岐は別担当。'],
  firstBranchTable:{rabbitSet:{legal:[C.tb,C.mtp,C.gwc],allFirstCardTypesProbed:true},
    tbSummon:{legalTypes:[C.rabbit,C.cat,C.dorm,C.hare],allFirstCardTypesProbed:true,allCopiesAndPositionsProbed:false},
    mtpSearch:{legalTypes:[C.rabbit,C.cat,C.dorm,C.hare],allFirstCardTypesProbed:true,allCopiesAndPositionsProbed:false},
    gwc:'初回セット直後、墓地/除外の蘇生可能M∀LICEが無いため発動不可。'},
  sourceRouteIds:existing.map(r=>r.id),routes:directed,
  auditCounts:{exactHistoryPrefixes:audit.size,drawFrontiers:drawFrontiers.size},
  auditedBranches:[...audit.values()],drawFrontiers:[...drawFrontiers.values()]};
if(!searchOnly&&fs.existsSync(output)) {
  const previousArtifact=JSON.parse(fs.readFileSync(output,'utf8'));
  if(previousArtifact.presetHash===artifact.presetHash&&previousArtifact.search)artifact.search=previousArtifact.search;
}
if(searchOnly) {
  assert.equal(artifact.presetHash,hash(preset),'Reverify directed routes after preset changes');
  const drawPath=path.join(runtime,'draw-frontiers.json');
  for(const f of fs.existsSync(drawPath)?JSON.parse(fs.readFileSync(drawPath,'utf8')):artifact.drawFrontiers)drawFrontiers.set(f.prefixHash,f);
}
function publishArtifact() {
  if(artifact.auditedBranches.some(e=>e.prompt)) {
    fs.writeFileSync(path.join(runtime,'audited-branches.json'),JSON.stringify(artifact.auditedBranches,null,2)+'\n');
    artifact.auditedBranches=artifact.auditedBranches.map(({sourceId,prefixHash,depth,prompt})=>({sourceId,prefixHash,depth,
      promptType:prompt.type,title:prompt.title,choiceCount:prompt.choices.length,selectableCards:prompt.cards?.length||0}));
  }
  const allDraws=[...drawFrontiers.values()],representatives=new Map();
  fs.writeFileSync(path.join(runtime,'draw-frontiers.json'),JSON.stringify(allDraws,null,2)+'\n');
  for(const f of allDraws)if(!representatives.has(f.sourceId))representatives.set(f.sourceId,f);
  artifact.drawFrontiers=[...representatives.values()];
  artifact.drawFrontierSummary=allDraws.map(f=>({prefixHash:f.prefixHash,sourceId:f.sourceId,depth:f.prefix.length,remainingDeckCount:f.remainingDeckCodes.length}));
  artifact.auditCounts.drawFrontiers=allDraws.length;
  artifact.rawEvidence={audit:'runtime/search-rabbit/audited-branches.json',draws:'runtime/search-rabbit/draw-frontiers.json',
    search:'runtime/search-rabbit/*.checkpoint.json',note:'Tracked records retain summaries and representative legal routes; complete input histories remain in runtime.'};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(artifact,null,2)+'\n');
}
publishArtifact();
if(verifySaved) {
  for(const r of artifact.routes)await replay(r);
  for(const f of drawFrontiers.values()) {
    assert.equal(hash(f.prefix),f.prefixHash,'Draw input history hash mismatch');
    const g=await startRoute([C.rabbit]);
    try {
      for(const input of f.prefix)respond(g,input);
      assert.equal(hash(board(g)),hash(f.board),'Draw pre-state board mismatch');
      const d=BigInt(g.pending.description||0);
      assert.equal(g.prompt.type,'SELECT_YESNO');assert.equal(Number(d>>20n),C.binder);assert.equal(Number(d&0xfffffn),3);
      assert.deepEqual(g.lib.duelQueryLocation(g.handle,{controller:0,location:1,flags:Q.CODE}).filter(Boolean).map(c=>c.code),f.remainingDeckCodes,'Draw remaining deck mismatch');
      assert.equal(g.prompt.choices.find(c=>c.id===f.yesInput.action)?.response.yes,true);
    }finally{g.close();}
  }
  for(const s of artifact.search.summaries) {
    const checkpoint=JSON.parse(fs.readFileSync(path.join(ROOT,s.checkpoint),'utf8'));
    assert.equal(checkpoint.presetHash,artifact.presetHash);assert.deepEqual(checkpoint.hand,[C.rabbit]);
    assert.equal(hash(checkpoint.rootPrefix),hash(s.prefix),'Checkpoint root prefix mismatch');
    assert.equal(checkpoint.visited,s.visited);assert.equal(checkpoint.terminals.length,s.terminals);
    assert.equal(checkpoint.frontier.length,s.frontier);assert.equal(checkpoint.complete,s.complete);
    assert.equal(checkpoint.failures.length,s.failures);assert.equal(checkpoint.rejected.length,s.rejected);
    if(s.previousSnapshot)assert(fs.existsSync(path.join(ROOT,s.previousSnapshot)),'Missing preserved checkpoint');
  }
  assert.equal(artifact.search.visited,artifact.search.summaries.reduce((n,s)=>n+s.visited,0));
  assert.equal(artifact.search.terminals,artifact.search.summaries.reduce((n,s)=>n+s.terminals,0));
  assert.equal(artifact.search.frontier,artifact.search.summaries.reduce((n,s)=>n+s.frontier,0));
  console.log(JSON.stringify({verification:'PASS',routes:artifact.routes.length,drawPrefixes:drawFrontiers.size,
    checkpoints:artifact.search.summaries.length,visited:artifact.search.visited,terminals:artifact.search.terminals,frontier:artifact.search.frontier}));
}
if(!searchOnly)console.log(JSON.stringify({result:'PASS',existing:existing.length,newRoutes:directed.map(r=>({id:r.id,steps:r.steps.length,board:r.final.players[0].monsters.filter(Boolean).map(c=>c.code),lp:r.final.lp})),audit:artifact.auditCounts,exhaustive:false}));

if(process.argv.includes('--search')||reportOnly) {
  const {search}=await import('./search-kernel.mjs');
  const value=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:Number(process.argv[i+1]);};
  const sharded=process.argv.includes('--sharded');
  const seeds=[{id:'root',prefix:[]}];
  if(sharded) {
    for(const r of existing.filter(r=>r.id.startsWith('rabbit-first-')||r.id.startsWith('rabbit-tb-first-'))) {
      const stop=r.steps.findIndex(s=>s.label.startsWith('特殊召喚：リンク・デコーダー')||s.label.startsWith('効果発動：M∀LICE＜P＞March Hare'));
      seeds.push({id:r.id,prefix:stop<0?r.steps:r.steps.slice(0,stop)});
    }
    const i=commonRoute.steps.findIndex(s=>s.label.startsWith('特殊召喚：リンク・デコーダー'));
    seeds.push({id:'rabbit-tb-dorm',prefix:commonRoute.steps.slice(0,i)});
  }
  if(process.argv.includes('--canonical-root')||fs.existsSync(path.join(runtime,'canonical-v2-root.checkpoint.json')))
    seeds.push({id:'canonical-v2-root',prefix:[]});
  const selectedIndex=value('--shard',-1);
  const selected=reportOnly?[]:selectedIndex<0?seeds:[seeds[selectedIndex]];
  assert(selected.every(Boolean),'Unknown shard index');
  const summaries=[];
  for(const seed of selected) {
    const checkpointPath=path.join(runtime,`${seed.id}.checkpoint.json`);
    const summaryPath=path.join(runtime,`${seed.id}.summary.json`);
    const before=fs.existsSync(summaryPath)?JSON.parse(fs.readFileSync(summaryPath,'utf8')):{visited:0,terminals:0,frontier:0};
    if(before.complete&&process.argv.includes('--resume')) {
      summaries.push(before);console.log(JSON.stringify({search:{id:seed.id,alreadyComplete:true,visited:before.visited,terminals:before.terminals,frontier:0}}));continue;
    }
    if(process.argv.includes('--resume')&&before.frontier>0&&Object.keys(before.reasons||{}).length&&
        Object.keys(before.reasons).every(reason=>reason==='drawBoundary')) {
      summaries.push(before);console.log(JSON.stringify({search:{id:seed.id,drawHandoffOnly:true,visited:before.visited,terminals:before.terminals,frontier:before.frontier}}));continue;
    }
    let previousSnapshot=null;
    if(process.argv.includes('--resume')&&fs.existsSync(checkpointPath)) {
      const history=path.join(runtime,'history',seed.id);fs.mkdirSync(history,{recursive:true});
      const snapshot=path.join(history,`${before.visited}-${Date.now()}.json`);
      fs.copyFileSync(checkpointPath,snapshot,fs.constants.COPYFILE_EXCL);previousSnapshot=path.relative(ROOT,snapshot);
    }
    const options={hand:[C.rabbit],prefix:seed.prefix,maxNodes:value('--nodes',100),maxDepth:value('--depth',160),maxMs:value('--ms',30000),
      stopOnDraw:true,checkpointPath,onNode(g) {
        const d=BigInt(g.pending.description||0);
        if(g.prompt.type==='SELECT_YESNO'&&Number(d>>20n)===C.binder&&Number(d&0xfffffn)===3)observe(g,`search:${seed.id}`);
      }};
    if(process.argv.includes('--resume')&&fs.existsSync(checkpointPath)) {
      if(process.argv.includes('--prioritize-depth')) {
        const previous=JSON.parse(fs.readFileSync(checkpointPath,'utf8'));
        // DFS pops from the end. Preserve every frame; only visitation order
        // changes. The kernel alone decides whether a frame is a safe no-op.
        previous.frontier=[...previous.frontier.filter(f=>f.reason!=='maxDepth'),...previous.frontier.filter(f=>f.reason==='maxDepth')];
        options.resume=previous;
      }else options.resume=checkpointPath;
    }
    const result=await search(options);
    const {examples=[],...linkUiLoops}=result.pruning.linkUiLoops||{};
    const summary={id:seed.id,kernelVersion:result.version,prefix:seed.prefix.map(s=>s.input||s),visited:result.visited,generated:result.generated,
      terminals:result.terminals.length,frontier:result.frontier.length,rejected:result.rejected.length,failures:result.failures.length,
      drawHandoffOnly:result.frontier.length>0&&result.frontier.every(f=>f.reason==='drawBoundary'),
      reasons:result.frontier.reduce((a,f)=>(a[f.reason]=(a[f.reason]||0)+1,a),{}),complete:result.complete,bounds:result.bounds,invocation:result.invocation,
      change:{visited:result.visited-before.visited,terminals:result.terminals.length-before.terminals,frontier:result.frontier.length-before.frontier},
      pruning:{...result.pruning,linkUiLoops:{...linkUiLoops,exampleCount:examples.length}},checkpointCompatibility:result.checkpointCompatibility,previousSnapshot,
      frontierOrder:process.argv.includes('--prioritize-depth')?'maxDepth-first-through-kernel':'kernel-default',
      checkpoint:path.relative(ROOT,checkpointPath)};
    fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n');
    summaries.push(summary);console.log(JSON.stringify({search:{id:summary.id,kernelVersion:summary.kernelVersion,visited:summary.visited,terminals:summary.terminals,
      frontier:summary.frontier,complete:summary.complete,change:summary.change,elapsedMs:summary.invocation.elapsedMs,
      pruned:summary.pruning.linkUiLoops.counts,rejected:summary.rejected,failures:summary.failures,reasons:summary.reasons}}));
  }
  const allSummaries=seeds.map(s=>path.join(runtime,`${s.id}.summary.json`)).filter(f=>fs.existsSync(f)).map(f=>{
    const summary=JSON.parse(fs.readFileSync(f,'utf8')),loops=summary.pruning?.linkUiLoops;
    if(loops?.examples){loops.exampleCount=loops.examples.length;delete loops.examples;fs.writeFileSync(f,JSON.stringify(summary,null,2)+'\n');}
    const baseline=legacyV1[summary.id];
    summary.lineage=baseline?'legacy-v1-resumed-with-v2':'fresh-v2-root';
    summary.legacyV1=baseline?{visited:baseline[0],terminals:baseline[1],frontier:baseline[2]}:null;
    summary.v2Work={visited:summary.visited-(baseline?.[0]||0),terminals:summary.terminals-(baseline?.[1]||0)};
    return summary;
  });
  artifact.search={summaries:allSummaries,scope:'Root plus directed initial-branch prefixes; overlapping prefixes may be re-visited. Visited is work, not unique strategic patterns.',
    visited:allSummaries.reduce((n,s)=>n+s.visited,0),terminals:allSummaries.reduce((n,s)=>n+s.terminals,0),frontier:allSummaries.reduce((n,s)=>n+s.frontier,0),complete:false};
  artifact.search.accounting={legacyV1:{visited:11041,terminals:2206,frontier:4179},
    resumedV2:{visited:allSummaries.filter(s=>s.legacyV1).reduce((n,s)=>n+s.v2Work.visited,0),terminals:allSummaries.filter(s=>s.legacyV1).reduce((n,s)=>n+s.v2Work.terminals,0)},
    freshV2Root:allSummaries.filter(s=>!s.legacyV1).map(({id,visited,terminals,frontier})=>({id,visited,terminals,frontier})),
    note:'Legacy counts include deep no-op input histories. Fresh-v2-root counters never inherit v1 frames or terminal histories. These buckets overlap in game states and are not unique pattern counts.'};
  artifact.search.closedSubtrees=allSummaries.filter(s=>s.complete).map(s=>{
    const checkpoint=JSON.parse(fs.readFileSync(path.join(ROOT,s.checkpoint),'utf8')),displayBoards=new Map();
    for(const r of checkpoint.terminals) {
      const own=r.final.players[0],key=hash({own,lp:r.final.lp[0]});
      if(!displayBoards.has(key))displayBoards.set(key,{displayHash:key,monsters:own.monsters.map(c=>c?{code:c.code,position:c.position,sequence:c.sequence}:null),
        hand:own.hand.map(c=>c.code),spells:own.spells,lp:r.final.lp[0],representativeHistoryHash:hash(r.steps.map(x=>x.input))});
    }
    return {id:s.id,prefixHash:hash(s.prefix),prefix:s.prefix,terminalHistories:s.terminals,displayBoards:[...displayBoards.values()],
      caveat:'Display grouping is reporting only. It is not used for search-state equivalence and does not prove effect-history equivalence.'};
  });
  publishArtifact();
  if(reportOnly)console.log(JSON.stringify({report:{visited:artifact.search.visited,terminals:artifact.search.terminals,frontier:artifact.search.frontier,
    closedShards:allSummaries.filter(s=>s.complete).length,drawFrontiers:artifact.drawFrontierSummary.length}}));
}
