import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const C={rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,mtp:94722358,gwc:20726052,
  backup:30118811,wizard:3723262,mag:64865,dot:18789533,soul:74652966,ash:14558127,
  decoder:30342076,ring:24842059,wicked:52698008,sp:29301450,ip:65741786,binder:95454996,crypter:21848500,
  transcode:46947713,firewall:5043010,access:86066372,accord:39138610,perfectron:13203964};
const trace=process.argv.includes('--trace');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const outputPath=new URL('../routes/multi-cyberse.json',import.meta.url);
const routes=[];
const compact=g=>({type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place})),choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response}))});
function settle(g,{picks=[],materials=[],places=[],decline=[]}={}) {
  picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];
  for(let n=0;n<100;n++) {
    const p=g.prompt;
    if(p.type==='SELECT_IDLECMD'){assert.equal(picks.length,0,'Unused card selections');assert.equal(materials.length,0,'Unused materials');assert.equal(places.length,0,'Unused placements');return;}
    if(trace)console.log(JSON.stringify(compact(g)));
    if(p.type==='SELECT_CHAIN') {
      const triggers=[C.rabbit,C.cat,C.dorm,C.binder,C.decoder,C.wicked,C.backup,C.mag,C.dot,C.accord,C.access];
      const c=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
      assert(c,JSON.stringify(compact(g)));respond(g,{action:c.id});
    } else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO') {
      const value=p.type==='SELECT_EFFECTYN'?!decline.includes(g.pending.code):!/ドロー/.test(p.title);
      select(g,c=>c.response.yes===value);
    } else if(p.type==='SELECT_PLACE') {
      const seq=places.shift();const i=seq===undefined?0:p.cards.findIndex(c=>c.place.sequence===seq&&c.place.player===0);
      assert(i>=0,`No place ${seq}: ${JSON.stringify(compact(g))}`);respond(g,{selection:[i]});
    } else if(p.type==='SELECT_POSITION') {
      const c=p.choices.find(c=>c.response.position===1)||p.choices[0];respond(g,{action:c.id});
    } else if(p.type==='SELECT_CARD') {
      let want=picks.shift();if(!want&&p.cards.length===p.min&&p.min===p.max)want=p.cards.map(c=>c.code);
      assert(want,`Need selection ${JSON.stringify(compact(g))}`);
      const selection=[];for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}respond(g,{selection});
    } else if(p.type==='SELECT_UNSELECT_CARD') {
      const code=materials.shift();const c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
      assert(c,`Need material ${code}: ${JSON.stringify(compact(g))}`);respond(g,{action:c.id});
    } else assert.fail(`Unexpected ${JSON.stringify(compact(g))}`);
  }assert.fail('Too many prompts');
}
function action(g,type,code,options={}) {if(trace)console.log('ACTION',type,cards[code].name);select(g,c=>c.response.action===type&&c.card?.code===code);settle(g,options);}
const normal=(g,code,options)=>action(g,0,code,options);
const link=(g,code,materials,options={})=>action(g,1,code,{materials,...options});
const activate=(g,code,options)=>action(g,5,code,options);
const own=g=>board(g).players[0];
const sorted=codes=>[...codes].sort((a,b)=>a-b);
function assertEnd(g,{monsters,lp=8000,hand=[]}) {
  const b=board(g),p=b.players[0];assert.equal(b.turn,1);assert.equal(b.phase,'MAIN 1');assert.deepEqual(b.lp,[lp,8000]);
  assert.deepEqual(sorted(p.monsters.filter(Boolean).map(c=>c.code)),sorted(monsters));
  assert.deepEqual(sorted(p.hand.map(c=>c.code)),sorted(hand));
  assert(!g.log.some(e=>e.text.includes('枚ドロー')),'No additional draws');
  assert.equal(g.snapshot().players[0].deckCount+p.hand.length+['monsters','spells','grave','banished'].reduce((n,z)=>n+p[z].filter(c=>c&&!(cards[c.code].type&0x4000000)).length,0),40,'Main deck inventory conserved');
}
async function route(id,hand,summary,execute,{conditions=[],classification='two-card-line',capabilities=[]}={}) {
  if(only&&!id.includes(only))return;
  const g=await startRoute(hand);
  try {
    await execute(g);
    const result=finishRoute(g,{id:`multi-${id}`,starter:hand[0],name:hand.map(c=>cards[c].name).join('＋'),classification,summary,requiresDraw:false,
      conditions:['先攻・相手空盤面・妨害なし','初期手札はhandに記録した2枚のみ。通常召喚権未使用','必要なカードが固定プリセットのデッキ/EXに残る','追加ドローなし。任意ドローはすべて断る',...conditions],capabilities});
    await replay(result);routes.push(result);
    console.log(`PASS ${result.id}: ${result.steps.length} inputs; LP ${result.final.lp[0]}; ${own(g).monsters.filter(Boolean).map(c=>cards[c.code].name).join(' / ')}; hand ${own(g).hand.map(c=>cards[c.code].name).join(' / ')||'0'}`);
  } finally {g.close();}
}

function backupBase(g,discard) {
  normal(g,C.backup,{picks:discard===C.mag?[C.cat,C.cat]:[C.mag,discard]});link(g,C.decoder,[C.backup],{places:[5]});
  const malice=[C.cat,C.mag].includes(discard);
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,malice?C.cat:C.backup,C.backup],places:[5,1]});
  activate(g,C.backup);
}
function magicianBase(g,starter) {
  normal(g,starter);link(g,C.decoder,[starter],{places:[5]});
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,starter,C.backup],places:[5,1]});
  activate(g,C.backup,{decline:[C.backup]});
}
function genericEnd(g,endpoint,{hand=[],lp=8000}={}) {
  if(endpoint==='ip')link(g,C.ip,[C.dot,C.backup]);
  else {
    link(g,C.transcode,[C.wicked,C.dot]);activate(g,C.transcode,{picks:[C.wicked]});
    link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode]});
  }
  assertEnd(g,{monsters:endpoint==='ip'?[C.wicked,C.ip]:[C.accord,C.transcode],hand,lp});
}
function maliceEnd(g,endpoint) {
  link(g,C.binder,[C.wicked,C.cat],{picks:[[C.cat,C.mag]],places:[5]});
  activate(g,C.binder,{picks:[C.mtp]});
  activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
  activate(g,C.hare,{picks:[C.mtp]});
  let monsters;
  if(endpoint==='crypter') {
    link(g,C.crypter,[C.backup,C.dot,C.hare],{places:[6]});monsters=[C.crypter,C.binder];
    assert.equal(own(g).monsters[6].code,C.crypter);assert.equal(own(g).monsters[4].code,C.binder);
    assert(own(g).banished.some(c=>c.code===C.mtp),'Crypter ammunition');
  } else if(endpoint==='ip') {
    link(g,C.ip,[C.backup,C.dot],{places:[5]});monsters=[C.ip,C.binder,C.hare];
  } else {
    link(g,C.transcode,[C.backup,C.dot,C.hare],{places:[5]});
    activate(g,C.transcode,{picks:[C.decoder],places:[1]});
    link(g,C.access,[C.binder,C.decoder],{picks:[C.binder],places:[1,0]});
    link(g,C.accord,[C.transcode,C.access,C.decoder],{picks:[[C.transcode,C.binder,C.access]],places:[5,0,1,2]});
    monsters=[C.accord,C.transcode,C.binder,C.access];
  }
  assertEnd(g,{monsters,lp:6800});
}

for(const endpoint of ['ip','accord'])await route(`backup-discard-${endpoint}`,[C.backup,C.ash],
  `BackupでMagを検索し初手うららを捨てる→Decoder＋手札MagでWicked→Dotを送り蘇生→Wickedで元Backupを除外し2枚目を検索→Backupを特殊召喚→${endpoint==='ip'?'I:P＋Wicked':'Transcode経由Accord＋Transcode'}。`,
  g=>{backupBase(g,C.ash);genericEnd(g,endpoint);},
  {classification:'hand-cost-line',conditions:['捨て札の検証実体は灰流うらら。全ての手札札で同じ結果になるとの検証ではない','Dot①はデュエル中未使用'],capabilities:endpoint==='ip'?['I:P相手ターンL召喚用の盤面。相手ターン手順は未収録']:['Accordの無効は1ターンに1度。Transcodeをリリース可能','Accord蘇生後は同ターン特殊召喚不可']});

for(const endpoint of ['crypter','ip','accord'])for(const origin of ['backup','mag','backup-mag'])await route(`${origin}-cat-${endpoint}`,origin==='backup-mag'?[C.backup,C.mag]:[origin==='backup'?C.backup:C.mag,C.cat],
  `${origin==='backup'?'BackupでCatを捨てMagを保持':origin==='backup-mag'?'BackupでCatを検索してそのまま捨て、初手Magを保持':'Catを召喚してDecoderに変換'}→Decoder＋手札MagでWicked→Dot→WickedでCatを除外してBackupを検索→Cat帰還・Backup特殊召喚→Binder（墓地CatとMagを除外）→MTPでBinderを除外しHare検索→Binder帰還（ドローを断る）→Hareで墓地MTP除外→${endpoint}。`,
  g=>{if(origin==='backup'||origin==='backup-mag')backupBase(g,origin==='backup-mag'?C.mag:C.cat);else magicianBase(g,C.cat);maliceEnd(g,endpoint);},
  {conditions:['Catは自己特殊召喚する除外誘発を使う。Hareに置き換えて同じ展開とはならない','Dot①はデュエル中未使用',...(origin==='mag'?['Backup特殊召喚時の検索・捨て札効果はこの記録では断る']:[])],capabilities:endpoint==='crypter'?['Crypterは右EX、Binderは右端メイン。Crypterのリンク先を埋め、除外MTPを①の資源として残す']:endpoint==='ip'?['I:P＋Hareから相手ターンL召喚可能な素材盤面。相手ターン手順は未収録']:['Accord＋蘇生3体。Accord無効は1ターンに1度であり3妨害と数えない','Accord蘇生後は同ターン特殊召喚不可']});

for(const [key,starter] of [['wizard',C.wizard],['soul',C.soul]])for(const endpoint of ['ip','accord'])await route(`mag-${key}-${endpoint}`,[C.mag,starter],
  `${cards[starter].name}を召喚しDecoder→手札MagとWicked→Dot墓地送り・蘇生→Wickedで最初の召喚札を除外しBackup検索→Backup特殊召喚→${endpoint}。`,
  g=>{magicianBase(g,starter);genericEnd(g,endpoint);},
  {conditions:['Dot①はデュエル中未使用','Backup特殊召喚時の検索・捨て札効果を断る','WizardまたはSoulは最初の通常召喚素材。自身の手札特殊召喚効果を使う展開ではない'],capabilities:endpoint==='ip'?['I:P＋Wickedを残す']:['Accordの無効は1ターンに1度。Transcodeがコスト候補']});

for(const endpoint of ['transcode-wicked','firewall-decoder'])await route(`mag-dot-${endpoint}`,[C.mag,C.dot],
  `Dot→Decoder・Dot帰還→手札MagとWicked、MagでSoulを墓地へ→WickedとDotでTranscode→${endpoint==='transcode-wicked'?'Wicked蘇生':'Decoder蘇生→Firewall・Decoder帰還'}。`,
  g=>{
    normal(g,C.dot);link(g,C.decoder,[C.dot],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.soul],places:[5]});
    assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.wicked),'Existing Dot does not trigger Wicked');
    link(g,C.transcode,[C.wicked,C.dot],{places:[5]});
    if(endpoint==='transcode-wicked')activate(g,C.transcode,{picks:[C.wicked],places:[1]});
    else {activate(g,C.transcode,{picks:[C.decoder],places:[1]});link(g,C.firewall,[C.transcode,C.decoder],{places:[5,1]});}
    assert(own(g).grave.some(c=>c.code===C.soul));
    assertEnd(g,{monsters:endpoint==='transcode-wicked'?[C.transcode,C.wicked]:[C.firewall,C.decoder]});
  },{conditions:['Dot①はデュエル中未使用','Wickedを出す前にDotは蘇生済み。Wickedの検索が誘発したとは扱わない'],capabilities:['墓地Soulの相手メイン効果と場のリンク素材を残す。相手ターンPerfectron等へのL召喚手順は未検証']});

await route('dot-hare-no-malice-access',[C.dot,C.hare],
  'Dot→Decoder・Dot帰還→S:P。Hareは手札に残る。Hare以外のM∀LICEを手札/墓地に用意できず、Hare①を使えない負例。',
  g=>{
    normal(g,C.dot);link(g,C.decoder,[C.dot],{places:[5]});
    assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.hare));
    link(g,C.sp,[C.decoder,C.dot],{decline:[C.sp],places:[5]});
    assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.hare));
    assertEnd(g,{monsters:[C.sp],hand:[C.hare]});
  },{classification:'limited-two-card-line',conditions:['Dotの墓地帰還を使用済み。同ターンに除外帰還を重ねられない'],capabilities:['Hareとの相乗効果を伴わないDotの小展開。M∀LICE本線への2枚初動には数えない']});

for(const endpoint of ['ip','accord'])await route(`backup-hare-${endpoint}`,[C.backup,C.hare],
  'BackupでMag検索・Hareを捨てる→Decoderと手札MagでWicked→Dotを墓地へ送り蘇生→WickedでHareを除外しBackup検索→Hareは300LPを払い自身を手札に回収→Backup特殊召喚から汎用Cyberse終点。',
  g=>{
    normal(g,C.backup,{picks:[C.mag,C.hare]});link(g,C.decoder,[C.backup],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.hare,C.backup,C.hare],places:[5,1]});
    activate(g,C.backup);
    assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.hare));
    genericEnd(g,endpoint,{hand:[C.hare],lp:7700});
  },{classification:'hand-cost-line',conditions:['Hareの除外誘発は手札回収。Catのように自己特殊召喚しない','Hare以外のM∀LICEを手札/墓地に用意していないため、回収Hareの手札効果を発動できない'],capabilities:['Hareを後続手札として保持。Catを捨てた場合のBinder線へ同一視しない']});

const output={schemaVersion:1,presetHash:hash(preset),scope:'固定40枚プリセットの指定2枚手札を実coreで検証。先攻、相手空盤面、追加ドローなし。',coverage:'有用な異なる終点と明示した負例を検証。全ペアまたは全合法手順の総当たりではない。',routes};
if(!only){fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');}
console.log(`Verified ${routes.length} two-card routes with independent replay${only?' (filtered; output not overwritten)':''}.`);
