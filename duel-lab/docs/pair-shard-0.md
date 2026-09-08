# 2枚展開研究 shard 0

固定40枚から作れる全333の2枚multisetのうち、enumeratePairsのindex % 8 === 0となる42組を担当する。物理的な組合せの重みは合計94。追加ドロー後の未知内容は探索対象に含めない。

初期合法候補42組と、新規の具体的手順15本を実コアで検証・独立再生した。既存templateの適用結果と、今回の新規手順を分けて保存する。

合法木探索は42組中42組を実行し、無ドロー対象範囲で完了9組、未完了33組、未探索0組。訪問16505、終端経路4743、未解決frontier 5533、ドロー後を除外した境界396。

既存surveyの「未対応」も、不成立の証明として扱わない。探索器はtemplateを適用せず各手札の初期状態から合法候補を列挙する。追加ドローがコアの1応答中に解決される場合、その時点で枝を除外し、結果盤面の採点・保存・後続探索をしない。

## 新規の具体的な展開

| 手順 | 初期手札 | 最終盤面 | 手札 | LP | 入力 |
| --- | --- | --- | --- | ---: | ---: |
| pair-shard-0-mag-dorm-crypter-binder-ip-gwc | サイバース・コード・マジシャン＋M∀LICE＜P＞Dormouse | M∀LICE＜Q＞HEARTS OF CRYPTER＋M∀LICE＜Q＞WHITE BINDER＋I：Pマスカレーナ、セット M∀LICE＜C＞GWC－０６ | 0枚 | 6200 | 73 |
| pair-shard-0-wizard-soul-sp | ウィザード＠イグニスター＋コード・オブ・ソウル | S：Pリトルナイト | 0枚 | 8000 | 13 |
| pair-shard-0-wizard-soul-ring-decoder | ウィザード＠イグニスター＋コード・オブ・ソウル | リングリボー＋リンク・デコーダー | 0枚 | 8000 | 11 |
| pair-shard-0-wizard-magna-sp | ウィザード＠イグニスター＋深淵の獣マグナムート | S：Pリトルナイト | 0枚 | 8000 | 15 |
| pair-shard-0-backup-impulse-accord | バックアップ＠イグニスター＋霊王の波動 | アコード・トーカー＠イグニスター＋トランスコード・トーカー | 0枚 | 8000 | 39 |
| pair-shard-0-hare-rabbit-ip | M∀LICE＜P＞March Hare＋M∀LICE＜P＞White Rabbit | I：Pマスカレーナ＋M∀LICE＜Q＞WHITE BINDER | M∀LICE＜P＞White Rabbit | 6200 | 71 |
| pair-shard-0-hare-rabbit-accord | M∀LICE＜P＞March Hare＋M∀LICE＜P＞White Rabbit | アコード・トーカー＠イグニスター＋M∀LICE＜Q＞WHITE BINDER | M∀LICE＜P＞White Rabbit | 6200 | 75 |
| pair-shard-0-gold-dorm-crypter-binder-ring | M∀LICE＜P＞Dormouse＋封印の黄金櫃 | M∀LICE＜Q＞HEARTS OF CRYPTER＋M∀LICE＜Q＞WHITE BINDER＋リングリボー | M∀LICE＜P＞White Rabbit | 5900 | 89 |
| pair-shard-0-underground-dot-crypter-binder-ring | ドットスケーパー＋M∀LICE IN UNDERGROUND | M∀LICE＜Q＞HEARTS OF CRYPTER＋M∀LICE＜Q＞WHITE BINDER＋リングリボー、セット M∀LICE IN UNDERGROUND | M∀LICE＜P＞White Rabbit | 5900 | 81 |
| pair-shard-0-shifter-cat-ring-decoder | ディメンション・アトラクター＋M∀LICE＜P＞Cheshire Cat | リングリボー＋リンク・デコーダー | 0枚 | 7700 | 12 |
| pair-shard-0-shifter-dot-sp | ドットスケーパー＋ディメンション・アトラクター | S：Pリトルナイト | 0枚 | 8000 | 14 |
| pair-shard-0-mag-allure-no-draw-set | サイバース・コード・マジシャン＋闇の誘惑 | 、セット 闇の誘惑 | サイバース・コード・マジシャン | 8000 | 2 |
| pair-shard-0-ash-ash-almiraj | 灰流うらら＋灰流うらら | 転生炎獣アルミラージ | 灰流うらら | 8000 | 5 |
| pair-shard-0-maxx-ogre-almiraj | 増殖するG＋幽鬼うさぎ | 転生炎獣アルミラージ | 増殖するG | 8000 | 9 |
| pair-shard-0-maxx-purulia-almiraj | 増殖するG＋マルチャミー・プルリア | 転生炎獣アルミラージ | 増殖するG | 8000 | 9 |

Mag＋Dormouseは、初手Magがあるため既存のDormouse単独手順で「Magをデッキから検索する」箇所がそのまま適用できなかった組合せ。初手Magを手札リンク素材として使い、BackupではRabbitを検索して捨てる新しい順序を実証した。

Hare＋Rabbitでは初手Hareを特殊召喚し、MTPで追加Rabbitを検索して後続として残す。Wizard＋Soul、Wizard＋Magnaは両方を使う小展開であり、M∀LICEの本線へのアクセスとは分類していない。

Shifterを使う2本は、開始時のチェーン窓で発動する。CatまたはDotがリンク素材として除外へ行き、除外帰還効果が動くことと、最終墓地がShifterのみであることをassertした。相手ターンの追加処理は記録外。

## 担当する全42組

| index | 2枚組 | 旧template | 新規手順 | 訪問 | 未解決 | 探索状態 |
| ---: | --- | --- | ---: | ---: | ---: | --- |
| 0 | サイバース・コード・マジシャン＋闇の誘惑 | unsupported | 1 | 24 | 0 | completeWithinNoDrawScope |
| 8 | サイバース・コード・マジシャン＋M∀LICE＜P＞Dormouse | unsupported | 1 | 370 | 236 | incomplete |
| 16 | サイバース・コード・マジシャン＋テラ・フォーミング | supported | 0 | 359 | 325 | incomplete |
| 24 | サイバース・コード・マジシャン＋M∀LICE＜P＞Cheshire Cat | supported | 0 | 348 | 233 | incomplete |
| 32 | 闇の誘惑＋M∀LICE＜P＞Dormouse | supported | 0 | 460 | 150 | incomplete |
| 40 | 闇の誘惑＋テラ・フォーミング | supported | 0 | 403 | 327 | incomplete |
| 48 | 闇の誘惑＋M∀LICE＜P＞Cheshire Cat | supported | 0 | 564 | 32 | incomplete |
| 56 | ウィザード＠イグニスター＋深淵の獣マグナムート | supported | 1 | 481 | 45 | incomplete |
| 64 | ウィザード＠イグニスター＋コード・オブ・ソウル | supported | 2 | 514 | 45 | incomplete |
| 72 | 灰流うらら＋灰流うらら | unsupported | 1 | 116 | 0 | completeWithinNoDrawScope |
| 80 | 灰流うらら＋霊王の波動 | supported | 0 | 550 | 19 | incomplete |
| 88 | 灰流うらら＋封印の黄金櫃 | supported | 0 | 491 | 128 | incomplete |
| 96 | ドットスケーパー＋M∀LICE＜P＞March Hare | supported | 0 | 490 | 56 | incomplete |
| 104 | ドットスケーパー＋M∀LICE IN UNDERGROUND | supported | 1 | 401 | 196 | incomplete |
| 112 | ドットスケーパー＋ディメンション・アトラクター | supported | 1 | 478 | 78 | incomplete |
| 120 | M∀LICE＜C＞GWC－０６＋深淵の獣マグナムート | supported | 0 | 13 | 0 | completeWithinNoDrawScope |
| 128 | M∀LICE＜C＞GWC－０６＋コード・オブ・ソウル | supported | 0 | 564 | 34 | incomplete |
| 136 | M∀LICE＜P＞March Hare＋増殖するG | supported | 0 | 562 | 21 | incomplete |
| 144 | M∀LICE＜P＞March Hare＋M∀LICE＜P＞White Rabbit | supported | 2 | 378 | 402 | incomplete |
| 152 | M∀LICE＜P＞March Hare＋ドロール＆ロックバード | supported | 0 | 186 | 0 | completeWithinNoDrawScope |
| 160 | 増殖するG＋幽鬼うさぎ | unsupported | 1 | 508 | 0 | completeWithinNoDrawScope |
| 168 | 増殖するG＋マルチャミー・プルリア | unsupported | 1 | 555 | 19 | incomplete |
| 176 | バックアップ＠イグニスター＋霊王の波動 | supported | 1 | 492 | 182 | incomplete |
| 184 | バックアップ＠イグニスター＋封印の黄金櫃 | supported | 0 | 487 | 176 | incomplete |
| 192 | M∀LICE＜P＞Dormouse＋霊王の波動 | supported | 0 | 451 | 135 | incomplete |
| 200 | M∀LICE＜P＞Dormouse＋封印の黄金櫃 | supported | 1 | 496 | 202 | incomplete |
| 208 | 深淵の獣マグナムート＋M∀LICE＜C＞TB－１１ | supported | 0 | 13 | 0 | completeWithinNoDrawScope |
| 216 | 深淵の獣マグナムート＋神の密告 | supported | 0 | 13 | 0 | completeWithinNoDrawScope |
| 224 | 霊王の波動＋幽鬼うさぎ | supported | 0 | 571 | 24 | incomplete |
| 232 | 霊王の波動＋マルチャミー・プルリア | supported | 0 | 553 | 18 | incomplete |
| 240 | M∀LICE＜C＞TB－１１＋深淵の獣バルドレイク | supported | 0 | 13 | 0 | completeWithinNoDrawScope |
| 248 | M∀LICE＜C＞TB－１１＋M∀LICE＜C＞MTP－０７ | supported | 0 | 114 | 0 | completeWithinNoDrawScope |
| 256 | 幽鬼うさぎ＋封印の黄金櫃 | supported | 0 | 498 | 124 | incomplete |
| 264 | M∀LICE IN UNDERGROUND＋M∀LICE＜P＞White Rabbit | supported | 0 | 381 | 327 | incomplete |
| 272 | M∀LICE IN UNDERGROUND＋ドロール＆ロックバード | supported | 0 | 386 | 284 | incomplete |
| 280 | M∀LICE＜P＞White Rabbit＋神の密告 | supported | 0 | 425 | 316 | incomplete |
| 288 | 深淵の獣バルドレイク＋封印の黄金櫃 | supported | 0 | 428 | 772 | incomplete |
| 296 | テラ・フォーミング＋封印の黄金櫃 | supported | 0 | 381 | 422 | incomplete |
| 304 | コード・オブ・ソウル＋神の密告 | supported | 0 | 548 | 30 | incomplete |
| 312 | 封印の黄金櫃＋ディメンション・アトラクター | supported | 0 | 514 | 82 | incomplete |
| 320 | 神の密告＋M∀LICE＜P＞Cheshire Cat | supported | 0 | 510 | 24 | incomplete |
| 328 | ディメンション・アトラクター＋M∀LICE＜P＞Cheshire Cat | supported | 1 | 416 | 69 | incomplete |

## 残枝と次の再開候補

未解決の理由: maxMs 3950、maxNodes 1571、maxDepth 12。初回は1組100node/3000ms、次の2巡は各300node/5000ms、深さ上限100。残枝数が少ないことは残り計算量が少ない保証にはならない。

| index | 2枚組 | 未解決frontier | 訪問済み |
| ---: | --- | ---: | ---: |
| 232 | 霊王の波動＋マルチャミー・プルリア | 18 | 553 |
| 80 | 灰流うらら＋霊王の波動 | 19 | 550 |
| 168 | 増殖するG＋マルチャミー・プルリア | 19 | 555 |
| 136 | M∀LICE＜P＞March Hare＋増殖するG | 21 | 562 |
| 224 | 霊王の波動＋幽鬼うさぎ | 24 | 571 |
| 320 | 神の密告＋M∀LICE＜P＞Cheshire Cat | 24 | 510 |
| 304 | コード・オブ・ソウル＋神の密告 | 30 | 548 |
| 48 | 闇の誘惑＋M∀LICE＜P＞Cheshire Cat | 32 | 564 |
| 128 | M∀LICE＜C＞GWC－０６＋コード・オブ・ソウル | 34 | 564 |
| 56 | ウィザード＠イグニスター＋深淵の獣マグナムート | 45 | 481 |

## 検証と制約

`node scripts/research-pair-shard-0.mjs` で全手順と42組の初期候補を再生成・独立再生する。`--only=mag-dorm` などで絞った場合は保存JSONと資料を上書きしない。

各手順に2枚のhand、実コア入力、直前状態ハッシュ、最終盤面、LP、手札、finalHashを保存。手札はpresetから実際に除く。各入力でコアの拒否がないこと、追加ドローなし、メイン40枚の保存を検査し、新規コアで同じ入力を再生する。

Accordの蘇生体数を無効回数と数えない。I:P等の相手ターン展開、他の手札3枚が加わった実戦への自動入力適用、対妨害分岐、最善性は本手順の単独検証範囲外。

探索の再開は `node scripts/search-multi-pairs.mjs --shard 0 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1`。旧source版の途中証拠はruntime/multi-pairs/shard-0に分離保存し、再利用しない。追跡JSONには現行summary・best-routes・各checkpointのSHA-256を保存する。
