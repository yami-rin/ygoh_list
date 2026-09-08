import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {startRoute,respond,select,finishRoute,replay,board,hash,preset} from './route-harness.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const RUNTIME=path.join(ROOT,'runtime/multi-pairs/shard-7');
const SEARCH_RUNTIME=path.join(ROOT,'runtime/multi-pair-search/shard-7');
const C={mag:64865,backup:30118811,ug:68337209,hare:20938824,rabbit:69272449,
  dorm:32061192,cat:96676583,dot:18789533,soul:74652966,wizard:3723262,ash:14558127,ogre:59438930,
  mtp:94722358,gwc:20726052,contract:37458564,wicked:52698008,binder:95454996,
  ip:65741786,sp:29301450,almiraj:60303245,decoder:30342076};
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const trace=process.argv.includes('--trace');
fs.mkdirSync(RUNTIME,{recursive:true});
const pairs=enumeratePairs(preset.main).map((p,index)=>({...p,index,names:p.hand.map(c=>cards[c].name)}))
  .filter(p=>p.index%8===7);
assert.equal(pairs.length,41);
const pairMap=new Map(pairs.map(p=>[p.id,p]));
const pairId=hand=>[...hand].sort((a,b)=>a-b).join('-');
const compact=g=>safe({type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards?.map(c=>({code:c.code,location:c.location,sequence:c.sequence,place:c.place})),
  choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response}))});
const save=(name,value)=>fs.writeFileSync(path.join(RUNTIME,name),JSON.stringify(safe(value),null,2)+'\n');
function settle(g,{picks=[],materials=[],places=[],decline=[]}={}) {
  picks=picks.map(p=>Array.isArray(p)?[...p]:[p]);materials=[...materials];places=[...places];
  for(let n=0;n<120;n++) {
    const p=g.prompt;
    if(p.type==='SELECT_IDLECMD') {
      assert.equal(picks.length,0,'Unused card choices');assert.equal(materials.length,0,'Unused materials');
      assert.equal(places.length,0,'Unused placements');return;
    }
    if(trace) console.log(JSON.stringify(compact(g)));
    if(p.type==='SELECT_CHAIN') {
      const triggers=[C.rabbit,C.cat,C.dorm,C.mag,C.dot,C.backup,C.wicked,C.binder,C.decoder];
      const choice=p.choices.find(c=>c.card&&(triggers.includes(c.card.code)||(c.card.code===C.hare&&c.card.location===32))&&!decline.includes(c.card.code))
        ||p.choices.find(c=>!c.card);
      assert(choice,JSON.stringify(compact(g)));respond(g,{action:choice.id});
    } else if(p.type==='SELECT_EFFECTYN') select(g,c=>c.response.yes===!decline.includes(g.pending.code));
    else if(p.type==='SELECT_YESNO') {
      const desc=BigInt(g.pending.description||0);
      const catDraw=(desc>>20n)===BigInt(C.cat)&&(desc&0xfffffn)===2n;
      select(g,c=>c.response.yes===(!catDraw&&!/ドロー/.test(p.title)));
    } else if(p.type==='SELECT_PLACE') {
      const place=places.shift();const index=place===undefined?0:p.cards.findIndex(c=>c.place.player===0&&c.place.sequence===place);
      assert(index>=0,JSON.stringify(compact(g)));respond(g,{selection:[index]});
    } else if(p.type==='SELECT_POSITION') select(g,c=>c.response.position===1);
    else if(p.type==='SELECT_CARD') {
      let desired=picks.shift();
      if(!desired&&p.cards.length===p.min&&p.min===p.max) desired=p.cards.map(c=>c.code);
      assert(desired,`Missing target ${JSON.stringify(compact(g))}`);
      const selection=[];
      for(const target of desired) {
        const code=typeof target==='object'?target.code:target;
        const index=p.cards.findIndex((c,i)=>c.code===code&&!selection.includes(i)
          &&(typeof target!=='object'||target.location===undefined||c.location===target.location));
        assert(index>=0,`Target ${JSON.stringify(target)} unavailable: ${JSON.stringify(compact(g))}`);
        selection.push(index);
      }
      respond(g,{selection});
    } else if(p.type==='SELECT_UNSELECT_CARD') {
      const material=materials.shift();
      const choice=material===undefined?p.choices.find(c=>c.label==='選択を確定')
        :p.choices.find(c=>c.label.startsWith('選択：')&&c.card?.code===material);
      assert(choice,JSON.stringify(compact(g)));respond(g,{action:choice.id});
    } else assert.fail(`Unexpected prompt ${JSON.stringify(compact(g))}`);
  }
  assert.fail('Prompt settling bound reached');
}
function act(g,type,code,options={}) {
  if(trace)console.log(`ACTION ${type} ${cards[code].name}`);
  select(g,c=>c.response.action===type&&c.card?.code===code);settle(g,options);
}
const normal=(g,c,o)=>act(g,0,c,o);
const activate=(g,c,o)=>act(g,5,c,o);
const link=(g,c,materials,o={})=>act(g,1,c,{materials,...o});
const zone=(g,name)=>board(g).players[0][name].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b);
const manualRoutes=[];
async function route(id,hand,description,execute,expected,classification,roles) {
  assert(pairMap.has(pairId(hand)),'Outside shard ownership');
  const g=await startRoute(hand);
  try {
    execute(g);
    assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.turn,1);
    assert(!g.log.some(e=>e.text.includes('枚ドロー')),'Uncertain draws forbidden');
    for(const [z,codes] of Object.entries(expected.zones)) assert.deepEqual(zone(g,z),[...codes].sort((a,b)=>a-b),z);
    assert.deepEqual(g.lp,[expected.lp,8000]);
    const r=finishRoute(g,{id,starter:hand[0],pairId:pairId(hand),name:hand.map(c=>cards[c].name).join('＋'),
      pairIndex:pairMap.get(pairId(hand)).index,
      classification,summary:description,roles,requiresDraw:false,expected,
      conditions:['固定40/15から初期手札2枚を厳密に抜き取る','先攻1ターン目、相手空盤面/妨害なし','追加ドローなし'],
      limitations:['この入力列の成立を実証。全後続木・最善性・妨害への対応は未網羅',
        '両方を使用することと、全ての1枚ルートより強いことは同一ではない']});
    await replay(r);manualRoutes.push(r);
    console.log(`MANUAL PASS ${id}: ${r.steps.length} responses, LP ${g.lp[0]}`);
  } finally {g.close();}
}

for(const starter of [C.ash,C.ogre]) await route(`pair7-${starter}-soul-small-sp`,[starter,C.soul],
  '手札誘発を通常召喚→アルミラージ→手札Soulを特殊召喚→S:P。両方が素材となる小さい2枚展開。',g=>{
    normal(g,starter,{places:[0]});link(g,C.almiraj,[starter],{places:[5]});
    activate(g,C.soul,{places:[1]});
    assert(!g.prompt.choices.some(c=>c.response.action===1&&c.card?.code===C.ip),'I:P requires two non-Link monsters');
    link(g,C.sp,[C.almiraj,C.soul],{places:[5],decline:[C.sp]});
  },{lp:8000,zones:{monsters:[C.sp],hand:[],spells:[]}},'small-genuine-two-card-line',
  ['低攻撃力の通常召喚札がアルミラージを用意する','Soulはリンクが存在してから手札特殊召喚し2体目になる']);

function undergroundContract(g,cost) {
  activate(g,C.ug,{picks:[C.rabbit,C.mtp]});
  activate(g,C.mtp,{picks:[C.rabbit,C.dorm]});normal(g,C.dorm);
  activate(g,C.dorm,{picks:[C.cat]});
  link(g,C.contract,[C.dorm,C.cat],{picks:[cost,C.mag],places:[5]});
  link(g,C.wicked,[C.contract,C.mag],{picks:[C.dot,C.dorm,C.backup],places:[5,1,0]});
}
await route('pair7-underground-hare-ip-binder-dorm-gwc',[C.ug,C.hare],
  'UG→Contract/Wicked。BackupはWizardを検索して捨て、初手HareをMTP墓地除外で特殊召喚。Dot＋BackupでI:P、Wicked＋HareでBinderを作りDormouseを残す。Hare除外でRabbit回収、GWCをセット。',g=>{
    undergroundContract(g,{code:C.ug,location:8});
    activate(g,C.backup,{picks:[C.wizard,C.wizard]});
    activate(g,C.hare,{picks:[C.mtp]});
    link(g,C.ip,[C.dot,C.backup],{places:[1]});
    link(g,C.binder,[C.wicked,C.hare],{picks:[C.hare,C.rabbit],places:[5]});
    activate(g,C.binder,{picks:[C.gwc]});
  },{lp:6800,zones:{monsters:[C.ip,C.binder,C.dorm],hand:[C.rabbit],spells:[C.gwc]}},
  'two-card-extension',['UGがサーチ/墓地/素材を用意する','初手Hareが手札特殊召喚してBinder素材になり、Dormouse1体を残す']);

await route('pair7-double-underground-preserve-field',[C.ug,C.ug],
  'UG1枚のContract線に対し、儀式検索のコストを2枚目の手札UGに変更。I:P＋Binder＋MTP＋手札Rabbitに加え、最初に発動したUGがフィールドに残る。',g=>{
    undergroundContract(g,{code:C.ug,location:2});
    activate(g,C.backup,{picks:[C.hare,C.hare]});
    link(g,C.ip,[C.dot,C.backup],{places:[1]});
    link(g,C.binder,[C.wicked,C.dorm],{picks:[C.hare,C.rabbit],places:[5]});
    activate(g,C.binder,{picks:[C.mtp]});
  },{lp:6800,zones:{monsters:[C.ip,C.binder],hand:[C.rabbit],spells:[C.ug,C.mtp]}},
  'one-card-line-with-extra-spell-cost',['1枚目UGで通常の初動','2枚目UGをContractの手札コストとし、場のUGを温存']);

const initialChecks=[];
const negativeProbes=[];
for(const pair of pairs) {
  const g=await startRoute(pair.hand);
  try {
    const initial=compact(g);
    const developing=g.prompt.choices.filter(c=>[0,1,5].includes(c.response.action));
    let probeId=null;
    if(!developing.length) {
      for(let n=0;n<2;n++) {
        const next=g.prompt.choices.find(c=>c.response.action===4);
        if(!next)break;
        respond(g,{action:next.id});settle(g);
        assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),
          'A set card unexpectedly unlocks first-turn development');
      }
      probeId=`pair7-${pair.id}-no-initial-development`;
      const probe=finishRoute(g,{id:probeId,starter:pair.hand[0],pairId:pair.id,
        classification:'no-first-turn-development',requiresDraw:false,
        summary:'空盤面で召喚・特殊召喚・効果発動の候補なし。セット可能な罠をセットしても展開候補は生じない。',
        conditions:['先攻、手札はこの2枚のみ、相手空盤面・妨害なし'],
        limitations:['将来ターンの相手行動に対する反応・妨害性能は評価していない']});
      await replay(probe);negativeProbes.push(probe);
    }
    initialChecks.push({...pair,initialPrompt:initial,developingChoiceCount:developing.length,
      initialVerification:true,negativeProbe:probeId});
  } finally {g.close();}
}
save('manual-routes.json',{schemaVersion:1,presetHash:hash(preset),shard:7,pairCount:pairs.length,routes:manualRoutes,probes:negativeProbes});
save('inventory.json',{schemaVersion:1,presetHash:hash(preset),shard:7,pairs:initialChecks});
console.log(`MANUAL VERIFIED ${manualRoutes.length} new routes across ${new Set(manualRoutes.map(r=>r.pairId)).size} owned pairs`);
console.log(`INITIAL INVENTORY VERIFIED ${initialChecks.length} pairs; ${negativeProbes.length} no-development probes independently replayed`);
if(!process.argv.includes('--manual-only')) {
  const value=(name,fallback)=>{
    const arg=process.argv.find(arg=>arg.startsWith(`--${name}=`));
    const parsed=arg?Number(arg.slice(name.length+3)):fallback;
    assert(Number.isSafeInteger(parsed)&&parsed>0,`Invalid ${name}`);return parsed;
  };
  const limits={maxNodesPerPair:value('nodes',200),maxMsPerPair:value('ms',5000),
    maxDepth:value('depth',128),passes:value('passes',2)};
  const {runShard}=await import('./search-multi-pairs.mjs');
  const publicationOnly=process.argv.includes('--publish-only');
  const searchReport=publicationOnly
    ?JSON.parse(fs.readFileSync(path.join(SEARCH_RUNTIME,'summary.json'),'utf8'))
    :await runShard({shard:7,shards:8,resume:true,...limits,
      onPair:p=>console.log(JSON.stringify({event:'pair-search',pair:p.index,pass:p.pass,
        visited:p.visited,unresolved:p.unresolved,excludedDraw:p.excludedDraw,status:p.status}))});
  const searchExport=JSON.parse(fs.readFileSync(path.join(SEARCH_RUNTIME,'best-routes.json'),'utf8'));
  assert.equal(searchReport.generation,searchExport.generation);
  assert.equal(searchReport.sourceHash,searchExport.sourceHash);
  const searchRoutes=searchExport.routes;
  const routeUsage=[];
  for(const r of [...manualRoutes,...searchRoutes]) {
    const initial=r.hand.reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{});
    const minima={...initial};
    const g=await startRoute(r.hand,{seed:r.seed,deckOrder:r.deckOrder});
    try {
      for(const step of r.steps) {
        assert.equal(hash({pending:g.pending,board:board(g)}),step.before);
        respond(g,step.input);
        const current=zone(g,'hand').reduce((m,c)=>(m[c]=(m[c]||0)+1,m),{});
        for(const c of Object.keys(minima))minima[c]=Math.min(minima[c],current[c]||0);
      }
      assert.equal(hash(board(g)),r.finalHash);
      assert(!g.log.some(e=>e.text.includes('枚ドロー')));
      routeUsage.push({route:r.id,pairId:pairId(r.hand),initialCounts:initial,minimumHandCounts:minima,
        provenInitialCardsLeavingHand:Object.entries(initial).reduce((n,[c,count])=>n+count-minima[c],0),
        caveat:'手札を離れた枚数の下限。両方使用でも専用2枚コンボの優位性や手札の同名個体を識別した証明ではない。'});
    } finally {g.close();}
  }
  const findings=searchReport.pairs.map(p=>{
    const manual=manualRoutes.filter(r=>r.pairId===p.id);
    const negative=negativeProbes.find(r=>r.pairId===p.id);
    const playable=searchRoutes.find(r=>r.pairId===p.id);
    const usage=routeUsage.find(u=>u.route===playable?.id);
    const classification=manual.some(r=>r.classification==='two-card-extension')?'genuine-two-card-extension-verified'
      :manual.some(r=>r.classification==='small-genuine-two-card-line')?'small-genuine-two-card-line-verified'
      :manual.some(r=>r.classification==='one-card-line-with-extra-spell-cost')?'one-card-line-with-extra-cost'
      :negative?'no-first-turn-development'
      :playable&&usage?.provenInitialCardsLeavingHand===2?'both-cards-used-role-comparison-unresolved'
      :playable?'limited-or-one-card-development-observed':'no-route-found-yet';
    return {...p,classification,manualRouteIds:manual.map(r=>r.id),negativeProbe:negative?.id??null,
      roleEvidence:routeUsage.filter(u=>u.pairId===p.id),
      unsupportedReason:negative?negative.summary:!playable&&!manual.length
        ?'この探索範囲では入力を持つ無ドロー展開を未発見。初期手札の不成立証明とは扱わない。':null,
      remainingReason:p.unresolved?'未展開の応答履歴がcheckpointに残る。最善性・全合法手順は未確定。':null};
  });
  const report={schemaVersion:1,shard:7,shards:8,presetHash:hash(preset),pairHash:searchReport.pairHash,
    sourceHash:searchReport.sourceHash,scope:searchReport.scope,allGamePatternsComplete:false,limits,
    publicationOnly,
    summary:{...searchReport.summary,manualNewRoutes:manualRoutes.length,negativeProbes:negativeProbes.length,
      independentlyReplayedAndUsageMeasured:routeUsage.length},pairs:findings,
    routes:manualRoutes,probes:negativeProbes,
    searchRoutes:{count:searchRoutes.length,routeIds:searchRoutes.map(r=>r.id),
      path:'runtime/multi-pair-search/shard-7/best-routes.json',
      aggregatePath:'routes/multi-search-best.json',sourceHash:searchExport.sourceHash,
      generation:searchExport.generation,
      registration:'Automatic pair-search routes are registered once through the shared aggregate, not this routes array.'},
    runtime:{directory:'runtime/multi-pair-search/shard-7',manualDirectory:'runtime/multi-pairs/shard-7',
      inventory:'runtime/multi-pairs/shard-7/inventory.json',summary:'runtime/multi-pair-search/shard-7/summary.json'},
    limitations:['初動の無ドロー応答木を新規探索した。既知templateの全pair適用検査とは別。',
      '未確定ドローを解決した枝は次の入力を一切探索せず、盤面の採点・exportをしない。',
      '小展開と複数枚の役割を区別。相手妨害・5枚初手・全盤面の優劣は未検証。']};
  fs.writeFileSync(path.join(ROOT,'routes/pair-shard-7.json'),JSON.stringify(safe(report),null,2)+'\n');
  console.log(JSON.stringify({event:'shard-complete',shard:7,...report.summary}));
}
