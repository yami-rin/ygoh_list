import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,cards} from '../cards.mjs';
import {preset,hash,startRoute,respond,board} from './route-harness.mjs';
import {enumeratePairs} from './survey-multi-openings.mjs';
import {searchIdentity} from './search-multi-pairs.mjs';

const all=enumeratePairs(preset.main).map((p,index)=>({...p,index}));
const stamp=file=>({path:path.relative(ROOT,file).replaceAll('\\','/'),hash:hash(fs.readFileSync(file,'utf8'))});
const write=(file,value)=>{const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);};
export function validatePairSummary(p,base){
  assert.deepEqual(p.hand,base.hand);assert.equal(p.id,base.id);assert.equal(p.physicalWeight,base.physicalWeight);
  assert(Number.isSafeInteger(p.visited)&&p.visited>=0);
  if(p.visited===0){assert.equal(p.status,'unsearched');assert.equal(p.completeWithinNoDrawScope,false);return;}
  for(const name of ['unresolved','terminalPaths','excludedDraw'])assert(Number.isSafeInteger(p[name])&&p[name]>=0,`Invalid ${name}`);
  assert.equal(p.completeWithinNoDrawScope,p.unresolved===0,'Completion must reflect unresolved work');
  assert.equal(p.status,p.unresolved===0?'completeWithinNoDrawScope':'incomplete');
}
export function validateSearchIdentity(r,shard){
  for(const [key,value] of Object.entries(searchIdentity))assert.equal(r[key],value,`Invalid search ${key}`);
  assert.equal(r.shard,shard);assert.equal(r.shards,8);assert.equal(typeof r.generation,'string');assert(r.generation.length>0);
}
export async function verifyNoDrawRoute(route){
  assert.equal(route.verified,true);assert.equal(route.presetHash,hash(preset));
  assert.notEqual(route.requiresDraw,true);assert.notEqual(route.drawDependent,true);
  const g=await startRoute(route.hand,{seed:route.seed,deckOrder:route.deckOrder});
  try{
    for(const step of route.steps){assert.equal(g.prompt.type,step.prompt);assert.equal(hash({pending:g.pending,board:board(g)}),step.before);
      respond(g,step.input);assert.equal(g.route.steps.at(-1).label,step.label);
      assert(!g.log.some(e=>/\d+\s*枚ドロー/.test(e.text)),'Actual replay crossed a draw boundary');
    }
    assert.equal(g.turn,1);assert.equal(g.phase,4);assert.equal(g.prompt.type,'SELECT_IDLECMD');
    assert.equal(hash(board(g)),route.finalHash);assert.equal(hash(route.final),route.finalHash);
  }finally{g.close();}
}
export async function main(){
const reports=[],sources=[],routes=[],manual=[],seen=new Set(),routeIds=new Set();
const read=file=>{const bytes=fs.readFileSync(file,'utf8');sources.push({path:path.relative(ROOT,file).replaceAll('\\','/'),hash:hash(bytes)});return JSON.parse(bytes);};
const verifyRoute=async route=>{assert.equal(typeof route.id,'string');assert(!routeIds.has(route.id),`Duplicate route ${route.id}`);routeIds.add(route.id);await verifyNoDrawRoute(route);};
for(let shard=0;shard<8;shard++){
  const file=path.join(ROOT,`runtime/multi-pair-search/shard-${shard}/summary.json`);
  const routeFile=path.join(ROOT,`runtime/multi-pair-search/shard-${shard}/best-routes.json`);
  if(fs.existsSync(file)){
    const r=read(file);validateSearchIdentity(r,shard);
    assert.deepEqual(r.pairs.map(p=>p.index),all.filter(p=>p.index%8===shard).map(p=>p.index));
    assert.equal(new Set(r.selectedPairIndices).size,r.selectedPairIndices.length);
    assert(r.selectedPairIndices.every(index=>r.pairs.some(p=>p.index===index)),'Selected slice must belong to the published shard');
    for(const p of r.pairs){assert.equal(p.index%8,shard);validatePairSummary(p,all[p.index]);assert(!seen.has(p.index));seen.add(p.index);}
    reports.push(r);
    const data=read(routeFile);validateSearchIdentity(data,shard);assert.equal(data.generation,r.generation,'Mixed shard publication');
    const routePairs=new Set();
    for(const route of data.routes){assert.equal(route.pairIndex%8,shard);assert.deepEqual(route.hand,all[route.pairIndex].hand);
      assert(!routePairs.has(route.pairIndex));routePairs.add(route.pairIndex);
      const best=r.pairs.find(p=>p.index===route.pairIndex)?.bestPlayable;assert(best);
      for(const key of ['id','finalHash','score'])assert.equal(route[key],best[key]);
      await verifyRoute(route);routes.push(route);
    }
    assert.equal(routePairs.size,r.pairs.filter(p=>p.bestPlayable).length);
  }
  const manualFile=path.join(ROOT,`routes/pair-shard-${shard}.json`);
  if(fs.existsSync(manualFile)){
    const data=read(manualFile);assert.equal(data.presetHash,hash(preset));
    for(const route of data.routes||[]){const pair=all.find(p=>hash([...p.hand].sort((a,b)=>a-b))===hash([...route.hand].sort((a,b)=>a-b)));assert(pair&&pair.index%8===shard,`Manual route ownership: ${route.id}`);
      await verifyRoute(route);manual.push({id:route.id,pairIndex:pair.index,source:`pair-shard-${shard}`});}
  }
}
assert(new Set(reports.map(r=>r.sourceHash)).size<=1,'Different search source versions cannot be aggregated');
const byIndex=new Map(reports.flatMap(r=>r.pairs).map(p=>[p.index,p]));
const pairs=all.map(p=>({...p,names:p.hand.map(c=>cards[c].name),...(byIndex.get(p.index)||{status:'unsearched',visited:0,unresolved:null,completeWithinNoDrawScope:false}),manualRoutes:manual.filter(r=>r.pairIndex===p.index)}));
// Verify each shard snapshot remained unchanged throughout independent replay.
for(const source of sources)assert.equal(stamp(path.join(ROOT,source.path)).hash,source.hash,'Sources changed during report generation; retry after shard finishes');
const sum=name=>pairs.reduce((n,p)=>n+(p[name]||0),0);
const summary={totalPairs:333,physicalCombinations:780,searched:pairs.filter(p=>p.visited>0).length,
  completeWithinNoDrawScope:pairs.filter(p=>p.completeWithinNoDrawScope).length,unsearched:pairs.filter(p=>!p.visited).length,
  visited:sum('visited'),terminalPaths:sum('terminalPaths'),unresolved:sum('unresolved'),excludedDraw:sum('excludedDraw'),
  manualRoutes:manual.length,searchRoutes:routes.length};
const report={schemaVersion:1,presetHash:hash(preset),summary,sources,pairs,
  scope:'固定2枚の先攻・相手手札なし。未知ドロー後を除外。既知template照合と実合法木探索は別指標。',
  complete:summary.completeWithinNoDrawScope===333,updatedAt:new Date().toISOString()};
write(path.join(ROOT,'routes/multi-search-best.json'),{schemaVersion:1,presetHash:hash(preset),routes});
write(path.join(ROOT,'routes/multi-search-report.json'),report);
const lines=['# 2枚組からの実展開探索','',report.scope,'',
  `全333組のうち実探索済み${summary.searched}組、無ドロー範囲の全枝終了${summary.completeWithinNoDrawScope}組、未着手${summary.unsearched}組。`,
  `訪問${summary.visited}、終端履歴${summary.terminalPaths}、未解決prefix ${summary.unresolved}、対象外の未知ドロー境界${summary.excludedDraw}。`,
  `手作業の実core検証ルート${summary.manualRoutes}件、探索が発見したMain1入力ルート${summary.searchRoutes}件。罠伏せ・小展開も含むため、件数は強い初動の成功率ではない。`,
  '', '保存ルートは実手札で再生して自動入力候補へ加える。未解決の木を最善性の証明や全網羅として扱わない。','',
  '| 組合せ | 実探索 | 訪問 | 残枝 | 最良到達点の種類 | 新規手順 |','| --- | --- | ---: | ---: | --- | ---: |'];
for(const p of pairs)lines.push(`| ${p.names.join('＋')} | ${p.status} | ${p.visited} | ${p.unresolved??'未探索'} | ${p.bestPlayable?.classification||p.best?.classification||'—'} | ${p.manualRoutes.length} |`);
write(path.join(ROOT,'docs/MULTI_SEARCH_COVERAGE.md'),lines.join('\n')+'\n');
console.log(JSON.stringify(summary));
return report;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await main();
