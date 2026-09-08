# 2枚初動の新規探索: shard 6

固定40枚の全333種類の合法2枚組のうち、列挙順 index % 8 === 6 の41組を担当。初手は該当2枚をデッキから抜いて置き、先攻・相手初期手札と盤面なしで実coreを動かす。既知template適用結果とは別に、新しい指向ルートと根からの入力列挙を記録する。

新規指向ルート 9 本を独立再生済み。全41組の初期core選択肢を観測済み。根からの探索: {"selected":41,"searched":41,"completeWithinNoDrawScope":8,"incomplete":33,"unsearched":0,"visited":11310,"terminalPaths":2986,"unresolved":5687,"excludedDraw":341,"exportedRoutes":41,"allGamePatternsComplete":false}。全ゲームの全合法木は未完了。

未確定ドローを解決した応答は境界に保存し、その後の応答・盤面採点・ルート採用は行わない。ドローを除く範囲で閉じた木があっても、ドローを含む全分岐の完了とはしない。相手の妨害や5枚初手は今回の対象外。

## 未解決分岐の監査

全41 checkpointのhash/統計と、除外した未確定ドロー 341 prefixを独立再生検証。ドロー後の応答ゼロを確認。core拒否 0 件、記録された実行失敗 0 件。

未完了理由: {"maxMs":4185,"maxNodes":1502}。

未解決prefixの応答深さ別件数: {"40-49":539,"30-39":641,"20-29":912,"10-19":1481,"0-9":1572,"60-69":133,"50-59":194,"80-89":87,"90-99":23,"70-79":105}。

残枝が少ない組: index 326: 10 件、深さ 3–5 / index 318: 22 件、深さ 2–8 / index 150: 25 件、深さ 3–9 / index 158: 27 件、深さ 4–10 / index 70: 28 件、深さ 2–8 / index 46: 30 件、深さ 2–8 / index 30: 31 件、深さ 4–10 / index 62: 42 件、深さ 2–15。残枝数はその先の木の大きさではなく、追加予算で閉じる保証はない。

## 新規指向ルート

- **サイバース・コード・マジシャン＋増殖するG**: 低攻撃力の非サイバースを通常召喚→アルミラージ→手札MagとWicked→Dot→Mag除外でBackup→Transcode→Accord＋Transcode。非サイバースの通常召喚はMag/Transcodeの特殊召喚制約に抵触しない。 39 応答 / LP 8000。分類: two-card-extension。

- **サイバース・コード・マジシャン＋ドロール＆ロックバード**: 低攻撃力の非サイバースを通常召喚→アルミラージ→手札MagとWicked→Dot→Mag除外でBackup→Transcode→Accord＋Transcode。非サイバースの通常召喚はMag/Transcodeの特殊召喚制約に抵触しない。 37 応答 / LP 8000。分類: two-card-extension。

- **ウィザード＠イグニスター＋バックアップ＠イグニスター**: BackupでCatを検索して捨てる→BackupをDecoder→初手WizardでCatを蘇生→3体でBinder＋Decoder帰還、Catを除外帰還→MTP/Hare→Crypter＋Binder。Magを経由しない2枚展開。 46 応答 / LP 6800。分類: two-card-extension。

- **M∀LICE＜C＞GWC－０６＋バックアップ＠イグニスター**: BackupでMagを検索して初手GWCを捨てる→Decoder＋MagでWicked→Dot→Wickedで元Backup除外、2枚目Backupを検索→Transcode→Accord＋Transcode。GWCは蘇生効果ではなく手札コストとして使用する。 39 応答 / LP 8000。分類: two-card-hand-cost-extension。

- **サイバース・コード・マジシャン＋M∀LICE＜P＞White Rabbit**: RabbitでMTPを確保→Decoder＋初手MagでWicked→Dot/Rabbit帰還/Backup→Dormouseを検索して捨てBinderで除外帰還→Cat→MTP/Hare→Crypter＋Binder＋I:P＋GWC。S:Pを使わず両方の初手を展開へ投入する。 83 応答 / LP 6200。分類: two-card-extension。

- **ウィザード＠イグニスター＋深淵の獣バルドレイク**: Wizardを通常召喚→Decoder→墓地WizardをBaldrakeの除外コストとして特殊召喚→S:P。両方は使えるが、M∀LICE本展開には届いていない小展開の具体例。 14 応答 / LP 8000。分類: two-card-small-development。

- **M∀LICE＜P＞Dormouse＋M∀LICE＜P＞Cheshire Cat**: Catで初手Dormouseを除外して帰還、ドローは辞退→DormouseでRabbit帰還/MTP→Decoder→Binder＋Decoder/Cat帰還→GWCをセット→MTP/Hare→Crypter＋Binder＋GWC。 62 応答 / LP 6200。分類: two-card-extension。

- **M∀LICE＜P＞White Rabbit＋コード・オブ・ソウル**: Rabbit→TB/Dormouse→Decoder/S:PでDormouse帰還→Cat→Binder。初手Code of Soulを追加特殊召喚してMTP/Hareと合わせ、Binderを残してCrypterを成立させる。 63 応答 / LP 6200。分類: two-card-extension。

- **深淵の獣バルドレイク＋M∀LICE＜P＞Cheshire Cat**: Cat通常召喚→Decoder→Baldrakeで墓地Catを除外しCat帰還→3体でBinder＋Decoder帰還→MTP/Hare→Binder＋S:P。Baldrakeの特殊召喚とCatの除外帰還を展開札として使う。 44 応答 / LP 6800。分類: two-card-extension。

## 担当41組と現時点の証拠

「使用」は初手が手札を離れた枚数の下限。セット・コストも含み、2枚専用コンボの強さを意味しない。根探索の代表は訪問済み盤面の固定ヒューリスティック最高点で、最適解や勝率ではない。小展開は通常召喚・セット・L1・S:P単体等と区別する。

| index | 2枚組 | 旧template | 新指向線 | 根訪問数 / 未解決 / ドロー境界 | 根代表の分類 / 使用 |
|---:|---|---|---:|---|---|
| 6 | サイバース・コード・マジシャン + 増殖するG | unsupported | 1 | 235 / 253 / 0 | link-development / 2枚 |
| 14 | サイバース・コード・マジシャン + M∀LICE＜P＞White Rabbit | supported | 1 | 254 / 233 / 0 | link-development / 2枚 |
| 22 | サイバース・コード・マジシャン + ドロール＆ロックバード | unsupported | 1 | 229 / 251 / 0 | link-development / 2枚 |
| 30 | 闇の誘惑 + 増殖するG | unsupported | 0 | 340 / 31 / 125 | no-board-development / 0枚 |
| 38 | 闇の誘惑 + M∀LICE＜P＞White Rabbit | supported | 0 | 328 / 165 / 97 | link-development / 2枚 |
| 46 | 闇の誘惑 + ドロール＆ロックバード | unsupported | 0 | 344 / 30 / 115 | normal-summon-only / 1枚 |
| 54 | ウィザード＠イグニスター + バックアップ＠イグニスター | supported | 1 | 275 / 221 / 0 | link-development / 2枚 |
| 62 | ウィザード＠イグニスター + 深淵の獣バルドレイク | supported | 1 | 317 / 42 / 0 | link-development / 2枚 |
| 70 | ウィザード＠イグニスター + M∀LICE＜C＞MTP－０７ | supported | 0 | 341 / 28 / 0 | link-development / 2枚 |
| 78 | 灰流うらら + M∀LICE＜P＞Dormouse | supported | 0 | 313 / 157 / 0 | link-development / 1枚 |
| 86 | 灰流うらら + テラ・フォーミング | supported | 0 | 294 / 309 / 0 | link-development / 2枚 |
| 94 | 灰流うらら + M∀LICE＜P＞Cheshire Cat | supported | 0 | 151 / 0 / 0 | link-development / 1枚 |
| 102 | ドットスケーパー + M∀LICE＜C＞TB－１１ | supported | 0 | 322 / 91 / 0 | link-development / 2枚 |
| 110 | ドットスケーパー + 神の密告 | supported | 0 | 311 / 91 / 0 | link-development / 2枚 |
| 118 | M∀LICE＜C＞GWC－０６ + バックアップ＠イグニスター | supported | 1 | 320 / 179 / 0 | link-development / 2枚 |
| 126 | M∀LICE＜C＞GWC－０６ + 深淵の獣バルドレイク | supported | 0 | 13 / 0 / 0 | set-or-spell-only / 1枚 |
| 134 | M∀LICE＜C＞GWC－０６ + M∀LICE＜C＞MTP－０７ | supported | 0 | 114 / 0 / 0 | set-or-spell-only / 2枚 |
| 142 | M∀LICE＜P＞March Hare + 幽鬼うさぎ | supported | 0 | 186 / 0 / 0 | link-development / 1枚 |
| 150 | M∀LICE＜P＞March Hare + マルチャミー・プルリア | supported | 0 | 338 / 25 / 0 | link-development / 1枚 |
| 158 | 増殖するG + 霊王の波動 | supported | 0 | 347 / 27 / 0 | set-or-spell-only / 1枚 |
| 166 | 増殖するG + 封印の黄金櫃 | supported | 0 | 329 / 109 / 0 | link-development / 2枚 |
| 174 | バックアップ＠イグニスター + M∀LICE＜P＞Dormouse | supported | 0 | 295 / 181 / 0 | link-development / 2枚 |
| 182 | バックアップ＠イグニスター + テラ・フォーミング | supported | 0 | 291 / 264 / 0 | link-development / 2枚 |
| 190 | バックアップ＠イグニスター + M∀LICE＜P＞Cheshire Cat | supported | 0 | 295 / 178 / 0 | link-development / 2枚 |
| 198 | M∀LICE＜P＞Dormouse + テラ・フォーミング | supported | 0 | 294 / 238 / 0 | link-development / 2枚 |
| 206 | M∀LICE＜P＞Dormouse + M∀LICE＜P＞Cheshire Cat | supported | 1 | 309 / 203 / 3 | link-development / 2枚 |
| 214 | 深淵の獣マグナムート + コード・オブ・ソウル | supported | 0 | 279 / 0 / 0 | link-development / 1枚 |
| 222 | 霊王の波動 + 霊王の波動 | supported | 0 | 114 / 0 / 0 | set-or-spell-only / 2枚 |
| 230 | 霊王の波動 + 封印の黄金櫃 | supported | 0 | 340 / 100 / 0 | link-development / 2枚 |
| 238 | M∀LICE＜C＞TB－１１ + M∀LICE IN UNDERGROUND | supported | 0 | 335 / 88 / 0 | link-development / 2枚 |
| 246 | M∀LICE＜C＞TB－１１ + ディメンション・アトラクター | supported | 0 | 91 / 0 / 0 | set-or-spell-only / 1枚 |
| 254 | 幽鬼うさぎ + テラ・フォーミング | supported | 0 | 298 / 308 / 0 | link-development / 2枚 |
| 262 | 幽鬼うさぎ + M∀LICE＜P＞Cheshire Cat | supported | 0 | 151 / 0 / 0 | link-development / 1枚 |
| 270 | M∀LICE IN UNDERGROUND + マルチャミー・プルリア | supported | 0 | 290 / 260 / 0 | link-development / 2枚 |
| 278 | M∀LICE＜P＞White Rabbit + コード・オブ・ソウル | supported | 1 | 329 / 208 / 1 | link-development / 2枚 |
| 286 | 深淵の獣バルドレイク + テラ・フォーミング | supported | 0 | 298 / 899 / 0 | effect-only / 1枚 |
| 294 | 深淵の獣バルドレイク + M∀LICE＜P＞Cheshire Cat | supported | 1 | 310 / 94 / 0 | link-development / 2枚 |
| 302 | テラ・フォーミング + M∀LICE＜P＞Cheshire Cat | supported | 0 | 288 / 291 / 0 | link-development / 2枚 |
| 310 | 封印の黄金櫃 + 神の密告 | supported | 0 | 332 / 101 / 0 | link-development / 2枚 |
| 318 | 神の密告 + ドロール＆ロックバード | supported | 0 | 346 / 22 / 0 | set-or-spell-only / 1枚 |
| 326 | ディメンション・アトラクター + ドロール＆ロックバード | unsupported | 0 | 324 / 10 / 0 | no-board-development / 0枚 |

## 未対応・未完了の理由

- index 30: 根から 340 ノードを新規探索し、未解決 31 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。未確定ドロー境界 125 件は範囲外として保持。 根探索は incomplete、未解決 31 件。
- index 38: 根から 328 ノードを新規探索し、未解決 165 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。未確定ドロー境界 97 件は範囲外として保持。 根探索は incomplete、未解決 165 件。
- index 46: 根から 344 ノードを新規探索し、未解決 30 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。未確定ドロー境界 115 件は範囲外として保持。 根探索は incomplete、未解決 30 件。
- index 70: 根から 341 ノードを新規探索し、未解決 28 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 28 件。
- index 78: 根から 313 ノードを新規探索し、未解決 157 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 157 件。
- index 86: 根から 294 ノードを新規探索し、未解決 309 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 309 件。
- index 94: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は link-development。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 102: 根から 322 ノードを新規探索し、未解決 91 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 91 件。
- index 110: 根から 311 ノードを新規探索し、未解決 91 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 91 件。
- index 126: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は set-or-spell-only。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 134: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は set-or-spell-only。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 142: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は link-development。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 150: 根から 338 ノードを新規探索し、未解決 25 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 25 件。
- index 158: 根から 347 ノードを新規探索し、未解決 27 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 27 件。
- index 166: 根から 329 ノードを新規探索し、未解決 109 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 109 件。
- index 174: 根から 295 ノードを新規探索し、未解決 181 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 181 件。
- index 182: 根から 291 ノードを新規探索し、未解決 264 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 264 件。
- index 190: 根から 295 ノードを新規探索し、未解決 178 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 178 件。
- index 198: 根から 294 ノードを新規探索し、未解決 238 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 238 件。
- index 214: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は link-development。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 222: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は set-or-spell-only。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 230: 根から 340 ノードを新規探索し、未解決 100 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 100 件。
- index 238: 根から 335 ノードを新規探索し、未解決 88 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 88 件。
- index 246: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は set-or-spell-only。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 254: 根から 298 ノードを新規探索し、未解決 308 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 308 件。
- index 262: この先攻・空盤面・未確定ドロー後除外の範囲は閉じた。代表は link-development。相手がいる対戦やドローを含む全分岐の可否は証明していない。 根探索は completeWithinNoDrawScope、未解決 0 件。
- index 270: 根から 290 ノードを新規探索し、未解決 260 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 260 件。
- index 286: 根から 298 ノードを新規探索し、未解決 899 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 899 件。
- index 302: 根から 288 ノードを新規探索し、未解決 291 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 291 件。
- index 310: 根から 332 ノードを新規探索し、未解決 101 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 101 件。
- index 318: 根から 346 ノードを新規探索し、未解決 22 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 22 件。
- index 326: 根から 324 ノードを新規探索し、未解決 10 件を保存。予算上限のため木は未完了であり、強い展開が無いことの証明ではない。 根探索は incomplete、未解決 10 件。

## 再現

```powershell
node scripts/research-pair-shard-6.mjs --audit-checkpoints
node scripts/search-multi-pairs.mjs --shard 6 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1
node scripts/research-pair-shard-6.mjs
```

根探索の詳細入力・残りfrontier・出典hashは runtime/multi-pair-search/shard-6/ に保持。手動の指向ルートと初期probeは runtime/multi-pairs/shard-6/。routes/pair-shard-6.json は代表と要約。未知ドローに依存する展開は確定ルートへ収録しない。
