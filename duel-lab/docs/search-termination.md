# 探索の終了性と残る重複

2026-09-08時点のread-only調査。共有kernelの縮約条件は変更していない。

## 結論

固定デッキ・固定順序・先攻1ターンの探索について、**合法なゲーム行動の循環が存在しないという一般的な有限性は未証明**。今回の標本で見つかった反復は、v2で既に除去できる標準Link素材選択UIの往復だった。大きなfrontierの件数や古い`maxDepth`理由だけでは、新しい無限展開の存在を示せない。

`maxNodes`、`maxDepth`、`maxMs`は各探索呼出しの制限であり、全ゲーム木の有限性の証明ではない。未処理frontierが残る結果は`complete: false`。`complete: true`でも、固定された初期手札・deckOrder・rootPrefix、および監査済みUI往復を除いた範囲に限られる。

## 実coreで確認したfrontier

[probe-search-frontier.mjs](../scripts/probe-search-frontier.mjs)で4個のcheckpointから深い・中央・浅いprefixを各1個、合計12個再生した。checkpointは並行探索中の一時点の記録であり、後の件数とは一致しない場合がある。

| checkpoint | 観測時visited | frontier | 深いprefixの例 |
| --- | ---: | ---: | --- |
| search-rabbit/root | 4049 | 654 | 深さ160、素材の選択・解除反復 |
| search-cyberse/18789533 | 7384 | 463 | 深さ100、素材の選択・解除反復 |
| search-cyberse/30118811 | 7602 | 243 | 深さ100、Link選択・取消反復 |
| search-gold/gold-first-32061192 | 5234 | 35 | 深さ18、素材の選択・解除1往復 |

12個のうち7個はUI往復を含み、現v2に1ノードだけ通すと既存の監査済み規則で除去された。反復区間に`HINT`、`SELECT_UNSELECT_CARD`、`SELECT_IDLECMD`以外のゲーム進行messageはなかった。残りは4個が通常の未探索ノード、1個がターン終了だった。

v1から引き継いだ深さ制限frontierは、再訪されるまで古いprefixと理由を保持する。v2が既に往復を除去できても、DFSで新しい枝を優先している間は古い深いfrontierが集計に残る。

再現例:

```powershell
node scripts/probe-search-frontier.mjs runtime/search-rabbit/root.checkpoint.json runtime/search-cyberse/18789533.json runtime/search-cyberse/30118811.json runtime/search-gold/gold-first-32061192.checkpoint.json
```

このprobeが使う観測fingerprintは反復の診断専用であり、一般的な状態同一性や新しい枝刈りの根拠には使っていない。

## 追加削減の候補と制約

1. **古いfrontierの再訪順を調整する。** 全要素と`nextCandidate`を保持して、古い制限枝と浅い枝にも計算を配分する。枝を失わず、既存v2で除去可能なUI往復の残存件数を早く確定できる。単なる深さ上限の引上げではこの待ち行列は解消しない。
2. **完全一致する入力履歴の結果を再利用する。** 手札の並び、seed、deckOrder、全応答列、core・script版を含む同一の履歴だけが候補。異なる固定rootでは取消がroot外への退出になる場合があるため、rootと縮約方針も考慮する必要がある。今回は実装していない。
3. **同じLink取引内の素材クリック順の重複を調べる。** 独立fixtureでBackup、Wizard、Rabbitの3体から、TranscodeとWHITE BINDERをそれぞれ召喚した。先頭2枚の選択順を交換しても、2枚選択後のpending・全query・log、および召喚後の同じ比較が一致した。2例だけで一般的な合流の安全性は証明できないため、追加監査候補に留める。

```powershell
node scripts/probe-search-frontier.mjs --material-orders
```

特に、**Transcodeを選択中の取引とWHITE BINDERを選択中の取引では、素材2枚を選んだ時点の観測fingerprint自体が同一だったが、その後の召喚結果は異なった**。観測queryだけでは進行中の召喚対象を完全に表せない場合がある。取引識別や完全入力履歴を失う一般的な状態統合は行えない。HOPTが見かけの盤面に表れない反例は[search-correctness.md](search-correctness.md)にも記録されている。
