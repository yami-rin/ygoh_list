# 実Duel再利用による探索の高速化

`search-kernel-fast.mjs` は、各盤面の先頭の子だけを同じ実Duelへ応答して探索する。ほかの子は従来どおり初手から全入力を再生する。盤面の見た目による合流、配置の省略、同名カードの統合は行わない。元のkernelと探索記録は保存する。

訪問順、全候補の生成順、Link素材の選び直し・キャンセルの既存監査、ドロー停止、予算による中断、未探索prefixと候補位置を維持する。同じDuelを進める前にJavaScriptの履歴配列を分離し、以前保存したルートが後続の応答で伸びることを防ぐ。

## 検証

`tests/search-kernel-fast.test.mjs` の14件では、従来版と高速版を実coreで比較する。訪問ごとのpending・全ゾーンquery・盤面・履歴、終端ルート、未探索prefix、拒否応答、観測コールバックの順を照合した。生成数上限、深さ上限、途中再開、手札リンク素材、効果使用後の状態、DRAW、実coreのRETRY、履歴の不変性を含む。

単独比較の測定値は以下。全333組で同じ倍率になるという意味ではない。

| 範囲 | 従来のDuel生成 | 高速版のDuel生成 | 従来の時間 | 高速版の時間 |
| --- | ---: | ---: | ---: | ---: |
| ウィザード全木 | 94 | 41 | 1.865秒 | 0.790秒 |
| 霊王＋神の密告 | 114 | 51 | 2.137秒 | 0.970秒 |
| Rabbit＋TB、入力深さ6 | 675 | 396 | 12.832秒 | 7.650秒 |

`visited` と `replayedResponses` は従来と比較できる論理上の累計。実際のDuel生成数、初手からの再応答数、再利用した応答数は `execution` に別途記録する。旧版から引き継いだ実行コストは推測して足さない。

## 既存記録の引き継ぎ

`search-multi-pairs-fast.mjs --import-legacy --shard N` は、旧版の `runtime/multi-pair-search/shard-N` を、新しい `runtime/multi-pair-search-fast/shard-N` へコピーする。両ディレクトリの排他ロックを取得し、プリセット・ソース・カード資産・pair・seed・protocol・DRAW分離を検査する。元の記録は書き換えず、元ファイルhashと引き継ぐ履歴のhashを保存する。再度importしても、進んだ高速版の記録を巻き戻さない。

`tests/multi-pair-fast-migration.test.mjs` は、実coreで未知ドローに到達した旧版記録のコピー、同じ履歴・候補位置の保持、高速版での再開、再import時の非巻き戻し、異なるseedとロック競合の拒否を確認する。

再開例：

```powershell
node scripts/search-multi-pairs-fast.mjs --shard 0 --nodes-per-pair 10000 --ms-per-pair 10000 --depth 240 --passes 1
node scripts/build-multi-search-report.mjs --fast
```

集計は全shard停止後に実行する。保存ルートを初手から独立再生し、探索元とルートが検証中に変化していないことも照合する。現在の結果は `MULTI_SEARCH_COVERAGE.md` を参照。残枝がある組合せは全網羅と扱わない。

## 333組での最初の実行

8分担で未完199組を各10秒・最大10,000訪問・入力深さ240の範囲で再開した。追加111,798訪問、累計334,795訪問。無ドロー範囲完了は134→136組、残り197組・66,571 prefixである。新しく完了したのはコード・オブ・ソウル＋アトラクター、March Hare＋霊王の波動。

この追加探索の実Duel生成は44,285回、再利用した応答は67,513回。足すと追加訪問111,798に一致する。すべて初手から再生する方式に対し、この範囲ではDuel生成を約60%減らせた。実経過時間が60%減ったという測定ではない。

全333個の移行元ファイルhash、移行payload、過去の終端履歴と除外ドロー境界の保持、完了済み木の維持、全lock解放を照合した。独立集約では330本の探索代表と65本の手作業ルートを初手から実core再生し、DRAWを越えないことを確認した。全体の証拠は [MULTI_SEARCH_FAST_RESULTS.json](MULTI_SEARCH_FAST_RESULTS.json)。
