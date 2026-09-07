import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,select,finishRoute,replay,hash,preset} from './route-harness.mjs';
import {search} from './search-kernel.mjs';

const starters=[18789533,30118811,3723262,74652966];
const dot=18789533,backup=30118811,magician=64865;
const probes=[];
const safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v));
const choiceSummary=g=>({type:g.prompt.type,title:g.prompt.title,cards:g.prompt.cards?.map((c,index)=>({index,code:c.code,name:cards[c.code]?.name,place:c.place})),choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:safe(c.response)}))});
function place(g){respond(g,{selection:[0]});}
async function probe(hand,id,execute) {
  const g=await startRoute(hand);
  try {
    execute(g);
    const route=finishRoute(g,{id,starter:hand[0],name:cards[hand[0]].name,requiresDraw:false,conditions:['先攻・空盤面・空墓地・初期手札1枚のみ','候補確認の中間状態。展開終了ではない']});
    await replay(route);
    probes.push({...route,pending:choiceSummary(g),monsterCount:g.snapshot().players[0].monsters.filter(Boolean).length});
    if(process.env.CYBERSE_PROBE_TRACE==='1')console.log(`PROBE ${id}: ${g.prompt.type}, ${(g.prompt.cards||g.prompt.choices).length} candidate entries`);
  } finally {g.close();}
}
async function runProbes() {
  for(const code of starters) {
    await probe([code],`opening-${code}`,()=>{});
    await probe([code],`normal-${code}`,g=>{
      select(g,c=>c.response.action===0&&c.card?.code===code);place(g);
      if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===false);
      assert.equal(g.prompt.type,'SELECT_IDLECMD');
    });
  }
  await probe([backup],'backup-search-all-dark-cyberse',g=>{
    select(g,c=>c.response.action===0&&c.card?.code===backup);place(g);
    select(g,c=>c.response.yes===true);assert.equal(g.prompt.type,'SELECT_CARD');
  });
  await probe([backup],'magician-send-all-cyberse',g=>{
    select(g,c=>c.response.action===0&&c.card?.code===backup);place(g);select(g,c=>c.response.yes===true);
    respond(g,{selection:[g.prompt.cards.findIndex(c=>c.code===magician)]});
    respond(g,{selection:[g.prompt.cards.findIndex(c=>c.code===magician)]});
    if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===true);
    else select(g,c=>c.card?.code===magician);
    assert.equal(g.prompt.type,'SELECT_CARD');
  });
  const searchCodes=[...new Set(probes.find(p=>p.id==='backup-search-all-dark-cyberse').pending.cards.map(c=>c.code))];
  const sendCodes=[...new Set(probes.find(p=>p.id==='magician-send-all-cyberse').pending.cards.map(c=>c.code))];
  function searchAndDiscard(g,code){
    select(g,c=>c.response.action===0&&c.card?.code===backup);place(g);select(g,c=>c.response.yes===true);
    respond(g,{selection:[g.prompt.cards.findIndex(c=>c.code===code)]});
    respond(g,{selection:[g.prompt.cards.findIndex(c=>c.code===code)]});
  }
  for(const code of searchCodes)await probe([backup],`backup-search-discard-${code}`,g=>{
    searchAndDiscard(g,code);
    if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===false);
    assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.snapshot().players[0].hand.length,0);
    assert.equal(g.snapshot().players[0].monsters.filter(Boolean).length,1);
  });
  for(const code of sendCodes)await probe([backup],`magician-send-result-${code}`,g=>{
    searchAndDiscard(g,magician);select(g,c=>c.response.yes===true);
    respond(g,{selection:[g.prompt.cards.findIndex(c=>c.code===code)]});
    if(g.prompt.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===true);
    if(g.prompt.type==='SELECT_PLACE')place(g);
    if(g.prompt.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
    assert.equal(g.prompt.type,'SELECT_IDLECMD');assert.equal(g.snapshot().players[0].hand.length,0);
    assert.equal(g.snapshot().players[0].monsters.filter(Boolean).length,code===dot?2:1);
  });
  const linkOnes=probes.find(p=>p.id===`normal-${dot}`).pending.choices.filter(c=>c.response.action===1).map(c=>c.code);
  function finishChoices(g,{materials=[],revive=true,banish=null}={}){
    materials=[...materials];let limit=0;
    while(g.prompt.type!=='SELECT_IDLECMD'){
      assert(++limit<40,'Unexpected probe loop');const p=g.prompt;
      if(p.type==='SELECT_UNSELECT_CARD'){
        const code=materials.shift();if(code)select(g,c=>c.label.startsWith('選択：')&&c.card?.code===code);else select(g,c=>c.label==='選択を確定');
      }else if(p.type==='SELECT_PLACE')place(g);
      else if(p.type==='SELECT_POSITION')select(g,c=>c.response.position===1);
      else if(p.type==='SELECT_EFFECTYN')select(g,c=>c.response.yes===(g.pending.code===dot?revive:banish!==null));
      else if(p.type==='SELECT_CHAIN'){
        const effect=p.choices.find(c=>c.card?.code===dot&&revive);if(effect)respond(g,{action:effect.id});else select(g,c=>c.label==='発動しない');
      }else if(p.type==='SELECT_CARD'){assert(banish!==null);respond(g,{selection:[p.cards.findIndex(c=>c.code===banish)]});}
      else assert.fail(`Unexpected probe prompt ${p.type}`);
    }
    assert.equal(materials.length,0);
  }
  function dotFirstLink(g,link,revive=true){
    select(g,c=>c.response.action===0&&c.card?.code===dot);place(g);
    select(g,c=>c.response.action===1&&c.card?.code===link);finishChoices(g,{materials:[dot],revive});
  }
  for(const first of linkOnes)for(const revive of [false,true])await probe([dot],`dot-first-${first}-revive-${revive}`,g=>{
    dotFirstLink(g,first,revive);assert.equal(g.snapshot().players[0].monsters.filter(Boolean).length,revive?2:1);
  });
  for(const first of linkOnes)for(const second of [29301450,52698008,37458564])await probe([dot],`dot-link2-${first}-${second}`,g=>{
    dotFirstLink(g,first);select(g,c=>c.response.action===1&&c.card?.code===second);finishChoices(g,{materials:[first,dot]});
    assert.equal(g.snapshot().players[0].monsters.filter(Boolean).length,1);
  });
  for(const first of linkOnes)for(const target of [first,dot,29301450])await probe([dot],`dot-sp-banish-${first}-${target}`,g=>{
    dotFirstLink(g,first);select(g,c=>c.response.action===1&&c.card?.code===29301450);finishChoices(g,{materials:[first,dot],banish:target});
    assert.equal(g.snapshot().players[0].monsters.filter(Boolean).length,target===29301450?0:1,'Dotscaper cannot return a second time this turn');
  });
  assert(probes.find(p=>p.id===`normal-${dot}`).pending.choices.filter(c=>c.response.action===1).length===3,'Dotscaper must have three different first Link-1 summons');
  return probes;
}

const destination=new URL('../routes/exhaustive-cyberse.json',import.meta.url);
const previous=process.argv.includes('--resume')&&fs.existsSync(destination)?JSON.parse(fs.readFileSync(destination,'utf8')):null;
const runKind=process.argv.includes('--canonical')||previous?.runKind==='canonical-v2'?'canonical-v2':'legacy-resumed';
await runProbes();
console.log(`Verified ${probes.length} independent branch probes by deterministic replay`);
const compactResult=result=>{const {routes,...rest}=result;return rest;}; // routes and terminals alias the same paths; retain one copy.
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const checkpointPath=(code,kind)=>`runtime/search-cyberse/${kind==='canonical-v2'?'canonical-':''}${code}.json`;
const checkpointFile=(code,kind)=>new URL(`../${checkpointPath(code,kind)}`,import.meta.url);
fs.mkdirSync(new URL('../runtime/search-cyberse/',import.meta.url),{recursive:true});
const output={version:2,runKind,presetHash:hash(preset),scope:'Dotscaper / Backup alone / Wizard / Code of Soul; one-card, no-draw, first-turn branches',probes,searches:[],previousRuns:previous?.previousRuns||[],coverage:{status:'probe-only',exhaustive:false,visited:probes.length,frontier:null,reason:'Candidate probes only.'}};
function readCheckpoint(summary){
  assert.equal(summary.checkpoint.path,checkpointPath(summary.hand[0],summary.runKind),'Unexpected checkpoint path');
  const bytes=fs.readFileSync(checkpointFile(summary.hand[0],summary.runKind));assert.equal(sha256(bytes),summary.checkpoint.sha256,'Checkpoint changed outside this record');
  return JSON.parse(bytes);
}
async function persistSearch(result){
  const code=result.hand[0],raw=JSON.stringify(compactResult(result));
  fs.writeFileSync(checkpointFile(code,runKind),raw+'\n');
  const bytes=fs.readFileSync(checkpointFile(code,runKind));assert.equal(bytes.toString(),raw+'\n');
  const representatives=new Map(),frontierReasons={};
  for(const frame of result.frontier)frontierReasons[frame.reason]=(frontierReasons[frame.reason]||0)+1;
  for(const route of result.terminals){
    // Presentation grouping only: this never removes a searched branch or frontier.
    const own=route.final.players[0],display={lp:route.final.lp[0]};
    for(const zone of ['hand','monsters','spells','grave','banished','extra'])display[zone]=['monsters','spells'].includes(zone)?own[zone]:own[zone].filter(Boolean).map(c=>c.code).sort((a,b)=>a-b);
    const key=hash(display);if(!representatives.has(key)||representatives.get(key).steps.length>route.steps.length)representatives.set(key,{...route,id:`cyberse-exhaustive-${code}-${key.slice(0,12)}`,starter:code,name:cards[code].name,requiresDraw:false,displayGroup:key});
  }
  for(const route of representatives.values())await replay(route);
  return {version:result.version,runKind,presetHash:result.presetHash,hand:result.hand,seed:result.seed,rootPrefix:result.rootPrefix,scope:result.scope,
    visited:result.visited,generated:result.generated,replayedResponses:result.replayedResponses,complete:result.complete,
    terminals:result.terminals.length,frontier:result.frontier.length,rejected:result.rejected.length,failures:result.failures.length,
    frontierReasons,bounds:result.bounds,pruning:result.pruning,invocation:result.invocation,representatives:[...representatives.values()],
    checkpoint:{path:checkpointPath(code,runKind),sha256:sha256(bytes),bytes:bytes.length},
    representation:'All raw terminal paths/frontiers are retained in checkpoint. Representatives group displayed card placements/inventories only, not full effect state or search equivalence.'};
}
for(const prior of previous?.searches||[]){
  if(runKind==='canonical-v2'&&prior.runKind!=='canonical-v2')output.previousRuns.push(prior);
  else output.searches.push(Array.isArray(prior.terminals)?await persistSearch(prior):prior);
}
fs.mkdirSync(new URL('../routes/',import.meta.url),{recursive:true});
function save(){
  if(output.searches.length)output.coverage={
    status:output.searches.length===starters.length&&output.searches.every(s=>s.complete)?'complete':'bounded-incomplete',
    exhaustive:output.searches.length===starters.length&&output.searches.every(s=>s.complete),starters:starters.length,searched:output.searches.length,
    visited:output.searches.reduce((n,s)=>n+s.visited,0),frontier:output.searches.reduce((n,s)=>n+s.frontier,0),
    terminalPaths:output.searches.reduce((n,s)=>n+s.terminals,0),rejected:output.searches.reduce((n,s)=>n+s.rejected,0),
    failures:output.searches.reduce((n,s)=>n+s.failures,0),bounds:output.searches.map(s=>({code:s.hand[0],...s.bounds})),
    reason:'Complete applies only to the explicit fixed first-turn, no-draw scope. Remaining prefixes are retained in linked raw checkpoints.'};
  fs.writeFileSync(destination,JSON.stringify(output,null,2)+'\n');
  const lines=['# 非M∀LICE4種の分岐探索','',
    '対象は固定プリセットのドットスケーパー、バックアップ＠イグニスター単独、ウィザード＠イグニスター、コード・オブ・ソウル。先攻・空盤面・空墓地・初期手札1枚・追加ドローなし。',
    '',`探索状況: **${output.coverage.exhaustive?'指定範囲のfrontierなし':'未完了'}**。訪問 ${output.coverage.visited} 件、未探索frontier ${output.coverage.frontier??'未計数'} 件。全パターンを検証済みという報告ではない。実行系列: ${runKind}。旧UI循環を含む探索記録は previousRuns と旧checkpointに残し、新v2 rootの集計には足さない。`,
    '',`独立候補確認は ${probes.length} 件。初期状態4件、通常召喚直後4件、検索候補一覧1件、墓地送り候補一覧1件、検索した6種類を捨てた各状態6件、墓地送り8種類を実行した各状態8件。さらにドットの最初のリンク1×蘇生あり/なし6件、リンク1→リンク2の全3×3種類9件、S：Pで自分の3対象を除外する3×3件も確認。すべて実コアで生成しリプレイした。`,
    '', '| 起点 | 訪問 | 生成枝 | 終端入力列 | frontier | 拒否 | 失敗 | complete |','|---|---:|---:|---:|---:|---:|---:|---|'];
  for(const s of output.searches)lines.push(`| ${cards[s.hand[0]].name} | ${s.visited} | ${s.generated} | ${s.terminals} | ${s.frontier} | ${s.rejected} | ${s.failures} | ${s.complete} |`);
  lines.push('','終端入力列数は異なる最終盤面の数ではない。カード配置・素材選択順・同名の別個体などで同じ見た目に到達した経路も含む。終端は先攻のエンドフェイズ処理を終えて次ターンへ進んだ時点。','',
    '## 候補確認で得た分岐','',
    '- ドット通常召喚後はリングリボー／デコーダー／アルミラージ／終了。','- ウィザード、検索を断ったバックアップはリングリボー／デコーダー／終了。','- ソウル通常召喚後はリンク1全3種／②発動／終了。②は配置を変えなくても効果状態を変える。',
    '- バックアップの検索はコード・マジシャン、ウィザード、Dormouse、March Hare、Cat×3、Rabbit×3。10枚・6種類。',
    '- コード・マジシャンの墓地送りはソウル、ドット、ウィザード、バックアップ×2、Dormouse、March Hare、Cat×3、Rabbit×3。13枚・8種類。全8種類を実行し、ドットだけがバックアップと合わせて2体になった。',
    '', '## 境界と枝刈り','');
  for(const s of output.searches){
    lines.push(`- ${cards[s.hand[0]].name}: 境界 ${JSON.stringify(s.frontierReasons)}、直近の上限 ${JSON.stringify(s.bounds)}、枝刈り ${JSON.stringify(s.pruning)}`);
  }
  lines.push('','全入力列と未探索prefixは `runtime/search-cyberse/` のcheckpointへ保存し、追跡JSONはパス・SHA-256・件数・代表ルートを持つ。代表ルートの表示グループ化は探索の枝刈りではなく、元の終端とfrontierは全件残す。合法な候補を実コアに入力し、拒否された入力とエラーを区別する。局面の見た目だけによる探索マージや、戦略的に弱いという理由の枝刈りは行わない。ドローが発生した場合は探索境界として保持し、ランダムな全ドロー結果を調べたとは扱わない。',
    '', '## 再開','', '```powershell','cd C:\\Project\\card_manager_web\\duel-lab',"$env:CYBERSE_MAX_NODES='2000'","$env:CYBERSE_MAX_MS='30000'","$env:CYBERSE_MAX_DEPTH='100'",'node scripts/exhaustive-cyberse.mjs --resume','```','',
    '`CYBERSE_STARTER` に担当カードのパスコードを設定するとその1種類だけを再開する。`--probe` は候補確認だけを行う。Astra CLIは起動しない。検索器は `scripts/search-kernel.mjs`、再生は `scripts/route-harness.mjs` を使う。');
  fs.writeFileSync(new URL('../docs/exhaustive-cyberse.md',import.meta.url),lines.join('\n')+'\n');
}
save();
if(!process.argv.includes('--probe')) {
  const maxNodes=Number(process.env.CYBERSE_MAX_NODES||1000),maxMs=Number(process.env.CYBERSE_MAX_MS||30000),maxDepth=Number(process.env.CYBERSE_MAX_DEPTH||80);
  const selected=process.env.CYBERSE_STARTER?[Number(process.env.CYBERSE_STARTER)]:[3723262,74652966,30118811,18789533];
  assert(selected.every(code=>starters.includes(code)),'Unassigned starter requested');
  for(const code of selected) {
    const prior=output.searches.find(s=>s.hand[0]===code);
    if(prior?.complete){console.log(`COMPLETE ${code}: already exhausted, ${prior.visited} visited`);continue;}
    let lastProgress=Date.now();
    const result=await search({hand:[code],...(prior?{resume:readCheckpoint(prior)}:{}),maxNodes,maxDepth,maxMs,stopOnDraw:true,
      onProgress:stats=>{if(Date.now()-lastProgress>10000){console.log(`SEARCH ${code} ${JSON.stringify(stats)}`);lastProgress=Date.now();}}});
    const summary=await persistSearch(result);
    const index=output.searches.findIndex(s=>s.hand[0]===code);if(index<0)output.searches.push(summary);else output.searches[index]=summary;
    save();console.log(`RESULT ${code} ${JSON.stringify({visited:result.visited,terminals:result.terminals.length,frontier:result.frontier.length,complete:result.complete,failures:result.failures.length})}`);
  }
}
