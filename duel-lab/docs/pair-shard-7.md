# 2枚初動の新規探索 shard 7

固定40枚から作る333種類の合法な2枚組を、`enumeratePairs(preset.main)` の順番で分割する。この担当は `index % 8 === 7` の41組。初期手札2枚を山札から正確に差し引き、先攻・相手空盤面・追加手札なしで実coreを動かす。

既知templateを当てはめる調査とは別に、各2枚組の最初の状態から新しい合法応答木を探索する。全体の未確定ドロー、相手妨害、5枚初手、勝率・最適性は対象外。

## 新しく実証した線

### UNDERGROUND＋March Hare

1. UNDERGROUNDでRabbitを除外して帰還し、MTPをセット。
2. MTPでRabbitを除外し、Dormouseを検索して通常召喚。DormouseでCatを除外して帰還。
3. Dormouse＋CatでContract。場のUNDERGROUNDをコストにCode Magicianを検索。
4. Contract＋手札Code MagicianでWicked。Dotを墓地へ送り帰還し、WickedでDormouseを除外してBackupを検索。Dormouseも帰還。
5. Backupを特殊召喚し、Wizardを検索して同じWizardを捨てる。初手のHareは手札に残す。
6. Hareで墓地MTPを除外し、自身を特殊召喚。
7. Dot＋BackupでI:P。Wicked＋HareでWHITE BINDERを作るため、Dormouseを場に残せる。
8. Binderで墓地Hareを除外。Hareで除外中のRabbitを手札へ回収し、BinderでGWCをセット。

**I:P＋WHITE BINDER＋Dormouse、GWC伏せ、手札Rabbit、6800LP**で停止する。84入力を独立replay済み。追加ドローは一度も行わない。

Hareを初手から持つため、1枚UG線で行う「BackupでHareを検索して捨てる」手順を変更する。Backupは闇属性を検索するため、炎属性のCode of Soulは検索できない。実coreの候補に従ってWizardを使用した。

このルートではUGとHareの両方が展開に参加する。全ての1枚UG線より強いことや、相手ターンの各妨害手順を証明したものではない。

### うらら／幽鬼うさぎ＋Code of Soul

うららまたは幽鬼うさぎを通常召喚し、Almirajへ変換。リンクが存在する状態で手札Soulを特殊召喚し、Almiraj＋SoulでS:Pを作る。各14入力、8000LP、手札0、追加ドローなしを独立replayした。

両方が必要な**小さい2枚展開**として扱う。初手の手札誘発を消費し、M∀LICE本線には接続していない。Almiraj＋SoulからI:Pを出すことはできない。I:Pの素材条件はリンク以外のモンスター2体であり、その時点のcore候補にもI:Pがないことをassertした。

### UNDERGROUND2枚

通常のContract線で、儀式検索のコストを2枚目の**手札**UNDERGROUNDに変更する。最初のフィールドUNDERGROUNDを残したまま、I:P＋WHITE BINDER＋MTP伏せ＋手札Rabbit、6800LPへ到達した。64入力を独立replay済み。

これは「1枚初動に追加の魔法コストを使い、場の魔法を温存する線」と分類する。I:P＋Binderの成立に必ず2枚必要だという意味ではない。同名2枚を連続発動するルートでもない。

## 初期状態の検査

41組の初期選択肢を実coreで確認した。13組は召喚・特殊召喚・効果発動の候補がなく、セット可能な罠を全てセットしても展開候補が生じなかった。この13件は個別の入力列と最終状態を独立replayしている。将来ターンの罠の強さを否定するものではない。

各組の候補、検索の残り、未対応理由は `routes/pair-shard-7.json` の `pairs` に保存する。単なる召喚・セット、小さいリンク展開、手札コストへの使用、両方を使う展開を区別する。手札使用枚数は各応答後の最小残存数から下限を測り、同名個体の同一性や2枚専用ルートの優位性までは断定しない。

## ドローと探索上限

共通runnerは未知の先攻ドローを検出した時点で、その後の応答を探索しない。ドローを解決した直後の盤面も採点・ルートexportの対象にしない。`excludedDraw` に直前のprefixを残し、通常の未展開frontierと別に数える。

`completeWithinNoDrawScope` は、この無ドロー範囲内の未展開prefixがなくなった場合だけ成立する。`allGamePatternsComplete` は常にfalseであり、ドロー後や対妨害の全パターン完了を意味しない。

```powershell
node scripts/research-pair-shard-7.mjs --manual-only
node scripts/research-pair-shard-7.mjs --nodes=200 --ms=5000 --depth=128 --passes=2
node scripts/research-pair-shard-7.mjs --publish-only
```

同じsourceと出力先で再実行するとcheckpointから継続する。`--nodes` と `--ms` は各pairの1slice上限、`--passes` は全41組を回す回数。source・ルール資産が変わった場合は、共通runnerが古いcheckpointとの混在を拒否する。

検索の全履歴・frontier・除外したドロー境界は共通runner既定の `runtime/multi-pair-search/shard-7/`、独自の手動ルートと初期probeは `runtime/multi-pairs/shard-7/` に保存する。

`routes/pair-shard-7.json` の `routes` は独自4本だけを登録する。自動探索40本は `searchRoutes` のmetadata/referenceで参照し、全担当共通の `routes/multi-search-best.json` から一度だけ登録する。`--publish-only` は検索checkpointを進めず、保存済み結果からこの登録形式を再生成し、手動線と手札使用根拠を実coreで再検証する。既存の他担当ルートや対戦GUIは変更・停止しない。

<!-- shard-7-measured-results -->

## 実測結果と担当一覧（2026-09-08）

41/41組を新しいpair rootから探索。累積11,464訪問、terminal 3,243件。無ドロー範囲内で11組完了、30組は未完了、未着手0。未展開frontier 3,911件、未知ドローの除外境界147件を保存した。

初回は各pair最大200node・5秒を2巡。その後、共通の保存先への移行を最大1nodeの再開で確認した。共有ルート40本と独自ルート4本の計44本で全before/final hashを照合し、手札の最小残存数を測定。独自負例13本も独立replayした。engine/tool failureは0。

summaryとbest-routesのgeneration・sourceHash一致、41組のindexと手札の一致、全rootPrefixが空、未知ドロー後のfrontier/採点/exportがないことをassertした。証拠は `runtime/multi-pairs/shard-7/verification.json`。

| index | 2枚組 | 観測・分類 | 訪問 | 無ドロー探索 |
| ---: | --- | --- | ---: | --- |
| 7 | サイバース・コード・マジシャン ＋ バックアップ＠イグニスター | 両方使用・役割比較未完 | 320 | 未完了 |
| 15 | サイバース・コード・マジシャン ＋ 深淵の獣バルドレイク | 展開なし（初期・セット後probe） | 2 | 範囲内完了 |
| 23 | サイバース・コード・マジシャン ＋ M∀LICE＜C＞MTP－０７ | 展開なし（初期・セット後probe） | 13 | 範囲内完了 |
| 31 | 闇の誘惑 ＋ バックアップ＠イグニスター | 両方使用・役割比較未完 | 349 | 未完了 |
| 39 | 闇の誘惑 ＋ 深淵の獣バルドレイク | 小展開／片側使用を観測 | 24 | 範囲内完了 |
| 47 | 闇の誘惑 ＋ M∀LICE＜C＞MTP－０７ | 小展開／片側使用を観測 | 190 | 範囲内完了 |
| 55 | ウィザード＠イグニスター ＋ M∀LICE＜P＞Dormouse | 両方使用・役割比較未完 | 351 | 未完了 |
| 63 | ウィザード＠イグニスター ＋ テラ・フォーミング | 両方使用・役割比較未完 | 311 | 未完了 |
| 71 | ウィザード＠イグニスター ＋ M∀LICE＜P＞Cheshire Cat | 両方使用・役割比較未完 | 360 | 未完了 |
| 79 | 灰流うらら ＋ 深淵の獣マグナムート | 小展開／片側使用を観測 | 59 | 範囲内完了 |
| 87 | 灰流うらら ＋ コード・オブ・ソウル | 小さい2枚展開 | 401 | 未完了 |
| 95 | ドットスケーパー ＋ M∀LICE＜C＞GWC－０６ | 両方使用・役割比較未完 | 401 | 未完了 |
| 103 | ドットスケーパー ＋ 幽鬼うさぎ | 小展開／片側使用を観測 | 401 | 未完了 |
| 111 | ドットスケーパー ＋ マルチャミー・プルリア | 展開なし（初期・セット後probe） | 383 | 未完了 |
| 119 | M∀LICE＜C＞GWC－０６ ＋ M∀LICE＜P＞Dormouse | 両方使用・役割比較未完 | 392 | 未完了 |
| 127 | M∀LICE＜C＞GWC－０６ ＋ テラ・フォーミング | 両方使用・役割比較未完 | 307 | 未完了 |
| 135 | M∀LICE＜C＞GWC－０６ ＋ M∀LICE＜P＞Cheshire Cat | 両方使用・役割比較未完 | 401 | 未完了 |
| 143 | M∀LICE＜P＞March Hare ＋ M∀LICE IN UNDERGROUND | 2枚で追加展開を実証 | 304 | 未完了 |
| 151 | M∀LICE＜P＞March Hare ＋ ディメンション・アトラクター | 展開なし（初期・セット後probe） | 401 | 未完了 |
| 159 | 増殖するG ＋ M∀LICE＜C＞TB－１１ | 展開なし（初期・セット後probe） | 401 | 未完了 |
| 167 | 増殖するG ＋ 神の密告 | 展開なし（初期・セット後probe） | 401 | 未完了 |
| 175 | バックアップ＠イグニスター ＋ 深淵の獣マグナムート | 両方使用・役割比較未完 | 287 | 未完了 |
| 183 | バックアップ＠イグニスター ＋ コード・オブ・ソウル | 両方使用・役割比較未完 | 273 | 未完了 |
| 191 | M∀LICE＜P＞Dormouse ＋ 深淵の獣マグナムート | 両方使用・役割比較未完 | 298 | 未完了 |
| 199 | M∀LICE＜P＞Dormouse ＋ コード・オブ・ソウル | 両方使用・役割比較未完 | 304 | 未完了 |
| 207 | 深淵の獣マグナムート ＋ 霊王の波動 | 展開なし（初期・セット後probe） | 13 | 範囲内完了 |
| 215 | 深淵の獣マグナムート ＋ 封印の黄金櫃 | 小展開／片側使用を観測 | 310 | 未完了 |
| 223 | 霊王の波動 ＋ M∀LICE＜C＞TB－１１ | 展開なし（初期・セット後probe） | 114 | 範囲内完了 |
| 231 | 霊王の波動 ＋ 神の密告 | 展開なし（初期・セット後probe） | 114 | 範囲内完了 |
| 239 | M∀LICE＜C＞TB－１１ ＋ M∀LICE＜P＞White Rabbit | 両方使用・役割比較未完 | 326 | 未完了 |
| 247 | M∀LICE＜C＞TB－１１ ＋ ドロール＆ロックバード | 小展開／片側使用を観測 | 396 | 未完了 |
| 255 | 幽鬼うさぎ ＋ コード・オブ・ソウル | 小さい2枚展開 | 385 | 未完了 |
| 263 | M∀LICE IN UNDERGROUND ＋ M∀LICE IN UNDERGROUND | 1枚線＋追加コスト | 284 | 未完了 |
| 271 | M∀LICE IN UNDERGROUND ＋ ディメンション・アトラクター | 展開なし（初期・セット後probe） | 346 | 未完了 |
| 279 | M∀LICE＜P＞White Rabbit ＋ 封印の黄金櫃 | 両方使用・役割比較未完 | 352 | 未完了 |
| 287 | 深淵の獣バルドレイク ＋ コード・オブ・ソウル | 小展開／片側使用を観測 | 279 | 範囲内完了 |
| 295 | テラ・フォーミング ＋ コード・オブ・ソウル | 両方使用・役割比較未完 | 265 | 未完了 |
| 303 | コード・オブ・ソウル ＋ 封印の黄金櫃 | 両方使用・役割比較未完 | 369 | 未完了 |
| 311 | 封印の黄金櫃 ＋ マルチャミー・プルリア | 展開なし（初期・セット後probe） | 372 | 未完了 |
| 319 | 神の密告 ＋ M∀LICE＜C＞MTP－０７ | 展開なし（初期・セット後probe） | 114 | 範囲内完了 |
| 327 | ディメンション・アトラクター ＋ M∀LICE＜C＞MTP－０７ | 展開なし（初期・セット後probe） | 91 | 範囲内完了 |

「両方使用」は手札コストや単独の効果発動も含む。専用2枚コンボの強さを認定する分類ではない。node訪問数も、戦略的に異なるコンボ数や全体の探索率を表さない。
