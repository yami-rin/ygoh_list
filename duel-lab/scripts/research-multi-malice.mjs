import fs from 'node:fs';
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
const routes=[],probes=[];
async function route(id,hand,summary,execute,expected,{roles=[],limitations=[],classification='two-card-line'}={}) {
 const g=await startRoute(hand);
 try {
  execute(g);check(g,expected);
  const r=finishRoute(g,{id,starter:hand[0],name:hand.map(c=>cards[c].name).join('＋'),classification,summary,
   requiresDraw:false,roles,conditions:['固定presetの記載手札だけをデッキから抜き取る','先攻・通常召喚権未使用・相手無妨害/空盤面','必要な展開先がデッキ/EXに残る','任意ドローは全て辞退','各カードの名称ターン1/デュエル1回効果は未使用'],expected,
   limitations:['全手順木の総当たり・最善性・対妨害勝率は未検証','相手ターン処理はこの先攻リプレイの対象外',...limitations]});
  await replay(r);routes.push(r);console.log(`PASS ${id}: ${r.steps.length} inputs, LP ${expected.lp}`);
 }finally{g.close();}
}

await route('cat-mag-crypter-binder-ip-gwc',[C.cat,C.mag],
 'CatをDecoder、手札MagでWicked→Dot/Cat帰還/Backup→Dormouseを検索して捨てBinderで除外帰還→Rabbit/MTP→Crypter＋Binder＋I:P＋GWC。Catのドロー効果不使用。',g=>{
  normal(g,C.cat,{places:[1]});link(g,C.decoder,[C.cat],{places:[5]});
  link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.cat,C.backup],places:[5,1,0]});
  activate(g,C.backup,{picks:[C.dorm,C.dorm],places:[2]});
  link(g,C.binder,[C.wicked,C.cat],{picks:[C.dorm],places:[5,0]});
  activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[3]});
  activate(g,C.mtp,{picks:[C.binder,C.hare],places:[4]});
  link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});
  activate(g,C.hare,{picks:[C.mtp],places:[0]});
  link(g,C.ip,[C.rabbit,C.hare],{places:[2]});
  activate(g,C.binder,{picks:[C.gwc]});
 },{monsters:[C.crypter,C.binder,C.ip],spells:[C.gwc],lp:6200},{roles:['Catは通常召喚/L1素材とWickedで帰還するM∀LICE','Magは手札L素材とDot送墓、Backupからの捨て札には使わない'],limitations:['Dot①を使用','Mag適用後はサイバース族だけを特殊召喚']});

await route('cat-hare-accord-binder',[C.cat,C.hare],
 'CatをDecoder→Hareで墓地Cat除外し双方SS→3体でBinder＋Decoder帰還→HareでCat回収→TB/Dormouse/Binder帰還→Accord＋Binder、手札Cat。',g=>{
  normal(g,C.cat);link(g,C.decoder,[C.cat],{places:[5]});activate(g,C.hare,{picks:[C.cat]});
  link(g,C.binder,[C.decoder,C.cat,C.hare],{picks:[[C.cat,C.hare],C.cat],places:[5,1]});
  activate(g,C.binder,{picks:[C.tb]});activate(g,C.tb,{picks:[C.binder,C.dorm]});
  link(g,C.accord,[C.binder,C.decoder,C.dorm],{picks:[C.binder],places:[5,1]});
 },{monsters:[C.accord,C.binder],hand:[C.cat],lp:6500},{roles:['Catを先にL1へ変えてHareの墓地コストを作る','Hareは特殊召喚と、後でCatを回収する除外時効果を各1回使う'],limitations:['Accord②は1ターン1回','TBで出したDormouseの効果は発動せずL素材にする']});

await route('cat-rabbit-crypter-binder',[C.cat,C.rabbit],
 'Cat①で手札Rabbitを除外しドロー辞退→MTP/Hare→Wicked/Backup/Mag/Dot→Binder/GWC→Crypter＋Binder、手札Rabbit。',g=>{
  normal(g,C.cat,{places:[1]});activate(g,C.cat,{picks:[C.rabbit,C.mtp],places:[0]});
  activate(g,C.mtp,{picks:[C.cat,C.hare]});
  link(g,C.decoder,[C.cat],{places:[5]});link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
  activate(g,C.hare,{picks:[C.mtp,C.cat,C.backup],places:[1]});
  activate(g,C.backup,{picks:[C.mag,C.mag,C.dot]});
  link(g,C.binder,[C.wicked,C.hare],{picks:[[C.rabbit,C.hare],C.rabbit],places:[5]});
  activate(g,C.binder,{picks:[C.gwc]});activate(g,C.gwc,{picks:[C.binder,C.cat],places:[1,4]});
  link(g,C.crypter,[C.backup,C.dot,C.cat],{places:[6]});
 },{monsters:[C.crypter,C.binder],hand:[C.rabbit],lp:6200},{roles:['Cat①の手札除外を展開に使うが2枚ドローは使わない','RabbitがMTPを用意する'],limitations:['Dot①を使用','Catの除外帰還効果はMTPとWickedで合計2回使えるわけではない']});

function twoDormPrefix(g,starter) {
 if(starter===C.dorm) {normal(g,C.cat,{places:[1]});activate(g,C.cat,{picks:[C.dorm],places:[0]});}
 else {
  if(starter===C.terra)activate(g,C.terra,{picks:[C.ug]});
  activate(g,starter===C.gold?C.gold:C.ug,{picks:[C.dorm],places:[0]});normal(g,C.cat,{places:[1]});
 }
 activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[2]});
 link(g,C.decoder,[C.dorm],{places:[5]});link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
 activate(g,C.mtp,{picks:[C.cat,C.hare,C.dorm,C.backup],places:[1]});
 activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[0,2]});
 activate(g,C.hare,{picks:[C.mtp],places:[3]});
 link(g,C.binder,[C.wicked,C.hare],{picks:[[C.rabbit,C.hare],C.rabbit],places:[5]});
 activate(g,C.binder,{picks:[C.gwc]});activate(g,C.gwc,{picks:[C.binder,C.dorm],places:[3,4]});
 link(g,C.crypter,[C.backup,C.dot,C.dorm],{places:[6]});link(g,C.ring,[C.cat],{places:[2]});
}
for(const starter of [C.dorm,C.gold,C.ug,C.terra])await route(`cat-${starter}-crypter-binder-ring`,[C.cat,starter],
 'Cat＋Dormouse帰還の共通盤面→Rabbit/MTP→Wicked/Backup/Mag/Dot→Binder/GWC→Crypter＋Binder＋Ring、手札Rabbit。追加手札分をRingに残す。',g=>twoDormPrefix(g,starter),
 {monsters:[C.crypter,C.binder,C.ring],hand:[C.rabbit],spells:[C.ug,C.terra].includes(starter)?[C.ug]:[],lp:5900},
 {roles:['Catは通常召喚とMTPでの帰還','相方はDormouseを特殊召喚し、通常召喚権をCatへ残す'],limitations:['Dot①を使用','リングリボーの罠無効はリリースを要し、相手ターンの実行は別検証']});

await route('cat-wizard-crypter-binder',[C.cat,C.wizard],
 'CatをDecoder→Wizardで墓地Cat蘇生→3体でBinder＋Decoder帰還→Catを除外帰還→MTP/Hare→Crypter＋Binder。',g=>{
  normal(g,C.cat);link(g,C.decoder,[C.cat],{places:[5]});activate(g,C.wizard,{picks:[C.cat]});
  link(g,C.binder,[C.decoder,C.wizard,C.cat],{picks:[C.cat],places:[5,0,1]});
  activate(g,C.binder,{picks:[C.mtp]});activate(g,C.mtp,{picks:[C.binder,C.hare]});activate(g,C.hare,{picks:[C.mtp]});
  link(g,C.crypter,[C.decoder,C.cat,C.hare],{places:[6]});
 },{monsters:[C.crypter,C.binder],lp:6800},{roles:['WizardがEX由来サイバースと墓地のCatを要求する','WizardとCatの同時蘇生で物理素材を3体作る'],limitations:['Wizard適用後はサイバース族だけを特殊召喚']});

// This pairing is deliberately a negative example for accessing M∀LICE.
await route('cat-dot-sp-only',[C.cat,C.dot],'Dotの1枚小展開でS:P、Catは手札に残る。Catを展開に参加させる確定効果は得られず、M∀LICEの本線として数えない。',g=>{
 normal(g,C.dot);link(g,C.decoder,[C.dot]);link(g,C.sp,[C.decoder,C.dot],{decline:[C.sp]});
 },{monsters:[C.sp],hand:[C.cat],lp:8000},{classification:'one-card-line-with-inactive-companion',roles:['Dotだけが展開する','Catは未使用の後続'],limitations:['2枚が相互作用するM∀LICE初動ではない']});

{
 const g=await startRoute([C.cat,C.cat]);
 try {
  normal(g,C.cat);activate(g,C.cat,{picks:[C.cat]});
  link(g,C.decoder,[C.cat],{places:[5]});link(g,C.sp,[C.decoder,C.cat],{decline:[C.sp],places:[5]});
  check(g,{monsters:[C.sp],lp:7700});
  probes.push(finishRoute(g,{id:'cat-cat-no-draw-sp',starter:C.cat,name:'Cat2枚、ドローを使わない小展開',classification:'limited-two-card-probe',
   summary:'Catで別個体Catを除外、2ドロー辞退、300LP帰還→Decoder/S:P。帰還の名称ターン1を共有するため、同じCatをさらに除外してもこのターン再帰還はできない。',
   requiresDraw:false,conditions:['Cat2枚だけを固定デッキから抜き取る','先攻無妨害・通常召喚権未使用','ドローは使わない'],limitations:['全後続木の否定ではなく、ドローを使わない小展開の具体例'] }));
 }finally{g.close();}
}
{
 const g=await startRoute([C.cat,C.hare]);
 try {
  normal(g,C.cat);
  select(g,c=>c.response.action===5&&c.card?.code===C.cat);
  assert.equal(g.prompt.type,'SELECT_CARD');
  const i=g.prompt.cards.findIndex(c=>c.code===C.hare);assert(i>=0);respond(g,{selection:[i]});
  assert.equal(g.prompt.type,'SELECT_YESNO');
  assert.equal(BigInt(g.pending.description),(BigInt(C.cat)<<20n)|2n);
  assert(!g.log.some(x=>x.text.includes('枚ドロー')));
  probes.push(finishRoute(g,{id:'cat-hare-before-optional-draw',starter:C.cat,name:'Catの任意ドロー直前境界',classification:'optional-draw-boundary',
   summary:'Cat①でHareを除外した直後、任意2ドローを選ぶ直前で停止。ドロー結果を実行・列挙せず、後続を確定展開として主張しない。本ファイルのCat/Hare本線はこのドローを使わない別手順。',
   requiresDraw:false,conditions:['初手Cat＋Hare、先攻無妨害','ドロー結果探索は停止する'],drawBoundary:{optional:true,drawsExecuted:0,pending:safe(compact(g)),description:String(g.pending.description)},
   limitations:['このprobeは自動入力の完走ルートではない','ローカルstringsの表示名ではなくc96676583.luaの効果識別子で境界を確認'] }));
 }finally{g.close();}
}

for(const r of [...routes,...probes])await replay(r);
if(process.argv.includes('--write')) {
 fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../routes/multi-malice.json',import.meta.url),JSON.stringify({schemaVersion:1,date:'2026-09-08',presetHash:hash(preset),scope:'固定デッキのCatを含む実用的な2枚初動。ドロー結果の探索なし。',coverage:'手作業で指定した異なる確定展開を実core検証。全手札組合せ・全合法手順・最強性を証明しない。',routes,probes},null,2)+'\n');
}
console.log(`PASS ${routes.length} multi-card routes and ${probes.length} probes, all independently replayed`);
