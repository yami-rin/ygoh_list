# 黄金櫃1枚からの探索

`preset.json` の40枚から黄金櫃1枚を手札へ取り出し、残り39枚を山札、元のEX15枚を使う。先攻1ターン目、相手の盤面と手札は空、妨害なし。追加の初期手札・召喚権・効果リセットを加えない。

現時点で**全手順木は未完了**。`routes/exhaustive-gold.json` の `complete` は `false`。検証済みの入力列、探索済みノード、未探索frontier、予算制限を区別する。

## 実行した探索量

2026-09-08時点で **20,756訪問、20,206生成、6,386終端履歴、未探索249境界、効果処理失敗0**。最初に25種類の除外対象へ同じ400ノードの予算を配り、早く尽きた枝の残り予算をDormouse・Rabbitへ回した。さらに既知の深い2盤面からも探索し、root・Dormouse・Rabbitに追加10,000訪問を配分した。

| 探索開始点 | 訪問 | 終端履歴 | 未探索境界 |
| --- | ---: | ---: | ---: |
| 黄金櫃を使う前のroot | 3,173 | 1,055 | 54 |
| 展開効果のない初回除外20種類 | 40 | 20 | 0 |
| Dot先除外 | 749 | 218 | 0 |
| Hare先除外 | 820 | 209 | 0 |
| Cat先除外 | 744 | 217 | 0 |
| Dormouse先除外 | 7,234 | 2,308 | 30 |
| Rabbit先除外 | 6,443 | 1,949 | 20 |
| TB→WHITE BINDER/MTPの後続 | 857 | 229 | 65 |
| Rabbit/Hare→WHITE BINDER帰還のドロー直前 | 696 | 181 | 80 |

25対象のprefixでは、黄金櫃を魔法罠ゾーン0で発動し、対象名の最初の実カード添字を選んでいる。その固定入力列から先について、23種類でfrontierが空になった。**黄金櫃の全配置・全同名コピー・全発動前手順が完了したという意味ではない。** それらはrootの未探索部分にも残る。

訪問数は入力列のreplay回数で、相異なる有用コンボ数ではない。rootと深いprefixには範囲の重複がある。初期の探索には「特殊召喚候補を選択→キャンセル」の反復を含む終端履歴もあり、6,386を有用盤面の種類数とはしない。

共通カーネルv2の監査付きLink素材UI循環除去を使い、独自のキャンセル保留callbackは削除した。追加実行の冒頭で旧キャンセル482境界を一度ずつ監査処理し、継続可能な入力へ予算を回した。盤面全体の同一視は行わない。現在はノード上限96件、時間上限151件、ドロー境界2件が未探索に残り、`cancelBoundary` は0件。深度上限は200応答に広げたが、この保存時点で `maxDepth` 境界はない。引き続き `complete=false` である。

28チェックポイントのSHA-256・手札・preset・件数・完了条件を照合し、終端履歴から選んだ36例を独立replayした。検証例の選択にだけ盤面のカード名によるグループ化を使い、探索状態の統合には使っていない。入力列と全frontierは `runtime/search-gold/*.checkpoint.json` に保持し、追跡するJSONにはファイルサイズ・SHAと集計を記録した。チェックポイントはローカルの生成物で、再開にはその実ファイルが必要となる。

## 実coreで検証したTB分岐

黄金櫃でDormouseを除外し、300LPで帰還。DormouseでRabbitを除外し、さらに300LPで帰還してTBをセットする。

TBを当日に発動するコストは、場のDormouseまたはRabbitの2種類。解決時にデッキから出せるカード名はRabbit、Cat、Hareの3種類である。この **2×3＝6分岐** をエンジンが出した実メニューから列挙し、すべて特殊召喚後まで実行した。それぞれ20入力、7400LP、手札0、モンスター2体で、別のデュエルから独立replayした。

この6分岐のprobeでは最初の合法ゾーンと攻撃表示を選んでいる。すべての配置を検査したという意味ではない。全配置・EX・素材・順序は共通探索カーネルの探索結果とfrontierで別に管理する。

TBから出したモンスターは、そのままでは効果を発動できない。たとえば「TBでCatを出した直後にCatの効果を使える」とは扱わない。

## TBからWHITE BINDER＋未使用MTP

次の41入力を実coreで実行し、独立replayでも確認した。

1. 上記のDormouse→Rabbit→TBから、TBのコストでRabbitを除外し、Catをデッキから特殊召喚する。
2. DormouseをLink Decoderへ変換し、DecoderとCatでS:PをL召喚する。
3. S:Pで墓地のCatを除外する。CatはTBから特殊召喚されており、除外からの帰還はまだ使用していない。300LPを払い帰還する。
4. S:PとCatでWHITE BINDERをL召喚する。墓地除外効果は辞退する。
5. WHITE BINDERでデッキからMTPをセットする。

**WHITE BINDER＋MTP、7100LP、手札0、通常召喚権未使用**に到達する。MTPはこのターンまだ発動しておらず、後続選択が残っている。この盤面を最強の終着点とはしていない。

## 再現

固定probeとルートだけの独立replay:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --verify-only
```

保存された探索結果のSHA照合と代表終端の独立replay:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --verify-checkpoints
```

共通カーネルによる黄金櫃の最初からの予算付き探索:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --max-nodes 100 --max-depth 160 --max-ms 30000
```

特定の保存済みprefixから続ける場合:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --prefix gold-dormouse-tb-binder-mtp --max-nodes 100 --max-depth 160 --max-ms 30000
```

25種類の初回除外先へ公平に予算を配る。`--max-nodes` と時間制限は各対象の1回のsliceに適用される:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --all-targets --resume --max-nodes 400 --max-depth 200 --max-ms 30000
```

rootとDormouse/Rabbitの残りを巡回し、新しい訪問へ追加予算を配る:

```powershell
node duel-lab/scripts/exhaustive-gold.mjs --focus --resume --additional-nodes 10000 --max-nodes 1000 --max-depth 200 --max-ms 30000
```

`--warm` はTB→WHITE BINDER/MTPと、Rabbit/Hare→WHITE BINDER帰還のドロー直前を探索する。一時的な独自キャンセル保留は削除し、既存の `cancelBoundary` を優先して共通カーネルv2の監査付きLink UI縮約へ渡す。

`--resume` は同じprefixの `runtime/search-gold/<prefix>.checkpoint.json` を読み込む。`routes/spell-starters.json` にある黄金櫃ルートのIDもprefixとして指定できる。別担当の強い既知線 `spell-75500286-rabbit-hare-accord` はそちらの保存入力列を流用する。

`--max-nodes`、`--max-depth`、`--max-ms` は探索の停止条件であって、全パターンを省略して完了扱いする条件ではない。各停止点と未探索入力はcheckpointへ残す。同じ条件のドロー・深度上限は再訪予算を使わず保管する。外部の対応が必要な失敗・相手選択・未検証の通信要求も同一実行中は繰り返さない。全入口で処理可能な枝がなくなれば、追加予算が残っていても停止する。初回除外の25種類の検査は `routes/spell-starters.json` の `firstBanishCoverage` にある。

WBの任意ドロー直前は2系統とも実行前の入力列を `drawHandoffs` へ保存し、独立replayしてドロー担当へ引き渡した。通常探索の `stopOnDraw` は固定山札でドローした後の境界を保存するため、これらの事前prefixと区別する。

## 残る範囲

黄金櫃を使う前のセットなどを含む全初回選択、全EX変換・素材・発動順・配置・表示形式、任意ドローの全結果、相手誘発への応答、相手ターンの妨害運用は未完了。盤面の見た目が同じでも、効果使用済み状態や特殊召喚制約を無視して枝を統合しない。

このスクリプトはAstra CLIや別モデルを起動しない。探索判断は担当Astraが行い、選択肢の生成と合法性確認には既存の実ルールエンジンを使う。
