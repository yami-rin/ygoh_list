# 1枚初動の探索範囲

全体は**未完了**。固定プリセットの26種類を重複なく対応付け、根からの探索は18種類完了、8種類未完了。確率分岐の全後続探索は未完了。

延べ訪問 173,868、保存された終端手順 30,475、残存frontier 150,189。既存の公開catalog内の未開始ケースは0件。未具体化・未登録の新しいdraw-handoffはこの件数に含まない。これらは重複するprefixや旧UI反復を含み得る作業件数であり、固有の展開数ではない。

集計時刻: 2026/09/08 7:45:15 JST。更新中の資料は停止後に再生成する。

## 条件

先攻・対象1枚のみの手札・自他の空盤面/墓地・相手の初期手札なし。最初のターンのエンド処理まで。
kernelで監査された標準Link素材選択の局所的な無効果の往復だけを縮約。
固定された代表山札順でのroot完了と、全確率結果・全後続順序の網羅は別に判定する。

## 26種類の担当と進捗

| カード | 枚数 | 根からの探索 | 延べ訪問 | frontier | 担当資料 |
| --- | ---: | --- | ---: | ---: | --- |
| M∀LICE＜P＞White Rabbit | 3 | 未完了 | 37,169 | 736 | [exhaustive-rabbit.json](../routes/exhaustive-rabbit.json) |
| M∀LICE＜P＞Cheshire Cat | 3 | 条件内完了 | 94 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE＜P＞March Hare | 1 | 条件内完了 | 129 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE＜P＞Dormouse | 1 | 未完了 | 62,389 | 88,133 | [exhaustive-dormouse.json](../routes/exhaustive-dormouse.json) |
| バックアップ＠イグニスター | 3 | 未完了 | 6,563 | 43 | [exhaustive-cyberse.json](../routes/exhaustive-cyberse.json) |
| ウィザード＠イグニスター | 1 | 条件内完了 | 94 | 0 | [exhaustive-cyberse.json](../routes/exhaustive-cyberse.json) |
| サイバース・コード・マジシャン | 1 | 条件内完了 | 2 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| ドットスケーパー | 1 | 未完了 | 6,635 | 27 | [exhaustive-cyberse.json](../routes/exhaustive-cyberse.json) |
| コード・オブ・ソウル | 1 | 条件内完了 | 279 | 0 | [exhaustive-cyberse.json](../routes/exhaustive-cyberse.json) |
| マルチャミー・プルリア | 3 | 条件内完了 | 69 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 幽鬼うさぎ | 3 | 条件内完了 | 59 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 灰流うらら | 2 | 条件内完了 | 59 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 増殖するG | 1 | 条件内完了 | 69 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| ドロール＆ロックバード | 1 | 条件内完了 | 59 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| ディメンション・アトラクター | 1 | 条件内完了 | 12 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 深淵の獣マグナムート | 1 | 条件内完了 | 2 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 深淵の獣バルドレイク | 1 | 条件内完了 | 2 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE IN UNDERGROUND | 3 | 未完了 | 13,561 | 13,449 | [exhaustive-underground.json](../routes/exhaustive-underground.json) |
| 封印の黄金櫃 | 1 | 未完了 | 20,756 | 249 | [exhaustive-gold.json](../routes/exhaustive-gold.json) |
| テラ・フォーミング | 1 | 未完了 | 13,933 | 15,204 | [exhaustive-underground.json](../routes/exhaustive-underground.json) |
| 闇の誘惑 | 1 | 未完了 | 6,769 | 7,692 | [allure-continuations.json](../routes/allure-continuations.json) |
| 霊王の波動 | 2 | 条件内完了 | 13 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE＜C＞MTP－０７ | 1 | 条件内完了 | 13 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE＜C＞GWC－０６ | 1 | 条件内完了 | 13 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| M∀LICE＜C＞TB－１１ | 1 | 条件内完了 | 13 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |
| 神の密告 | 1 | 条件内完了 | 13 | 0 | [exhaustive-others.json](../routes/exhaustive-others.json) |

部分木が完了していても根からの探索を完了とはしない。初回除外・初回ドローだけの網羅も、以後の展開の完了とは区別する。

## ドロー分岐

闇の誘惑: 元の初回列挙は308種類の2枚組・353選択。両順序と同名DARKの除外個体差を分けた後続は 701/701入口（正順353・逆順345・同名個体の追加3）。初手セット・Endも含む全ジョブ 258/703完了、frontier 7,692、追加ドロー境界 5。

任意ドロー: 既存catalogの39境界・1053条件付き結果の範囲で、1053件着手、0件完了、0件未開始。frontier 24,656、この継続探索が報告した追加ドロー境界 0。別担当が新規発見した未登録handoffが0という意味ではない。

確率は各境界の残り山札を条件とする。別の境界の重みを足して初動率・貫通率・勝率とはしない。追加ドロー境界はfrontierの内数または参照される同一境界を含み、frontier総数へ二重加算していない。

## 残件

- 8種類の根からの探索が未完了。
- 闇の誘惑の条件付き後続探索が未完了。
- Cat/Binder等の既知ドロー結果の後続探索が未完了。
- 新規Rabbit/UNDERGROUND等のdraw-handoffの具体化・catalog登録・後続探索が未完了。既存39境界の着手済み件数には含まれない。
- 以後の順序依存操作を含む全山札順序の網羅が未証明。
- 後続で新たに発生する確率境界の全展開が未証明。

## 再開

以下は duel-lab ディレクトリで実行する。各担当の保存状態を引き継ぐ。環境変数はそのPowerShellプロセスに適用される。

M∀LICE＜P＞White Rabbit

~~~powershell
node scripts/exhaustive-rabbit.mjs --search --search-only --sharded --resume --nodes 1000 --depth 180 --ms 30000
~~~

M∀LICE＜P＞Dormouse

~~~powershell
$env:DORM_PARTITION_COUNT='1'
$env:DORM_PARTITION_INDEX='0'
$env:DORM_LEAF_NODES='1000'
$env:DORM_LEAF_MAX_MS='30000'
node scripts/exhaustive-dormouse.mjs --partition --no-publish
node scripts/exhaustive-dormouse.mjs --aggregate
~~~

バックアップ＠イグニスター

~~~powershell
$env:CYBERSE_STARTER='30118811'
$env:CYBERSE_MAX_NODES='2000'
$env:CYBERSE_MAX_MS='30000'
$env:CYBERSE_MAX_DEPTH='180'
node scripts/exhaustive-cyberse.mjs --resume
~~~

ドットスケーパー

~~~powershell
$env:CYBERSE_STARTER='18789533'
$env:CYBERSE_MAX_NODES='2000'
$env:CYBERSE_MAX_MS='30000'
$env:CYBERSE_MAX_DEPTH='180'
node scripts/exhaustive-cyberse.mjs --resume
~~~

M∀LICE IN UNDERGROUND / テラ・フォーミング

~~~powershell
node scripts/exhaustive-underground.mjs --resume --nodes=2000 --per-job=16 --depth=180 --ms=30000
~~~

封印の黄金櫃

~~~powershell
node scripts/exhaustive-gold.mjs --resume --focus --max-nodes 1000 --max-depth 200 --max-ms 30000
~~~

闇の誘惑

~~~powershell
node scripts/search-allure-continuations.mjs --ms=24000 --nodes=6 --rounds=1
~~~

任意ドローの後続

~~~powershell
node scripts/search-optional-draw-continuations.mjs --max-ms=30000 --nodes=4
~~~

全ドロー境界の再列挙（継続探索中の参照資料を更新するため、担当の停止後に実行）

~~~powershell
node scripts/exhaustive-draws.mjs --handoff=runtime/search-underground/draw-handoff-final.json --handoff=runtime/search-rabbit/draw-frontiers.json --handoff=runtime/search-gold/draw-handoff-gold-wb.json
~~~

集約の再生成と検算

~~~powershell
node scripts/build-search-report.mjs
node scripts/build-search-report.mjs --verify
node --test tests/search-report.test.mjs
~~~

各資料のSHA-256とpresetHashは search-report.json に保存する。元資料とプリセットの不一致、カード担当の重複・欠落は生成エラーにする。
