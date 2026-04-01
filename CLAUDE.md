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
