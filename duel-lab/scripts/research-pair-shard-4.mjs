import fs from 'node:fs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const C={rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,tb:57111661,mtp:94722358,gwc:20726052,
 decoder:30342076,wicked:52698008,sp:29301450,ip:65741786,wp:4993187,binder:95454996,crypter:21848500,
 backup:30118811,mag:64865,dot:18789533,wizard:3723262,transcode:46947713,firewall:5043010,accord:39138610,
 ring:24842059,almiraj:60303245,soul:74652966,access:86066372,gold:75500286,ug:68337209,terra:73628505,ogre:59438930,purulia:84192580,magna:33854624,baldrake:72656408,allure:1475311};
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
   const isMtpOptional=(desc>>20n)===BigInt(C.mtp)&&(desc&0xfffffn)===2n;
   yes(g,!isCatDraw&&!isMtpOptional&&!/ドロー/.test(p.title));
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
const routes=[],probes=[];
const pairs=enumeratePairs(preset.main).map((p,index)=>({...p,index,names:p.hand.map(c=>cards[c].name)})).filter(p=>p.index%8===4);
assert.equal(pairs.length,42);
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
async function route(id,hand,summary,execute,expected,classification='two-card-line') {
 if(only&&!id.includes(only))return;
 const pair=pairs.find(p=>p.id===[...hand].sort((a,b)=>a-b).join('-'));assert(pair,'Assigned shard pair only');
 const g=await startRoute(hand);
 try {
  settle(g);execute(g);check(g,expected);
  const r=finishRoute(g,{id:`pair-shard-4-${id}`,pairId:pair.id,pairIndex:pair.index,starter:hand[0],name:hand.map(c=>cards[c].name).join('＋'),summary,classification,
   requiresDraw:false,conditions:['固定40枚presetから初手2枚の実カードを除く','先攻・相手空盤面・無妨害','通常召喚権および名称ターン1は未使用','必要なデッキ/EXの展開先が残る','追加ドローを一切使わない'],expected,
   limitations:['具体的な到達点の実証であり全合法手順の完了・最善性は主張しない','相手ターンの効果処理は別検証']});
  await replay(r);routes.push(r);console.log(`PASS ${id}: ${r.steps.length} inputs LP ${g.lp[0]}`);
 } finally {g.close();}
}

for(const normalCard of [C.ogre,C.purulia])await route(`mag-${normalCard}-accord`,[C.mag,normalCard],
 '通常召喚した低攻撃力モンスターをAlmiraj→手札MagとWicked→Dot墓地送り/帰還→WickedでAlmiraj除外しBackup検索→TranscodeでWicked蘇生→Accord＋Transcode。通常召喚札はサイバース族でなくてもAlmirajに変換できる。',g=>{
  normal(g,normalCard);link(g,C.almiraj,[normalCard],{places:[5]});
  link(g,C.wicked,[C.almiraj,C.mag],{picks:[C.dot,C.almiraj,C.backup],places:[5,1]});
  activate(g,C.backup,{decline:[C.backup]});
  link(g,C.transcode,[C.wicked,C.dot],{places:[5]});activate(g,C.transcode,{picks:[C.wicked]});
  link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,1]});
 },{monsters:[C.accord,C.transcode],lp:8000});

await route('wizard-hare-crypter-binder',[C.wizard,C.hare],
 'Hare通常召喚→Decoder→WizardでHare蘇生→Binder/Decoder帰還→Hareを除外し自身を手札回収→TBでRabbit/Binder帰還→HareがTBを除外してSS→Crypter＋Binder。Hare単独では得られないM∀LICE展開。',g=>{
  normal(g,C.hare);link(g,C.decoder,[C.hare],{places:[5]});activate(g,C.wizard,{picks:[C.hare]});
  link(g,C.binder,[C.decoder,C.wizard,C.hare],{picks:[C.hare,C.hare],places:[5,1]});
  activate(g,C.binder,{picks:[C.tb]});activate(g,C.tb,{picks:[C.binder,C.rabbit],places:[0,4]});
  activate(g,C.hare,{picks:[C.tb],places:[2]});
  link(g,C.crypter,[C.decoder,C.rabbit,C.hare],{places:[6]});
 },{monsters:[C.crypter,C.binder],lp:6800});

await route('dot-magna-sp',[C.dot,C.magna],
 'Dot→Ring/Dot帰還→S:P（①辞退）→墓地の闇属性RingをMagnaで除外してSS。S:P＋MagnaによりDotだけの小展開より1体増える。Magnaのエンド検索はこのMain1停止点では未実行。',g=>{
  normal(g,C.dot);link(g,C.ring,[C.dot],{places:[5]});
  link(g,C.sp,[C.ring,C.dot],{decline:[C.sp],places:[5]});activate(g,C.magna,{picks:[C.ring],places:[1]});
 },{monsters:[C.sp,C.magna],lp:8000},'limited-two-card-line');

function rabbitBase(g) {
 normal(g,C.rabbit,{picks:[C.tb]});activate(g,C.tb,{picks:[C.rabbit,C.dorm]});
 link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.dorm],places:[5,1]});
 activate(g,C.dorm,{picks:[C.cat]});
 link(g,C.binder,[C.sp,C.dorm],{picks:[C.tb],places:[5]});
 activate(g,C.binder,{picks:[C.mtp]});activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
 activate(g,C.hare,{picks:[C.mtp]});
}
await route('rabbit-baldrake-crypter-binder',[C.rabbit,C.baldrake],
 'RabbitのTB/Dormouse/S:P/Binder線で墓地Rabbitを残す→MTP/Hare→Baldrakeで墓地Rabbitを除外してSS→Cat/Hare/BaldrakeでCrypter。Binderを素材に消費せずCrypter＋Binderを残す。',g=>{
 rabbitBase(g);activate(g,C.baldrake,{picks:[C.rabbit]});link(g,C.crypter,[C.cat,C.hare,C.baldrake],{places:[6]});
 },{monsters:[C.crypter,C.binder],lp:6200});

await route('rabbit-mtp-crypter-binder',[C.rabbit,C.mtp],
 '初手MTPをセットし、RabbitのTB/Dormouse/S:P/Binder線からBinderはGWCを用意する。MTP/HareでCrypterへ→GWCでCrypterを除外しBinderを蘇生・2300回復→Crypterが900LPで帰還し、このMain1ではDormouseの加算込み攻撃力5600。Crypter＋Binderを維持する。',g=>{
  action(g,4,C.mtp);normal(g,C.rabbit,{picks:[C.tb]});activate(g,C.tb,{picks:[C.rabbit,C.dorm]});
  link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.dorm],places:[5,1]});
  activate(g,C.dorm,{picks:[C.cat]});link(g,C.binder,[C.sp,C.dorm],{picks:[[C.rabbit,C.tb]],places:[5]});
  activate(g,C.binder,{picks:[C.gwc]});activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});activate(g,C.hare,{picks:[C.mtp]});
  link(g,C.crypter,[C.binder,C.cat,C.hare],{places:[6]});
  activate(g,C.gwc,{picks:[C.crypter,C.binder],places:[4,2]});
  assert.equal(g.snapshot().players[0].monsters[2].attack,5600);
 },{monsters:[C.crypter,C.binder],lp:7600});

for(const ipEnd of [false,true])await route(`rabbit-backup-crypter-binder-${ipEnd?'ip':'cat-hare'}`,[C.rabbit,C.backup],
 `Backupを通常召喚しMag検索・Rabbitを捨てる→Decoder/手札Mag/Wicked→DotとRabbit帰還、Backup検索→RabbitがTB、BinderがMTPをセット。TBでDormouseを出しMTPで除外帰還して効果制限を外す→Cat/Hareを追加し${ipEnd?'I:Pへ変換。Crypter＋Binder＋I:P':'Crypter＋Binder＋Cat＋Hare'}。`,g=>{
  normal(g,C.backup,{picks:[C.mag,C.rabbit]});link(g,C.decoder,[C.backup],{places:[5]});
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.rabbit,C.backup,C.tb],places:[5,1,2]});activate(g,C.backup,{places:[0]});
  link(g,C.binder,[C.wicked,C.rabbit],{picks:[[C.rabbit,C.mag]],places:[5]});activate(g,C.binder,{picks:[C.mtp]});
  activate(g,C.tb,{picks:[C.binder,C.dorm],places:[2,4]});activate(g,C.mtp,{picks:[C.dorm,C.hare],places:[2]});
  activate(g,C.dorm,{picks:[C.cat],places:[3]});link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});
  activate(g,C.hare,{picks:[C.mtp],places:[0]});
  if(ipEnd)link(g,C.ip,[C.cat,C.hare],{places:[2]});
 },{monsters:ipEnd?[C.crypter,C.binder,C.ip]:[C.crypter,C.binder,C.cat,C.hare],lp:6200});

await route('dot-soul-accord-binder',[C.dot,C.soul],
 'Dot→Ring、Dot帰還とSoul特殊召喚→Wicked→DotをDecoderにしてWickedのリンク先召喚を成立。Backup検索でCatを捨て、S:PでCat除外帰還→Binder/MTP/Hare→Accord＋Binder。',g=>{
  normal(g,C.dot);link(g,C.ring,[C.dot],{places:[5]});activate(g,C.soul,{places:[2]});
  link(g,C.wicked,[C.ring,C.soul],{places:[5]});link(g,C.decoder,[C.dot],{picks:[C.soul,C.backup],places:[1]});
  activate(g,C.backup,{picks:[C.cat,C.cat],places:[0]});link(g,C.sp,[C.wicked,C.decoder],{picks:[C.cat],places:[5,1]});
  link(g,C.binder,[C.sp,C.cat],{picks:[C.cat],places:[5]});activate(g,C.binder,{picks:[C.mtp]});
  activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});activate(g,C.hare,{picks:[C.mtp],places:[2]});
  link(g,C.accord,[C.binder,C.backup,C.hare],{picks:[C.binder],places:[5,1]});
 },{monsters:[C.accord,C.binder],lp:6800});

await route('dorm-rabbit-crypter-binder-ring',[C.dorm,C.rabbit],
 'DormouseがCatを除外帰還→Catの手札除外で初手Rabbitを帰還しMTP（ドロー辞退）。Wicked後にHareを出し墓地Dormouseを除外してBackup検索→Binder/GWC→Crypter＋Binder＋Ring、手札Rabbit。',g=>{
  normal(g,C.dorm,{places:[0]});activate(g,C.dorm,{picks:[C.cat],places:[1]});activate(g,C.cat,{picks:[C.rabbit,C.mtp],places:[2]});
  link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.wicked,[C.decoder,C.cat],{places:[5]});
  activate(g,C.mtp,{picks:[C.rabbit,C.hare]});activate(g,C.hare,{picks:[C.mtp,C.dorm,C.backup],places:[1,2]});
  activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[0,3]});
  link(g,C.binder,[C.wicked,C.hare],{picks:[C.hare,C.rabbit],places:[5]});
  activate(g,C.binder,{picks:[C.gwc]});activate(g,C.gwc,{picks:[C.binder,C.cat],places:[1,4]});
  link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});link(g,C.ring,[C.cat],{places:[2]});
 },{monsters:[C.crypter,C.binder,C.ring],hand:[C.rabbit],lp:5900});

await route('gold-hare-crypter-binder-hare',[C.gold,C.hare],
 'GoldでDormouse帰還→Rabbit/MTP。MTPでRabbitを除外しCatを検索して通常召喚→Wicked後に初手Hareを出してCat帰還とBackup検索→Binder/GWCでDormouseを蘇生→Crypter＋Binder＋Hare。',g=>{
  activate(g,C.gold,{picks:[C.dorm],places:[0]});activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[2]});
  activate(g,C.mtp,{picks:[C.rabbit,C.cat]});normal(g,C.cat,{places:[1]});
  link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.wicked,[C.decoder,C.cat],{places:[5]});
  activate(g,C.hare,{picks:[C.mtp,C.cat,C.backup],places:[1,2]});activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[0,3]});
  link(g,C.binder,[C.wicked,C.cat],{picks:[C.dorm],places:[5]});activate(g,C.binder,{picks:[C.gwc]});
  activate(g,C.gwc,{picks:[C.binder,C.dorm],places:[2,4]});link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});
 },{monsters:[C.crypter,C.binder,C.hare],lp:6200});

for(const [summonCode,retained] of [[C.ogre,C.allure],[C.purulia,C.allure],[14558127,23434538],[94145021,14558127],[94145021,C.ogre],[94145021,C.baldrake]])
 await route(`limited-${summonCode}-${retained}-almiraj`,[summonCode,retained],
  '低攻撃力モンスターを通常召喚しAlmirajへ変換する小展開。相方は未使用のまま保持し、2枚専用初動やM∀LICE本線への到達として数えない。Allureを持つ場合も未知ドローは使わない。',g=>{
   normal(g,summonCode);link(g,C.almiraj,[summonCode],{places:[5]});
  },{monsters:[C.almiraj],hand:[retained],lp:8000},'one-card-line-with-inactive-companion');

await route('cat-cat-sp-no-draw',[C.cat,C.cat],
 'Catで初手の別個体Catを除外し、任意2ドローは辞退。300LPでCat帰還→Decoder/S:P。両方の初手を使用するが、同名帰還の名称ターン1を共有しM∀LICE大型盤面にはこの線で届かない。',g=>{
 normal(g,C.cat);activate(g,C.cat,{picks:[C.cat]});link(g,C.decoder,[C.cat],{places:[5]});
 link(g,C.sp,[C.decoder,C.cat],{decline:[C.sp],places:[5]});
 },{monsters:[C.sp],lp:7700},'limited-two-card-line');

if(!only) {
 const g=await startRoute([C.magna,C.baldrake]);
 try {
  settle(g);assert.equal(g.prompt.type,'SELECT_IDLECMD');
  check(g,{monsters:[],hand:[C.magna,C.baldrake],lp:8000});
  assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),'No summon or activated effect from two Bystials and empty graveyards');
  const pair=pairs.find(p=>p.hand.includes(C.magna)&&p.hand.includes(C.baldrake));
  const probe=finishRoute(g,{id:'pair-shard-4-magna-baldrake-empty-board',pairId:pair.id,pairIndex:pair.index,starter:C.magna,
   name:'Magna＋Baldrake、初期盤面の不成立確認',classification:'no-initial-development',requiresDraw:false,
   summary:'双方レベル6でリリースなし。自他墓地が空のため除外対象もなく、初期Main1に通常召喚・特殊召喚・起動効果候補がないことを実coreで確認。',
   conditions:['先攻・両墓地空・初期手札は2体のみ'],limitations:['相手墓地がある後攻や別手札を伴う場面の評価ではない']});
  await replay(probe);probes.push(probe);
 } finally {g.close();}
}

if(!only) {
 const known=JSON.parse(fs.readFileSync(new URL('../routes/multi-opening-survey.json',import.meta.url),'utf8'));
 const searchPath=new URL('../runtime/multi-pair-search/shard-4/summary.json',import.meta.url);
 const searchReport=fs.existsSync(searchPath)?JSON.parse(fs.readFileSync(searchPath,'utf8')):null;
 if(searchReport)assert.equal(searchReport.presetHash,hash(preset));
 const entries=pairs.map(p=>({...p,knownTemplateStatus:known.pairs.find(x=>x.id===p.id)?.status??'unavailable',
  routeIds:routes.filter(r=>r.pairId===p.id).map(r=>r.id),probeIds:probes.filter(r=>r.pairId===p.id).map(r=>r.id),
  manualStatus:routes.some(r=>r.pairId===p.id&&r.classification==='two-card-line')?'verified-two-card-development':routes.some(r=>r.pairId===p.id)?'verified-limited-development':probes.some(r=>r.pairId===p.id)?'verified-initial-non-development':'not-hand-verified',
  searchStatus:searchReport?.pairs.find(x=>x.index===p.index)?.status??'shared-runner-pending',
  search:searchReport?.pairs.find(x=>x.index===p.index)??null}));
 fs.writeFileSync(new URL('../routes/pair-shard-4.json',import.meta.url),JSON.stringify({schemaVersion:1,presetHash:hash(preset),shard:{index:4,count:8,pairs:42},scope:'全333組のindex%8=4。実core展開研究と別保存された共有探索frontierを区別する。',searchEvidence:searchReport?{path:'runtime/multi-pair-search/shard-4/summary.json',sourceHash:searchReport.sourceHash,updatedAt:searchReport.updatedAt,summary:searchReport.summary}:null,pairs:entries,routes,probes},null,2)+'\n');
 const docs=[
  '# 2枚組探索 shard 4', '',
  '固定40枚の333種類の2枚組のうち、`enumeratePairs(preset.main)` の index % 8 = 4 である42組を担当する。各fixtureは初手2枚を実際にデッキから抜く。先攻・空盤面・無妨害で、追加ドローを使わない。', '',
  `手動で指定した展開は${routes.length}本、初期不成立probeは${probes.length}本。全て本物のcoreで入力し、盤面・手札・LP・40枚の保存・ドロー未実行をassertした後、保存入力を独立したDuelで再実行した。全手順木の総当たり・最善性・貫通率は主張しない。`, '',
  'Mag＋うさぎ/プルリアは通常召喚した低攻撃力モンスターをAlmirajへ変換できるため、手札MagとWickedを作れる。従来テンプレート未対応でも不成立とは限らない。逆にAlmirajだけの6本は相方未使用の小展開であり、強い2枚初動として集計しない。', '',
  'Rabbit＋BackupではBackupを通常召喚する。先に手札効果で特殊召喚すると①を使い切り、Wickedで検索した2枚目を同ターンに出せないため、掲載した手順とは別になる。Rabbit＋MTPのCrypterはMain1時点で攻撃力5600（Dormouseの加算を含む）だが、この数値は相手ターンまでの持続を別途検証したものではない。', '',
  '任意ドローの辞退は表示名に依存せずraw descriptionを参照する。CatのStringid(id,2)は任意2ドローで、MTPのStringid(id,2)は任意フィールド除外。ローカルstrings表示とLuaの対応がずれるので、カード表示名だけで選択しない。', '',
  '## 実証ルート', '', '| ID | 分類 | 手札 | 到達盤面 | LP | 入力数 |', '| --- | --- | --- | --- | ---: | ---: |',
  ...routes.map(r=>`| ${r.id} | ${r.classification} | ${r.name} | ${r.expected.monsters.map(c=>cards[c].name).join(' / ')} | ${r.expected.lp} | ${r.steps.length} |`), '',
  '## 全担当組と探索状態', '',
  searchReport?`共有runnerの観測値: ${JSON.stringify(searchReport.summary)}。実探索のfrontier・ドロー境界・最良既知入力は runtime/multi-pair-search/shard-4/ に保存する。`:'共有runner未実行。下表の既知テンプレート対応は全展開探索や強い2枚初動の成立を意味しない。', '',
  '| Index | 2枚組 | 既知テンプレート | 手動判定 | 実探索状態 |', '| ---: | --- | --- | --- | --- |',
  ...entries.map(p=>`| ${p.index} | ${p.names.join('＋')} | ${p.knownTemplateStatus} | ${p.manualStatus} | ${p.searchStatus} |`), '',
  '## 再生成', '',
  '`node scripts/research-pair-shard-4.mjs` で全手動ルートを再検証しJSONとこの文書を更新する。`--only=IDの部分文字列` は限定検証であり保存ファイルを書き換えない。', '',
  '`node scripts/search-multi-pairs.mjs --shard 4 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1` が担当全組への探索スライス。既存checkpointとsourceHashが一致する場合だけresumeする。', ''
 ];
 fs.writeFileSync(new URL('../docs/pair-shard-4.md',import.meta.url),docs.join('\n'));
}
console.log(`PASS shard 4 ${routes.length} new routes, ${probes.length} probes; ${pairs.length} assigned pairs`);
