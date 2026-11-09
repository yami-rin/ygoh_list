# 検証済みの知見

エンジン（ocgcore＋EDOProスクリプト）で確かめたことだけを書く。根拠のスクリプト・テストを添える。仮説は [INVENTORY.md](INVENTORY.md) に置く。

## カードの処理

| # | 知見 | 根拠 |
| --- | --- | --- |
| F1 | M∀LICEモンスターの①③はカード名ごとに1ターン1度。旧メモの「Dormouse③・Cat③は制限なし」は誤り | 本文。`malice-search` の探索で同名③の2回目は選択肢に出ない |
| F2 | うららは UNDERGROUND の発動・Dormouse① に撃てない（デッキから除外は対象外）。撃てるのは TB－11・ウィキッド③・バックアップ②・ウィッチ①・コード・マジシャン②・MTP－07・WHITE BINDER③・ネオテン② | `tests/malice-lab.test.mjs`（当たり所の全列挙） |
| F3 | EDOProのうららはドローを含む効果にも撃てる（WHITE BINDER③は特殊召喚＋ドローごと無効、Cat①の2ドローも対象） | `c14558127.lua` の判定に CATEGORY_DRAW、当たり所の列挙で WHITE BINDER の窓あり |
| F4 | 屋敷わらしは UNDERGROUND の発動に撃てる（墓地から除外する選択肢を含むため）。他にドットスケーパー・デコーダー・トランスコード・ウィザード・MH①（墓地から除外する場合） | `runtime/malice/hits-73642296.json` |
| F5 | 霊王の波動はWR・Dormouse・Cat③（除外からの特殊召喚）、TB－11、デコーダー、トランスコード、バックアップ①、ウィザード①、WHITE BINDER③、アコード①に撃てる | `hits-40366667.json` |
| F6 | 封印の黄金櫃・UNDERGROUND でデッキから除外したM∀LICEは③をその場で使う。後でそのカードを罠のコストで除外しても③は使えない（1ターン1度） | 黄金櫃→Dormouseの手順で、TB－11のコストにしたDormouseが戻らない |
| F7 | WRがTB－11のコストで除外され、TB－11がうららで無効になっても、WRの③は解決して場に戻る | `tests/malice-lab.test.mjs` |
| F8 | 相手ターンにネオテン②でディセーブルムを先に墓地へ送ると、相手の次の魔法（テラ・フォーミング、UNDERGROUND）を無効にできる。探索順をディセーブルム優先にすると200手順以内で見つかる | `tests/interruption-eval.test.mjs` |

## 誘発を受けたとき（初動1枚＋代役3枚）

`docs/malice/HANDTRAPS.md`（自動生成）に表がある。要点：

- （集計中）
