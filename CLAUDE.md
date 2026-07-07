# card_manager_web 設定

## 技術スタック
- HTML / CSS / JavaScript (Vanilla)
- Bootstrap 5.3.0
- Firebase (Firestore, Auth)
- Workers: Cloudflare Workers (画像プロキシ)

## 作業方針
- `git push` やコミットは何かを完成させた場合に必ず行う
- 破壊的操作（ブランチ削除・force push 等）は必ず確認する

## ファイル構成メモ
- `card_list.html` + `css/card_list.css` + `js/card-list/main.js` : カードリスト（2026-07に分割済み）
- `js/shared/master-data.js` : マスターCSV共通ローダー（Workerパース+IndexedDBキャッシュ、ページ非依存。card_gallery等にも流用可）
- `tests/` : Playwright検証スクリプト（変更後は `node tests/verify_card_list.mjs` と `verify_sort.mjs` を流す。/ygoh-web-verify スキル参照）
- `card_gallery.html` : メインのカードギャラリー画面
- `options.html` : レアリティ順序・演出設定
- `image_cache_manager.js` : IndexedDB ベースの画像キャッシュ
- `mobile-responsive.css` : レスポンシブ対応
- `rarity_effects_sample.html` : レアリティ演出のサンプルページ（開発用）

## localStorage キー
| キー | 内容 |
|---|---|
| `customRarityOrder` | レアリティ並び順（配列） |
| `rarityEffectSettings` | レアリティ別演出設定（オブジェクト） |
| `galleryGridSize` | グリッドサイズ |
| `gallerySortOrder` | ソート順 |
