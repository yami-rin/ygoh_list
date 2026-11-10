# M∀LICE マスター作業の資料

ユーザーのデッキ（`presets/user-malice.json`）をルールエンジンで検証しながら、回し方・誘発への受け・考え方をまとめたもの。2026-11-10 作業。

| 資料 | 内容 |
| --- | --- |
| [CAUSAL.md](CAUSAL.md) | **まずここ**：何を持っていたら手順のどこが変わり、盤面と相手ターンの妨害がどう変わるか（カードごと・誘発ごと・初動×2枚目。保存ルートの手順差分が根拠） |
| [INVENTORY.md](INVENTORY.md) | 棚卸し：全カードの役割、判定基準、計画（最初に作成） |
| [CHEATSHEET.md](CHEATSHEET.md) | 1ページの早見表（盤面の部品→手札の骨格と着地→2枚目で変わる所→誘発の止まる所と続き方→約束の理由） |
| [GUIDE.md](GUIDE.md) | 先攻展開の手順書（推奨ルート10本、番号付き、自動生成） |
| [THEORY.md](THEORY.md) | 考え方：目標盤面、誘発ごとの被害、2枚目の価値、展開順の原則 |
| [ROUTES.md](ROUTES.md) | 展開ルート：ユーザーのリプレイ、改善ルート、2枚初動カタログ |
| [FINDINGS.md](FINDINGS.md) | エンジンで確かめた裁定・知見（F1〜） |
| [HANDTRAPS.md](HANDTRAPS.md) | 自動生成：誘発ごとの当たり所と、撃たれた後の最善（代役版） |
| [EXTENDERS.md](EXTENDERS.md) | 自動生成：2枚目の手札があれば受けられるか |
| [BAIT.md](BAIT.md) | 自動生成：最初の機会に誘発を撃つ相手に、順番を組み替えた場合 |
| [CALIBRATION-user-mirror.md](CALIBRATION-user-mirror.md) / [CALIBRATION.md](CALIBRATION.md) | 自動生成：静的な点数と妨害評価器の対応（相手＝ユーザーのデッキ／旧ミラー） |
| [HANDTRAPS-SAVED.md](HANDTRAPS-SAVED.md) | 自動生成：改善・推奨ルートの誘発耐性 |
| [EXTENDERS-TOP.md](EXTENDERS-TOP.md) | 自動生成：推奨ルートに3枚目があるときの受け |
| [SAMPLE.md](SAMPLE.md) | 自動生成：実戦の5枚手札40通り（誘発なし・相手うらら・泡影・ニビル・霊王） |
| [QUESTIONS.md](QUESTIONS.md) | ユーザーへの確認事項 |
| [PROGRESS.md](PROGRESS.md) | 毎時の進捗 |

## 道具（`scripts/malice-*.mjs`、テスト `tests/malice-lab.test.mjs`）

| スクリプト | 役割 |
| --- | --- |
| `malice-lab` | 相手に手札誘発を持たせてリプレイを再生、名前で書いた手順を再生 |
| `malice-hits` | 誘発を撃てる窓の全列挙 |
| `malice-search` | 実エンジンで続きを探索し、終盤面を静的に採点（限定逸脱順・同一局面の統合・リンク関係で配置を区別） |
| `malice-respond` / `malice-batch` / `malice-extenders` | 誘発を受けた後の最善の一括探索（代役版・2枚目あり） |
| `malice-improve` / `malice-improve-saved` / `malice-catalog` | ユーザーの手順・保存ルートを案内にした改善探索、2枚初動のカタログ |
| `malice-bait` | 相手が最初の機会に誘発を撃つ前提で順番を組み替える探索 |
| `malice-diff` | 2本の保存ルートの手順と最終盤面を並べる（CAUSAL.mdの根拠） |
| `malice-route` / `malice-catalog-save` | 探索結果を再生可能な保存ルート（`routes/malice-routes.json`）にする |
| `malice-eval-routes` / `malice-calibrate` | 妨害評価器（`interruption-eval.mjs`、シナリオ malice-mirror / user-mirror）で相手ターンの妨害数を数える |
| `malice-report` / `malice-extender-table` / `malice-bait-table` / `malice-guide` | 自動生成の表・手順書を作る |
| `malice-opp-turn` | 評価器が相手ターンにどの妨害をどう使ったかを表示 |
| `malice-sample` / `malice-sample-table` | 実戦の5枚手札を無作為に配って最善を探し、分布を出す |
| `malice-deepen` / `malice-cell-extenders` / `malice-improve-hand` | 打ち切りマスの再探索、1マスを2枚目ごとに調べる、別ルートを案内に手札を探す |
| `malice-watch` | 長時間ジョブの見張り |

大きな中間結果は `runtime/malice/`（Git対象外）に置く。表はそこから再生成できる。
