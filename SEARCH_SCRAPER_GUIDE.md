# 遊戯王検索結果スクレイパー ガイド

## 概要

遊戯王公式データベースの検索結果ページからカード情報を抽出し、画像URLを取得するツールです。

## 作成したツール

### 1. yugioh_search_scraper.html
**機能**: 検索結果ページからカードIDを抽出

**特徴**:
- 複数の抽出方法を試行
- リアルタイムで画像を表示
- 実装コードを自動生成
- 既知のカードIDでテスト可能

**使い方**:
1. ブラウザでファイルを開く
2. 検索結果URLを入力
3. 「スクレイピング開始」をクリック
4. 抽出されたカードと画像を確認

### 2. yugioh_bulk_import.html
**機能**: 検索結果から直接card_list.htmlにインポート

**特徴**:
- Firebase認証と連携
- 進捗表示機能
- カード選択機能
- マスターデータとの照合

**使い方**:
1. card_list.htmlでログイン
2. このツールを開く
3. 検索結果URLを入力またはクイック検索を選択
4. カードを選択してインポート

## カードID抽出の仕組み

### 方法1: JavaScript内の画像URLから抽出
```javascript
const imageUrlRegex = /get_image\.action\?[^'"]*(cid=(\d+))[^'"]*/g;
```

検索結果ページのHTMLには以下のようなJavaScriptコードが含まれています：
```javascript
$('#card_image_1_1').attr('src', '/yugiohdb/get_image.action?type=1&cid=21385&ciid=1&enc=...')
```

このパターンからカードID（cid）を抽出します。

### 方法2: カード詳細ページのリンクから抽出
```javascript
const detailLinkRegex = /card_search\.action\?ope=2[^'"]*cid=(\d+)/g;
```

カード詳細へのリンク：
```html
<a href="card_search.action?ope=2&cid=4001">詳細</a>
```

### 方法3: card_image.actionエンドポイントを使用
抽出したcidから画像URLを構築：
```javascript
const imageUrl = `https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid=${cid}&request_locale=ja`;
```

## CORS問題の解決

### 問題
JavaScriptから直接遊戯王公式DBにアクセスするとCORSエラーが発生します。

### 解決策1: CORSプロキシ
```javascript
const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
const response = await fetch(proxyUrl);
```

### 解決策2: サーバーサイド実装
Node.jsやPythonでサーバーサイドからスクレイピング

## クイック検索URL

### 最新カード（1999年以降）
```
https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=100&sort=1&releaseDStart=1&releaseMStart=1&releaseYStart=1999
```

### モンスターカードのみ
```
https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=100&sort=1&ctype=1
```

### 魔法カードのみ
```
https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=100&sort=1&ctype=2
```

### 罠カードのみ
```
https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=100&sort=1&ctype=3
```

## URLパラメータ解説

| パラメータ | 説明 | 値の例 |
|-----------|------|--------|
| `ope` | 操作タイプ | 1=検索, 2=詳細 |
| `sess` | セッションID | 1 |
| `rp` | 1ページあたりの表示件数 | 10, 20, 50, 100 |
| `sort` | ソート順 | 1=名前, 2=発売日 |
| `keyword` | キーワード検索 | カード名 |
| `ctype` | カードタイプ | 1=モンスター, 2=魔法, 3=罠 |
| `othercon` | その他条件 | 2=OCGのみ |
| `releaseYStart` | 発売年（開始） | 1999 |

## 実装例

### カードIDを抽出
```javascript
async function extractCardIdsFromSearchURL(searchUrl) {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`;
    const response = await fetch(proxyUrl);
    const html = await response.text();

    const cardIds = [];
    const regex = /cid=(\d+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        if (!cardIds.includes(match[1])) {
            cardIds.push(match[1]);
        }
    }

    return cardIds;
}
```

### 画像URLを生成
```javascript
function getCardImageUrl(cardId) {
    return `https://www.db.yugioh-card.com/yugiohdb/card_image.action?cid=${cardId}&request_locale=ja`;
}
```

### card_list.htmlに追加
```javascript
async function importFromSearchURL(searchUrl) {
    const cardIds = await extractCardIdsFromSearchURL(searchUrl);

    for (const cid of cardIds) {
        const imageUrl = getCardImageUrl(cid);
        // カード情報をFirestoreに保存
        await addDoc(collectionRef, {
            '名前': `カードID: ${cid}`,
            '型番': '',
            'レアリティ': '',
            '枚数': '1',
            'tags': []
        });
    }
}
```

## 制限事項

### 1. CORS制限
- ブラウザから直接アクセスにはプロキシが必要
- プロキシサービスの利用制限に注意

### 2. レート制限
- 連続リクエストは避ける
- インポート時は適切な間隔を空ける

### 3. データの正確性
- カード名はマスターデータとの照合が必要
- 型番やレアリティは手動入力が必要な場合がある

## トラブルシューティング

### カードIDが抽出できない
1. URLが正しいか確認
2. CORSプロキシが動作しているか確認
3. 「既知のカードIDでテスト」を試す

### 画像が表示されない
1. カードIDが正しいか確認
2. 画像URLのフォーマットを確認
3. ブラウザの開発者ツールでエラーを確認

### インポートが失敗する
1. ログインしているか確認
2. Firebase接続を確認
3. コンソールでエラーメッセージを確認

## 今後の拡張案

1. **カード情報の自動取得**
   - カード名、型番、レアリティを自動入力

2. **バッチ処理**
   - 複数ページを自動でスクレイピング

3. **重複チェック**
   - 既存カードとの重複を確認

4. **進捗保存**
   - インポート途中で中断しても再開可能

## 参考リンク

- [遊戯王公式カードデータベース](https://www.db.yugioh-card.com/)
- [CORSプロキシ](https://corsproxy.io/)

## 更新履歴

- 2025-11-04: 初版作成
- 2025-11-04: スクレイパーツール実装
- 2025-11-04: 一括インポート機能追加
