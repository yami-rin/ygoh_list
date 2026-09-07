import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {cards} from '../cards.mjs';
import {startRoute,respond,finishRoute,replay,hash,preset} from './route-harness.mjs';
import {search} from './search-kernel.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const excluded=new Set([69272449,32061192,75500286,68337209,73628505,1475311,18789533,30118811,3723262,74652966]);
export const starters=[...new Set(preset.main)].filter(code=>!excluded.has(code));
assert.equal(starters.length,16,'Preset partition changed: update the assigned starter coverage');
const safe=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
const summarize=g=>({type:g.prompt.type,title:g.prompt.title,mode:g.prompt.mode,min:g.prompt.min,max:g.prompt.max,
  cards:g.prompt.cards?.map((c,index)=>({index,code:c.code,name:cards[c.code]?.name,place:c.place})),
  choices:g.prompt.choices.map(c=>({id:c.id,label:c.label,code:c.card?.code,response:safe(c.response)}))});

// This pre-search inventory makes no completion claim. It records the actual
// engine's options, including early quick-effect windows before Main Phase 1.
export async function inventory() {
  const result=[];
  for(const code of starters) {
    const g=await startRoute([code]);
    try {
      const windows=[];
      while(g.prompt.type==='SELECT_CHAIN') {
        windows.push(summarize(g));
        const decline=g.prompt.choices.find(c=>c.response.index===null);
        assert(decline,'An unforced opening chain window must allow declining');
        respond(g,{action:decline.id});
      }
      assert.equal(g.prompt.type,'SELECT_IDLECMD');
      const main=summarize(g);
      const route=finishRoute(g,{id:`others-inventory-${code}`,starter:code,name:cards[code].name,
        conditions:['先攻・初期手札1枚・自他の場と墓地は空','最初のメインフェイズまで任意効果を断った候補一覧。展開完走ではない']});
      await replay(route);
      result.push({code,name:cards[code].name,copies:preset.main.filter(c=>c===code).length,openingWindows:windows,main,route});
      console.log(`INVENTORY ${code} ${cards[code].name}: ${windows.length} opening windows, ${main.choices.length} Main Phase options`);
    } finally {g.close();}
  }
  return result;
}

export async function normalSummonInventory(entries) {
  const results=[];
  for(const entry of entries) {
    if(!entry.main.choices.some(c=>c.response.action===0))continue;
    const g=await startRoute([entry.code]);
    try {
      for(const step of entry.route.steps)respond(g,step.input);
      const summon=g.prompt.choices.find(c=>c.response.action===0&&c.card?.code===entry.code);
      respond(g,{action:summon.id});
      assert.equal(g.prompt.type,'SELECT_PLACE');
      respond(g,{selection:[0]});
      assert.equal(g.prompt.type,'SELECT_IDLECMD');
      const route=finishRoute(g,{id:`others-normal-${entry.code}`,starter:entry.code,name:entry.name,
        conditions:['先攻・手札1枚のみ','通常召喚を第1モンスターゾーンで行った直後の候補一覧。全配置の探索ではない']});
      await replay(route);
      const pending=summarize(g);
      results.push({code:entry.code,name:entry.name,pending,route});
      console.log(`NORMAL ${entry.code}: ${pending.choices.map(c=>c.label).join(' / ')}`);
    } finally {g.close();}
  }
  return results;
}

function writeReport(output) {
  const searches=new Map(output.searches.map(entry=>[entry.code,entry]));
  const fresh=output.searches.length===starters.length&&output.searches.every(entry=>entry.freshStart&&entry.kernelVersion===2);
  const patterns=output.searches.reduce((count,entry)=>count+entry.terminalCount,0);
  const rows=output.inventory.map(entry=>{
    const result=searches.get(entry.code);
    return `| ${entry.name} | ${result?(result.complete?'完了':'未完'):'未探索'} | ${result?.visited??'—'} | ${result?.terminalCount??'—'} | ${result?.distinctFinalBoards??'—'} | ${result?.frontierCount??'—'} |`;
  });
  const text=`# その他のメインカード1枚からの探索

固定プリセットの差集合16種類を実ルールエンジンで探索した。現在、${output.coverage.completed}/16種類で frontier が0となった。下記の条件とUI往復の除外規則の範囲で、全16種類の網羅は${output.coverage.exhaustive?'完了':'未完了'}。

終端手順は合計${patterns}パターン。${fresh?'全16種類をv2 kernelで開始状態から数え直した結果で、旧版のUI往復を含む終端の累計ではない。':'再開前の終端も含む累計であり、旧版から持ち越したUI往復の反復も含み得る。'}

## 条件と完了の意味

- 先攻、初期手札は対象カード1枚のみ。対象1枚は40枚のプリセットから抜き取る。
- 自分と相手の場・墓地、相手の初期手札は空。EXデッキは固定15枚。
- 最初のターンのエンドフェイズ処理を含め、相手ターンの最初の入力待ちで停止する。ルールエンジンが相手の通常ドローまで自動処理した終端も含む。
- 召喚、セット、発動、発動しない、全配置、素材の選択・取消、Endを候補に含める。カード名による戦略的な枝刈りは行わない。
- 対象の標準リンク召喚処理で、同じ素材選択画面の選択解除や召喚取消により同じ状態へ戻る局所的な往復だけを縮約する。盤面の全query・LP・フェイズ・チェーン・ログ・入力要求が一致し、途中に実効果処理がないことを確認した範囲に限る。異なる盤面、効果、素材、発動順、配置はまとめない。
- デッキ順序はfixtureの1通り。自分の効果ドローが生じた場合は未探索の境界として停止する。ランダムな全ドロー結果の網羅ではない。
- 完了は当該条件で frontier=0の場合のみ。ノード数、時間、深さに達した枝は完全な再生可能prefixとともにチェックポイントへ保存する。

## 実測

| カード | 探索 | 訪問 | 終端手順 | 異なる最終盤面 | 未探索境界 |
| --- | --- | ---: | ---: | ---: | ---: |
${rows.join('\n')}

終端手順数は効果発動の時期、実際の召喚・素材・配置などが違う手順を別々に数える。上記で縮約したUI操作の任意回数反復は別パターンとして数えない。異なる最終盤面は保存済みboardのハッシュによる表示上の集計であり、探索の枝刈りには使用しない。盤面が同じでも発動済み効果などの内部状態が同じとは限らない。全終端ルートを独立した実coreで再生検証した。

## 確認できた選択肢

- Code Magician、Magnamhut、Baldrakeは、この初期条件ではEndだけが合法。通常の複数枚の手札や墓地がある条件には一般化しない。
- 5種類の罠は手札で保持してEnd、または魔法・罠ゾーン5か所のいずれかにセットしてEndの6終端を確認した。
- Shifterはドロー、スタンバイ、メイン、エンドでの発動および温存の5終端を確認した。発動タイミングが違う結果を同一の効果状態とは断定しない。
- Catの通常召喚後はRinguriboh/Link Decoder、Hareは加えてAlmirajが候補に出る。Purulia、Ogre、Ash、Maxx C、Drollも通常召喚後にAlmirajへ変換できる。
- UIの往復操作を無限回繰り返す入力履歴まで列挙する意味の「全パターン」ではない。上記の局所往復を縮約した合法プレイの分岐を対象とする。

## 再実行

~~~powershell
node scripts/exhaustive-others.mjs --checkpoint-set=canonical --max-nodes=10000 --max-depth=160 --max-ms=30000
node scripts/exhaustive-others.mjs --resume --checkpoint-set=canonical --codes=96676583 --max-nodes=10000 --max-depth=160 --max-ms=30000
node scripts/exhaustive-others.mjs --verify
~~~

routes/exhaustive-others.json に集計、初期候補、通常召喚後候補、代表終端と境界の先頭5件を保存する。全終端と全未探索prefixはJSON内のcheckpoint欄に示すruntime/search-others配下へ保存する。canonical配下はv2での再計数、直下は旧探索からの再開履歴。チェックポイントはローカル実行資産でありGit追跡しない。

初期候補のみの再取得は --inventory-only を指定する。
`;
  fs.mkdirSync(path.join(root,'docs'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/exhaustive-others.md'),text);
}

export async function verifyResults() {
  const output=JSON.parse(fs.readFileSync(path.join(root,'routes/exhaustive-others.json'),'utf8'));
  assert.equal(output.presetHash,hash(preset));
  assert.deepEqual(output.scope.starters,starters);
  assert.equal(new Set(output.searches.map(result=>result.code)).size,16,'Each assigned card needs a search result');
  let replayed=0;
  for(const result of output.searches) {
    const checkpoint=JSON.parse(fs.readFileSync(path.join(root,result.checkpoint),'utf8'));
    assert.equal(hash(checkpoint),result.checkpointHash,`Checkpoint changed for ${result.code}`);
    assert.deepEqual(checkpoint.hand,[result.code]);
    assert.equal(result.complete,checkpoint.frontier.length===0);
    assert.equal(result.frontierCount,checkpoint.frontier.length);
    assert.equal(result.terminalCount,checkpoint.terminals.length);
    assert.equal(result.visited,checkpoint.visited);
    assert.equal(checkpoint.failures.length,0);
    if(checkpoint.version>=2) {
      assert.equal(checkpoint.protocol.sumSortVerified,true,'SUM/SORT protocol must be verified in the loaded process');
      assert.equal(checkpoint.pruning.linkUiLoops.enabled,true,'The documented UI contraction policy must be enabled');
    }
    if(result.freshStart)assert.equal(checkpoint.checkpointCompatibility.loadedVersion,null,'A fresh count cannot contain a resumed checkpoint');
    const terminalHashes=new Set(checkpoint.terminals.map(route=>hash(route)));
    for(const route of result.representatives)assert(terminalHashes.has(hash(route)),'Representative must be an exact recorded terminal route');
    for(const route of checkpoint.terminals) {
      await replay(route);replayed++;
    }
  }
  assert.equal(output.coverage.exhaustive,output.searches.every(result=>result.complete));
  assert.equal(output.coverage.completed,output.searches.filter(result=>result.complete).length);
  assert.equal(output.coverage.frontier,output.searches.reduce((count,result)=>count+result.frontierCount,0));
  assert.equal(output.coverage.terminalPatterns,output.searches.reduce((count,result)=>count+result.terminalCount,0));
  console.log(`VERIFY PASS: 16 checkpoint hashes and coverage records, ${replayed} independent terminal replays, ${output.coverage.completed} complete / ${16-output.coverage.completed} partial`);
}

async function main() {
  if(process.argv.includes('--verify')){await verifyResults();return;}
  const results=await inventory();
  const normalSummons=await normalSummonInventory(results);
  const destination=path.join(root,'routes/exhaustive-others.json');
  const previous=fs.existsSync(destination)?JSON.parse(fs.readFileSync(destination,'utf8')):null;
  const output={version:1,presetHash:hash(preset),scope:{handSize:1,firstTurn:true,opponent:'empty hand, empty field and graveyard',starters,
    linkUiContraction:'Audited standard Link material-selection toggles and summon cancellations returning to the same transaction state are excluded as repeated UI round trips; all other legal play branches are enumerated'},
    inventory:results,normalSummons,searches:previous?.presetHash===hash(preset)?previous.searches??[]:[],
    coverage:{status:'inventory-only',exhaustive:false,visited:results.length+normalSummons.length,frontier:null,
      reason:'Only the recorded scope with an empty frontier is exhaustive.'}};
  fs.mkdirSync(path.join(root,'routes'),{recursive:true});
  const write=()=>{
    const completed=output.searches.filter(r=>r.complete).map(r=>r.code);
    output.coverage={status:completed.length===starters.length?'complete':'partial',exhaustive:completed.length===starters.length,
      starters:starters.length,searched:output.searches.length,completed:completed.length,completedCodes:completed,
      visited:output.searches.reduce((n,r)=>n+r.visited,0),frontier:output.searches.reduce((n,r)=>n+r.frontierCount,0),
      terminalPatterns:output.searches.reduce((n,r)=>n+r.terminalCount,0),
      countingMode:output.searches.every(r=>r.freshStart&&r.kernelVersion===2)?'Fresh v2 search from each opening; audited no-op Link UI cycles contracted':'Cumulative checkpoint history; may include old UI round trips',
      reason:'Completion is restricted to the fixed preset, single starting card, first turn, empty opposing hand, fixed fixture deck order, and audited local Link UI cycle contraction. Unfinished frontiers are retained in runtime/search-others.'};
    fs.writeFileSync(destination,JSON.stringify(output,null,2)+'\n');
    writeReport(output);
  };
  if(process.argv.includes('--inventory-only')){write();return;}
  const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
  const selected=arg('codes','').split(',').filter(Boolean).map(Number);
  const order=[64865,33854624,72656408,40366667,94722358,20726052,57111661,78114463,91800273,
    96676583,20938824,84192580,59438930,14558127,23434538,94145021].filter(code=>!selected.length||selected.includes(code));
  assert(!selected.length||selected.every(code=>starters.includes(code)),'Only the assigned starter partition can be searched');
  const maxNodes=Number(arg('max-nodes',10000)),maxDepth=Number(arg('max-depth',160)),maxMs=Number(arg('max-ms',30000));
  const checkpointSet=arg('checkpoint-set','');
  assert(!checkpointSet||/^[a-zA-Z0-9_-]+$/.test(checkpointSet),'Checkpoint set must be a simple directory name');
  for(const code of order) {
    const checkpointPath=path.join(root,'runtime/search-others',checkpointSet,`${code}.json`);
    const resume=process.argv.includes('--resume')&&fs.existsSync(checkpointPath)?checkpointPath:undefined;
    const run=await search({hand:[code],seed:123,maxNodes,maxDepth,maxMs,checkpointPath,resume,stopOnDraw:true});
    const byFinal=new Map();
    for(const route of run.terminals) {
      const prior=byFinal.get(route.finalHash);
      if(!prior||route.steps.length<prior.steps.length)byFinal.set(route.finalHash,route);
    }
    const representatives=[...byFinal.values()];
    for(const route of representatives)await replay(route);
    const summary={code,name:cards[code].name,kernelVersion:run.version,freshStart:!resume,
      protocol:run.protocol,checkpointCompatibility:run.checkpointCompatibility,
      complete:run.complete,visited:run.visited,generated:run.generated,
      terminalCount:run.terminals.length,distinctFinalBoards:representatives.length,representatives,
      frontierCount:run.frontier.length,frontierReasons:run.frontier.reduce((counts,f)=>(counts[f.reason]=(counts[f.reason]||0)+1,counts),{}),
      frontierSample:run.frontier.slice(0,5),rejectedCount:run.rejected.length,failures:run.failures,
      checkpoint:path.relative(root,checkpointPath).replaceAll('\\','/'),
      checkpointHash:hash(JSON.parse(fs.readFileSync(checkpointPath,'utf8'))),scope:run.scope,bounds:run.bounds,
      invocation:run.invocation,pruning:run.pruning};
    output.searches=output.searches.filter(r=>r.code!==code).concat(summary).sort((a,b)=>starters.indexOf(a.code)-starters.indexOf(b.code));
    write();
    console.log(`SEARCH ${code} ${cards[code].name}: ${run.complete?'COMPLETE':'PARTIAL'}, visited=${run.visited}, terminals=${run.terminals.length}, distinct=${representatives.length}, frontier=${run.frontier.length}, errors=${run.failures.length}`);
    assert.equal(run.failures.length,0,'Search engine failures must be investigated');
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
