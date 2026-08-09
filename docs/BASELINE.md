# Phase 1 baseline

Phase 3以降の回帰判定用に、改善着手前の作業ツリーを実測した記録である。推測値は含めない。`UNMEASURED` は測定経路または再現fixtureがない項目を示す。

## 計測環境・統計規約

- 計測日時: 2026-08-09 21:49:18〜21:51:03 JST（全画面の最終採用run）
- OS: Microsoft Windows 11 Home 10.0.26200 build 26200
- CPU / RAM: AMD Ryzen 7 5700X 8-Core Processor / 31.9 GB
- Node.js / npm: v22.18.0 / 10.9.3
- Playwright / browser: Playwright 1.59.0 / Firefox 148.0.2 headless
- 配信: `express.static` によるlocalhost HTTP配信
- viewport: 1440x900（共通性能）。テーマ回帰は1440x900と375x812
- cold: sampleごとに新しいBrowserContext。各画面3回 x 2セット = 6 sample
- warm: セットごとに同じBrowserContextで1回事前訪問後、各画面3回 x 2セット = 6 sample
- 中央値/p95: nearest-rank。6 sampleのp95は最大値。表記は `中央値 / p95`、単位はms
- app-ready: 下表のselectorがvisibleになるまで。production認証が必要でmock seamがない画面は`UNMEASURED`
- long task: Firefox 148.0.2の`PerformanceObserver.supportedEntryTypes`に`longtask`がないため全画面`UNMEASURED`
- console/page error: `tests/helpers.mjs`で既知Workers CORSを除外。それ以外は失敗

再実行コマンド:

```powershell
npm.cmd ci
node tests/perf_all_pages.mjs --mode=cold --sets=2 --runs=3 --output="$env:TEMP\cm_phase1_cold.json"
node tests/perf_all_pages.mjs --mode=warm --sets=2 --runs=3 --output="$env:TEMP\cm_phase1_warm.json"
```

## 全9画面 navigation / app-ready

| 画面 | 条件/ready | DCL cold | DCL warm | load cold | load warm | app-ready cold | app-ready warm |
|---|---|---:|---:|---:|---:|---:|---:|
| index | `.portal-container` | 33 / 251 | 35 / 90 | 182 / 564 | 116 / 245 | 322 / 682 | 269 / 494 |
| card_list | local login後 `#main-app` | 263 / 428 | 232 / 326 | 266 / 431 | 234 / 329 | 1,362 / 1,597 | 1,282 / 1,334 |
| card_gallery | localtest、3,000枚cache、`#card-grid > *` | 250 / 409 | 188 / 395 | 277 / 410 | 202 / 397 | 816 / 1,193 | 567 / 818 |
| battle_records | `isLocalMode=true`、`#main-app` | 300 / 349 | 226 / 289 | 375 / 416 | 258 / 333 | 469 / 496 | 339 / 474 |
| card_shop | production Auth/Firestore | 358 / 426 | 287 / 389 | 358 / 427 | 288 / 390 | UNMEASURED | UNMEASURED |
| duel_simulator | `#boardRoot > *` | 114 / 151 | 86 / 138 | 114 / 152 | 86 / 139 | 301 / 2,860 | 323 / 367 |
| supply_manager | production Auth/Workers API | 224 / 1,811 | 200 / 253 | 234 / 1,824 | 212 / 256 | UNMEASURED | UNMEASURED |
| banlist_editor | `#tier-container .tier-row` | 93 / 412 | 116 / 168 | 94 / 413 | 116 / 171 | 287 / 566 | 376 / 552 |
| options | `#rarityList .rarity-item` | 181 / 284 | 157 / 250 | 201 / 297 | 164 / 265 | 332 / 442 | 416 / 481 |

app-readyのp95外れ値（duel cold 2,860ms、supply cold load 1,824ms）は除外していない。card_shop/supplyは認証後の実アプリ状態を安全に再現できないため、DOM loadのみ実測した。

## 主要render/search

| 画面/指標 | 条件 | sample数 | 中央値 | p95 |
|---|---|---:|---:|---:|
| card_list 100行 sort+render | 3,000枚import後warm、`changePage(1)` | 7 | 46.0ms | 52.0ms |
| card_list 3,000行 sort+render | `tableRowsPerPage=all` | 5 | 1,140.0ms | 1,225.0ms |
| card_list検索「うらら」 | inputから描画、300ms debounce込み | 5 | 833.7ms | 1,684.8ms |
| card_list検索「どらごん」 | inputから描画、300ms debounce込み | 5 | 976.9ms | 1,289.4ms |
| card_list検索「まじしゃん」 | inputから描画、300ms debounce込み | 5 | 603.3ms | 704.0ms |
| gallery `cardDetailsMap` ready cold | 未認証、新規Context | 5 | 2,076ms | 2,552ms |
| gallery `cardDetailsMap` ready warm | 同一Context事前訪問 | 5 | 730ms | 848ms |
| gallery initial grid | localtest、3,000枚、表示54枚 | 1 | UNMEASURED | UNMEASURED |
| gallery `changePage(1)` | localtest、3,000枚warm | 5 | 43.0ms | 47.0ms |
| gallery検索→grid更新 | localtest、3,000枚warm | 5 | 58.0ms | 101.0ms |
| banlist検索「青眼」cold | inputから2 animation frame | 6 | 24ms | 25ms |
| banlist検索「青眼」warm | 同上、事前訪問済みContext | 6 | 26ms | 44ms |
| その他画面の主要render/search | 安全なfixture/公開操作境界なし | 0 | UNMEASURED | UNMEASURED |

gallery initial gridは1回だけ3,557msを観測したが、3 sample未満なので中央値/p95には採用しない。card_list検索fixtureでは「うらら」の該当件数が0であり、他の検索語との単純比較には使わない。

## CSV本文・画像request

| 画面 | CSV本文GET cold | CSV本文GET warm | image request cold/warm | 備考 |
|---|---:|---:|---:|---|
| card_list | 1 / 1 | 0 / 0 | 0 / 0 | warmはHEADのみ、本文転送0 |
| card_gallery | 1 / 1 | 0 / 0 | 0 / 0 | warmはHEADのみ、本文転送0 |
| duel_simulator | 1 / 1 | 1 / 1 | 0 / 0 | warmでも独自CSV GET |
| banlist_editor | 1 / 1 | 1 / 1 | 0 / 0 | warmでも独自CSV GET |
| その他5画面 | 0 / 0 | 0 / 0 | 0 / 0 | CSV非使用 |

数値は `中央値 / p95`（request count）。画像はperformance fixtureが実在画像を要求しないため0件だった。production画像proxyのcache hit率、first image表示、scroll中request/long taskは再現できず`UNMEASURED`であり、0件を性能評価値として扱わない。

## 機能・テーマbaseline

着手前に以下は成功した。

- `verify_card_list.mjs`: local login、追加、通常/読み仮名/ミス検索、IndexedDB再訪、error 0
- `verify_sort.mjs`: 名前/レアリティ/枚数/型番sort、error 0
- `verify_search_bug.mjs`: 「トゥーン」「シャドール」の包含方向回帰なし
- `verify_gallery_master.mjs`: 14,237件、quoted comma対応、IndexedDB cache、error 0
- `verify_gallery_smoke.mjs`: gallery主要UI、light/dark/mobile、error 0
- card_list/galleryのlight/dark desktop/mobile画像を一時領域へ生成し目視

着手前から存在する既知失敗:

1. `verify_common_theme.mjs` は56件失敗。card_list/gallery以外の7画面（index、battle_records、card_shop、duel_simulator、supply_manager、banlist_editor、options）が`localStorage['theme']`を読み込まず、light/darkとも`html[data-bs-theme]`を設定・reload復元しない。各画面4条件 x 初回/reload = 8件。
2. gallery dark desktop画像ではカード名・補助文字のコントラストが低い。既存CSSの視覚課題で、Phase 2の未使用基盤では変更しない。
3. 全9画面・全4テーマ/viewport条件でdocument横overflowは0px。gallery mobileの上部タブは内部領域で右側項目が画面外になるが、document overflowではない。

## 未計測項目

- card_shop/supplyの認証後app-ready、主要render/search（production書込を避けるmock seamが未実装）
- index、battle、duel、optionsの実データ主要操作時間（再現fixtureまたは公開操作境界が未整備）
- 画像proxy cache hit率、first image、scroll時の同時requestとlong task
- FirefoxがLong Tasks API非対応のため、50ms超taskの回数・最大値
- Firestore/Workers本番応答時間

これらは値を推定せず、対応Phaseで安全なmock/fixtureが追加された時点から測定する。

## Phase 3 後

card_listを共通CSS/UIへ接続し、JavaScriptを責務別moduleへ分割した後の回帰判定結果。Phase 1と同じOS、Node.js、Playwright、Firefox headless、localhost配信、viewport、cold/warm定義、nearest-rank集計を使用した。

- 計測日時: 2026-08-09 22:30:00〜22:36:44 JST
- app-ready: `tests/perf_all_pages.mjs`、各画面3回 x 2セット = 6 sample
- render/search: `tests/perf_card_list.mjs`、3,000枚import後warm
- cold report: `%TEMP%\cm_phase3_cold.json`
- warm report: `%TEMP%\cm_phase3_warm.json`
- warm再現確認report: `%TEMP%\cm_phase3_warm_repeat.json`

再実行コマンド:

```powershell
node tests/perf_all_pages.mjs --mode=cold --sets=2 --runs=3 --output="$env:TEMP\cm_phase3_cold.json"
node tests/perf_all_pages.mjs --mode=warm --sets=2 --runs=3 --output="$env:TEMP\cm_phase3_warm.json"
node tests/perf_card_list.mjs . PHASE3
```

### card_list性能比較

判定には最初の規定runを使用した。許容上限は各Phase 1値の+10%。単位はms、値は`中央値 / p95`。

| 指標 | Phase 1 | Phase 3 後 | Phase 1比 | 許容上限 | 判定 |
|---|---:|---:|---:|---:|---|
| app-ready cold | 1,362 / 1,597 | 1,218 / 1,330 | -10.6% / -16.7% | 1,498.2 / 1,756.7 | PASS |
| app-ready warm | 1,282 / 1,334 | 1,176 / 1,438 | -8.3% / +7.8% | 1,410.2 / 1,467.4 | PASS |
| 100行 sort+render | 46.0 / 52.0 | 13.0 / 14.0 | -71.7% / -73.1% | 50.6 / 57.2 | PASS |
| 3,000行 sort+render | 1,140.0 / 1,225.0 | 270.0 / 279.0 | -76.3% / -77.2% | 1,254.0 / 1,347.5 | PASS |
| 検索「うらら」 | 833.7 / 1,684.8 | 583.5 / 855.6 | -30.0% / -49.2% | 917.1 / 1,853.3 | PASS |
| 検索「どらごん」 | 976.9 / 1,289.4 | 601.3 / 612.3 | -38.5% / -52.5% | 1,074.6 / 1,418.3 | PASS |
| 検索「まじしゃん」 | 603.3 / 704.0 | 541.7 / 596.2 | -10.2% / -15.3% | 663.6 / 774.4 | PASS |

warm app-readyの規定runはsample `[1176, 1300, 1438, 1251, 1111, 1169]` で、最大値を採るp95だけがPhase 1比+7.8%だった。原因切り分けの同条件再実測では`1,085 / 1,138`、sample `[1138, 1067, 1133, 1060, 1104, 1085]` となり、1,438msの単発tailは再現しなかった。console/page error、CSV request数、機能testに異常はなく、規定run自体も+10%以内のため回帰なしと判定した。

`perf_card_list.mjs`のPhase 3 sample:

- 100行: `[14.0, 8.0, 13.0, 13.0, 13.0, 12.0, 14.0]`
- 3,000行: `[120.0, 264.0, 279.0, 275.0, 270.0]`
- うらら: `[855.6, 583.5, 593.7, 552.8, 564.8]`、hits=0
- どらごん: `[601.3, 612.3, 601.4, 570.4, 594.9]`、hits=116
- まじしゃん: `[536.3, 550.1, 596.2, 541.7, 541.1]`、hits=18

### Phase 3機能・契約回帰

- `verify_card_list.mjs`、`verify_sort.mjs`、`verify_search_bug.mjs`: 成功、console/page error 0
- manual screenshot: light/dark desktopとmobile tableを一時領域へ生成し、文字欠け・document横overflowなしを目視
- DOM ID: Phase 3前237件、Phase 3後237件、集合差分0件
- modal ID: 17件を維持（`auth-modal`、`edit-card-modal`、`card-detail-modal`、`how-to-use-modal`、`settings-modal`、`tag-management-modal`、`alias-management-modal`、`bulk-tag-modal`、`bulk-quantity-modal`、`analysis-modal`、`gacha-result-modal`、`point-shop-modal`、`profile-modal`、`ranking-modal`、`stats-info-modal`、`custom-css-modal`、`bulk-import-modal`）
- 必須契約: `#main-app`、`#card-table`、`#card-table-body`、`#import-file-input`、`[name="search_name"]`、`#search-result-summary`、`#search-result-kinds`、`window.changePage`を維持
- module依存: `main.js -> collection.js -> auth/gamification/render/search/settings`の一方向。page moduleから`main.js`または`collection.js`への逆importはなく、循環0

### Phase 3後の既知失敗

`verify_common_theme.mjs`はPhase 1と同じ56件。内訳はindex、battle_records、card_shop、duel_simulator、supply_manager、banlist_editor、optionsの各8件（light/dark x desktop/mobile x 初回/reload）。card_listはPhase 1時点ですでに0件で、Phase 3後も0件のため総失敗数は減らない。新規失敗は0件、全9画面のdocument横overflowは引き続き0px。
