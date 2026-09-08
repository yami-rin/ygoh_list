# 通常召喚の取消し循環を除いた探索

`search-kernel-tribute.mjs`（version 4）は、高速版の実Duel再利用を維持し、証明済みの通常召喚取消し循環だけを縮約する。対象は固定presetのバルドレイクとマグナムートで、初期手札の唯一の個体が一度も手札から離れていない場合に限る。ソースの対応、取消し前の内部処理、実coreの継続比較は [MULTI_SEARCH_DEPTH_AUDIT.md](MULTI_SEARCH_DEPTH_AUDIT.md) に記録した。

対象の通常召喚選択→取り消し可能な１体リリース選択→cancel→同じIdleという取引だけを認める。自分の表側素材、イベント列、前後の全query・pending・LP・chain・logも一致させる。ソースpin不一致、余分なイベント、未知の移動、手札離脱があれば縮約しない。固定rootより前の祖先へ戻ることを理由に、そのroot内の探索を削除しない。

通常召喚を実行する選択、素材の選び方、効果やドローに進む枝は保持する。縮約件数と証拠は `pruning.tributeUiLoops` に記録する。以前にこの縮約を使ったcheckpointを、異なるpin・方針で再開することは拒否する。

## 既存記録と自動入力

`search-multi-pairs-tribute.mjs --import-legacy --shard N` は高速版の全履歴を、別の `runtime/multi-pair-search-tribute/shard-N` へコピーする。元のreference→fast移行情報も祖先として保持する。記録をコピーしただけで枝を完了扱いにはしない。

既存のbest routeに取消しの往復がある場合、監査helperが指定した連続２入力だけを除き、初手からすべての残入力を再生する。各入力のbefore hash・label、最終盤面hash、完全なlogが一致した場合だけ短縮版を保存する。実際のリリースと召喚は残る。入力数の減少を評価値へ反映し、旧route hashと除去位置を保存する。元の探索履歴は書き換えない。

## 検証

- 全体の `npm test`: **178件PASS、失敗0、skip0**。
- 新kernelの10件: 旧v2/v3の長prefix途中の取消し検知、固定root境界、連続再開、DRAW、既存Link監査、適用拒否条件、ソース変更時の挙動。
- 移行・短縮の３件: 移行の履歴・候補位置の保持と非巻き戻し、異なるidentityの拒否、短縮後の終端・log・評価差と元routeの不変性。
- 独立監査の実例: バルドレイクの取消し86往復を含む182入力を10入力へ短縮し、残りのリリース・通常召喚と最終結果を維持。

再開と集計：

```powershell
node scripts/search-multi-pairs-tribute.mjs --shard 0 --nodes-per-pair 10000 --ms-per-pair 10000 --depth 240 --passes 1
node scripts/build-multi-search-report.mjs --tribute
```

集計前に全shardを停止する。代表手順は集約時にも独立再生する。現在の完了組数と残枝は [MULTI_SEARCH_COVERAGE.md](MULTI_SEARCH_COVERAGE.md) を参照。対象外のカードや手札へ一般化した縮約、未知ドロー後、相手の妨害、すべての５枚手札の網羅は含まない。

## 最初の全shard再開結果

高速版の334,795訪問から107,412訪問を追加し、累計442,207訪問。完了136組は維持され、未完197組・残枝79,907である。取消し縮約は166件。全333組で高速版の元ファイル、さらに元referenceへの移行祖先、旧終端・除外ドロー境界の保持とlock解放を確認した。

| 保存代表 | 前回の入力数 | 今回の入力数 | 比較 |
| --- | ---: | ---: | --- |
| バルドレイク＋黄金櫃 | 237 | 9 | 同じ最終盤面・完全log |
| バルドレイク＋テラ・フォーミング | 179 | 13 | 同じ最終盤面・完全log |
| マグナムート＋黄金櫃 | 237 | 9 | 同じ最終盤面・完全log |
| マグナムート＋UNDERGROUND | 239 | 13 | 同じ最終盤面・完全log |

最終保存代表は探索中に選ばれた新候補で、４本とも `shortening` metadataの直接付与件数には入らない。独立したhelper試験で旧列から取消対を取り除けることも確認したが、最終の入力配列がすべてその削除結果と完全一致するとは主張しない。検証記録は [MULTI_SEARCH_TRIBUTE_RESULTS.json](MULTI_SEARCH_TRIBUTE_RESULTS.json)。

短いprefixを優先する既存の探索順により、取消しを含む旧長prefixが残っている。例として、pair265の100入力超515件、pair286の100入力以上843件、pair215の180入力以上かつ取消し50回以上217件は、この一巡で未処理のまま保持された。旧180入力の１枝を別途検証したところ９入力目で停止できたが、その独立試験を本集計へ加算していない。次の課題はこれらの既存長prefixを優先して監査することであり、取消し循環を全件処理済みとは扱わない。
