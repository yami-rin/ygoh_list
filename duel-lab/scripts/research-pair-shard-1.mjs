import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const RUN=path.join(ROOT,'runtime/multi-pairs/shard-1');
const OUT=path.join(ROOT,'routes/pair-shard-1.json');
const SEARCH=path.join(ROOT,'runtime/multi-pair-search/shard-1');
const DOC=path.join(ROOT,'docs/pair-shard-1.md');
const C={mag:64865,wizard:3723262,soul:74652966,backup:30118811,dot:18789533,
  rabbit:69272449,cat:96676583,dorm:32061192,hare:20938824,tb:57111661,mtp:94722358,gwc:20726052,
  decoder:30342076,wicked:52698008,binder:95454996,crypter:21848500,transcode:46947713,
  accord:39138610,access:86066372,firewall:5043010,sp:29301450,ip:65741786,gold:75500286,ug:68337209};
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const trace=process.argv.includes('--trace');
const compact=g=>({type:g.prompt.type,title:g.prompt.title,pendingCode:g.pending.code,
  cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,location:c.location,sequence:c.sequence,place:c.place})),
  choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:safe(c.response)}))});
function settle(g,{picks=[],materials=[],places=[],decline=[]}={}) {
  picks=picks.map(x=>Array.isArray(x)?[...x]:[x]);materials=[...materials];places=[...places];
  for(let n=0;n<150;n++) {
    assert(!g.log.some(e=>e.turn===1&&/枚ドロー/.test(e.text)),'Unknown draw crossed in constructive route');
    const p=g.prompt;if(p.type==='SELECT_IDLECMD') {
      assert.equal(picks.length,0,'Unused picks');assert.equal(materials.length,0,'Unused materials');
      return;
    }
    if(trace)console.log(JSON.stringify(compact(g)));
    if(p.type==='SELECT_CHAIN') {
      const triggers=[C.rabbit,C.cat,C.dorm,C.binder,C.decoder,C.wicked,C.backup,C.mag,C.dot,C.accord,C.access];
      const c=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))||p.choices.find(c=>!c.card);
      assert(c,JSON.stringify(compact(g)));respond(g,{action:c.id});
    }else if(p.type==='SELECT_EFFECTYN'||p.type==='SELECT_YESNO') {
      const desc=BigInt(g.pending.description??0);
      const catDraw=(desc>>20n)===BigInt(C.cat)&&(desc&0xfffffn)===2n;
      const answer=p.type==='SELECT_EFFECTYN'?!decline.includes(g.pending.code):!catDraw&&!/ドロー/.test(p.title);
      select(g,c=>c.response.yes===answer);
    }else if(p.type==='SELECT_PLACE') {
      const seq=places.shift();const i=seq===undefined?0:p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===seq);
      assert(i>=0,`No zone ${seq}: ${JSON.stringify(compact(g))}`);respond(g,{selection:[i]});
    }else if(p.type==='SELECT_POSITION') {
      const c=p.choices.find(c=>c.response.position===1)||p.choices[0];respond(g,{action:c.id});
    }else if(p.type==='SELECT_CARD') {
      let want=picks.shift();if(!want&&p.min===p.max&&p.cards.length===p.min)want=p.cards.map(c=>c.code);
      assert(want,`Need cards: ${JSON.stringify(compact(g))}`);const selection=[];
      for(const code of want){const i=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i));assert(i>=0,`Missing ${code}: ${JSON.stringify(compact(g))}`);selection.push(i);}
      respond(g,{selection});
    }else if(p.type==='SELECT_UNSELECT_CARD') {
      const code=materials.shift();const c=code===undefined?p.choices.find(c=>c.label==='選択を確定'):p.choices.find(c=>c.card?.code===code&&c.label.startsWith('選択：'));
      assert(c,`Need material ${code}: ${JSON.stringify(compact(g))}`);respond(g,{action:c.id});
    }else assert.fail(`Unexpected prompt: ${JSON.stringify(compact(g))}`);
  }assert.fail('Settle prompt bound');
}
function action(g,type,code,options={}) {
  if(trace)console.log('ACTION',type,cards[code].name);
  select(g,c=>c.response.action===type&&c.card?.code===code);settle(g,options);
}
const normal=(g,c,o)=>action(g,0,c,o),activate=(g,c,o)=>action(g,5,c,o),link=(g,c,materials,o={})=>action(g,1,c,{materials,...o});
function checkEnd(g,monsters,lp,hand=[],spells=[]) {
  const b=board(g);assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(b.turn,1);assert.deepEqual(b.lp,[lp,8000]);
  for(const [zone,codes]of Object.entries({monsters,hand,spells}))assert.deepEqual(b.players[0][zone].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b),[...codes].sort((a,b)=>a-b),zone);
  assert(!g.log.some(e=>e.turn===1&&/枚ドロー/.test(e.text)));
  assert.equal(g.snapshot(0).players[0].deckCount+b.players[0].hand.length+
    ['monsters','spells','grave','banished'].reduce((n,z)=>n+b.players[0][z].filter(c=>c&&!(cards[c.code].type&0x4000000)).length,0),40);
}
async function witness(hand,id,execute,metadata={}) {
  const g=await startRoute(hand);
  try {execute(g);const r=finishRoute(g,{id,requiresDraw:false,classification:'genuine-two-card-line',
    scope:'Fixed two-card fixture; first-turn empty opponent board; no unknown draw.',...metadata});
    await replay(r);console.log(JSON.stringify({result:'ROUTE PASS',id,steps:r.steps.length,lp:r.final.lp,
      monsters:r.final.players[0].monsters.filter(Boolean).map(c=>cards[c.code].name)}));return r;
  }finally{g.close();}
}

async function magicianGeneric(starter) {
  return witness([C.mag,starter],`pair-mag-${starter}-generic-accord`,g=>{
    normal(g,starter);link(g,C.decoder,[starter],{places:[5]});
    link(g,C.wicked,[C.decoder,C.mag],{picks:[C.dot,C.mag,C.backup],places:[5,1]});
    activate(g,C.backup,{picks:[C.dorm,C.dorm],places:[2]});
    assert(!g.prompt.choices.some(c=>c.response.action===1&&c.card?.code===C.binder),'Binder requires a Maliss material on the field');
    fs.writeFileSync(path.join(RUN,`rejected-binder-${starter}.json`),JSON.stringify({hypothesis:'Discard Dormouse, then immediately summon Binder',
      rejection:'No Maliss monster is on the field; the actual core does not offer Binder.',prefix:g.route.steps.map(s=>s.input),
      board:board(g),prompt:compact(g)},null,2)+'\n');
    link(g,C.transcode,[C.wicked,C.dot],{places:[5]});
    activate(g,C.transcode,{picks:[C.wicked],places:[1]});
    link(g,C.accord,[C.transcode,C.wicked,C.backup],{picks:[C.transcode],places:[5,0]});
    checkEnd(g,[C.accord,C.transcode],8000);
  },{summary:'Mag＋Cyberse normal→Wicked/Dot→Backup→Transcode/Wicked→Accord＋Transcode. Both initial cards were used. Discarding Dormouse does not permit Binder without a Maliss field material.',
    limitations:['Endpoint effects on the opponent turn are not played out here.','No optimality or complete branching claim.','Cyberse-only special summon restrictions apply.']});
}

async function dormTb() {
  return witness([C.dorm,C.tb],'pair-dorm-tb-accord-four-links-cat',g=>{
    normal(g,C.dorm,{places:[0]});
    activate(g,C.dorm,{picks:[C.rabbit,C.mtp],places:[1]});
    action(g,4,C.tb,{places:[1]});
    activate(g,C.tb,{picks:[C.dorm,C.cat],places:[3,0]});
    activate(g,C.mtp,{picks:[C.cat,C.hare],places:[3]});
    link(g,C.decoder,[C.dorm],{places:[5]});
    link(g,C.wicked,[C.decoder,C.rabbit],{places:[5]});
    activate(g,C.hare,{picks:[C.mtp,C.dorm,C.backup],places:[1]});
    activate(g,C.backup,{picks:[C.mag,C.mag,C.dot],places:[2,0]});
    link(g,C.binder,[C.wicked,C.hare],{picks:[[C.rabbit,C.hare],C.rabbit],places:[5]});
    activate(g,C.binder,{picks:[C.gwc]});
    activate(g,C.gwc,{picks:[C.binder,C.dorm],places:[1,4]});
    link(g,C.transcode,[C.backup,C.dot,C.dorm],{places:[5]});
    activate(g,C.transcode,{picks:[C.decoder],places:[1]});
    link(g,C.access,[C.binder,C.decoder],{picks:[C.binder],places:[1,0]});
    link(g,C.accord,[C.transcode,C.access,C.decoder],{picks:[[C.transcode,C.binder,C.access]],places:[5,0,1,2]});
    checkEnd(g,[C.accord,C.transcode,C.binder,C.access,C.cat],5900,[C.rabbit]);
  },{classification:'genuine-two-card-enhancement',
    summary:'Dormouse starts the engine; the initially held TB summons Cat and lets MTP banish/return Cat. That extra Cat survives the normal Transcode/Access/Accord conversion. Final: four Links plus Cat, with Rabbit in hand.',
    initialCardRoles:['Dormouse is normal summoned and its deck banish effect is used.','The initial TB is set and activated to summon the additional Cat; it is not merely retained or discarded.'],
    limitations:['Extra Cat is an extra body/resource, not an independently proven extra negate.','Accord effect prohibits further special summons after its revival.','No unknown draw was used; no optimality or interruption-win-rate claim.']});
}

async function inventory() {
  const all=enumeratePairs(preset.main);assert.equal(all.length,333);
  const selected=all.map((p,index)=>({...p,index})).filter(p=>p.index%8===1);assert.equal(selected.length,42);
  const records=[];
  for(const pair of selected) {
    const g=await startRoute(pair.hand);
    try {
      const root=compact(g);const initialPending=safe(g.pending);const preMain=[];
      for(let n=0;g.prompt.type==='SELECT_CHAIN'&&n<10;n++) {
        preMain.push(compact(g));const pass=g.prompt.choices.find(c=>!c.card);assert(pass,'Mandatory initial chain needs explicit audit');
        respond(g,{action:pass.id});
      }
      assert.equal(g.prompt.type,'SELECT_IDLECMD');
      const deploy=g.prompt.choices.filter(c=>[0,1,5].includes(c.response.action));
      const passOnly=preMain.length===0&&g.prompt.choices.every(c=>c.response.action===7);
      const record={...pair,names:pair.hand.map(c=>cards[c].name),opening:root,
        preMainWindows:preMain,mainProbe:compact(g),mainProbePrefix:g.route.steps.map(s=>s.input),
        deploymentActionCount:deploy.length,rootStatus:passOnly?'no-opening-action-proven':deploy.length?'active-opening-exists':'set-or-pass-only',
        complete:passOnly,coverage:'Initial real-core prompt plus a main-phase probe declining optional pre-main chains. Those declined branches remain unsearched. No template lookup used.',
        unresolvedReason:passOnly?null:'All later target, material, placement, chain and phase branches still require search.',
        drawBoundaryWarning:pair.hand.includes(1475311)?'Allure activation reaches unknown draws; do not continue from the resulting sampled hand.':null};
      records.push(record);
      fs.writeFileSync(path.join(RUN,`opening-${pair.id}.json`),JSON.stringify({hand:pair.hand,opening:root,initialPending,preMain,
        mainProbePrefix:g.route.steps.map(s=>s.input),mainPending:safe(g.pending),mainBoard:board(g)},null,2)+'\n');
    }finally{g.close();}
  }
  return records;
}

function searchReport() {
  const report=JSON.parse(fs.readFileSync(path.join(SEARCH,'summary.json')));
  const routes=JSON.parse(fs.readFileSync(path.join(SEARCH,'best-routes.json')));
  const manual=JSON.parse(fs.readFileSync(OUT));
  assert.equal(report.shard,1);assert.equal(report.shards,8);assert.equal(report.pairs.length,42);
  assert.equal(report.generation,routes.generation,'Wait for atomic shard publication to finish');
  assert.equal(report.sourceHash,routes.sourceHash);
  assert.deepEqual(report.pairs.map(p=>p.id),manual.pairs.map(p=>p.id));
  const s=report.summary;
  const rejected=report.pairs.filter(p=>p.coreRejected);
  const failureCount=report.pairs.reduce((n,p)=>n+(p.historicalFailures??0),0);
  const shortName=code=>cards[code].name.replace(/^M∀LICE[＜<].*?[＞>]\s*/, '').replace(/^M∀LICE /,'');
  const monsterText=route=>route?.final.players[0].monsters.filter(Boolean).map(c=>shortName(c.code)).join(' / ')||'なし';
  const status=p=>p.status==='unsearched'?'未着手':p.completeWithinNoDrawScope?'無ドロー範囲完了':'探索途中';
  const scale=p=>{
    const r=p.bestPlayable??p.best;
    if(!r)return '未評価';
    const monsters=r.final.players[0].monsters.filter(Boolean);
    const links=monsters.filter(c=>cards[c.code].type&0x4000000);
    if(!monsters.length)return '盤面展開なし';
    if(links.length===1&&monsters.length===1)return 'リンク1体（小展開含む）';
    if(!links.length&&monsters.length===1)return 'モンスター1体';
    return links.length?'リンク展開':'複数モンスター';
  };
  const rows=report.pairs.map(p=>{
    const audit=manual.pairs.find(a=>a.id===p.id);
    const proven=manual.routes.filter(r=>[...r.hand].sort((a,b)=>a-b).join('-')===[...p.hand].sort((a,b)=>a-b).join('-'));
    const note=[proven.length?'別途2枚実証あり':audit.preMainWindows.length?'事前チェーン分岐あり':audit.rootStatus==='set-or-pass-only'?'初期はセット/終了のみ':'',
      p.coreRejected?`コア拒否${p.coreRejected}`:'',p.historicalFailures?`例外${p.historicalFailures}`:''].filter(Boolean).join(' / ');
    const boundaries=Object.entries(p.unresolvedByReason??{}).map(([reason,n])=>`${({maxNodes:'ノード上限',maxMs:'時間上限',maxDepth:'深さ上限'})[reason]??reason}:${n}`).join(' / ')||
      (p.status==='unsearched'?'配分待ち':p.excludedDraw?'未知ドローの先のみ':'対象範囲内に未探索なし');
    return `| ${p.index} | ${p.hand.map(shortName).join(' ＋ ')} | ${status(p)} | ${p.visited??0} | ${p.unresolved??0} | ${p.excludedDraw??0} | ${boundaries} | ${scale(p)} | ${monsterText(p.bestPlayable??p.best)} | ${note} |`;
  });
  const text=[
    '# 固定M∀LICE 2枚組探索: shard 1', '',
    `更新: ${report.updatedAt}。固定デッキの全333種類の2枚組から、並び順 index % 8 = 1 の42組を担当。`, '',
    '全42組を実コアの初期選択肢から調べる。既知の展開テンプレート照合は使わない。相手は空盤面、先攻1ターン目、抜き取った2枚のみを初手とする。通常の5枚初手や相手の妨害を含む勝率・貫通率の測定ではない。', '',
    `着手 ${s.searched}/42、無ドロー範囲完了 ${s.completeWithinNoDrawScope}、探索途中 ${s.incomplete}、未着手 ${s.unsearched}。累積 ${s.visited} ノード、終端 ${s.terminalPaths}、未探索 frontier ${s.unresolved}、未知ドロー境界 ${s.excludedDraw}。共有探索の再生可能な候補 ${s.exportedRoutes} 本に加え、手動構築した3本を独立再生済み。`, '',
    `探索例外 ${failureCount} 件、コアが拒否した候補入力 ${rejected.reduce((n,p)=>n+p.coreRejected,0)} 件。${rejected.length?'該当 index: '+rejected.map(p=>p.index).join(', ')+'。拒否された入力は成功ルートに含めず、checkpointの rejected に保存する。':'拒否された入力はない。'}`, '',
    ...(rejected.some(p=>p.index===265)?['index 265（UNDERGROUND＋Baldrake）では、選択開始と取消を繰り返した後の `selection: []` をコアが拒否した。合法分岐の消失がないかは共有kernel担当へ調査を渡した。この組は frontier を残した探索途中で、完了とは数えていない。', '']:[]),
    '「無ドロー範囲完了」は、未知ドローを境界で切った対象範囲の完了を表す。ドローが必要な分岐の先は未調査。残った frontier がある組について全合法分岐の完了を主張しない。深さ・ノード・時間の上限と、exact prefix／次候補カーソルを checkpoint に保持する。カード位置や効果使用済み状態をまとめる重複排除は使わない。', '',
    '## 実証した2枚の線', '',
    '- Dormouse＋TB: 初手TBをセットして発動しCatを追加。MTPでCatを除外・帰還させ、通常の展開を進める。最終盤面はAccord、Transcode、Accesscode、Binder、Cat。手札Rabbit、LP5900。108応答、未知ドローなし。初手TBを単に温存する線ではなく、追加のCatを残す真の2枚上積み。ただしCat単体を追加の妨害1回と数えていない。Accordの効果後は特殊召喚できない。',
    '- Mag＋Wizard / Mag＋Soul: 初期2枚からDecoder、Wicked、Dot、Backup、Transcodeを経由してAccord＋Transcode。各39応答、LP8000。両方の初期カードを使うサイバース2枚展開で、M∀LICEモンスターが場に出る線としては数えない。',
    '- 棄却した案: Mag＋Wizard/SoulでBackupからDormouseを捨て、すぐBinderを出す案。Binderには場のM∀LICE素材が必要なため実コアが召喚を許可しない。直前盤面・応答列・合法選択肢を `runtime/multi-pairs/shard-1/rejected-binder-*.json` に保存。別の経路全体が不可能という主張ではない。', '',
    '## 全担当組と探索境界', '',
    '下表の盤面は共有探索で得た局所評価最大の候補。最強盤面の保証はなく、リンク1体や単体通常召喚も区別して記載する。2枚組から発見したという理由だけで、2枚目が展開強度に寄与した線とは扱わない。上の3本のみ初期2枚の実使用を別途確認した。', '',
    '| index | 初期2枚 | 状態 | ノード | frontier | ドロー境界 | 未対応理由 | 規模 | 共有探索候補のモンスター | 補足 |',
    '| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |', ...rows, '',
    '## 再現と検証', '',
    '```powershell',
    'node scripts/research-pair-shard-1.mjs --verify',
    'node scripts/search-multi-pairs.mjs --shard 1 --shards 8 --nodes-per-pair 300 --ms-per-pair 10000 --depth 180 --passes 1',
    'node scripts/research-pair-shard-1.mjs --report',
    '```', '',
    '`--verify` は手動構築3本を本物のルールエンジンで独立再生する。共有runnerは新しい最良候補を出力する前に独立再生し、未知ドロー直後は評価・export前に止める。引き続き同じコマンドで checkpoint から再開可能。', '',
    '- 手動証拠: `routes/pair-shard-1.json` / `runtime/multi-pairs/shard-1/`',
    '- 共有探索: `runtime/multi-pair-search/shard-1/summary.json` / `best-routes.json` / 各pair checkpoint',
    `- 共有探索 sourceHash: \`${report.sourceHash}\``,
    `- 共有探索 generation: \`${report.generation}\``, '',
  ].join('\n');
  fs.writeFileSync(DOC,text);
  console.log(JSON.stringify({result:'SHARD 1 REPORT PASS',...s,generation:report.generation}));
}
async function main() {
  fs.mkdirSync(RUN,{recursive:true});
  if(process.argv.includes('--report')) {searchReport();return;}
  if(process.argv.includes('--verify')) {
    const r=JSON.parse(fs.readFileSync(OUT));assert.equal(r.presetHash,hash(preset));assert.equal(r.pairs.length,42);
    for(const route of r.routes)await replay(route);
    console.log(JSON.stringify({result:'SHARD 1 VERIFY PASS',pairs:r.pairs.length,routes:r.routes.length,complete:r.complete}));return;
  }
  const pairs=await inventory();const routes=[];
  if(!process.argv.includes('--inventory-only')) {
    routes.push(await magicianGeneric(C.wizard));routes.push(await magicianGeneric(C.soul));
    routes.push(await dormTb());
  }
  const report={schemaVersion:1,shardIndex:1,shardCount:8,presetHash:hash(preset),generatedAt:new Date().toISOString(),
    complete:false,scope:'Fresh real-core investigation of every fixed-deck pair assigned by enumeratePairs index modulo 8. No unknown draw continuation.',
    pairs,routes,unresolved:'Shared exhaustive runner is separate; these opening probes and constructive witnesses do not enumerate full trees.'};
  fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:'SHARD 1 PASS',pairs:pairs.length,routes:routes.length,passOnly:pairs.filter(p=>p.rootStatus==='no-opening-action-proven').map(p=>p.id)}));
}
await main();
