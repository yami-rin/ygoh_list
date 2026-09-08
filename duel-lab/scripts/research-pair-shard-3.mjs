import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {startRoute,respond,select,selectCard,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const RUNTIME=path.join(ROOT,'runtime/multi-pairs/shard-3');
const OUTPUT=path.join(ROOT,'routes/pair-shard-3.json');
const args=process.argv.slice(2);
const value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const C={ug:68337209,soul:74652966,rabbit:69272449,dorm:32061192,cat:96676583,hare:20938824,tb:57111661,contract:37458564,binder:95454996,ip:65741786,accord:39138610,mtp:94722358,gwc:20726052,decoder:30342076,sp:29301450,bald:72656408,shifter:91800273};
const assigned=enumeratePairs(preset.main).map((pair,index)=>({...pair,index,names:pair.hand.map(code=>cards[code].name)})).filter(pair=>pair.index%8===3);
assert.equal(assigned.length,42);
fs.mkdirSync(RUNTIME,{recursive:true});
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const write=(file,value)=>{fs.writeFileSync(`${file}.tmp`,JSON.stringify(safe(value),null,2)+'\n');fs.renameSync(`${file}.tmp`,file);};
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const compact=g=>({type:g.prompt.type,choices:g.prompt.choices.map(choice=>({id:choice.id,label:choice.label,code:choice.card?.code,action:choice.response?.action})),cards:g.prompt.cards?.map(card=>({code:card.code,place:card.place}))});
const pairObservations={
 11:'儀式モンスターのCode Magician単独では通常召喚・L召喚の足場を作れず、TBを当日発動する場のMALICEもない。',
 19:'Code MagicianをL素材にするための場のLモンスターがなく、神の密告は自分から展開する初動にならない。',
 35:'Allureの解決で最初に未知の2ドローが発生するため、その先は今回の対象外。Allureを使わない範囲ではTBの当日発動条件を満たすMALICEがない。',
 43:'Allureの未知の2ドロー以降を除外。神の密告だけでは自分のモンスターを供給しない。',
 91:'Shifterの適用とAshの通常召喚は可能だが、この空盤面では追加のモンスターを供給できない。Ashに適合するL1は固定EXにない。',
 163:'Maxx CはEARTHで、墓地へ送ってもBaldrakeが要求するLIGHT/DARK対象を用意できない。相手の墓地も空。',
 219:'DrollはWINDで、Magnamhut用のLIGHT/DARK墓地対象を用意できない。相手の墓地も空。',
 227:'ImpulseはBaldrake用のLIGHT/DARK墓地対象や当日の追加モンスターを供給しない。',
 235:'ImpulseとMTPはいずれも罠。MTPをセットした当日に発動するための場のMALICEをこの2枚では作れない。',
 259:'Shifterの適用とOgreの通常召喚は可能だが、この空盤面では追加モンスターを供給できない。Ogreに適合するL1は固定EXにない。',
 291:'Shifter自身は適用前のコストとして墓地へ送られるため、BaldrakeのDARK対象を作れる。実証した2枚線を参照。',
 323:'相手の行動がない先攻空盤面で、Purulia/Drollは2体を並べる特殊召喚手段にならない。どちらにも適合するL1は固定EXにない。'
};

function run(g,commands){for(const [kind,...values]of commands){
 if(kind==='idle')select(g,c=>(c.response.action===values[0]||(g.prompt.type==='SELECT_CHAIN'&&values[0]===5))&&c.card?.code===values[1]);
 else if(kind==='chain')select(g,c=>c.card?.code===values[0]);
 else if(kind==='card')selectCard(g,values[0]);
 else if(kind==='yes'||kind==='no')select(g,c=>c.response.yes===(kind==='yes'));
 else if(kind==='material')select(g,c=>c.label.startsWith('選択：')&&c.card?.code===values[0]);
 else if(kind==='finish')select(g,c=>c.label==='選択を確定');
 else if(kind==='place')respond(g,{selection:[values.length?g.prompt.cards.findIndex(c=>c.place.sequence===values[0]&&c.place.player===0):0]});
 else if(kind==='position')select(g,c=>c.response.position===1);
 else if(kind==='auto')for(let i=0;i<100;i++){
  if(g.prompt.type==='SELECT_CHAIN')select(g,c=>c.label==='発動しない');
  else if(g.prompt.type==='SELECT_PLACE')respond(g,{selection:[0]});
  else if(g.prompt.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
  else break;
 }
 else throw Error(`Unknown command ${kind}`);
}}
const codes=(g,zone)=>board(g).players[0][zone].filter(Boolean).map(card=>card.code).sort((a,b)=>a-b);
const sorted=x=>[...x].sort((a,b)=>a-b);
const manualRoutes=[];
async function prove({id,hand,commands,expected,summary,roles,source}){
 const sortedHand=sorted(hand),pair=assigned.find(pair=>hash(pair.hand)===hash(sortedHand));
 assert(pair,'Manual route must belong to shard 3');
 const game=await startRoute(sortedHand);
 try{
  run(game,commands);
  assert.equal(game.prompt.type,'SELECT_IDLECMD');assert.equal(game.turn,1);assert.equal(game.phase,4);
  assert.equal(game.lp[0],expected.lp);
  for(const zone of ['monsters','spells','hand'])if(expected[zone])assert.deepEqual(codes(game,zone),sorted(expected[zone]),zone);
  assert(!game.log.some(event=>event.turn===1&&/\d+\s*枚ドロー/.test(event.text)),'No first-turn draw may be used');
  const route=finishRoute(game,{id,pairIndex:pair.index,pairId:pair.id,starter:sortedHand[0],requiredHand:sortedHand,classification:'two-card-line',requiresDraw:false,drawDependent:false,summary,roles,commands,expected,source,conditions:['記録した2枚を固定40枚から除いて初期手札とする','先攻、相手空盤面・初期手札なし','未確定ドロー後の展開は含まない'],limitations:['無妨害の到達例であり最適性・勝率・全手順木の証明ではない']});
  await replay(route);manualRoutes.push(route);
  console.log(`MANUAL PASS ${id}: ${route.steps.length} responses, LP ${expected.lp}`);
 }catch(error){console.error(JSON.stringify(compact(game)));throw error;}finally{game.close();}
}

async function auditAndDocument(report,runtimeDir,searchIdentity){
 const summary=report.search,exports=JSON.parse(fs.readFileSync(path.join(runtimeDir,'best-routes.json')));
 assert.deepEqual(summary.selectedPairIndices,assigned.map(pair=>pair.index));
 assert.equal(summary.totalPresetPairs,333);assert.equal(summary.assignedPairs,42);
 assert.equal(summary.summary.searched,42);assert.equal(summary.summary.unsearched,0);
 assert.equal(summary.generation,exports.generation,'Summary and exports must be one generation');
 for(const [key,value]of Object.entries(searchIdentity)){
  assert.equal(summary[key],value,`Summary ${key} drift`);assert.equal(exports[key],value,`Export ${key} drift`);
 }
 const baselineFile=path.join(ROOT,'routes/multi-opening-survey.json');
 const baseline=fs.existsSync(baselineFile)?JSON.parse(fs.readFileSync(baselineFile)):null;
 const rows=[],checkpointEvidence=[],reasons={};let generated=0,failures=0,rejected=0,terminals=0,visited=0,draws=0,unresolved=0,replayed=0;
 for(const pair of assigned){
  const entry=summary.pairs.find(candidate=>candidate.index===pair.index);assert(entry);
  const file=path.resolve(entry.checkpoint);assert.equal(path.dirname(file),path.resolve(runtimeDir));
  const bytes=fs.readFileSync(file),checkpoint=JSON.parse(bytes);const search=checkpoint.search;
  assert.equal(checkpoint.identity.sourceHash,summary.sourceHash);assert.equal(checkpoint.identity.presetHash,hash(preset));
  assert.equal(checkpoint.identity.pairHash,summary.pairHash);assert.equal(checkpoint.identity.pairIndex,pair.index);
  assert.equal(checkpoint.identity.pairId,pair.id);assert.deepEqual(checkpoint.identity.hand,pair.hand);
  assert.deepEqual(search.hand,pair.hand);assert.deepEqual(search.rootPrefix,[],'Every pair must be explored from its real root');
  assert.equal(search.visited,entry.visited);assert(search.visited>0);
  assert.equal(search.frontier.length,entry.unresolved);assert.equal(checkpoint.excludedDraw.length,entry.excludedDraw);
  assert.equal(search.terminals.length,entry.terminalPaths);
  assert.equal(entry.completeWithinNoDrawScope,search.complete&&search.frontier.length===0);
  const currentReasons={},depths=[];for(const frame of search.frontier){assert(Array.isArray(frame.prefix));depths.push(frame.prefix.length);currentReasons[frame.reason]=(currentReasons[frame.reason]||0)+1;reasons[frame.reason]=(reasons[frame.reason]||0)+1;}
  assert.deepEqual(currentReasons,entry.unresolvedByReason);
  for(const boundary of checkpoint.excludedDraw){assert.equal(boundary.reason,'excludedUnknownDraw');assert.equal(boundary.continuationExplored,false);}
  const route=exports.routes.find(route=>route.pairIndex===pair.index);
  if(checkpoint.bestPlayableMain1){
   assert(route);assert.equal(hash(route),hash(checkpoint.bestPlayableMain1));
   assert.deepEqual(route.hand,pair.hand);assert.equal(route.final.turn,1);assert.equal(route.final.phase,'MAIN 1');
   assert(!route.log.some(event=>/\d+\s*枚ドロー/.test(event.text??'')&&(event.turn==null||event.turn<=1)));
   await replay(route);replayed++;
  }else assert(!route);
  visited+=search.visited;generated+=search.generated;unresolved+=search.frontier.length;draws+=checkpoint.excludedDraw.length;terminals+=search.terminals.length;
  failures+=checkpoint.failureHistory.length;rejected+=search.rejected.length;
  checkpointEvidence.push({index:pair.index,path:path.relative(ROOT,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  const old=baseline?.pairs.find(old=>old.id===pair.id),manual=report.manualRoutes.filter(route=>route.pairIndex===pair.index);
  const endpoint=entry.bestPlayable?.classification??'no-action';
  const reason=entry.completeWithinNoDrawScope?(endpoint==='link-development'?'無ドロー範囲で探索終了。到達例はL展開。':`無ドロー範囲で探索終了。観測最良は${endpoint}。ドロー・妨害・別手札を含む不可能性は主張しない。`):`探索予算で停止：${Object.entries(entry.unresolvedByReason).map(([key,n])=>`${key} ${n}`).join(', ')}。さらなる展開の有無は未確定。`;
  rows.push({...pair,status:entry.status,visited:entry.visited,generated:search.generated,terminalPaths:entry.terminalPaths,unresolved:entry.unresolved,unresolvedByReason:entry.unresolvedByReason,frontierDepth:depths.length?{min:Math.min(...depths),max:Math.max(...depths)}:null,excludedDraw:entry.excludedDraw,endpoint,reason,cardTextObservation:pairObservations[pair.index]??null,baseline:{status:old?.status??'unavailable',route:old?.best?.id??null,unsupportedReason:old?.unsupportedReason??null},manualRouteIds:manual.map(route=>route.id),searchedRouteId:route?.id??null});
 }
 assert.equal(visited,summary.summary.visited);assert.equal(unresolved,summary.summary.unresolved);assert.equal(draws,summary.summary.excludedDraw);assert.equal(terminals,summary.summary.terminalPaths);
 assert.equal(replayed,exports.routes.length);
 const audit={verifiedAt:new Date().toISOString(),generation:summary.generation,searchIdentity,pairs:42,checkpointHashes:checkpointEvidence,independentSearchRouteReplays:replayed,manualRouteReplays:report.manualRoutes.length,visited,generated,terminalPaths:terminals,unresolved,unresolvedByReason:reasons,excludedUnknownDraw:draws,historicalFailures:failures,coreRejected:rejected,smallestFrontiers:rows.filter(row=>row.unresolved).sort((a,b)=>a.unresolved-b.unresolved).slice(0,10).map(({index,id,unresolved,unresolvedByReason,frontierDepth})=>({index,id,unresolved,unresolvedByReason,frontierDepth})),allGamePatternsComplete:false};
 write(path.join(RUNTIME,'audit.json'),audit);report.audit={...audit,checkpointHashes:undefined};report.pairs=rows;
 if(baseline)report.baseline={path:'routes/multi-opening-survey.json',sha256:digest(baselineFile),scope:'既知templateの照合結果のみ。今回の実core探索とは別の過去集計。'};
 write(OUTPUT,report);
 const name=code=>cards[code]?.name??String(code);
 const lines=['# 2枚初動 shard 3 実探索','',`固定40枚の合法333組中、index % 8 = 3 の42組を、テンプレート適用ではなく各2枚の初期状態から実coreで調査した。全42組が探索済み。無ドロー範囲で残枝なし ${summary.summary.completeWithinNoDrawScope}組、残枝あり ${summary.summary.incomplete}組。`,'',
  `累計 ${visited} node、${generated}候補生成、${terminals}ターン終了履歴。未探索 ${unresolved} prefix（${Object.entries(reasons).map(([key,n])=>`${key}: ${n}`).join('、')||'なし'}）。未確定ドロー ${draws} prefixは引継ぎ境界として保存し、ドロー結果を評価・再生していない。adapter例外履歴 ${failures}件、core拒否 ${rejected}件。`,'',
  '入力手札は固定デッキから実際に2枚取り除いたもの。先攻、相手初期手札なし・空盤面。探索中のMain 1盤面を手動のopeningScoreで比較する。点数は勝率・貫通率・最適性の証明ではない。停止点の並べ替えと検証済みのL素材UI往復縮約を使うが、別のゲーム状態を統合していない。','',
  '## 新たに実証した2枚展開','',
  '| 初期手札 | 到達盤面 | LP | 応答 |','| --- | --- | ---: | ---: |'];
 for(const route of report.manualRoutes)lines.push(`| ${route.hand.map(name).join(' + ')} | ${route.expected.monsters.map(name).join(' + ')}${route.expected.spells.length?' + セット '+route.expected.spells.map(name).join(' / '):''}${route.expected.hand.length?'、手札 '+route.expected.hand.map(name).join(' / '):''} | ${route.expected.lp} | ${route.steps.length} |`);
 for(const route of report.manualRoutes)lines.push('',`- ${route.id}: ${route.summary} ${route.roles.join('。')}。`);
 lines.push('','各線は初期2枚の役割を記録し、実coreで生成した全入力の事前状態hash、選択ラベル、最終盤面hashを別ゲームで再生して照合した。Baldrakeの線は単体特殊召喚の成立例であり、強い最終盤面との評価ではない。','',
  '## 全42組と残件','',
  '| index | 初期手札 | 旧template | 今回の到達種別 / 新規線 | node | 未探索 | 深度 | ドロー除外 | 状態 |','| ---: | --- | --- | --- | ---: | ---: | --- | ---: | --- |');
 for(const row of rows)lines.push(`| ${row.index} | ${row.names.join(' + ')} | ${row.baseline.route??'未対応'} | ${row.endpoint}${row.manualRouteIds.length?' / '+row.manualRouteIds.join(', '):''} | ${row.visited} | ${row.unresolved} | ${row.frontierDepth?row.frontierDepth.min+'–'+row.frontierDepth.max:'—'} | ${row.excludedDraw} | ${row.status} |`);
 lines.push('','## 展開が限られる組の条件','', '以下は固定EX・先攻空盤面・2枚手札に限った、カードテキストと実core結果に基づく説明。残枝がある組の探索完了を意味しない。','');
 for(const row of rows.filter(row=>row.cardTextObservation))lines.push(`- ${row.index} ${row.names.join(' + ')}: ${row.cardTextObservation}`);
 lines.push('','## 再開と検証','',
  '~~~powershell','node scripts/research-pair-shard-3.mjs --nodes 100 --ms 3000 --depth 160 --passes 1','node scripts/research-pair-shard-3.mjs --audit-only','node scripts/research-pair-shard-3.mjs --manual-only','~~~','',
  `実探索checkpointは ${report.searchRuntime}、独立監査hashは runtime/multi-pairs/shard-3/audit.json。sourceHashは ${summary.sourceHash}、generationは ${summary.generation}。ソースが変わった場合は新しいruntimeディレクトリを指定し、旧checkpointを改変しない。`,'',
  `検証：42 checkpointのidentity・手札・root・境界・件数・SHA-256、検索代表${replayed}線と手動${report.manualRoutes.length}線の独立replayがPASS。`,'',
  '旧 runtime/multi-pairs/shard-3/search-v1 は共有ソース変更を検出して停止した初回試行の証拠。現行集計へ加算していない。全手順木・ドロー後・相手妨害・5枚初手の全探索完了は主張しない。');
 fs.writeFileSync(path.join(ROOT,'docs/pair-shard-3.md'),lines.join('\n')+'\n');
 console.log(`AUDIT PASS: ${rows.length} root checkpoints, ${replayed} search-route replays, ${report.manualRoutes.length} manual-route replays, ${unresolved} unresolved, ${draws} draw boundaries`);
}

const spellSource=path.join(ROOT,'routes/spell-starters.json');
const contractSource=JSON.parse(fs.readFileSync(spellSource)).routes.find(route=>route.id==='spell-68337209-dormouse-first-contract');
const contractIndex=contractSource.commands.findIndex(command=>command[0]==='idle'&&command[1]===1&&command[2]===C.contract);
assert(contractIndex>0);
await prove({id:'pair3-underground-soul-accord-binder-ip',hand:[C.ug,C.soul],summary:'UGをDormouse→Rabbit/TBで開始して通常召喚を温存。Contract/Wicked系展開からSoulと回収Rabbitを加え、Accord＋WHITE BINDER＋I:P＋未使用MTP。',roles:['UGはMALICEの特殊召喚とContractの魔法コストを担う','Soulは手札からの追加特殊召喚とAccordのL素材になる','MTPから下級を通常召喚する既存線とは初回罠と召喚権の使い方が異なる'],source:{path:'routes/spell-starters.json',id:contractSource.id,sha256:digest(spellSource)},commands:[['idle',5,C.ug],['yes'],['card',C.dorm],['yes'],['auto'],['idle',5,C.dorm],['auto'],['card',C.rabbit],['yes'],['auto'],['yes'],['card',C.tb],['auto'],['idle',5,C.tb],['card',C.rabbit],['auto'],['card',C.cat],['auto'],...contractSource.commands.slice(contractIndex),['idle',5,C.soul],['auto'],['idle',0,C.rabbit],['auto'],['idle',1,C.accord],['material',C.binder],['material',C.soul],['material',C.rabbit],['finish'],['auto'],['yes'],['card',C.binder],['auto']],expected:{lp:6800,monsters:[C.accord,C.binder,C.ip],spells:[C.mtp],hand:[]}});

await prove({id:'pair3-shifter-baldrake-special',hand:[C.bald,C.shifter],summary:'Shifterを手札から墓地へ送って効果を適用し、その墓地のShifterをBaldrakeで除外して特殊召喚。',roles:['Shifterは自身の墓地コストによってDARKの対象を用意する','BaldrakeはそのShifterを除外し、2枚とも初期手札から離れる'],commands:[['idle',5,C.shifter],['auto'],['idle',5,C.bald],['card',C.shifter],['auto']],expected:{lp:8000,monsters:[C.bald],spells:[],hand:[]}});

await prove({id:'pair3-hare-soul-sp-recover-hare',hand:[C.hare,C.soul],summary:'HareをDecoderへ変換してSoulを手札から特殊召喚。2体でS:Pを出し、墓地のHareを除外して自己回収。',roles:['Hareの通常召喚からLinkを用意する','Soulは追加のL素材になり、Hare単独のL1停止をS:Pへ伸ばす'],commands:[['idle',0,C.hare],['auto'],['idle',1,C.decoder],['material',C.hare],['auto'],['idle',5,C.soul],['auto'],['idle',1,C.sp],['material',C.decoder],['material',C.soul],['auto'],['yes'],['card',C.hare],['auto'],['yes'],['card',C.hare],['auto']],expected:{lp:7700,monsters:[C.sp],spells:[],hand:[C.hare]}});

await prove({id:'pair3-cat-mtp-accord-binder-gwc',hand:[C.mtp,C.cat],summary:'Cat＋MTPでDormouseを手札に加えて除外し、任意ドローを辞退。Dormouse/Rabbit/TBとDecoderを経てAccord＋WHITE BINDER＋GWCへ到達。',roles:['Catは通常召喚と手札Dormouseの除外を担う','MTPはCatの帰還を起動しながらDormouseをサーチする','CatとWHITE BINDERの任意ドローを両方辞退する'],commands:[
 ['idle',0,C.cat],['auto'],['idle',4,C.mtp],['auto'],['idle',5,C.mtp],['card',C.cat],['auto'],['card',C.dorm],['auto'],['yes'],['auto'],
 ['idle',5,C.cat],['card',C.dorm],['auto'],['no'],['auto'],['yes'],['auto'],['idle',5,C.dorm],['auto'],['card',C.rabbit],['auto'],['yes'],['auto'],['yes'],['card',C.tb],['auto'],
 ['idle',1,C.decoder],['material',C.cat],['auto'],['idle',1,C.binder],['material',C.decoder],['material',C.dorm],['material',C.rabbit],['place'],['chain',C.decoder],['auto'],
 ['idle',5,C.binder],['auto'],['card',C.gwc],['auto'],['idle',5,C.tb],['card',C.binder],['auto'],['card',C.hare],['auto'],['yes'],['auto'],['no'],['auto'],['no'],['auto'],
 ['idle',1,C.accord],['material',C.binder],['material',C.decoder],['material',C.hare],['auto'],['yes'],['card',C.binder],['auto'],['no'],['auto']
 ],expected:{lp:6200,monsters:[C.accord,C.binder],spells:[C.gwc],hand:[]}});

const old=fs.existsSync(OUTPUT)?JSON.parse(fs.readFileSync(OUTPUT)):{};
const report={schema:'astra-pair-shard-3-v1',shard:3,shards:8,presetHash:hash(preset),assignment:assigned,scope:'全333合法2枚multisetのindex%8===3。各pairの初期状態から実coreの候補を探索する。未確定ドロー後・相手妨害・5枚手札は対象外。',manualRoutes,routes:[...manualRoutes],searchRoutes:old.searchRoutes||null,search:old.search||null,searchRuntime:old.searchRuntime||null,allGamePatternsComplete:false,updatedAt:new Date().toISOString()};
write(OUTPUT,report);
if(!args.includes('--manual-only')){
 const {runShard,searchIdentity}=await import('./search-multi-pairs.mjs');
 const runtimeDir=args.includes('--run')?path.join(RUNTIME,value('--run')):path.join(ROOT,'runtime/multi-pair-search/shard-3');
 const searchReport=args.includes('--audit-only')?JSON.parse(fs.readFileSync(path.join(runtimeDir,'summary.json'))):await runShard({shard:3,shards:8,runtimeDir,maxNodesPerPair:Number(value('--nodes',100)),maxMsPerPair:Number(value('--ms',3000)),maxDepth:Number(value('--depth',160)),passes:Number(value('--passes',1)),resume:true,onPair:pair=>console.log(`PAIR ${pair.index} ${pair.id} visited=${pair.visited} frontier=${pair.unresolved} draws=${pair.excludedDraw} ${pair.status}`)});
 report.search=searchReport;
 const searchedRoutes=JSON.parse(fs.readFileSync(path.join(runtimeDir,'best-routes.json'))).routes;
 report.routes=[...manualRoutes];
 report.searchRoutes={path:path.relative(ROOT,path.join(runtimeDir,'best-routes.json')).replaceAll('\\','/'),sha256:digest(path.join(runtimeDir,'best-routes.json')),ids:searchedRoutes.map(route=>route.id),generation:searchReport.generation,note:'自動探索route本体はrootがroutes/multi-search-best.jsonへ統合する。このファイルのroutes配列へ重複収録しない。'};
 report.searchRuntime=path.relative(ROOT,runtimeDir).replaceAll('\\','/');
 report.updatedAt=new Date().toISOString();
 write(OUTPUT,report);
 console.log('SHARD SUMMARY '+JSON.stringify(searchReport.summary));
 await auditAndDocument(report,runtimeDir,searchIdentity);
}
