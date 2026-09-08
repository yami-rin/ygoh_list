# 2枚組からの実展開探索

固定2枚の先攻・相手手札なし。未知ドロー後を除外。既知template照合と実合法木探索は別指標。 初期手札バルドレイク・マグナムートの通常召喚キャンセルと既存のLink素材UI循環は、ソース照合などの監査条件が成立する場合のみ縮約する。

全333組のうち実探索済み333組、無ドロー範囲の全枝終了136組、未着手0組。
訪問442207、終端履歴126411、未解決prefix 69167、対象外の未知ドロー境界8482。
手作業の実core検証ルート65件、探索が発見したMain1入力ルート330件。罠伏せ・小展開も含むため、件数は強い初動の成功率ではない。

保存ルートは実手札で再生して自動入力候補へ加える。未解決の木を最善性の証明や全網羅として扱わない。

| 組合せ | 実探索 | 訪問 | 残枝 | 最良到達点の種類 | 新規手順 |
| --- | --- | ---: | ---: | --- | ---: |
| サイバース・コード・マジシャン＋闇の誘惑 | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 1 |
| サイバース・コード・マジシャン＋ウィザード＠イグニスター | incomplete | 1568 | 319 | link-development | 1 |
| サイバース・コード・マジシャン＋灰流うらら | incomplete | 1642 | 469 | link-development | 2 |
| サイバース・コード・マジシャン＋ドットスケーパー | incomplete | 1829 | 330 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞March Hare | incomplete | 1411 | 474 | link-development | 1 |
| サイバース・コード・マジシャン＋増殖するG | incomplete | 1488 | 467 | link-development | 1 |
| サイバース・コード・マジシャン＋バックアップ＠イグニスター | incomplete | 1497 | 340 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞Dormouse | incomplete | 1921 | 473 | link-development | 1 |
| サイバース・コード・マジシャン＋深淵の獣マグナムート | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| サイバース・コード・マジシャン＋霊王の波動 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋幽鬼うさぎ | incomplete | 1540 | 400 | link-development | 1 |
| サイバース・コード・マジシャン＋M∀LICE IN UNDERGROUND | incomplete | 1347 | 562 | link-development | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞White Rabbit | incomplete | 1461 | 466 | link-development | 1 |
| サイバース・コード・マジシャン＋深淵の獣バルドレイク | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| サイバース・コード・マジシャン＋テラ・フォーミング | incomplete | 1813 | 650 | link-development | 0 |
| サイバース・コード・マジシャン＋コード・オブ・ソウル | incomplete | 1617 | 345 | link-development | 1 |
| サイバース・コード・マジシャン＋封印の黄金櫃 | incomplete | 2247 | 195 | link-development | 0 |
| サイバース・コード・マジシャン＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋マルチャミー・プルリア | incomplete | 1522 | 407 | link-development | 1 |
| サイバース・コード・マジシャン＋ディメンション・アトラクター | completeWithinNoDrawScope | 12 | 0 | no-board-development | 0 |
| サイバース・コード・マジシャン＋ドロール＆ロックバード | incomplete | 1418 | 471 | link-development | 1 |
| サイバース・コード・マジシャン＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| サイバース・コード・マジシャン＋M∀LICE＜P＞Cheshire Cat | incomplete | 1780 | 465 | link-development | 0 |
| 闇の誘惑＋ウィザード＠イグニスター | completeWithinNoDrawScope | 1837 | 0 | link-development | 0 |
| 闇の誘惑＋灰流うらら | completeWithinNoDrawScope | 1162 | 0 | normal-summon-only | 0 |
| 闇の誘惑＋ドットスケーパー | incomplete | 2085 | 168 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 2544 | 0 | link-development | 0 |
| 闇の誘惑＋増殖するG | completeWithinNoDrawScope | 1272 | 0 | no-board-development | 0 |
| 闇の誘惑＋バックアップ＠イグニスター | incomplete | 1617 | 280 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜P＞Dormouse | incomplete | 1755 | 369 | link-development | 0 |
| 闇の誘惑＋深淵の獣マグナムート | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋霊王の波動 | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋幽鬼うさぎ | completeWithinNoDrawScope | 1132 | 0 | normal-summon-only | 1 |
| 闇の誘惑＋M∀LICE IN UNDERGROUND | incomplete | 1421 | 472 | link-development | 0 |
| 闇の誘惑＋M∀LICE＜P＞White Rabbit | incomplete | 1298 | 621 | link-development | 0 |
| 闇の誘惑＋深淵の獣バルドレイク | completeWithinNoDrawScope | 24 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋テラ・フォーミング | incomplete | 1587 | 654 | link-development | 0 |
| 闇の誘惑＋コード・オブ・ソウル | incomplete | 3982 | 71 | link-development | 0 |
| 闇の誘惑＋封印の黄金櫃 | incomplete | 2011 | 164 | link-development | 0 |
| 闇の誘惑＋神の密告 | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋マルチャミー・プルリア | completeWithinNoDrawScope | 1208 | 0 | no-board-development | 1 |
| 闇の誘惑＋ディメンション・アトラクター | completeWithinNoDrawScope | 165 | 0 | no-board-development | 0 |
| 闇の誘惑＋ドロール＆ロックバード | completeWithinNoDrawScope | 1131 | 0 | normal-summon-only | 0 |
| 闇の誘惑＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 190 | 0 | set-or-spell-only | 0 |
| 闇の誘惑＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1838 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋灰流うらら | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ドットスケーパー | incomplete | 3050 | 103 | link-development | 1 |
| ウィザード＠イグニスター＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞March Hare | incomplete | 1553 | 236 | link-development | 1 |
| ウィザード＠イグニスター＋増殖するG | completeWithinNoDrawScope | 789 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋バックアップ＠イグニスター | incomplete | 1318 | 452 | link-development | 1 |
| ウィザード＠イグニスター＋M∀LICE＜P＞Dormouse | incomplete | 1533 | 259 | link-development | 0 |
| ウィザード＠イグニスター＋深淵の獣マグナムート | incomplete | 4014 | 87 | link-development | 1 |
| ウィザード＠イグニスター＋霊王の波動 | completeWithinNoDrawScope | 1245 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 1247 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋幽鬼うさぎ | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE IN UNDERGROUND | incomplete | 1711 | 429 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞White Rabbit | incomplete | 1328 | 711 | link-development | 0 |
| ウィザード＠イグニスター＋深淵の獣バルドレイク | incomplete | 2842 | 73 | link-development | 1 |
| ウィザード＠イグニスター＋テラ・フォーミング | incomplete | 1339 | 469 | link-development | 0 |
| ウィザード＠イグニスター＋コード・オブ・ソウル | incomplete | 3460 | 108 | link-development | 2 |
| ウィザード＠イグニスター＋封印の黄金櫃 | incomplete | 3567 | 200 | link-development | 0 |
| ウィザード＠イグニスター＋神の密告 | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋マルチャミー・プルリア | completeWithinNoDrawScope | 438 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ディメンション・アトラクター | completeWithinNoDrawScope | 591 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋ドロール＆ロックバード | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 1246 | 0 | link-development | 0 |
| ウィザード＠イグニスター＋M∀LICE＜P＞Cheshire Cat | incomplete | 1473 | 231 | link-development | 0 |
| 灰流うらら＋灰流うらら | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 灰流うらら＋ドットスケーパー | incomplete | 3448 | 102 | link-development | 0 |
| 灰流うらら＋M∀LICE＜C＞GWC－０６ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| 灰流うらら＋増殖するG | completeWithinNoDrawScope | 518 | 0 | no-board-development | 1 |
| 灰流うらら＋バックアップ＠イグニスター | incomplete | 1330 | 453 | link-development | 0 |
| 灰流うらら＋M∀LICE＜P＞Dormouse | incomplete | 1440 | 355 | link-development | 0 |
| 灰流うらら＋深淵の獣マグナムート | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 灰流うらら＋霊王の波動 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋幽鬼うさぎ | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 0 |
| 灰流うらら＋M∀LICE IN UNDERGROUND | incomplete | 2194 | 593 | link-development | 0 |
| 灰流うらら＋M∀LICE＜P＞White Rabbit | incomplete | 1606 | 386 | link-development | 0 |
| 灰流うらら＋深淵の獣バルドレイク | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 灰流うらら＋テラ・フォーミング | incomplete | 1308 | 620 | link-development | 0 |
| 灰流うらら＋コード・オブ・ソウル | incomplete | 2809 | 112 | link-development | 1 |
| 灰流うらら＋封印の黄金櫃 | incomplete | 2709 | 210 | link-development | 0 |
| 灰流うらら＋神の密告 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋マルチャミー・プルリア | completeWithinNoDrawScope | 309 | 0 | no-board-development | 0 |
| 灰流うらら＋ディメンション・アトラクター | completeWithinNoDrawScope | 381 | 0 | no-board-development | 0 |
| 灰流うらら＋ドロール＆ロックバード | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 灰流うらら＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 752 | 0 | set-or-spell-only | 0 |
| 灰流うらら＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞GWC－０６ | incomplete | 2774 | 152 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜P＞March Hare | incomplete | 3130 | 115 | link-development | 0 |
| ドットスケーパー＋増殖するG | incomplete | 3426 | 110 | link-development | 0 |
| ドットスケーパー＋バックアップ＠イグニスター | incomplete | 1437 | 402 | link-development | 1 |
| ドットスケーパー＋M∀LICE＜P＞Dormouse | incomplete | 1825 | 316 | link-development | 0 |
| ドットスケーパー＋深淵の獣マグナムート | incomplete | 1683 | 242 | link-development | 1 |
| ドットスケーパー＋霊王の波動 | incomplete | 1801 | 170 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞TB－１１ | incomplete | 1716 | 160 | link-development | 0 |
| ドットスケーパー＋幽鬼うさぎ | incomplete | 3086 | 111 | link-development | 0 |
| ドットスケーパー＋M∀LICE IN UNDERGROUND | incomplete | 1703 | 360 | link-development | 1 |
| ドットスケーパー＋M∀LICE＜P＞White Rabbit | incomplete | 1714 | 626 | link-development | 0 |
| ドットスケーパー＋深淵の獣バルドレイク | incomplete | 1605 | 277 | link-development | 1 |
| ドットスケーパー＋テラ・フォーミング | incomplete | 1625 | 510 | link-development | 0 |
| ドットスケーパー＋コード・オブ・ソウル | incomplete | 2267 | 242 | link-development | 1 |
| ドットスケーパー＋封印の黄金櫃 | incomplete | 1705 | 366 | link-development | 0 |
| ドットスケーパー＋神の密告 | incomplete | 1716 | 161 | link-development | 0 |
| ドットスケーパー＋マルチャミー・プルリア | incomplete | 2754 | 107 | link-development | 0 |
| ドットスケーパー＋ディメンション・アトラクター | incomplete | 2054 | 125 | link-development | 1 |
| ドットスケーパー＋ドロール＆ロックバード | incomplete | 3105 | 96 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜C＞MTP－０７ | incomplete | 1780 | 170 | link-development | 0 |
| ドットスケーパー＋M∀LICE＜P＞Cheshire Cat | incomplete | 3485 | 118 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞March Hare | completeWithinNoDrawScope | 1908 | 0 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋増殖するG | completeWithinNoDrawScope | 830 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋バックアップ＠イグニスター | incomplete | 1678 | 310 | link-development | 1 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞Dormouse | incomplete | 1560 | 495 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋深淵の獣マグナムート | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋霊王の波動 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 115 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋幽鬼うさぎ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE IN UNDERGROUND | incomplete | 1413 | 494 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞White Rabbit | incomplete | 1456 | 672 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋テラ・フォーミング | incomplete | 1318 | 540 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋コード・オブ・ソウル | incomplete | 3240 | 45 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋封印の黄金櫃 | incomplete | 1985 | 174 | link-development | 0 |
| M∀LICE＜C＞GWC－０６＋神の密告 | completeWithinNoDrawScope | 115 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋マルチャミー・プルリア | completeWithinNoDrawScope | 794 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋ドロール＆ロックバード | completeWithinNoDrawScope | 752 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1340 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋増殖するG | completeWithinNoDrawScope | 1069 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋バックアップ＠イグニスター | incomplete | 1322 | 315 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞Dormouse | incomplete | 1435 | 257 | link-development | 1 |
| M∀LICE＜P＞March Hare＋深淵の獣マグナムート | incomplete | 3731 | 112 | link-development | 0 |
| M∀LICE＜P＞March Hare＋霊王の波動 | completeWithinNoDrawScope | 1740 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜C＞TB－１１ | incomplete | 1428 | 460 | link-development | 1 |
| M∀LICE＜P＞March Hare＋幽鬼うさぎ | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE IN UNDERGROUND | incomplete | 1533 | 385 | link-development | 1 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞White Rabbit | incomplete | 1382 | 982 | link-development | 2 |
| M∀LICE＜P＞March Hare＋深淵の獣バルドレイク | incomplete | 3030 | 77 | link-development | 0 |
| M∀LICE＜P＞March Hare＋テラ・フォーミング | incomplete | 1524 | 504 | link-development | 0 |
| M∀LICE＜P＞March Hare＋コード・オブ・ソウル | incomplete | 3017 | 115 | link-development | 1 |
| M∀LICE＜P＞March Hare＋封印の黄金櫃 | incomplete | 1878 | 208 | link-development | 1 |
| M∀LICE＜P＞March Hare＋神の密告 | completeWithinNoDrawScope | 1743 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋マルチャミー・プルリア | completeWithinNoDrawScope | 578 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋ディメンション・アトラクター | completeWithinNoDrawScope | 1401 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋ドロール＆ロックバード | completeWithinNoDrawScope | 186 | 0 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜C＞MTP－０７ | incomplete | 2240 | 329 | link-development | 0 |
| M∀LICE＜P＞March Hare＋M∀LICE＜P＞Cheshire Cat | incomplete | 1430 | 262 | link-development | 0 |
| 増殖するG＋バックアップ＠イグニスター | incomplete | 1803 | 255 | link-development | 0 |
| 増殖するG＋M∀LICE＜P＞Dormouse | incomplete | 1447 | 302 | link-development | 0 |
| 増殖するG＋深淵の獣マグナムート | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 増殖するG＋霊王の波動 | completeWithinNoDrawScope | 829 | 0 | set-or-spell-only | 0 |
| 増殖するG＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 829 | 0 | set-or-spell-only | 0 |
| 増殖するG＋幽鬼うさぎ | completeWithinNoDrawScope | 508 | 0 | no-board-development | 1 |
| 増殖するG＋M∀LICE IN UNDERGROUND | incomplete | 1302 | 371 | link-development | 0 |
| 増殖するG＋M∀LICE＜P＞White Rabbit | incomplete | 1330 | 732 | link-development | 0 |
| 増殖するG＋深淵の獣バルドレイク | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 増殖するG＋テラ・フォーミング | incomplete | 1281 | 496 | link-development | 0 |
| 増殖するG＋コード・オブ・ソウル | incomplete | 3082 | 86 | link-development | 0 |
| 増殖するG＋封印の黄金櫃 | incomplete | 1822 | 250 | link-development | 0 |
| 増殖するG＋神の密告 | completeWithinNoDrawScope | 828 | 0 | set-or-spell-only | 0 |
| 増殖するG＋マルチャミー・プルリア | completeWithinNoDrawScope | 793 | 0 | no-board-development | 1 |
| 増殖するG＋ディメンション・アトラクター | completeWithinNoDrawScope | 398 | 0 | no-board-development | 0 |
| 増殖するG＋ドロール＆ロックバード | completeWithinNoDrawScope | 508 | 0 | no-board-development | 0 |
| 増殖するG＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 830 | 0 | set-or-spell-only | 0 |
| 増殖するG＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 788 | 0 | link-development | 0 |
| バックアップ＠イグニスター＋バックアップ＠イグニスター | incomplete | 1287 | 473 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞Dormouse | incomplete | 1456 | 386 | link-development | 0 |
| バックアップ＠イグニスター＋深淵の獣マグナムート | incomplete | 1561 | 326 | link-development | 0 |
| バックアップ＠イグニスター＋霊王の波動 | incomplete | 1852 | 307 | link-development | 1 |
| バックアップ＠イグニスター＋M∀LICE＜C＞TB－１１ | incomplete | 1611 | 221 | link-development | 0 |
| バックアップ＠イグニスター＋幽鬼うさぎ | incomplete | 1531 | 286 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE IN UNDERGROUND | incomplete | 1706 | 465 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞White Rabbit | incomplete | 1320 | 432 | link-development | 2 |
| バックアップ＠イグニスター＋深淵の獣バルドレイク | incomplete | 1396 | 406 | link-development | 0 |
| バックアップ＠イグニスター＋テラ・フォーミング | incomplete | 1259 | 531 | link-development | 0 |
| バックアップ＠イグニスター＋コード・オブ・ソウル | incomplete | 1319 | 360 | link-development | 0 |
| バックアップ＠イグニスター＋封印の黄金櫃 | incomplete | 1810 | 416 | link-development | 0 |
| バックアップ＠イグニスター＋神の密告 | incomplete | 1566 | 222 | link-development | 0 |
| バックアップ＠イグニスター＋マルチャミー・プルリア | incomplete | 1556 | 304 | link-development | 1 |
| バックアップ＠イグニスター＋ディメンション・アトラクター | incomplete | 1900 | 235 | link-development | 0 |
| バックアップ＠イグニスター＋ドロール＆ロックバード | incomplete | 1545 | 281 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜C＞MTP－０７ | incomplete | 1621 | 308 | link-development | 0 |
| バックアップ＠イグニスター＋M∀LICE＜P＞Cheshire Cat | incomplete | 1376 | 375 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋深淵の獣マグナムート | incomplete | 1760 | 196 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋霊王の波動 | incomplete | 1562 | 336 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜C＞TB－１１ | incomplete | 1440 | 438 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋幽鬼うさぎ | incomplete | 1542 | 227 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE IN UNDERGROUND | incomplete | 1694 | 411 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜P＞White Rabbit | incomplete | 1268 | 492 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋深淵の獣バルドレイク | incomplete | 1479 | 206 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋テラ・フォーミング | incomplete | 1354 | 532 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋コード・オブ・ソウル | incomplete | 1387 | 361 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋封印の黄金櫃 | incomplete | 1595 | 515 | link-development | 1 |
| M∀LICE＜P＞Dormouse＋神の密告 | incomplete | 1436 | 265 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋マルチャミー・プルリア | incomplete | 1411 | 357 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋ディメンション・アトラクター | incomplete | 1868 | 218 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋ドロール＆ロックバード | incomplete | 1382 | 287 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜C＞MTP－０７ | incomplete | 1534 | 345 | link-development | 0 |
| M∀LICE＜P＞Dormouse＋M∀LICE＜P＞Cheshire Cat | incomplete | 1390 | 470 | link-development | 1 |
| 深淵の獣マグナムート＋霊王の波動 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋幽鬼うさぎ | incomplete | 3229 | 64 | link-development | 0 |
| 深淵の獣マグナムート＋M∀LICE IN UNDERGROUND | incomplete | 1284 | 210 | link-development | 0 |
| 深淵の獣マグナムート＋M∀LICE＜P＞White Rabbit | incomplete | 1513 | 1012 | link-development | 0 |
| 深淵の獣マグナムート＋深淵の獣バルドレイク | completeWithinNoDrawScope | 2 | 0 | no-action | 0 |
| 深淵の獣マグナムート＋テラ・フォーミング | incomplete | 1238 | 256 | link-development | 0 |
| 深淵の獣マグナムート＋コード・オブ・ソウル | completeWithinNoDrawScope | 279 | 0 | link-development | 0 |
| 深淵の獣マグナムート＋封印の黄金櫃 | incomplete | 1398 | 211 | link-development | 0 |
| 深淵の獣マグナムート＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋マルチャミー・プルリア | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 深淵の獣マグナムート＋ディメンション・アトラクター | completeWithinNoDrawScope | 213 | 0 | no-board-development | 1 |
| 深淵の獣マグナムート＋ドロール＆ロックバード | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣マグナムート＋M∀LICE＜P＞Cheshire Cat | incomplete | 1849 | 220 | link-development | 1 |
| 霊王の波動＋霊王の波動 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜C＞TB－１１ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋幽鬼うさぎ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE IN UNDERGROUND | incomplete | 1336 | 376 | link-development | 0 |
| 霊王の波動＋M∀LICE＜P＞White Rabbit | incomplete | 1284 | 608 | link-development | 0 |
| 霊王の波動＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋テラ・フォーミング | incomplete | 1270 | 504 | link-development | 0 |
| 霊王の波動＋コード・オブ・ソウル | incomplete | 3775 | 43 | link-development | 0 |
| 霊王の波動＋封印の黄金櫃 | incomplete | 1956 | 165 | link-development | 0 |
| 霊王の波動＋神の密告 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋マルチャミー・プルリア | completeWithinNoDrawScope | 794 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋ドロール＆ロックバード | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| 霊王の波動＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 1245 | 0 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋幽鬼うさぎ | completeWithinNoDrawScope | 753 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE IN UNDERGROUND | incomplete | 1833 | 168 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜P＞White Rabbit | incomplete | 1531 | 740 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋深淵の獣バルドレイク | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋テラ・フォーミング | incomplete | 3014 | 187 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋コード・オブ・ソウル | incomplete | 3132 | 53 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋封印の黄金櫃 | incomplete | 2147 | 152 | link-development | 0 |
| M∀LICE＜C＞TB－１１＋神の密告 | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋マルチャミー・プルリア | completeWithinNoDrawScope | 793 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋ドロール＆ロックバード | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 114 | 0 | set-or-spell-only | 0 |
| M∀LICE＜C＞TB－１１＋M∀LICE＜P＞Cheshire Cat | incomplete | 1296 | 586 | link-development | 0 |
| 幽鬼うさぎ＋幽鬼うさぎ | completeWithinNoDrawScope | 117 | 0 | normal-summon-only | 0 |
| 幽鬼うさぎ＋M∀LICE IN UNDERGROUND | incomplete | 1820 | 493 | link-development | 0 |
| 幽鬼うさぎ＋M∀LICE＜P＞White Rabbit | incomplete | 1354 | 303 | link-development | 0 |
| 幽鬼うさぎ＋深淵の獣バルドレイク | incomplete | 3311 | 60 | link-development | 0 |
| 幽鬼うさぎ＋テラ・フォーミング | incomplete | 1345 | 624 | link-development | 0 |
| 幽鬼うさぎ＋コード・オブ・ソウル | incomplete | 2925 | 109 | link-development | 1 |
| 幽鬼うさぎ＋封印の黄金櫃 | incomplete | 2142 | 227 | link-development | 0 |
| 幽鬼うさぎ＋神の密告 | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| 幽鬼うさぎ＋マルチャミー・プルリア | completeWithinNoDrawScope | 298 | 0 | no-board-development | 0 |
| 幽鬼うさぎ＋ディメンション・アトラクター | completeWithinNoDrawScope | 381 | 0 | no-board-development | 0 |
| 幽鬼うさぎ＋ドロール＆ロックバード | completeWithinNoDrawScope | 116 | 0 | normal-summon-only | 1 |
| 幽鬼うさぎ＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 751 | 0 | set-or-spell-only | 0 |
| 幽鬼うさぎ＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 151 | 0 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE IN UNDERGROUND | incomplete | 1739 | 360 | link-development | 1 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜P＞White Rabbit | incomplete | 1581 | 542 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋深淵の獣バルドレイク | incomplete | 1365 | 168 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋テラ・フォーミング | incomplete | 1262 | 367 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋コード・オブ・ソウル | incomplete | 1927 | 404 | link-development | 1 |
| M∀LICE IN UNDERGROUND＋封印の黄金櫃 | incomplete | 1354 | 419 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋神の密告 | incomplete | 1486 | 473 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋マルチャミー・プルリア | incomplete | 1475 | 548 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋ディメンション・アトラクター | incomplete | 2143 | 231 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋ドロール＆ロックバード | incomplete | 1795 | 498 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜C＞MTP－０７ | incomplete | 3091 | 238 | link-development | 0 |
| M∀LICE IN UNDERGROUND＋M∀LICE＜P＞Cheshire Cat | incomplete | 1622 | 412 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜P＞White Rabbit | incomplete | 1417 | 803 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋深淵の獣バルドレイク | incomplete | 1155 | 914 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋テラ・フォーミング | incomplete | 1541 | 679 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋コード・オブ・ソウル | incomplete | 1504 | 864 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋封印の黄金櫃 | incomplete | 1772 | 930 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋神の密告 | incomplete | 1456 | 781 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋マルチャミー・プルリア | incomplete | 1392 | 666 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋ディメンション・アトラクター | incomplete | 1362 | 459 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋ドロール＆ロックバード | incomplete | 1594 | 676 | link-development | 0 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜C＞MTP－０７ | incomplete | 1951 | 179 | link-development | 1 |
| M∀LICE＜P＞White Rabbit＋M∀LICE＜P＞Cheshire Cat | incomplete | 1707 | 627 | link-development | 0 |
| 深淵の獣バルドレイク＋テラ・フォーミング | incomplete | 1489 | 297 | link-development | 0 |
| 深淵の獣バルドレイク＋コード・オブ・ソウル | completeWithinNoDrawScope | 279 | 0 | link-development | 0 |
| 深淵の獣バルドレイク＋封印の黄金櫃 | incomplete | 1471 | 226 | link-development | 0 |
| 深淵の獣バルドレイク＋神の密告 | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣バルドレイク＋マルチャミー・プルリア | completeWithinNoDrawScope | 69 | 0 | no-board-development | 0 |
| 深淵の獣バルドレイク＋ディメンション・アトラクター | completeWithinNoDrawScope | 93 | 0 | no-board-development | 1 |
| 深淵の獣バルドレイク＋ドロール＆ロックバード | completeWithinNoDrawScope | 59 | 0 | normal-summon-only | 1 |
| 深淵の獣バルドレイク＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | set-or-spell-only | 0 |
| 深淵の獣バルドレイク＋M∀LICE＜P＞Cheshire Cat | incomplete | 1915 | 185 | link-development | 1 |
| テラ・フォーミング＋コード・オブ・ソウル | incomplete | 1644 | 475 | link-development | 0 |
| テラ・フォーミング＋封印の黄金櫃 | incomplete | 1346 | 841 | link-development | 0 |
| テラ・フォーミング＋神の密告 | incomplete | 1327 | 420 | link-development | 0 |
| テラ・フォーミング＋マルチャミー・プルリア | incomplete | 1244 | 526 | link-development | 0 |
| テラ・フォーミング＋ディメンション・アトラクター | incomplete | 1653 | 312 | link-development | 0 |
| テラ・フォーミング＋ドロール＆ロックバード | incomplete | 1340 | 520 | link-development | 0 |
| テラ・フォーミング＋M∀LICE＜C＞MTP－０７ | incomplete | 2358 | 399 | link-development | 0 |
| テラ・フォーミング＋M∀LICE＜P＞Cheshire Cat | incomplete | 1656 | 549 | link-development | 0 |
| コード・オブ・ソウル＋封印の黄金櫃 | incomplete | 2739 | 209 | link-development | 0 |
| コード・オブ・ソウル＋神の密告 | incomplete | 3034 | 50 | link-development | 0 |
| コード・オブ・ソウル＋マルチャミー・プルリア | incomplete | 3625 | 76 | link-development | 0 |
| コード・オブ・ソウル＋ディメンション・アトラクター | completeWithinNoDrawScope | 2171 | 0 | link-development | 0 |
| コード・オブ・ソウル＋ドロール＆ロックバード | incomplete | 2766 | 117 | link-development | 0 |
| コード・オブ・ソウル＋M∀LICE＜C＞MTP－０７ | incomplete | 3331 | 48 | link-development | 0 |
| コード・オブ・ソウル＋M∀LICE＜P＞Cheshire Cat | incomplete | 1872 | 411 | link-development | 0 |
| 封印の黄金櫃＋神の密告 | incomplete | 2591 | 166 | link-development | 0 |
| 封印の黄金櫃＋マルチャミー・プルリア | incomplete | 3697 | 231 | link-development | 0 |
| 封印の黄金櫃＋ディメンション・アトラクター | incomplete | 1924 | 213 | link-development | 0 |
| 封印の黄金櫃＋ドロール＆ロックバード | incomplete | 3678 | 207 | link-development | 0 |
| 封印の黄金櫃＋M∀LICE＜C＞MTP－０７ | incomplete | 1853 | 173 | link-development | 1 |
| 封印の黄金櫃＋M∀LICE＜P＞Cheshire Cat | incomplete | 1957 | 309 | link-development | 0 |
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
| ディメンション・アトラクター＋M∀LICE＜P＞Cheshire Cat | incomplete | 3113 | 126 | link-development | 1 |
| ドロール＆ロックバード＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 750 | 0 | set-or-spell-only | 0 |
| ドロール＆ロックバード＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 152 | 0 | link-development | 0 |
| M∀LICE＜C＞MTP－０７＋M∀LICE＜P＞Cheshire Cat | incomplete | 1619 | 351 | link-development | 1 |
| M∀LICE＜P＞Cheshire Cat＋M∀LICE＜P＞Cheshire Cat | incomplete | 2950 | 146 | link-development | 1 |
