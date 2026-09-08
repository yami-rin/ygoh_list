# 2枚初動の実展開調査 — shard 2

`enumeratePairs(preset.main)` の index % 8 === 2 を担当。固定40枚の333種類中42組。手札は指定の2枚だけ、残りは38枚、先攻第1ターン・相手干渉なしで検証する。

**未確定ドローの後続は対象外。** 手動線ではCat/Binderの任意ドローを選ばず、全保存線にドローログがないことをassertする。共有探索は最初のDRAWを検出した時点で打ち切り、ドロー後に入力・採点・ルート出力をしない。先攻通常ドローのないfixtureであり、手札5枚全体の初動率や対戦勝率を示すものではない。

## 検証済みの手動線

実coreで9線を作成し、入力前状態hash・入力ラベル・終状態hashを照合する独立replayで全件検証した。42組の初期Main1入力候補も独立replay済み。盤面・手札・セット札・LP・物理カード40枚の保存をassertする。

| 初手 | 終盤面 / 手札 / セット | LP | 入力数 | 分類 |
|---|---|---:|---:|---|
| サイバース・コード・マジシャン、灰流うらら | 盤面: サイバース・ウィキッド、I：Pマスカレーナ / 手札: なし / セット: なし | 8000 | 25 | true-two-card-line |
| サイバース・コード・マジシャン、灰流うらら | 盤面: アコード・トーカー＠イグニスター、トランスコード・トーカー / 手札: なし / セット: なし | 8000 | 37 | true-two-card-line |
| ドットスケーパー、バックアップ＠イグニスター | 盤面: M∀LICE＜Q＞HEARTS OF CRYPTER、M∀LICE＜Q＞WHITE BINDER、リングリボー / 手札: なし / セット: M∀LICE＜C＞GWC－０６ | 6500 | 74 | true-two-card-line |
| M∀LICE＜P＞March Hare、M∀LICE＜P＞Dormouse | 盤面: M∀LICE＜Q＞HEARTS OF CRYPTER、M∀LICE＜Q＞WHITE BINDER / 手札: M∀LICE＜P＞White Rabbit、M∀LICE＜P＞Cheshire Cat / セット: M∀LICE＜C＞GWC－０６ | 6200 | 80 | true-two-card-line |
| バックアップ＠イグニスター、マルチャミー・プルリア | 盤面: アコード・トーカー＠イグニスター、トランスコード・トーカー / 手札: なし / セット: なし | 8000 | 41 | true-two-card-line |
| ウィザード＠イグニスター、ドットスケーパー | 盤面: サイバース・ウィキッド / 手札: ウィザード＠イグニスター / セット: なし | 8000 | 12 | small-one-card-line-partner-retained |
| 深淵の獣マグナムート、ディメンション・アトラクター | 盤面: 深淵の獣マグナムート / 手札: なし / セット: なし | 8000 | 8 | small-two-card-interaction |
| 封印の黄金櫃、M∀LICE＜C＞MTP－０７ | 盤面: アコード・トーカー＠イグニスター、トランスコード・トーカー、M∀LICE＜P＞March Hare / 手札: なし / セット: なし | 7100 | 77 | true-two-card-line |
| ドットスケーパー、深淵の獣バルドレイク | 盤面: S：Pリトルナイト、深淵の獣バルドレイク / 手札: なし / セット: なし | 8000 | 17 | true-two-card-line |

`true-two-card-line` は実際に初手2枚を使用した成功線。Backup＋PuruliaはPurulia固有効果を使わず、検索後の捨て札を満たす手札コスト型。`small-two-card-interaction` はShifterのコストで生じた墓地の闇属性をMagnamhutに使用する小展開。`small-one-card-line-partner-retained` はDotだけを使いWizardを手札に残す線であり、Wizardを展開札として使えた2枚初動ではない。

確認できた制約と修正点:

- Backup＋Dot: Dotの蘇生は最初の捨て札で既に使用する。MagはDormouseを墓地へ送り、DotをWickedのリンク先のRingへ変える召喚でWickedを誘発させる。
- Dormouse＋Hare: 初手Hareを使用し、後半のMTPでBinderをメインモンスターゾーンへ帰還させる。BinderをEXゾーンに残したままのCrypter併置を前提にしない。
- Gold＋MTP: MTPが初手にあるのでRabbitのデッキセット対象はTB。初手MTPを実際にセットして使用する。Hareを置く場所はTranscodeの蘇生先と重ならないよう指定する。
- Wizard＋Dot: Decoderが墓地に存在してもWizardの守備表示蘇生の対象にできず、実coreの発動候補もない。保存線のWicked盤面での確認であり、この2枚の全進行不能を示す証明ではない。
- Magnamhut＋Shifter: Shifterの発動コストでShifter自身は墓地へ送られ、Magnamhutの対象にできる。保存線はMain1まで。Magnamhutのエンドフェイズ検索の処理はその線に含まない。

## 合法入力探索の範囲と現状

共有runnerの最新取込: 2026-09-07T23:56:38.927Z。42組中42組着手、scope内完了9組、未完33組、未着手0組。9183 nodes / 2613 terminal / 3944 unresolved frontier / 244対象外ドロー境界。

完全な合法手探索や全ゲームパターンの完了は主張しない。手動線は成功例であり最適盤面の証明ではない。共有runnerのbestは訪問済みMain1盤面の独自評価値であり勝率ではない。残件はcheckpoint内の入力prefixと候補cursorを保持し、次の巡回で再開する。未着手と探索未完と実際の小展開を区別する。

共有探索の正本: `runtime/multi-pair-search/shard-2/{summary.json,best-routes.json,pair-*.checkpoint.json}`。最初の巡回の旧保存先 `runtime/multi-pairs/shard-2/search-v1/` は履歴用で、追加探索や集計の正本には使わない。手動の入力列と失敗分析は `routes/pair-shard-2.json` と `runtime/multi-pairs/shard-2/` に保存。

## 担当42組の一覧

事前surveyのsupportedは既知テンプレートの適用成功を意味し、2枚相互作用や十分な展開の証明ではない。未対応理由・既知template失敗はJSONに原文を保持する。

| index | 2枚 | 事前survey | 手動線 | 合法入力探索 |
|---:|---|---|---:|---|
| 2 | サイバース・コード・マジシャン ＋ 灰流うらら | unsupported | 2 | incomplete |
| 10 | サイバース・コード・マジシャン ＋ 霊王の波動 | supported | 0 | completeWithinNoDrawScope |
| 18 | サイバース・コード・マジシャン ＋ 封印の黄金櫃 | supported | 0 | incomplete |
| 26 | 闇の誘惑 ＋ 灰流うらら | unsupported | 0 | incomplete |
| 34 | 闇の誘惑 ＋ 霊王の波動 | supported | 0 | completeWithinNoDrawScope |
| 42 | 闇の誘惑 ＋ 封印の黄金櫃 | supported | 0 | incomplete |
| 50 | ウィザード＠イグニスター ＋ ドットスケーパー | supported | 1 | incomplete |
| 58 | ウィザード＠イグニスター ＋ M∀LICE＜C＞TB－１１ | supported | 0 | incomplete |
| 66 | ウィザード＠イグニスター ＋ 神の密告 | supported | 0 | incomplete |
| 74 | 灰流うらら ＋ M∀LICE＜C＞GWC－０６ | supported | 0 | incomplete |
| 82 | 灰流うらら ＋ 幽鬼うさぎ | unsupported | 0 | completeWithinNoDrawScope |
| 90 | 灰流うらら ＋ マルチャミー・プルリア | unsupported | 0 | incomplete |
| 98 | ドットスケーパー ＋ バックアップ＠イグニスター | supported | 1 | incomplete |
| 106 | ドットスケーパー ＋ 深淵の獣バルドレイク | supported | 1 | incomplete |
| 114 | ドットスケーパー ＋ M∀LICE＜C＞MTP－０７ | supported | 0 | incomplete |
| 122 | M∀LICE＜C＞GWC－０６ ＋ M∀LICE＜C＞TB－１１ | supported | 0 | completeWithinNoDrawScope |
| 130 | M∀LICE＜C＞GWC－０６ ＋ 神の密告 | supported | 0 | completeWithinNoDrawScope |
| 138 | M∀LICE＜P＞March Hare ＋ M∀LICE＜P＞Dormouse | supported | 1 | incomplete |
| 146 | M∀LICE＜P＞March Hare ＋ テラ・フォーミング | supported | 0 | incomplete |
| 154 | M∀LICE＜P＞March Hare ＋ M∀LICE＜P＞Cheshire Cat | supported | 0 | incomplete |
| 162 | 増殖するG ＋ M∀LICE＜P＞White Rabbit | supported | 0 | incomplete |
| 170 | 増殖するG ＋ ドロール＆ロックバード | unsupported | 0 | incomplete |
| 178 | バックアップ＠イグニスター ＋ 幽鬼うさぎ | supported | 0 | incomplete |
| 186 | バックアップ＠イグニスター ＋ マルチャミー・プルリア | supported | 1 | incomplete |
| 194 | M∀LICE＜P＞Dormouse ＋ 幽鬼うさぎ | supported | 0 | incomplete |
| 202 | M∀LICE＜P＞Dormouse ＋ マルチャミー・プルリア | supported | 0 | incomplete |
| 210 | 深淵の獣マグナムート ＋ M∀LICE IN UNDERGROUND | supported | 0 | incomplete |
| 218 | 深淵の獣マグナムート ＋ ディメンション・アトラクター | unsupported | 1 | completeWithinNoDrawScope |
| 226 | 霊王の波動 ＋ M∀LICE＜P＞White Rabbit | supported | 0 | incomplete |
| 234 | 霊王の波動 ＋ ドロール＆ロックバード | supported | 0 | incomplete |
| 242 | M∀LICE＜C＞TB－１１ ＋ コード・オブ・ソウル | supported | 0 | incomplete |
| 250 | 幽鬼うさぎ ＋ 幽鬼うさぎ | unsupported | 0 | completeWithinNoDrawScope |
| 258 | 幽鬼うさぎ ＋ マルチャミー・プルリア | unsupported | 0 | incomplete |
| 266 | M∀LICE IN UNDERGROUND ＋ テラ・フォーミング | supported | 0 | incomplete |
| 274 | M∀LICE IN UNDERGROUND ＋ M∀LICE＜P＞Cheshire Cat | supported | 0 | incomplete |
| 282 | M∀LICE＜P＞White Rabbit ＋ ディメンション・アトラクター | supported | 0 | incomplete |
| 290 | 深淵の獣バルドレイク ＋ マルチャミー・プルリア | unsupported | 0 | completeWithinNoDrawScope |
| 298 | テラ・フォーミング ＋ マルチャミー・プルリア | supported | 0 | incomplete |
| 306 | コード・オブ・ソウル ＋ ディメンション・アトラクター | supported | 0 | incomplete |
| 314 | 封印の黄金櫃 ＋ M∀LICE＜C＞MTP－０７ | supported | 1 | incomplete |
| 322 | マルチャミー・プルリア ＋ ディメンション・アトラクター | unsupported | 0 | incomplete |
| 330 | ドロール＆ロックバード ＋ M∀LICE＜P＞Cheshire Cat | supported | 0 | completeWithinNoDrawScope |

## 再現

```powershell
node scripts/research-pair-shard-2.mjs
node scripts/search-multi-pairs.mjs --shard 2 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1
```

共有runnerはsource/preset/pair順序/seed一致時のみ既存checkpointを再開する。`research-pair-shard-2.mjs` は共有探索を開始せず、手動全線を再検証し、その時点のsummaryを取り込む。
