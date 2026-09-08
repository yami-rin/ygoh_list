import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'routes/pair-shard-6.json'),RUN=path.join(ROOT,'runtime/multi-pairs/shard-6');
const SEARCH=path.join(ROOT,'runtime/multi-pair-search/shard-6');
fs.mkdirSync(RUN,{recursive:true});
const C={mag:64865,allure:1475311,wizard:3723262,ash:14558127,dot:18789533,gwc:20726052,hare:20938824,maxx:23434538,
  backup:30118811,dorm:32061192,magna:33854624,impulse:40366667,tb:57111661,ogre:59438930,ug:68337209,rabbit:69272449,
  baldrake:72656408,terra:73628505,soul:74652966,gold:75500286,disclosure:78114463,purulia:84192580,shifter:91800273,
  droll:94145021,mtp:94722358,cat:96676583,decoder:30342076,ring:24842059,almiraj:60303245,wicked:52698008,
  sp:29301450,ip:65741786,binder:95454996,crypter:21848500,transcode:46947713,accord:39138610};
const pairs=enumeratePairs(preset.main).map((p,index)=>({...p,index})).filter(p=>p.index%8===6);
assert.equal(pairs.length,41);
const pairIds=new Set(pairs.map(p=>p.id)),key=hand=>[...hand].sort((a,b)=>a-b).join('-');
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
const compact=g=>safe({type:g.prompt.type,title:g.prompt.title,pending:g.pending,
  choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response})),
  cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place}))});
const count=(codes,code)=>codes.filter(c=>c===code).length;
function recordHand(g) {
  const hand=g.snapshot(0).players[0].hand.filter(Boolean).map(c=>c.code);
  for(const e of g.pairUsage)e.minimumInHand=Math.min(e.minimumInHand,count(hand,e.code));
}
async function startPair(hand) {
  assert(pairIds.has(key(hand)),'Pair belongs to another shard');
  const g=await startRoute(hand);
  g.pairUsage=[...new Set(hand)].map(code=>({code,initial:count(hand,code),minimumInHand:count(hand,code)}));
  const original=g.respond.bind(g);g.respond=(...args)=>{const result=original(...args);recordHand(g);return result;};
  return g;
}
function settle(g,{picks=[],materials=[],places=[],decline=[]}={}) {
  picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];
  for(let n=0;n<140;n++) {
    const p=g.prompt;
    assert(!g.log.some(x=>x.text.includes('枚ドロー')),'Undetermined draws may not be consumed');
    if(p.type==='SELECT_IDLECMD'){assert.equal(materials.length,0);assert.equal(picks.length,0);return;}
    if(process.argv.includes('--trace'))console.log(JSON.stringify(compact(g)));
    if(p.type==='SELECT_CHAIN') {
      const c=p.choices.find(c=>c.card&&([C.rabbit,C.cat,C.dorm,C.binder,C.decoder,C.wicked,C.backup,C.mag,C.dot,C.accord].includes(c.card.code)||c.card.code===C.hare&&c.card.location===32)&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
      assert(c,JSON.stringify(compact(g)));respond(g,{action:c.id});
    }else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO') {
      const d=BigInt(g.pending.description||0),code=Number(d>>20n),index=Number(d&0xfffffn);
      const draw=p.type==='SELECT_YESNO'&&(code===C.cat&&index===2||code===C.binder&&index===3);
      const yes=!draw&&!decline.includes(g.pending.code);
      select(g,c=>c.response.yes===yes);
    }else if(p.type==='SELECT_PLACE') {
      const seq=places.shift(),i=seq===undefined?0:p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===seq);
      assert(i>=0,JSON.stringify(compact(g)));respond(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION') {
      select(g,c=>c.response.position===1||p.choices.length===1);
    }else if(p.type==='SELECT_CARD') {
      let wanted=picks.shift();if(!wanted&&p.cards.length===p.min&&p.min===p.max)wanted=p.cards.map(c=>c.code);
      assert(wanted,`Select cards: ${JSON.stringify(compact(g))}`);
      const selection=[];for(const code of wanted){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,JSON.stringify(compact(g)));selection.push(i);}respond(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD') {
      const code=materials.shift(),c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
      assert(c,JSON.stringify({material:code,prompt:compact(g)}));respond(g,{action:c.id});
    }else assert.fail(JSON.stringify(compact(g)));
  }
  assert.fail('Too many directed responses');
}
function action(g,type,code,options={}) {
  if(process.argv.includes('--trace'))console.log('ACTION',type,cards[code].name);
  select(g,c=>c.response.action===type&&c.card?.code===code);settle(g,options);
}
const normal=(g,c,o)=>action(g,0,c,o),activate=(g,c,o)=>action(g,5,c,o),link=(g,c,materials,o={})=>action(g,1,c,{materials,...o});
const routes=[],initialProbes=[];
function verifyEnd(g,expected) {
  const b=board(g),own=b.players[0],opp=b.players[1];
  assert.equal(b.turn,1);assert.equal(b.phase,'MAIN 1');assert.deepEqual(b.lp,[expected.lp||8000,8000]);
  for(const z of ['monsters','hand','spells'])assert.deepEqual(own[z].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[...(expected[z]||[])].sort((a,b)=>a-b),z);
  for(const z of ['hand','monsters','spells','grave','banished'])assert.equal(opp[z].filter(Boolean).length,0);
  assert(!g.log.some(x=>x.text.includes('枚ドロー')));
  assert.equal(g.snapshot(0).players[0].deckCount+['hand','monsters','spells','grave','banished'].reduce((n,z)=>n+own[z].filter(c=>c&&!(cards[c.code].type&0x4000000)).length,0),40);
}
async function route(id,hand,summary,execute,expected,{classification='two-card-extension',conditions=[]}={}) {
  const g=await startPair(hand);
  try {
    settle(g);execute(g);verifyEnd(g,expected);
    const evidence=g.pairUsage.map(e=>({...e,originalCardsKnownToHaveLeftHand:e.initial-e.minimumInHand,
      finalInHand:count(board(g).players[0].hand.map(c=>c.code),e.code)}));
    const used=evidence.reduce((n,e)=>n+e.originalCardsKnownToHaveLeftHand,0);
    assert.equal(used,2,'These directed examples require evidence for both initial cards');
    const r=finishRoute(g,{id,starter:hand[0],pairId:key(hand),name:hand.map(c=>cards[c].name).join('＋'),summary,classification,
      requiresDraw:false,conditions:['固定presetからこの2枚だけを抜いて開始','先攻、相手手札/盤面なし','全名称ターン1/デュエル1回は未使用','任意ドロー辞退・未確定ドロー後は扱わない',...conditions],
      usage:{kind:'both_initial_cards_left_hand',evidence,provenOriginalCardsLeftHand:used,
        caveat:'手札最小枚数による下限。2枚使用は、2枚専用コンボの優位性や最適性の証明ではない。'},
      limitations:['全合法木・最善性・貫通率の証明ではない','相手ターンの妨害処理は別検証']});
    await replay(r);routes.push(r);console.log(JSON.stringify({route:id,result:'PASS',steps:r.steps.length,used,final:expected}));
  }finally{g.close();}
}
function genericAccord(g) {
  link(g,C.transcode,[C.wicked,C.dot],{places:[5]});activate(g,C.transcode,{picks:[C.wicked],places:[1]});
  link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,1]});
}

for(const starter of [C.maxx,C.droll])await route(`pair6-mag-${starter}-almiraj-accord`,[C.mag,starter],
  '低攻撃力の非サイバースを通常召喚→アルミラージ→手札MagとWicked→Dot→Mag除外でBackup→Transcode→Accord＋Transcode。非サイバースの通常召喚はMag/Transcodeの特殊召喚制約に抵触しない。',g=>{
    normal(g,starter);link(g,C.almiraj,[starter],{places:[5]});
    link(g,C.wicked,[C.almiraj,C.mag],{picks:[C.dot,C.mag,C.backup],places:[5,1]});
    activate(g,C.backup,{decline:[C.backup],places:[2]});genericAccord(g);
  },{monsters:[C.accord,C.transcode]});

await route('pair6-backup-wizard-crypter-binder',[C.wizard,C.backup],
  'BackupでCatを検索して捨てる→BackupをDecoder→初手WizardでCatを蘇生→3体でBinder＋Decoder帰還、Catを除外帰還→MTP/Hare→Crypter＋Binder。Magを経由しない2枚展開。',g=>{
    normal(g,C.backup,{picks:[C.cat,C.cat]});link(g,C.decoder,[C.backup],{places:[5]});
    activate(g,C.wizard,{picks:[C.cat]});
    link(g,C.binder,[C.decoder,C.wizard,C.cat],{picks:[C.cat],places:[5,0,1]});
    activate(g,C.binder,{picks:[C.mtp]});activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
    activate(g,C.hare,{picks:[C.mtp],places:[2]});link(g,C.crypter,[C.decoder,C.cat,C.hare],{places:[6]});
  },{monsters:[C.crypter,C.binder],lp:6800});

await route('pair6-backup-gwc-discard-accord',[C.gwc,C.backup],
  'BackupでMagを検索して初手GWCを捨てる→Decoder＋MagでWicked→Dot→Wickedで元Backup除外、2枚目Backupを検索→Transcode→Accord＋Transcode。GWCは蘇生効果ではなく手札コストとして使用する。',g=>{
    normal(g,C.backup,{picks:[C.mag,C.gwc]});link(g,C.decoder,[C.backup],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.backup,C.backup],places:[5,1]});
    activate(g,C.backup,{places:[2]});genericAccord(g);
  },{monsters:[C.accord,C.transcode]},{classification:'two-card-hand-cost-extension'});

await route('pair6-rabbit-mag-crypter-binder-ip-gwc',[C.mag,C.rabbit],
  'RabbitでMTPを確保→Decoder＋初手MagでWicked→Dot/Rabbit帰還/Backup→Dormouseを検索して捨てBinderで除外帰還→Cat→MTP/Hare→Crypter＋Binder＋I:P＋GWC。S:Pを使わず両方の初手を展開へ投入する。',g=>{
    normal(g,C.rabbit,{picks:[C.mtp]});link(g,C.decoder,[C.rabbit],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.rabbit,C.backup],places:[5,1,0]});
    activate(g,C.backup,{picks:[C.dorm,C.dorm],places:[2]});
    link(g,C.binder,[C.wicked,C.rabbit],{picks:[C.dorm],places:[5,0]});
    activate(g,C.dorm,{picks:[C.cat],places:[3]});activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
    link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});activate(g,C.hare,{picks:[C.mtp],places:[0]});
    link(g,C.ip,[C.cat,C.hare],{places:[2]});activate(g,C.binder,{picks:[C.gwc]});
  },{monsters:[C.crypter,C.binder,C.ip],spells:[C.gwc],lp:6200});

await route('pair6-wizard-baldrake-sp',[C.wizard,C.baldrake],
  'Wizardを通常召喚→Decoder→墓地WizardをBaldrakeの除外コストとして特殊召喚→S:P。両方は使えるが、M∀LICE本展開には届いていない小展開の具体例。',g=>{
    normal(g,C.wizard);link(g,C.decoder,[C.wizard],{places:[5]});
    activate(g,C.baldrake,{picks:[C.wizard]});link(g,C.sp,[C.decoder,C.baldrake],{decline:[C.sp],places:[5]});
  },{monsters:[C.sp]},{classification:'two-card-small-development'});

await route('pair6-dorm-cat-crypter-binder-gwc',[C.dorm,C.cat],
  'Catで初手Dormouseを除外して帰還、ドローは辞退→DormouseでRabbit帰還/MTP→Decoder→Binder＋Decoder/Cat帰還→GWCをセット→MTP/Hare→Crypter＋Binder＋GWC。',g=>{
    normal(g,C.cat);activate(g,C.cat,{picks:[C.dorm],places:[1]});
    activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[2]});link(g,C.decoder,[C.cat],{places:[5]});
    link(g,C.binder,[C.decoder,C.dorm,C.rabbit],{picks:[C.cat],places:[5,0,1]});
    activate(g,C.binder,{picks:[C.gwc]});activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
    activate(g,C.hare,{picks:[C.mtp],places:[2]});link(g,C.crypter,[C.decoder,C.cat,C.hare],{places:[6]});
  },{monsters:[C.crypter,C.binder],spells:[C.gwc],lp:6200});

await route('pair6-rabbit-soul-crypter-binder',[C.rabbit,C.soul],
  'Rabbit→TB/Dormouse→Decoder/S:PでDormouse帰還→Cat→Binder。初手Code of Soulを追加特殊召喚してMTP/Hareと合わせ、Binderを残してCrypterを成立させる。',g=>{
    normal(g,C.rabbit,{picks:[C.tb]});activate(g,C.tb,{picks:[C.rabbit,C.dorm]});
    link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.dorm],places:[5,1]});
    activate(g,C.dorm,{picks:[C.cat]});link(g,C.binder,[C.sp,C.dorm],{picks:[[C.rabbit,C.tb]],places:[5]});
    activate(g,C.soul,{places:[1]});activate(g,C.binder,{picks:[C.mtp]});
    activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});activate(g,C.hare,{picks:[C.mtp],places:[2]});
    link(g,C.crypter,[C.cat,C.soul,C.hare],{places:[5]});
  },{monsters:[C.crypter,C.binder],lp:6200},{conditions:['S:Pを特殊召喚しているため同ターンのTranscode蘇生は使えない','墓地Code of Soulの相手ターン効果はこの再生の範囲外']});

await route('pair6-cat-baldrake-binder-sp',[C.baldrake,C.cat],
  'Cat通常召喚→Decoder→Baldrakeで墓地Catを除外しCat帰還→3体でBinder＋Decoder帰還→MTP/Hare→Binder＋S:P。Baldrakeの特殊召喚とCatの除外帰還を展開札として使う。',g=>{
    normal(g,C.cat);link(g,C.decoder,[C.cat],{places:[5]});
    activate(g,C.baldrake,{picks:[C.cat],places:[0,1]});
    link(g,C.binder,[C.decoder,C.baldrake,C.cat],{places:[5,0],decline:[C.binder]});
    activate(g,C.binder,{picks:[C.mtp]});activate(g,C.mtp,{picks:[C.binder,C.hare,C.baldrake],places:[4]});
    activate(g,C.hare,{picks:[C.mtp],places:[1]});link(g,C.sp,[C.decoder,C.hare],{places:[5],decline:[C.sp]});
  },{monsters:[C.binder,C.sp],lp:6800},{conditions:['Baldrakeを特殊召喚しているため同ターンのMag②/Transcode蘇生は使えない','DecoderはLモンスターなのでI:Pの素材にはできず、S:Pを選ぶ']});

const survey=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/multi-opening-survey.json'),'utf8'));
for(const pair of pairs) {
  const g=await startPair(pair.hand);
  try {
    const reference=survey.pairs.find(p=>p.id===pair.id),directed=routes.filter(r=>r.pairId===pair.id);
    initialProbes.push({...pair,names:pair.hand.map(c=>cards[c].name),initial:compact(g),initialBoard:board(g),
      surveyReference:{sourceIdentity:survey.sourceIdentity,status:reference?.status,route:reference?.best?.id,usage:reference?.best?.usage?.kind,
        meaning:'過去の既知template適用結果であり、新規探索の成否ではない。'},
      directedRouteIds:directed.map(r=>r.id),status:directed.length?'new-route-proved':'new-search-pending',
      reason:directed.length?'下記の新規指向ルートを実coreで生成・独立再生済み。全後続木は未完了。':pair.hand.includes(C.allure)?
        'Allureは効果解決で未確定ドローを要するため、その先を確定展開として扱わない。ドロー前の召喚/セット等は新規探索対象。':
        reference?.status==='unsupported'?'既知templateが無かった組。初期core選択肢は記録したが、全合法木の不成立を意味しない。':
        '過去のtemplate適用だけでは2枚を活用した展開の網羅にならないため、sharedrunnerで根から新規探索する。'});
  }finally{g.close();}
}
fs.writeFileSync(path.join(RUN,'initial-probes.json'),JSON.stringify(initialProbes,null,2)+'\n');
fs.writeFileSync(path.join(RUN,'directed-routes.json'),JSON.stringify(routes,null,2)+'\n');
const searchSummaryFile=path.join(SEARCH,'summary.json'),searchRoutesFile=path.join(SEARCH,'best-routes.json');
let rootSearch=null;const searchRoutes=[],checkpointAudit=[];
if(fs.existsSync(searchSummaryFile)&&fs.existsSync(searchRoutesFile)) {
  rootSearch=JSON.parse(fs.readFileSync(searchSummaryFile,'utf8'));
  const exported=JSON.parse(fs.readFileSync(searchRoutesFile,'utf8'));
  assert.equal(rootSearch.shard,6);assert.equal(rootSearch.shards,8);assert.equal(rootSearch.presetHash,hash(preset));
  for(const field of ['generation','sourceHash','assetsHash','pairHash','presetHash'])assert.equal(rootSearch[field],exported[field],`Inconsistent search ${field}`);
  assert.deepEqual(rootSearch.selectedPairIndices,pairs.map(p=>p.index),'Final report must cover all assigned pairs');
  const priorAuditFile=path.join(RUN,'checkpoint-audit.json');
  if(!process.argv.includes('--audit-checkpoints')&&fs.existsSync(priorAuditFile)) {
    const priorAudit=JSON.parse(fs.readFileSync(priorAuditFile,'utf8'));
    if(priorAudit.rootGeneration===rootSearch.generation)checkpointAudit.push(...priorAudit.pairs);
  }
  if(process.argv.includes('--audit-checkpoints'))for(const p of rootSearch.pairs) {
    const cp=JSON.parse(fs.readFileSync(p.checkpoint,'utf8'));
    assert.equal(cp.identity.sourceHash,rootSearch.sourceHash);assert.deepEqual(cp.pair.hand,p.hand);
    assert.equal(cp.search.visited,p.visited);assert.equal(cp.search.frontier.length,p.unresolved);assert.equal(cp.excludedDraw.length,p.excludedDraw);
    const reasons={},depths={};let minDepth=null,maxDepth=null,drawReplayed=0;
    for(const frame of cp.search.frontier) {
      reasons[frame.reason]=(reasons[frame.reason]??0)+1;
      const depth=frame.prefix.length,bucket=`${Math.floor(depth/10)*10}-${Math.floor(depth/10)*10+9}`;
      depths[bucket]=(depths[bucket]??0)+1;minDepth=minDepth===null?depth:Math.min(minDepth,depth);maxDepth=Math.max(maxDepth??0,depth);
    }
    for(const excluded of cp.excludedDraw) {
      const g=await startRoute(p.hand,{seed:cp.identity.seed});
      try {
        assert.equal(excluded.continuationExplored,false);
        for(const input of excluded.prefix) {
          assert(!g.log.some(x=>/\d+\s*枚ドロー/.test(x.text)&&x.turn<=1),'Excluded prefix responds after unknown draw');respond(g,input);
        }
        assert(g.log.some(x=>/\d+\s*枚ドロー/.test(x.text)&&x.turn<=1),'Excluded prefix must actually reach a first-turn draw');
        drawReplayed++;
      }finally{g.close();}
    }
    checkpointAudit.push({index:p.index,id:p.id,visited:p.visited,unresolved:p.unresolved,reasons,depths,minDepth,maxDepth,
      drawReplayed,coreRejected:cp.search.rejected.length,historicalFailures:cp.failureHistory.length,checkpointHash:hash(cp)});
  }
  for(const r of exported.routes) {
    const g=await startPair(r.hand);
    try {
      for(const step of r.steps) {
        assert(!g.log.some(x=>x.text.includes('枚ドロー')),'No responses after unknown draw');
        assert.equal(hash({pending:g.pending,board:board(g)}),step.before);respond(g,step.input);
        assert.equal(g.route.steps.at(-1).label,step.label);
      }
      assert.equal(hash(board(g)),r.finalHash);assert.equal(hash(r.final),r.finalHash);
      assert(!g.log.some(x=>x.text.includes('枚ドロー')),'No drawn outcome export');
      const evidence=g.pairUsage.map(e=>({...e,originalCardsKnownToHaveLeftHand:e.initial-e.minimumInHand}));
      const used=evidence.reduce((n,e)=>n+e.originalCardsKnownToHaveLeftHand,0);
      searchRoutes.push({...r,usage:{kind:used===2?'both_initial_cards_left_hand':used===1?'one_initial_card_left_hand':'initial_cards_retained',
        provenOriginalCardsLeftHand:used,evidence,caveat:'手札を離れた枚数の下限であり、発動回数や2枚専用コンボの優位性ではない。'},
        sourceProof:{summary:'runtime/multi-pair-search/shard-6/summary.json',sourceHash:rootSearch.sourceHash}});
    }finally{g.close();}
  }
}
const output={schemaVersion:1,shard:6,shards:8,presetHash:hash(preset),scope:'全333の合法2枚multisetのうちindex%8===6の41組。固定2枚・先攻空盤面・未確定ドロー後禁止。',
  complete:false,exhaustive:false,pairs:initialProbes.map(({initial,initialBoard,...p})=>({...p,initialPrompt:initial.type,
    initialChoices:initial.choices.map(c=>({code:c.code,label:c.label})),initialProof:{path:'runtime/multi-pairs/shard-6/initial-probes.json',hash:hash({initial,initialBoard})},
    rootSearch:rootSearch?.pairs.find(s=>s.id===p.id)??null,rootRepresentativeUsage:searchRoutes.find(r=>r.pairId===p.id)?.usage??null})),
  routes,summary:{pairs:pairs.length,newDirectedRoutes:routes.length,pairsWithNewDirectedRoutes:new Set(routes.map(r=>r.pairId)).size,
    initialCoreProbes:initialProbes.length,rootSearch:rootSearch?.summary??null,searchRepresentativeRoutes:searchRoutes.length},
  checkpointAudit:checkpointAudit.length?checkpointAudit:null,
  rootSearchProof:rootSearch?{path:'runtime/multi-pair-search/shard-6/summary.json',hash:hash(rootSearch),sourceHash:rootSearch.sourceHash,scope:rootSearch.scope}:null,
  limitations:['初期選択肢や既知templateの有無は全合法木の可否証明ではない','2枚使用、小展開、1枚＋相方保持、未探索を混同しない','ドロー後の結果と相手ターンの反応は対象外']};
for(const p of output.pairs)if(p.rootSearch) {
  p.status=p.rootSearch.status;
  p.reason=p.rootSearch.completeWithinNoDrawScope?
    `この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は ${p.rootSearch.bestPlayable?.classification??'なし'}。相手がいる対戦やドローを含む全分岐の可否は証明していない。`:
    `根から ${p.rootSearch.visited} ノードを新規探索し、未解決 ${p.rootSearch.unresolved} 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。${p.rootSearch.excludedDraw?`未確定ドロー境界 ${p.rootSearch.excludedDraw} 件は範囲外として保持。`:''}`;
}
fs.writeFileSync(OUT,JSON.stringify(output,null,2)+'\n');
if(checkpointAudit.length)fs.writeFileSync(path.join(RUN,'checkpoint-audit.json'),JSON.stringify({rootGeneration:rootSearch.generation,pairs:checkpointAudit},null,2)+'\n');
const lines=['# 2枚初動の新規探索: shard 6','',
  '固定40枚の全333種類の合法2枚組のうち、列挙順 index % 8 === 6 の41組を担当。初手は該当2枚をデッキから抜いて置き、先攻・相手初期手札と盤面なしで実coreを動かす。既知template適用結果とは別に、新しい指向ルートと根からの入力列挙を記録する。','',
  `新規指向ルート ${routes.length} 本を独立再生済み。全41組の初期core選択肢を観測済み。根からの探索: ${rootSearch?JSON.stringify(rootSearch.summary):'未実行'}。全ゲームの全合法木は未完了。`, '',
  '未確定ドローを解決した応答は境界に保存し、その後の応答・盤面採点・ルート採用は行わない。ドローを除く範囲で閉じた木があっても、ドローを含む全分岐の完了とはしない。相手の妨害や5枚初手は今回の対象外。','',
  '## 未解決分岐の監査','',
  ...(checkpointAudit.length?[
    `全${checkpointAudit.length} checkpointのhash/統計と、除外した未確定ドロー ${checkpointAudit.reduce((n,p)=>n+p.drawReplayed,0)} prefixを独立再生検証。ドロー後の応答ゼロを確認。core拒否 ${checkpointAudit.reduce((n,p)=>n+p.coreRejected,0)} 件、記録された実行失敗 ${checkpointAudit.reduce((n,p)=>n+p.historicalFailures,0)} 件。`, '',
    `未完了理由: ${JSON.stringify(checkpointAudit.reduce((a,p)=>{for(const[k,v]of Object.entries(p.reasons))a[k]=(a[k]??0)+v;return a;},{}))}。`, '',
    `未解決prefixの応答深さ別件数: ${JSON.stringify(checkpointAudit.reduce((a,p)=>{for(const[k,v]of Object.entries(p.depths))a[k]=(a[k]??0)+v;return a;},{}))}。`, '',
    `残枝が少ない組: ${checkpointAudit.filter(p=>p.unresolved).sort((a,b)=>a.unresolved-b.unresolved).slice(0,8).map(p=>`index ${p.index}: ${p.unresolved} 件、深さ ${p.minDepth}–${p.maxDepth}`).join(' / ')}。残枝数はその先の木の大きさではなく、追加予算で閉じる保証はない。`, '',
  ]:['checkpoint監査は未実行。','']),
  '## 新規指向ルート','',
  ...routes.flatMap(r=>[`- **${r.name}**: ${r.summary} ${r.steps.length} 応答 / LP ${r.final.lp[0]}。分類: ${r.classification}。`, '']),
  '## 担当41組と現時点の証拠','',
  '「使用」は初手が手札を離れた枚数の下限。セット・コストも含み、2枚専用コンボの強さを意味しない。根探索の代表は訪問済み盤面の固定ヒューリスティック最高点で、最適解や勝率ではない。小展開は通常召喚・セット・L1・S:P単体等と区別する。','',
  '| index | 2枚組 | 旧template | 新指向線 | 根訪問数 / 未解決 / ドロー境界 | 根代表の分類 / 使用 |',
  '|---:|---|---|---:|---|---|',
  ...output.pairs.map(p=>{const s=p.rootSearch,r=searchRoutes.find(r=>r.pairId===p.id);return `| ${p.index} | ${p.names.join(' + ')} | ${p.surveyReference.status??'なし'} | ${p.directedRouteIds.length} | ${s?`${s.visited} / ${s.unresolved} / ${s.excludedDraw}`:'未探索'} | ${r?`${r.classification} / ${r.usage.provenOriginalCardsLeftHand}枚`:'代表未取得'} |`;}),'',
  '## 未対応・未完了の理由','',
  ...output.pairs.filter(p=>!p.directedRouteIds.length).map(p=>`- index ${p.index}: ${p.reason}${p.rootSearch?` 根探索は ${p.rootSearch.status}、未解決 ${p.rootSearch.unresolved} 件。`:''}`),'',
  '## 再現','',
  '```powershell',
  'node scripts/research-pair-shard-6.mjs --audit-checkpoints',
  'node scripts/search-multi-pairs.mjs --shard 6 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1',
  'node scripts/research-pair-shard-6.mjs',
  '```','',
  '根探索の詳細入力・残りfrontier・出典hashは runtime/multi-pair-search/shard-6/ に保持。手動の指向ルートと初期probeは runtime/multi-pairs/shard-6/。routes/pair-shard-6.json は代表と要約。未知ドローに依存する展開は確定ルートへ収録しない。',''];
fs.writeFileSync(path.join(ROOT,'docs/pair-shard-6.md'),lines.join('\n'));
console.log(JSON.stringify({verification:'PASS',shard:6,pairs:pairs.length,directedRoutes:routes.length,initialCoreProbes:initialProbes.length,rootSearch:rootSearch?.summary??null,searchRoutesReplayed:searchRoutes.length,
  checkpointsAudited:checkpointAudit.length,unknownDrawBoundariesReplayed:checkpointAudit.reduce((n,p)=>n+p.drawReplayed,0),exhaustive:false}));
