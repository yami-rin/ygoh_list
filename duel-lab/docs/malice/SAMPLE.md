# 実戦の5枚手札（自動生成）

`scripts/malice-sample.mjs` がユーザーのデッキから無作為に5枚を40回配り（固定seed）、手札の札で始まる保存ルートのうち評価器の点が最も高いものを案内に最善を探した結果（誘発なし120秒、誘発あり90秒）。
「相手うらら／泡影」は相手がその1枚を持ち、最初に撃てる機会に撃つ。点は静的見積もり（自分の手札誘発も含む）。

| 点 | 誘発なし（40手札） | 相手うらら（40手札） | 相手泡影（40手札） | 相手ニビル（40手札） | 相手霊王（34手札） |
| --- | --- | --- | --- | --- | --- |
| 4.5点以上 | 17（43%） | 6（15%） | 8（20%） | 2（5%） | 2（6%） |
| 3.5〜4.5 | 17（43%） | 16（40%） | 14（35%） | 12（30%） | 15（44%） |
| 2.5〜3.5 | 5（13%） | 11（28%） | 16（40%） | 23（57%） | 14（41%） |
| 1.5〜2.5 | 1（3%） | 7（18%） | 1（3%） | 2（5%） | 1（3%） |
| 1.5未満 | 0（0%） | 0（0%） | 1（3%） | 1（3%） | 2（6%） |
| ネオテン到達 | 36（90%） | 27（68%） | 27（68%） | 24（60%） | 21（62%） |
| アコードも | 22（55%） | 18（45%） | 17（43%） | 11（28%） | 15（44%） |
| 平均点 | 4.18 | 3.53 | 3.66 | 3.25 | 3.41 |

| # | 手札 | 案内 | 誘発なし | 相手うらら | 相手泡影 | 相手ニビル | 相手霊王 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 37 | ウィザード＠イグニスター・無限泡影・M∀LICE＜C＞GWC－０６・墓穴の指名者・霊王の波動 | なし | 2.31 | 2.31 | 2.31 | 2.31 | - |
| 26 | サイバース・コード・マジシャン・闇の誘惑・ウィザード＠イグニスター・ディメンション・アトラクター・M∀LICE＜C＞MTP－０７ | なし | 2.61 | 2.31 | 2.61 | 1.31 | 1.11 |
| 16 | 闇の誘惑・深淵の獣ドルイドヴルム・無限泡影・灰流うらら・増殖するG | なし | 2.71 | 2.41 | 2.71 | 2.71 | 2.71 |
| 21 | 無限泡影・バックアップ＠イグニスター・深淵の獣マグナムート・M∀LICE＜C＞TB－１１・M∀LICE＜P＞White Rabbit | malice-open-69272449-30118811 | 3.31 | 2.81 | 2.61 | 3.31 | 3.31 |
| 17 | 霆王の閃光・無限泡影・灰流うらら・増殖するG・コード・オブ・ソウル | なし | 3.31 | 3.31 | 3.31 | 3.31 | 2.61 |
| 33 | サイバース・コード・マジシャン・バックアップ＠イグニスター・M∀LICE＜P＞White Rabbit・ドロール＆ロックバード・M∀LICE＜P＞Cheshire Cat | malice-ns-codemagician-plus | 3.41 | 3.41 | 3.41 | 2.51 | 3.41 |
| 24 | M∀LICE＜P＞March Hare・増殖するG・墓穴の指名者・バックアップ＠イグニスター・封印の黄金櫃 | malice-open-30118811-20938824 | 3.61 | 3.61 | 3.31 | 2.61 | 2.61 |
| 9 | 霆王の閃光・墓穴の指名者・M∀LICE＜C＞TB－１１・M∀LICE IN UNDERGROUND・ディメンション・アトラクター | user-replay-3tnYxZAt | 3.61 | 3.61 | 0.51 | 2.51 | 0.51 |
| 12 | ドットスケーパー・霊王の波動・封印の黄金櫃・M∀LICE＜P＞Cheshire Cat・M∀LICE＜P＞Cheshire Cat | malice-open-96676583-96676583 | 3.71 | 2.41 | 2.91 | 2.81 | 3.21 |
| 23 | 霆王の閃光・M∀LICE＜P＞March Hare・M∀LICE＜C＞TB－１１・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit | malice-open-69272449-68337209 | 3.81 | 2.51 | 3.31 | 3.31 | 4.11 |
| 1 | ウィザード＠イグニスター・無限泡影・M∀LICE＜P＞March Hare・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞Cheshire Cat | malice-cat-hare-plus-2 | 3.81 | 4.11 | 3.81 | 4.11 | 4.41 |
| 36 | M∀LICE＜C＞GWC－０６・バックアップ＠イグニスター・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞White Rabbit・ディメンション・アトラクター | malice-open-69272449-30118811 | 3.91 | 2.21 | 2.61 | 3.01 | - |
| 35 | M∀LICE＜P＞March Hare・バックアップ＠イグニスター・バックアップ＠イグニスター・M∀LICE＜P＞White Rabbit・ドロール＆ロックバード | malice-open-69272449-30118811 | 3.91 | 2.81 | 3.61 | 2.91 | - |
| 4 | M∀LICE＜P＞March Hare・増殖するG・霊王の波動・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞White Rabbit | malice-open-69272449-20938824 | 4.01 | 3.71 | 4.01 | 3.71 | 2.71 |
| 15 | 霆王の閃光・灰流うらら・M∀LICE＜P＞White Rabbit・ディメンション・アトラクター・ドロール＆ロックバード | malice-rabbit-plus | 4.01 | 2.41 | 3.31 | 2.11 | 2.41 |
| 39 | 灰流うらら・M∀LICE＜C＞GWC－０６・M∀LICE＜P＞March Hare・M∀LICE＜P＞White Rabbit・ドロール＆ロックバード | malice-open-69272449-20938824 | 4.01 | 2.91 | 4.01 | 3.41 | - |
| 8 | M∀LICE＜C＞TB－１１・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞White Rabbit・ディメンション・アトラクター | malice-open-69272449-68337209 | 4.11 | 2.01 | 3.91 | 2.81 | 3.31 |
| 11 | 墓穴の指名者・バックアップ＠イグニスター・バックアップ＠イグニスター・M∀LICE IN UNDERGROUND・M∀LICE＜C＞MTP－０７ | malice-open-68337209-30118811 | 4.11 | 4.11 | 3.31 | 2.81 | 3.11 |
| 22 | 深淵の獣ドルイドヴルム・バックアップ＠イグニスター・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit・M∀LICE＜C＞MTP－０７ | malice-open-69272449-68337209 | 4.11 | 2.81 | 3.61 | 2.81 | 2.81 |
| 29 | 深淵の獣ドルイドヴルム・バックアップ＠イグニスター・M∀LICE IN UNDERGROUND・ディメンション・アトラクター・M∀LICE＜P＞Cheshire Cat | malice-open-68337209-96676583 | 4.11 | 2.51 | 3.31 | 2.61 | 3.61 |
| 13 | ウィザード＠イグニスター・霆王の閃光・無限泡影・バックアップ＠イグニスター・ドロール＆ロックバード | malice-open-30118811 | 4.11 | 3.81 | 4.11 | 3.81 | 3.81 |
| 19 | ドットスケーパー・M∀LICE＜P＞March Hare・M∀LICE＜P＞Dormouse・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit | malice-dormouse-gwc-now | 4.41 | 4.41 | 4.41 | 3.81 | 4.41 |
| 0 | 灰流うらら・増殖するG・バックアップ＠イグニスター・霊王の波動・ドロール＆ロックバード | malice-open-30118811 | 4.41 | 4.11 | 2.71 | 2.71 | 2.71 |
| 25 | 増殖するG・M∀LICE＜P＞Dormouse・M∀LICE IN UNDERGROUND・M∀LICE＜P＞Cheshire Cat・M∀LICE＜P＞Cheshire Cat | malice-open-32061192-96676583-2 | 4.51 | 3.81 | 4.41 | 3.21 | 4.21 |
| 31 | 闇の誘惑・ウィザード＠イグニスター・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit・ドロール＆ロックバード | malice-open-69272449-68337209 | 4.51 | 4.41 | 4.51 | 3.11 | 3.41 |
| 6 | 闇の誘惑・無限泡影・無限泡影・ドットスケーパー・コード・オブ・ソウル | なし | 4.51 | 4.51 | 4.51 | 3.81 | 3.51 |
| 20 | ドットスケーパー・M∀LICE＜P＞March Hare・バックアップ＠イグニスター・霊王の波動・M∀LICE IN UNDERGROUND | malice-open-68337209-30118811 | 4.61 | 4.11 | 4.41 | 4.11 | 4.41 |
| 3 | サイバース・コード・マジシャン・M∀LICE＜P＞March Hare・バックアップ＠イグニスター・M∀LICE＜P＞Dormouse・コード・オブ・ソウル | malice-open-32061192-74652966 | 4.61 | 4.01 | 4.31 | 4.01 | 4.01 |
| 28 | ウィザード＠イグニスター・無限泡影・M∀LICE＜P＞March Hare・バックアップ＠イグニスター・深淵の獣マグナムート | malice-open-30118811-20938824 | 4.61 | 4.61 | 4.61 | 3.01 | 3.61 |
| 18 | 灰流うらら・増殖するG・M∀LICE IN UNDERGROUND・ドロール＆ロックバード・M∀LICE＜P＞Cheshire Cat | malice-open-68337209-96676583 | 4.71 | 4.71 | 4.71 | 4.41 | 4.11 |
| 34 | バックアップ＠イグニスター・霊王の波動・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞White Rabbit・コード・オブ・ソウル | malice-open-69272449-30118811 | 4.71 | 3.61 | 3.11 | 4.41 | - |
| 5 | 闇の誘惑・灰流うらら・M∀LICE＜P＞March Hare・増殖するG・M∀LICE＜P＞Cheshire Cat | malice-cat-hare-plus-2 | 4.71 | 4.71 | 4.41 | 3.51 | 4.41 |
| 38 | 灰流うらら・M∀LICE＜C＞GWC－０６・M∀LICE＜P＞March Hare・M∀LICE＜C＞MTP－０７・M∀LICE＜P＞Cheshire Cat | malice-cat-hare-plus-2 | 4.71 | 4.11 | 2.61 | 2.61 | - |
| 10 | 霆王の閃光・無限泡影・増殖するG・バックアップ＠イグニスター・M∀LICE＜P＞Dormouse | malice-dormouse-gwc-now | 4.81 | 4.81 | 3.31 | 2.91 | 2.81 |
| 32 | 霆王の閃光・霊王の波動・M∀LICE IN UNDERGROUND・M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit | malice-open-69272449-68337209 | 4.91 | 3.31 | 4.41 | 4.11 | 3.61 |
| 27 | M∀LICE＜P＞Dormouse・M∀LICE IN UNDERGROUND・ドロール＆ロックバード・ドロール＆ロックバード・M∀LICE＜P＞Cheshire Cat | malice-open-32061192-96676583-2 | 5.01 | 4.11 | 4.81 | 4.71 | 5.01 |
| 7 | 灰流うらら・増殖するG・M∀LICE＜P＞Dormouse・コード・オブ・ソウル・ドロール＆ロックバード | malice-open-32061192-74652966 | 5.11 | 5.11 | 3.71 | 3.71 | 3.71 |
| 14 | バックアップ＠イグニスター・深淵の獣マグナムート・M∀LICE IN UNDERGROUND・コード・オブ・ソウル・ドロール＆ロックバード | malice-open-68337209-74652966 | 5.11 | 3.11 | 4.81 | 3.41 | 3.11 |
| 30 | M∀LICE IN UNDERGROUND・M∀LICE＜P＞White Rabbit・M∀LICE＜P＞White Rabbit・コード・オブ・ソウル・ドロール＆ロックバード | malice-open-68337209-74652966 | 5.11 | 3.11 | 5.11 | 3.21 | 4.01 |
| 2 | M∀LICE＜P＞March Hare・バックアップ＠イグニスター・霊王の波動・M∀LICE IN UNDERGROUND・コード・オブ・ソウル | malice-open-68337209-74652966 | 5.61 | 4.31 | 4.81 | 4.61 | 5.11 |
