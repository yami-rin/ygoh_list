import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';
import {loadOpeningTemplates,bestOpening} from '../opening-policy.mjs';
import {openingSources} from '../opening-sources.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUTPUT=path.join(ROOT,'routes/multi-opening-survey.json');
const SOURCE_NAMES=openingSources();
const CODE_FILES=['opening-sources.mjs','opening-policy.mjs','opening-semantics.mjs','opening-placement.mjs','engine.mjs','prompts.mjs','scripts/route-harness.mjs'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const safe=value=>JSON.parse(JSON.stringify(value,(_,item)=>typeof item==='bigint'?String(item):item));
const hash=value=>digest(JSON.stringify(safe(value)));
const counts=values=>values.reduce((map,code)=>(map[code]=(map[code]||0)+1,map),{});
const sum=(values,key)=>values.reduce((total,value)=>total+(value[key]||0),0);
const pairId=hand=>[...hand].sort((a,b)=>a-b).join('-');

export function enumeratePairs(main) {
  const copies=counts(main),codes=Object.keys(copies).map(Number).sort((a,b)=>a-b),pairs=[];
  for(let i=0;i<codes.length;i++)for(let j=i;j<codes.length;j++) {
    const a=codes[i],b=codes[j];if(a===b&&copies[a]<2)continue;
    pairs.push({id:pairId([a,b]),hand:[a,b],physicalWeight:a===b?copies[a]*(copies[a]-1)/2:copies[a]*copies[b]});
  }
  assert.equal(new Set(pairs.map(pair=>pair.id)).size,pairs.length);
  assert.equal(sum(pairs,'physicalWeight'),main.length*(main.length-1)/2,'Pair multiplicities do not cover every physical two-card combination');
  return pairs;
}

function handCode(value) {
  const parsed=typeof value==='string'?JSON.parse(value):value;
  const code=typeof parsed==='number'?parsed:parsed?.code;
  assert(Number.isSafeInteger(code)&&code>0,'Opening hand frame contains an unknown card');return code;
}

/** Minimum hand counts prove a lower bound on how many original cards left the
 * hand. Explicit hand choices and final retention are separate observations;
 * they do not identify an individual copy after searching or returning cards. */
export function handUsage(plan,template) {
  const initial=counts(plan.hand);
  const observations=plan.frames.map(frame=>counts(frame.state.own.hand.map(handCode)));
  const final=counts(plan.final.players[0].hand.filter(Boolean).map(handCode));observations.push(final);
  const explicit=[];
  for(let index=0;index<plan.frames.length;index++) {
    const frame=plan.frames[index],selected=[];
    if(frame.request.kind==='single') {
      const option=frame.request.choices.find(choice=>choice.id===frame.decision.action)?.option;
      if(option&&typeof option==='object'&&option.answer!==false)selected.push(option.card??option.context?.card);
    } else if(frame.request.kind==='multi'&&!frame.decision.cancel) {
      for(const selectedIndex of frame.decision.selection)selected.push(frame.request.cards[selectedIndex]);
    }
    for(const card of selected)if(card?.location==='Hand'&&card.controller===1&&initial[card.code]) {
      explicit.push({step:index+1,prompt:frame.type,code:card.code});
    }
  }
  const evidence=Object.entries(initial).map(([code,count])=>{
    code=Number(code);const minimum=Math.min(count,...observations.map(observation=>observation[code]||0));
    return {code,name:cards[code]?.name??String(code),initial:count,minimumInHand:minimum,finalInHand:final[code]||0,
      originalCardsKnownToHaveLeftHand:Math.max(0,count-minimum),explicitHandChoiceSteps:explicit.filter(entry=>entry.code===code).map(entry=>entry.step)};
  });
  const left=sum(evidence,'originalCardsKnownToHaveLeftHand');
  const retained=evidence.reduce((total,entry)=>total+Math.min(entry.initial,entry.finalInHand),0);
  let kind=left===2?'both_initial_cards_left_hand':'usage_not_fully_identified';
  if(left<2&&plan.requiredHand.length===1&&new Set(plan.hand).size===2) {
    const partner=evidence.find(entry=>entry.code!==plan.requiredHand[0]);
    if(partner&&partner.minimumInHand>=1&&partner.finalInHand>=1&&!partner.explicitHandChoiceSteps.length)kind='single_card_line_partner_retained';
  }
  return {kind,genericDiscardTemplate:!!template?.genericDiscard,requiredHand:[...plan.requiredHand],
    provenOriginalCardsLeftHand:left,initialHandSize:2,
    matchingNamesRetainedAtEndpoint:retained,
    endpointSameNameRetentionRatio:{numerator:retained,denominator:2,meaning:'初期手札と同名カードの終端残存比。未使用個体の割合と断定しない。'},
    evidence,explicitHandChoices:explicit,
    caveat:'同名個体のIDは追跡しない。終端に同名カードがあっても未使用とは断定しない。2枚の使用には召喚・素材・除外・手札コスト等を含み、2枚専用コンボの優位性を意味しない。'};
}

function inputSnapshot() {
  const files=['preset.json',...CODE_FILES,...SOURCE_NAMES.map(name=>`routes/${name}.json`)];
  const manifest=files.map(file=>{const bytes=fs.readFileSync(path.join(ROOT,file));return {path:file,sha256:digest(bytes),bytes:bytes.length};});
  const preset=JSON.parse(fs.readFileSync(path.join(ROOT,'preset.json'),'utf8'));
  assert.equal(preset.main.length,40,'This survey is for the fixed 40-card preset');
  return {preset,manifest,identity:hash(manifest)};
}
function writeAtomic(file,value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,typeof value==='string'?value:JSON.stringify(safe(value),null,2)+'\n');fs.renameSync(temporary,file);
}
function endpoint(final) {
  const own=final.players[0];
  return {turn:final.turn,phase:final.phase,lp:final.lp,
    hand:own.hand.map(card=>card.code),monsters:own.monsters.filter(Boolean).map(card=>({code:card.code,sequence:card.sequence,position:card.position})),
    spells:own.spells.filter(Boolean).map(card=>({code:card.code,sequence:card.sequence,position:card.position})),
    grave:own.grave.map(card=>card.code),banished:own.banished.map(card=>card.code),extraRemaining:own.extra.length,
    meaning:'既知ルートの停止点（先攻Main 1）。ターン終了や全展開木の終端ではない。'};
}

export function validateSurvey(report,preset) {
  const pairs=enumeratePairs(preset.main),wanted=new Map(pairs.map(pair=>[pair.id,pair]));
  assert.equal(report.presetHash,hash(preset));
  assert.equal(report.pairInventory.physicalCombinationTotal,780);
  assert.equal(new Set(report.pairs.map(pair=>pair.id)).size,report.pairs.length,'Duplicate pair result');
  for(const pair of report.pairs) {
    assert(wanted.has(pair.id),`Unexpected pair ${pair.id}`);assert.deepEqual(pair.hand,wanted.get(pair.id).hand);
    assert.equal(pair.physicalWeight,wanted.get(pair.id).physicalWeight);
    assert.equal(pair.attempted,pair.candidates,'The candidate limit must be Infinity');
    assert.equal(pair.successfulCandidates,pair.attempted-pair.failures.length);
    assert.equal(pair.status==='supported',!!pair.best);
    if(pair.best){assert.equal(pair.best.drawDependent,false);assert(pair.best.responseCount>0);assert(Number.isFinite(pair.best.score));}
  }
  assert.equal(report.summary.checkedPairs,report.pairs.length);
  assert.equal(report.summary.supportedPairs,report.pairs.filter(pair=>pair.status==='supported').length);
  assert.equal(report.complete,report.pairs.length===pairs.length&&!report.sourceChangedDuringRun);
  if(report.complete)assert.deepEqual(report.pairs.map(pair=>pair.id),pairs.map(pair=>pair.id));
}

function reportMarkdown(report) {
  const usage=report.summary.usageKinds;
  const lines=['# 既知ルートの全2枚組適用検証','',
    `固定40枚から作れる合法な2枚multisetは${report.pairInventory.distinctPairs}種類。${report.summary.checkedPairs}種類を検証し、${report.summary.supportedPairs}種類で既知ルートを適用、${report.summary.unsupportedPairs}種類は未対応。物理的な組合せの重みは合計${report.pairInventory.physicalCombinationTotal}=C(40,2)。`,'',
    `これは**既知ルートの全pair適用検証**であり、各pairの全合法手順木の探索ではない。検証状態は${report.complete?'完了':'未完了'}。未対応を「その手札では展開できない」証明として扱わない。`,'',
    `読み込んだ無ドローtemplateは${report.templateCatalog.length}件。bestOpeningの候補上限をInfinityにし、適合候補${report.summary.candidateAttempts}件をすべて実手札へ予備再生した。適用失敗は${report.summary.candidateFailures}件で、ルール上の不成立以外にアダプタの不一致も含み得る。今回の生成で${report.summary.reusedPairs}pairは同じsource版の保存結果を再利用した。`,'',
    '## 初期手札の使用','',
    `採用された最良既知ルートのうち、両方の初期カードが手札を離れた証拠あり ${usage.both_initial_cards_left_hand||0}件、1枚ルートで相方の残存を観測 ${usage.single_card_line_partner_retained||0}件、使用個体を完全には特定できないもの ${usage.usage_not_fully_identified||0}件。`,'',
    'requiredHandの枚数だけで分類しない。全入力前の手札最小枚数、手札を明示的に選んだ入力、終端の同名残存数/2を保存する。genericDiscardによる相方の手札コストも使用に含める。同名個体を追跡しないため、同名カードが残っただけでは未使用と断定しない。','',
    '## 評価と終端','',
    'scoreはopeningScoreの手動重み。盤面のカード、罠、手札、LP、入力数の小さなペナルティで比較しており、勝率や貫通率ではない。最良は今回適用できた既知候補の中だけの比較。停止点は先攻Main 1のルート完了地点であり、ターン終了ではない。','',
    '## 全pair','',
    '| 2枚組 | 物理重み | 適用 | 採用ルート | 入力 | score | 手札使用 |',
    '| --- | ---: | --- | --- | ---: | ---: | --- |'];
  const usageName={both_initial_cards_left_hand:'両方使用の証拠',single_card_line_partner_retained:'1枚＋相方残存',usage_not_fully_identified:'個体の使用未確定'};
  for(const pair of report.pairs)lines.push(`| ${pair.names.join(' + ')} | ${pair.physicalWeight} | ${pair.best?'適用':'未対応'} | ${pair.best?.id??'—'} | ${pair.best?.responseCount??'—'} | ${pair.best?pair.best.score.toFixed(4):'—'} | ${pair.best?usageName[pair.best.usage.kind]:'—'} |`);
  lines.push('','## 再生成・検証','',
    'duel-labディレクトリで実行する。sourceやpolicy更新後は新しいNodeプロセスで生成する。','',
    '~~~powershell','node scripts/survey-multi-openings.mjs','node scripts/survey-multi-openings.mjs --verify','node --test tests/multi-opening-survey.test.mjs','~~~','',
    '全フレームはruntime/multi-openings配下。tracked JSONは採用ルート、requiredHand、score、入力数、終端、手札使用根拠、失敗候補を保存する。ドロー後の分岐は列挙しない。');
  return lines.join('\n')+'\n';
}

async function verifySaved() {
  const current=inputSnapshot(),report=JSON.parse(fs.readFileSync(OUTPUT,'utf8'));validateSurvey(report,current.preset);
  assert.equal(report.sourceIdentity,current.identity,'Policy or route sources changed: regenerate the survey');
  let traces=0;
  for(const pair of report.pairs) {
    const bytes=fs.readFileSync(path.join(ROOT,pair.trace.path));assert.equal(digest(bytes),pair.trace.sha256);
    const trace=JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(trace.hand,pair.hand);assert.equal(trace.sourceIdentity,report.sourceIdentity);
    assert.equal(trace.result.attempted,pair.attempted);assert.deepEqual(trace.result.failures,pair.failures);
    if(pair.best){
      const plan=trace.result.plan;
      const template=report.templateCatalog.find(entry=>entry.source===plan.source&&entry.id===plan.id);assert(template);
      assert.deepEqual(pair.best,{id:plan.id,source:plan.source,requiredHand:plan.requiredHand,responseCount:plan.responseCount,
        score:plan.score,drawDependent:plan.drawDependent,endpoint:endpoint(plan.final),usage:handUsage(plan,template)});
    }
    traces++;
  }
  console.log(`SURVEY VERIFY PASS: ${report.pairs.length} unique pairs, physical weight 780, ${traces} trace hashes, all matching candidates attempted`);
}

async function main() {
  const args=process.argv.slice(2);assert(args.every(arg=>arg==='--verify'||arg==='--resume'),'Unknown survey argument');
  if(args.includes('--verify')){await verifySaved();return;}
  const began=Date.now(),input=inputSnapshot(),templates=await loadOpeningTemplates();
  assert.equal(inputSnapshot().identity,input.identity,'Sources changed while loading templates; start a fresh process');
  const pairs=enumeratePairs(input.preset.main);
  assert.equal(pairs.length,333,'The fixed preset pair inventory changed');
  const runtime=path.join(ROOT,'runtime/multi-openings',input.identity.slice(0,16));
  const templateMap=new Map(templates.map(template=>[`${template.source}/${template.id}`,template]));
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),presetHash:hash(input.preset),sourceIdentity:input.identity,
    sources:input.manifest,sourceChangedDuringRun:false,complete:false,
    scope:'既知の検証済み無ドロールートを全合法2枚multisetの実手札へ適用。全pairの手順木やドロー後の全展開ではない。',
    pairInventory:{distinctPairs:pairs.length,distinctNamePairs:pairs.filter(pair=>pair.hand[0]!==pair.hand[1]).length,
      sameNamePairs:pairs.filter(pair=>pair.hand[0]===pair.hand[1]).length,physicalCombinationTotal:sum(pairs,'physicalWeight'),
      independentlyExpectedPhysicalCombinations:input.preset.main.length*(input.preset.main.length-1)/2},
    templateCatalog:templates.map(template=>({id:template.id,source:template.source,requiredHand:template.hand,
      baselineInputs:template.steps.length,baselineScore:template.score,genericDiscard:template.genericDiscard})),
    scoreMeaning:'openingScoreの手動重みであり勝率ではない。適用できた既知候補内だけの最大値。',pairs:[],summary:{}};
  const publish=()=>{
    report.summary={checkedPairs:report.pairs.length,supportedPairs:report.pairs.filter(pair=>pair.best).length,
      unsupportedPairs:report.pairs.filter(pair=>!pair.best).length,candidateAttempts:sum(report.pairs,'attempted'),
      reusedPairs:report.pairs.filter(pair=>pair.reused).length,freshlyEvaluatedPairs:report.pairs.filter(pair=>!pair.reused).length,
      candidateFailures:report.pairs.reduce((n,pair)=>n+pair.failures.length,0),
      usageKinds:report.pairs.filter(pair=>pair.best).reduce((map,pair)=>(map[pair.best.usage.kind]=(map[pair.best.usage.kind]||0)+1,map),{}),
      elapsedMs:Date.now()-began};
    report.sourceChangedDuringRun=inputSnapshot().identity!==input.identity;
    report.complete=report.pairs.length===pairs.length&&!report.sourceChangedDuringRun;
    validateSurvey(report,input.preset);writeAtomic(OUTPUT,report);writeAtomic(path.join(ROOT,'docs/MULTI_OPENINGS.md'),reportMarkdown(report));
  };
  for(const pair of pairs) {
    const traceFile=path.join(runtime,`${pair.id}.json`);
    let result,reused=false;
    if(args.includes('--resume')&&fs.existsSync(traceFile)) {
      const trace=JSON.parse(fs.readFileSync(traceFile,'utf8'));
      assert.equal(trace.sourceIdentity,input.identity);assert.deepEqual(trace.hand,pair.hand);result=trace.result;reused=true;
    } else {
      result=await bestOpening(templates,pair.hand,{maxCandidates:Infinity});
      assert.equal(result.attempted,result.candidates);
      writeAtomic(traceFile,{sourceIdentity:input.identity,hand:pair.hand,result});
    }
    const plan=result.plan,template=plan?templateMap.get(`${plan.source}/${plan.id}`):null;
    assert(!plan||template,'Selected plan must come from the loaded templates');
    const record={...pair,names:pair.hand.map(code=>cards[code].name),status:plan?'supported':'unsupported',
      candidates:result.candidates,attempted:result.attempted,successfulCandidates:result.attempted-result.failures.length,
      failures:result.failures,unsupportedReason:plan?null:result.candidates?'全適合候補の適用に失敗。未知の展開やアダプタの改善余地は未検証。':'適合する既知templateなし。不成立の証明ではない。',
      best:plan?{id:plan.id,source:plan.source,requiredHand:plan.requiredHand,responseCount:plan.responseCount,
        score:plan.score,drawDependent:plan.drawDependent,endpoint:endpoint(plan.final),usage:handUsage(plan,template)}:null,
      trace:{path:path.relative(ROOT,traceFile).replaceAll('\\','/'),sha256:digest(fs.readFileSync(traceFile))},reused};
    report.pairs.push(record);
    if(report.pairs.length%10===0||report.pairs.length===pairs.length) {
      publish();console.log(`SURVEY ${report.pairs.length}/${pairs.length}: supported=${report.summary.supportedPairs}, attempts=${report.summary.candidateAttempts}, failures=${report.summary.candidateFailures}, sourceChanged=${report.sourceChangedDuringRun}`);
    }
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
