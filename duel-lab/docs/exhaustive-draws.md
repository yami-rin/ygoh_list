# 固定M∀LICEのドロー分岐

`scripts/exhaustive-draws.mjs` は、プレイヤーが選ぶ行動とドローの偶然を分離する。結果は `routes/exhaustive-draws.json`。固定40枚から、開始手札に指定したカードを正確に差し引く。

## 今回の実測範囲

2026-09-08、実際のWASMルールエンジンで以下を検証した。相手は空盤面・無妨害、先攻1ターン目。ここで網羅したのは記載した**ドロー結果と直後の分岐**であり、その後の全展開・最適盤面ではない。

| 対象 | 残デッキ | 結果 | 実エンジンの確認 |
| --- | ---: | ---: | --- |
| 闇の誘惑1枚 | 39枚 | 名前別308組合せ、順序別608通り | 元データ653プローブで正順の解決後353分岐を保存。独立監査で逆順の解決345分岐を追加確認 |
| Rabbit本線のWHITE BINDER | 34枚 | 22種類の1ドロー | 全22結果 |
| Dormouse本線のWHITE BINDER | 32枚 | 20種類の1ドロー | 全20結果 |
| Dormouse→Hare分岐のWHITE BINDER | 36枚 | 23種類の1ドロー | 全23結果 |
| Rabbit→MTPでRabbit検索→Cat | 34枚 | 260組合せの2ドロー | 全260結果 |
| UNDERGROUND/Terraforming担当からの34境界 | 28〜33枚 | 合計707結果の1ドロー | 全707結果 |
| 黄金櫃からのWHITE BINDER | 33枚 | 21種類の1ドロー | 全21結果 |

任意ドローは合計39境界・1053結果。別の手順や盤面が同じ残数になっても、使用済み効果が同じとは限らないので盤面や残数だけで統合していない。後続は合計1406分岐を未展開のfrontierとして扱う。これは残っている全展開の数ではない。

Catの境界は追加の初手を捏造していない。既存のRabbit1枚ルートでMTPの検索先をHareからRabbitへ変え、Binder帰還時の1ドローを辞退する。場に残るCatでそのRabbitを除外し、2ドローの選択まで実際に進めた。

元JSONの逆順プローブが検査したのはDRAW後の手札と合法な除外候補まで。除外・全墓地送りまでの逆順345分岐は、次の独立監査で実行している。元JSONを変更せず `runtime/search-draws/reverse-resolution-audit.json` に保存する。正順353と逆順345で698分岐となり、同名DARK2枚のもう一方の手札indexを除外する3分岐は後続探索で別に追加した（後続は701分岐）。逆順345のうち公開盤面・pending・残山札のhashが一致するのは240件で、105件は一致しない。いずれも将来の完全な状態同値の根拠として合流していない。

```powershell
node scripts/exhaustive-draws.mjs --audit-reverse
```

## 確率と同名カード

未知の残デッキが一様にシャッフルされている条件で、名前ごとの残数を `n(c)`、残デッキ枚数を `N`、引く枚数を `k` とする。

- 順不同のドロー結果の重みは `∏ C(n(c), drawCount(c))`、分母は `C(N,k)`。
- 順序を区別する場合は各ステップで残るコピー数を掛け、分母を `N×(N−1)×…` とする。
- 全結果の整数重みの合計が分母と一致することを `BigInt` で検証する。小数丸めによる合計検査にはしない。
- 実残数より多い同名カードは生成せず、存在しないコピーの減算は例外にする。
- 任意ドローの「はい／いいえ」や闇の誘惑の除外先はプレイヤーの意思決定。等確率のランダム分岐にしていない。

闇の誘惑の分母は `C(39,2)=741`。闇属性を含まない重みは253、含む重みは488。この253/741は**展開失敗率ではない**。闇属性がなく手札をすべて墓地へ送っても、ドットスケーパーなどの墓地効果が発動する。実エンジンが返した誘発選択を保存し、そこで展開失敗とは判定しない。

これらは「開始手札がその1枚だけ」の研究用fixtureの条件付き確率。実際の初手5枚では他の4枚もデッキから除かれている。勝率、貫通率、実戦の1枚初動成功率へそのまま転用できない。

## 固定山札とランダム遷移

`Duel.create` のfixtureは `PSEUDO_SHUFFLE`。カードは `main` 配列の順に底から上へ入り、**配列末尾が最初にドローされる**。`duelQueryLocation` と生の `DRAW` メッセージで一致を確認した。したがって `stackDraw(deck,[a,b])` は末尾を `[b,a]` にする。

既存ルートのseedを変えるだけではこの全分布にならない。現在の残デッキ全コードをqueryし、途中のサーチ・デッキからのセット・除外・墓地送りを反映したプールで毎回列挙する。既知の山札上や戻した順序がある場合は `knownTop` で条件を固定し、未知部分だけを列挙する。未知プールの一様性は `exchangeableUnknownPool:true` を明示しなければ受理しない。

順不同の組合せ表は確率分布の表現であり、その後の全状態を合流してよいという証明ではない。順序やコピーをまとめるには、途中の誘発処理・順序参照・個体履歴が同値だと確認する必要がある。闇の誘惑の後続探索では両順序と同名DARKの両indexを別ジョブにした。順序が意味を持つ効果や複数回に分かれたドローでは `ordered:true` と各ドロー時点の別境界が必要。

## 再現方法と共通探索への引継ぎ

基本の4境界と闇の誘惑は次で再生成する。

```powershell
node scripts/exhaustive-draws.mjs
```

今回のUNDERGROUND/Terraforming担当の34境界と黄金櫃の境界を含めるコマンドは次。引継ぎファイルは各担当のローカル探索で生成される。Rabbit担当の同じ入力列は重複取り込みしない。

```powershell
node scripts/exhaustive-draws.mjs --handoff=runtime/search-underground/draw-handoff-final.json --handoff=runtime/search-rabbit/draw-frontiers.json --handoff=runtime/search-gold/draw-handoff-gold-wb.json
```

主要API:

```js
enumerateDrawOutcomes(remainingDeckCodes, 2, {ordered: false});
drawBoundary(game, {cardCode: 96676583, drawCount: 2,
  exchangeableUnknownPool: true});
const successor = await materializeDrawOutcome(boundary, outcome.draw);
// successor.route は deckOrder と全入力履歴を持つ。終了後は必ず close()。
```

`materializeDrawOutcome` は途中盤面のカードだけを作り直さない。初期山札を積み、開始からの全操作をカード名・効果・ゾーンで再生する。デッキ内の同名コピーは下側から検索・除外し、ドロー予定のコピーを上に残す。ドロー直前に元の盤面と全残数が一致することを検査してから、実際の効果でドローする。そのため通常召喚権・名称ターン1・召喚制約・蘇生条件などの履歴を維持する。

この再生補助の検証範囲は保存した39境界。途中で山札を操作し直す未知の効果があれば、上に残したカードの検査で停止する。任意のゲーム履歴へ無条件に適用できるとはしていない。

共通探索に渡すには、返された `route.hand`、`route.deckOrder`、`route.steps` の入力列を使用する。各後続で次のドローが発生したら、再びその時点の残プールでchance frontierを作る。現在の出力に `laterGameplayExhaustive:false` を残しているのは、この後続木と未発見のドロー境界がまだ残るため。
