# 保存済み取消し枝の監査

短い入力列を優先する通常探索では、過去に保存した長い取消し列が後回しになる。この監査は既存のfrontierだけを長い順に再生し、凍結したversion 4 kernelが証明できたUI循環を除去する。新しい候補は生成しない。カード効果や素材選択を省略する処理ではない。

対象は初期手札にバルドレイクまたはマグナムートがあり、取消入力を含む保存枝。既存の失敗記録が参照する枝と未確認エラー枝は対象外とする。元の固定root、seed、山札順、候補位置を維持し、通常召喚取消しと既存Link UIの証明条件は [MULTI_SEARCH_TRIBUTE.md](MULTI_SEARCH_TRIBUTE.md) に従う。

## 保存条件

- 生成候補0、新しい出力キー0、重複除去の増分0。
- 削除した元frame数と、kernelが記録した３種類のUI縮約件数の増分が一致。
- 終端、拒否、エラー、時間切れ、未処理の枝は元frameのまま保持。同じ入力列でも候補位置が違えば別frameとする。
- 残したframeの順序、metadata、全訪問数、終端履歴、除外ドロー、保存ルート、移行証拠を変更しない。監査側の「完了」を本探索へ転用しない。
- 同じshard lockを取得し、ソースpinと更新前bytesを再照合する。更新前後のbytes・SHA256・削除frame・再生結果をledgerへ保存してからcheckpointを更新する。

監査の再生回数は `auditVisits` としてledgerへ記録し、本探索の `visited` には加算しない。`pruning` の累計は通常探索と監査の両方を含むため、訪問数の内数として解釈しない。

## 実行と検証

```powershell
node scripts/audit-tribute-frontier.mjs --shard 0 --ms-per-pair 60000
node scripts/verify-frontier-audit.mjs
node scripts/build-multi-search-report.mjs --tribute
```

同一shardを同時に実行しない。集約は全担当が停止してから行う。ledgerは各shardの `frontier-audits` 配下に保存する。時間切れで残った枝は削除しない。

実coreの８テストで、混合frame、候補位置、固定root、0予算、部分予算、失敗除外、再実行の不変性を確認した。隔離ディレクトリの保存テストでは、lock競合、更新前後の証拠、checkpoint更新、正規集計への反映を確認した。独立レビューでも、証明できた枝以外を保持することを実coreで照合した。

実データの結果は [MULTI_SEARCH_FRONTIER_AUDIT_RESULTS.json](MULTI_SEARCH_FRONTIER_AUDIT_RESULTS.json) と [MULTI_SEARCH_COVERAGE.md](MULTI_SEARCH_COVERAGE.md) に記録する。この監査だけで新しい展開や最適な終盤を発見したとは扱わない。

## 2026-09-08の結果

６担当で11,318枝を再生し、10,740枝を除去した。独立検証は空の２shardも含め８／８PASS。全体の残枝は79,907から69,167へ減り、完了136組・未完197組。訪問442,207、終端126,411、除外ドロー8,482は保持した。残枝の最長入力数は81となり、深さ240以上や深さ上限で保留された枝はなくなった。

`npm test` は187件PASS、失敗・skipなし。保存ルート330件と手作業ルート65件は集計時の実core再生に成功した。独立verifierは13種類の不正な複製データも拒否した。

前回のnative検証の40ファイルのうち、変更は自動入力が読み込まない集計 `routes/multi-search-report.json` だけだった。対戦処理・入力ルート・fixtureは同じため、[12ケースのnative検証](NATIVE_MULTI_VERIFICATION.md)を再利用し、稼働中アプリは再起動していない。native証拠の元sourceIdentityを書き換えて今回の全ファイルと同一とは扱わない。

### 残存するモンスターセット取消し

監査停止後の333 checkpointを独立集計し、残枝69,167、最長81入力、深さ上限による保留0、取消入力を含む枝578を確認した。末尾に同じ２入力が６回以上続く枝は６件あり、深さ上限には達していない。代表２件だけを先頭15入力まで実coreで再生した。

- pair 288（バルドレイク＋黄金櫃）、shard 0、frontier index 222（0起点）、保存54入力。黄金櫃でドットスケーパーを除外・帰還させ、リングリボーにした後、バルドレイクのセットと取消しを３回再現。
- pair 210（マグナムート＋UNDERGROUND）、shard 2、frontier index 0、保存66入力。UNDERGROUNDでCheshire Catを除外・帰還させ、リングリボーにした後、マグナムートのセットと取消しを３回再現。

両例とも入力 `action: 1` の実応答は `SELECT_IDLECMD` の `action: 3`（モンスターセット）。直後は `HINT_SELECTMSG`（type 3／hint 500）と `SELECT_TRIBUTE`（取消可、min=max=1、リングリボーのMZONE sequence 5、release_param 1）、`cancel: true` 後は `SELECT_IDLECMD` のみだった。現kernelの `makeTributeAudit.before` は実応答 `action: 0`（通常召喚）だけを対象とするため、このセット手順は縮約条件から外れる。

この再生は取消し反復の存在を確認したもので、セット取消しを除去しても戦略状態が等価になることは証明していない。次回の調査候補として保持し、今回のkernel・checkpoint・対戦処理は変更していない。残る578枝すべてをこの原因とは分類していない。
