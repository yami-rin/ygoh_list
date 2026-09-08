# 2枚初動・担当5の実core探索

全333種類から index % 8 = 5 の **41組**（物理組合せ96通り）を担当。各手札の根から新規探索し、採録した44線を独立再生した。既知templateを当てはめた調査とは別の資料。

着手 41/41、無ドロー範囲終了 15/41、延べ訪問 16193、未解決prefix 4971、対象外の未知ドロー境界 406、過去の探索エラー 0。全ゲームパターンの完了は false。

手動発見線: **Cat＋マグナムート→WHITE BINDER＋HEARTS OF CRYPTER＋MTPセット、LP6200**。CatをDecoder素材にし、マグナムートでCatを除外して帰還、両者をBinder素材に使用。TB/Dormouse→S:P→Rabbitを経由する。59入力を実coreで独立再生。マグナムートのエンドフェイズサーチは停止点の後に残る。

**コード・マジシャン＋Hare→Binder＋Crypter＋Dot、手札Cat、LP5900** も80入力で独立再生。HareをDecoder素材、手札MagをWicked素材にし、Dot→WickedからHare回収とBackup検索。MTPでBinderを除外帰還してEXモンスターゾーンを空け、Crypterを出す。サイバース族の特殊召喚制約内で実行。

**Hare＋TB→Binder＋I:P＋MTPセット、LP6200** を68入力で独立再生。初手TBのコストでHareを除外してDormouseを呼び、Hareは自身を回収。Hareで墓地TBを除外して再展開し、Decoder/S:P→Dormouse/Rabbit、Binder/GWCを経由する。I:Pの相手ターン展開は停止点の後に残る。

visitedと終端数は応答履歴の計数であり、固有展開・最適解の数ではない。カード配置と同名個体を含み、監査済みのLink素材選択画面の無操作往復のみ縮約する。scoreは盤面の手動重みで、勝率や貫通率ではない。

「2枚が手札から出た」にはコストやセットも含む。手札残存数を追跡して記録し、2枚の組合せを用いた展開の実証と分ける。Link 1だけ・召喚だけ・セットだけも小展開として区別した。線の未採録を不成立証明とは扱わない。

未知ドローが発生した最初の応答まで保存し、以後の応答は実行・評価しない。相手盤面・妨害なし、初手2枚だけの条件。実5枚手札、後攻、相手への対応、未知ドロー後、全木の最適性は対象外。

| index | 2枚組 | 状態 | 訪問 | 残prefix | draw境界 | 採録線 |
|---:|---|---|---:|---:|---:|---|
| 5 | サイバース・コード・マジシャン＋M∀LICE＜P＞March Hare | incomplete | 253 | 236 | 0 | link_2_or_higher / both_initial_cards_used_in_combo |
| 13 | サイバース・コード・マジシャン＋M∀LICE IN UNDERGROUND | incomplete | 263 | 281 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 21 | サイバース・コード・マジシャン＋ディメンション・アトラクター | completeWithinNoDrawScope | 12 | 0 | 0 | no_board / initial_hand_retained |
| 29 | 闇の誘惑＋M∀LICE＜P＞March Hare | incomplete | 902 | 37 | 255 | link_1_only / one_initial_card_left_hand |
| 37 | 闇の誘惑＋M∀LICE IN UNDERGROUND | incomplete | 345 | 197 | 88 | link_2_or_higher / both_initial_cards_left_hand |
| 45 | 闇の誘惑＋ディメンション・アトラクター | completeWithinNoDrawScope | 165 | 0 | 60 | no_board / initial_hand_retained |
| 53 | ウィザード＠イグニスター＋増殖するG | completeWithinNoDrawScope | 789 | 0 | 0 | link_1_only / one_initial_card_left_hand |
| 61 | ウィザード＠イグニスター＋M∀LICE＜P＞White Rabbit | incomplete | 299 | 341 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 69 | ウィザード＠イグニスター＋ドロール＆ロックバード | completeWithinNoDrawScope | 151 | 0 | 0 | link_1_only / one_initial_card_left_hand |
| 77 | 灰流うらら＋バックアップ＠イグニスター | incomplete | 295 | 208 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 85 | 灰流うらら＋深淵の獣バルドレイク | completeWithinNoDrawScope | 59 | 0 | 0 | single_monster / one_initial_card_left_hand |
| 93 | 灰流うらら＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 752 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 101 | ドットスケーパー＋霊王の波動 | incomplete | 349 | 93 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 109 | ドットスケーパー＋封印の黄金櫃 | incomplete | 340 | 185 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 117 | M∀LICE＜C＞GWC－０６＋増殖するG | completeWithinNoDrawScope | 830 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 125 | M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞White Rabbit | incomplete | 309 | 176 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 133 | M∀LICE＜C＞GWC－０６＋ドロール＆ロックバード | completeWithinNoDrawScope | 752 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 141 | M∀LICE＜P＞March Hare＋M∀LICE＜C＞TB－１１ | incomplete | 367 | 98 | 0 | link_2_or_higher / both_initial_cards_used_in_combo |
| 149 | M∀LICE＜P＞March Hare＋神の密告 | incomplete | 895 | 26 | 0 | link_1_only / both_initial_cards_left_hand |
| 157 | 増殖するG＋深淵の獣マグナムート | completeWithinNoDrawScope | 69 | 0 | 0 | no_board / initial_hand_retained |
| 165 | 増殖するG＋コード・オブ・ソウル | incomplete | 371 | 53 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 173 | バックアップ＠イグニスター＋バックアップ＠イグニスター | incomplete | 270 | 235 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 181 | バックアップ＠イグニスター＋深淵の獣バルドレイク | incomplete | 264 | 240 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 189 | バックアップ＠イグニスター＋M∀LICE＜C＞MTP－０７ | incomplete | 326 | 179 | 0 | link_1_only / both_initial_cards_left_hand |
| 197 | M∀LICE＜P＞Dormouse＋深淵の獣バルドレイク | incomplete | 296 | 104 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 205 | M∀LICE＜P＞Dormouse＋M∀LICE＜C＞MTP－０７ | incomplete | 334 | 146 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 213 | 深淵の獣マグナムート＋テラ・フォーミング | incomplete | 280 | 831 | 0 | no_board / one_initial_card_left_hand |
| 221 | 深淵の獣マグナムート＋M∀LICE＜P＞Cheshire Cat | incomplete | 280 | 112 | 0 | link_2_or_higher / both_initial_cards_used_in_combo |
| 229 | 霊王の波動＋コード・オブ・ソウル | incomplete | 839 | 45 | 0 | link_1_only / both_initial_cards_left_hand |
| 237 | M∀LICE＜C＞TB－１１＋幽鬼うさぎ | completeWithinNoDrawScope | 753 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 245 | M∀LICE＜C＞TB－１１＋マルチャミー・プルリア | completeWithinNoDrawScope | 793 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 253 | 幽鬼うさぎ＋深淵の獣バルドレイク | incomplete | 304 | 41 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 261 | 幽鬼うさぎ＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 751 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 269 | M∀LICE IN UNDERGROUND＋神の密告 | incomplete | 322 | 198 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 277 | M∀LICE＜P＞White Rabbit＋テラ・フォーミング | incomplete | 271 | 349 | 0 | link_2_or_higher / both_initial_cards_left_hand |
| 285 | M∀LICE＜P＞White Rabbit＋M∀LICE＜P＞Cheshire Cat | incomplete | 308 | 266 | 2 | link_2_or_higher / one_initial_card_left_hand |
| 293 | 深淵の獣バルドレイク＋M∀LICE＜C＞MTP－０７ | completeWithinNoDrawScope | 13 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 301 | テラ・フォーミング＋M∀LICE＜C＞MTP－０７ | incomplete | 352 | 129 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 309 | コード・オブ・ソウル＋M∀LICE＜P＞Cheshire Cat | incomplete | 341 | 165 | 1 | link_2_or_higher / both_initial_cards_left_hand |
| 317 | 神の密告＋ディメンション・アトラクター | completeWithinNoDrawScope | 91 | 0 | 0 | spell_or_set_only / one_initial_card_left_hand |
| 325 | マルチャミー・プルリア＋M∀LICE＜P＞Cheshire Cat | completeWithinNoDrawScope | 438 | 0 | 0 | link_1_only / one_initial_card_left_hand |

再開と検証:

```powershell
node scripts/research-pair-shard-5.mjs --search --nodes 200 --ms 3000 --depth 160 --passes 1
node scripts/research-pair-shard-5.mjs --finish-small
node scripts/research-pair-shard-5.mjs --aggregate
node scripts/research-pair-shard-5.mjs --verify
```

`--finish-small` は未解決prefix40件以下の組だけ各5000node/10秒を配分し、全41組の集約を更新する。

根探索checkpointは `runtime/multi-pair-search/shard-5/`、手動線とinventoryは `runtime/multi-pairs/shard-5/`。集約JSONには各checkpointのSHA-256と残件理由、採録route全入力を保持する。
