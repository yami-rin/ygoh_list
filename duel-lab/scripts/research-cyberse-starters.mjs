import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,preset,hash} from './route-harness.mjs';

const ID={backup:30118811,wizard:3723262,magician:64865,dot:18789533,soul:74652966,purulia:84192580,ogre:59438930,ash:14558127,maxx:23434538,droll:94145021,shifter:91800273,magna:33854624,baldrake:72656408,rabbit:69272449,cat:96676583,dormouse:32061192,hare:20938824,decoder:30342076,ring:24842059,almiraj:60303245,wicked:52698008,contract:37458564,sp:29301450,ip:65741786,binder:95454996,transcode:46947713,firewall:5043010,accord:39138610};
const ownMonsters=g=>g.snapshot().players[0].monsters.filter(Boolean).map(c=>c.code);
const routes=[];
const trace=process.env.ROUTE_TRACE==='1';
function log(g){if(trace)console.log(JSON.stringify({prompt:g.prompt.type,title:g.prompt.title,choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,response:c.response,code:c.card?.code})),cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,place:c.place})),monsters:ownMonsters(g)},(_,v)=>typeof v==='bigint'?String(v):v));}

// Explicit route choices; generic handling only resolves placements, confirmations,
// and empty/pass windows. No action is selected by a model or a heuristic bot.
function settle(g,{targets=[],materials=[],yes=[ID.backup,ID.magician,ID.dot],places=[]}={}) {
  targets=targets.map(c=>Array.isArray(c)?c:[c]);materials=[...materials];places=[...places];
  for(let i=0;i<100;i++) {
    log(g);const p=g.prompt;
    if(p.type==='SELECT_IDLECMD') {assert.equal(targets.length,0,'Unconsumed targets');assert.equal(materials.length,0,'Unconsumed materials');return;}
    if(p.type==='SELECT_CARD') {
      const wanted=targets.shift();assert(wanted,`Unplanned card selection ${p.title}`);
      const chosen=wanted.map(code=>p.cards.findIndex(c=>c.code===code));assert(chosen.every(i=>i>=0),`Target absent ${wanted}`);respond(g,{selection:chosen});
    } else if(p.type==='SELECT_UNSELECT_CARD') {
      if(materials.length){const code=materials.shift();select(g,c=>c.label.startsWith('選択：')&&c.card?.code===code);}
      else select(g,c=>c.label==='選択を確定');
    } else if(p.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===yes.includes(g.pending.code));
    else if(p.type==='SELECT_YESNO')select(g,c=>c.response.yes===true);
    else if(p.type==='SELECT_CHAIN') {
      const effect=p.choices.find(c=>yes.includes(c.card?.code));
      if(effect)respond(g,{action:effect.id});else select(g,c=>c.label==='発動しない');
    } else if(p.type==='SELECT_PLACE') {
      const sequence=places.shift();let index=sequence===undefined?-1:p.cards.findIndex(c=>c.place.sequence===sequence&&c.place.player===0);
      if(index<0)index=p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===5);
      respond(g,{selection:[index<0?0:index]});
    } else if(p.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
    else assert.fail(`Unexpected ${p.type}`);
  }
  assert.fail('Route did not settle');
}
function normal(g,code,options){select(g,c=>c.response.action===0&&c.card?.code===code);settle(g,options);}
function link(g,code,materials,options={}){select(g,c=>c.response.action===1&&c.card?.code===code);settle(g,{...options,materials});}
function activate(g,code,options={}){select(g,c=>c.response.action===5&&c.card?.code===code);settle(g,options);}
async function route(id,hand,summary,execute,{classification='limited-one-card-line',requiresDraw=false,conditions=[],expectedLP=8000}={}) {
  const g=await startRoute(hand);
  try {
    await execute(g);
    assert.equal(g.turn,1);assert.equal(g.turnPlayer,0);assert.equal(g.phase,4);
    assert.equal(g.snapshot().players[0].hand.length,0);assert.deepEqual(g.lp,[expectedLP,8000]);
    const result=finishRoute(g,{id,starter:hand[0],name:cards[hand[0]].name,classification,summary,conditions:['先攻・相手盤面なし・妨害なし','記載手札以外の初手は使わない',...conditions],requiresDraw});
    await replay(result);routes.push(result);console.log(`PASS ${id}: ${g.inputs.length} inputs; ${ownMonsters(g).map(c=>cards[c].name).join(' / ')}; LP ${g.lp.join('/')}`);
  } finally {g.close();}
}

await route('dotscaper-sp',[ID.dot],'ドット召喚→デコーダー→ドット蘇生→S：P。M∀LICEへのアクセスを伴わない1枚の小展開。',g=>{
  normal(g,ID.dot);link(g,ID.decoder,[ID.dot]);link(g,ID.sp,[ID.decoder,ID.dot]);
  assert.deepEqual(ownMonsters(g),[ID.sp]);assert.equal(g.snapshot().players[0].hand.length,0);
});
await route('dotscaper-ring-decoder',[ID.dot],'ドット召喚→デコーダー→ドット蘇生→リングリボー。リングの罠無効とデコーダーを残す。',g=>{
  normal(g,ID.dot);link(g,ID.decoder,[ID.dot]);link(g,ID.ring,[ID.dot]);
  assert.deepEqual(ownMonsters(g).sort(),[ID.ring,ID.decoder].sort());
});
await route('dotscaper-wicked',[ID.dot],'ドット召喚→デコーダー→ドット蘇生→ウィキッド。破壊耐性を得るが単独では検索を起動できない。',g=>{
  normal(g,ID.dot);link(g,ID.decoder,[ID.dot]);link(g,ID.wicked,[ID.decoder,ID.dot]);
  assert.deepEqual(ownMonsters(g),[ID.wicked]);assert.equal(g.snapshot().players[0].hand.length,0);
});
await route('dotscaper-ring-almiraj',[ID.dot],'ドット召喚→アルミラージ→ドット蘇生→リングリボー。罠無効と効果破壊からの保護を用意する小展開。',g=>{
  normal(g,ID.dot);link(g,ID.almiraj,[ID.dot]);link(g,ID.ring,[ID.dot]);
  assert.deepEqual(ownMonsters(g).sort(),[ID.ring,ID.almiraj].sort());
});
function backupAlone(g){normal(g,ID.backup,{targets:[ID.magician,ID.magician,ID.dot]});assert.deepEqual(ownMonsters(g).sort(),[ID.backup,ID.dot].sort());}
await route('backup-alone-ring-decoder',[ID.backup],'バックアップ召喚→コード・マジシャンを検索してそのまま捨てる→ドット墓地送り・蘇生→デコーダー＋リング。追加手札なし、M∀LICEアクセスなし。',g=>{
  backupAlone(g);link(g,ID.decoder,[ID.backup]);link(g,ID.ring,[ID.dot]);
  assert.deepEqual(ownMonsters(g).sort(),[ID.ring,ID.decoder].sort());assert.equal(g.snapshot().players[0].hand.length,0);
});
await route('backup-alone-wicked',[ID.backup],'バックアップ単体でコード・マジシャンを捨ててドット蘇生→ウィキッド。追加特殊召喚がなくサーチに続かない。',g=>{
  backupAlone(g);assert(!g.prompt.choices.some(c=>c.response.action===1&&c.card?.code===ID.sp),'Magician Cyberse lock must reject S:P');
  link(g,ID.wicked,[ID.backup,ID.dot]);assert.deepEqual(ownMonsters(g),[ID.wicked]);
});
for(const [key,code] of [['wizard',ID.wizard],['code-of-soul',ID.soul]])await route(`${key}-ring`,[code],'通常召喚→リングリボー。罠無効を1回用意できるがM∀LICE展開には接続しない。',g=>{
  normal(g,code);link(g,ID.ring,[code]);assert.deepEqual(ownMonsters(g),[ID.ring]);
});

function backupWithDiscard(g,discard) {
  normal(g,ID.backup,{targets:[ID.magician,discard]});
  link(g,ID.decoder,[ID.backup]);
  link(g,ID.wicked,[ID.decoder,ID.magician],{targets:[ID.dot,ID.backup,ID.backup],yes:[ID.magician,ID.dot,ID.wicked],places:[5,1]});
  assert(g.snapshot().players[0].hand.some(c=>c.code===ID.backup));
  activate(g,ID.backup);
}
await route('backup-discard-ip-wicked',[ID.backup,ID.ash],'バックアップ＋捨て札→コード・マジシャン保持→ウィキッド＋ドット→墓地バックアップを除外し2枚目を検索・特殊召喚→ドットとバックアップでI：P。M∀LICEを経由しない。',g=>{
  backupWithDiscard(g,ID.ash);link(g,ID.ip,[ID.dot,ID.backup]);
  assert.deepEqual(ownMonsters(g).sort(),[ID.wicked,ID.ip].sort());
},{classification:'hand-cost-line',conditions:['追加手札1枚を捨てる。この記録は灰流うららを使用','バックアップ単体の初動率には算入しない']});
await route('backup-discard-accord',[ID.backup,ID.ash],'バックアップ＋捨て札→ウィキッド・ドット・バックアップ→トランスコードでウィキッド蘇生→3体でアコード→トランスコード蘇生。リンク先リリース用の1体を用意する。',g=>{
  backupWithDiscard(g,ID.ash);
  link(g,ID.transcode,[ID.wicked,ID.dot]);activate(g,ID.transcode,{targets:[ID.wicked]});
  link(g,ID.accord,[ID.transcode,ID.wicked,ID.backup],{yes:[ID.accord],targets:[[ID.transcode]]});
  assert.deepEqual(ownMonsters(g).sort(),[ID.accord,ID.transcode].sort());
},{classification:'hand-cost-line',conditions:['追加手札1枚を捨てる。この記録は灰流うららを使用','アコード蘇生効果解決後はそのターン特殊召喚不可','バックアップ単体の初動率には算入しない']});
await route('backup-malice-discard-binder-waypoint',[ID.backup,ID.cat],'バックアップ＋Cat→Catを捨ててコード・マジシャン保持→ウィキッド＋ドット→Catを除外してバックアップ検索・Cat帰還→バックアップ特殊召喚→ウィキッドとCatでWHITE BINDER、GWCをセット。追加展開へ続ける中間盤面。',g=>{
  normal(g,ID.backup,{targets:[ID.magician,ID.cat]});link(g,ID.decoder,[ID.backup]);
  link(g,ID.wicked,[ID.decoder,ID.magician],{targets:[ID.dot,ID.cat,ID.backup],yes:[ID.magician,ID.dot,ID.wicked,ID.cat],places:[5,1]});
  activate(g,ID.backup);link(g,ID.binder,[ID.wicked,ID.cat]);activate(g,ID.binder,{targets:[20726052]});
  assert.deepEqual(ownMonsters(g).sort(),[ID.binder,ID.dot,ID.backup].sort());assert.equal(g.lp[0],7700);
  assert(g.snapshot().players[0].spells.some(c=>c?.code===20726052));
},{classification:'two-card-malice-waypoint',expectedLP:7700,conditions:['捨て札はM∀LICEモンスター。この記録はCatを使用','任意の捨て札へ置き換えて同じM∀LICE盤面が作れるわけではない','WHITE BINDER到達の中間盤面まで。以後の最終盤面最適化は未検証']});

// Singleton scope census: capture the actual core's first legal actions for every
// non-MALICE Main Deck monster, including cards that do not begin an engine line.
const classifications=[];
const definitions={
  backup:['hand-cost-starter','追加手札を捨てて検索札を保持する展開初動。真の1枚では検索したコード・マジシャン自身を捨ててドットへ到達する小展開が可能だが、M∀LICE本線にはつながらない。'],
  wizard:['conditional-extender','手札の自己特殊召喚にEX由来サイバースと墓地の闇サイバースが必要。1枚なら召喚→リンク1止まり。'],
  magician:['conditional-extender','場のリンクをリンク素材にするときだけ手札素材にできる。空盤面で1枚だけでは出せず、捨てる手段もない。'],
  dot:['limited-one-card-line','召喚→リンク1→自己蘇生で2体になりS：Pまたはリング＋リンク1へ到達。M∀LICEへの確定アクセスなし。'],
  soul:['conditional-extender','手札から出すにはリンクが必要。1枚なら通常召喚→リンク1。墓地効果には別途リンク3以上を作る素材が必要。'],
  purulia:['hand-trap','先攻空盤面で発動できるが相手の召喚待ち。自身だけではM∀LICEにアクセスしない。'],
  ogre:['hand-trap','手札・場の除去用誘発。通常召喚はできるが展開初動ではない。'],
  ash:['hand-trap','デッキ操作を止める誘発。通常召喚→アルミラージは可能でもM∀LICE展開には続かない。'],
  maxx:['hand-trap','相手の特殊召喚からのドローに依存。無妨害先攻の自力1枚展開ではない。'],
  droll:['hand-trap','相手のドロー以外のサーチ等が発動条件。通常召喚→アルミラージは可能だが本線アクセスなし。'],
  shifter:['hand-trap','自分墓地なしで使える墓地除外化。自身を展開する手段を持たず、これ1枚からM∀LICEを出せない。'],
  magna:['conditional-extender','墓地の光・闇が必要。空盤面・空墓地の先攻1枚では特殊召喚できない。'],
  baldrake:['conditional-extender','墓地の光・闇が必要。空盤面・空墓地の先攻1枚では特殊召喚できない。'],
};
for(const [key,[classification,reason]] of Object.entries(definitions)) {
  const code=ID[key],g=await startRoute([code]);
  try {
    const choices=()=>g.prompt.choices.map(c=>({label:c.label,action:c.response.action??null,code:c.card?.code??null}));
    const openingPrompt=g.prompt.type,openingChoices=choices();
    settle(g,{yes:[]});assert.equal(g.phase,4);
    if([ID.magician,ID.magna,ID.baldrake].includes(code))assert(g.prompt.choices.every(c=>c.response.action===7),'Cannot start from an empty board');
    if([ID.wizard,ID.soul].includes(code))assert(!g.prompt.choices.some(c=>[1,5].includes(c.response.action)),'Extender must not special summon from an empty board');
    const verification=finishRoute(g,{id:`cyberse-opening-${code}`});await replay(verification);
    classifications.push({code,name:cards[code].name,classification,reason,openingPrompt,openingChoices,mainPhaseChoices:choices(),openingVerified:true,verification});
  }
  finally {g.close();}
}
const nonMalice=[...new Set(preset.main)].filter(code=>(cards[code].type&1)&&!cards[code].setcodes.includes(441));
assert.deepEqual(classifications.map(c=>c.code).sort(),nonMalice.sort());
const output={schemaVersion:1,date:'2026-09-08',presetHash:hash(preset),scope:'固定プリセットのM∀LICE以外の全メインモンスター。先攻・追加手札なしの分類と、有用小展開の合法入力列。',coverage:'全合法入力木の総当たりではなく、明示した有用ルートと空盤面の初期合法行動を実coreで検証。',classifications,routes};
fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../routes/cyberse-starters.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`Verified ${routes.length} routes with deterministic replay; classified ${classifications.length} unique Main Deck monsters.`);
