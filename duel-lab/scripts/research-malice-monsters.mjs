import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const C={rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,tb:57111661,mtp:94722358,gwc:20726052,
  decoder:30342076,wicked:52698008,sp:29301450,ip:65741786,wp:4993187,binder:95454996,crypter:21848500,
  backup:30118811,mag:64865,dot:18789533,wizard:3723262,transcode:46947713,firewall:5043010,accord:39138610,
  ring:24842059,almiraj:60303245,soul:74652966,access:86066372};
const trace=process.argv.includes('--trace');
function compact(g) {return {type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,name:c.name,location:c.location,sequence:c.sequence,place:c.place})),choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response}))};}
function reply(g,input) {if(trace)console.log(g.prompt.type,input);respond(g,input);}
function yes(g,value=true) {const c=g.prompt.choices.find(c=>c.response.yes===value);assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});}
function settle(g,{picks=[],materials=[],places=[],decline=[],positions=[],optionalDraw=false}={}) {
  picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];positions=[...positions];
  for(let n=0;n<100;n++) {
    const p=g.prompt;
    if(p.type==='SELECT_IDLECMD'){assert.equal(picks.length,0,'Unused card selections');assert.equal(materials.length,0,'Unused materials');return;}
    if(trace)console.log(JSON.stringify(compact(g)));
    if(p.type==='SELECT_CHAIN') {
      const triggers=[C.rabbit,C.cat,C.dorm,C.binder,C.decoder,C.wicked,C.backup,C.mag,C.dot,C.accord,C.access];
      const c=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
      assert(c,JSON.stringify(compact(g)));reply(g,{action:c.id});
    } else if(p.type==='SELECT_EFFECTYN')yes(g,!decline.includes(g.pending.code));
    else if(p.type==='SELECT_YESNO')yes(g,/ドロー/.test(p.title)?optionalDraw:true);
    else if(p.type==='SELECT_PLACE') {
      const seq=places.shift();let i=seq===undefined?0:p.cards.findIndex(c=>c.place.sequence===seq&&c.place.player===0);
      assert(i>=0,`No place ${seq}: ${JSON.stringify(compact(g))}`);reply(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION') {
      const position=positions.shift()||1;const c=p.choices.find(c=>c.response.position===position)||p.choices[0];reply(g,{action:c.id});
    }else if(p.type==='SELECT_CARD') {
      let want=picks.shift();if(!want&&p.cards.length===p.min&&p.min===p.max)want=p.cards.map(c=>c.code);
      assert(want,`Need selection ${JSON.stringify(compact(g))}`);
      const selection=[];for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}reply(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD') {
      const code=materials.shift();const c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
      assert(c,`Need material ${code}: ${JSON.stringify(compact(g))}`);reply(g,{action:c.id});
    }else assert.fail(`Unexpected ${JSON.stringify(compact(g))}`);
  }assert.fail('Too many prompts');
}
function action(g,action,code,options={}) {if(trace)console.log('\nACTION',action,cards[code]?.name);select(g,c=>c.response.action===action&&c.card?.code===code);settle(g,options);}
const summon=(g,code,options)=>action(g,0,code,options);
const link=(g,code,materials,options={})=>action(g,1,code,{materials,...options});
const activate=(g,code,options)=>action(g,5,code,options);
function dormFirstBanish(g,target,options={}) {
 select(g,c=>c.response.action===5&&c.card?.code===C.dorm);
 assert.equal(g.prompt.type,'SELECT_CARD');
 assert.deepEqual([...new Set(g.prompt.cards.map(c=>c.code))].sort((a,b)=>a-b),[C.rabbit,C.cat,C.hare].sort((a,b)=>a-b),'Fixed deck first banish candidates');
 settle(g,{...options,picks:[target,...(options.picks||[])]});
}
function state(g) {const b=board(g);return {...b,players:b.players.map(p=>Object.fromEntries(Object.entries(p).map(([k,a])=>[k,a.map(c=>c?{...c,name:cards[c.code]?.name}:null)])))};}

function assertEnd(g,{monsters,lp,hand=[]}) {
 const b=board(g);assert.equal(b.turn,1);assert.equal(b.phase,'MAIN 1');assert.deepEqual(b.lp,[lp,8000]);
 assert.deepEqual(b.players[0].monsters.filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[...monsters].sort((a,b)=>a-b));
 assert.deepEqual(b.players[0].hand.map(c=>c.code).sort((a,b)=>a-b),[...hand].sort((a,b)=>a-b));
 assert(!g.log.some(e=>e.text.includes('枚ドロー')),'No random draws allowed');
 assert.equal(g.snapshot().players[0].deckCount+b.players[0].hand.length+
  ['monsters','spells','grave','banished'].reduce((n,z)=>n+b.players[0][z].filter(c=>c&&!(cards[c.code].type&0x4000000)).length,0),40,'Main deck card conservation');
}
async function rabbitRoute(endpoint='ip') {
 const g=await startRoute([C.rabbit]);
 try {
  summon(g,C.rabbit,{picks:[C.tb]});
  activate(g,C.tb,{picks:[C.rabbit,C.dorm]});
  link(g,C.decoder,[C.dorm],{places:[5]});
  link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.dorm],places:[5,1]});
  activate(g,C.dorm,{picks:[C.cat]});
  link(g,C.binder,[C.sp,C.dorm],{picks:[[C.rabbit,C.tb]],places:[5]});
  activate(g,C.binder,{picks:[C.mtp]});
  activate(g,C.mtp,{picks:[C.binder,C.hare]});
  activate(g,C.hare,{picks:[C.mtp]});
  let monsters;
  if(endpoint==='ip'){link(g,C.ip,[C.cat,C.hare],{places:[5]});monsters=[C.binder,C.ip];}
  else if(endpoint==='crypter'){link(g,C.crypter,[C.binder,C.cat,C.hare],{places:[5]});monsters=[C.crypter];}
  else if(endpoint==='accord'){link(g,C.accord,[C.binder,C.cat,C.hare],{picks:[C.binder],places:[5,1]});monsters=[C.accord,C.binder];}
  else assert.fail('Unknown Rabbit endpoint');
  assertEnd(g,{monsters,lp:6200});
  if(trace)console.log('RABBIT BOARD',JSON.stringify(state(g)));
  return finishRoute(g,{id:`rabbit-no-draw-${endpoint}`,starter:C.rabbit,name:`Rabbit単独 ${endpoint}`,summary:`Rabbit→TB→Dormouse→Decoder/S:PでDormouse帰還→Cat→Binder→MTP/Hare→${monsters.map(c=>cards[c].name).join('＋')}。追加ドロー不使用。`,requiresDraw:false,conditions:['先攻、相手の盤面・妨害なし','開始手札はRabbit1枚だけ','通常召喚権未使用','必要な展開先・罠がデッキ/EXに残る','S:Pを特殊召喚するため同ターンのTranscode蘇生は不可'],capabilities:endpoint==='ip'?['I:Pによる相手ターンL召喚用の盤面。相手ターン展開自体はこのリプレイに未収録']:endpoint==='crypter'?['除外済みM∀LICEカードを戻すCrypter①の資源あり']:['Accord②は1ターンに1度。蘇生Binderがコスト候補']});
 }finally{g.close();}
}

async function dormRoute(endpoint='crypter') {
 const g=await startRoute([C.dorm]);
 try {
  summon(g,C.dorm);
  dormFirstBanish(g,C.rabbit,{picks:[C.mtp]});
  activate(g,C.mtp,{picks:[C.dorm,C.hare]});
  link(g,C.decoder,[C.dorm],{places:[5]});
  link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
  activate(g,C.hare,{picks:[C.mtp,C.dorm,C.backup],places:[1]});
  activate(g,C.backup,{picks:[C.mag,C.mag,C.dot]});
  link(g,C.binder,[C.wicked,C.hare],{picks:[[C.rabbit,C.hare],C.rabbit],places:[5]});
  activate(g,C.binder,{picks:[C.gwc]});
  activate(g,C.gwc,{picks:[C.binder,C.dorm],places:[1,4]});
  let monsters;let hand=[C.rabbit];
  if(endpoint==='crypter') {link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});monsters=[C.crypter,C.binder];}
  else if(endpoint==='ip') {link(g,C.ip,[C.backup,C.dot],{places:[5]});monsters=[C.ip,C.binder,C.dorm];}
  else if(endpoint==='accord') {
    link(g,C.transcode,[C.backup,C.dot,C.dorm],{places:[5]});
    activate(g,C.transcode,{picks:[C.decoder],places:[1]});
    link(g,C.access,[C.binder,C.decoder],{picks:[C.binder],places:[1,0]});
    link(g,C.accord,[C.transcode,C.access,C.decoder],{picks:[[C.transcode,C.binder,C.access]],places:[5,0,1,2]});
    monsters=[C.accord,C.transcode,C.binder,C.access];
  }else if(endpoint==='firewall-accord') {
    link(g,C.firewall,[C.binder,C.dot],{places:[5]});
    link(g,C.ip,[C.backup,C.dorm],{picks:[C.rabbit],places:[1,0]});
    link(g,C.transcode,[C.ip,C.rabbit],{places:[1]});
    activate(g,C.transcode,{picks:[C.binder],places:[2]});
    activate(g,C.firewall,{picks:[C.mag]});
    link(g,C.accord,[C.transcode,C.binder,C.mag],{picks:[[C.transcode,C.binder]],places:[1,2,0]});
    monsters=[C.accord,C.transcode,C.binder,C.firewall];hand=[];
  }else assert.fail('Unknown Dormouse endpoint');
  assertEnd(g,{monsters,lp:6200,hand});
  if(endpoint==='crypter') {assert.equal(board(g).players[0].monsters[6].code,C.crypter);assert.equal(board(g).players[0].monsters[4].code,C.binder);}
  if(trace)console.log('DORM BOARD',JSON.stringify(state(g)));
  return finishRoute(g,{id:`dorm-no-draw-${endpoint}`,starter:C.dorm,name:`Dormouse単独 ${endpoint}`,summary:`Dormouse→Rabbit/MTP→Hare→Wicked→Backup→Magをサーチ後捨てDot→Binder/HareでRabbit回収→GWC→${monsters.map(c=>cards[c].name).join('＋')}。追加ドロー不使用。`,requiresDraw:false,conditions:['先攻、相手の盤面・妨害なし','開始手札はDormouse1枚だけ','通常召喚権未使用','必要な展開先・罠がデッキ/EXに残る','Dot①がデュエル中未使用'],capabilities:endpoint==='crypter'?['Crypterのリンク先にBinderを配置、除外MTP/Hareが①の資源','手札Rabbitを後続として保持']:endpoint==='ip'?['I:P＋Dormouseを相手ターンW:Pにする等の素材。相手ターン手順は未収録','手札Rabbitを後続として保持']:['Accord②は1ターンに1度であり、リンク先の数を妨害数に数えない',...(endpoint==='firewall-accord'?['Firewall①はこのルート中に使用済み。表側で存在する限り1度のため次ターンにも再使用不可']:['手札Rabbitを後続として保持'])]});
 }finally{g.close();}
}

async function nonStarterRoute(starter,endpoint=null) {
 const g=await startRoute([starter]);
 try {
  assert(!g.prompt.choices.some(c=>c.response.action===5),'No personal effect at an empty one-card opening');
  summon(g,starter);
  assert(!g.prompt.choices.some(c=>c.response.action===5),'No field effect can produce resources without another card');
  const available=g.prompt.choices.filter(c=>c.response.action===1).map(c=>c.card.code).sort((a,b)=>a-b);
  assert.deepEqual(available,(starter===C.cat?[C.ring,C.decoder]:[C.ring,C.decoder,C.almiraj]).sort((a,b)=>a-b));
  if(endpoint) {
    link(g,endpoint,[starter],{places:[5]});
    assert(!g.prompt.choices.some(c=>[0,1].includes(c.response.action)),'One body cannot continue summoning');
  }
  assertEnd(g,{monsters:[endpoint||starter],lp:8000});
  const key=starter===C.cat?'cat':'hare';
  return finishRoute(g,{id:`${key}-alone-${endpoint||'normal'}`,starter,name:`${cards[starter].name}単独${endpoint?cards[endpoint].name:'召喚止まり'}`,
    summary:`${cards[starter].name}1枚では${endpoint?cards[endpoint].name+'1体まで':'通常召喚後の固有展開効果を発動できない'}。手札・墓地に追加M∀LICEがなくテーマ展開は始まらない。`,
    requiresDraw:false,conditions:['先攻、相手の盤面・妨害なし','開始手札はこのカード1枚だけ','通常召喚権未使用'],
    capabilities:endpoint===C.ring?['相手の罠に対するRing①は残る。M∀LICE展開初動とは分類しない']:['1枚始動では展開資源が増えないことの負例']});
 }finally{g.close();}
}

async function rabbitInitialTrapProbe(trap,target=null) {
 const g=await startRoute([C.rabbit]);
 try {
  summon(g,C.rabbit,{picks:[trap]});
  if(trap===C.gwc) {
    assertEnd(g,{monsters:[C.rabbit],lp:8000});
    assert(!g.prompt.choices.some(c=>c.response.action===5));
    assert(board(g).players[0].spells.some(c=>c?.code===C.gwc));
  }else {
    activate(g,C.mtp,{picks:[C.rabbit,target]});
    if(target===C.hare) {
      activate(g,C.hare,{picks:[C.mtp]});
      assertEnd(g,{monsters:[C.rabbit,C.hare],lp:7700});
    }else {
      assertEnd(g,{monsters:[C.rabbit],lp:7700,hand:[target]});
      assert(!g.prompt.choices.some(c=>[0,5].includes(c.response.action)),'No second normal summon or own extension effect');
    }
  }
  return finishRoute(g,{id:`rabbit-first-${trap}-${target||'self'}`,starter:C.rabbit,name:`Rabbit最初の罠 ${cards[trap].name}${target?'→'+cards[target].name:''}`,
   summary:trap===C.gwc?'墓地/除外に蘇生可能なM∀LICEがまだ存在せず、GWCを発動できない。コストで除外予定のRabbitを、発動前に存在する蘇生対象として数えない。':target===C.hare?'MTPでHareをサーチし、Hareで墓地MTPを除外すると2体まで。TB/Dormouse線のデッキ除外効果に届かない。':'MTP検索後はRabbit1体＋検索札1枚。通常召喚権はRabbitに消費済みで、この検索札からさらに展開できない。',
   requiresDraw:false,conditions:['先攻、相手盤面/妨害なし','初手Rabbit1枚、通常召喚権未使用'],
   audit:{firstTrap:trap,searchTarget:target,continuationExamined:target===C.hare?'2体到達まで。以下の全L2置換を総当たりしていない':'固有効果を使う追加展開不可を選択肢で確認'}});
 }finally{g.close();}
}

async function dormCatProbe() {
 const g=await startRoute([C.dorm]);
 try {
  summon(g,C.dorm);dormFirstBanish(g,C.cat);
  assertEnd(g,{monsters:[C.dorm,C.cat],lp:7700});
  link(g,C.decoder,[C.cat],{places:[5]});
  link(g,C.sp,[C.decoder,C.dorm],{picks:[C.dorm],places:[5,0]});
  assertEnd(g,{monsters:[C.sp,C.dorm],lp:7400});
  assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.dorm),'Dormouse deck banish HOPT already spent on Cat');
  return finishRoute(g,{id:'dorm-cat-first-sp',starter:C.dorm,name:'Dormouseの最初の除外がCat',summary:'Dormouse→Cat帰還→CatをDecoder→Decoder＋DormouseでS:P→Dormouse除外帰還。S:P＋Dormouse、LP7400。Dormouse①は既にCatへ使用したためここからRabbitをデッキ除外できない。',requiresDraw:false,conditions:['先攻、相手盤面/妨害なし','初手Dormouse1枚、通常召喚権未使用'],audit:{firstBanish:C.cat,comparison:'Rabbit除外なら罠セットを経由してWicked/BackupとBinderへ接続する。Cat単独のドロー効果は追加M∀LICE手札がなく使用不可。',notClaimed:'S:P以後の全合法L召喚手順を総当たりした最適性'}});
 }finally{g.close();}
}

async function rabbitTbTargetProbe(target) {
 const g=await startRoute([C.rabbit]);
 try {
  summon(g,C.rabbit,{picks:[C.tb]});
  activate(g,C.tb,{picks:[C.rabbit,target]});
  assertEnd(g,{monsters:[C.rabbit,target],lp:7700});
  assert(!g.prompt.choices.some(c=>c.response.action===5),'TB summoned card cannot activate its field effect');
  if(target===C.cat) {
    link(g,C.decoder,[C.cat],{places:[5]});
    link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.cat],places:[5,0]});
    assertEnd(g,{monsters:[C.sp,C.cat],lp:7400});
    assert(!g.prompt.choices.some(c=>c.response.action===5&&c.card?.code===C.cat),'No other Maliss in hand for Cat');
  }else if(target===C.hare) {
    link(g,C.decoder,[C.rabbit],{places:[5]});
    link(g,C.sp,[C.decoder,C.hare],{picks:[C.hare,C.hare],places:[5]});
    activate(g,C.hare,{picks:[C.rabbit]});
    assertEnd(g,{monsters:[C.sp,C.hare],lp:7400});
  }else {
    link(g,C.decoder,[C.rabbit],{places:[5]});
    link(g,C.sp,[C.decoder,C.rabbit],{picks:[C.rabbit],places:[5]});
    assertEnd(g,{monsters:[C.sp],lp:7700});
  }
  return finishRoute(g,{id:`rabbit-tb-first-${target}`,starter:C.rabbit,name:`Rabbit→TBの特殊召喚先 ${cards[target].name}`,
   summary:target===C.cat?'TBからのCatは効果発動禁止。Decoder/S:P経由でCatを除外帰還させても追加M∀LICE手札がなくドロー不可。S:P＋Cat、LP7400。':target===C.hare?'TBからHare、RabbitをDecoderに変換しS:Pを作りHare除外→自身を手札回収→Hareで墓地Rabbit除外しSS。Rabbit③は使用済み。S:P＋Hare、LP7400。':'TBで別のRabbitを出してもセット効果の名称ターン1制限とTBの発動禁止があり2枚目の罠は得られない。Decoder/S:PでRabbitを除外しても帰還は名称ターン1使用済み。S:P1体、LP7700。',
   requiresDraw:false,conditions:['先攻、相手盤面/妨害なし','初手Rabbit1枚、通常召喚権未使用'],audit:{firstTrap:C.tb,firstTbTarget:target,comparison:'Dormouseを呼ぶ本線だけが、S:Pで帰還させた個体のデッキ除外効果からCatを追加して3体になる。',notClaimed:'ここからの全リンク組合せを総当たりした最適性'}});
 }finally{g.close();}
}

async function dormHareRoute() {
 const g=await startRoute([C.dorm]);
 try {
  summon(g,C.dorm);dormFirstBanish(g,C.hare,{picks:[C.hare]});
  link(g,C.decoder,[C.dorm],{places:[5]});
  activate(g,C.hare,{picks:[C.dorm]});
  link(g,C.binder,[C.decoder,C.dorm,C.hare],{picks:[[C.dorm,C.hare]],places:[5,1]});
  activate(g,C.binder,{picks:[C.tb]});
  activate(g,C.tb,{picks:[C.binder,C.rabbit]});
  link(g,C.sp,[C.binder,C.rabbit],{picks:[C.rabbit,C.gwc],places:[5,0]});
  activate(g,C.gwc,{picks:[C.rabbit,C.binder]});
  link(g,C.accord,[C.sp,C.binder,C.decoder],{picks:[C.binder],places:[5,1]});
  assertEnd(g,{monsters:[C.accord,C.binder],lp:8500});
  return finishRoute(g,{id:'dorm-hare-first-accord',starter:C.dorm,name:'Dormouse→Hare自己回収からAccord',summary:'Hareを除外して自身を手札回収→DormouseをDecoder→HareでDormouse除外し2体SS→3体でBinder＋Decoder帰還→TB/Rabbit→S:PでRabbitを除外帰還・GWCセット→GWCでBinder蘇生し2300LP回復→Accord＋Binder。手札/ドロー不要、LP8500。',requiresDraw:false,conditions:['先攻、相手盤面/妨害なし','初手Dormouse1枚、通常召喚権未使用','必要な展開先・罠がデッキ/EXに残る'],audit:{firstBanish:C.hare,comparison:'Hare③の自己回収を最初に使用するため、後でRabbitを手札回収できない。Wicked/Backup/Mag/Dotを使わない代替経路。S:Pを出すのでTranscode蘇生不可。',notClaimed:'基本Rabbit除外線より常に優位、または全合法分岐の総当たり'},capabilities:['Accord②は1ターン1回。リンク先Binderがコスト候補']});
 }finally{g.close();}
}

const classifications=[
 {code:C.rabbit,name:cards[C.rabbit].name,classification:'standalone-starter',reason:'通常召喚から罠をセットし、TBで呼んだDormouseをS:P経由で帰還させることで追加手札・ドローなしの本展開が成立。'},
 {code:C.dorm,name:cards[C.dorm].name,classification:'standalone-starter',reason:'デッキからRabbitを除外して帰還させ罠へ接続。MTP/HareからWicked/Backupへ進み、追加手札・ドローなしで複数の有用盤面が成立。'},
 {code:C.cat,name:cards[C.cat].name,classification:'conditional-extender',reason:'単独では召喚→L1まで。①は手札の別M∀LICEを除外する必要があり、猫1枚だけでは発動不可。追加M∀LICEとの2枚組および除外手段がある場合の帰還を1枚初動に混ぜない。2枚ドローは中身未確定のため保証した特定札として扱わない。'},
 {code:C.hare,name:cards[C.hare].name,classification:'conditional-extender',reason:'①は手札・墓地の自身以外のM∀LICEを必要とし、単独では召喚→L1まで。③は自身の特殊召喚ではなく除外M∀LICEモンスターの手札回収。'}
];

const routes=[];
const probes=[];
if(!process.argv.includes('--dorm'))for(const end of ['ip','crypter','accord'])routes.push(await rabbitRoute(end));
if(!process.argv.includes('--rabbit'))for(const end of ['crypter','ip','accord','firewall-accord'])routes.push(await dormRoute(end));
if(!process.argv.includes('--rabbit')&&!process.argv.includes('--dorm')) {
 for(const end of [null,C.ring,C.decoder])routes.push(await nonStarterRoute(C.cat,end));
 for(const end of [null,C.ring,C.decoder,C.almiraj])routes.push(await nonStarterRoute(C.hare,end));
 for(const target of [C.rabbit,C.cat,C.dorm,C.hare])probes.push(await rabbitInitialTrapProbe(C.mtp,target));
 probes.push(await rabbitInitialTrapProbe(C.gwc));
 for(const target of [C.rabbit,C.cat,C.hare])probes.push(await rabbitTbTargetProbe(target));
 probes.push(await dormCatProbe());
 routes.push(await dormHareRoute());
}
for(const r of [...routes,...probes])await replay(r);
if(process.argv.includes('--write')){
 assert(!process.argv.includes('--rabbit')&&!process.argv.includes('--dorm'),'Only full research may overwrite the complete file');
 fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../routes/malice-monsters.json',import.meta.url),JSON.stringify({schemaVersion:1,date:'2026-09-08',presetHash:hash(preset),scope:'固定40+15のM∀LICEメインモンスター4種類。先攻1枚手札・無妨害・無ドローで有用到達点を実core検証。',coverage:'全合法手順木の総当たりではない。4種類の分類、Rabbit3終点、Dormouse5終点、Cat/Hareの全L1と通常召喚止まり7負例、主要初回分岐9probeを保存。',firstBranchCoverage:{rabbit:{traps:[C.tb,C.mtp,C.gwc],mtpTargets:[C.rabbit,C.cat,C.dorm,C.hare],tbTargets:[C.rabbit,C.cat,C.dorm,C.hare],tb:'Dormouseは既存本線、Rabbit/Cat/HareはS:P経由の帰還可否・残る追加展開条件まで検証。後続の全リンク組合せの総当たりではない'},dormouse:{availableBanishTargets:[C.rabbit,C.cat,C.hare],absentBanishTargets:[C.dorm],reason:'Dormouseは固定デッキ1枚採用で初手に配置済み。最初のデッキ除外対象に同名は存在しないことを実coreの全候補と照合'}},classifications,routes,probes},null,2)+'\n');
}
console.log('PASS',routes.map(r=>({id:r.id,steps:r.steps.length})));
console.log('PROBES PASS',probes.map(r=>({id:r.id,steps:r.steps.length})));
