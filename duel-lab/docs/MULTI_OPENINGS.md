# 既知ルートの全2枚組適用検証

固定40枚から作れる合法な2枚multisetは333種類。333種類を検証し、284種類で既知ルートを適用、49種類は未対応。物理的な組合せの重みは合計780=C(40,2)。

これは**既知ルートの全pair適用検証**であり、各pairの全合法手順木の探索ではない。検証状態は完了。未対応を「その手札では展開できない」証明として扱わない。

読み込んだ無ドローtemplateは79件。bestOpeningの候補上限をInfinityにし、適合候補1273件をすべて実手札へ予備再生した。適用失敗は146件で、ルール上の不成立以外にアダプタの不一致も含み得る。今回の生成で0pairは同じsource版の保存結果を再利用した。

## 初期手札の使用

採用された最良既知ルートのうち、両方の初期カードが手札を離れた証拠あり 12件、1枚ルートで相方の残存を観測 261件、使用個体を完全には特定できないもの 11件。

requiredHandの枚数だけで分類しない。全入力前の手札最小枚数、手札を明示的に選んだ入力、終端の同名残存数/2を保存する。genericDiscardによる相方の手札コストも使用に含める。同名個体を追跡しないため、同名カードが残っただけでは未使用と断定しない。

## 評価と終端

scoreはopeningScoreの手動重み。盤面のカード、罠、手札、LP、入力数の小さなペナルティで比較しており、勝率や貫通率ではない。最良は今回適用できた既知候補の中だけの比較。停止点は先攻Main 1のルート完了地点であり、ターン終了ではない。

## 全pair

| 2枚組 | 物理重み | 適用 | 採用ルート | 入力 | score | 手札使用 |
| --- | ---: | --- | --- | ---: | ---: | --- |
| サイバース・コード・マジシャン + 闇の誘惑 | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + ウィザード＠イグニスター | 1 | 適用 | multi-mag-wizard-accord | 37 | 11.4630 | 両方使用の証拠 |
| サイバース・コード・マジシャン + 灰流うらら | 2 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + ドットスケーパー | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + M∀LICE＜C＞GWC－０６ | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + M∀LICE＜P＞March Hare | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + 増殖するG | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + バックアップ＠イグニスター | 3 | 適用 | multi-backup-mag-cat-accord | 75 | 17.3500 | 両方使用の証拠 |
| サイバース・コード・マジシャン + M∀LICE＜P＞Dormouse | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + 深淵の獣マグナムート | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + 幽鬼うさぎ | 3 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + 深淵の獣バルドレイク | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + テラ・フォーミング | 1 | 適用 | spell-73628505-rabbit-hare-accord | 64 | 15.0235 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + コード・オブ・ソウル | 1 | 適用 | multi-mag-soul-accord | 37 | 11.4630 | 両方使用の証拠 |
| サイバース・コード・マジシャン + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + ディメンション・アトラクター | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| サイバース・コード・マジシャン + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| サイバース・コード・マジシャン + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-mag-crypter-binder-ip-gwc | 73 | 20.3145 | 両方使用の証拠 |
| 闇の誘惑 + ウィザード＠イグニスター | 1 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 闇の誘惑 + 灰流うらら | 2 | 未対応 | — | — | — | — |
| 闇の誘惑 + ドットスケーパー | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜C＞GWC－０６ | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜P＞March Hare | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| 闇の誘惑 + 増殖するG | 1 | 未対応 | — | — | — | — |
| 闇の誘惑 + バックアップ＠イグニスター | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜P＞Dormouse | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| 闇の誘惑 + 深淵の獣マグナムート | 1 | 未対応 | — | — | — | — |
| 闇の誘惑 + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 闇の誘惑 + 幽鬼うさぎ | 3 | 未対応 | — | — | — | — |
| 闇の誘惑 + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| 闇の誘惑 + 深淵の獣バルドレイク | 1 | 未対応 | — | — | — | — |
| 闇の誘惑 + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| 闇の誘惑 + コード・オブ・ソウル | 1 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 闇の誘惑 + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 闇の誘惑 + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 闇の誘惑 + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| 闇の誘惑 + ディメンション・アトラクター | 1 | 未対応 | — | — | — | — |
| 闇の誘惑 + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| 闇の誘惑 + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 闇の誘惑 + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 灰流うらら | 2 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + ドットスケーパー | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜C＞GWC－０６ | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜P＞March Hare | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 増殖するG | 1 | 適用 | wizard-ring | 9 | 3.1910 | 1枚＋相方残存 |
| ウィザード＠イグニスター + バックアップ＠イグニスター | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜P＞Dormouse | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 深淵の獣マグナムート | 1 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 幽鬼うさぎ | 3 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 深淵の獣バルドレイク | 1 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| ウィザード＠イグニスター + コード・オブ・ソウル | 1 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| ウィザード＠イグニスター + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ウィザード＠イグニスター + マルチャミー・プルリア | 3 | 適用 | wizard-ring | 7 | 3.1930 | 1枚＋相方残存 |
| ウィザード＠イグニスター + ディメンション・アトラクター | 1 | 適用 | wizard-ring | 8 | 3.1920 | 1枚＋相方残存 |
| ウィザード＠イグニスター + ドロール＆ロックバード | 1 | 適用 | wizard-ring | 5 | 3.1950 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ウィザード＠イグニスター + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-wizard-crypter-binder | 43 | 10.3820 | 両方使用の証拠 |
| 灰流うらら + 灰流うらら | 1 | 未対応 | — | — | — | — |
| 灰流うらら + ドットスケーパー | 2 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| 灰流うらら + M∀LICE＜C＞GWC－０６ | 2 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 灰流うらら + M∀LICE＜P＞March Hare | 2 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| 灰流うらら + 増殖するG | 2 | 未対応 | — | — | — | — |
| 灰流うらら + バックアップ＠イグニスター | 6 | 適用 | backup-discard-accord | 40 | 11.4600 | 両方使用の証拠 |
| 灰流うらら + M∀LICE＜P＞Dormouse | 2 | 適用 | dorm-no-draw-firewall-accord | 107 | 20.9805 | 1枚＋相方残存 |
| 灰流うらら + 深淵の獣マグナムート | 2 | 未対応 | — | — | — | — |
| 灰流うらら + 霊王の波動 | 4 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 灰流うらら + M∀LICE＜C＞TB－１１ | 2 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 灰流うらら + 幽鬼うさぎ | 6 | 未対応 | — | — | — | — |
| 灰流うらら + M∀LICE IN UNDERGROUND | 6 | 適用 | spell-68337209-contract | 69 | 16.7560 | 1枚＋相方残存 |
| 灰流うらら + M∀LICE＜P＞White Rabbit | 6 | 適用 | rabbit-no-draw-accord | 64 | 15.0235 | 1枚＋相方残存 |
| 灰流うらら + 深淵の獣バルドレイク | 2 | 未対応 | — | — | — | — |
| 灰流うらら + テラ・フォーミング | 2 | 適用 | spell-73628505-contract | 73 | 16.7520 | 1枚＋相方残存 |
| 灰流うらら + コード・オブ・ソウル | 2 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 灰流うらら + 封印の黄金櫃 | 2 | 適用 | spell-75500286-rabbit-hare-accord | 64 | 15.0235 | 1枚＋相方残存 |
| 灰流うらら + 神の密告 | 2 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 灰流うらら + マルチャミー・プルリア | 6 | 未対応 | — | — | — | — |
| 灰流うらら + ディメンション・アトラクター | 2 | 未対応 | — | — | — | — |
| 灰流うらら + ドロール＆ロックバード | 2 | 未対応 | — | — | — | — |
| 灰流うらら + M∀LICE＜C＞MTP－０７ | 2 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 灰流うらら + M∀LICE＜P＞Cheshire Cat | 6 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜C＞GWC－０６ | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜P＞March Hare | 1 | 適用 | multi-dot-hare-no-malice-access | 13 | 6.1870 | 個体の使用未確定 |
| ドットスケーパー + 増殖するG | 1 | 適用 | dotscaper-sp | 19 | 6.1810 | 1枚＋相方残存 |
| ドットスケーパー + バックアップ＠イグニスター | 3 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜P＞Dormouse | 1 | 適用 | dorm-hare-first-accord | 64 | 15.1672 | 1枚＋相方残存 |
| ドットスケーパー + 深淵の獣マグナムート | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + 霊王の波動 | 2 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜C＞TB－１１ | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + 幽鬼うさぎ | 3 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| ドットスケーパー + 深淵の獣バルドレイク | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + テラ・フォーミング | 1 | 適用 | spell-73628505-rabbit-hare-accord | 64 | 15.0235 | 1枚＋相方残存 |
| ドットスケーパー + コード・オブ・ソウル | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| ドットスケーパー + 神の密告 | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + マルチャミー・プルリア | 3 | 適用 | dotscaper-sp | 15 | 6.1850 | 1枚＋相方残存 |
| ドットスケーパー + ディメンション・アトラクター | 1 | 適用 | dotscaper-sp | 17 | 6.1830 | 1枚＋相方残存 |
| ドットスケーパー + ドロール＆ロックバード | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜C＞MTP－０７ | 1 | 適用 | dotscaper-sp | 13 | 6.1870 | 1枚＋相方残存 |
| ドットスケーパー + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-dot-sp-only | 13 | 6.1870 | 個体の使用未確定 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜P＞March Hare | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 増殖するG | 1 | 適用 | spell-20726052-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + バックアップ＠イグニスター | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜P＞Dormouse | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 深淵の獣マグナムート | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 幽鬼うさぎ | 3 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 深淵の獣バルドレイク | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + コード・オブ・ソウル | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + 神の密告 | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + マルチャミー・プルリア | 3 | 適用 | spell-20726052-no-starter | 4 | 3.1960 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + ディメンション・アトラクター | 1 | 適用 | spell-20726052-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + ドロール＆ロックバード | 1 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞GWC－０６ + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-20726052-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 増殖するG | 1 | 適用 | hare-alone-24842059 | 9 | 3.1910 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + バックアップ＠イグニスター | 3 | 適用 | multi-backup-hare-accord | 41 | 12.1402 | 両方使用の証拠 |
| M∀LICE＜P＞March Hare + M∀LICE＜P＞Dormouse | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 深淵の獣マグナムート | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 幽鬼うさぎ | 3 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-dormouse-first-binder | 49 | 8.0948 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + M∀LICE＜P＞White Rabbit | 3 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 深淵の獣バルドレイク | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + テラ・フォーミング | 1 | 適用 | spell-73628505-dormouse-first-binder | 53 | 8.0907 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + コード・オブ・ソウル | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 封印の黄金櫃 | 1 | 適用 | spell-75500286-dormouse-first-binder | 49 | 8.0948 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + マルチャミー・プルリア | 3 | 適用 | hare-alone-24842059 | 7 | 3.1930 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + ディメンション・アトラクター | 1 | 適用 | hare-alone-24842059 | 8 | 3.1920 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + ドロール＆ロックバード | 1 | 適用 | hare-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞March Hare + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-hare-accord-binder | 44 | 15.0622 | 両方使用の証拠 |
| 増殖するG + バックアップ＠イグニスター | 3 | 適用 | backup-discard-accord | 42 | 11.4580 | 両方使用の証拠 |
| 増殖するG + M∀LICE＜P＞Dormouse | 1 | 適用 | dorm-no-draw-firewall-accord | 131 | 20.9565 | 1枚＋相方残存 |
| 増殖するG + 深淵の獣マグナムート | 1 | 未対応 | — | — | — | — |
| 増殖するG + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 増殖するG + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 増殖するG + 幽鬼うさぎ | 3 | 未対応 | — | — | — | — |
| 増殖するG + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 91 | 16.7340 | 1枚＋相方残存 |
| 増殖するG + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 83 | 15.0045 | 1枚＋相方残存 |
| 増殖するG + 深淵の獣バルドレイク | 1 | 未対応 | — | — | — | — |
| 増殖するG + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 96 | 16.7290 | 1枚＋相方残存 |
| 増殖するG + コード・オブ・ソウル | 1 | 適用 | code-of-soul-ring | 9 | 3.1910 | 1枚＋相方残存 |
| 増殖するG + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 82 | 15.0055 | 1枚＋相方残存 |
| 増殖するG + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 増殖するG + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| 増殖するG + ディメンション・アトラクター | 1 | 未対応 | — | — | — | — |
| 増殖するG + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| 増殖するG + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 増殖するG + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 9 | 3.1910 | 1枚＋相方残存 |
| バックアップ＠イグニスター + バックアップ＠イグニスター | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 個体の使用未確定 |
| バックアップ＠イグニスター + M∀LICE＜P＞Dormouse | 3 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 個体の使用未確定 |
| バックアップ＠イグニスター + 深淵の獣マグナムート | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + 霊王の波動 | 6 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + M∀LICE＜C＞TB－１１ | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + 幽鬼うさぎ | 9 | 適用 | backup-discard-accord | 40 | 11.4600 | 両方使用の証拠 |
| バックアップ＠イグニスター + M∀LICE IN UNDERGROUND | 9 | 適用 | spell-68337209-contract | 64 | 16.7610 | 個体の使用未確定 |
| バックアップ＠イグニスター + M∀LICE＜P＞White Rabbit | 9 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| バックアップ＠イグニスター + 深淵の獣バルドレイク | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + テラ・フォーミング | 3 | 適用 | spell-73628505-contract | 67 | 16.7580 | 個体の使用未確定 |
| バックアップ＠イグニスター + コード・オブ・ソウル | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + 封印の黄金櫃 | 3 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| バックアップ＠イグニスター + 神の密告 | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + マルチャミー・プルリア | 9 | 適用 | backup-alone-ring-decoder | 18 | 3.8820 | 1枚＋相方残存 |
| バックアップ＠イグニスター + ディメンション・アトラクター | 3 | 適用 | backup-discard-accord | 42 | 11.4580 | 両方使用の証拠 |
| バックアップ＠イグニスター + ドロール＆ロックバード | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + M∀LICE＜C＞MTP－０７ | 3 | 適用 | backup-alone-ring-decoder | 16 | 3.8840 | 1枚＋相方残存 |
| バックアップ＠イグニスター + M∀LICE＜P＞Cheshire Cat | 9 | 適用 | multi-backup-cat-accord | 75 | 17.3500 | 両方使用の証拠 |
| M∀LICE＜P＞Dormouse + 深淵の獣マグナムート | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + 霊王の波動 | 2 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + M∀LICE＜C＞TB－１１ | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + 幽鬼うさぎ | 3 | 適用 | dorm-no-draw-firewall-accord | 111 | 20.9765 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + M∀LICE IN UNDERGROUND | 3 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + M∀LICE＜P＞White Rabbit | 3 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 個体の使用未確定 |
| M∀LICE＜P＞Dormouse + 深淵の獣バルドレイク | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + テラ・フォーミング | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + コード・オブ・ソウル | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + 封印の黄金櫃 | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + 神の密告 | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + マルチャミー・プルリア | 3 | 適用 | dorm-no-draw-firewall-accord | 104 | 20.9835 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + ディメンション・アトラクター | 1 | 適用 | dorm-no-draw-firewall-accord | 109 | 20.9785 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + ドロール＆ロックバード | 1 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + M∀LICE＜C＞MTP－０７ | 1 | 適用 | dorm-hare-first-accord | 65 | 15.1662 | 1枚＋相方残存 |
| M∀LICE＜P＞Dormouse + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | dorm-no-draw-firewall-accord | 102 | 20.9855 | 1枚＋相方残存 |
| 深淵の獣マグナムート + 霊王の波動 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣マグナムート + M∀LICE＜C＞TB－１１ | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣マグナムート + 幽鬼うさぎ | 3 | 未対応 | — | — | — | — |
| 深淵の獣マグナムート + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| 深淵の獣マグナムート + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| 深淵の獣マグナムート + 深淵の獣バルドレイク | 1 | 未対応 | — | — | — | — |
| 深淵の獣マグナムート + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| 深淵の獣マグナムート + コード・オブ・ソウル | 1 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 深淵の獣マグナムート + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 深淵の獣マグナムート + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣マグナムート + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| 深淵の獣マグナムート + ディメンション・アトラクター | 1 | 未対応 | — | — | — | — |
| 深淵の獣マグナムート + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| 深淵の獣マグナムート + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣マグナムート + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| 霊王の波動 + 霊王の波動 | 1 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 個体の使用未確定 |
| 霊王の波動 + M∀LICE＜C＞TB－１１ | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + 幽鬼うさぎ | 6 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + M∀LICE IN UNDERGROUND | 6 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| 霊王の波動 + M∀LICE＜P＞White Rabbit | 6 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| 霊王の波動 + 深淵の獣バルドレイク | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + テラ・フォーミング | 2 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| 霊王の波動 + コード・オブ・ソウル | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + 封印の黄金櫃 | 2 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 霊王の波動 + 神の密告 | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + マルチャミー・プルリア | 6 | 適用 | spell-40366667-no-starter | 4 | 3.1960 | 1枚＋相方残存 |
| 霊王の波動 + ディメンション・アトラクター | 2 | 適用 | spell-40366667-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 霊王の波動 + ドロール＆ロックバード | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + M∀LICE＜C＞MTP－０７ | 2 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 霊王の波動 + M∀LICE＜P＞Cheshire Cat | 6 | 適用 | spell-40366667-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + 幽鬼うさぎ | 3 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + M∀LICE＜P＞White Rabbit | 3 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + 深淵の獣バルドレイク | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + コード・オブ・ソウル | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + 封印の黄金櫃 | 1 | 適用 | spell-75500286-binder | 40 | 8.1038 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + 神の密告 | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + マルチャミー・プルリア | 3 | 適用 | spell-57111661-no-starter | 4 | 3.1960 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + ディメンション・アトラクター | 1 | 適用 | spell-57111661-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + ドロール＆ロックバード | 1 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜C＞TB－１１ + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-57111661-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 幽鬼うさぎ + 幽鬼うさぎ | 3 | 未対応 | — | — | — | — |
| 幽鬼うさぎ + M∀LICE IN UNDERGROUND | 9 | 適用 | spell-68337209-contract | 71 | 16.7540 | 1枚＋相方残存 |
| 幽鬼うさぎ + M∀LICE＜P＞White Rabbit | 9 | 適用 | rabbit-no-draw-accord | 68 | 15.0195 | 1枚＋相方残存 |
| 幽鬼うさぎ + 深淵の獣バルドレイク | 3 | 未対応 | — | — | — | — |
| 幽鬼うさぎ + テラ・フォーミング | 3 | 適用 | spell-73628505-contract | 74 | 16.7510 | 1枚＋相方残存 |
| 幽鬼うさぎ + コード・オブ・ソウル | 3 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 幽鬼うさぎ + 封印の黄金櫃 | 3 | 適用 | spell-75500286-rabbit-hare-accord | 65 | 15.0225 | 1枚＋相方残存 |
| 幽鬼うさぎ + 神の密告 | 3 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 幽鬼うさぎ + マルチャミー・プルリア | 9 | 未対応 | — | — | — | — |
| 幽鬼うさぎ + ディメンション・アトラクター | 3 | 未対応 | — | — | — | — |
| 幽鬼うさぎ + ドロール＆ロックバード | 3 | 未対応 | — | — | — | — |
| 幽鬼うさぎ + M∀LICE＜C＞MTP－０７ | 3 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 幽鬼うさぎ + M∀LICE＜P＞Cheshire Cat | 9 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + M∀LICE IN UNDERGROUND | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 個体の使用未確定 |
| M∀LICE IN UNDERGROUND + M∀LICE＜P＞White Rabbit | 9 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + 深淵の獣バルドレイク | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + テラ・フォーミング | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + コード・オブ・ソウル | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + 封印の黄金櫃 | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + 神の密告 | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + マルチャミー・プルリア | 9 | 適用 | spell-68337209-contract | 66 | 16.7590 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + ディメンション・アトラクター | 3 | 適用 | spell-68337209-contract | 70 | 16.7550 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + ドロール＆ロックバード | 3 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + M∀LICE＜C＞MTP－０７ | 3 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE IN UNDERGROUND + M∀LICE＜P＞Cheshire Cat | 9 | 適用 | spell-68337209-contract | 64 | 16.7610 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + M∀LICE＜P＞White Rabbit | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 個体の使用未確定 |
| M∀LICE＜P＞White Rabbit + 深淵の獣バルドレイク | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + テラ・フォーミング | 3 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + コード・オブ・ソウル | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + 封印の黄金櫃 | 3 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + 神の密告 | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + マルチャミー・プルリア | 9 | 適用 | rabbit-no-draw-accord | 64 | 15.0235 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + ディメンション・アトラクター | 3 | 適用 | rabbit-no-draw-accord | 66 | 15.0215 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + ドロール＆ロックバード | 3 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + M∀LICE＜C＞MTP－０７ | 3 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞White Rabbit + M∀LICE＜P＞Cheshire Cat | 9 | 適用 | rabbit-no-draw-accord | 62 | 15.0255 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + テラ・フォーミング | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + コード・オブ・ソウル | 1 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| 深淵の獣バルドレイク + ディメンション・アトラクター | 1 | 未対応 | — | — | — | — |
| 深淵の獣バルドレイク + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| 深淵の獣バルドレイク + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 深淵の獣バルドレイク + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| テラ・フォーミング + コード・オブ・ソウル | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| テラ・フォーミング + 封印の黄金櫃 | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| テラ・フォーミング + 神の密告 | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| テラ・フォーミング + マルチャミー・プルリア | 3 | 適用 | spell-73628505-contract | 70 | 16.7550 | 1枚＋相方残存 |
| テラ・フォーミング + ディメンション・アトラクター | 1 | 適用 | spell-73628505-contract | 70 | 16.7550 | 1枚＋相方残存 |
| テラ・フォーミング + ドロール＆ロックバード | 1 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| テラ・フォーミング + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| テラ・フォーミング + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-73628505-contract | 67 | 16.7580 | 1枚＋相方残存 |
| コード・オブ・ソウル + 封印の黄金櫃 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| コード・オブ・ソウル + 神の密告 | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| コード・オブ・ソウル + マルチャミー・プルリア | 3 | 適用 | code-of-soul-ring | 7 | 3.1930 | 1枚＋相方残存 |
| コード・オブ・ソウル + ディメンション・アトラクター | 1 | 適用 | code-of-soul-ring | 8 | 3.1920 | 1枚＋相方残存 |
| コード・オブ・ソウル + ドロール＆ロックバード | 1 | 適用 | code-of-soul-ring | 5 | 3.1950 | 1枚＋相方残存 |
| コード・オブ・ソウル + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| コード・オブ・ソウル + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| 封印の黄金櫃 + 神の密告 | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 封印の黄金櫃 + マルチャミー・プルリア | 3 | 適用 | spell-75500286-rabbit-hare-accord | 65 | 15.0225 | 1枚＋相方残存 |
| 封印の黄金櫃 + ディメンション・アトラクター | 1 | 適用 | spell-75500286-rabbit-hare-accord | 64 | 15.0235 | 1枚＋相方残存 |
| 封印の黄金櫃 + ドロール＆ロックバード | 1 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 封印の黄金櫃 + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 封印の黄金櫃 + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-75500286-rabbit-hare-accord | 61 | 15.0265 | 1枚＋相方残存 |
| 神の密告 + マルチャミー・プルリア | 3 | 適用 | spell-78114463-no-starter | 4 | 3.1960 | 1枚＋相方残存 |
| 神の密告 + ディメンション・アトラクター | 1 | 適用 | spell-78114463-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| 神の密告 + ドロール＆ロックバード | 1 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 神の密告 + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| 神の密告 + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-78114463-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| マルチャミー・プルリア + マルチャミー・プルリア | 3 | 未対応 | — | — | — | — |
| マルチャミー・プルリア + ディメンション・アトラクター | 3 | 未対応 | — | — | — | — |
| マルチャミー・プルリア + ドロール＆ロックバード | 3 | 未対応 | — | — | — | — |
| マルチャミー・プルリア + M∀LICE＜C＞MTP－０７ | 3 | 適用 | spell-94722358-no-starter | 4 | 3.1960 | 1枚＋相方残存 |
| マルチャミー・プルリア + M∀LICE＜P＞Cheshire Cat | 9 | 適用 | cat-alone-24842059 | 7 | 3.1930 | 1枚＋相方残存 |
| ディメンション・アトラクター + ドロール＆ロックバード | 1 | 未対応 | — | — | — | — |
| ディメンション・アトラクター + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 5 | 3.1950 | 1枚＋相方残存 |
| ディメンション・アトラクター + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 8 | 3.1920 | 1枚＋相方残存 |
| ドロール＆ロックバード + M∀LICE＜C＞MTP－０７ | 1 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| ドロール＆ロックバード + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 1枚＋相方残存 |
| M∀LICE＜C＞MTP－０７ + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | spell-94722358-no-starter | 2 | 3.1980 | 1枚＋相方残存 |
| M∀LICE＜P＞Cheshire Cat + M∀LICE＜P＞Cheshire Cat | 3 | 適用 | cat-alone-24842059 | 5 | 3.1950 | 個体の使用未確定 |

## 再生成・検証

duel-labディレクトリで実行する。sourceやpolicy更新後は新しいNodeプロセスで生成する。

~~~powershell
node scripts/survey-multi-openings.mjs
node scripts/survey-multi-openings.mjs --verify
node --test tests/multi-opening-survey.test.mjs
~~~

全フレームはruntime/multi-openings配下。tracked JSONは採用ルート、requiredHand、score、入力数、終端、手札使用根拠、失敗候補を保存する。ドロー後の分岐は列挙しない。
