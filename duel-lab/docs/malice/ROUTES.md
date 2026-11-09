# M∀LICE の展開ルート（ユーザーのデッキ）

全てエンジンで再生できる保存ルート。ユーザーのリプレイは `routes/user-replays.json`、探索で見つけた改善は `routes/malice-routes.json`。
点数は `scripts/malice-search.mjs` の静的見積もり（相手ターンに使える妨害の目安。ドローで増えた手札は1枚0.3）。

## ユーザーのリプレイ（基準）

| 初動 | 最終盤面 | LP | 点 |
| --- | --- | --- | --- |
| Dormouse 1枚 | ネオテン＋アコード＋伏せGWC－06（墓地にソウル） | 7100 | 3.31 |
| UNDERGROUND 1枚 | ネオテン＋アコード＋伏せGWC－06（墓地にソウル） | 6500 | 3.61 |
| NS＋コード・マジシャン | リングリボー＋トランスコード＋アコード＋WHITE BINDER＋ネオテン＋伏せGWC－06 | 6800 | 2.81 |
| Cat＋March Hare | トランスコード＋アコード＋WHITE BINDER＋WR＋ネオテン＋伏せGWC－06 | 6200 | 2.61 |
| White Rabbit 1枚 | ネオテン＋ウィキッド（墓地にソウル・HEARTS） | 5900 | 2.31 |

## 改善候補（ユーザーの手順を案内にした探索で発見、各300秒）

### R1 Cat＋March Hare：先にCat①でMHを除外して2ドロー（`malice-cat-hare-plus`）

1. Cat を召喚 → **Cat①：手札のMarch Hareを除外して2ドロー**。
2. **MH③（300LP）：除外されたMH自身を対象に手札へ戻す**。
3. あとはユーザーの手順どおり（Catでリングリボー → MH①でCatを除外して特殊召喚 → …）。元の手順で後半に使っていたMH③（ウィキッド③のコストでMHを除外した時の回収）は使わない。

結果：最終盤面・LP（6200）は元と同じで、**手札が2枚多い**。代償：Cat①の2ドローはうららの対象（[FINDINGS.md](FINDINGS.md) F3）なので、うららを先にCat①へ撃たれる窓が1つ増える。→ ユーザー確認 [QUESTIONS.md](QUESTIONS.md) Q4。

### R2 Dormouse 1枚：GWC－06をこのターンに使う（`malice-dormouse-gwc-now`）

伏せて終わるGWC－06を自分のターンに使い（WHITE BINDERを除外→③で復帰＋1ドロー、Catを蘇生してネオテンの素材に）、リングリボーを場に残す。ネオテン・アコード・ソウルは同じ、伏せGWCなし、LP 7100→6200、手札+1。妨害評価器（相手＝旧プリセットのミラー、4000手順）では元と同じ妨害2で差は出ない。→ Q3。

### R3 NS＋コード・マジシャン：WHITE BINDER①の使い方（`malice-ns-codemagician-plus`）

最初のWHITE BINDER①は使わず、アコード①で蘇生したWHITE BINDERの①で墓地のWRとMHを除外 → MH③（300LP）でMHを手札へ。盤面は元と同じ、LP 6800→6500、手札にMH（相手MPにも①で出られる）。

### 変化なし

- UNDERGROUND 1枚：13,606手順で元の盤面を上回るものなし（+ドロー0.002のみ）。
- White Rabbit 1枚：盤面同じ、手札の差はドロー順依存。

## 初動カタログ（手札の残りは代役、近いリプレイを案内に各300秒、`scripts/malice-catalog.mjs`）

| 手札 | 点 | 主な妨害 |
| --- | --- | --- |
| WR＋UNDERGROUND | 3.81 | ネオテン（ディセーブルム）・ソウル・アコード・伏せGWC・リングリボー |
| Dormouse＋March Hare | 3.81 | 同上 |
| UNDERGROUND＋Cat | 3.81 | 同上 |
| UNDERGROUND＋March Hare | 3.61 | ネオテン・ソウル・伏せGWC・ファイアウォール① |
| Dormouse＋Cat | 3.61 | ネオテン・ソウル・アコード＋2ドロー |
| NS（ドロール）＋コード・マジシャン＋MH | 3.11 | ネオテン・アコード・伏せGWC・リングリボー |
| WR＋March Hare | 2.91 | ネオテン・ソウル＋3ドロー（WRルートの延長止まり。手組みでも2.31） |
| WR＋Cat | 2.91 | 同上 |
| バックアップ＋MH | 2.61 | ネオテン・アコード・伏せGWC |
| バックアップ1枚 | 2.51 | ネオテン・ソウル・リングリボー |
| Cat＋Cat | 1.61 | S:Pリトルナイト＋2ドロー |
| March Hare＋March Hare | 1.01 | S:Pリトルナイト（MHは手札・墓地に別のM∀LICEがないと出られない） |

読み方：UNDERGROUNDかDormouseを含む2枚は3.6〜3.8点で安定。WRは2枚目がMH・Catだと伸びない（③・①の名前の重なり）。MH・Catの同名2枚は初動にならない。
