# 2枚組からの実展開探索

固定2枚の先攻・相手手札なし。未知ドロー後を除外。既知template照合と実合法木探索は別指標。

全333組のうち実探索済み333組、無ドロー範囲の全枝終了134組、未着手0組。
訪問222997、終端履歴64901、未解決prefix 49621、対象外の未知ドロー境界6300。
手作業の実core検証ルート65件、探索が発見したMain1入力ルート330件。罠伏せ・小展開も含むため、件数は強い初動の成功率ではない。

保存ルートは実手札で再生して自動入力候補へ加える。未解決の木を最善性の証明や全網羅として扱わない。

| 組合せ | 実探索 | 訪問 | 残枝 | 最良到達点の種類 | 新規手順 |
| --- | --- | ---: | ---: | --- | ---: |
| サイバース・コード・マジシャン＋闇の誘惑 | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 1 |
| サイバース・コード・マジシャン＋ウィザード＠イグニスター | incomplete | 554 | 165 | link-development | 1 |
| サイバース・コード・マジシャン＋灰流うらら | incomplete | 469 | 326 | link-development | 2 |
| サイバース・コード・マジシャン＋ドットスケーパー | incomplete | 681 | 222 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞March Hare | incomplete | 496 | 318 | link-development | 1 |
| サイバース・コード・マジシャン＋増殖するG | incomplete | 449 | 329 | link-development | 1 |
| サイバース・コード・マジシャン＋バックアップ＠イグニスター | incomplete | 553 | 192 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞Dormouse | incomplete | 681 | 316 | link-development | 1 |
| サイバース・コード・マジシャン＋深淵の獣マグナムート | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| サイバース・コード・マジシャン＋霊王の波動 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋幽鬼うさぎ | incomplete | 462 | 245 | link-development | 1 |
| サイバース・コード・マジシャン＋M∀LICE IN UNDERGROUND | incomplete | 508 | 376 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞White Rabbit | incomplete | 484 | 309 | link-development | 1 |
| サイバース・コード・マジシャン＋深淵の獣バルドレイク | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| サイバース・コード・マジシャン＋テラ・フォーミング | incomplete | 654 | 431 | link-development | 0 |
| サイバース・コード・マジシャン＋コード・オブ・ソウル | incomplete | 559 | 174 | link-development | 1 |
| サイバース・コード・マジシャン＋封印の黄金櫃 | incomplete | 692 | 137 | link-development | 0 |
| サイバース・コード・マジシャン＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋マルチャミー・プルリア | incomplete | 468 | 248 | link-development | 1 |
| サイバース・コード・マジシャン＋ディメンション・アトラクター | completeWithinNoDrawScope | 12 | 0 | no-board-development | 0 |
| サイバース・コード・マジシャン＋ドロール＆ロックバード | incomplete | 441 | 328 | link-development | 1 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞Cheshire Cat | incomplete | 642 | 311 | link-development | 0 |
| 闇の誘惑＋ウィザード＠イグニスター | completeWithinNoDrawScope | 1837 | 0 | link-development | 0 |
| 闇の誘惑＋灰流うらら | completeWithinNoDrawScope | 1162 | 0 | normal-summon-only | 0 |
| 闇の誘惑＋ドットスケーパー | incomplete | 859 | 125 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 2544 | 0 | link-development | 0 |
| 闇の誘惑＋増殖するG | completeWithinNoDrawScope | 1272 | 0 | no-board-development | 0 |
| 闇の誘惑＋バックアップ＠イグニスター | incomplete | 662 | 184 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜P＞Dormouse | incomplete | 798 | 221 | link-development | 0 |
| 闇の誘惑＋深淵の獣マグナムート | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋霊王の波動 | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋幽鬼うさぎ | completeWithinNoDrawScope | 1132 | 0 | normal-summon-only | 1 |
| 闇の誘惑＋M∀LICE IN UNDERGROUND | incomplete | 697 | 282 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜P＞White Rabbit | incomplete | 533 | 298 | link-development | 0 |
| 闇の誘惑＋深淵の獣バルドレイク | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋テラ・フォーミング | incomplete | 680 | 434 | link-development | 0 |
| 闇の誘惑＋コード・オブ・ソウル | incomplete | 2637 | 53 | link-development | 0 |
| 闇の誘惑＋封印の黄金櫃 | incomplete | 741 | 124 | link-development | 0 |
| 闇の誘惑＋神の密告 | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋マルチャミー・プルリア | completeWithinNoDrawScope | 1208 | 0 | no-board-development | 1 |
| 闇の誘惑＋ディメンション・アトラクター | completeWithinNoDrawScope | 165 | 0 | no-board-development | 0 |
| 闇の誘惑＋ドロール＆ロックバード | completeWithinNoDrawScope | 1131 | 0 | normal-summon-only | 0 |
| 闇の誘惑＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1838 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋灰流うらら | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ドットスケーパー | incomplete | 1578 | 82 | link-development | 1 |
| ウィザード＠イグニスター＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞March Hare | incomplete | 509 | 134 | link-development | 1 |
| ウィザード＠イグニスター＋増殖するG | completeWithinNoDrawScope | 789 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋バックアップ＠イグニスター | incomplete | 445 | 296 | link-development | 1 |
| ウィザード＠イグニスター＋M∀LICE＜P＞Dormouse | incomplete | 579 | 158 | link-development | 0 |
| ウィザード＠イグニスター＋深淵の獣マグナムート | incomplete | 1923 | 71 | link-development | 1 |
| ウィザード＠イグニスター＋霊王の波動 | completeWithinNoDrawScope | 1245 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 1247 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋幽鬼うさぎ | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE IN UNDERGROUND | incomplete | 463 | 259 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞White Rabbit | incomplete | 493 | 480 | link-development | 0 |
| ウィザード＠イグニスター＋深淵の獣バルドレイク | incomplete | 1484 | 61 | link-development | 1 |
| ウィザード＠イグニスター＋テラ・フォーミング | incomplete | 497 | 298 | link-development | 0 |
| ウィザード＠イグニスター＋コード・オブ・ソウル | incomplete | 1943 | 77 | link-development | 2 |
| ウィザード＠イグニスター＋封印の黄金櫃 | incomplete | 1755 | 135 | link-development | 0 |
| ウィザード＠イグニスター＋神の密告 | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋マルチャミー・プルリア | completeWithinNoDrawScope | 438 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ディメンション・アトラクター | completeWithinNoDrawScope | 591 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ドロール＆ロックバード | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞Cheshire Cat | incomplete | 556 | 140 | link-development | 0 |
| 灰流うらら＋灰流うらら | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 灰流うらら＋ドットスケーパー | incomplete | 1898 | 74 | link-development | 0 |
| 灰流うらら＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| 灰流うらら＋増殖するG | completeWithinNoDrawScope | 518 | 0 | no-board-development | 1 |
| 灰流うらら＋バックアップ＠イグニスター | incomplete | 508 | 284 | link-development | 0 |
| 灰流うらら＋M∀LICE＜P＞Dormouse | incomplete | 514 | 215 | link-development | 0 |
| 灰流うらら＋深淵の獣マグナムート | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 灰流うらら＋霊王の波動 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋幽鬼うさぎ | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 0 |
| 灰流うらら＋M∀LICE IN UNDERGROUND | incomplete | 758 | 395 | link-development | 0 |
| 灰流うらら＋M∀LICE＜P＞White Rabbit | incomplete | 560 | 121 | link-development | 0 |
| 灰流うらら＋深淵の獣バルドレイク | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 灰流うらら＋テラ・フォーミング | incomplete | 471 | 414 | link-development | 0 |
| 灰流うらら＋コード・オブ・ソウル | incomplete | 1649 | 75 | link-development | 1 |
| 灰流うらら＋封印の黄金櫃 | incomplete | 887 | 166 | link-development | 0 |
| 灰流うらら＋神の密告 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋マルチャミー・プルリア | completeWithinNoDrawScope | 309 | 0 | no-board-development | 0 |
| 灰流うらら＋ディメンション・アトラクター | completeWithinNoDrawScope | 381 | 0 | no-board-development | 0 |
| 灰流うらら＋ドロール＆ロックバード | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 灰流うらら＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 752 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞GWC－０６ | incomplete | 1623 | 110 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜P＞March Hare | incomplete | 1692 | 84 | link-development | 0 |
| ドットスケーパー＋増殖するG | incomplete | 2032 | 85 | link-development | 0 |
| ドットスケーパー＋バックアップ＠イグニスター | incomplete | 417 | 261 | link-development | 1 |
| ドットスケーパー＋M∀LICE＜P＞Dormouse | incomplete | 656 | 190 | link-development | 0 |
| ドットスケーパー＋深淵の獣マグナムート | incomplete | 473 | 123 | link-development | 1 |
| ドットスケーパー＋霊王の波動 | incomplete | 622 | 122 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞TB－１１ | incomplete | 561 | 117 | link-development | 0 |
| ドットスケーパー＋幽鬼うさぎ | incomplete | 1772 | 84 | link-development | 0 |
| ドットスケーパー＋M∀LICE IN UNDERGROUND | incomplete | 632 | 242 | link-development | 1 |
| ドットスケーパー＋M∀LICE＜P＞White Rabbit | incomplete | 795 | 324 | link-development | 0 |
| ドットスケーパー＋深淵の獣バルドレイク | incomplete | 427 | 147 | link-development | 1 |
| ドットスケーパー＋テラ・フォーミング | incomplete | 590 | 321 | link-development | 0 |
| ドットスケーパー＋コード・オブ・ソウル | incomplete | 1301 | 144 | link-development | 1 |
| ドットスケーパー＋封印の黄金櫃 | incomplete | 574 | 251 | link-development | 0 |
| ドットスケーパー＋神の密告 | incomplete | 527 | 117 | link-development | 0 |
| ドットスケーパー＋マルチャミー・プルリア | incomplete | 1589 | 83 | link-development | 0 |
| ドットスケーパー＋ディメンション・アトラクター | incomplete | 736 | 102 | link-development | 1 |
| ドットスケーパー＋ドロール＆ロックバード | incomplete | 1847 | 70 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞MTP－０７ | incomplete | 473 | 127 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜P＞Cheshire Cat | incomplete | 2040 | 92 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 1908 | 0 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋増殖するG | completeWithinNoDrawScope | 830 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋バックアップ＠イグニスター | incomplete | 521 | 225 | link-development | 1 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞Dormouse | incomplete | 590 | 279 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋深淵の獣マグナムート | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋霊王の波動 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 115 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋幽鬼うさぎ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE IN UNDERGROUND | incomplete | 479 | 295 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞White Rabbit | incomplete | 493 | 341 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋テラ・フォーミング | incomplete | 483 | 330 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋コード・オブ・ソウル | incomplete | 1838 | 39 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋封印の黄金櫃 | incomplete | 577 | 125 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋神の密告 | completeWithinNoDrawScope | 115 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋マルチャミー・プルリア | completeWithinNoDrawScope | 794 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋ドロール＆ロックバード | completeWithinNoDrawScope | 752 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1340 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋増殖するG | completeWithinNoDrawScope | 1069 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋バックアップ＠イグニスター | incomplete | 468 | 154 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞Dormouse | incomplete | 422 | 141 | link-development | 1 |
| M∀LICE＜P＞March Hare＋深淵の獣マグナムート | incomplete | 2011 | 93 | link-development | 0 |
| M∀LICE＜P＞March Hare＋霊王の波動 | incomplete | 1705 | 12 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜C＞TB－１１ | incomplete | 554 | 204 | link-development | 1 |
| M∀LICE＜P＞March Hare＋幽鬼うさぎ | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE IN UNDERGROUND | incomplete | 545 | 209 | link-development | 1 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞White Rabbit | incomplete | 556 | 596 | link-development | 2 |
| M∀LICE＜P＞March Hare＋深淵の獣バルドレイク | incomplete | 1720 | 61 | link-development | 0 |
| M∀LICE＜P＞March Hare＋テラ・フォーミング | incomplete | 485 | 332 | link-development | 0 |
| M∀LICE＜P＞March Hare＋コード・オブ・ソウル | incomplete | 1708 | 87 | link-development | 1 |
| M∀LICE＜P＞March Hare＋封印の黄金櫃 | incomplete | 566 | 130 | link-development | 1 |
| M∀LICE＜P＞March Hare＋神の密告 | completeWithinNoDrawScope | 1743 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋マルチャミー・プルリア | completeWithinNoDrawScope | 578 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋ディメンション・アトラクター | completeWithinNoDrawScope | 1401 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋ドロール＆ロックバード | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜C＞MTP－０７ | incomplete | 1263 | 171 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞Cheshire Cat | incomplete | 452 | 149 | link-development | 0 |
| 増殖するG＋バックアップ＠イグニスター | incomplete | 644 | 182 | link-development | 0 |
| 増殖するG＋M∀LICE＜P＞Dormouse | incomplete | 455 | 177 | link-development | 0 |
| 増殖するG＋深淵の獣マグナムート | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 増殖するG＋霊王の波動 | completeWithinNoDrawScope | 829 | 0 | set-or-spell-only | 0 |
| 増殖するG＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 829 | 0 | set-or-spell-only | 0 |
| 増殖するG＋幽鬼うさぎ | completeWithinNoDrawScope | 508 | 0 | no-board-development | 1 |
| 増殖するG＋M∀LICE IN UNDERGROUND | incomplete | 447 | 181 | link-development | 0 |
| 増殖するG＋M∀LICE＜P＞White Rabbit | incomplete | 463 | 388 | link-development | 0 |
| 増殖するG＋深淵の獣バルドレイク | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 増殖するG＋テラ・フォーミング | incomplete | 398 | 302 | link-development | 0 |
| 増殖するG＋コード・オブ・ソウル | incomplete | 1869 | 55 | link-development | 0 |
| 増殖するG＋封印の黄金櫃 | incomplete | 600 | 160 | link-development | 0 |
| 増殖するG＋神の密告 | completeWithinNoDrawScope | 828 | 0 | set-or-spell-only | 0 |
| 増殖するG＋マルチャミー・プルリア | completeWithinNoDrawScope | 793 | 0 | no-board-development | 1 |
| 増殖するG＋ディメンション・アトラクター | completeWithinNoDrawScope | 398 | 0 | no-board-development | 0 |
| 増殖するG＋ドロール＆ロックバード | completeWithinNoDrawScope | 508 | 0 | no-board-development | 0 |
| 増殖するG＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 830 | 0 | set-or-spell-only | 0 |
| 増殖するG＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 788 | 0 | link-development | 0 |
| バックアップ＠イグニスター＋バックアップ＠イグニスター | incomplete | 443 | 311 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞Dormouse | incomplete | 507 | 249 | link-development | 0 |
| バックアップ＠イグニスター＋深淵の獣マグナムート | incomplete | 455 | 238 | link-development | 0 |
| バックアップ＠イグニスター＋霊王の波動 | incomplete | 739 | 227 | link-development | 1 |
| バックアップ＠イグニスター＋M∀LICE＜C＞TB－１１ | incomplete | 437 | 138 | link-development | 0 |
| バックアップ＠イグニスター＋幽鬼うさぎ | incomplete | 460 | 189 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE IN UNDERGROUND | incomplete | 607 | 337 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞White Rabbit | incomplete | 440 | 255 | link-development | 2 |
| バックアップ＠イグニスター＋深淵の獣バルドレイク | incomplete | 434 | 316 | link-development | 0 |
| バックアップ＠イグニスター＋テラ・フォーミング | incomplete | 464 | 354 | link-development | 0 |
| バックアップ＠イグニスター＋コード・オブ・ソウル | incomplete | 475 | 222 | link-development | 0 |
| バックアップ＠イグニスター＋封印の黄金櫃 | incomplete | 727 | 260 | link-development | 0 |
| バックアップ＠イグニスター＋神の密告 | incomplete | 438 | 137 | link-development | 0 |
| バックアップ＠イグニスター＋マルチャミー・プルリア | incomplete | 431 | 233 | link-development | 1 |
| バックアップ＠イグニスター＋ディメンション・アトラクター | incomplete | 708 | 159 | link-development | 0 |
| バックアップ＠イグニスター＋ドロール＆ロックバード | incomplete | 492 | 185 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜C＞MTP－０７ | incomplete | 534 | 223 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞Cheshire Cat | incomplete | 495 | 240 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋深淵の獣マグナムート | incomplete | 512 | 119 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋霊王の波動 | incomplete | 637 | 199 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜C＞TB－１１ | incomplete | 493 | 225 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋幽鬼うさぎ | incomplete | 443 | 138 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE IN UNDERGROUND | incomplete | 607 | 304 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜P＞White Rabbit | incomplete | 441 | 283 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋深淵の獣バルドレイク | incomplete | 486 | 137 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋テラ・フォーミング | incomplete | 463 | 342 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋コード・オブ・ソウル | incomplete | 524 | 188 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋封印の黄金櫃 | incomplete | 674 | 307 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋神の密告 | incomplete | 508 | 128 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋マルチャミー・プルリア | incomplete | 468 | 233 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋ディメンション・アトラクター | incomplete | 678 | 124 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋ドロール＆ロックバード | incomplete | 480 | 167 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜C＞MTP－０７ | incomplete | 528 | 187 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜P＞Cheshire Cat | incomplete | 488 | 294 | link-development | 1 |
| 深淵の獣マグナムート＋霊王の波動 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋幽鬼うさぎ | incomplete | 1795 | 59 | link-development | 0 |
| 深淵の獣マグナムート＋M∀LICE IN UNDERGROUND | incomplete | 419 | 970 | link-development | 0 |
| 深淵の獣マグナムート＋M∀LICE＜P＞White Rabbit | incomplete | 510 | 673 | link-development | 0 |
| 深淵の獣マグナムート＋深淵の獣バルドレイク | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| 深淵の獣マグナムート＋テラ・フォーミング | incomplete | 457 | 1403 | effect-only | 0 |
| 深淵の獣マグナムート＋コード・オブ・ソウル | completeWithinNoDrawScope | 279 | 0 | link-development | 0 |
| 深淵の獣マグナムート＋封印の黄金櫃 | incomplete | 494 | 1060 | single-monster | 0 |
| 深淵の獣マグナムート＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋マルチャミー・プルリア | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 深淵の獣マグナムート＋ディメンション・アトラクター | completeWithinNoDrawScope | 213 | 0 | no-board-development | 1 |
| 深淵の獣マグナムート＋ドロール＆ロックバード | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜P＞Cheshire Cat | incomplete | 490 | 146 | link-development | 1 |
| 霊王の波動＋霊王の波動 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋幽鬼うさぎ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE IN UNDERGROUND | incomplete | 398 | 188 | link-development | 0 |
| 霊王の波動＋M∀LICE＜P＞White Rabbit | incomplete | 416 | 298 | link-development | 0 |
| 霊王の波動＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋テラ・フォーミング | incomplete | 437 | 300 | link-development | 0 |
| 霊王の波動＋コード・オブ・ソウル | incomplete | 2335 | 53 | link-development | 0 |
| 霊王の波動＋封印の黄金櫃 | incomplete | 668 | 125 | link-development | 0 |
| 霊王の波動＋神の密告 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋マルチャミー・プルリア | completeWithinNoDrawScope | 794 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋ドロール＆ロックバード | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1245 | 0 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋幽鬼うさぎ | completeWithinNoDrawScope | 753 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE IN UNDERGROUND | incomplete | 646 | 119 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜P＞White Rabbit | incomplete | 522 | 410 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋テラ・フォーミング | incomplete | 1866 | 125 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋コード・オブ・ソウル | incomplete | 1816 | 51 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋封印の黄金櫃 | incomplete | 777 | 106 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋神の密告 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋マルチャミー・プルリア | completeWithinNoDrawScope | 793 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋ドロール＆ロックバード | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜P＞Cheshire Cat | incomplete | 497 | 284 | link-development | 0 |
| 幽鬼うさぎ＋幽鬼うさぎ | completeWithinNoDrawScope | 117 | 0 | normal-summon-only | 0 |
| 幽鬼うさぎ＋M∀LICE IN UNDERGROUND | incomplete | 667 | 301 | link-development | 0 |
| 幽鬼うさぎ＋M∀LICE＜P＞White Rabbit | incomplete | 457 | 179 | link-development | 0 |
| 幽鬼うさぎ＋深淵の獣バルドレイク | incomplete | 1736 | 56 | link-development | 0 |
| 幽鬼うさぎ＋テラ・フォーミング | incomplete | 506 | 415 | link-development | 0 |
| 幽鬼うさぎ＋コード・オブ・ソウル | incomplete | 1586 | 77 | link-development | 1 |
| 幽鬼うさぎ＋封印の黄金櫃 | incomplete | 778 | 166 | link-development | 0 |
| 幽鬼うさぎ＋神の密告 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 幽鬼うさぎ＋マルチャミー・プルリア | completeWithinNoDrawScope | 298 | 0 | no-board-development | 0 |
| 幽鬼うさぎ＋ディメンション・アトラクター | completeWithinNoDrawScope | 381 | 0 | no-board-development | 0 |
| 幽鬼うさぎ＋ドロール＆ロックバード | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 幽鬼うさぎ＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| 幽鬼うさぎ＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE IN UNDERGROUND | incomplete | 597 | 235 | link-development | 1 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜P＞White Rabbit | incomplete | 641 | 357 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋深淵の獣バルドレイク | incomplete | 388 | 1201 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋テラ・フォーミング | incomplete | 445 | 174 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋コード・オブ・ソウル | incomplete | 654 | 287 | link-development | 1 |
| M∀LICE IN UNDERGROUND＋封印の黄金櫃 | incomplete | 570 | 155 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋神の密告 | incomplete | 516 | 285 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋マルチャミー・プルリア | incomplete | 519 | 349 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋ディメンション・アトラクター | incomplete | 732 | 142 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋ドロール＆ロックバード | incomplete | 670 | 295 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜C＞MTP－０７ | incomplete | 1850 | 185 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜P＞Cheshire Cat | incomplete | 494 | 246 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜P＞White Rabbit | incomplete | 590 | 501 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋深淵の獣バルドレイク | incomplete | 407 | 527 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋テラ・フォーミング | incomplete | 446 | 470 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋コード・オブ・ソウル | incomplete | 595 | 428 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋封印の黄金櫃 | incomplete | 619 | 497 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋神の密告 | incomplete | 625 | 472 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋マルチャミー・プルリア | incomplete | 422 | 337 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋ディメンション・アトラクター | incomplete | 433 | 288 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋ドロール＆ロックバード | incomplete | 610 | 494 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜C＞MTP－０７ | incomplete | 643 | 125 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜P＞Cheshire Cat | incomplete | 475 | 388 | link-development | 0 |
| 深淵の獣バルドレイク＋テラ・フォーミング | incomplete | 528 | 1520 | link-development | 0 |
| 深淵の獣バルドレイク＋コード・オブ・ソウル | completeWithinNoDrawScope | 279 | 0 | link-development | 0 |
| 深淵の獣バルドレイク＋封印の黄金櫃 | incomplete | 624 | 1221 | single-monster | 0 |
| 深淵の獣バルドレイク＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣バルドレイク＋マルチャミー・プルリア | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 深淵の獣バルドレイク＋ディメンション・アトラクター | completeWithinNoDrawScope | 93 | 0 | no-board-development | 1 |
| 深淵の獣バルドレイク＋ドロール＆ロックバード | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 1 |
| 深淵の獣バルドレイク＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣バルドレイク＋M∀LICE＜P＞Cheshire Cat | incomplete | 611 | 123 | link-development | 1 |
| テラ・フォーミング＋コード・オブ・ソウル | incomplete | 500 | 301 | link-development | 0 |
| テラ・フォーミング＋封印の黄金櫃 | incomplete | 555 | 563 | link-development | 0 |
| テラ・フォーミング＋神の密告 | incomplete | 405 | 211 | link-development | 0 |
| テラ・フォーミング＋マルチャミー・プルリア | incomplete | 432 | 337 | link-development | 0 |
| テラ・フォーミング＋ディメンション・アトラクター | incomplete | 647 | 227 | link-development | 0 |
| テラ・フォーミング＋ドロール＆ロックバード | incomplete | 439 | 313 | link-development | 0 |
| テラ・フォーミング＋M∀LICE＜C＞MTP－０７ | incomplete | 621 | 167 | set-or-spell-only | 0 |
| テラ・フォーミング＋M∀LICE＜P＞Cheshire Cat | incomplete | 570 | 375 | link-development | 0 |
| コード・オブ・ソウル＋封印の黄金櫃 | incomplete | 845 | 125 | link-development | 0 |
| コード・オブ・ソウル＋神の密告 | incomplete | 1839 | 45 | link-development | 0 |
| コード・オブ・ソウル＋マルチャミー・プルリア | incomplete | 2293 | 48 | link-development | 0 |
| コード・オブ・ソウル＋ディメンション・アトラクター | incomplete | 1632 | 21 | link-development | 0 |
| コード・オブ・ソウル＋ドロール＆ロックバード | incomplete | 1698 | 97 | link-development | 0 |
| コード・オブ・ソウル＋M∀LICE＜C＞MTP－０７ | incomplete | 1788 | 35 | link-development | 0 |
| コード・オブ・ソウル＋M∀LICE＜P＞Cheshire Cat | incomplete | 547 | 251 | link-development | 0 |
| 封印の黄金櫃＋神の密告 | incomplete | 847 | 121 | link-development | 0 |
| 封印の黄金櫃＋マルチャミー・プルリア | incomplete | 1973 | 144 | link-development | 0 |
| 封印の黄金櫃＋ディメンション・アトラクター | incomplete | 802 | 132 | link-development | 0 |
| 封印の黄金櫃＋ドロール＆ロックバード | incomplete | 1985 | 147 | link-development | 0 |
| 封印の黄金櫃＋M∀LICE＜C＞MTP－０７ | incomplete | 646 | 129 | link-development | 1 |
| 封印の黄金櫃＋M∀LICE＜P＞Cheshire Cat | incomplete | 744 | 246 | link-development | 0 |
| 神の密告＋マルチャミー・プルリア | completeWithinNoDrawScope | 795 | 0 | set-or-spell-only | 0 |
| 神の密告＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| 神の密告＋ドロール＆ロックバード | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 神の密告＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 神の密告＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| マルチャミー・プルリア＋マルチャミー・プルリア | completeWithinNoDrawScope | 669 | 0 | no-board-development | 0 |
| マルチャミー・プルリア＋ディメンション・アトラクター | completeWithinNoDrawScope | 432 | 0 | no-board-development | 0 |
| マルチャミー・プルリア＋ドロール＆ロックバード | completeWithinNoDrawScope | 297 | 0 | no-board-development | 0 |
| マルチャミー・プルリア＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 793 | 0 | set-or-spell-only | 0 |
| マルチャミー・プルリア＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 438 | 0 | link-development | 0 |
| ディメンション・アトラクター＋ドロール＆ロックバード | completeWithinNoDrawScope | 381 | 0 | no-board-development | 0 |
| ディメンション・アトラクター＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| ディメンション・アトラクター＋M∀LICE＜P＞Cheshire Cat | incomplete | 1935 | 91 | link-development | 1 |
| ドロール＆ロックバード＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| ドロール＆ロックバード＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 152 | 0 | link-development | 0 |
| M∀LICE＜C＞MTP－０７＋M∀LICE＜P＞Cheshire Cat | incomplete | 690 | 188 | link-development | 1 |
| M∀LICE＜P＞Cheshire Cat＋M∀LICE＜P＞Cheshire Cat | incomplete | 1600 | 96 | link-development | 1 |
