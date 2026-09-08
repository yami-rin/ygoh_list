import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url)),OUT=path.join(ROOT,'runtime/multi-pairs/shard-2');
const TARGET=path.join(ROOT,'routes/pair-shard-2.json');
const C={mag:64865,ash:14558127,dot:18789533,backup:30118811,purulia:84192580,ogre:59438930,wizard:3723262,magna:33854624,shifter:91800273,baldrake:72656408,
  dorm:32061192,hare:20938824,rabbit:69272449,cat:96676583,gold:75500286,mtp:94722358,tb:57111661,gwc:20726052,
  almiraj:60303245,decoder:30342076,ring:24842059,wicked:52698008,ip:65741786,sp:29301450,
  binder:95454996,crypter:21848500,transcode:46947713,accord:39138610};
const args=process.argv.slice(2),trace=args.includes('--trace'),only=args.find(x=>x.startsWith('--only='))?.slice(7);
assert(args.every(x=>x==='--trace'||x==='--inventory-only'||x.startsWith('--only=')));
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const sort=list=>[...list].sort((a,b)=>a-b);
const census=enumeratePairs(preset.main).map((p,index)=>({...p,index})).filter(p=>p.index%8===2);
assert.equal(census.length,42);
const survey=JSON.parse(fs.readFileSync(path.join(ROOT,'routes/multi-opening-survey.json')));
const compact=g=>({type:g.prompt.type,title:g.prompt.title,choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response})),cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place}))});
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(safe(value),null,2)+'\n');fs.renameSync(temp,file);}
function noSetupEffects(g){
  for(let n=0;n<20&&g.prompt.type!=='SELECT_IDLECMD';n++){
    assert.equal(g.prompt.type,'SELECT_CHAIN','Unexpected initial effect prompt');
    const choice=g.prompt.choices.find(c=>c.response.index===null);assert(choice);respond(g,{action:choice.id});
  }
  assert.equal(g.prompt.type,'SELECT_IDLECMD');
}
function settle(g,{picks=[],materials=[],places=[],decline=[]}={}){
  picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];
  for(let n=0;n<100;n++){
    const p=g.prompt;if(trace)console.log(JSON.stringify(compact(g)));
    assert(!g.log.some(x=>x.text.includes('枚ドロー')),'This shard cannot enter a random draw outcome');
    if(p.type==='SELECT_IDLECMD'){assert.equal(picks.length,0,'Unused target choices');assert.equal(materials.length,0,'Unused materials');assert.equal(places.length,0,'Unused places');return;}
    if(p.type==='SELECT_CHAIN'){
      const choice=p.choices.find(c=>c.card&&([C.mag,C.dot,C.wicked,C.backup,C.dorm,C.rabbit,C.cat,C.binder,C.decoder,C.accord].includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>c.response.index===null);
      assert(choice,'No deliberate chain decision');respond(g,{action:choice.id});
    }else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO'){
      const desc=BigInt(g.pending.description??0),code=Number(desc>>20n),index=Number(desc&0xfffffn);
      const draw=p.type==='SELECT_YESNO'&&((code===C.cat&&index===2)||(code===C.binder&&index===3)||/ドロー/.test(p.title));
      const yes=!draw&&!decline.includes(g.pending.code??code);select(g,c=>c.response.yes===yes);
    }else if(p.type==='SELECT_PLACE'){
      const sequence=places.shift(),i=sequence===undefined?0:p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===sequence);assert(i>=0,`No place ${sequence}`);respond(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
    else if(p.type==='SELECT_CARD'){
      let wanted=picks.shift();if(!wanted&&p.min===p.max&&p.cards.length===p.min)wanted=p.cards.map(c=>c.code);
      assert(wanted,`Target required: ${JSON.stringify(compact(g))}`);const selection=[];
      for(const code of wanted){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing target ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}respond(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD'){
      const code=materials.shift(),choice=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
      assert(choice,`Missing material ${code}: ${JSON.stringify(compact(g))}`);respond(g,{action:choice.id});
    }else assert.fail(`Unsupported planned prompt ${JSON.stringify(compact(g))}`);
  }
  assert.fail('Plan did not settle');
}
function action(g,type,code,options){if(trace)console.log('ACTION',type,code,cards[code]?.name);const choice=g.prompt.choices.find(c=>c.response.action===type&&c.card?.code===code);assert(choice,`Action ${type}/${code} absent in ${g.prompt.type}`);respond(g,{action:choice.id});settle(g,options);}
const normal=(g,c,o)=>action(g,0,c,o),activate=(g,c,o)=>action(g,5,c,o),link=(g,c,materials,o={})=>action(g,1,c,{materials,...o});
const zones=(g,z)=>board(g).players[0][z].filter(Boolean).map(c=>c.code);
function check(g,{monsters,hand=[],spells=[],lp=8000}){
  assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.turn,1);assert.equal(g.turnPlayer,0);
  assert.equal(g.lp[0],lp);assert(!g.log.some(x=>x.text.includes('枚ドロー')));
  assert.deepEqual(sort(zones(g,'monsters')),sort(monsters));assert.deepEqual(sort(zones(g,'hand')),sort(hand));assert.deepEqual(sort(zones(g,'spells')),sort(spells));
  const all=[...g.lib.duelQueryLocation(g.handle,{controller:0,location:1,flags:1}).map(c=>c.code)];
  for(const z of ['hand','monsters','spells','grave','banished'])all.push(...zones(g,z).filter(c=>!preset.extra.includes(c)));
  assert.deepEqual(sort(all),sort(preset.main),'Every physical main-deck card must be conserved');
}

const previous=only&&fs.existsSync(TARGET)?JSON.parse(fs.readFileSync(TARGET)):null;
const report={schemaVersion:1,presetHash:hash(preset),shard:2,shards:8,scope:'Fixed preset, exact two-card hand, own first turn, no opponent interference. Every random draw outcome is excluded.',
  generatedAt:new Date().toISOString(),pairs:[],routes:previous?.routes??[],failures:[],searchStatus:'shared-runner-pending'};
for(const pair of census){
  const known=survey.pairs.find(p=>p.id===pair.id),g=await startRoute(pair.hand);
  try{
    const initial=compact(g);noSetupEffects(g);assert.equal(g.snapshot().players[0].deckCount,38);
    const r=finishRoute(g,{id:`pair-shard-2-census-${pair.id}`});await replay(r);
    report.pairs.push({...pair,names:pair.hand.map(c=>cards[c].name),surveyStatus:known?.status??'missing',knownBest:known?.best??null,
      priorFailures:known?.failures??[],priorUnsupportedReason:known?.unsupportedReason??null,initial,mainPrompt:compact(g),
      classification:'no-targeted-line-yet',censusVerified:true,newRouteIds:[]});
  }finally{g.close();}
}
write(path.join(OUT,'inventory.json'),report.pairs);
async function addRoute(id,hand,summary,execute,expected,{classification='true-two-card-line',roles=[],limitations=[]}={}){
  if(args.includes('--inventory-only')||(only&&!id.includes(only)))return;
  const pairId=sort(hand).join('-');assert(census.some(p=>p.id===pairId),'Route belongs to a different shard');
  const g=await startRoute(sort(hand));
  try{
    noSetupEffects(g);await execute(g);check(g,expected);
    const route=finishRoute(g,{id:`pair-shard-2-${id}`,pairId,pairIndex:census.find(p=>p.id===pairId).index,starter:sort(hand)[0],requiredHand:sort(hand),
      source:'multi-pair-manual-real-core',endpoint:'firstTurnMain1',classification,summary,requiresDraw:false,drawDependent:false,roles,
      expected,conditions:['Exact two-card fixture; remaining main deck is 38 cards.','Own first turn, no interference, no random draws.','Optional Cat/Binder draws are declined.'],
      limitations:['Targeted successful line only; not all legal moves or an optimal endpoint proof.',...limitations]});
    await replay(route);report.routes=report.routes.filter(r=>r.id!==route.id);report.routes.push(route);
    write(path.join(OUT,`${route.id}.json`),route);console.log(`PASS ${route.id}: ${route.steps.length} inputs, LP${g.lp[0]}`);
  }catch(error){report.failures.push({id,pairId,message:error.message,prompt:g.prompt?safe(compact(g)):null,prefix:safe(g.route.steps)});console.log(`FAIL ${id}: ${error.message}`);}
  finally{g.close();}
}

for(const endpoint of ['ip','accord'])await addRoute(`mag-ash-${endpoint}`,[C.mag,C.ash],
  'Ashを通常召喚してAlmirajへ変え、手札MagとWicked。Dot送墓・帰還でWickedを誘発、Almirajを除外してBackupを検索し特殊召喚する。',g=>{
    normal(g,C.ash);link(g,C.almiraj,[C.ash],{places:[5]});
    link(g,C.wicked,[C.almiraj,C.mag],{picks:[C.dot,C.almiraj,C.backup],places:[5,1]});
    activate(g,C.backup,{decline:[C.backup]});
    if(endpoint==='ip')link(g,C.ip,[C.dot,C.backup],{places:[1]});
    else{link(g,C.transcode,[C.wicked,C.dot],{places:[5]});activate(g,C.transcode,{picks:[C.wicked],places:[1]});link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,1]});}
  },{monsters:endpoint==='ip'?[C.wicked,C.ip]:[C.accord,C.transcode]},
  {roles:['AshがAlmirajの通常召喚素材を用意する。','Magは手札L素材とDot墓地送りに使う。'],limitations:['M∀LICEにアクセスしたとは分類しない。','Mag適用後はサイバース族の特殊召喚のみ。']});

await addRoute('backup-dot-crypter-binder-ring',[C.backup,C.dot],
  'BackupでMagを検索しDotを捨てて蘇生。MagからDormouseを墓地へ送り、既に蘇生したDotをWickedリンク先のRingへ変えてWickedを誘発する。',g=>{
    normal(g,C.backup,{picks:[C.mag,C.dot],places:[0,1]});
    link(g,C.decoder,[C.backup],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dorm],places:[5]});
    link(g,C.ring,[C.dot],{picks:[C.dorm,C.backup],places:[1,0]});
    activate(g,C.backup,{places:[2]});activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[3]});
    link(g,C.binder,[C.wicked,C.dorm],{decline:[C.binder],places:[5]});activate(g,C.binder,{picks:[C.gwc]});
    activate(g,C.mtp,{picks:[C.binder,C.hare,C.mag],places:[4]});activate(g,C.hare,{picks:[C.mtp],places:[0]});
    link(g,C.crypter,[C.backup,C.rabbit,C.hare],{places:[6]});
  },{monsters:[C.crypter,C.binder,C.ring],spells:[C.gwc],lp:6500},
  {roles:['Dotは最初の捨て札・蘇生・Ring素材として使用。','BackupはMagの検索と手札を捨てる効果を使用。'],limitations:['Dotは既に蘇生済みなので、Magで再度Dotを墓地へ送る既知templateを流用しない。']});

await addRoute('dorm-hare-crypter-binder-gwc-two-followups',[C.dorm,C.hare],
  '初手Hareで墓地Dormouseを除外・帰還し、WickedからBackupへ接続。MTPを温存してからBinderをメインゾーンへ帰還させ、Catを後続として検索する。',g=>{
    normal(g,C.dorm,{places:[0]});activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[1]});
    link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
    activate(g,C.hare,{picks:[C.dorm,C.rabbit,C.backup],places:[1,0]});
    activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[2,3]});
    link(g,C.binder,[C.wicked,C.hare],{picks:[C.hare,C.rabbit],places:[5]});activate(g,C.binder,{picks:[C.gwc]});
    activate(g,C.mtp,{picks:[C.binder,C.cat],places:[4]});
    link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});
  },{monsters:[C.crypter,C.binder],hand:[C.rabbit,C.cat],spells:[C.gwc],lp:6200},
  {roles:['DormouseがRabbitとMTPを用意。','手札Hareを使ってMTPを残しながらDormouseを帰還させる。']});

await addRoute('backup-purulia-accord-transcode',[C.backup,C.purulia],
  'BackupでMagを検索しPuruliaを捨てる。MagでDotを墓地へ送り、Wickedの検索から2枚目Backupを特殊召喚しAccordへ進む。',g=>{
    normal(g,C.backup,{picks:[C.mag,C.purulia],places:[0]});
    link(g,C.decoder,[C.backup],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.backup,C.backup],places:[5,1]});
    activate(g,C.backup,{places:[2]});
    link(g,C.transcode,[C.wicked,C.dot],{places:[5]});
    activate(g,C.transcode,{picks:[C.wicked],places:[1]});
    link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,1]});
  },{monsters:[C.accord,C.transcode]},
  {roles:['Backupの検索後の捨て札に初手Puruliaを使う。'],limitations:['Purulia固有効果を利用する線ではなく、手札コストを満たす2枚初動。','M∀LICEにはアクセスしていない。']});

await addRoute('wizard-dot-wicked-small',[C.wizard,C.dot],
  'DotからDecoderを経てWickedを作る。Wizardの効果でLinkモンスターを守備表示蘇生することはできず、この盤面からWizardは発動できない。',g=>{
    normal(g,C.dot,{places:[0]});
    link(g,C.decoder,[C.dot],{places:[5,1]});
    link(g,C.wicked,[C.decoder,C.dot],{places:[5]});
    assert(!g.prompt.choices.some(c=>c.card?.code===C.wizard&&c.response.action===5),'Wizard cannot revive a Link monster in Defense Position');
  },{monsters:[C.wicked],hand:[C.wizard]},
  {classification:'small-one-card-line-partner-retained',roles:['Dotのみを使用。Wizardは手札に保持。'],limitations:['Wizardを展開に利用できた2枚初動とは分類しない。','特定のWicked盤面でWizardの発動不可を確認したもの。全ての進行が不可能という証明ではない。']});

await addRoute('shifter-magna-small',[C.shifter,C.magna],
  '墓地が空の状態でShifterを発動し、コストで墓地へ送ったShifterをMagnamhutで除外して特殊召喚する。',g=>{
    activate(g,C.shifter);
    activate(g,C.magna,{picks:[C.shifter],places:[0]});
  },{monsters:[C.magna]},
  {classification:'small-two-card-interaction',roles:['Shifterが墓地の闇属性対象を用意し、Magnamhutの特殊召喚条件を満たす。'],limitations:['M∀LICEへのアクセスもLink展開もない。','Main1の盤面まで保存。Magnamhutのエンドフェイズ検索の選択と処理はこの保存線に含めない。']});

await addRoute('gold-mtp-accord-transcode-hare',[C.gold,C.mtp],
  'GoldからDormouse・Rabbitを帰還させてTBをセット。初手MTPとTBでCatの帰還とHareの検索を行い、WickedとBackupへ接続する。',g=>{
    activate(g,C.gold,{picks:[C.dorm],places:[0]});
    activate(g,C.dorm,{picks:[C.rabbit,C.tb],places:[1]});
    action(g,4,C.mtp);
    activate(g,C.tb,{picks:[C.dorm,C.cat],places:[2]});
    activate(g,C.mtp,{picks:[C.cat,C.hare],places:[3]});
    link(g,C.decoder,[C.rabbit],{places:[5]});
    link(g,C.wicked,[C.decoder,C.cat],{places:[5]});
    activate(g,C.hare,{picks:[C.cat,C.rabbit,C.backup],places:[2]});
    activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[0,3]});
    link(g,C.transcode,[C.wicked,C.dot],{places:[5]});
    activate(g,C.transcode,{picks:[C.wicked],places:[1]});
    link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,1]});
  },{monsters:[C.accord,C.transcode,C.hare],lp:7100},
  {roles:['GoldがDormouse・RabbitとTBを用意。','初手MTPをセットしてCatの帰還とHareの検索に使用。'],limitations:['主流のGold単独線がデッキのMTP検索で失敗する初手を、TBと初手MTPの使用で処理した線。']});

await addRoute('dot-baldrake-sp',[C.dot,C.baldrake],
  'Dotの墓地蘇生を使ってDecoderとDotでS:Pを作り、墓地DecoderをBaldrakeの特殊召喚に利用する。',g=>{
    normal(g,C.dot,{places:[0]});
    link(g,C.decoder,[C.dot],{places:[5,1]});
    link(g,C.sp,[C.decoder,C.dot],{decline:[C.sp],places:[5]});
    activate(g,C.baldrake,{picks:[C.decoder],places:[0]});
  },{monsters:[C.sp,C.baldrake]},
  {roles:['Dotから闇属性Linkの墓地対象を作り、初手Baldrakeを特殊召喚。'],limitations:['S:Pのリンク召喚時除外は使わない。','M∀LICEへのアクセスはない。']});

for(const pair of report.pairs){
  const found=report.routes.filter(r=>r.pairId===pair.id);pair.newRouteIds=found.map(r=>r.id);
  if(found.length)pair.classification=found.some(r=>r.classification==='true-two-card-line')?'verified-two-card-line':'verified-small-line';
}
report.summary={pairs:report.pairs.length,priorUnsupported:report.pairs.filter(p=>p.surveyStatus==='unsupported').length,
  newRoutes:report.routes.length,newPairs:report.pairs.filter(p=>p.newRouteIds.length).length,failures:report.failures.length,withoutManualLine:report.pairs.filter(p=>!p.newRouteIds.length).length,
  fullLegalTreeComplete:false};
const treeFile=path.join(ROOT,'runtime/multi-pair-search/shard-2/summary.json');
if(fs.existsSync(treeFile)){
  const tree=JSON.parse(fs.readFileSync(treeFile));assert.equal(tree.shard,2);assert.equal(tree.presetHash,hash(preset));
  report.treeSearch={summaryFile:'runtime/multi-pair-search/shard-2/summary.json',sourceHash:tree.sourceHash,scope:tree.scope,summary:tree.summary,observedAt:tree.updatedAt};
  for(const pair of report.pairs){const result=tree.pairs.find(p=>p.id===pair.id);assert(result);pair.treeSearch=result;}
  report.searchStatus=tree.summary.unsearched?'some-roots-unsearched':tree.summary.incomplete?'all-roots-started-incomplete':'complete-within-no-draw-scope';
  report.summary.unsearchedPairs=tree.summary.unsearched;
  report.summary.completeWithinNoDrawScope=tree.summary.completeWithinNoDrawScope;
}
write(TARGET,report);
const cardNames=codes=>codes.length?codes.map(code=>cards[code].name).join('、'):'なし';
const lines=[
  '# 2枚初動の実展開調査 — shard 2','',
  '`enumeratePairs(preset.main)` の index % 8 === 2 を担当。固定40枚の333種類中42組。手札は指定の2枚だけ、残りは38枚、先攻第1ターン・相手干渉なしで検証する。',
  '',
  '**未確定ドローの後続は対象外。** 手動線ではCat/Binderの任意ドローを選ばず、全保存線にドローログがないことをassertする。共有探索は最初のDRAWを検出した時点で打ち切り、ドロー後に入力・採点・ルート出力をしない。先攻通常ドローのないfixtureであり、手札5枚全体の初動率や対戦勝率を示すものではない。',
  '',
  '## 検証済みの手動線','',
  `実coreで${report.routes.length}線を作成し、入力前状態hash・入力ラベル・終状態hashを照合する独立replayで全件検証した。42組の初期Main1入力候補も独立replay済み。盤面・手札・セット札・LP・物理カード40枚の保存をassertする。`,
  '',
  '| 初手 | 終盤面 / 手札 / セット | LP | 入力数 | 分類 |','|---|---|---:|---:|---|',
  ...report.routes.map(r=>`| ${cardNames(r.hand)} | 盤面: ${cardNames(r.expected.monsters)} / 手札: ${cardNames(r.expected.hand??[])} / セット: ${cardNames(r.expected.spells??[])} | ${r.expected.lp??8000} | ${r.steps.length} | ${r.classification} |`),
  '',
  '`true-two-card-line` は実際に初手2枚を使用した成功線。Backup＋PuruliaはPurulia固有効果を使わず、検索後の捨て札を満たす手札コスト型。`small-two-card-interaction` はShifterのコストで生じた墓地の闇属性をMagnamhutに使用する小展開。`small-one-card-line-partner-retained` はDotだけを使いWizardを手札に残す線であり、Wizardを展開札として使えた2枚初動ではない。',
  '',
  '確認できた制約と修正点:',
  '',
  '- Backup＋Dot: Dotの蘇生は最初の捨て札で既に使用する。MagはDormouseを墓地へ送り、DotをWickedのリンク先のRingへ変える召喚でWickedを誘発させる。',
  '- Dormouse＋Hare: 初手Hareを使用し、後半のMTPでBinderをメインモンスターゾーンへ帰還させる。BinderをEXゾーンに残したままのCrypter併置を前提にしない。',
  '- Gold＋MTP: MTPが初手にあるのでRabbitのデッキセット対象はTB。初手MTPを実際にセットして使用する。Hareを置く場所はTranscodeの蘇生先と重ならないよう指定する。',
  '- Wizard＋Dot: Decoderが墓地に存在してもWizardの守備表示蘇生の対象にできず、実coreの発動候補もない。保存線のWicked盤面での確認であり、この2枚の全進行不能を示す証明ではない。',
  '- Magnamhut＋Shifter: Shifterの発動コストでShifter自身は墓地へ送られ、Magnamhutの対象にできる。保存線はMain1まで。Magnamhutのエンドフェイズ検索の処理はその線に含まない。',
  '',
  '## 合法入力探索の範囲と現状','',
  report.treeSearch?`共有runnerの最新取込: ${report.treeSearch.observedAt}。42組中${report.treeSearch.summary.searched}組着手、scope内完了${report.treeSearch.summary.completeWithinNoDrawScope}組、未完${report.treeSearch.summary.incomplete}組、未着手${report.treeSearch.summary.unsearched}組。${report.treeSearch.summary.visited} nodes / ${report.treeSearch.summary.terminalPaths} terminal / ${report.treeSearch.summary.unresolved} unresolved frontier / ${report.treeSearch.summary.excludedDraw}対象外ドロー境界。`:'共有runnerはまだ開始していない。',
  '',
  '完全な合法手探索や全ゲームパターンの完了は主張しない。手動線は成功例であり最適盤面の証明ではない。共有runnerのbestは訪問済みMain1盤面の独自評価値であり勝率ではない。残件はcheckpoint内の入力prefixと候補cursorを保持し、次の巡回で再開する。未着手と探索未完と実際の小展開を区別する。',
  '',
  '共有探索の正本: `runtime/multi-pair-search/shard-2/{summary.json,best-routes.json,pair-*.checkpoint.json}`。最初の巡回の旧保存先 `runtime/multi-pairs/shard-2/search-v1/` は履歴用で、追加探索や集計の正本には使わない。手動の入力列と失敗分析は `routes/pair-shard-2.json` と `runtime/multi-pairs/shard-2/` に保存。',
  '',
  '## 担当42組の一覧','',
  '事前surveyのsupportedは既知テンプレートの適用成功を意味し、2枚相互作用や十分な展開の証明ではない。未対応理由・既知template失敗はJSONに原文を保持する。',
  '',
  '| index | 2枚 | 事前survey | 手動線 | 合法入力探索 |','|---:|---|---|---:|---|',
  ...report.pairs.map(p=>`| ${p.index} | ${p.names.join(' ＋ ')} | ${p.surveyStatus} | ${p.newRouteIds.length} | ${p.treeSearch?.status??'unsearched'} |`),
  '',
  '## 再現','',
  '```powershell','node scripts/research-pair-shard-2.mjs',
  'node scripts/search-multi-pairs.mjs --shard 2 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1','```','',
  '共有runnerはsource/preset/pair順序/seed一致時のみ既存checkpointを再開する。`research-pair-shard-2.mjs` は共有探索を開始せず、手動全線を再検証し、その時点のsummaryを取り込む。',
];
fs.writeFileSync(path.join(ROOT,'docs/pair-shard-2.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({status:report.failures.length?'PARTIAL':'PASS',...report.summary}));
if(report.failures.length)process.exitCode=1;
