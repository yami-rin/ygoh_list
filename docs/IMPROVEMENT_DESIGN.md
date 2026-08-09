# card_manager_web 改善設計書

対象リポジトリ: `C:\Project\card_manager_web`

調査基準日: 2026-08-09（Windows 11 / PowerShell / Node.js v22.18.0）

## 0. 設計決定の要約

推奨案は「案1: Vanilla 維持 + ES モジュール分割 + CSS トークン」である。

`card_list.html` と `card_gallery.html` には既にこの方式の実績があり、Firebase/Workers の接続方式と、GitHub Pages がリポジトリ全体を静的配信する現行運用を変えずに画面単位で移行できる。React/Svelte 等への一括移行は行わず、Vite も今回の改善計画には導入しない。

移行中の不変条件は次のとおり。

- 既存 URL、主要 DOM ID、`localStorage` キー、Firestore/Workers API の契約を維持する。
- 1フェーズは1コミット・1デプロイ可能な状態にし、各フェーズ完了時点で全画面が動作する。
- Firebase 認証、Firestore の collection/document 構造、画像プロキシ URL は共通化しても意味を変更しない。
- `card_list` / gallery の既存 Playwright を毎フェーズの回帰ゲートにする。
- 保存形式を変える場合は旧形式を読み、新形式へ書く一方向移行とする。`localStorage.clear()` や IndexedDB store の一括削除は禁止する。
- HTML から CSS/JS を抽出するコミットでは、同時に機能ロジックを書き換えない。構造変更と最適化を分離する。

## 1. 現状分析

### 1.1 調査方法・既存方針・作業ツリー

ファイルサイズ、行数、script/style タグ数は、現行作業ツリーを PowerShell の `System.IO.File` と正規表現で集計した。処理内容は対象ファイルを実際に読み、該当行を確認した。数値は圧縮前のファイルサイズである。

現行作業ツリーには今回の対象外である未コミット変更が存在する。

- tracked: `M yugioh_cards_master.csv`
- untracked: `development_plan.txt`、`measure_btns.mjs`、`sim_*.mjs`、各種スクリーンショット等

実装時にこれらを削除、reset、clean、上書きしてはならない。本書に記載する CSV サイズは origin/main ではなく、調査時点の作業ツリーの値である。

リポジトリ直下の `CLAUDE.md` は次を既存方針としている。本設計はこれと矛盾しない。

- HTML / CSS / Vanilla JS、Bootstrap 5.3.0、Firebase、Cloudflare Workers を使用する。
- `card_list.html` + `css/card_list.css` + `js/card-list/main.js` は 2026-07 に分割済み。
- `js/shared/master-data.js` は Worker パース + IndexedDB キャッシュのページ非依存ローダーで、gallery 等にも流用できる。
- UI/描画変更後は最低 `node tests/verify_card_list.mjs` と `node tests/verify_sort.mjs` を実行する。
- 完成した変更は commit + push し、GitHub Pages へ反映する。

`.github/workflows/deploy.yml` は `main` への push をトリガーに、checkout 後のリポジトリ全体 `.` を Pages artifact として upload している。現状はビルド工程がない。

### 1.2 各画面の規模と責務

| 画面 | bytes | 行数 | scriptタグ | インラインscript | styleタグ | 外部CSS | 現状の責務 |
|---|---:|---:|---:|---:|---:|---:|---|
| `index.html` | 12,051 | 398 | 0 | 0 | 1 | 3 | トップ画面と各機能へのナビゲーション |
| `card_gallery.html` | 59,870 | 947 | 4 | 0 | 0 | 3 | gallery の DOM シェル。ロジックは `js/gallery/` |
| `card_list.html` | 125,827 | 1,862 | 3 | 0 | 1 | 4 | カード管理 DOM、認証/編集/統計等の大量マークアップ |
| `battle_records.html` | 231,167 | 4,516 | 4 | 1 | 1 | 対戦・大会・統計・認証・保存を一体実装 |
| `card_shop.html` | 88,182 | 1,932 | 3 | 1 | 1 | カード価格、ポイント、在庫、Chart.js |
| `duel_simulator.html` | 69,407 | 1,209 | 3 | 1 | 1 | 盤面状態、drag、replay、共有 URL、画像 |
| `supply_manager.html` | 36,836 | 788 | 3 | 2 | 1 | サプライ画像、タグ、Firebase/Workers API |
| `banlist_editor.html` | 33,826 | 945 | 2 | 1 | 1 | 禁止・制限 tier、CSV検索、画像キュー、export |
| `options.html` | 33,484 | 895 | 2 | 1 | 1 | レアリティ順序と演出設定 |

分割済みファイルも含めた実質的な画面コード量は次のとおり。

| 画面 | 関連ファイル合計 | 内訳 |
|---|---:|---|
| card list | 505,933 bytes (494.1 KiB) | `card_list.html` + `css/card_list.css` + `js/card-list/main.js` |
| gallery | 347,881 bytes (339.7 KiB) | `card_gallery.html` + `css/gallery.css` + `js/gallery/*.js` |

主な分割ファイルの規模は次のとおり。

| ファイル | bytes | 行数 | 現在の責務 |
|---|---:|---:|---|
| `css/card_list.css` | 37,374 | 1,123 | 旧来の画面 CSS + 末尾のテーマ層 |
| `css/gallery.css` | 82,473 | 2,407 | gallery/deck/community/playmat + 末尾のテーマ層 |
| `mobile-responsive.css` | 9,777 | 499 | 全画面向けレスポンシブ上書き |
| `js/card-list/main.js` | 342,732 | 6,785 | 認証、CRUD、検索、統計、設定等が一ファイル |
| `js/gallery/collection.js` | 82,364 | 1,702 | gallery の collection、検索、描画、画像 |
| `js/gallery/deck.js` | 52,651 | 1,215 | deck 編集/表示 |
| `js/gallery/community.js` | 30,990 | 647 | community 表示 |
| `js/gallery/main.js` | 9,442 | 231 | composition root、認証、システム組み立て |
| `js/gallery/pack-opening.js` | 10,982 | 271 | パック演出 |
| `js/shared/master-data.js` | 6,484 | 165 | CSV取得、IndexedDB、Worker、Map構築 |
| `js/shared/csv-worker.js` | 2,566 | 73 | 引用符対応 CSV パーサー |

`card_list` は JS/CSS の外出しは完了しているが、JS は依然 6,785 行、HTML は 125,827 bytes である。分割の第一段階は成功しているが、責務分割は未完了である。`battle_records` は CSS 381 行相当と module script 約3,535行相当を HTML 内に持つ、現状最大の単一ファイルである。

### 1.3 既存共通基盤と重複箇所

#### 再利用すべき既存基盤

- `js/shared/master-data.js`: `loadMasterData()` を export。戻り値は `{ cards, cardDetailsMap, cardIdToDetailsMap, cardReadingMap, nameToIdMap, fromCache }`。
- `js/shared/csv-worker.js`: BOM、引用符内カンマを考慮した CSV パース。
- `image_cache_manager.js`: IndexedDB 画像キャッシュと `window.imageCacheManager` / `window.PROXY_URL`。
- `api-client.js`: Cloudflare Workers API のクライアント。
- `data-storage-optimization.js`: `DataStorageManager` と対戦記録 localStorage の version/migration/cache。
- `storage-integration.js`: 対戦記録の local/Firebase 互換ラッパー。
- `js/gallery/*`: gallery の collection、cache、deck、community、bookmarks、pack、playmat 分割。

#### Firebase 初期化の重複

`initializeApp()`、`getAuth()`、`onAuthStateChanged()` は次の6画面に重複している。

- `battle_records.html:980-997`
- `card_shop.html:375-413`
- `duel_simulator.html:252-281`
- `supply_manager.html:10-29`
- `js/card-list/main.js:1-20`
- `js/gallery/main.js:1-23`

Firebase 設定オブジェクトも `battle_records.html`、`card_shop.html`、`duel_simulator.html`、`js/card-list/main.js`、`js/gallery/main.js` に存在する。`supply_manager` は設定の一部だけをインラインに持つ。認証の入口を共有 singleton に寄せるが、Firestore の path、認証 persistence、ローカルモードの意味は変えない。

#### マスター CSV 取得・パースの重複

- `js/card-list/main.js:4,205` と `js/gallery/main.js:4,40` は `loadMasterData()` を使用する。
- `duel_simulator.html:303-313` は `fetch('yugioh_cards_master.csv')` 後に `split(',')` で独自パースする。
- `banlist_editor.html:459-475` も同じ CSV を個別取得し、`split(',')` で独自パースする。

後二者は IndexedDB/Worker を共有せず、引用符内カンマを含むカード名・テキストを正しく処理できない。共通ローダー移行は性能改善と correctness 改善の両方に該当する。

#### テーマとコンポーネントの重複

- `css/card_list.css:894-910` に `--ygo-bg`、`--ygo-surface`、`--ygo-surface-muted`、`--ygo-border`、`--ygo-shadow`、`--ygo-text-muted`、`--ygo-radius`、`--ygo-radius-sm` の light/dark 定義がある。
- `css/gallery.css:2213-2231` にほぼ同値の定義があり、gallery 側だけ `--ygo-accent` を追加している。
- `battle_records.html:12-392`、`options.html:10-355`、`supply_manager.html:31-201`、`banlist_editor.html:8-360`、`duel_simulator.html:12-143` はそれぞれ独自の背景色、影、角丸、フォント、button、modal を持つ。
- `mobile-responsive.css:76-106` はモバイル時の全 `.table` に横スクロールと `min-width: 500px` を適用する。一方 `card_list.css` 後半は table row を Grid カード化しており、汎用 selector が競合し得る。
- `card_shop.html` / `index.html` は Bootstrap Icons 1.11.0、その他の Bootstrap 採用画面は 1.10.5 である。

HTML の行頭関数宣言を簡易静的集計すると、`battle_records.html` 71、`duel_simulator.html` 92、`banlist_editor.html` 22、`options.html` 17、`card_shop.html` 16、`supply_manager.html` 12の function 宣言がある。`duel_simulator` と `supply_manager` には `esc`、`openModal`、`render` という同名ローカル関数もある。汎用機能とページ機能の境界が命名だけでは分からない状態である。

### 1.4 保存データ・外部連携の不変契約

移行で名称変更・削除してはならない主なキーは次のとおり。

| 領域 | 既存キー/契約 | 根拠 |
|---|---|---|
| 共通テーマ | `theme` (`light` / `dark`) | `js/card-list/main.js:5049,5288`、`js/gallery/main.js:155-156` |
| card list | `cardCollection`、`wishlistCollection`、`customRarityOrder`、`rarityEffectSettings`、`tableRowsPerPage`、`inlineQtyBtn`、`cardAliases`、`tagsOrder` 等 | `js/card-list/main.js` |
| gallery | `galleryGridSize`、`gallerySortOrder`、`galleryListType`、`galleryFxEnabled`、`galleryCache_*` | `js/gallery/collection.js`、`js/gallery/cache.js` |
| battle | `isLocalMode`、`battleRecords`、`tournamentProgress`、`tournamentPresets`、`stores`、`darkMode`、`masterDuelMode`、`tweetTemplate` | `battle_records.html`、`data-storage-optimization.js` |
| duel | `duelsim_saves`、`#s=`/`#b=`/`#r=` hash format | `duel_simulator.html:934,1199-1203` |
| banlist | `banlist_v3`、`banlist_tier_config` | `banlist_editor.html:676-709` |
| supply | `supplyTags`、Workers supplies API | `supply_manager.html:406-465`、`api-client.js` |

Firestore collection/document path、Workers endpoint、payload field、画像 cache key `${cardId}_${ciid}_${lang}` も互換対象とする。共通化時にフィールド名を英語へ置換するようなデータリファクタは本計画に含めない。

### 1.5 パフォーマンスの根拠データ

#### 現行ファイル・処理から確定できる事実

- `yugioh_cards_master.csv` は現行作業ツリーで 1,500,104 bytes / 14,240 行。
- `js/shared/master-data.js:58` は module Worker を作成し、`:134` で cache signature 確認の HEAD、`:155` で `response.text()`、`:157` で IndexedDB 保存、`:161` で Map インデックス構築を行う。
- 初回は CSV 本文取得、文字列化、Worker への転送、パース、Map 構築が必要。再訪は本文 DL を防げるが、HEAD 往復と IndexedDB read、Map 再構築は残る。
- `duel_simulator.html:303-310` と `banlist_editor.html:459-469` は同じ1.5MB CSVを別経路で取得・パースする。
- `js/gallery/collection.js:52-74` は画像ごとに IndexedDB を参照し、未キャッシュ時は画像 proxy を呼ぶ。`:732-742` でカード DOM と画像 URL を組み立てる。
- `duel_simulator.html:408` は `boardRoot.innerHTML=''` で盤面全体を再構築し、`:681-709` は pointermove/pointerup を処理する。drag 中に全体 render が走る設計はフレーム落ちの候補である。
- `battle_records.html` は多数の `innerHTML`、`addEventListener`、localStorage JSON read/write、Firestore read/write を単一 module 内に持つ。ただし実時間は未計測であり、遅いと断定せず計測を先行する。

#### 2026-07 の既存実測

`C:\Project\knowledge\decisions\card-list-refactor-2026-07.md` には、3,000枚コレクション・Firefox headless 条件で次の実測が記録されている。今回の作業ツリーで再実行した値ではないため、「既存実測」として扱う。

| 測定 | 改善前 | 改善後 | 出典状態 |
|---|---:|---:|---|
| card_list 検索「どらごん」（128件） | 8.8秒 | 0.3秒 | 2026-07 実測 |
| card_list 検索「まじしゃん」 | 2.0秒 | 0.3秒 | 2026-07 実測 |
| マスターデータ初回 | 未記録 | 235ms | Worker 使用時の実測 |
| マスターデータ再訪 | 未記録 | 119ms、本文DL 0 | IndexedDB cache 実測 |
| 3,000行全件 DOM 表示 | 未記録 | 約300-450ms | DOM 構築が支配的という実測 |

#### 今回の再計測状況と tests/ の確認結果

`package.json` には `playwright: ^1.59.0` が devDependency としてあるが、調査環境には `node_modules` がなく、利用可能な in-app browser も0件だった。このため、現行作業ツリーで以下は未計測・要検証である。数値は推測しない。

- 現行 gallery の load / `cardDetailsMap` ready 時間。
- gallery の3,000枚グリッド表示、`changePage`、検索。
- battle/shop/duel/supply/banlist/options の load、検索、sort、render、scroll。
- 画像 proxy の cache hit率、first image表示、スクロール時の long task。

`tests/` には次の検証資産がある。

| スクリプト | 検証内容 |
|---|---|
| `tests/verify_card_list.mjs` | local login、カード追加、通常/読み仮名/ミス検索、IndexedDB再訪 |
| `tests/verify_sort.mjs` | 名前、レアリティ、枚数、型番の昇降順 |
| `tests/verify_search_bug.mjs` | 読み仮名検索の包含方向誤検出 |
| `tests/perf_card_list.mjs` | 3,000枚、100/all rows、3検索語 |
| `tests/verify_gallery_master.mjs` | 共通ローダー、Map形状、quoted comma、IndexedDB cache |
| `tests/verify_gallery_smoke.mjs` | gallery主要UIとlight/dark/mobile |
| `tests/perf_gallery_baseline.mjs` | load event / `cardDetailsMap` ready の3回中央値 |
| `tests/perf_gallery_render.mjs` | 3,000枚のgrid表示、再描画、検索 |
| `tests/shots.mjs` | card_list desktop light/dark/mobile screenshot |
| `tests/shots_gallery_theme.mjs` | gallery light/dark × desktop/mobile screenshot |

再計測は実装開始時に次の順で行う。

```powershell
npm ci
node tests/verify_card_list.mjs
node tests/verify_sort.mjs
node tests/verify_search_bug.mjs
node tests/verify_gallery_master.mjs
node tests/verify_gallery_smoke.mjs
node tests/perf_card_list.mjs
node tests/perf_gallery_baseline.mjs
node tests/perf_gallery_render.mjs 3000
```

`verify_gallery_smoke.mjs` と `shots*.mjs` が生成する画像は検証用であり、明示的に必要な基準画像以外は commit しない。localhost から Workers への既知 CORS ノイズは `tests/helpers.mjs` の規則どおり除外し、それ以外の console/page error は失敗とする。

#### 改善後の数値目標

以下は現状値ではなく受け入れ目標である。同じ Firefox headless、同じ3,000枚 fixture、同じローカル HTTP server で中央値とp95を記録する。

| 指標 | 目標 |
|---|---:|
| `master-data` 初回 ready | 中央値300ms以下 |
| `master-data` 再訪 | 中央値150ms以下、CSV本文転送0 bytes |
| card_list検索 handler CPU（debounce除外） | p95 50ms以下 |
| card_list検索入力→描画（既存300ms debounce込み） | p95 450ms以下 |
| galleryの表示対象100枚再描画 | p95 100ms以下 |
| 3,000枚全件再描画 | p95 300ms以下。通常UIはpage分割を標準とする |
| cache済み・認証mock時の各画面 app-ready | p95 1,500ms以下 |
| 画像scroll時の同期long task | 1回50ms未満、描画処理は1frame 16msを目標 |
| 同時画像取得 | 最大6 request |

未達時は最適化を追加する前に、CSV fetch、IDB、index build、Firestore/API、DOM、画像の performance mark を分離して原因を特定する。

## 2. 課題の優先順位付け（影響 × 修正コスト）

影響とコストは1（小）〜5（大）。優先順は「影響が大きく、既存機能を保ったまま小さく導入できるもの」を上位とする。

| 優先 | 課題 | 影響 | コスト | 判断 |
|---|---|---:|---:|---|
| P0 | gallery以外の性能基準・回帰テスト不足 | 5 | 1 | 以降を推測ではなく数値で判断する前提 |
| P0 | card_list/gallery のテーマ token 重複 | 4 | 1 | 実績のある値を抽出するだけで全画面の基準を作れる |
| P1 | duel/banlist の CSV 個別取得 | 5 | 2 | 共有 Worker/IDB へ移す効果が大きく、変更境界が明確 |
| P1 | 画像取得・DOM更新の分散 | 4 | 3 | 初回とscroll双方に効く。表示互換の検証が必要 |
| P1 | Firebase/Auth 初期化の6画面重複 | 4 | 3 | 保守上の事故源。auth callback順序をtestしてから共通化 |
| P1 | `battle_records.html` 231KB一体化 | 5 | 5 | 保守コスト最大。DOM/storage契約固定後に分割 |
| P2 | `card_shop.html` の価格/在庫/Chart一体化 | 4 | 4 | Firestoreと購入処理のtest seamを先に作る |
| P2 | supply/banlist/options/duel の独自 UI | 3 | 2〜4 | 画面ごとに安全に統一できる |
| P2 | Bootstrap Icons version混在 | 2 | 1 | 小リスクだが性能・主要機能への直接効果は小さい |
| P3 | Vite/フレームワーク導入 | 2 | 5 | 現在の主問題より先にdeploy/URL/認証リスクが増える |

## 3. アーキテクチャ方針

### 3.1 3案比較

| 評価軸 | 案1: Vanilla + ES Modules + CSS token | 案2: Vite等バンドラ | 案3: React/Svelte等へ移行 |
|---|---|---|---|
| 初期コスト | 小。既存HTML/JSをそのまま抽出可能 | 中。package、config、dist、CI追加 | 最大。state/DOM/event/testを再設計 |
| 段階移行 | 最も容易。画面単位でmoduleを差替可能 | 可能だが旧rootとdistの移行設計が必要 | 難しい。旧DOMとframeworkの二重運用が必要 |
| 性能上限 | Worker、IDB、dynamic import、HTTP cacheで現状課題には十分 | minify、tree-shake、chunk最適化が有利 | 仮想化/状態管理を選べるがframework overheadもある |
| 保守性 | 依存方向とmodule責務を守れば高い | 中〜高。build/debug手順が増える | 完了後は高い可能性。ただし完了まで長期間低い |
| Firebase/Workers | 影響小。CDN import/API URLを維持 | import/Worker/static asset/baseを要検証 | auth/Firestore lifecycle/API adapterを全面再設計 |
| GitHub Pages | 現行 workflow のまま `.` upload | `npm ci`→build→`dist` uploadへ変更 | 案2に加えSPA直リンク/fallback対策 |
| 1時間10回のbuild制限 | bundler buildなし | build工程追加。失敗・回数制限の影響増 | 同上。移行中のpushも増えやすい |
| リスク | CSS cascade、ESM読込順、共有module肥大化 | Pages subpath、生成物、source map、CI | 全画面回帰、データ/認証破壊、移行長期化 |

### 3.2 推奨案と理由

案1を採用する。

主な理由は次のとおり。

1. `card_list` の2026-07改善で、buildなしES Modules、Worker、IndexedDB、CSS token が既に機能・性能の両面で成立している。
2. `card_gallery` も同じ共通ローダーと module composition を使用しており、未知の設計を導入する必要がない。
3. 現行 GitHub Pages workflow と相対 URL を変更せず、1画面ずつ deploy/rollbackできる。
4. 現状の重さはframework不足ではなく、CSV重複取得、画像、DOM全再構築、巨大責務、CSS重複が主因である。
5. 将来 Vite を採用する場合も、先に module/component境界を整える作業は無駄にならない。

### 3.3 目標ディレクトリと依存方向

最終構成は次を目標にする。全ファイルを一度に移動せず、対象フェーズの画面だけを移行する。

```text
css/
  theme.css
  components.css
  page-shell.css
  pages/
    card-list.css
    gallery.css
    battle-records.css
    card-shop.css
    duel-simulator.css
    supply-manager.css
    banlist-editor.css
    options.css
js/
  shared/
    firebase-client.js
    auth.js
    theme.js
    ui.js
    storage.js
    master-data.js
    csv-worker.js
    image-service.js
  pages/
    card-list/
    gallery/                 # 現行 js/gallery/ から段階移動。移動自体は必須ではない
    battle-records/
    card-shop/
    duel/
    supply-manager/
    banlist/
    options/
```

依存方向は `pages -> shared` の一方向とする。

- `shared` はページ固有 ID やページ state を参照しない。
- ページの `main.js` は依存を組み立てる composition root とし、機能ロジックを持ちすぎない。
- `utils.js` 一個に汎用関数を集積しない。auth/theme/storage/image/data/UIの意味単位で分ける。
- 移行期間に限り `window.imageCacheManager`、`window.PROXY_URL`、`window.changePage`、`window.cardDetailsMap` 等の既存公開をadapterで維持する。
- 新規コードから別ページの `window` 関数を直接呼ばない。

### 3.4 案2を将来採用する場合の具体的変更

今回の実装対象ではないが、Viteを将来導入する場合は次が必須である。

1. `package.json` に `vite`、`build`、`preview` を追加する。現在の `start` は画像proxy server用なので、Pages buildと混同しない。
2. `vite.config.js` で repository Pages の subpath を `base: '/ygoh_list/'` とする。公開URLが異なる環境ではCI変数から設定する。
3. CSV、Worker、画像、HTML linkを `import.meta.env.BASE_URL` または `new URL(..., import.meta.url)` に統一する。
4. `.github/workflows/deploy.yml` を以下の流れに変える。

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm run build
- uses: actions/upload-pages-artifact@v3
  with:
    path: ./dist
- uses: actions/deploy-pages@v4
```

5. 旧root HTMLと`dist`を同時配信しない。段階移行するならlegacyのURLとasset rootを明示的に隔離する。
6. 1時間10回のbuild制限を考慮し、CI実行対象とpush回数を制御する。

## 4. デザインシステム仕様

### 4.1 CSSトークンの実値

`css/theme.css` に以下を定義する。既存 `card_list.css` / `gallery.css` の値を基準にし、不足する軸だけ追加した値である。

```css
:root {
  color-scheme: light;

  --ygo-bg: #eef1f6;
  --ygo-surface: #ffffff;
  --ygo-surface-muted: #f1f3f8;
  --ygo-border: rgba(15, 23, 42, 0.09);
  --ygo-text: #1f2937;
  --ygo-text-muted: #5b6472;
  --ygo-accent: #4f6ef7;
  --ygo-accent-hover: #3d5ce5;
  --ygo-success: #198754;
  --ygo-warning: #f59e0b;
  --ygo-danger: #dc3545;
  --ygo-info: #0d6efd;

  --ygo-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --ygo-shadow-md: 0 1px 2px rgba(15, 23, 42, 0.05),
                   0 10px 28px -16px rgba(15, 23, 42, 0.18);
  --ygo-shadow-overlay: 0 16px 40px -18px rgba(15, 23, 42, 0.28);

  --ygo-radius-xs: 0.375rem;
  --ygo-radius-sm: 0.5rem;
  --ygo-radius-md: 0.75rem;
  --ygo-radius-lg: 1rem;
  --ygo-radius-pill: 999px;

  --ygo-space-1: 0.25rem;
  --ygo-space-2: 0.5rem;
  --ygo-space-3: 0.75rem;
  --ygo-space-4: 1rem;
  --ygo-space-5: 1.25rem;
  --ygo-space-6: 1.5rem;
  --ygo-space-8: 2rem;
  --ygo-space-10: 2.5rem;

  --ygo-font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans",
                     "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
  --ygo-font-size-xs: 0.75rem;
  --ygo-font-size-sm: 0.875rem;
  --ygo-font-size-md: 1rem;
  --ygo-font-size-lg: 1.125rem;
  --ygo-font-size-xl: 1.5rem;
  --ygo-line-height: 1.5;
  --ygo-touch-target: 2.75rem;
  --ygo-focus-ring: 0 0 0 3px rgba(79, 110, 247, 0.32);
}

[data-bs-theme="dark"] {
  color-scheme: dark;

  --ygo-bg: #12151c;
  --ygo-surface: #1b202a;
  --ygo-surface-muted: #232a37;
  --ygo-border: rgba(148, 163, 184, 0.16);
  --ygo-text: #e7eaf0;
  --ygo-text-muted: #97a3b4;
  --ygo-accent: #8fa8ff;
  --ygo-accent-hover: #a9b9ff;
  --ygo-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.45);
  --ygo-shadow-md: 0 1px 2px rgba(0, 0, 0, 0.45),
                   0 10px 28px -16px rgba(0, 0, 0, 0.6);
  --ygo-shadow-overlay: 0 16px 40px -18px rgba(0, 0, 0, 0.75);
  --ygo-focus-ring: 0 0 0 3px rgba(143, 168, 255, 0.38);
}

:root,
[data-bs-theme="dark"] {
  --bs-body-bg: var(--ygo-bg);
  --bs-body-color: var(--ygo-text);
  --bs-border-color: var(--ygo-border);
  --bs-primary: var(--ygo-accent);
}
```

画面CSSでこれらを再定義しない。レアリティ色、duelのzone色、banlistのtier色は意味色であり、共通tokenとは分ける。

```css
/* 例: page-specific semantic tokens */
[data-page="duel-simulator"] {
  --duel-zone-grave: #8b5cf6;
  --duel-zone-banish: #ea580c;
  --duel-zone-extra: #a855f7;
  --duel-zone-deck: #22c55e;
  --duel-zone-field: #14b8a6;
}
```

### 4.2 テーマ状態の定義

- `<html data-bs-theme="light">` または `dark` を唯一のDOMテーマ状態とする。
- `localStorage['theme']` の既存値を読む。未設定時は `light`。
- `js/shared/theme.js` は `applyTheme(theme)`、`getTheme()`、`toggleTheme()`、`watchTheme(callback)` をnamed exportする。
- 適用時に `document.documentElement.dataset.bsTheme` を変更し、`themechange` CustomEventを発行する。
- `<nav>`、modal、個別sectionに `data-bs-theme="light"` をhard-codeしない。既存ナレッジで確認済みの「navだけlight固定でdark時に文字が消える」問題を防ぐ。
- battleの`darkMode`は初回互換読込だけ行い、`theme`がなければ変換する。以後は`theme`を正とする。
- `prefers-reduced-motion: reduce` 時はanimation/transitionを事実上無効化する。

### 4.3 Bootstrapとの共存・置換方針

Bootstrap 5.3.0は当面残す。modal、toast、collapse、navbar、gridのbehaviorを利用し、visualをtoken/component層で統一する。

Bootstrap採用画面のCSS読込順を固定する。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
<link rel="stylesheet" href="css/theme.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/page-shell.css">
<link rel="stylesheet" href="mobile-responsive.css">
<link rel="stylesheet" href="css/pages/<page>.css">
```

移行中はBootstrapとygo classを併記する。

```html
<button class="btn btn-primary ygo-btn ygo-btn--primary" type="button">保存</button>
<section class="card ygo-surface ygo-card">...</section>
```

一画面の全componentが移行し、Playwrightとscreenshotで確認できるまでBootstrap classを削除しない。本計画ではBootstrapの完全置換は行わない。duel/banlistのような非Bootstrap画面も、共通shell/button/modal tokenを取り込みつつ、盤面・tier editor固有layoutは独自CSSを維持する。

### 4.4 共通コンポーネントとマークアップ規約

#### App shell / navigation

```html
<nav class="ygo-nav navbar navbar-expand-lg" data-ygo-component="app-nav">
  <div class="container">
    <a class="navbar-brand ygo-brand" href="index.html">Card Manager</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
            data-bs-target="#navbarNav" aria-controls="navbarNav"
            aria-expanded="false" aria-label="メニュー"></button>
    <div id="navbarNav" class="collapse navbar-collapse">
      <ul class="navbar-nav ms-auto">...</ul>
    </div>
  </div>
</nav>
```

既存 `#navbarNav` とページリンクを維持し、現在ページのlinkに `aria-current="page"` を設定する。

#### Page header / surface / stat card

```html
<main class="ygo-page container" data-page="card-list">
  <header class="ygo-page-header">
    <div>
      <p class="ygo-eyebrow">COLLECTION</p>
      <h1>カード管理</h1>
    </div>
    <div class="ygo-page-actions">...</div>
  </header>

  <section class="ygo-surface ygo-card" data-ygo-component="surface">
    <div class="ygo-card__header">...</div>
    <div class="ygo-card__body">...</div>
  </section>
</main>
```

- `.ygo-page` は最大幅を画面側modifierで指定する。
- `.ygo-surface` は背景、border、shadow、radiusだけを担当する。
- `.ygo-card` はspacingを担当し、機能状態を持たない。
- stat cardの意味色はtext/iconに限定し、全面を強いgradientで塗らない。

#### Button

- 基本 `.ygo-btn`、主要 `.ygo-btn--primary`、補助 `.ygo-btn--secondary`、危険 `.ygo-btn--danger`、ghost `.ygo-btn--ghost`、icon-only `.ygo-btn--icon`。
- `button` に `type` を必ず書く。
- icon-only buttonは`aria-label`と`title`を持つ。
- 新規`onclick=`を作らず、既存IDまたは`data-ygo-action`でevent delegationする。
- 最小tap領域は`--ygo-touch-target: 2.75rem`。
- danger操作は視覚色だけでなくconfirm/undoのいずれかを持つ。

#### Filter bar

```html
<form class="ygo-filter-bar" data-ygo-component="filter-bar" role="search">
  <label class="visually-hidden" for="search-input">カード名</label>
  <input id="search-input" class="form-control ygo-field" type="search"
         name="search" autocomplete="off">
  <button class="btn ygo-btn ygo-btn--primary" type="submit">検索</button>
  <button class="btn ygo-btn ygo-btn--ghost" type="button"
          data-ygo-action="reset-filter">リセット</button>
</form>
```

既存 `card_list` の `[name="search_name"]`、galleryの`#search-input`/`#code-search-input`は維持する。検索は300ms debounceを基準とし、CPU時間とdebounce込みwall timeを別々に計測する。

#### Table

```html
<div class="table-responsive ygo-table-wrap" data-ygo-component="table">
  <table class="table ygo-table" id="card-table">
    <caption class="visually-hidden">カード一覧</caption>
    <thead>
      <tr>
        <th scope="col"><input type="checkbox" aria-label="全選択"></th>
        <th scope="col" class="sortable" data-sort="名前" aria-sort="none">名前</th>
      </tr>
    </thead>
    <tbody id="card-table-body"></tbody>
  </table>
</div>
```

- sort列は`data-sort`、現在状態は`aria-sort`で表す。
- `tbody.innerHTML`の一括更新は許可するが、値はescape済みrendererだけから出す。
- 行ごとのlistenerではなく`tbody`のevent delegationを使う。
- mobile tableは`.ygo-table--scroll`または`.ygo-table--cards`を画面ごとに明示し、共通CSSで全tableへ`min-width`を強制しない。

#### Modal / toast / loading / empty state

```html
<div class="modal fade" id="ygo-detail-modal" tabindex="-1"
     aria-labelledby="ygo-detail-title" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content ygo-modal">
      <div class="modal-header">
        <h2 id="ygo-detail-title" class="modal-title">詳細</h2>
        <button class="btn-close" type="button" data-bs-dismiss="modal"
                aria-label="閉じる"></button>
      </div>
      <div class="modal-body" data-ygo-slot="body"></div>
    </div>
  </div>
</div>

<div class="ygo-toast-region toast-container"
     aria-live="polite" aria-atomic="true"></div>

<div class="ygo-loading" data-ygo-component="loading"
     role="status" aria-live="polite" hidden>読み込み中…</div>

<div class="ygo-empty" data-ygo-component="empty" hidden>
  <p class="ygo-empty__title">該当するデータがありません</p>
</div>
```

Bootstrap採用画面は`bootstrap.Modal`/`bootstrap.Toast`を`ui.js` wrapper経由で呼ぶ。duelの独自modalはlayoutを維持するが、`#shareModal`、`#savesModal`、`#matModal`、`#listModal`のIDを変えず、開閉APIだけ共通化する。

#### Card image

```html
<img class="ygo-card-image" loading="lazy" decoding="async"
     width="177" height="254" alt="カード名">
```

- width/heightまたはaspect-ratioを事前指定し、layout shiftを防ぐ。
- 最初から全画像URLを直列取得しない。viewport周辺だけをqueueする。
- data URL、proxy URL、cache keyは`image-service.js`だけが扱う。
- 失敗時は`.ygo-image-placeholder`を表示し、broken imageの無限retryを作らない。
- list/search/filter段階では画像fetchを開始せず、render後のvisible itemだけを対象にする。

## 5. 10フェーズの段階的移行計画

各フェーズは単独commit・単独deploy可能とし、完了時に全画面が動くことを条件とする。「全画面を一度に作り直す」工程はない。

| Phase | 内容 | 主な変更範囲 | 完了時の状態 |
|---:|---|---|---|
| 1 | baselineと契約固定 | `tests/` | 現行機能・性能を再現可能に記録 |
| 2 | 共通token/UI/auth基盤追加 | `css/theme.css`、`components.css`、`js/shared/*` | 未使用基盤追加。既存画面は無変更で動作 |
| 3 | card_listを基準画面として移行 | `card_list.html`、`css/card_list.css`、`js/card-list/*` | 既存testを維持して共通theme/componentを使用 |
| 4 | gallery移行と画像描画境界整理 | `card_gallery.html`、`css/gallery.css`、`js/gallery/*` | card_listと同じvisual language、画像遅延表示 |
| 5 | master/image共通化 + banlist移行 | shared data/image、`banlist_editor.html` | CSV入口を一本化し、banlistを分割 |
| 6 | duel simulator分割・移行 | `duel_simulator.html`、`js/pages/duel/*` | drag/replay/shareを維持して全体render削減 |
| 7 | battle records分割・移行 | `battle_records.html`、`js/pages/battle-records/*` | local/Firebase、大会、統計を維持して巨大HTML解体 |
| 8 | card shop分割・移行 | `card_shop.html`、`js/pages/card-shop/*` | purchase/inventory/chartを維持して責務分離 |
| 9 | supply manager分割・移行 | `supply_manager.html`、`js/pages/supply-manager/*` | image/tag/API/authを共通基盤へ接続 |
| 10 | options/index移行と全体cleanup | `options.html`、`index.html`、共通CSS/JS | 全画面統一、重複token/Firebase/直接CSV fetchを除去 |

Phase 5〜9は機能範囲の異なる画面を一つずつ扱う。Phase 7のbattleとPhase 8のshopを同一commitへ混ぜない。Phase 10は既に各画面が共通基盤で動いた後の削除工程であり、新しい機能を加えない。

## 6. 実装タスク一覧

### Phase 1: baselineと契約固定

#### P1-T1 既存Playwright実行基盤を固定する

- 対象ファイル: `package.json`、`package-lock.json`、`tests/helpers.mjs`
- 変更内容: `npm ci`でPlaywright/Expressを再現できる状態を確認し、static server、Firefox headless、local login、CORS noiseの前提をコメントへ固定する。画像proxy用`start` scriptは変更しない。
- 受け入れ条件: 現行コードのまま`verify_card_list.mjs`、`verify_sort.mjs`、`verify_search_bug.mjs`、`verify_gallery_master.mjs`が実行可能。失敗があれば改善着手前の既知失敗として原因を記録する。
- 検証方法: `npm ci`後に上記4本を実行。console/page errorを保存し、既知CORS以外を失敗扱いにする。

#### P1-T2 全画面性能計測を追加する

- 対象ファイル: `tests/perf_all_pages.mjs`（新規）、既存`tests/perf_*.mjs`
- 変更内容: 各画面でnavigation、DOMContentLoaded、load、app-ready、主要render/searchを計測する。card系は3,000枚fixture、他画面はlocal modeまたはnetwork mockを使う。
- 受け入れ条件: 各指標を3回以上測り、中央値、p95、画面名、条件、browser、cold/warmを出力する。測れない画面を推測値で埋めず`UNMEASURED`とする。
- 検証方法: 同一commandをcold/warm各2セット実行し、CSV本文request数、画像request数、long taskも記録する。生成logは原則commitしない。

#### P1-T3 共通テーマ・layout回帰testを追加する

- 対象ファイル: `tests/verify_common_theme.mjs`（新規）
- 変更内容: 全9画面をlight/dark、1440x900/375x812で開き、`html[data-bs-theme]`、body、主要surface、文字色、水平overflowを確認する。
- 受け入れ条件: 未定義色、白文字/白背景、意図しないdocument横scroll、theme再load失敗が0。
- 検証方法: computed style assertionに加え、card_listは`shots.mjs`、galleryは`shots_gallery_theme.mjs`で目視する。

### Phase 2: 共通基盤

#### P2-T1 CSS tokenとpage shellを追加する

- 対象ファイル: `css/theme.css`、`css/components.css`、`css/page-shell.css`（全て新規）
- 変更内容: 本書4.1のtoken、Bootstrap bridge、body/font、focus ring、reduced motion、nav/page/surface/button/filter/table/modal/toast/loading/empty/image placeholderを実装する。
- 受け入れ条件: 新CSSを未使用状態で追加しても既存画面に変化がない。共通CSSはページ固有IDをselectorに持たない。
- 検証方法: fixture DOMを使った`verify_common_theme.mjs`、CSS内の`!important`監査。既存CSSより詳細度を不必要に高くしない。

#### P2-T2 theme/UI moduleを追加する

- 対象ファイル: `js/shared/theme.js`、`js/shared/ui.js`（新規）
- 変更内容: `applyTheme/getTheme/toggleTheme/watchTheme`、`showToast/setLoading/showEmpty/escapeHtml/getModal`をnamed exportする。shared moduleはページDOMを自動scanせず、呼び出し側からelement/dependencyを受け取る。
- 受け入れ条件: theme再load、CustomEvent、toast aria-live、loading hidden、HTML escapeが単体で動く。既存Bootstrapと共存する。
- 検証方法: Playwright fixtureでlight→dark→reload、toast、modal、`<script>`を含む入力escapeを確認する。

#### P2-T3 Firebase/Auth singletonを追加する

- 対象ファイル: `js/shared/firebase-client.js`、`js/shared/auth.js`（新規）
- 変更内容: Firebase config、app/Auth/Firestore singleton、`setPersistence`、`onAuthStateChanged`購読、`api.setAuth`接続を共有API化する。local modeはoptionとして注入し、ページごとの意味を変えない。
- 受け入れ条件: 同一ページから複数回取得してもFirebase appが一つ。unsubscribe可能。未認証、認証、localの3状態を表現できる。
- 検証方法: Firebase import/networkをmockし、initialize count=1、callback count、unsubscribe、API auth順序を確認する。

### Phase 3: card_listを基準画面として移行

#### P3-T1 card_listのtoken重複を共通CSSへ移す

- 対象ファイル: `card_list.html`、`css/card_list.css`
- 変更内容: 共通CSSを規定順に読込し、`css/card_list.css:894-1100`のうち共通token/surface/button/form/nav/modal/table/focus/reduced-motionを削除する。card list固有のrarity、mobile row grid等は残す。
- 受け入れ条件: `#main-app`、`#card-table`、`#card-table-body`、全modal ID、nav linkを維持。light/dark/mobileの差が意図した共通token差分だけ。
- 検証方法: `verify_card_list.mjs`、`verify_sort.mjs`、`verify_search_bug.mjs`、`shots.mjs`。

#### P3-T2 card_listの共通component classを適用する

- 対象ファイル: `card_list.html`、`js/card-list/main.js`
- 変更内容: Bootstrap classへ`ygo-*`を併記し、search/stat/table/toast/modal/loadingを`ui.js`経由にする。既存`window.changePage`、`#import-file-input`、`[name="search_name"]`、`#search-result-summary`、`#search-result-kinds`を維持する。
- 受け入れ条件: login、card add/edit/delete、通常/読み仮名検索、sort、import、theme、statsが同じ結果。
- 検証方法: card_list全既存testとmanual screenshot。DOM ID一覧を移行前後で比較する。

#### P3-T3 card-list main.jsを責務単位で分割する

- 対象ファイル: `js/card-list/main.js`、新規`js/pages/card-list/auth.js`、`collection.js`、`search.js`、`render.js`、`settings.js`、`gamification.js`
- 変更内容: まずコードを移動し、algorithm/selector/storage keyを変えない。`main.js`はdependency組立、init、compatibility exportだけにする。
- 受け入れ条件: `main.js`の責務がcompositionへ縮小し、page module間は明示import。循環importなし。既存動作とperformanceが悪化しない。
- 検証方法: 全card_list test、`perf_card_list.mjs`。検索/100rows/all rowsの中央値とp95がbaseline+10%以内、または目標値以下。

### Phase 4: gallery移行と画像描画境界

#### P4-T1 galleryの共通CSS適用とtoken重複除去

- 対象ファイル: `card_gallery.html`、`css/gallery.css`
- 変更内容: 共通CSSを読み、`css/gallery.css:2213-2319`のtokenと共通surface/button/form/nav/modal/tab/focusを削除する。grid/deck/community/pack/playmat固有CSSは残す。
- 受け入れ条件: `#card-grid`、`#deckListPanel`、`#community-container`、`#packOverlay`、playmat、filterの表示状態・操作が変わらない。
- 検証方法: `verify_gallery_master.mjs`、`verify_gallery_smoke.mjs`、`shots_gallery_theme.mjs`。

#### P4-T2 galleryのfilter/render/image境界を分ける

- 対象ファイル: `js/gallery/collection.js`、`deck.js`、`community.js`、`main.js`
- 変更内容: filter/sort/page計算では画像fetchをしない。render後のvisible cardだけをimage serviceへqueueする。`window.cardDetailsMap`と`window.changePage`はcompatibilityとして残す。
- 受け入れ条件: 画像未取得でもcard名/枚数/検索結果が先に表示される。cache画像はnetwork再取得しない。filter変更で古いqueueをcancelする。
- 検証方法: `perf_gallery_render.mjs 3000`、Playwright routeでrequest数、rapid filter、cache hit/miss、scrollを確認する。

### Phase 5: master/image共通化とbanlist移行

#### P5-T1 master-dataを唯一のCSV入口へ強化する

- 対象ファイル: `js/shared/master-data.js`、`js/shared/csv-worker.js`、`tests/verify_master_contract.mjs`（新規）、`tests/fixtures/master-card.csv`（新規）
- 変更内容: 現在の戻り値を維持し、同一URLの同時呼出をPromise共有する。IndexedDB recordへ`parserVersion`とsignatureを持たせる。HEAD失敗時は現行通りcache fallbackする。cache即返却+background revalidateは計測して有利な場合だけ採用する。
- 受け入れ条件: 同一page並列callでCSV fetch 1回、warmで本文DL 0、parserVersion変更時だけ再parse。BOM/quoted comma/empty fieldを処理できる。
- 検証方法: `verify_gallery_master.mjs`拡張、fixture test、fetch count、`fromCache`、card_list読み仮名/sort。

#### P5-T2 image serviceを追加する

- 対象ファイル: `image_cache_manager.js`、`js/shared/image-service.js`（新規）、gallery呼出部
- 変更内容: `getCardImage({cardId, ciid, locale})`、`prefetchVisible()`、`clearCardImage()`を提供。既存cache keyとglobal APIをadapterで維持。fetchを最大6並列、同一keyのPromiseを共有し、AbortControllerで不要requestを止める。
- 受け入れ条件: 既存IDB画像を読める。proxy URL、画像削除、locale/ciid、404 placeholderが同じ意味で動く。
- 検証方法: cache hit/miss、offline、404、rapid scroll、同一画像重複request、abort後のbroken stateをtestする。

#### P5-T3 banlistを分割して共通data/imageへ移す

- 対象ファイル: `banlist_editor.html`、新規`css/pages/banlist-editor.css`、`js/pages/banlist/main.js`、`render.js`、`storage.js`
- 変更内容: inline style（現状8-360）とmodule script（422-942）を抽出。`loadCSV()`を`loadMasterData()`に置換し、image queueをimage serviceへ接続。既存`#tier-container`、`#pool-cards`、`#search-input`、`#settings-modal`、`#export-modal`、`#status-bar`を保持する。
- 受け入れ条件: tier drag/drop、検索、保存/reset/export、settings、画像表示が動く。`banlist_v3`/`banlist_tier_config`不変。search上限80不変。banlist内のCSV直接fetchが0。
- 検証方法: `tests/verify_banlist.mjs`を追加し、検索、quoted comma、drag/drop、reload persistence、画像cache、light/dark/mobileを確認する。

### Phase 6: duel simulator

#### P6-T1 duelのCSS/JSとstate/render/interactionを分離する

- 対象ファイル: `duel_simulator.html`、新規`css/pages/duel-simulator.css`、`js/pages/duel/state.js`、`render.js`、`interaction.js`、`replay.js`、`share.js`、`main.js`
- 変更内容: inline CSS/JSを抽出し、盤面state、render、pointer interaction、replay、share/saveを分割する。`boardRoot.innerHTML=''`による全体renderはaction確定時に限定し、pointermoveはtransform更新だけにする。
- 受け入れ条件: deck load、draw、shuffle、token、undo、drag/drop、material、fullscreen、replay、share URL、save/deleteが同じ結果。`duelsim_saves`と`#s/#b/#r`互換。主要button/modal ID不変。
- 検証方法: `tests/verify_duel_simulator.mjs`を新規作成。rootの未追跡`sim_test.mjs`には依存せず、各button、drag、hash復元、reload saveを検証する。

#### P6-T2 duelのCSV/Auth/themeを共有化する

- 対象ファイル: `js/pages/duel/card-data.js`、`main.js`、`css/pages/duel-simulator.css`、`js/shared/auth.js`
- 変更内容: `loadCardData()`を`loadMasterData()`へ置換し、`isLinkMonster()`は共通Mapの`cardType`を参照。Firebase dynamic importはshared authへ寄せるが、board先行表示/auth非同期という現行挙動を維持。盤面固有色は`--duel-*`へ分離する。
- 受け入れ条件: duel内のCSV直接fetchとFirebase config重複が0。未認証/offlineでも盤面が先に表示。Link monster制約と画像表示が維持される。
- 検証方法: master contract test、duel test、offline auth、pointermove handler p95 16ms目標、long task 50ms未満。

### Phase 7: battle records

#### P7-T1 battleのDOM/storage契約testを先に固定する

- 対象ファイル: `tests/verify_battle_records.mjs`（新規）、`battle_records.html`、`data-storage-optimization.js`、`storage-integration.js`
- 変更内容: 分割前に主要IDとlocalStorage schemaをfixture化する。最低対象は`#main-app`、`#records-tbody`、`#filter-form`、`#auth-modal`、`#tournament-modal`、`#rounds-modal`、`#settings-modal`、`#tournament-management-modal`、`#view-record-modal`、`#tweet-modal`。
- 受け入れ条件: local modeでrecord追加、検索、大会進行、途中保存/reload再開、統計、preset、import/exportが現行通り。
- 検証方法: `localStorage.setItem('isLocalMode','true')`をinit scriptで設定し、production Firebaseを呼ばずに主要flowとstorage snapshotを確認する。

#### P7-T2 battleのCSSを抽出して共通tokenへ置換する

- 対象ファイル: `battle_records.html:12-392`、新規`css/pages/battle-records.css`
- 変更内容: inline CSSをそのまま抽出したcommitを先に作り、その後`.navbar-custom`、`.settings-card`、`.filter-section`、`.records-card`、`.stat-card`、autocomplete、buttonをtokenへ置換する。mobile tableはmodifierでscroll/cardsを指定する。
- 受け入れ条件: record table、勝敗色、stats、autocomplete、modal、mobile action buttonが読める。意図しないdocument横scrollがない。
- 検証方法: P7-T1、common theme test、1440/375 screenshot、before/after computed style比較。

#### P7-T3 battle moduleを責務別に分割してshared authへ接続する

- 対象ファイル: `battle_records.html:979-4513`、新規`js/pages/battle-records/main.js`、`auth.js`、`records.js`、`tournaments.js`、`statistics.js`、`settings.js`
- 変更内容: mainはinit/event登録だけにし、`DataStorageManager`/`storage-integration.js`をadapterとして呼ぶ。Firestoreの`battleRecords` query/add/update/deleteとlocal fallbackの優先順を変えない。Firebase configをsharedへ移す。
- 受け入れ条件: local/Firebase、大会、Master Duel、auto-save、preset、settings、tweet template、import/exportが動く。HTML inline script 0。既存storage snapshotが一致。
- 検証方法: P7-T1全flow、Firebase mock payload、console/page error、`perf_all_pages.mjs`のapp-ready/search/table render比較。

### Phase 8: card shop

#### P8-T1 card shopのtest seamと契約testを追加する

- 対象ファイル: `card_shop.html`、新規`tests/verify_card_shop.mjs`
- 変更内容: production account不要でAuth/Firestore/Chart.jsをmockできる`?localtest=1`を設ける。対象selectorは`#cards-container`、`#inventory-container`、`#priceChart`、`#priceHistoryModal`、`#sort-select`、`#news-source`、`#current-points`。
- 受け入れ条件: 価格表示、sort、purchase、sell、inventory、points、履歴chart、予測、news設定をfixtureで再現できる。localtestはproduction writeを行わない。
- 検証方法: purchase/sell前後の表示、point計算、mock Firestore payload、Chart open、reloadを検証する。

#### P8-T2 card shopのCSS/JSを責務分割し共通UIへ移す

- 対象ファイル: `card_shop.html`、新規`css/pages/card-shop.css`、`js/pages/card-shop/main.js`、`data.js`、`market.js`、`inventory.js`、`chart.js`
- 変更内容: inline style（11-227）とmodule script（374-1929）を抽出。Firebaseをsharedへ接続。Chart.jsは価格履歴modal初回open時のlazy loadを検討し、baselineよりapp-readyが改善する場合に採用する。
- 受け入れ条件: HTMLはデータ処理を持たず、購入価格、免疫rarity、inventory path、points fieldを変更しない。loading/empty/errorが共通componentになる。
- 検証方法: P8-T1、theme/mobile screenshot、Chart CDN失敗fallback、app-ready/purchase操作のperformance比較。

### Phase 9: supply manager

#### P9-T1 supplyのauth/API bootstrapを共有化する

- 対象ファイル: `supply_manager.html:9-30`、`js/shared/auth.js`、`api-client.js`
- 変更内容: Firebase moduleと`window._api`初期化をsharedへ移す。移行期間は`window._appInit` compatibilityを維持し、最終的にmodule importへ置換する。`api.setAuth(user)`後にdata loadする順序を守る。
- 受け入れ条件: 認証前overlay、未認証login、認証後`#playmat-list`、API errorが現行通り。`supplyTags`不変。
- 検証方法: Auth mock、`#auth-overlay`/`#auth-login`/`#playmat-list`、API get/save/delete payload、callback二重実行がないことを確認。

#### P9-T2 supplyのCSS/JSを分離して共通componentへ移す

- 対象ファイル: `supply_manager.html`、新規`css/pages/supply-manager.css`、`js/pages/supply-manager/main.js`、`tags.js`、`image.js`
- 変更内容: inline style（31-201）とscript（402-785）を抽出。`compressImage(maxDim=1200, quality=0.82)`、tag drag/drop、Bootstrap modalのbehaviorを維持してUI classだけ統一する。
- 受け入れ条件: image選択/圧縮/preview/save/delete、sealed switch、tag CRUD/orderが動く。空状態とtoastが共通component。
- 検証方法: `tests/verify_supply_manager.mjs`を追加し、1MB超画像、空tag、既存tag、drag、mobile、API failure、console errorを確認する。

### Phase 10: options/indexと全体cleanup

#### P10-T1 options/indexを共通shellへ移行する

- 対象ファイル: `options.html`、`index.html`、新規`css/pages/options.css`、`js/pages/options/main.js`
- 変更内容: optionsのinline style/moduleを抽出し、`customRarityOrder`、`rarityEffectSettings`、`saveToast`、`effectSaveToast`を維持する。indexは共通nav/page shell/themeを使用する。
- 受け入れ条件: rarity orderのdrag/touch、save/reset、effect save/reset/import、toast、indexから全ページへのlinkが動く。
- 検証方法: `tests/verify_options.mjs`追加、localStorage reload、touch viewport、theme test、全link HTTP 200。

#### P10-T2 全画面の重複CSS/初期化を削除する

- 対象ファイル: `css/card_list.css`、`css/gallery.css`、`mobile-responsive.css`、全対象HTML、`js/shared/*`
- 変更内容: 重複token、共通nav/card/button/modal/toast、Firebase config、直接CSV fetchを削除。Bootstrap Icons versionを一つに固定。古いcompatibility globalは使用箇所0を確認してから削除する。
- 受け入れ条件: Firebase configはshared 1か所、CSV直接fetch 0、共通token定義1か所、HTML inline script/style 0（例外は明文化したcritical theme bootstrapのみ）、全画面CSS link順が規約通り。
- 検証方法: 全`verify_*.mjs`、全`perf_*.mjs`、全theme screenshot、`Select-String`静的監査、production Pages deploy。削減bytesとperformanceをbaselineと比較して記録する。

## 7. リスクとロールバック手順

### 7.1 リスク一覧

| リスク | 兆候 | 防止策 |
|---|---|---|
| DOM ID/event破壊 | Playwright selector timeout、button無反応 | ID/data-sort/window互換をtest fixture化。markup変更とlogic変更を分離 |
| localStorageデータ消失 | reload後にcollection/banlist/deckが空 | 旧keyを正としてread、移行前snapshot、clear禁止 |
| Firebase多重初期化 | app already exists、auth callback二重実行 | singletonとunsubscribe、initialize count test |
| local/Firebase優先順の変化 | offline時にserver値で上書き、逆も発生 | 既存adapterの順序をcontract test化 |
| CSV parser差異 | quoted comma、reading、cardType欠落 | `csv-worker.js`だけを使用しfixture test |
| IndexedDB schema破壊 | warmでもcache miss、旧画像が出ない | parser/image version追加、旧store/keyを削除しない |
| 画像同時取得過多 | scroll遅延、proxy 429、waterfall | 6並列、lazy、AbortController、Promise共有 |
| CSS cascade逆転 | darkで文字消失、mobile横幅超過 | link順固定、局所theme hard-code禁止、375px screenshot |
| Bootstrap/CDN障害 | modal/chart undefined | critical path外へlazy化、失敗時empty/error表示 |
| GitHub Pages subpath | CSV/Worker/直link 404 | 案1は相対URL維持。Vite時だけbase/dist workflow変更 |
| performance改善で機能欠落 | 数値は良いが操作不能 | 機能testと性能testを別gateにし両方成功を要求 |
| dirty worktreeの既存変更消失 | CSV/未追跡計測物が消える | reset/clean禁止、phase前後のstatusを保存 |

### 7.2 フェーズ単位のロールバック

1. Phase開始前に`git status --short`を保存し、既存の`yugioh_cards_master.csv`変更と未追跡ファイルを保護対象として記録する。
2. baseline test、該当画面のstorage snapshot、performance値、screenshotを保存する。
3. Phaseは一つの論理commitにまとめ、commit SHAとPages deployment URLを記録する。
4. 本番回帰時、UI feature flagがある場合はまず無効化する。flagはvisual/renderer切替に限定し、保存形式や認証を分岐させない。
5. commit済み変更を戻す場合は`git revert <phase-commit>`を使う。`git reset --hard`、force push、履歴改変は行わない。
6. revertをmainへpushし、既存`.github/workflows/deploy.yml`のPages deploy成功を確認する。artifactを手動上書きしない。
7. データ不整合の疑いがある場合はlocalStorage/IndexedDB keyを削除せず、snapshotと旧コードで再現する。Firebase/Workersのデータ削除・schema rollbackは本計画の範囲外であり、別途承認が必要。
8. rollback後に最低`verify_card_list.mjs`、`verify_sort.mjs`、`verify_gallery_master.mjs`、該当Phaseのtest、theme screenshotを再実行する。

### 7.3 データmigrationのロールバック規約

- key名を変えない改善は旧keyへ読み書きし続ける。
- schema追加が必要な場合は`schemaVersion`を追加し、旧fieldを最低1release残す。
- migrationは冪等にし、同じversionへ複数回実行しても結果が変わらないようにする。
- migration前の値を`dataBackup_<timestamp>`等へ保存する既存`DataStorageManager`の仕組みを利用する。
- cacheは再生成可能だが、collection、wishlist、battle record、banlist、duel save、supply tagをcache扱いして削除しない。

### 7.4 完了判定

各Phaseは次をすべて満たしたときだけ完了とする。

- 対象taskの受け入れ条件を満たす。
- 指定Playwrightが成功し、既知CORS以外のconsole/page errorが0。
- cold/warmのperformance値と条件を記録済み。
- light/dark、desktop/mobileをscreenshotで目視確認済み。
- 既存localStorage、IndexedDB、Firestore、Workers、画像cacheのcontractを壊していない。
- commit、push、Pages deploy成功、rollback対象SHAを記録済み。

build成功だけでは完了としない。実際のブラウザで対象操作を観測できない場合は「実装済み・未検証」と報告し、完了扱いにしない。
