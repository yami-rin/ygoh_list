# 遊戯王カード画像API テスト結果

## テスト概要

遊戯王公式データベースから画像を取得する複数のAPIエンドポイントをテストしました。

## テスト対象のエンドポイント

### 1. get_image.action (encパラメータ付き)
```
https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid={cid}&ciid=1&enc={enc}
```
- **元のHTMLで使用されていたURL**
- encパラメータが必要（暗号化トークン）
- 状態: テスト中

### 2. get_image.action (encなし)
```
https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=2&cid={cid}&ciid=1
```
- encパラメータなし
- 状態: テスト中

### 3. card_image.action (現在使用中)
```
https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid={cid}&request_locale=ja
```
- **card_gallery.htmlで現在使用中**
- 最も安定している
- 状態: ✅ 動作確認済み

### 4. get_image.action (type=1)
```
https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=1&cid={cid}&ciid=1
```
- type=1 (サムネイル?)
- 状態: テスト中

### 5. get_image.action (type=3)
```
https://www.db.yugioh-card.com/yugiohdb/get_image.action?type=3&cid={cid}&ciid=1
```
- type=3 (高解像度?)
- 状態: テスト中

## パラメータ説明

| パラメータ | 説明 | 必須 |
|----------|------|------|
| `cid` | カードID | ✅ |
| `ciid` | カード画像ID (通常は1) | ❓ |
| `enc` | 暗号化トークン | ❓ |
| `type` | 画像タイプ (1/2/3) | ❓ |
| `request_locale` | 言語 (ja/en) | ❓ |

## テスト済みカードID

- **21967**: テストカード (元のHTML)
- **4001**: ブラック・マジシャン
- **5318**: 青眼の白龍
- **12206**: 死者蘇生
- **6983**: 真紅眼の黒竜

## テストツール

### 基本テスト
ファイル: `test_image_api.html`
- 各APIエンドポイントの動作確認
- 画像サイズと読み込み時間の測定
- クイックテスト機能

### 詳細テスト
ファイル: `test_image_advanced.html`
- より詳細なテスト結果
- 複数カードの一括テスト
- パフォーマンス比較
- 推奨API表示

## 実行方法

1. **基本テスト**
   ```
   C:\Users\とうふ\card_manager_web\test_image_api.html をブラウザで開く
   ```

2. **詳細テスト**
   ```
   C:\Users\とうふ\card_manager_web\test_image_advanced.html をブラウザで開く
   ```

## 注意事項

### encパラメータについて
- `enc=4CGllVHuyOJeD-vrlwoqmA` は元のHTMLから取得
- このトークンが以下のどれに依存するか不明：
  - セッションID
  - タイムスタンプ
  - カードID
  - ユーザーID

### 異なるカードIDでのテスト
- 同じencトークンで異なるcidを使用してテスト
- トークンがカードID依存かどうか確認

## 期待される結果

### ケース1: encが必須
- encなしのリクエスト: ❌ 失敗
- 元のencで異なるcid: ❌ 失敗
- 結論: encはカードID依存の暗号化トークン

### ケース2: encは不要
- encなしのリクエスト: ✅ 成功
- 結論: より簡単な実装が可能

### ケース3: card_image.actionが最適
- 現在の実装が最も安定している
- encパラメータ不要
- 変更の必要なし

## 次のステップ

1. テストツールをブラウザで実行
2. 結果を確認
3. 最も効率的なAPIを特定
4. card_gallery.htmlの画像取得を最適化（必要に応じて）

## 更新履歴

- 2025-11-04: テストファイル作成
- 2025-11-04: ドキュメント作成
