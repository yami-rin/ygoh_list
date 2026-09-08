import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {cards} from '../cards.mjs';
import {openingScore} from '../opening-policy.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const RUNTIME=path.join(ROOT,'runtime/multi-pairs/shard-5');
const SEARCH_RUNTIME=path.join(ROOT,'runtime/multi-pair-search/shard-5');
const ALL_PAIRS=enumeratePairs(preset.main);
const INVENTORY=ALL_PAIRS.map((pair,index)=>({...pair,index,names:pair.hand.map(code=>cards[code].name)})).filter(pair=>pair.index%8===5);
const C={cat:96676583,magnamhut:33854624,decoder:30342076,binder:95454996,tb:57111661,dorm:32061192,sp:29301450,rabbit:69272449,mtp:94722358,crypter:21848500,hare:20938824,mag:64865,wicked:52698008,dot:18789533,backup:30118811,gwc:20726052,ip:65741786};
const trace=process.argv.includes('--trace');
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(safe(value),null,2)+'\n');}
function compact(g){return {type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards,choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response}))};}
function reply(g,input){if(trace)console.log(JSON.stringify({prompt:compact(g),input}));respond(g,input);}
function yes(g,value){const c=g.prompt.choices.find(c=>c.response.yes===value);assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});}
function settle(g,{picks=[],materials=[],places=[],decline=[],optionalBanish=true,yesnos=[]}={}){
  picks=picks.map(p=>Array.isArray(p)?[...p]:[p]);materials=[...materials];places=[...places];yesnos=[...yesnos];
  for(let n=0;n<150;n++){
    const p=g.prompt;
    if(p.type==='SELECT_IDLECMD'){assert.equal(picks.length,0,'Unused picks');assert.equal(materials.length,0,'Unused materials');return;}
    if(p.type==='SELECT_CHAIN'){
      const triggers=[C.cat,C.decoder,C.binder,C.dorm,C.sp,C.rabbit,C.mag,C.wicked,C.dot,C.backup];
      const c=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.magnamhut&&c.card.location===4)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
      assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});
    }else if(p.type==='SELECT_EFFECTYN')yes(g,!decline.includes(g.pending.code));
    else if(p.type==='SELECT_YESNO')yes(g,yesnos.length?yesnos.shift():!/ドロー/.test(p.title)&&(!/除外/.test(p.title)||optionalBanish));
    else if(p.type==='SELECT_PLACE'){
      const seq=places.shift();const i=seq===undefined?0:p.cards.findIndex(c=>c.place.sequence===seq&&c.place.player===0);assert(i>=0,JSON.stringify(compact(g)));reply(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION')reply(g,{action:(p.choices.find(c=>c.response.position===1)||p.choices[0]).id});
    else if(p.type==='SELECT_CARD'){
      let want=picks.shift();if(!want&&p.cards.length===p.min&&p.min===p.max)want=p.cards.map(c=>c.code);assert(want,`Need pick: ${JSON.stringify(compact(g))}`);
      const selection=[];for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}reply(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD'){
      const code=materials.shift();const c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));assert(c,`Need material ${code}: ${JSON.stringify(compact(g))}`);reply(g,{action:c.id});
    }else assert.fail(`Unhandled ${JSON.stringify(compact(g))}`);
  }assert.fail('Prompt loop exceeded');
}
async function magicianHare(){
  const hand=[C.mag,C.hare],g=await startRoute(hand);
  try{
    action(g,0,C.hare);
    action(g,1,C.decoder,{materials:[C.hare],places:[5]});
    action(g,1,C.wicked,{materials:[C.decoder,C.mag],picks:[C.dot,C.hare,C.backup,C.hare],places:[5,1]});
    action(g,5,C.backup,{picks:[C.rabbit,C.rabbit],places:[0]});
    action(g,5,C.hare,{picks:[C.rabbit,C.tb],places:[2,3]});
    action(g,1,C.binder,{materials:[C.wicked,C.hare],picks:[[C.hare]],places:[5]});
    action(g,5,C.binder,{picks:[C.mtp]});
    action(g,5,C.tb,{picks:[C.rabbit,C.dorm],places:[2]});
    action(g,5,C.mtp,{picks:[C.dorm,C.cat,C.binder],places:[2,4]});
    action(g,5,C.dorm,{picks:[C.cat],places:[3]});
    action(g,1,C.crypter,{materials:[C.backup,C.dorm,C.cat],places:[5]});
    const final=board(g);assert.equal(final.turn,1);assert.equal(final.phase,'MAIN 1');
    assert.deepEqual(final.players[0].monsters.filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[C.binder,C.crypter,C.dot].sort((a,b)=>a-b));
    assert(!g.log.some(e=>e.text.includes('枚ドロー')));
    const route=finishRoute(g,{id:'pair-shard-5-magician-hare-binder-crypter',name:'コード・マジシャン＋Hare→Binder＋Crypter＋Dot',pairIndex:5,requiredHand:hand,starter:hand[0],endpoint:'firstTurnMain1',source:'multi-pair-manual-core-research',drawDependent:false,requiresDraw:false,score:openingScore(g),
      discovery:'new_manual_core_line',scoreMeaning:'観測盤面の手動重み。勝率・最適性ではない。',
      summary:'HareをDecoderにし、手札Magを素材にWicked。MagでDotを落としてWicked起動、Hareを除外して自身回収、Backup検索。BackupでRabbitを検索して捨て、HareでRabbitを除外してTB。Binder→MTP、TB→DormouseをMTPのコストで除外帰還。MTPでBinderも除外帰還してメインゾーンへ移し、DormouseでCatを除外帰還してCrypter。手札に検索したCatを保持。',
      usage:{kind:'both_initial_cards_used_in_combo',evidence:['Hareを通常召喚しDecoder素材へ','手札MagをWicked素材として使用しDotを墓地へ','HareをWickedの除外コストに使用し自身回収後、Rabbit除外の展開効果を使用'],caveat:'全ての代替線に対する必要性・最適性は未証明。'},
      conditions:['固定preset、初手は指定2枚のみ','先攻・相手盤面と妨害なし','未知ドローなし','Magのサイバース族特殊召喚制約内で実行']});
    await replay(route);return route;
  }catch(error){write(path.join(RUNTIME,'manual-magician-failure.json'),{message:error.message,prompt:compact(g),route:finishRoute(g)});throw error;}finally{g.close();}
}
async function hareTb(){
  const hand=[C.hare,C.tb],g=await startRoute(hand);
  try{
    action(g,0,C.hare);
    action(g,4,C.tb);
    action(g,5,C.tb,{picks:[C.hare,C.dorm,C.hare]});
    action(g,5,C.hare,{picks:[C.tb]});
    action(g,1,C.decoder,{materials:[C.dorm],places:[5]});
    action(g,1,C.sp,{materials:[C.decoder,C.hare],picks:[C.dorm],places:[5,0]});
    action(g,5,C.dorm,{picks:[C.rabbit,C.mtp]});
    action(g,1,C.binder,{materials:[C.sp,C.dorm],picks:[[C.hare]],places:[5]});
    action(g,5,C.binder,{picks:[C.gwc]});
    action(g,5,C.gwc,{picks:[C.binder,C.dorm],places:[0,2]});
    action(g,1,C.ip,{materials:[C.rabbit,C.dorm],places:[5]});
    const final=board(g);assert.equal(final.turn,1);assert.equal(final.phase,'MAIN 1');
    assert.deepEqual(final.players[0].monsters.filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[C.binder,C.ip].sort((a,b)=>a-b));
    assert(final.players[0].spells.some(c=>c?.code===C.mtp));assert(!g.log.some(e=>e.text.includes('枚ドロー')));
    const route=finishRoute(g,{id:'pair-shard-5-hare-tb-binder-ip',name:'Hare＋TB→Binder＋I:P＋MTP',pairIndex:141,requiredHand:hand,starter:hand[0],endpoint:'firstTurnMain1',source:'multi-pair-manual-core-research',drawDependent:false,requiresDraw:false,score:openingScore(g),
      discovery:'new_manual_core_line',scoreMeaning:'観測盤面の手動重み。勝率・最適性ではない。',summary:'Hare通常召喚→TBでHare除外、Dormouse特殊召喚、Hareが自身を手札回収。Hareで墓地TB除外して特殊召喚。DormouseをDecoderにし、Decoder/HareでS:P→Dormouse除外帰還→Rabbit/MTP。Binder→GWCでBinder除外帰還とDormouse蘇生を経てI:P。',
      usage:{kind:'both_initial_cards_used_in_combo',evidence:['Hareを通常召喚しTBの当ターン発動コストで除外','初手TBをセット・発動してDormouseをデッキから特殊召喚','回収Hareの特殊召喚コストにも墓地TBを使用'],caveat:'全代替線に対する必要性・最適性は未証明。'},conditions:['固定preset、初手は指定2枚のみ','先攻・相手盤面と妨害なし','未知ドローなし','I:Pの相手ターンリンク召喚はこの停止点の後で未収録']});
    await replay(route);return route;
  }catch(error){write(path.join(RUNTIME,'manual-hare-tb-failure.json'),{message:error.message,prompt:compact(g),route:finishRoute(g)});throw error;}finally{g.close();}
}
function action(g,kind,code,options){select(g,c=>c.response.action===kind&&c.card?.code===code);settle(g,options);}
async function catMagnamhut(){
  const hand=[C.magnamhut,C.cat],g=await startRoute(hand);
  try{
    action(g,0,C.cat);
    action(g,1,C.decoder,{materials:[C.cat],places:[5]});
    action(g,5,C.magnamhut,{picks:[C.cat],places:[0,1]});
    action(g,1,C.binder,{materials:[C.decoder,C.magnamhut,C.cat],places:[5,0],decline:[C.binder]});
    action(g,5,C.binder,{picks:[C.tb]});
    action(g,5,C.tb,{picks:[C.binder,C.dorm,[C.tb]],places:[1,2]});
    action(g,1,C.sp,{materials:[C.decoder,C.dorm],picks:[C.dorm],places:[5,0]});
    action(g,5,C.dorm,{picks:[C.rabbit,C.mtp]});
    action(g,1,C.crypter,{materials:[C.sp,C.dorm,C.rabbit],places:[5]});
    const final=board(g);assert.equal(final.turn,1);assert.equal(final.phase,'MAIN 1');
    assert.deepEqual(final.players[0].monsters.filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[C.binder,C.crypter].sort((a,b)=>a-b));
    assert(final.players[0].spells.some(c=>c?.code===C.mtp));
    assert(!g.log.some(e=>e.text.includes('枚ドロー')),'Draw outside this task');
    const route=finishRoute(g,{id:'pair-shard-5-cat-magnamhut-binder-crypter',name:'Cat＋マグナムート→Binder＋Crypter＋MTP',requiresDraw:false,requiredHand:hand,starter:hand[0],endpoint:'firstTurnMain1',source:'multi-pair-manual-core-research',drawDependent:false,score:openingScore(g),scoreMeaning:'観測盤面の手動重み。勝率・最適性ではない。',
      pairIndex:221,discovery:'new_manual_core_line',summary:'CatをDecoderに変え、マグナムートで墓地Catを除外して帰還。3体でBinder、Decoder帰還。TB→Dormouse、S:PでDormouseを除外帰還、Rabbit→MTPを経てCrypter。',
      usage:{kind:'both_initial_cards_used_in_combo',evidence:['Catを通常召喚してDecoder素材に使用','マグナムートが手札から自身の効果で特殊召喚しCatを除外','マグナムートと帰還CatをBinder素材に使用'],caveat:'2枚の必要性を全ての代替線に対して証明したものではない。'},
      conditions:['固定40枚preset','先攻Main 1、相手盤面・妨害なし','初手は指定2枚のみ','未知ドローなし','マグナムートのエンドフェイズサーチ処理は停止点の後で未収録']});
    await replay(route);return route;
  }catch(error){write(path.join(RUNTIME,'manual-failure.json'),{message:error.message,prompt:compact(g),route:finishRoute(g)});throw error;}finally{g.close();}
}

const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const counts=values=>values.reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{});
function compactCandidate(candidate){
  if(!candidate)return null;
  const {final,...metadata}=candidate,own=final.players[0];
  return {...metadata,endpoint:{turn:final.turn,phase:final.phase,lp:final.lp,
    hand:own.hand.map(c=>c.code),monsters:own.monsters.filter(Boolean),spells:own.spells.filter(Boolean),
    grave:own.grave.map(c=>c.code),banished:own.banished.map(c=>c.code)}};
}
async function inspectUsage(route){
  const g=await startRoute(route.hand,{seed:route.seed,deckOrder:route.deckOrder});
  const initial=counts(route.hand),minimum={...initial};
  try{
    for(const step of route.steps){
      assert.equal(g.prompt.type,step.prompt);assert.equal(hash({pending:g.pending,board:board(g)}),step.before);
      respond(g,step.input);
      const observed=counts(board(g).players[0].hand.map(c=>c.code));
      for(const code of Object.keys(initial))minimum[code]=Math.min(minimum[code],observed[code]||0);
    }
    assert.equal(hash(board(g)),route.finalHash);
    const evidence=Object.entries(initial).map(([code,count])=>({code:Number(code),initial:count,minimumInHand:minimum[code],knownOriginalCopiesLeft:count-minimum[code]}));
    const left=evidence.reduce((n,e)=>n+e.knownOriginalCopiesLeft,0);
    const own=route.final.players[0],monsters=own.monsters.filter(Boolean),links=monsters.filter(c=>cards[c.code].type&0x4000000);
    const development=links.some(c=>cards[c.code].level>=2)?'link_2_or_higher':links.length?'link_1_only':monsters.length>1?'multiple_monsters':monsters.length?'single_monster':own.spells.some(Boolean)?'spell_or_set_only':'no_board';
    return {kind:route.usage?.kind??(left===2?'both_initial_cards_left_hand':left===1?'one_initial_card_left_hand':'initial_hand_retained'),development,evidence,
      caveat:'手札から出た枚数の下限。手札コスト・セットも含むため、それだけで2枚専用コンボや優位性の証明としない。同名個体は識別しない。'};
  }finally{g.close();}
}
async function aggregate({verifyOnly=false}={}){
  const summaryFile=path.join(SEARCH_RUNTIME,'summary.json'),bestFile=path.join(SEARCH_RUNTIME,'best-routes.json'),manualFile=path.join(RUNTIME,'manual-routes.json');
  const source=JSON.parse(fs.readFileSync(summaryFile,'utf8')),best=JSON.parse(fs.readFileSync(bestFile,'utf8'));
  assert.equal(source.shard,5);assert.equal(source.shards,8);assert.equal(source.presetHash,hash(preset));assert.equal(best.presetHash,hash(preset));
  for(const field of ['generation','sourceHash','pairHash','assetsHash'])assert.equal(best[field],source[field],`Summary and routes ${field} mismatch; wait for the runner to finish`);
  assert.deepEqual(source.pairs.map(p=>p.index),INVENTORY.map(p=>p.index),'Every assigned root must be represented exactly once');
  const manual=fs.existsSync(manualFile)?JSON.parse(fs.readFileSync(manualFile,'utf8')):{presetHash:hash(preset),routes:[]};assert.equal(manual.presetHash,hash(preset));
  const routes=[...best.routes,...manual.routes];assert.equal(new Set(routes.map(r=>r.id)).size,routes.length);
  const manualIds=new Set(manual.routes.map(r=>r.id));
  const audited=[];
  for(const route of routes){
    assert(INVENTORY.some(p=>p.index===route.pairIndex&&hash(p.hand)===hash(route.hand)),'Route outside assigned pair');
    assert(!route.log.some(e=>/\d+\s*枚ドロー/.test(e.text)&&(e.turn==null||e.turn<=1)),'First-turn draws excluded');
    await replay(route);audited.push({...route,handUsage:await inspectUsage(route)});
  }
  const roots=[];
  for(const pair of source.pairs){
    const checkpoint=JSON.parse(fs.readFileSync(pair.checkpoint,'utf8'));
    assert.equal(checkpoint.identity.presetHash,hash(preset));assert.equal(checkpoint.identity.sourceHash,source.sourceHash);
    assert.equal(checkpoint.search.frontier.length,pair.unresolved);assert.equal(checkpoint.search.visited,pair.visited);
    assert.equal(checkpoint.search.terminals.length,pair.terminalPaths);assert.equal(checkpoint.excludedDraw.length,pair.excludedDraw);
    const candidates=audited.filter(r=>r.pairIndex===pair.index);
    const bestCandidate=[...candidates].sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||a.steps.length-b.steps.length)[0];
    roots.push({...pair,best:compactCandidate(pair.best),bestPlayable:compactCandidate(pair.bestPlayable),checkpoint:path.relative(ROOT,pair.checkpoint).replaceAll('\\','/'),checkpointSha256:digest(pair.checkpoint),
      candidateRouteIds:candidates.map(r=>r.id),selectedRoute:bestCandidate?.id??null,
      selectedDevelopment:bestCandidate?.handUsage.development??null,selectedHandUse:bestCandidate?.handUsage.kind??null,
      remainingReason:pair.unresolved?`未解決の応答prefixが${pair.unresolved}件残る。有限予算の探索であり不成立・最適性は未証明。`:pair.excludedDraw?`無ドロー範囲は終了。未知ドロー境界${pair.excludedDraw}件は対象外。`:'無ドロー範囲の応答木は終了。相手の妨害と実5枚手札は未検証。',
      unsupportedReason:candidates.length?null:'訪問済み範囲で、応答を含むMain 1の線を採録できていない。組合せの不成立証明ではない。'});
  }
  for(const field of ['visited','terminalPaths','unresolved','excludedDraw'])assert.equal(roots.reduce((n,p)=>n+p[field],0),source.summary[field],`Shard ${field} total mismatch`);
  const report={schema:'astra-pair-shard-research-v1',shard:5,shards:8,presetHash:hash(preset),sourceHash:source.sourceHash,
    inventory:{totalPairTypes:333,totalPhysicalCombinations:780,assignedPairTypes:41,assignedPhysicalWeight:96},
    scope:{...source.scope,method:'既知template適用を使わず、各2枚手札の根から実coreで新規探索。手動発見線も根から実coreで構築・再生。',patterns:'visitedは延べ訪問prefix、terminalPathsは応答履歴数。固有戦略数ではない。',twoCards:'手札2枚が出た事実と、2枚を組み合わせた展開の実証を別記。'},
    summary:{...source.summary,manualVerifiedLines:manual.routes.length,retainedRoutes:manual.routes.length,searchRouteReferences:best.routes.length,independentReplays:audited.length,
      assignedPhysicalWeight:96,historicalFailures:roots.reduce((n,p)=>n+p.historicalFailures,0),
      selectedDevelopment:counts(roots.map(p=>p.selectedDevelopment??'unrecorded')),selectedHandUse:counts(roots.map(p=>p.selectedHandUse??'unrecorded'))},
    sources:[summaryFile,bestFile,...(fs.existsSync(manualFile)?[manualFile]:[])].map(file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),sha256:digest(file)})),
    pairs:roots,routes:audited.filter(route=>manualIds.has(route.id)),
    searchRoutes:audited.filter(route=>!manualIds.has(route.id)).map(route=>({id:route.id,pairIndex:route.pairIndex,score:route.score,classification:route.classification,
      responseCount:route.steps.length,finalHash:route.finalHash,handUsage:route.handUsage,source:path.relative(ROOT,bestFile).replaceAll('\\','/')})),
    updatedAt:new Date().toISOString()};
  const target=path.join(ROOT,'routes/pair-shard-5.json');
  if(verifyOnly){const stored=JSON.parse(fs.readFileSync(target,'utf8'));delete stored.updatedAt;const expected={...report};delete expected.updatedAt;assert.deepEqual(stored,expected,'Regenerate shard summary from current checkpoints');}
  else{
    write(target,report);
    const lines=['# 2枚初動・担当5の実core探索','',`全333種類から index % 8 = 5 の **41組**（物理組合せ96通り）を担当。各手札の根から新規探索し、採録した${audited.length}線を独立再生した。既知templateを当てはめた調査とは別の資料。`,'',
      `着手 ${source.summary.searched}/41、無ドロー範囲終了 ${source.summary.completeWithinNoDrawScope}/41、延べ訪問 ${source.summary.visited}、未解決prefix ${source.summary.unresolved}、対象外の未知ドロー境界 ${source.summary.excludedDraw}、過去の探索エラー ${report.summary.historicalFailures}。全ゲームパターンの完了は false。`,'',
      '手動発見線: **Cat＋マグナムート→WHITE BINDER＋HEARTS OF CRYPTER＋MTPセット、LP6200**。CatをDecoder素材にし、マグナムートでCatを除外して帰還、両者をBinder素材に使用。TB/Dormouse→S:P→Rabbitを経由する。59入力を実coreで独立再生。マグナムートのエンドフェイズサーチは停止点の後に残る。',
      '', '**コード・マジシャン＋Hare→Binder＋Crypter＋Dot、手札Cat、LP5900** も80入力で独立再生。HareをDecoder素材、手札MagをWicked素材にし、Dot→WickedからHare回収とBackup検索。MTPでBinderを除外帰還してEXモンスターゾーンを空け、Crypterを出す。サイバース族の特殊召喚制約内で実行。',
      '', '**Hare＋TB→Binder＋I:P＋MTPセット、LP6200** を68入力で独立再生。初手TBのコストでHareを除外してDormouseを呼び、Hareは自身を回収。Hareで墓地TBを除外して再展開し、Decoder/S:P→Dormouse/Rabbit、Binder/GWCを経由する。I:Pの相手ターン展開は停止点の後に残る。',
      '', 'visitedと終端数は応答履歴の計数であり、固有展開・最適解の数ではない。カード配置と同名個体を含み、監査済みのLink素材選択画面の無操作往復のみ縮約する。scoreは盤面の手動重みで、勝率や貫通率ではない。',
      '', '「2枚が手札から出た」にはコストやセットも含む。手札残存数を追跡して記録し、2枚の組合せを用いた展開の実証と分ける。Link 1だけ・召喚だけ・セットだけも小展開として区別した。線の未採録を不成立証明とは扱わない。',
      '', '未知ドローが発生した最初の応答まで保存し、以後の応答は実行・評価しない。相手盤面・妨害なし、初手2枚だけの条件。実5枚手札、後攻、相手への対応、未知ドロー後、全木の最適性は対象外。',
      '', '| index | 2枚組 | 状態 | 訪問 | 残prefix | draw境界 | 採録線 |', '|---:|---|---|---:|---:|---:|---|',
      ...roots.map(p=>`| ${p.index} | ${p.names.join('＋')} | ${p.status} | ${p.visited} | ${p.unresolved} | ${p.excludedDraw} | ${p.selectedDevelopment??'未採録'} / ${p.selectedHandUse??'未確認'} |`),
      '', '再開と検証:', '', '```powershell', 'node scripts/research-pair-shard-5.mjs --search --nodes 200 --ms 3000 --depth 160 --passes 1', 'node scripts/research-pair-shard-5.mjs --finish-small', 'node scripts/research-pair-shard-5.mjs --aggregate', 'node scripts/research-pair-shard-5.mjs --verify', '```', '', '`--finish-small` は未解決prefix40件以下の組だけ各5000node/10秒を配分し、全41組の集約を更新する。', '', '根探索checkpointは `runtime/multi-pair-search/shard-5/`、手動線とinventoryは `runtime/multi-pairs/shard-5/`。集約JSONには各checkpointのSHA-256と残件理由、採録route全入力を保持する。',''];
    fs.mkdirSync(path.join(ROOT,'docs'),{recursive:true});fs.writeFileSync(path.join(ROOT,'docs/pair-shard-5.md'),lines.join('\n'));
  }
  console.log(JSON.stringify({verifyOnly,...report.summary}));return report;
}

async function main(){
  assert.equal(preset.main.length,40);assert.equal(ALL_PAIRS.length,333);assert.equal(ALL_PAIRS.reduce((n,p)=>n+p.physicalWeight,0),780);
  assert.equal(INVENTORY.length,41);assert.equal(INVENTORY.reduce((n,p)=>n+p.physicalWeight,0),96);
  write(path.join(RUNTIME,'inventory.json'),{presetHash:hash(preset),shard:5,shards:8,totalPairTypes:333,totalPhysicalCombinations:780,pairs:INVENTORY});
  if(process.argv.includes('--manual')){
    const routes=[await catMagnamhut(),await magicianHare(),await hareTb()];write(path.join(RUNTIME,'manual-routes.json'),{presetHash:hash(preset),routes});console.log(JSON.stringify({manualRoutes:routes.length,routes:routes.map(route=>({id:route.id,steps:route.steps.length,lp:route.final.lp,monsters:route.final.players[0].monsters.filter(Boolean).map(c=>c.code)})),replayed:true}));return;
  }
  if(process.argv.includes('--search')){
    const {runShard}=await import('./search-multi-pairs.mjs');
    const arg=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:Number(process.argv[i+1]);};
    const report=await runShard({shard:5,shards:8,runtimeDir:SEARCH_RUNTIME,maxNodesPerPair:arg('--nodes',100),maxMsPerPair:arg('--ms',3000),maxDepth:arg('--depth',100),passes:arg('--passes',1),
      onPair:p=>console.log(JSON.stringify({pair:p.index,pass:p.pass,status:p.status,visited:p.visited,unresolved:p.unresolved,excludedDraw:p.excludedDraw}))});
    console.log(JSON.stringify(report.summary));await aggregate();return;
  }
  if(process.argv.includes('--finish-small')){
    const {runPair,runShard}=await import('./search-multi-pairs.mjs');
    const current=JSON.parse(fs.readFileSync(path.join(SEARCH_RUNTIME,'summary.json'),'utf8'));
    const selected=current.pairs.filter(pair=>pair.status==='incomplete'&&pair.unresolved<=40&&pair.historicalFailures===0);
    const lockPath=path.join(SEARCH_RUNTIME,'.search.lock'),lock=fs.openSync(lockPath,'wx');
    fs.writeFileSync(lock,JSON.stringify({pid:process.pid,shard:5,scope:'finish-small',startedAt:new Date().toISOString()}));
    try{for(const pair of selected){const result=await runPair({pairIndex:pair.index,maxNodes:5000,maxMs:10000,maxDepth:160,runtimeDir:SEARCH_RUNTIME});console.log(JSON.stringify({focused:pair.index,status:result.summary.status,visited:result.summary.visited,unresolved:result.summary.unresolved,excludedDraw:result.summary.excludedDraw}));}}
    finally{fs.closeSync(lock);fs.unlinkSync(lockPath);}
    await runShard({shard:5,shards:8,runtimeDir:SEARCH_RUNTIME,maxNodesPerPair:0,maxMsPerPair:0,maxDepth:160});
    await aggregate();return;
  }
  if(process.argv.includes('--aggregate')||process.argv.includes('--verify')){await aggregate({verifyOnly:process.argv.includes('--verify')});return;}
  console.log(JSON.stringify({inventory:INVENTORY.length,physicalWeight:96,runtime:RUNTIME}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
