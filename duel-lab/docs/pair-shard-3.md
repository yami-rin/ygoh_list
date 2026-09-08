# 2枚初動 shard 3 実探索

固定40枚の合法333組中、index % 8 = 3 の42組を、テンプレート適用ではなく各2枚の初期状態から実coreで調査した。全42組が探索済み。無ドロー範囲で残枝なし 15組、残枝あり 27組。

累計 14563 node、18954候補生成、4122ターン終了履歴。未探索 4467 prefix（maxMs: 3599、maxNodes: 868）。未確定ドロー 289 prefixは引継ぎ境界として保存し、ドロー結果を評価・再生していない。adapter例外履歴 0件、core拒否 0件。

入力手札は固定デッキから実際に2枚取り除いたもの。先攻、相手初期手札なし・空盤面。探索中のMain 1盤面を手動のopeningScoreで比較する。点数は勝率・貫通率・最適性の証明ではない。停止点の並べ替えと検証済みのL素材UI往復縮約を使うが、別のゲーム状態を統合していない。

## 新たに実証した2枚展開

| 初期手札 | 到達盤面 | LP | 応答 |
| --- | --- | ---: | ---: |
| M∀LICE IN UNDERGROUND + コード・オブ・ソウル | アコード・トーカー＠イグニスター + M∀LICE＜Q＞WHITE BINDER + I：Pマスカレーナ + セット M∀LICE＜C＞MTP－０７ | 6800 | 83 |
| 深淵の獣バルドレイク + ディメンション・アトラクター | 深淵の獣バルドレイク | 8000 | 5 |
| M∀LICE＜P＞March Hare + コード・オブ・ソウル | S：Pリトルナイト、手札 M∀LICE＜P＞March Hare | 7700 | 16 |
| M∀LICE＜C＞MTP－０７ + M∀LICE＜P＞Cheshire Cat | アコード・トーカー＠イグニスター + M∀LICE＜Q＞WHITE BINDER + セット M∀LICE＜C＞GWC－０６ | 6200 | 65 |

- pair3-underground-soul-accord-binder-ip: UGをDormouse→Rabbit/TBで開始して通常召喚を温存。Contract/Wicked系展開からSoulと回収Rabbitを加え、Accord＋WHITE BINDER＋I:P＋未使用MTP。 UGはMALICEの特殊召喚とContractの魔法コストを担う。Soulは手札からの追加特殊召喚とAccordのL素材になる。MTPから下級を通常召喚する既存線とは初回罠と召喚権の使い方が異なる。

- pair3-shifter-baldrake-special: Shifterを手札から墓地へ送って効果を適用し、その墓地のShifterをBaldrakeで除外して特殊召喚。 Shifterは自身の墓地コストによってDARKの対象を用意する。BaldrakeはそのShifterを除外し、2枚とも初期手札から離れる。

- pair3-hare-soul-sp-recover-hare: HareをDecoderへ変換してSoulを手札から特殊召喚。2体でS:Pを出し、墓地のHareを除外して自己回収。 Hareの通常召喚からLinkを用意する。Soulは追加のL素材になり、Hare単独のL1停止をS:Pへ伸ばす。

- pair3-cat-mtp-accord-binder-gwc: Cat＋MTPでDormouseを手札に加えて除外し、任意ドローを辞退。Dormouse/Rabbit/TBとDecoderを経てAccord＋WHITE BINDER＋GWCへ到達。 Catは通常召喚と手札Dormouseの除外を担う。MTPはCatの帰還を起動しながらDormouseをサーチする。CatとWHITE BINDERの任意ドローを両方辞退する。

各線は初期2枚の役割を記録し、実coreで生成した全入力の事前状態hash、選択ラベル、最終盤面hashを別ゲームで再生して照合した。Baldrakeの線は単体特殊召喚の成立例であり、強い最終盤面との評価ではない。

## 全42組と残件

| index | 初期手札 | 旧template | 今回の到達種別 / 新規線 | node | 未探索 | 深度 | ドロー除外 | 状態 |
| ---: | --- | --- | --- | ---: | ---: | --- | ---: | --- |
| 3 | サイバース・コード・マジシャン + ドットスケーパー | dotscaper-sp | link-development | 376 | 161 | 2–29 | 0 | incomplete |
| 11 | サイバース・コード・マジシャン + M∀LICE＜C＞TB－１１ | spell-57111661-no-starter | set-or-spell-only | 13 | 0 | — | 0 | completeWithinNoDrawScope |
| 19 | サイバース・コード・マジシャン + 神の密告 | spell-78114463-no-starter | set-or-spell-only | 13 | 0 | — | 0 | completeWithinNoDrawScope |
| 27 | 闇の誘惑 + ドットスケーパー | dotscaper-sp | link-development | 479 | 99 | 2–20 | 138 | incomplete |
| 35 | 闇の誘惑 + M∀LICE＜C＞TB－１１ | spell-57111661-no-starter | set-or-spell-only | 190 | 0 | — | 70 | completeWithinNoDrawScope |
| 43 | 闇の誘惑 + 神の密告 | spell-78114463-no-starter | set-or-spell-only | 190 | 0 | — | 70 | completeWithinNoDrawScope |
| 51 | ウィザード＠イグニスター + M∀LICE＜C＞GWC－０６ | spell-20726052-no-starter | link-development | 562 | 24 | 2–8 | 0 | incomplete |
| 59 | ウィザード＠イグニスター + 幽鬼うさぎ | wizard-ring | link-development | 151 | 0 | — | 0 | completeWithinNoDrawScope |
| 67 | ウィザード＠イグニスター + マルチャミー・プルリア | wizard-ring | link-development | 438 | 0 | — | 0 | completeWithinNoDrawScope |
| 75 | 灰流うらら + M∀LICE＜P＞March Hare | hare-alone-24842059 | link-development | 186 | 0 | — | 0 | completeWithinNoDrawScope |
| 83 | 灰流うらら + M∀LICE IN UNDERGROUND | spell-68337209-contract | link-development | 364 | 292 | 1–57 | 0 | incomplete |
| 91 | 灰流うらら + ディメンション・アトラクター | 未対応 | no-board-development | 381 | 0 | — | 0 | completeWithinNoDrawScope |
| 99 | ドットスケーパー + M∀LICE＜P＞Dormouse | dorm-hare-first-accord | link-development | 399 | 132 | 2–29 | 0 | incomplete |
| 107 | ドットスケーパー + テラ・フォーミング | spell-73628505-rabbit-hare-accord | link-development | 361 | 223 | 1–40 | 0 | incomplete |
| 115 | ドットスケーパー + M∀LICE＜P＞Cheshire Cat | cat-dot-sp-only | link-development | 442 | 58 | 2–18 | 0 | incomplete |
| 123 | M∀LICE＜C＞GWC－０６ + 幽鬼うさぎ | spell-20726052-no-starter | set-or-spell-only | 544 | 21 | 2–8 | 0 | incomplete |
| 131 | M∀LICE＜C＞GWC－０６ + マルチャミー・プルリア | spell-20726052-no-starter | set-or-spell-only | 539 | 20 | 4–9 | 0 | incomplete |
| 139 | M∀LICE＜P＞March Hare + 深淵の獣マグナムート | hare-alone-24842059 | link-development | 467 | 60 | 2–19 | 0 | incomplete |
| 147 | M∀LICE＜P＞March Hare + コード・オブ・ソウル | hare-alone-24842059 | link-development / pair3-hare-soul-sp-recover-hare | 501 | 52 | 2–18 | 0 | incomplete |
| 155 | 増殖するG + バックアップ＠イグニスター | backup-discard-accord | link-development | 410 | 141 | 2–24 | 0 | incomplete |
| 163 | 増殖するG + 深淵の獣バルドレイク | 未対応 | no-board-development | 69 | 0 | — | 0 | completeWithinNoDrawScope |
| 171 | 増殖するG + M∀LICE＜C＞MTP－０７ | spell-94722358-no-starter | set-or-spell-only | 517 | 19 | 4–9 | 0 | incomplete |
| 179 | バックアップ＠イグニスター + M∀LICE IN UNDERGROUND | spell-68337209-contract | link-development | 373 | 280 | 1–57 | 0 | incomplete |
| 187 | バックアップ＠イグニスター + ディメンション・アトラクター | backup-discard-accord | link-development | 443 | 114 | 2–21 | 0 | incomplete |
| 195 | M∀LICE＜P＞Dormouse + M∀LICE IN UNDERGROUND | dorm-no-draw-firewall-accord | link-development | 424 | 208 | 1–46 | 0 | incomplete |
| 203 | M∀LICE＜P＞Dormouse + ディメンション・アトラクター | dorm-no-draw-firewall-accord | link-development | 446 | 92 | 2–19 | 0 | incomplete |
| 211 | 深淵の獣マグナムート + M∀LICE＜P＞White Rabbit | rabbit-no-draw-accord | link-development | 359 | 508 | 2–59 | 3 | incomplete |
| 219 | 深淵の獣マグナムート + ドロール＆ロックバード | 未対応 | normal-summon-only | 59 | 0 | — | 0 | completeWithinNoDrawScope |
| 227 | 霊王の波動 + 深淵の獣バルドレイク | spell-40366667-no-starter | set-or-spell-only | 13 | 0 | — | 0 | completeWithinNoDrawScope |
| 235 | 霊王の波動 + M∀LICE＜C＞MTP－０７ | spell-40366667-no-starter | set-or-spell-only | 114 | 0 | — | 0 | completeWithinNoDrawScope |
| 243 | M∀LICE＜C＞TB－１１ + 封印の黄金櫃 | spell-75500286-binder | link-development | 544 | 86 | 1–12 | 0 | incomplete |
| 251 | 幽鬼うさぎ + M∀LICE IN UNDERGROUND | spell-68337209-contract | link-development | 377 | 289 | 1–57 | 0 | incomplete |
| 259 | 幽鬼うさぎ + ディメンション・アトラクター | 未対応 | no-board-development | 381 | 0 | — | 0 | completeWithinNoDrawScope |
| 267 | M∀LICE IN UNDERGROUND + コード・オブ・ソウル | spell-68337209-contract | link-development / pair3-underground-soul-accord-binder-ip | 376 | 273 | 1–57 | 0 | incomplete |
| 275 | M∀LICE＜P＞White Rabbit + M∀LICE＜P＞White Rabbit | rabbit-no-draw-accord | link-development | 403 | 372 | 2–49 | 2 | incomplete |
| 283 | M∀LICE＜P＞White Rabbit + ドロール＆ロックバード | rabbit-no-draw-accord | link-development | 423 | 366 | 2–49 | 2 | incomplete |
| 291 | 深淵の獣バルドレイク + ディメンション・アトラクター | 未対応 | no-board-development / pair3-shifter-baldrake-special | 93 | 0 | — | 0 | completeWithinNoDrawScope |
| 299 | テラ・フォーミング + ディメンション・アトラクター | spell-73628505-contract | link-development | 426 | 172 | 2–30 | 0 | incomplete |
| 307 | コード・オブ・ソウル + ドロール＆ロックバード | code-of-soul-ring | link-development | 463 | 55 | 2–17 | 0 | incomplete |
| 315 | 封印の黄金櫃 + M∀LICE＜P＞Cheshire Cat | spell-75500286-rabbit-hare-accord | link-development | 486 | 203 | 1–45 | 1 | incomplete |
| 323 | マルチャミー・プルリア + ドロール＆ロックバード | 未対応 | no-board-development | 297 | 0 | — | 0 | completeWithinNoDrawScope |
| 331 | M∀LICE＜C＞MTP－０７ + M∀LICE＜P＞Cheshire Cat | spell-94722358-no-starter | link-development / pair3-cat-mtp-accord-binder-gwc | 471 | 147 | 2–27 | 3 | incomplete |

## 展開が限られる組の条件

以下は固定EX・先攻空盤面・2枚手札に限った、カードテキストと実core結果に基づく説明。残枝がある組の探索完了を意味しない。

- 11 サイバース・コード・マジシャン + M∀LICE＜C＞TB－１１: 儀式モンスターのCode Magician単独では通常召喚・L召喚の足場を作れず、TBを当日発動する場のMALICEもない。
- 19 サイバース・コード・マジシャン + 神の密告: Code MagicianをL素材にするための場のLモンスターがなく、神の密告は自分から展開する初動にならない。
- 35 闇の誘惑 + M∀LICE＜C＞TB－１１: Allureの解決で最初に未知の2ドローが発生するため、その先は今回の対象外。Allureを使わない範囲ではTBの当日発動条件を満たすMALICEがない。
- 43 闇の誘惑 + 神の密告: Allureの未知の2ドロー以降を除外。神の密告だけでは自分のモンスターを供給しない。
- 91 灰流うらら + ディメンション・アトラクター: Shifterの適用とAshの通常召喚は可能だが、この空盤面では追加のモンスターを供給できない。Ashに適合するL1は固定EXにない。
- 163 増殖するG + 深淵の獣バルドレイク: Maxx CはEARTHで、墓地へ送ってもBaldrakeが要求するLIGHT/DARK対象を用意できない。相手の墓地も空。
- 219 深淵の獣マグナムート + ドロール＆ロックバード: DrollはWINDで、Magnamhut用のLIGHT/DARK墓地対象を用意できない。相手の墓地も空。
- 227 霊王の波動 + 深淵の獣バルドレイク: ImpulseはBaldrake用のLIGHT/DARK墓地対象や当日の追加モンスターを供給しない。
- 235 霊王の波動 + M∀LICE＜C＞MTP－０７: ImpulseとMTPはいずれも罠。MTPをセットした当日に発動するための場のMALICEをこの2枚では作れない。
- 259 幽鬼うさぎ + ディメンション・アトラクター: Shifterの適用とOgreの通常召喚は可能だが、この空盤面では追加モンスターを供給できない。Ogreに適合するL1は固定EXにない。
- 291 深淵の獣バルドレイク + ディメンション・アトラクター: Shifter自身は適用前のコストとして墓地へ送られるため、BaldrakeのDARK対象を作れる。実証した2枚線を参照。
- 323 マルチャミー・プルリア + ドロール＆ロックバード: 相手の行動がない先攻空盤面で、Purulia/Drollは2体を並べる特殊召喚手段にならない。どちらにも適合するL1は固定EXにない。

## 再開と検証

~~~powershell
node scripts/research-pair-shard-3.mjs --nodes 100 --ms 3000 --depth 160 --passes 1
node scripts/research-pair-shard-3.mjs --audit-only
node scripts/research-pair-shard-3.mjs --manual-only
~~~

実探索checkpointは runtime/multi-pair-search/shard-3、独立監査hashは runtime/multi-pairs/shard-3/audit.json。sourceHashは 049a3c549948c20e82b32a158caaad750d4d2397a855f8cd7d8353628aec9208、generationは 7b6660f1a0b3c3c8bce276eae5819c7f9b0675196b174417578a51e41ca4b76e。ソースが変わった場合は新しいruntimeディレクトリを指定し、旧checkpointを改変しない。

検証：42 checkpointのidentity・手札・root・境界・件数・SHA-256、検索代表42線と手動4線の独立replayがPASS。

旧 runtime/multi-pairs/shard-3/search-v1 は共有ソース変更を検出して停止した初回試行の証拠。現行集計へ加算していない。全手順木・ドロー後・相手妨害・5枚初手の全探索完了は主張しない。
