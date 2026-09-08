import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const C={rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,tb:57111661,mtp:94722358,gwc:20726052,
 decoder:30342076,wicked:52698008,sp:29301450,ip:65741786,wp:4993187,binder:95454996,crypter:21848500,
 backup:30118811,mag:64865,dot:18789533,wizard:3723262,transcode:46947713,firewall:5043010,accord:39138610,
 ring:24842059,almiraj:60303245,soul:74652966,access:86066372,gold:75500286,ug:68337209,terra:73628505};
const trace=process.argv.includes('--trace');
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
function compact(g) {return {type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place})),choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response}))};}
function reply(g,input) {if(trace)console.log(g.prompt.type,input);respond(g,input);}
function yes(g,value=true) {const c=g.prompt.choices.find(c=>c.response.yes===value);assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});}
function settle(g,{picks=[],materials=[],places=[],decline=[],positions=[]}={}) {
 picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];positions=[...positions];
 for(let n=0;n<140;n++) {
  const p=g.prompt;
  if(p.type==='SELECT_IDLECMD'){assert.equal(picks.length,0,'Unused selections');assert.equal(materials.length,0,'Unused materials');return;}
  if(trace)console.log(JSON.stringify(compact(g)));
  if(p.type==='SELECT_CHAIN') {
   const triggers=[C.rabbit,C.cat,C.dorm,C.binder,C.decoder,C.wicked,C.backup,C.mag,C.dot,C.accord,C.access];
   const c=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
   assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});
  }else if(p.type==='SELECT_EFFECTYN')yes(g,!decline.includes(g.pending.code));
  else if(p.type==='SELECT_YESNO') {
   // The local strings entry for Cat effect index 2 says "Special Summon",
   // but c96676583.lua uses that description for its optional two-card draw.
   const desc=BigInt(g.pending.description??0),isCatDraw=(desc>>20n)===BigInt(C.cat)&&(desc&0xfffffn)===2n;
   yes(g,!isCatDraw&&!/ドロー/.test(p.title));
  }
  else if(p.type==='SELECT_PLACE') {
   const seq=places.shift(),i=seq===undefined?0:p.cards.findIndex(c=>c.place.sequence===seq&&c.place.player===0);
   assert(i>=0,`No place ${seq}: ${JSON.stringify(compact(g))}`);reply(g,{selection:[i]});
  }else if(p.type==='SELECT_POSITION') {
   const pos=positions.shift()||1,c=p.choices.find(c=>c.response.position===pos)||p.choices[0];reply(g,{action:c.id});
  }else if(p.type==='SELECT_CARD') {
   let want=picks.shift();if(!want&&p.cards.length===p.min&&p.min===p.max)want=p.cards.map(c=>c.code);
   assert(want,`Need cards ${JSON.stringify(compact(g))}`);
   const selection=[];for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}reply(g,{selection});
  }else if(p.type==='SELECT_UNSELECT_CARD') {
   const code=materials.shift(),c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
   assert(c,`Missing material ${code}: ${JSON.stringify(compact(g))}`);reply(g,{action:c.id});
  }else assert.fail(`Unexpected ${JSON.stringify(compact(g))}`);
 }assert.fail('Route did not settle');
}
function action(g,action,code,options={}) {if(trace)console.log('ACTION',action,cards[code]?.name);select(g,c=>c.response.action===action&&c.card?.code===code);settle(g,options);}
const normal=(g,c,o)=>action(g,0,c,o),activate=(g,c,o)=>action(g,5,c,o),link=(g,c,materials,o={})=>action(g,1,c,{materials,...o});
const zone=(g,z)=>board(g).players[0][z].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b);
function check(g,{monsters,hand=[],spells=[],lp}) {
 assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.turn,1);assert.equal(g.turnPlayer,0);
 assert.deepEqual(g.lp,[lp,8000]);
 for(const [name,wanted] of Object.entries({monsters,hand,spells}))assert.deepEqual(zone(g,name),[...wanted].sort((a,b)=>a-b),name);
 assert(!g.log.some(x=>x.text.includes('枚ドロー')),'No random draw may be consumed');
 const own=board(g).players[0];
 assert.equal(g.snapshot().players[0].deckCount+own.hand.length+['monsters','spells','grave','banished'].reduce((n,z)=>n+own[z].filter(c=>c&&!(cards[c.code].type&0x4000000)).length,0),40);
}

// Research ownership: pair index modulo 8 equals 0. Shared helpers stay unchanged.
import {enumeratePairs} from './survey-multi-openings.mjs';
Object.assign(C,{allure:1475311,ash:14558127,ogre:59438930,maxx:23434538,purulia:84192580,impulse:40366667,magna:33854624,shifter:91800273,accusation:78114463});
const assigned=enumeratePairs(preset.main).map((p,index)=>({...p,index})).filter(p=>p.index%8===0);
const survey=JSON.parse(fs.readFileSync(new URL('../routes/multi-opening-survey.json',import.meta.url),'utf8'));
const previous=new Map(survey.pairs.map(p=>[p.id,p]));
const routes=[],only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
async function route(id,hand,summary,execute,expected,classification='two-card-line') {
 if(only&&!id.includes(only))return;
 const pair=assigned.find(p=>p.id===[...hand].sort((a,b)=>a-b).join('-'));assert(pair,'Route outside assigned shard');
 const g=await startRoute(pair.hand);
 try {
  execute(g);check(g,expected);
  const r=finishRoute(g,{id:`pair-shard-0-${id}`,pairId:pair.id,pairIndex:pair.index,starter:hand[0],name:hand.map(c=>cards[c].name).join('＋'),summary,classification,requiresDraw:false,
   conditions:['固定presetから実際に2枚を抜き取った手札','先攻・相手空盤面・妨害なし・通常召喚権未使用','追加ドローは一切使わない','各名称ターン1・デュエル1回の効果は初期状態'],
   limitations:['記載手順の合法性と着地点を検証。全手順木や最善性を証明したものではない','相手ターンの追加処理は未検証'],expected});
  await replay(r);routes.push(r);console.log(`PASS ${r.id}: ${r.steps.length} inputs; LP ${g.lp[0]}`);
 }finally{g.close();}
}

await route('mag-dorm-crypter-binder-ip-gwc',[C.mag,C.dorm],
 'DormouseからCat→Decoder＋手札MagでWicked→Dot/Dormouse帰還/Backup→Rabbitを検索して捨てBinderで除外帰還→MTP/Hare→Crypter＋Binder＋I:P＋GWC。',g=>{
  normal(g,C.dorm,{places:[1]});activate(g,C.dorm,{picks:[C.cat],places:[0]});
  link(g,C.decoder,[C.dorm],{places:[5]});
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.dorm,C.backup],places:[5,1,3]});
  activate(g,C.backup,{picks:[C.rabbit,C.rabbit],places:[2]});
  link(g,C.binder,[C.wicked,C.cat],{picks:[C.rabbit,C.mtp],places:[5,0]});
  activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
  link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});
  activate(g,C.hare,{picks:[C.mtp],places:[1]});
  link(g,C.ip,[C.rabbit,C.hare],{places:[2]});
  activate(g,C.binder,{picks:[C.gwc]});
 },{monsters:[C.crypter,C.binder,C.ip],spells:[C.gwc],lp:6200});

for(const end of ['sp','ring-decoder'])await route(`wizard-soul-${end}`,[C.wizard,C.soul],
 `Wizard通常召喚→Decoder→手札Soul特殊召喚→${end==='sp'?'S:P':'SoulでRingを作りDecoderと残す'}。両札を使う小展開。`,g=>{
  normal(g,C.wizard);link(g,C.decoder,[C.wizard],{places:[5]});activate(g,C.soul,{places:[1]});
  if(end==='sp')link(g,C.sp,[C.decoder,C.soul],{decline:[C.sp],places:[5]});
  else link(g,C.ring,[C.soul],{places:[1]});
 },{monsters:end==='sp'?[C.sp]:[C.ring,C.decoder],lp:8000},'limited-two-card-line');

await route('wizard-magna-sp',[C.wizard,C.magna],
 'Wizardを通常召喚しDecoder→墓地WizardをMagnaで除外し特殊召喚→2体でS:P。Magnaのエンド検索はこの記録では発動しない。',g=>{
  normal(g,C.wizard);link(g,C.decoder,[C.wizard],{places:[5]});activate(g,C.magna,{picks:[C.wizard],decline:[C.magna]});
  link(g,C.sp,[C.decoder,C.magna],{decline:[C.sp],places:[5]});
 },{monsters:[C.sp],lp:8000},'limited-two-card-line');

await route('backup-impulse-accord',[C.backup,C.impulse],
 'BackupでMag検索、Impulseを捨てる→Decoder＋手札MagでWicked→Dotを墓地へ送りリンク先へ蘇生→WickedでBackup除外し別個体を検索→Backup特殊召喚→Transcode→Accord＋Transcode。',g=>{
  normal(g,C.backup,{picks:[C.mag,C.impulse]});link(g,C.decoder,[C.backup],{places:[5]});
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.backup,C.backup],places:[5,1]});activate(g,C.backup);
  link(g,C.transcode,[C.wicked,C.dot]);activate(g,C.transcode,{picks:[C.wicked]});
  link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode]});
 },{monsters:[C.accord,C.transcode],lp:8000},'hand-cost-line');

for(const end of ['ip','accord'])await route(`hare-rabbit-${end}`,[C.hare,C.rabbit],
 `Rabbit/TBからDormouseをDecoder/S:Pで帰還させCatへ→Binder/MTPで追加Rabbit検索→初手Hareを特殊召喚→${end==='ip'?'I:P':'Accord'}＋Binder、手札Rabbit。`,g=>{
  normal(g,C.rabbit,{picks:[C.tb]});activate(g,C.tb,{picks:[C.rabbit,C.dorm]});
  link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.dorm],places:[5,1]});
  activate(g,C.dorm,{picks:[C.cat]});link(g,C.binder,[C.sp,C.dorm],{picks:[[C.rabbit,C.tb]],places:[5]});
  activate(g,C.binder,{picks:[C.mtp]});activate(g,C.mtp,{picks:[C.binder,C.rabbit],places:[4]});
  activate(g,C.hare,{picks:[C.mtp]});
  if(end==='ip')link(g,C.ip,[C.cat,C.hare],{places:[5]});
  else link(g,C.accord,[C.binder,C.cat,C.hare],{picks:[C.binder],places:[5,1]});
 },{monsters:[end==='ip'?C.ip:C.accord,C.binder],hand:[C.rabbit],lp:6200});

await route('gold-dorm-crypter-binder-ring',[C.gold,C.dorm],
 'Dormouse→Rabbit/MTP→Wicked→GoldでCatを除外しWickedのリンク先へ帰還→墓地Dormouse除外・帰還とBackup検索→Magを捨てDot→MTP/Hare→Binder/GWC→Crypter＋Binder＋Ring、手札Rabbit。',g=>{
  normal(g,C.dorm,{places:[1]});activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[0]});
  link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
  activate(g,C.gold,{picks:[C.cat,C.dorm,C.backup],places:[1,1,0]});
  activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[2,3]});
  activate(g,C.mtp,{picks:[C.cat,C.hare]});activate(g,C.hare,{picks:[C.mtp],places:[1]});
  link(g,C.binder,[C.wicked,C.hare],{picks:[[C.rabbit,C.hare],C.rabbit],places:[5]});
  activate(g,C.binder,{picks:[C.gwc]});activate(g,C.gwc,{picks:[C.binder,C.cat],places:[1,4]});
  link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});link(g,C.ring,[C.cat],{places:[2]});
 },{monsters:[C.crypter,C.binder,C.ring],hand:[C.rabbit],lp:5900});

await route('underground-dot-crypter-binder-ring',[C.ug,C.dot],
 'DotからDecoderと帰還Dot→UndergroundでDormouse、Rabbit/MTP→Wicked→HareでWickedを誘発しBackup→Magを捨てCatを墓地へ→BinderでCat帰還/HareでRabbit回収→GWC/Dormouse→Crypter＋Binder＋Ring、手札Rabbit。',g=>{
  normal(g,C.dot,{places:[1]});link(g,C.decoder,[C.dot],{places:[5,0]});
  activate(g,C.ug,{picks:[C.dorm],places:[2]});activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[3]});
  link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
  activate(g,C.mtp,{picks:[C.dorm,C.hare]});
  activate(g,C.hare,{picks:[C.mtp,C.rabbit,C.backup],places:[1]});
  activate(g,C.backup,{picks:[C.mag,C.mag,C.cat],places:[2]});
  link(g,C.binder,[C.wicked,C.hare],{picks:[[C.cat,C.hare],C.rabbit],places:[5,1]});
  activate(g,C.binder,{picks:[C.gwc]});activate(g,C.gwc,{picks:[C.binder,C.dorm],places:[3,4]});
  link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});link(g,C.ring,[C.cat],{places:[2]});
 },{monsters:[C.crypter,C.binder,C.ring],hand:[C.rabbit],spells:[C.ug],lp:5900});

await route('shifter-cat-ring-decoder',[C.shifter,C.cat],
 '最初のチェーン窓でShifterを発動→Cat通常召喚→Decoderの素材として除外されたCatを300LPで帰還→CatでRing。Shifterを適用したまま罠無効用RingとDecoderを残す。',g=>{
  select(g,c=>c.card?.code===C.shifter);settle(g);
  normal(g,C.cat);link(g,C.decoder,[C.cat],{places:[5,1]});link(g,C.ring,[C.cat],{places:[1]});
  assert.deepEqual(zone(g,'grave'),[C.shifter]);assert(zone(g,'banished').includes(C.cat));
 },{monsters:[C.ring,C.decoder],lp:7700},'limited-two-card-line');

await route('shifter-dot-sp',[C.shifter,C.dot],
 '最初のチェーン窓でShifterを発動→Dot通常召喚→Decoderの素材として除外されたDotを帰還→S:P。Dotは墓地帰還ではなく除外帰還を使用する。',g=>{
  select(g,c=>c.card?.code===C.shifter);settle(g);
  normal(g,C.dot);link(g,C.decoder,[C.dot],{places:[5,1]});link(g,C.sp,[C.decoder,C.dot],{decline:[C.sp],places:[5]});
  assert.deepEqual(zone(g,'grave'),[C.shifter]);assert(zone(g,'banished').includes(C.dot));
 },{monsters:[C.sp],lp:8000},'limited-two-card-line');

await route('mag-allure-no-draw-set',[C.mag,C.allure],
 'AllureをセットしてMagを保持。Mag単独では空盤面へ出せず、追加ドローを除くこの時点ではモンスターを展開する合法候補がない。',g=>{
  select(g,c=>c.response.action===4&&c.card?.code===C.allure);settle(g);
  assert(!g.prompt.choices.some(c=>[0,1].includes(c.response.action)));
 },{monsters:[],hand:[C.mag],spells:[C.allure],lp:8000},'no-draw-limited-probe');

for(const [key,hand,starter,remaining] of [
 ['ash-ash',[C.ash,C.ash],C.ash,C.ash],
 ['maxx-ogre',[C.maxx,C.ogre],C.ogre,C.maxx],
 ['maxx-purulia',[C.maxx,C.purulia],C.purulia,C.maxx],
])await route(`${key}-almiraj`,hand,
 `${cards[starter].name}通常召喚→Almiraj。残る誘発1枚を保持し、M∀LICEアクセスを伴わない小展開。`,g=>{
  settle(g);normal(g,starter);link(g,C.almiraj,[starter],{places:[5]});
  assert(!g.prompt.choices.some(c=>[0,1].includes(c.response.action)));
 },{monsters:[C.almiraj],hand:[remaining],lp:8000},'limited-two-card-line');

// Capture the first chain window separately from Main 1 legal choices.
const pairs=[];
for(const pair of assigned){
 const g=await startRoute(pair.hand);
 try {
  const firstPrompt=safe(compact(g));
  settle(g,{decline:[C.backup,C.mag,C.dot,C.rabbit,C.cat,C.dorm,C.hare,C.shifter,C.magna]});
  const probe=finishRoute(g,{id:`pair-shard-0-census-${pair.id}`,pairId:pair.id,requiresDraw:false,classification:'opening-action-probe'});
  await replay(probe);
  pairs.push({...pair,names:pair.hand.map(c=>cards[c].name),previousTemplateStatus:previous.get(pair.id)?.status??'not-surveyed',previousBest:previous.get(pair.id)?.best?.id??null,
   firstPrompt,openingChoices:safe(compact(g)),openingProbe:probe,manualRouteIds:routes.filter(r=>r.pairId===pair.id).map(r=>r.id),searchStatus:'awaiting-shared-runner'});
 }finally{g.close();}
}
assert.equal(pairs.length,42);
if(!only){
 const reportUrl=new URL('../runtime/multi-pair-search/shard-0/summary.json',import.meta.url);
 const exportsUrl=new URL('../runtime/multi-pair-search/shard-0/best-routes.json',import.meta.url);
 const lockUrl=new URL('../runtime/multi-pair-search/shard-0/.search.lock',import.meta.url);
 let searchEvidence=null;
 if(fs.existsSync(reportUrl)&&!fs.existsSync(lockUrl)){
  const reportBytes=fs.readFileSync(reportUrl),exportBytes=fs.readFileSync(exportsUrl);
  const searchReport=JSON.parse(reportBytes.toString('utf8')),exported=JSON.parse(exportBytes.toString('utf8'));
  assert.equal(searchReport.generation,exported.generation);assert.equal(searchReport.sourceHash,exported.sourceHash);
  assert.equal(searchReport.presetHash,hash(preset));assert.deepEqual(searchReport.selectedPairIndices,assigned.map(p=>p.index));
  const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  const checkpoints=[];
  for(const p of pairs){
   const searched=searchReport.pairs.find(s=>s.index===p.index);assert(searched);
   p.searchStatus=searched.status;
   p.search={visited:searched.visited,terminalPaths:searched.terminalPaths,unresolved:searched.unresolved,unresolvedByReason:searched.unresolvedByReason,
    excludedDraw:searched.excludedDraw,completeWithinNoDrawScope:searched.completeWithinNoDrawScope,bestPlayable:searched.bestPlayable,classification:searched.bestPlayable?.classification??null};
   if(searched.checkpoint){
    const bytes=fs.readFileSync(searched.checkpoint),checkpoint=JSON.parse(bytes.toString('utf8'));
    assert.equal(checkpoint.search.visited,searched.visited);assert.equal(checkpoint.search.frontier.length,searched.unresolved);
    const terminals=checkpoint.search.terminals;
    p.search.terminalEvidence={observedPaths:terminals.length,
     maximumMonstersAtEndpoint:Math.max(0,...terminals.map(t=>t.final.players[0].monsters.filter(Boolean).length)),
     maximumCyberseLinkRatingAtEndpoint:Math.max(0,...terminals.flatMap(t=>t.final.players[0].monsters.filter(c=>c&&(cards[c.code].type&0x4000000)&&cards[c.code].race==='16777216').map(c=>cards[c.code].level))),
     maliceLinkEndpointPaths:terminals.filter(t=>t.final.players[0].monsters.some(c=>c&&(cards[c.code].type&0x4000000)&&cards[c.code].setcodes.includes(441))).length,
     scopeWideEndpathEvidence:searched.completeWithinNoDrawScope,meaning:'記録した終端盤面の集計。未完了pairでは観測範囲の下限であり、展開不能の証明ではない。'};
    checkpoints.push({pairIndex:p.index,path:searched.checkpoint.replaceAll('\\','/'),sha256:digest(bytes)});
   }
  }
  for(const r of exported.routes)await replay(r);
  assert.deepEqual(fs.readFileSync(reportUrl),reportBytes,'Search summary changed while synchronizing');
  assert.deepEqual(fs.readFileSync(exportsUrl),exportBytes,'Search exports changed while synchronizing');
  const unresolvedByReason=pairs.reduce((map,p)=>{for(const [reason,count] of Object.entries(p.search?.unresolvedByReason||{}))map[reason]=(map[reason]||0)+count;return map;},{});
  searchEvidence={summary:searchReport.summary,unresolvedByReason,sourceHash:searchReport.sourceHash,assetsHash:searchReport.assetsHash,generation:searchReport.generation,scope:searchReport.scope,
   files:[{path:'runtime/multi-pair-search/shard-0/summary.json',sha256:digest(reportBytes)},{path:'runtime/multi-pair-search/shard-0/best-routes.json',sha256:digest(exportBytes)}],checkpoints};
  console.log(`PASS synchronized real-core search: ${searchReport.summary.searched}/42 pairs, ${searchReport.summary.completeWithinNoDrawScope} complete within no-draw scope; ${exported.routes.length} exports independently replayed.`);
 }
 fs.writeFileSync(new URL('../routes/pair-shard-0.json',import.meta.url),JSON.stringify({schemaVersion:1,presetHash:hash(preset),shard:0,shardCount:8,
  scope:'全333の2枚multiset中index%8===0。ドロー後の未知内容は探索対象外。',coverage:'初期合法候補42組と手作業の新規ルート。合法木探索はsearchEvidenceの完了数・未解決数に従う。',searchEvidence,pairs,routes},null,2)+'\n');
 const lines=['# 2枚展開研究 shard 0','',
  '固定40枚から作れる全333の2枚multisetのうち、enumeratePairsのindex % 8 === 0となる42組を担当する。物理的な組合せの重みは合計94。追加ドロー後の未知内容は探索対象に含めない。','',
  `初期合法候補42組と、新規の具体的手順${routes.length}本を実コアで検証・独立再生した。既存templateの適用結果と、今回の新規手順を分けて保存する。`, '',
  searchEvidence?`合法木探索は42組中${searchEvidence.summary.searched}組を実行し、無ドロー対象範囲で完了${searchEvidence.summary.completeWithinNoDrawScope}組、未完了${searchEvidence.summary.incomplete}組、未探索${searchEvidence.summary.unsearched}組。訪問${searchEvidence.summary.visited}、終端経路${searchEvidence.summary.terminalPaths}、未解決frontier ${searchEvidence.summary.unresolved}、ドロー後を除外した境界${searchEvidence.summary.excludedDraw}。`: '共有の全合法木探索はまだ本資料へ統合していない。初期候補を記録しただけで、展開不能や全木完了と判定しない。', '',
  '既存surveyの「未対応」も、不成立の証明として扱わない。探索器はtemplateを適用せず各手札の初期状態から合法候補を列挙する。追加ドローがコアの1応答中に解決される場合、その時点で枝を除外し、結果盤面の採点・保存・後続探索をしない。','',
  '## 新規の具体的な展開','',
  '| 手順 | 初期手札 | 最終盤面 | 手札 | LP | 入力 |','| --- | --- | --- | --- | ---: | ---: |'];
 for(const r of routes)lines.push(`| ${r.id} | ${r.hand.map(c=>cards[c].name).join('＋')} | ${r.expected.monsters.map(c=>cards[c].name).join('＋')}${r.expected.spells?.length?'、セット '+r.expected.spells.map(c=>cards[c].name).join('＋'):''} | ${(r.expected.hand||[]).map(c=>cards[c].name).join('＋')||'0枚'} | ${r.expected.lp} | ${r.steps.length} |`);
 lines.push('','Mag＋Dormouseは、初手Magがあるため既存のDormouse単独手順で「Magをデッキから検索する」箇所がそのまま適用できなかった組合せ。初手Magを手札リンク素材として使い、BackupではRabbitを検索して捨てる新しい順序を実証した。','',
  'Hare＋Rabbitでは初手Hareを特殊召喚し、MTPで追加Rabbitを検索して後続として残す。Wizard＋Soul、Wizard＋Magnaは両方を使う小展開であり、M∀LICEの本線へのアクセスとは分類していない。','',
  'Shifterを使う2本は、開始時のチェーン窓で発動する。CatまたはDotがリンク素材として除外へ行き、除外帰還効果が動くことと、最終墓地がShifterのみであることをassertした。相手ターンの追加処理は記録外。','',
  '## 担当する全42組','',
  '| index | 2枚組 | 旧template | 新規手順 | 訪問 | 未解決 | 探索状態 |','| ---: | --- | --- | ---: | ---: | ---: | --- |');
 for(const p of pairs)lines.push(`| ${p.index} | ${p.names.join('＋')} | ${p.previousTemplateStatus} | ${p.manualRouteIds.length} | ${p.search?.visited??'—'} | ${p.search?.unresolved??'—'} | ${p.searchStatus} |`);
 if(searchEvidence){
  lines.push('','## 残枝と次の再開候補','',
   `未解決の理由: ${Object.entries(searchEvidence.unresolvedByReason).map(([reason,count])=>`${reason} ${count}`).join('、')}。初回は1組100node/3000ms、次の2巡は各300node/5000ms、深さ上限100。残枝数が少ないことは残り計算量が少ない保証にはならない。`, '',
   '| index | 2枚組 | 未解決frontier | 訪問済み |','| ---: | --- | ---: | ---: |');
  for(const p of pairs.filter(p=>p.search?.unresolved>0).sort((a,b)=>a.search.unresolved-b.search.unresolved).slice(0,10))lines.push(`| ${p.index} | ${p.names.join('＋')} | ${p.search.unresolved} | ${p.search.visited} |`);
 }
 lines.push('','## 検証と制約','',
  '`node scripts/research-pair-shard-0.mjs` で全手順と42組の初期候補を再生成・独立再生する。`--only=mag-dorm` などで絞った場合は保存JSONと資料を上書きしない。','',
  '各手順に2枚のhand、実コア入力、直前状態ハッシュ、最終盤面、LP、手札、finalHashを保存。手札はpresetから実際に除く。各入力でコアの拒否がないこと、追加ドローなし、メイン40枚の保存を検査し、新規コアで同じ入力を再生する。','',
  'Accordの蘇生体数を無効回数と数えない。I:P等の相手ターン展開、他の手札3枚が加わった実戦への自動入力適用、対妨害分岐、最善性は本手順の単独検証範囲外。','',
  '探索の再開は `node scripts/search-multi-pairs.mjs --shard 0 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1`。旧source版の途中証拠はruntime/multi-pairs/shard-0に分離保存し、再利用しない。追跡JSONには現行summary・best-routes・各checkpointのSHA-256を保存する。');
 fs.writeFileSync(new URL('../docs/pair-shard-0.md',import.meta.url),lines.join('\n')+'\n');
}
console.log(`PASS ${routes.length} manual routes and ${pairs.length} opening censuses, independently replayed.`);
