import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {cards} from '../cards.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FILES=['exhaustive-others.json','exhaustive-cyberse.json','exhaustive-rabbit.json','exhaustive-dormouse.json',
  'exhaustive-gold.json','exhaustive-underground.json','exhaustive-draws.json','allure-continuations.json','optional-draw-continuations.json'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const hash=value=>digest(JSON.stringify(value));
const count=value=>Array.isArray(value)?value.length:Number.isSafeInteger(value)&&value>=0?value:0;
const knownCount=value=>Array.isArray(value)?value.length:Number.isSafeInteger(value)&&value>=0?value:null;
const sum=(items,key)=>items.reduce((total,item)=>total+count(item[key]),0);
const checkpoint=value=>typeof value==='string'?value:value?.path;
const reasons=value=>value&&!Array.isArray(value)&&typeof value==='object'?value:{};
const complete=(value,frontier,failures=0)=>value===true&&knownCount(frontier)===0&&count(failures)===0;

/** Read one consistent set of published JSON files. Workers may publish while
 * this runs; retry changed snapshots instead of mixing two reads of one file. */
export function loadSourceDocuments(base=ROOT) {
  let lastError;
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const presetBytes=fs.readFileSync(path.join(base,'preset.json'));
      const available=fs.readdirSync(path.join(base,'routes')).filter(name=>/^exhaustive-.*\.json$/.test(name)||/^(allure|optional-draw)-continuations\.json$/.test(name));
      assert.deepEqual([...available].sort(),[...FILES].sort(),'Search source files changed: add an explicit coverage adapter');
      const documents={},metadata=[];
      for(const name of FILES) {
        const bytes=fs.readFileSync(path.join(base,'routes',name));
        documents[name]=JSON.parse(bytes.toString('utf8'));
        metadata.push({path:`routes/${name}`,sha256:digest(bytes),bytes:bytes.length});
      }
      assert.equal(digest(fs.readFileSync(path.join(base,'preset.json'))),digest(presetBytes),'Preset changed while reading');
      for(const source of metadata)assert.equal(digest(fs.readFileSync(path.join(base,source.path))),source.sha256,`Source changed while reading: ${source.path}`);
      return {preset:JSON.parse(presetBytes.toString('utf8')),documents,metadata};
    } catch(error) {lastError=error;}
  }
  throw lastError;
}

function work(units) {
  const seen=new Set(),kept=[];
  for(const unit of units) {
    assert(unit.id,'Work unit needs an identity');
    if(seen.has(unit.id))continue; // A source may expose its last job twice.
    seen.add(unit.id);kept.push(unit);
  }
  return {visited:sum(kept,'visited'),terminalHistories:sum(kept,'terminals'),frontierEntries:sum(kept,'frontier'),
    unstartedCases:sum(kept,'unstarted'),failures:sum(kept,'failures'),reportedChanceBoundaries:sum(kept,'chance'),units:kept};
}

function unit(id,value,{visited=value.visited,terminals=value.terminals,frontier=value.frontier,unstarted=0,chance,failures=value.failures}={}) {
  const why=reasons(value.frontierReasons??value.reasons??value.reasonCounts);
  return {id,visited:count(visited),terminals:count(terminals),frontier:count(frontier),unstarted:count(unstarted),failures:count(failures),
    chance:chance===undefined?sum(Object.entries(why).filter(([key])=>/draw|chance/i.test(key)).map(([,n])=>({n})),'n'):count(chance),
    frontierReasons:why};
}

/** Pure report assembly. Root coverage and chance continuation coverage stay
 * separate; completed directed subtrees never prove an entire opening. */
export function buildSearchReport({preset,documents:d,metadata=[]},{generatedAt=new Date().toISOString()}={}) {
  const presetHash=hash(preset),codes=[...new Set(preset.main)];
  assert.equal(codes.length,26,'The fixed preset must contain 26 distinct main-deck card codes');
  for(const file of FILES) {
    assert(d[file],`Missing source ${file}`);
    assert.equal(d[file].presetHash,presetHash,`presetHash mismatch: ${file}`);
  }
  const rows=[];
  const add=(code,source,root,units,resumeCommands,remaining=[])=>{
    assert(codes.includes(code),`Source assigns a card absent from the preset: ${code}`);
    assert(!rows.some(row=>row.code===code),`Duplicate starter assignment: ${code}`);
    const stats=work(units);
    rows.push({code,name:cards[code]?.name??String(code),copies:preset.main.filter(value=>value===code).length,
      source:`routes/${source}`,sourceScope:d[source].scope,root:{...root,status:root.complete?'complete':'partial'},
      work:stats,remaining,resumeCommands});
  };

  const others=d['exhaustive-others.json'];
  for(const entry of others.searches) {
    add(entry.code,'exhaustive-others.json',
      {complete:complete(entry.complete,entry.frontierCount,entry.failures),evidence:checkpoint(entry.checkpoint),scope:'初期手札1枚からエンド処理まで。監査済みLink UI往復のみ縮約。'},
      [unit(checkpoint(entry.checkpoint),entry,{terminals:entry.terminalCount,frontier:entry.frontierCount})],
      [`node scripts/exhaustive-others.mjs --resume --checkpoint-set=canonical --codes=${entry.code} --max-nodes=10000 --max-depth=160 --max-ms=30000`],
      entry.complete?[]:['保存済みfrontierを再開する。']);
  }
  for(const entry of d['exhaustive-cyberse.json'].searches) {
    assert.equal(entry.hand?.length,1,'Cyberse search must start from exactly one card');
    const isRoot=Array.isArray(entry.rootPrefix)&&entry.rootPrefix.length===0;
    add(entry.hand[0],'exhaustive-cyberse.json',
      {complete:isRoot&&complete(entry.complete,entry.frontier,entry.failures),evidence:checkpoint(entry.checkpoint),scope:'空prefixの1枚初動。効果ドローは境界で保持。'},
      [unit(checkpoint(entry.checkpoint),entry)],
      [`$env:CYBERSE_STARTER='${entry.hand[0]}'`,"$env:CYBERSE_MAX_NODES='2000'","$env:CYBERSE_MAX_MS='30000'","$env:CYBERSE_MAX_DEPTH='180'",'node scripts/exhaustive-cyberse.mjs --resume'],
      isRoot&&entry.complete?[]:['根からの未展開prefixまたはドロー境界が残る。']);
  }

  const rabbit=d['exhaustive-rabbit.json'],rabbitJobs=rabbit.search?.summaries??[];
  const rabbitRoot=rabbitJobs.find(entry=>entry.id==='root'&&Array.isArray(entry.prefix)&&entry.prefix.length===0);
  add(rabbit.starter,'exhaustive-rabbit.json',
    {complete:!!rabbitRoot&&complete(rabbitRoot.complete,rabbitRoot.frontier,rabbitRoot.failures),evidence:rabbitRoot?.checkpoint??null,scope:'rootの完了だけを根の証拠に使う。指向的prefixは追加の作業量。'},
    rabbitJobs.map(entry=>unit(checkpoint(entry.checkpoint)??entry.id,entry)),
    ['node scripts/exhaustive-rabbit.mjs --search --search-only --sharded --resume --nodes 1000 --depth 180 --ms 30000'],
    rabbit.boundaries??[]);

  const dorm=d['exhaustive-dormouse.json'],stage=dorm.firstStage??{},continuation=dorm.continuationSearch??{},alternatives=dorm.rootAlternatives??{};
  const includesAlternatives=continuation.rootAlternativeCount===alternatives.unresolvedFrontier;
  const dormComplete=dorm.complete===true&&stage.completeWithinBoundary===true&&continuation.complete===true&&
    count(continuation.frontier)===0&&count(continuation.unstartedLeaves)===0&&
    (includesAlternatives||count(alternatives.unresolvedFrontier)===0);
  const dormUnits=[unit('dorm:first-stage',stage,{visited:stage.processedNodes,terminals:0,frontier:0}),
    ...(dorm.deepSearch?.entries??[]).map(entry=>unit(checkpoint(entry.checkpoint)??entry.id,entry,{terminals:entry.terminalCount})),
    unit('dorm:continuation',continuation,{terminals:continuation.terminalCount,unstarted:continuation.unstartedLeaves,chance:continuation.drawBoundaries,failures:continuation.failureCount})];
  // The continuation partition includes unresolved alternatives, but its
  // terminalCount deliberately excludes the six already-finished initial paths.
  dormUnits.push(unit('dorm:root-alternatives',alternatives,{visited:0,terminals:alternatives.firstTurnTerminals,
    frontier:includesAlternatives?0:alternatives.unresolvedFrontier}));
  add(dorm.starter,'exhaustive-dormouse.json',
    {complete:dormComplete,evidence:continuation.manifest??null,scope:'初回効果の全葉と初手の別行動を分割。初回段階だけのcompleteは根の完了ではない。'},
    dormUnits,["$env:DORM_PARTITION_COUNT='1'","$env:DORM_PARTITION_INDEX='0'","$env:DORM_LEAF_NODES='1000'","$env:DORM_LEAF_MAX_MS='30000'",'node scripts/exhaustive-dormouse.mjs --partition --no-publish','node scripts/exhaustive-dormouse.mjs --aggregate'],
    [dorm.completionReason??'初回効果以後と初手の別行動の全葉を完了させる。']);

  const gold=d['exhaustive-gold.json'],goldJobs=Object.values(gold.searches??{}),goldRoot=gold.searches?.root;
  add(gold.starter,'exhaustive-gold.json',
    {complete:!!goldRoot&&goldRoot.prefix==='root'&&complete(goldRoot.summary?.complete,goldRoot.summary?.frontier,goldRoot.summary?.failures),evidence:checkpoint(goldRoot?.checkpoint)??null,scope:'root checkpointを判定。初回除外先だけの完了を全体へ転用しない。'},
    goldJobs.map(entry=>unit(checkpoint(entry.checkpoint)??entry.prefix,entry.summary??{})),
    ['node scripts/exhaustive-gold.mjs --resume --focus --max-nodes 1000 --max-depth 200 --max-ms 30000'],gold.unresolved??[]);

  const underground=d['exhaustive-underground.json'],undergroundJobs=underground.search?.results??[];
  for(const entry of underground.initialBanishCoverage??[]) {
    const jobs=undergroundJobs.filter(job=>job.starter===entry.starter),roots=jobs.filter(job=>job.kind==='whole-opening');
    assert(roots.length<=1,`Multiple whole-opening roots for ${entry.starter}`);
    const root=roots[0],deferred=(underground.search?.deferredJobs??[]).filter(job=>job.starter===entry.starter).length;
    const units=jobs.map(job=>unit(checkpoint(job.checkpoint)??job.id,job,{frontier:job.frontierEntries,terminals:job.terminalRoutes,chance:job.drawBoundaryEntries}));
    if(deferred)units.push(unit(`underground:unstarted:${entry.starter}`,{},{unstarted:deferred}));
    add(entry.starter,'exhaustive-underground.json',
      {complete:!!root&&complete(root.complete,root.frontierEntries,root.failures),evidence:root?.checkpoint??null,scope:'whole-openingの根を判定。既知ルート途中や除外先の探索は重なり得る。'},
      units,['node scripts/exhaustive-underground.mjs --resume --nodes=2000 --per-job=16 --depth=180 --ms=30000'],underground.unresolved??[]);
  }

  const draws=d['exhaustive-draws.json'],allure=d['allure-continuations.json'],optional=d['optional-draw-continuations.json'];
  const alternativesCount=draws.allure.outcomes.reduce((n,outcome)=>n+outcome.alternatives.length,0);
  assert.equal(alternativesCount,draws.allure.strategicAlternatives,'Allure successor count differs from its outcomes');
  const expectedReverse=draws.allure.outcomes.reduce((n,outcome)=>n+(outcome.draw[0]!==outcome.draw[1]?outcome.alternatives.length:0),0);
  const expectedCopies=draws.allure.outcomes.filter(outcome=>outcome.draw[0]===outcome.draw[1]&&
    cards[outcome.draw[0]]?.attribute===32&&outcome.alternatives.some(alternative=>alternative.banish===outcome.draw[0])).length;
  const canonicalJobs=allure.jobs.filter(job=>job.kind==='after-allure').length;
  const reverseJobs=allure.jobs.filter(job=>job.kind==='after-allure-reverse').length;
  const copyJobs=allure.jobs.filter(job=>job.kind==='after-allure-copy').length;
  const afterJobs=allure.jobs.filter(job=>/^after-allure(?:-|$)/.test(job.kind));
  const expectedAfterJobs=alternativesCount+expectedReverse+expectedCopies;
  const allureRootsCovered=canonicalJobs===alternativesCount&&reverseJobs===expectedReverse&&copyJobs===expectedCopies&&
    afterJobs.length===expectedAfterJobs&&allure.afterAllureJobs===expectedAfterJobs&&
    allure.jobs.filter(job=>job.kind==='root-set').length===1&&allure.jobs.filter(job=>job.kind==='root-end').length===1;
  const allureJobsComplete=allureRootsCovered&&allure.jobs.every(job=>complete(job.complete,job.frontier,job.failures));
  add(draws.allure.starter,'allure-continuations.json',
    {complete:allure.complete===true&&allureJobsComplete,evidence:'routes/allure-continuations.json#jobs',
      scope:'初回ドローの正逆順、同名DARKの除外個体差、初手セット・Endを分割。以後の全山札順序の証明とは別。',
      initialSuccessorCoverage:{expected:expectedAfterJobs,recorded:afterJobs.length,canonical:{expected:alternativesCount,recorded:canonicalJobs},
        reverse:{expected:expectedReverse,recorded:reverseJobs},sameNameCopyChoice:{expected:expectedCopies,recorded:copyJobs}}},
    allure.jobs.map(job=>unit(checkpoint(job.checkpoint)??job.id,job)),
    ['node scripts/search-allure-continuations.mjs --ms=24000 --nodes=6 --rounds=1'],allure.unresolved??[]);

  assert.equal(rows.length,codes.length,`Missing starter assignments: ${codes.filter(code=>!rows.some(row=>row.code===code)).join(', ')}`);
  rows.sort((a,b)=>codes.indexOf(a.code)-codes.indexOf(b.code));
  assert.deepEqual(rows.map(row=>row.code),codes,'Every preset starter must occur exactly once');

  const optionalOutcomes=draws.optionalDraws.reduce((n,boundary)=>n+boundary.outcomes.length,0);
  const optionalJobsComplete=optional.results.length===optionalOutcomes&&optional.results.every(result=>result.initialized&&complete(result.complete,result.frontier,result.failures));
  const allureSourceMatches=allure.sourceHash===hash(draws.allure);
  const drawMetadata=metadata.find(source=>source.path==='routes/exhaustive-draws.json');
  const optionalSourceMatches=!!drawMetadata&&optional.source?.sha256===drawMetadata.sha256;
  const chance={
    boundaryEnumeration:{allureNamePairs:draws.allure.unorderedNames,allureOrderedNamePairs:draws.allure.orderedNames,
      allureConditionalSuccessors:alternativesCount,allureCoreProbes:draws.allure.actualCoreProbes,
      allureExpandedSuccessors:afterJobs.length,allureExpectedExpandedSuccessors:expectedAfterJobs,
      allureCanonicalJobs:canonicalJobs,allureReverseJobs:reverseJobs,allureCopyChoiceJobs:copyJobs,
      optionalBoundaries:draws.optionalDraws.length,optionalConditionalOutcomes:optionalOutcomes,
      optionalCoreVerifiedOutcomes:sum(draws.optionalDraws,'actualCoreOutcomesVerified'),
      scope:'既知の各境界に条件付けた結果数。異なる境界の確率を足さず、初動率・勝率として扱わない。'},
    allure:{jobs:allure.jobs.length,completedJobs:allure.jobs.filter(job=>job.complete).length,
      initialSuccessorsCovered:allureRootsCovered,afterDrawJobs:afterJobs.length,expectedAfterDrawJobs:expectedAfterJobs,
      frontierEntries:sum(allure.jobs,'frontier'),additionalDrawBoundaries:count(allure.totals?.drawFrontiers),
      continuationComplete:allure.complete===true&&allureJobsComplete,sourceMatches:allureSourceMatches,
      futureOrderCoverageProven:allure.coverageProof?.futureDeckOrdersExhaustive===true,
      unresolved:allure.unresolved??[],resumeCommands:['node scripts/search-allure-continuations.mjs --ms=24000 --nodes=6 --rounds=1']},
    optional:{jobs:optional.results.length,expectedJobs:optionalOutcomes,initializedJobs:optional.results.filter(result=>result.initialized).length,
      completedJobs:optional.results.filter(result=>result.complete).length,
      unstartedJobs:optional.results.filter(result=>!result.initialized).length,
      work:work(optional.results.map(result=>unit(checkpoint(result.checkpoint)??result.id,result))),
      additionalDrawBoundaries:count(optional.totals?.newChanceFrontiers),
      continuationComplete:optional.complete===true&&optionalJobsComplete,sourceMatches:optionalSourceMatches,
      futureOrderCoverageProven:optional.coverageProof?.futureDeckOrdersExhaustive===true,
      unresolved:optional.remaining??[],resumeCommands:['node scripts/search-optional-draw-continuations.mjs --max-ms=30000 --nodes=4']},
    catalogCoverage:{registeredOptionalBoundaries:draws.optionalDraws.length,
      allDiscoveredHandoffsRegistered:draws.coverageProof?.allDiscoveredHandoffsRegistered===true,
      unregisteredHandoffCount:null,
      scope:'未開始件数は現在公開されたジョブcatalog内だけ。Rabbit/UNDERGROUND等で新たに発見したdraw-handoffの具体化・登録漏れは0件と仮定しない。',
      reportedHandoffSources:[rabbit.rawEvidence?.draws,underground.search?.drawFrontier?.path,allure.drawFrontierFile,continuation.drawHandoffs].filter(Boolean)},
    laterGameplayExhaustive:draws.frontier?.laterGameplayExhaustive===true,
    enumerationCommand:Array.isArray(draws.command)?draws.command.join(' '):'node scripts/exhaustive-draws.mjs',
  };
  chance.complete=chance.laterGameplayExhaustive&&chance.allure.continuationComplete&&chance.optional.continuationComplete&&
    chance.allure.sourceMatches&&chance.optional.sourceMatches&&chance.allure.futureOrderCoverageProven&&chance.optional.futureOrderCoverageProven&&
    chance.catalogCoverage.allDiscoveredHandoffsRegistered&&
    chance.allure.additionalDrawBoundaries===0&&chance.optional.additionalDrawBoundaries===0;
  const rootComplete=rows.filter(row=>row.root.complete).length;
  const totals={starters:codes.length,rootComplete,rootPartial:codes.length-rootComplete,
    cumulativeVisited:sum(rows.map(row=>row.work),'visited')+chance.optional.work.visited,
    recordedTerminalHistories:sum(rows.map(row=>row.work),'terminalHistories')+chance.optional.work.terminalHistories,
    retainedFrontierEntries:sum(rows.map(row=>row.work),'frontierEntries')+chance.optional.work.frontierEntries,
    unstartedCases:sum(rows.map(row=>row.work),'unstartedCases')+chance.optional.unstartedJobs,
    unstartedScope:'既存の公開catalog内のみ。未登録・未具体化の新規draw-handoffは含まず、その数は不明。',
    reportedRootChanceBoundaryEntries:sum(rows.map(row=>row.work),'reportedChanceBoundaries'),
    failures:sum(rows.map(row=>row.work),'failures')+chance.optional.work.failures};
  const blockers=[];
  if(rootComplete!==codes.length)blockers.push(`${codes.length-rootComplete}種類の根からの探索が未完了。`);
  if(!chance.allure.continuationComplete)blockers.push('闇の誘惑の条件付き後続探索が未完了。');
  if(!chance.optional.continuationComplete)blockers.push('Cat/Binder等の既知ドロー結果の後続探索が未完了。');
  if(!chance.catalogCoverage.allDiscoveredHandoffsRegistered)blockers.push(`新規Rabbit/UNDERGROUND等のdraw-handoffの具体化・catalog登録・後続探索が未完了。既存${draws.optionalDraws.length}境界の着手済み件数には含まれない。`);
  if(!chance.allure.sourceMatches||!chance.optional.sourceMatches)blockers.push('ドロー列挙資料と継続探索の参照版が一致していない。');
  if(!chance.allure.futureOrderCoverageProven||!chance.optional.futureOrderCoverageProven)blockers.push('以後の順序依存操作を含む全山札順序の網羅が未証明。');
  if(!chance.laterGameplayExhaustive)blockers.push('後続で新たに発生する確率境界の全展開が未証明。');
  return {schemaVersion:1,generatedAt,presetHash,complete:rootComplete===codes.length&&chance.complete,
    scope:{mainCards:preset.main.length,extraCards:preset.extra.length,uniqueMainCards:codes.length,
      initialState:'先攻・対象1枚のみの手札・自他の空盤面/墓地・相手の初期手札なし。最初のターンのエンド処理まで。',
      uiContraction:'kernelで監査された標準Link素材選択の局所的な無効果の往復だけを縮約。',
      counts:'訪問・終端・frontierは保存された探索ジョブの延べ件数。prefixの重複訪問や旧UI反復終端を含み得るため固有展開数ではない。',
      unreportedWork:'初期候補probe、再生検証、過去の退避checkpointなど、集計元が累計値を公開していない作業は訪問数へ加算しない。',
      chance:'固定された代表山札順でのroot完了と、全確率結果・全後続順序の網羅は別に判定する。'},
    sources:metadata,totals,starters:rows,chance,blockers};
}

function markdown(report) {
  const n=value=>Number(value).toLocaleString('ja-JP');
  const lines=['# 1枚初動の探索範囲','',
    `全体は**${report.complete?'完了':'未完了'}**。固定プリセットの${report.totals.starters}種類を重複なく対応付け、根からの探索は${report.totals.rootComplete}種類完了、${report.totals.rootPartial}種類未完了。確率分岐の全後続探索は${report.chance.complete?'完了':'未完了'}。`,'',
    `延べ訪問 ${n(report.totals.cumulativeVisited)}、保存された終端手順 ${n(report.totals.recordedTerminalHistories)}、残存frontier ${n(report.totals.retainedFrontierEntries)}。既存の公開catalog内の未開始ケースは${n(report.totals.unstartedCases)}件。未具体化・未登録の新しいdraw-handoffはこの件数に含まない。これらは重複するprefixや旧UI反復を含み得る作業件数であり、固有の展開数ではない。`,'',
    `集計時刻: ${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'medium'}).format(new Date(report.generatedAt))} JST。更新中の資料は停止後に再生成する。`,'',
    '## 条件','',report.scope.initialState,report.scope.uiContraction,report.scope.chance,'',
    '## 26種類の担当と進捗','',
    '| カード | 枚数 | 根からの探索 | 延べ訪問 | frontier | 担当資料 |',
    '| --- | ---: | --- | ---: | ---: | --- |'];
  for(const row of report.starters)lines.push(`| ${row.name} | ${row.copies} | ${row.root.complete?'条件内完了':'未完了'} | ${n(row.work.visited)} | ${n(row.work.frontierEntries)} | [${path.basename(row.source)}](../${row.source}) |`);
  lines.push('','部分木が完了していても根からの探索を完了とはしない。初回除外・初回ドローだけの網羅も、以後の展開の完了とは区別する。','',
    '## ドロー分岐','',
    `闇の誘惑: 元の初回列挙は${report.chance.boundaryEnumeration.allureNamePairs}種類の2枚組・${report.chance.boundaryEnumeration.allureConditionalSuccessors}選択。両順序と同名DARKの除外個体差を分けた後続は ${report.chance.boundaryEnumeration.allureExpandedSuccessors}/${report.chance.boundaryEnumeration.allureExpectedExpandedSuccessors}入口（正順${report.chance.boundaryEnumeration.allureCanonicalJobs}・逆順${report.chance.boundaryEnumeration.allureReverseJobs}・同名個体の追加${report.chance.boundaryEnumeration.allureCopyChoiceJobs}）。初手セット・Endも含む全ジョブ ${report.chance.allure.completedJobs}/${report.chance.allure.jobs}完了、frontier ${n(report.chance.allure.frontierEntries)}、追加ドロー境界 ${report.chance.allure.additionalDrawBoundaries}。`,'',
    `任意ドロー: 既存catalogの${report.chance.boundaryEnumeration.optionalBoundaries}境界・${report.chance.boundaryEnumeration.optionalConditionalOutcomes}条件付き結果の範囲で、${report.chance.optional.initializedJobs}件着手、${report.chance.optional.completedJobs}件完了、${report.chance.optional.unstartedJobs}件未開始。frontier ${n(report.chance.optional.work.frontierEntries)}、この継続探索が報告した追加ドロー境界 ${report.chance.optional.additionalDrawBoundaries}。別担当が新規発見した未登録handoffが0という意味ではない。`,'',
    '確率は各境界の残り山札を条件とする。別の境界の重みを足して初動率・貫通率・勝率とはしない。追加ドロー境界はfrontierの内数または参照される同一境界を含み、frontier総数へ二重加算していない。','',
    '## 残件','',...report.blockers.map(text=>`- ${text}`),'',
    '## 再開','',
    '以下は duel-lab ディレクトリで実行する。各担当の保存状態を引き継ぐ。環境変数はそのPowerShellプロセスに適用される。');
  const commands=new Map();
  for(const row of report.starters.filter(row=>!row.root.complete)) {
    const key=row.resumeCommands.join('\n');
    const existing=commands.get(key);if(existing)existing.names.push(row.name);else commands.set(key,{names:[row.name],commands:row.resumeCommands});
  }
  commands.set(report.chance.optional.resumeCommands.join('\n'),{names:['任意ドローの後続'],commands:report.chance.optional.resumeCommands});
  for(const item of commands.values())lines.push('',item.names.join(' / '),'','~~~powershell',...item.commands,'~~~');
  lines.push('','全ドロー境界の再列挙（継続探索中の参照資料を更新するため、担当の停止後に実行）','',
    '~~~powershell',report.chance.enumerationCommand,'~~~','',
    '集約の再生成と検算','',
    '~~~powershell','node scripts/build-search-report.mjs','node scripts/build-search-report.mjs --verify','node --test tests/search-report.test.mjs','~~~','',
    '各資料のSHA-256とpresetHashは search-report.json に保存する。元資料とプリセットの不一致、カード担当の重複・欠落は生成エラーにする。');
  return lines.join('\n')+'\n';
}

function validateReport(report) {
  assert.equal(report.starters.length,26);
  assert.equal(new Set(report.starters.map(row=>row.code)).size,26);
  assert.equal(report.totals.rootComplete,report.starters.filter(row=>row.root.complete).length);
  assert.equal(report.totals.cumulativeVisited,sum(report.starters.map(row=>row.work),'visited')+report.chance.optional.work.visited);
  assert.equal(report.totals.retainedFrontierEntries,sum(report.starters.map(row=>row.work),'frontierEntries')+report.chance.optional.work.frontierEntries);
  assert.equal(report.complete,report.totals.rootComplete===26&&report.chance.complete);
}

function writeAtomic(file,text) {
  const temporary=`${file}.${process.pid}.tmp`;fs.writeFileSync(temporary,text);fs.renameSync(temporary,file);
}

async function main() {
  const args=process.argv.slice(2);assert(args.every(arg=>arg==='--verify'),'Unknown report command argument');
  const snapshot=loadSourceDocuments();
  const generated=buildSearchReport(snapshot);validateReport(generated);
  if(args.includes('--verify')) {
    const saved=JSON.parse(fs.readFileSync(path.join(ROOT,'search-report.json'),'utf8'));validateReport(saved);
    const current={...generated,generatedAt:saved.generatedAt};
    assert.deepEqual(saved,current,'Report is stale or modified: regenerate it after the source workers stop');
    console.log(`REPORT VERIFY PASS: 26 unique starters, ${saved.sources.length} matching source hashes, totals and conservative completion checks`);return;
  }
  fs.mkdirSync(path.join(ROOT,'docs'),{recursive:true});
  writeAtomic(path.join(ROOT,'search-report.json'),JSON.stringify(generated,null,2)+'\n');
  writeAtomic(path.join(ROOT,'docs/SEARCH_COVERAGE.md'),markdown(generated));
  console.log(JSON.stringify({result:'REPORT GENERATED',...generated.totals,complete:generated.complete,sources:generated.sources.length}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
