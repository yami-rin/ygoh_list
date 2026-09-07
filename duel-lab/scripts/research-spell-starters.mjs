import fs from 'node:fs';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,selectCard,finishRoute,replay,board,hash} from './route-harness.mjs';

const C={rabbit:69272449,cat:96676583,hare:20938824,dormouse:32061192,backup:30118811,wizard:3723262,magician:64865,dot:18789533,soul:74652966,underground:68337209,gold:75500286,terra:73628505,allure:1475311,impulse:40366667,mtp:94722358,gwc:20726052,tb:57111661,disclosure:78114463,decoder:30342076,wicked:52698008,contract:37458564,sp:29301450,ip:65741786,crypter:21848500,binder:95454996,accord:39138610};
const compact=g=>({type:g.prompt.type,title:g.prompt.title,min:g.prompt.min,max:g.prompt.max,choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:c.response})),cards:g.prompt.cards?.map((c,i)=>({i,code:c.code,name:c.name,place:c.place}))});
function run(g,commands){
  for(const command of commands){
    if(process.env.ROUTE_TRACE)console.log(JSON.stringify({command,prompt:compact(g)},(_,v)=>typeof v==='bigint'?String(v):v));
    const [kind,...args]=command;
    if(kind==='idle')select(g,c=>c.response.action===args[0]&&c.card?.code===args[1]);
    else if(kind==='chain')select(g,c=>c.card?.code===args[0]);
    else if(kind==='yes')select(g,c=>c.response.yes===true);
    else if(kind==='no')select(g,c=>c.response.yes===false);
    else if(kind==='pass')select(g,c=>c.label==='発動しない');
    else if(kind==='card')selectCard(g,args[0]);
    else if(kind==='cards')respond(g,{selection:args.map(code=>{const i=g.prompt.cards.findIndex(c=>c.code===code);assert(i>=0);return i;})});
    else if(kind==='material')select(g,c=>c.label.startsWith('選択：')&&c.card?.code===args[0]);
    else if(kind==='finish')select(g,c=>c.label==='選択を確定');
    else if(kind==='place'){const i=g.prompt.cards.findIndex(c=>c.place.sequence===args[0]);assert(i>=0);respond(g,{selection:[i]});}
    else if(kind==='position')select(g,c=>c.response.position===1);
    else if(kind==='auto'){
      for(let i=0;i<60;i++){
        const p=g.prompt;
        if(p.type==='SELECT_CHAIN')select(g,c=>c.label==='発動しない');
        else if(p.type==='SELECT_PLACE')respond(g,{selection:[0]});
        else if(p.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
        else break;
      }
    }else throw new Error('Unknown '+kind);
  }
}

const rabbitReturn=[['card',C.rabbit],['yes'],['auto'],['yes'],['card',C.mtp],['auto']];
const dormouseCat=[['idle',5,C.mtp],['card',C.rabbit],['auto'],['card',C.dormouse],['idle',0,C.dormouse],['place',0],['idle',5,C.dormouse],['auto'],['card',C.cat],['yes'],['auto']];
const spLine=[['idle',1,C.decoder],['material',C.dormouse],['place',5],['idle',1,C.sp],['material',C.decoder],['material',C.cat],['place',5],['yes'],['card',C.dormouse],['auto'],['yes'],['auto']];
const binderLine=[['idle',1,C.binder],['material',C.sp],['material',C.dormouse],['place',5],['no'],['idle',5,C.binder],['auto'],['card',C.mtp],['auto']];
const contractLine=[['idle',1,C.contract],['material',C.dormouse],['material',C.cat],['place',5],['yes'],['card',C.underground],['auto'],['card',C.magician],['idle',1,C.wicked],['material',C.contract],['material',C.magician],['place',5],['yes'],['card',C.dot],['yes'],['place',1],['position'],['yes'],['card',C.dormouse],['auto'],['card',C.backup],['yes'],['auto'],['idle',5,C.backup],['auto'],['yes'],['card',C.hare],['card',C.hare],['idle',1,C.ip],['material',C.dot],['material',C.backup],['place',1],['idle',1,C.binder],['material',C.wicked],['material',C.dormouse],['finish'],['place',5],['yes'],['card',C.hare],['auto'],['yes'],['card',C.rabbit],['auto'],['idle',5,C.binder],['auto'],['card',C.mtp],['auto']];
const routes=[];
const probes=[];
const firstBanishCoverage=[];
const baseConditions=['先攻1ターン目、相手無妨害・空盤面','初期手札は記載した1枚のみ。残り39枚とEX15枚は固定presetから厳密に差し引く','初手以外の手札コストは展開中のサーチで得る','任意ドローは使用しない'];
const codesIn=(g,zone)=>board(g).players[0][zone].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b);
function check(g,{lp,monsters,hand=[],spells}){
 assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.turn,1);assert.equal(g.turnPlayer,0);
 assert.equal(g.lp[0],lp);assert.deepEqual(codesIn(g,'monsters'),[...monsters].sort((a,b)=>a-b));
 assert.deepEqual(codesIn(g,'hand'),[...hand].sort((a,b)=>a-b));
 if(spells)assert.deepEqual(codesIn(g,'spells'),[...spells].sort((a,b)=>a-b));
}
function spellPrefix(starter){
 const commands=[];
 if(starter===C.terra)commands.push(['idle',5,C.terra],['auto'],['card',C.underground]);
 return [...commands,...(starter===C.gold?[['idle',5,C.gold],['auto']]:[['idle',5,C.underground],['yes']])];
}
for(const starter of [C.gold,C.underground,C.terra]){
 for(const ending of starter===C.gold?['sp','binder']:['sp','binder','contract']){
  const g=await startRoute([starter]);
  try{
   const commands=[];
   if(starter===C.terra)commands.push(['idle',5,C.terra],['auto'],['card',C.underground]);
   commands.push(...(starter===C.gold?[['idle',5,C.gold],['auto']]:[['idle',5,C.underground],['yes']]),...rabbitReturn,...dormouseCat);
   commands.push(...(ending==='contract'?contractLine:spLine));if(ending==='binder')commands.push(...binderLine);
   run(g,commands);
   const fieldSpell=starter===C.gold?[]:[C.underground];
   const expected=ending==='contract'?{lp:6800,monsters:[C.ip,C.binder],hand:[C.rabbit],spells:[C.mtp]}:ending==='sp'?{lp:7100,monsters:[C.sp,C.dormouse],spells:fieldSpell}:{lp:7100,monsters:[C.binder],spells:[...fieldSpell,C.mtp]};
   check(g,expected);assert(!g.log.some(x=>x.text.includes('枚ドロー')),'Deterministic route must not draw');
   routes.push(finishRoute(g,{id:`spell-${starter}-${ending}`,starter,name:cards[starter].name,classification:'one-card',conditions:baseConditions,requiresDraw:false,summary:ending==='contract'?'UNDERGROUNDをContractのコストにしてCode Magician→Wicked、I:P＋WHITE BINDER＋MTP伏せ＋手札Rabbit':'Rabbit→MTPでDormouse通常召喚→Cat帰還→Decoder経由S:PでDormouseを再利用'+(ending==='binder'?'→WHITE BINDER＋MTP再セット':'。S:P＋Dormouseで停止'),commands,expected,limitations:['相手ターンの妨害分岐はこの先攻到達テストの対象外','このカードからの全合法手順・最大盤面の証明ではない']}));
  }finally{g.close();}
 }
}
// Dormouse first consumes its return; normal-summoned Cat retains its return.
const swapMice=commands=>commands.map(command=>command.map(value=>value===C.cat?C.dormouse:value===C.dormouse?C.cat:value));
const dormouseFirst=[['card',C.dormouse],['yes'],['auto'],['idle',5,C.dormouse],['auto'],...rabbitReturn,
 ['idle',5,C.mtp],['card',C.rabbit],['auto'],['card',C.cat],['idle',0,C.cat],['place',1]];
for(const starter of [C.gold,C.underground,C.terra]){
 for(const ending of starter===C.gold?['sp','binder']:['sp','binder','contract']){
  const g=await startRoute([starter]);
  try{
   const commands=[...spellPrefix(starter),...dormouseFirst,...swapMice(ending==='contract'?contractLine:spLine)];
   if(ending==='binder')commands.push(...swapMice(binderLine));
   run(g,commands);
   const fieldSpell=starter===C.gold?[]:[C.underground];
   const expected=ending==='contract'?{lp:6800,monsters:[C.ip,C.binder],hand:[C.rabbit],spells:[C.mtp]}:ending==='sp'?{lp:7100,monsters:[C.sp,C.cat],spells:fieldSpell}:{lp:7100,monsters:[C.binder],spells:[...fieldSpell,C.mtp]};
   check(g,expected);assert(!g.log.some(x=>x.text.includes('枚ドロー')));
   routes.push(finishRoute(g,{id:`spell-${starter}-dormouse-first-${ending}`,starter,name:cards[starter].name,classification:'one-card',conditions:baseConditions,requiresDraw:false,firstBanish:C.dormouse,summary:'Dormouseを先に除外→Rabbit帰還/MTP→Cat通常召喚。未使用のCat帰還を活用して'+(ending==='contract'?'Contract→Wicked→I:P＋Binder＋MTP＋手札Rabbit':ending==='binder'?'Decoder/S:P経由でBinder＋MTP':'Decoder/S:P経由でS:P＋Cat'),commands,expected,limitations:['相手ターンの妨害・任意ドロー追加展開は未実行']}));
  }finally{g.close();}
 }
}
const hareAccord=[['idle',5,C.mtp],['card',C.rabbit],['auto'],['card',C.dormouse],['idle',0,C.dormouse],['place',0],['idle',5,C.dormouse],['auto'],['card',C.hare],['yes'],['card',C.hare],['auto'],['idle',1,C.decoder],['material',C.dormouse],['place',5],['auto'],['idle',5,C.hare],['card',C.dormouse],['auto'],['yes'],['auto'],['idle',1,C.binder],['material',C.decoder],['material',C.dormouse],['material',C.hare],['place',5]];
const hareAccordFinish=[['chain',C.decoder],['auto'],['idle',5,C.binder],['auto'],['card',C.tb],['auto'],['idle',5,C.tb],['card',C.binder],['auto'],['card',C.cat],['auto'],['yes'],['auto'],['no'],['no'],['idle',1,C.accord],['material',C.binder],['material',C.decoder],['material',C.cat],['place',5],['yes'],['card',C.binder],['place',1],['no']];
for(const starter of [C.gold,C.underground,C.terra]){
 const g=await startRoute([starter]);
 try{
  const commands=[...spellPrefix(starter),...rabbitReturn,...hareAccord,...hareAccordFinish];run(g,commands);
  const expected={lp:6200,monsters:[C.accord,C.binder],spells:starter===C.gold?[]:[C.underground]};check(g,expected);
  assert(!g.log.some(x=>x.text.includes('枚ドロー')));
  routes.push(finishRoute(g,{id:`spell-${starter}-rabbit-hare-accord`,starter,name:cards[starter].name,classification:'one-card',firstBanish:C.rabbit,dormouseBanish:C.hare,conditions:baseConditions,requiresDraw:false,summary:'Rabbit→MTP→Dormouse通常召喚→Hare自己回収→Decoder/Hare/DormouseでBinder＋Decoder帰還→TBでCatを呼びBinder帰還→Accord＋Binder、6200LP。Wicked/Backup/Magician/DotとS:Pを使用しない。',commands,expected,capabilities:['Accordの1ターン1回の発動無効・除外のコストとして、リンク先Binderを保持'],limitations:['同時に得られる無効回数はAccordの1回であり、素材の数を妨害数に数えない','相手ターンの応答は別検証']}));
 }finally{g.close();}
}
// Enumerate the actual core's first-banish menu, including every duplicate copy.
for(const starter of [C.gold,C.underground,C.terra]){
 const opening=await startRoute([starter]);let candidates;
 try{
  run(opening,spellPrefix(starter));assert.equal(opening.prompt.type,'SELECT_CARD');
  candidates=[...new Set(opening.prompt.cards.map(c=>c.code))].sort((a,b)=>a-b).map(code=>({code,name:cards[code].name,copies:opening.prompt.cards.filter(c=>c.code===code).length}));
 }finally{opening.close();}
 const coverage={starter,name:cards[starter].name,candidates,checked:[],scope:'初回除外のカード名別全合法候補。以後の全手順木を列挙したものではない。'};
 for(const target of candidates){
  const g=await startRoute([starter]);
  try{
   const commands=[...spellPrefix(starter),['card',target.code]];
   run(g,commands);
   if([C.rabbit,C.dormouse,C.cat,C.dot].includes(target.code)){
    assert.equal(g.prompt.type,'SELECT_EFFECTYN');run(g,[['yes'],['auto']]);commands.push(['yes'],['auto']);
    if(target.code===C.rabbit){run(g,[['yes'],['card',C.mtp],['auto']]);commands.push(['yes'],['card',C.mtp],['auto']);}
   }else if(target.code===C.hare){
    assert.equal(g.prompt.type,'SELECT_EFFECTYN');const selfReturn=[['yes'],['card',C.hare],['auto']];run(g,selfReturn);commands.push(...selfReturn);
   }
   assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.errors.length,0);
   const initialResolution=board(g);
   const spawned=[C.rabbit,C.dormouse,C.cat,C.dot].includes(target.code);
   assert.deepEqual(codesIn(g,'monsters'),spawned?[target.code]:[]);
   assert.deepEqual(codesIn(g,'hand'),target.code===C.hare?[C.hare]:[]);
   assert.equal(g.lp[0],(spawned&&target.code!==C.dot)||target.code===C.hare?7700:8000);
   let outcome=target.code===C.rabbit?'Rabbit帰還＋MTPセット。以後の有用展開をroutesに保存。':target.code===C.dormouse?'Dormouse帰還。自身のデッキ除外効果からの有用展開をroutesに保存。':spawned?'帰還は成功するが単独で追加の手札を持たない。':'除外で発動する展開効果なし。自分モンスター0、手札0。';
   if([C.cat,C.dot,C.hare].includes(target.code)){
    assert(!g.prompt.choices.some(c=>c.response.action===5),'Unexpected extender effect after first return');
    if(target.code===C.hare){const normal=[['idle',0,C.hare],['place',0]];run(g,normal);commands.push(...normal);}
    const continuation=[['idle',1,C.decoder],['material',target.code],['place',5]];run(g,continuation);commands.push(...continuation);
    check(g,{lp:target.code===C.dot?8000:7700,monsters:[C.decoder],spells:starter===C.gold?[]:[C.underground]});
    assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),'Unexpected continuation after sole body became Link-1');
    outcome=target.code===C.dot?'Dot帰還→Decoder。Dotはこのターンいずれか一方の効果のみなので、素材として墓地へ送られても再帰還せず、追加展開不可。':target.code===C.hare?'Hareは除外された自身を300LPで手札に回収可能。自身を通常召喚→Decoderまで。追加のM∀LICE手札・墓地がなく、単独では展開が伸びない。':'Cat帰還→Decoder。手札に除外するM∀LICEがなくCatのドロー効果を発動できず、追加展開不可。';
   }else if(!spawned)assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),'Unexpected action from non-triggering banish');
   const id=`spell-probe-${starter}-banish-${target.code}`;
   const routeIds=routes.filter(r=>r.starter===starter&&(r.firstBanish??C.rabbit)===target.code).map(r=>r.id);
   probes.push(finishRoute(g,{id,starter,name:cards[starter].name,firstBanish:target.code,targetName:target.name,conditions:baseConditions,requiresDraw:false,summary:outcome,initialResolution,routeIds,commands,limitations:['Cat/Dot/Hareの負例は初回除外後の効果と唯一の素材のL1化を検証。すべての将来ターン・全EX選択を探索した主張ではない']}));
   coverage.checked.push({code:target.code,probeId:id,routeIds});
  }finally{g.close();}
 }
 assert.deepEqual(coverage.checked.map(x=>x.code),candidates.map(x=>x.code));firstBanishCoverage.push(coverage);
}
for(const starter of [C.impulse,C.mtp,C.gwc,C.tb,C.disclosure]){
 const g=await startRoute([starter]);
 try{
  assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),'Trap has a first-turn action other than setting');
  const commands=[['idle',4,starter],['auto']];run(g,commands);
  assert(!g.prompt.choices.some(c=>[0,1,5].includes(c.response.action)),'Set trap unexpectedly activates on empty turn one');
  check(g,{lp:8000,monsters:[],spells:[starter]});
  routes.push(finishRoute(g,{id:`spell-${starter}-no-starter`,starter,name:cards[starter].name,classification:'not-one-card',conditions:baseConditions,requiresDraw:false,summary:'空盤面・この罠1枚ではセットまで。先攻当日のモンスター展開を開始できない。',commands}));
 }finally{g.close();}
}
{
 const g=await startRoute([C.allure]);
 try{
  run(g,[['idle',5,C.allure],['auto']]);
  check(g,{lp:8000,monsters:[],spells:[]});
  assert.deepEqual(codesIn(g,'grave'),[C.allure,C.tb,C.disclosure].sort((a,b)=>a-b));
  assert(g.log.some(x=>x.text.includes('2 枚ドロー')));
  routes.push(finishRoute(g,{id:`spell-${C.allure}-no-dark-draw`,starter:C.allure,name:cards[C.allure].name,classification:'draw-dependent',conditions:['先攻1ターン目、手札は闇の誘惑のみ','固定fixtureのドローは神の密告とTB－11。通常対戦の確率分布を表すものではない'],requiresDraw:true,summary:'闇の誘惑の2ドローに闇属性モンスターがなく、2枚とも墓地へ。単独で展開を保証しない反例。',commands:[['idle',5,C.allure],['auto']],limitations:['有利なドロー組合せの全列挙は行っていない','初手に別のM∀LICEモンスターを足した場合は2枚初動として別評価が必要']}));
 }finally{g.close();}
}
const classifications=[
 [C.underground,'one-card','Rabbit帰還→MTP→Dormouse通常召喚→Cat帰還が確定。場に残る自身をContractのコストとしてI:P＋Binder＋MTP＋手札Rabbitまで無ドロー依存で到達。'],
 [C.gold,'one-card','Rabbit→MTP→Dormouse通常召喚からHareを自己回収する線でAccord＋Binder、6200LPを実証。S:P＋Dormouse/CatやBinder＋MTPの分岐もある。自身は解決後墓地なので、UndergroundのContractコスト分岐とは区別する。'],
 [C.terra,'one-card','デッキのUndergroundをサーチし、同じContract分岐へ到達。'],
 [C.allure,'draw-dependent','2ドロー後の闇属性の有無・除外後に残る札次第。唯一の手札では展開保証がなく、確定1枚初動に数えない。M∀LICEを除外する役割は追加のM∀LICE手札またはドロー成功が前提。'],
 [C.impulse,'not-one-card','相手の特殊召喚を含む効果への反応札。相手空盤面の自分先攻ターン、これ1枚から自分の展開を始める効果はない。'],
 [C.mtp,'not-one-card','セット当日の発動には自分の表側M∀LICEが必要。空盤面からこの罠1枚だけでは用意できない。翌ターンの通常罠としてのサーチとは区別。'],
 [C.gwc,'not-one-card','蘇生対象となる墓地・除外のM∀LICEと、セット当日なら表側M∀LICEが必要。空盤面の1枚ではどちらもない。'],
 [C.tb,'not-one-card','デッキから出せるが、セット当日は表側M∀LICEを除外する条件が必要。翌ターンの通常罠運用とは区別。'],
 [C.disclosure,'not-one-card','魔法・罠への反応札。セット当日の公開コストは他の裏側罠なのでこの1枚では満たさず、展開効果もない。'],
].map(([code,classification,reason])=>({code,name:cards[code].name,classification,reason}));
for(const route of routes){await replay(route);console.log(`PASS ${route.id}: ${route.steps.length} inputs; LP ${route.final.lp[0]}`);}
for(const probe of probes)await replay(probe);
for(const coverage of firstBanishCoverage)console.log(`PASS first-banish ${coverage.starter}: ${coverage.checked.length}/${coverage.candidates.length} distinct legal targets; ${coverage.candidates.reduce((sum,c)=>sum+c.copies,0)} copies`);
const sourceCodes=[...new Set([...classifications.map(c=>c.code),...firstBanishCoverage.flatMap(c=>c.candidates.map(c=>c.code))])].sort((a,b)=>a-b);
const result={schemaVersion:1,scope:'固定preset・魔法4種類/罠5種類の先攻1枚初動判定、最初の除外先全候補検査、主要な無妨害ルート。全合法手順木・最強盤面・対妨害の網羅証明ではない。',assumptions:baseConditions,classifications,routes,probes,firstBanishCoverage,unresolved:['初回除外候補は全種類検査済みだが、その後の全EX変換・全対象・全手順順序の木は未列挙','CatやBinderの任意ドローによる追加展開は確定到達に含めない','相手の誘発に応じた分岐・次ターンの実戦妨害・罠単独の後攻運用は別検証','他の初手4枚を使うサーチ/捨て札最適化は別の複数枚初動に分類する'],cardSources:sourceCodes.map(code=>({code,name:cards[code].name,source:'data/cards.json',sha256:hash(cards[code])}))};
const out=new URL('../routes/spell-starters.json',import.meta.url);fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(`Verified ${routes.length} routes + ${probes.length} first-banish probes / ${classifications.length} distinct spell-trap cards.`);
