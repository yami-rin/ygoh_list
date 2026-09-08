# 2枚組探索 shard 4

固定40枚の333種類の2枚組のうち、`enumeratePairs(preset.main)` の index % 8 = 4 である42組を担当する。各fixtureは初手2枚を実際にデッキから抜く。先攻・空盤面・無妨害で、追加ドローを使わない。

手動で指定した展開は18本、初期不成立probeは1本。全て本物のcoreで入力し、盤面・手札・LP・40枚の保存・ドロー未実行をassertした後、保存入力を独立したDuelで再実行した。全手順木の総当たり・最善性・貫通率は主張しない。

Mag＋うさぎ/プルリアは通常召喚した低攻撃力モンスターをAlmirajへ変換できるため、手札MagとWickedを作れる。従来テンプレート未対応でも不成立とは限らない。逆にAlmirajだけの6本は相方未使用の小展開であり、強い2枚初動として集計しない。

Rabbit＋BackupではBackupを通常召喚する。先に手札効果で特殊召喚すると①を使い切り、Wickedで検索した2枚目を同ターンに出せないため、掲載した手順とは別になる。Rabbit＋MTPのCrypterはMain1時点で攻撃力5600（Dormouseの加算を含む）だが、この数値は相手ターンまでの持続を別途検証したものではない。

任意ドローの辞退は表示名に依存せずraw descriptionを参照する。CatのStringid(id,2)は任意2ドローで、MTPのStringid(id,2)は任意フィールド除外。ローカルstrings表示とLuaの対応がずれるので、カード表示名だけで選択しない。

## 実証ルート

| ID | 分類 | 手札 | 到達盤面 | LP | 入力数 |
| --- | --- | --- | --- | ---: | ---: |
| pair-shard-4-mag-59438930-accord | two-card-line | サイバース・コード・マジシャン＋幽鬼うさぎ | アコード・トーカー＠イグニスター / トランスコード・トーカー | 8000 | 37 |
| pair-shard-4-mag-84192580-accord | two-card-line | サイバース・コード・マジシャン＋マルチャミー・プルリア | アコード・トーカー＠イグニスター / トランスコード・トーカー | 8000 | 39 |
| pair-shard-4-wizard-hare-crypter-binder | two-card-line | ウィザード＠イグニスター＋M∀LICE＜P＞March Hare | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER | 6800 | 44 |
| pair-shard-4-dot-magna-sp | limited-two-card-line | ドットスケーパー＋深淵の獣マグナムート | S：Pリトルナイト / 深淵の獣マグナムート | 8000 | 18 |
| pair-shard-4-rabbit-baldrake-crypter-binder | two-card-line | M∀LICE＜P＞White Rabbit＋深淵の獣バルドレイク | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER | 6200 | 64 |
| pair-shard-4-rabbit-mtp-crypter-binder | two-card-line | M∀LICE＜P＞White Rabbit＋M∀LICE＜C＞MTP－０７ | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER | 7600 | 84 |
| pair-shard-4-rabbit-backup-crypter-binder-cat-hare | two-card-line | M∀LICE＜P＞White Rabbit＋バックアップ＠イグニスター | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER / M∀LICE＜P＞Cheshire Cat / M∀LICE＜P＞March Hare | 6200 | 84 |
| pair-shard-4-rabbit-backup-crypter-binder-ip | two-card-line | M∀LICE＜P＞White Rabbit＋バックアップ＠イグニスター | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER / I：Pマスカレーナ | 6200 | 89 |
| pair-shard-4-dot-soul-accord-binder | two-card-line | ドットスケーパー＋コード・オブ・ソウル | アコード・トーカー＠イグニスター / M∀LICE＜Q＞WHITE BINDER | 6800 | 68 |
| pair-shard-4-dorm-rabbit-crypter-binder-ring | two-card-line | M∀LICE＜P＞Dormouse＋M∀LICE＜P＞White Rabbit | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER / リングリボー | 5900 | 82 |
| pair-shard-4-gold-hare-crypter-binder-hare | two-card-line | 封印の黄金櫃＋M∀LICE＜P＞March Hare | M∀LICE＜Q＞HEARTS OF CRYPTER / M∀LICE＜Q＞WHITE BINDER / M∀LICE＜P＞March Hare | 6200 | 77 |
| pair-shard-4-limited-59438930-1475311-almiraj | one-card-line-with-inactive-companion | 幽鬼うさぎ＋闇の誘惑 | 転生炎獣アルミラージ | 8000 | 5 |
| pair-shard-4-limited-84192580-1475311-almiraj | one-card-line-with-inactive-companion | マルチャミー・プルリア＋闇の誘惑 | 転生炎獣アルミラージ | 8000 | 7 |
| pair-shard-4-limited-14558127-23434538-almiraj | one-card-line-with-inactive-companion | 灰流うらら＋増殖するG | 転生炎獣アルミラージ | 8000 | 9 |
| pair-shard-4-limited-94145021-14558127-almiraj | one-card-line-with-inactive-companion | ドロール＆ロックバード＋灰流うらら | 転生炎獣アルミラージ | 8000 | 5 |
| pair-shard-4-limited-94145021-59438930-almiraj | one-card-line-with-inactive-companion | ドロール＆ロックバード＋幽鬼うさぎ | 転生炎獣アルミラージ | 8000 | 5 |
| pair-shard-4-limited-94145021-72656408-almiraj | one-card-line-with-inactive-companion | ドロール＆ロックバード＋深淵の獣バルドレイク | 転生炎獣アルミラージ | 8000 | 5 |
| pair-shard-4-cat-cat-sp-no-draw | limited-two-card-line | M∀LICE＜P＞Cheshire Cat＋M∀LICE＜P＞Cheshire Cat | S：Pリトルナイト | 7700 | 16 |

## 全担当組と探索状態

共有runnerの観測値: {"selected":42,"searched":42,"completeWithinNoDrawScope":9,"incomplete":33,"unsearched":0,"visited":10061,"terminalPaths":2822,"unresolved":3361,"excludedDraw":308,"exportedRoutes":41,"allGamePatternsComplete":false}。実探索のfrontier・ドロー境界・最良既知入力は runtime/multi-pair-search/shard-4/ に保存する。

| Index | 2枚組 | 既知テンプレート | 手動判定 | 実探索状態 |
| ---: | --- | --- | --- | --- |
| 4 | サイバース・コード・マジシャン＋M∀LICE＜C＞GWC－０６ | supported | not-hand-verified | completeWithinNoDrawScope |
| 12 | サイバース・コード・マジシャン＋幽鬼うさぎ | unsupported | verified-two-card-development | incomplete |
| 20 | サイバース・コード・マジシャン＋マルチャミー・プルリア | unsupported | verified-two-card-development | incomplete |
| 28 | 闇の誘惑＋M∀LICE＜C＞GWC－０６ | supported | not-hand-verified | completeWithinNoDrawScope |
| 36 | 闇の誘惑＋幽鬼うさぎ | unsupported | verified-limited-development | incomplete |
| 44 | 闇の誘惑＋マルチャミー・プルリア | unsupported | verified-limited-development | incomplete |
| 52 | ウィザード＠イグニスター＋M∀LICE＜P＞March Hare | supported | verified-two-card-development | incomplete |
| 60 | ウィザード＠イグニスター＋M∀LICE IN UNDERGROUND | supported | not-hand-verified | incomplete |
| 68 | ウィザード＠イグニスター＋ディメンション・アトラクター | supported | not-hand-verified | incomplete |
| 76 | 灰流うらら＋増殖するG | unsupported | verified-limited-development | incomplete |
| 84 | 灰流うらら＋M∀LICE＜P＞White Rabbit | supported | not-hand-verified | incomplete |
| 92 | 灰流うらら＋ドロール＆ロックバード | unsupported | verified-limited-development | completeWithinNoDrawScope |
| 100 | ドットスケーパー＋深淵の獣マグナムート | supported | verified-limited-development | incomplete |
| 108 | ドットスケーパー＋コード・オブ・ソウル | supported | verified-two-card-development | incomplete |
| 116 | M∀LICE＜C＞GWC－０６＋M∀LICE＜P＞March Hare | supported | not-hand-verified | incomplete |
| 124 | M∀LICE＜C＞GWC－０６＋M∀LICE IN UNDERGROUND | supported | not-hand-verified | incomplete |
| 132 | M∀LICE＜C＞GWC－０６＋ディメンション・アトラクター | supported | not-hand-verified | completeWithinNoDrawScope |
| 140 | M∀LICE＜P＞March Hare＋霊王の波動 | supported | not-hand-verified | incomplete |
| 148 | M∀LICE＜P＞March Hare＋封印の黄金櫃 | supported | verified-two-card-development | incomplete |
| 156 | 増殖するG＋M∀LICE＜P＞Dormouse | supported | not-hand-verified | incomplete |
| 164 | 増殖するG＋テラ・フォーミング | supported | not-hand-verified | incomplete |
| 172 | 増殖するG＋M∀LICE＜P＞Cheshire Cat | supported | not-hand-verified | incomplete |
| 180 | バックアップ＠イグニスター＋M∀LICE＜P＞White Rabbit | supported | verified-two-card-development | incomplete |
| 188 | バックアップ＠イグニスター＋ドロール＆ロックバード | supported | not-hand-verified | incomplete |
| 196 | M∀LICE＜P＞Dormouse＋M∀LICE＜P＞White Rabbit | supported | verified-two-card-development | incomplete |
| 204 | M∀LICE＜P＞Dormouse＋ドロール＆ロックバード | supported | not-hand-verified | incomplete |
| 212 | 深淵の獣マグナムート＋深淵の獣バルドレイク | unsupported | verified-initial-non-development | completeWithinNoDrawScope |
| 220 | 深淵の獣マグナムート＋M∀LICE＜C＞MTP－０７ | supported | not-hand-verified | completeWithinNoDrawScope |
| 228 | 霊王の波動＋テラ・フォーミング | supported | not-hand-verified | incomplete |
| 236 | 霊王の波動＋M∀LICE＜P＞Cheshire Cat | supported | not-hand-verified | incomplete |
| 244 | M∀LICE＜C＞TB－１１＋神の密告 | supported | not-hand-verified | completeWithinNoDrawScope |
| 252 | 幽鬼うさぎ＋M∀LICE＜P＞White Rabbit | supported | not-hand-verified | incomplete |
| 260 | 幽鬼うさぎ＋ドロール＆ロックバード | unsupported | verified-limited-development | completeWithinNoDrawScope |
| 268 | M∀LICE IN UNDERGROUND＋封印の黄金櫃 | supported | not-hand-verified | incomplete |
| 276 | M∀LICE＜P＞White Rabbit＋深淵の獣バルドレイク | supported | verified-two-card-development | incomplete |
| 284 | M∀LICE＜P＞White Rabbit＋M∀LICE＜C＞MTP－０７ | supported | verified-two-card-development | incomplete |
| 292 | 深淵の獣バルドレイク＋ドロール＆ロックバード | unsupported | verified-limited-development | completeWithinNoDrawScope |
| 300 | テラ・フォーミング＋ドロール＆ロックバード | supported | not-hand-verified | incomplete |
| 308 | コード・オブ・ソウル＋M∀LICE＜C＞MTP－０７ | supported | not-hand-verified | incomplete |
| 316 | 神の密告＋マルチャミー・プルリア | supported | not-hand-verified | incomplete |
| 324 | マルチャミー・プルリア＋M∀LICE＜C＞MTP－０７ | supported | not-hand-verified | incomplete |
| 332 | M∀LICE＜P＞Cheshire Cat＋M∀LICE＜P＞Cheshire Cat | supported | verified-limited-development | incomplete |

## 再生成

`node scripts/research-pair-shard-4.mjs` で全手動ルートを再検証しJSONとこの文書を更新する。`--only=IDの部分文字列` は限定検証であり保存ファイルを書き換えない。

`node scripts/search-multi-pairs.mjs --shard 4 --shards 8 --nodes-per-pair 100 --ms-per-pair 3000 --depth 100 --passes 1` が担当全組への探索スライス。既存checkpointとsourceHashが一致する場合だけresumeする。
