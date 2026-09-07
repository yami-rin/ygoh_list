# M∀LICEモンスターの1枚初動調査

2026-09-08。固定 `preset.json`（メイン40枚・EX15枚）を対象とする。`scripts/research-malice-monsters.mjs` が実際のWASMルールエンジンに入力し、`routes/malice-monsters.json` に合法入力列と到達盤面を保存する。

## 判定と範囲

| カード | 判定 | 1枚以外に必要な資源 |
| --- | --- | --- |
| White Rabbit | 真の1枚初動 | なし。通常召喚権とデッキ/EXの展開先が必要 |
| Dormouse | 真の1枚初動 | なし。通常召喚権、展開先、未使用のドットスケーパー①が必要 |
| Cheshire Cat | 条件付き展開札 | ①には手札の別M∀LICEが必要。単独では自身の召喚またはL1止まり |
| March Hare | 条件付き展開札 | ①には手札/墓地の自身以外のM∀LICEが必要。単独では自身の召喚またはL1止まり |

先攻1ターン目、初手は指定カード1枚だけ、相手の盤面・手札は空、開始LP8000。手札のカードは先に固定デッキから取り除いてから配置し、同じカードを増殖させない。白バインダーの任意ドローは全ルートで辞退する。カード総数、追加ドローなし、最終の手札・モンスター・LPを検証する。

4種類の分類と15本の有限なルート、主要初回分岐を確認する9本のprobeを検証した。全合法手順木、全ゾーン置換、全妨害への分岐、勝率、最善性は証明していない。Catの「別のM∀LICEを除外して2ドロー」は2枚組であり、ドロー先を保証した1枚展開には含めない。Hareの除外時効果は手札回収であり、自身の帰還効果ではない。ただし除外されたHare自身を対象にして手札回収できる。

## Rabbitの共通部分

1. Rabbitを通常召喚し、TB－11をセット。
2. TBの同ターン発動コストでRabbitを除外し、Dormouseをデッキから特殊召喚。Rabbitは300LPで帰還。
3. Dormouseをリンク・デコーダーに変換し、デコーダーとRabbitでS：Pをリンク召喚。
4. S：Pで墓地のDormouseを除外し、300LPで帰還。TBで特殊召喚された個体の効果発動禁止が場を離れて解除されることを、実エンジンで確認。
5. DormouseでCatをデッキから除外し、300LPで帰還。
6. S：PとDormouseでWHITE BINDER。墓地のRabbitとTBを除外する。Rabbitの帰還効果は既に使用済みなので再使用しない。
7. BinderでMTP－07をセット。Binderを除外してMTPを発動し、Hareをサーチ。Binderは900LPで帰還し、ドローは辞退。
8. Hareで墓地のMTPを除外して自身を特殊召喚。

ここでBinder＋Cat＋Hare、手札0、LP6200。S：Pを特殊召喚したターンなので、トランスコードの蘇生効果による伸ばし方は使えない。

| 保存ID末尾 | 最終盤面 | 入力数 | 意味と限界 |
| --- | --- | ---: | --- |
| `ip` | Binder＋I：P | 58 | I：PとBinderを使う相手ターンL召喚の素材を残す。相手ターン手順自体は未収録 |
| `crypter` | HEARTS OF CRYPTER | 60 | 除外済みのM∀LICEカードが①の資源。3体素材を使うため他のモンスターは残らない |
| `accord` | アコード＋Binder | 62 | アコードのリンク先にBinderを蘇生。②は1ターンに1度 |

`rabbit-no-draw-*` の3本。いずれも手札0、LP6200。短さ・残る後続・相手のデッキに応じて採用候補を選び、唯一の最善手としては扱わない。

## Dormouseの共通部分

1. Dormouseを通常召喚し、Rabbitをデッキから除外。Rabbitが300LPで帰還し、MTPをセット。
2. Dormouseを除外してMTPを発動、Hareをサーチ。Dormouseは300LPで帰還。
3. Dormouseをデコーダーへ変換し、デコーダーとRabbitでウィキッドを左EXモンスターゾーン（sequence 5）へ。
4. Hareで墓地のMTPを除外し、ウィキッドのリンク先（sequence 1）へ特殊召喚。ウィキッドで墓地のDormouseを除外し、バックアップをサーチ。Dormouseの帰還は使用済み。
5. バックアップを特殊召喚し、コード・マジシャンをサーチして、そのコード・マジシャン自身を捨てる。コード・マジシャンでドットスケーパーを墓地へ送り、ドットが特殊召喚。
6. ウィキッドとHareでBinder。墓地のRabbitとHareを除外し、Hareの③で300LPを払ってRabbitを手札へ回収。
7. BinderでGWC－06をセット。Binderを除外してGWCを発動、除外中のDormouseを特殊召喚。Binderは900LPで帰還し、ドローは辞退。

ここでBinder＋バックアップ＋ドット＋Dormouse、手札Rabbit、LP6200。バックアップの捨てるカードはサーチで得たコード・マジシャンなので、初手の追加手札をコストとして要求しない。

| 保存ID末尾 | 最終盤面 | 手札 | 入力数 |
| --- | --- | --- | ---: |
| `crypter` | Crypter＋Binder | Rabbit | 73 |
| `ip` | I：P＋Binder＋Dormouse | Rabbit | 71 |
| `accord` | アコード＋トランスコード＋Binder＋アクセスコード | Rabbit | 93 |
| `firewall-accord` | アコード＋トランスコード＋Binder＋ファイアウォール | 0枚 | 102 |

`dorm-no-draw-*` の4本。いずれもLP6200。

- `crypter` はバックアップ・ドット・Dormouseの3体でCrypterを右EXゾーン（sequence 6）に出し、そのリンク先（sequence 4）にBinderを残す。Crypter①の無効化されない条件と、除外状態のMTP/Hareを確保する。
- `ip` はバックアップとドットでI：P。I：P＋Dormouseから相手ターンにW：Pを作る等の余地を残す。相手ターンの応答・相手カードを含む処理までは本リプレイでは検証していない。
- `accord` はバックアップ・ドット・Dormouseでトランスコード→墓地のデコーダーを蘇生→Binder＋デコーダーでアクセスコード→デコーダー帰還→トランスコード・アクセスコード・デコーダーでアコード。元々の攻撃力2300の3体を蘇生する。**3体を残してもアコード②が3回使えるわけではなく、1ターン1回。**
- `firewall-accord` はBinder＋ドットでファイアウォール→バックアップ＋DormouseでI：Pをリンク先に作り、ファイアウォールで手札Rabbitを特殊召喚→I：P＋Rabbitでトランスコード→Binder蘇生→相互リンクしたファイアウォールで墓地のコード・マジシャン回収→トランスコード・Binder・手札コード・マジシャンでアコード。ファイアウォール①はこの途中で使用済みで、同じ表側表示の個体が次ターンに再使用できるとは数えない。

## Cat / Hareの負例

Catは通常召喚のみ、リングリボー、デコーダーの3本。Hareはそれにアルミラージを加えた4本を保存する。召喚前後に自身の展開効果を発動できないこと、出せるL1一覧、L1後に追加召喚へ進めないことを実エンジンの選択肢から検証する。リングリボーの罠妨害などの用途は残るが、M∀LICE展開を始められるという分類にはしない。

## 主要な最初の選択の監査

Rabbitが最初にセットできる罠3種、MTPの検索先4種、TBの特殊召喚先4種、Dormouseの初回除外先3種を、本線またはprobeで確認する。以下の「止まる」は指定した接続で資源を増やせない意味であり、全ての後続L召喚が存在しないという主張ではない。

| 最初の選択 | 保存した観測 | 本線との違い |
| --- | --- | --- |
| Rabbit→MTP→Rabbit/Cat/Dormouse | Rabbit1体＋検索札1枚、LP7700。通常召喚/固有展開効果の追加選択肢なし | 通常召喚権をRabbitに使用済みで、検索した下級を召喚できない |
| Rabbit→MTP→Hare | Hareが墓地MTPを除外して特殊召喚、Rabbit＋Hare、LP7700 | 2体を得るがDormouseのデッキ除外効果に届かない。以後の全L2置換は総当たりしない |
| Rabbit→GWC | Rabbit＋セットGWC、LP8000。GWCの発動自体が不可 | 発動前の墓地・除外に蘇生できるM∀LICEが存在しない。これからコストで除外する予定のRabbitを、既存の蘇生対象として数えない |
| Rabbit→TB→Rabbit | Decoder/S:Pを経由し、S:P1体、LP7700 | Rabbitのセット/帰還は名称ターン1。2枚目のRabbitでも回数を増やせない |
| Rabbit→TB→Cat | Decoder/S:PでCatを除外帰還し、S:P＋Cat、LP7400 | TBの発動禁止は解除できても、Cat①に必要な追加M∀LICE手札がない |
| Rabbit→TB→Hare | Decoder/S:PでHareを除外、自己回収、墓地Rabbitを除外してHare特殊召喚。S:P＋Hare、LP7400 | Rabbit③は先に使用済みで再帰還しない |
| Rabbit→TB→Dormouse | 前述の本線3終点 | 帰還したDormouseの①が未使用なので、Catを追加して3体にできる |
| Dormouse→Cat | Cat帰還→Decoder/S:P→Dormouse帰還、S:P＋Dormouse、LP7400 | Dormouse①を最初にCatへ使用済み。後からRabbitをデッキ除外できず、Catのドロー用手札もない |
| Dormouse→Rabbit | 前述の本線4終点 | 罠へ接続し、Wicked/Backupの検索・送墓を使う |
| Dormouse→Hare | 下記の別ルート。アコード＋Binder、LP8500 | Hare③の自己回収を先に使い、Wicked/Backup/Mag/Dotを使わずに進む |

Dormouseは固定デッキに1枚だけで、それを初手へ配置している。初回効果の全候補がRabbit/Cat/Hareの3種類に限られ、同名Dormouseをデッキから除外できないことも実エンジンでassertする。

## DormouseからHareを先に除外する別ルート

`dorm-hare-first-accord`、64入力、追加手札・ドローなし。

1. Dormouseを通常召喚し、Hareをデッキから除外。Hare③で300LPを払い、除外された自身を手札へ回収。
2. Dormouseをデコーダーにする。Hare①で墓地のDormouseを除外しHareを特殊召喚、Dormouseは未使用の③で300LPを払って帰還。
3. デコーダー・Dormouse・Hareの3体でBinder。元々の攻撃力2300のL素材になったデコーダーが帰還。Binderで墓地のDormouse/Hareを除外するが、両者の除外時効果は使用済みで再使用しない。
4. BinderでTBをセットし、Binderを除外して発動。デッキからRabbitを特殊召喚するが、TBの発動禁止が付いているのでセット効果は使えない。Binderは900LPで帰還し、ドローは辞退。
5. Binder＋RabbitでS：P。墓地のRabbitを除外して300LPで帰還させ、GWCをセットする。場を離れたためTBの発動禁止が解除される。
6. Rabbitを除外してGWCを発動し、墓地のBinderを蘇生。Rabbit③は使用済み。蘇生したBinder自身がM∀LICEリンクとして存在するのでGWCで2300LP回復。
7. S：Pをリンク1相当、Binderをリンク3相当、デコーダーをリンク1相当としてアコードをリンク召喚し、Binderを蘇生。

最終はアコード＋Binder、手札0、LP8500。アコード②は1ターン1回。基本線から使うEXや効果が異なる有用な代替として保存し、どの妨害に常に強いかは未測定。Hare③を最初に自身の回収へ使うため、同ターンに別のRabbitを回収する効果としてもう一度数えることはできない。

## 再生成・検証

```powershell
node scripts/research-malice-monsters.mjs --write
```

15ルートと9probeの生成後、全24件を新しい実エンジンで再生する。各入力直前の盤面とエンジン要求のハッシュ、最終盤面ハッシュを比較し、拒否された入力がないことを確認する。`--trace` を付けると全プロンプトと入力を表示する。`--rabbit` または `--dorm` は基本線だけの部分検証専用で、完全なJSONの上書きには使えない。

カードの根拠はローカル `data/cards.json` の全文と `data/scripts/official/c*.lua`。特に `c57111661.lua` の発動禁止とリセット、`c96676583.lua` の手札条件、`c20938824.lua` の特殊召喚/回収条件、`c20726052.lua` の発動前の蘇生対象条件、`c39138610.lua` の回数制限を、リプレイ上の挙動と合わせて扱う。外部検索やAstra CLI呼び出しはこの調査では使っていない。
