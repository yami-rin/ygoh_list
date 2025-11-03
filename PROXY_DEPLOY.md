# 遊戯王画像プロキシサーバー デプロイ手順

## 概要
このドキュメントでは、画像プロキシサーバーをクラウドにデプロイする方法を説明します。

---

## 方法1: Render.com でデプロイ（推奨・最も簡単）

### 手順

1. **Render.comにアクセス**
   - https://render.com/ にアクセス
   - GitHubアカウントでサインアップ/ログイン

2. **新しいWeb Serviceを作成**
   - ダッシュボードで「New +」→「Web Service」を選択
   - GitHubリポジトリ `yami-rin/ygoh_list` を接続

3. **設定を入力**
   - **Name**: `yugioh-image-proxy`（任意の名前）
   - **Region**: `Singapore` または `Oregon`（近い方を選択）
   - **Branch**: `main`
   - **Root Directory**: （空白のまま）
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node image_proxy_server.js`
   - **Plan**: `Free`

4. **デプロイ開始**
   - 「Create Web Service」をクリック
   - 自動的にビルド・デプロイが開始されます（5-10分）

5. **デプロイURLを取得**
   - デプロイ完了後、URLが表示されます
   - 例: `https://yugioh-image-proxy.onrender.com`

6. **動作確認**
   - `https://your-app.onrender.com/health` にアクセス
   - `{"status":"OK","message":"Image proxy server is running"}` が表示されればOK

7. **card_gallery.html を更新**
   - 後述の「フロントエンド設定」を参照

### メリット
- ✅ 無料プラン
- ✅ 自動デプロイ（GitHubにpushすると自動更新）
- ✅ HTTPS対応
- ✅ 設定が簡単

### デメリット
- ⚠️ 無料プランは非アクティブ時にスリープ（初回アクセスに数秒かかる）
- ⚠️ 月750時間まで（実質問題なし）

---

## 方法2: Vercel でデプロイ

### 手順

1. **Vercelにアクセス**
   - https://vercel.com/ にアクセス
   - GitHubアカウントでサインアップ/ログイン

2. **新しいプロジェクトをインポート**
   - 「Add New...」→「Project」を選択
   - GitHubリポジトリ `yami-rin/ygoh_list` をインポート

3. **設定を入力**
   - **Project Name**: `yugioh-image-proxy`
   - **Framework Preset**: `Other`
   - **Root Directory**: （空白のまま）
   - **Build Command**: `npm install`（オーバーライド不要）
   - **Output Directory**: （空白のまま）

4. **デプロイ開始**
   - 「Deploy」をクリック
   - 自動的にビルド・デプロイが開始されます（3-5分）

5. **デプロイURLを取得**
   - デプロイ完了後、URLが表示されます
   - 例: `https://yugioh-image-proxy.vercel.app`

6. **動作確認**
   - `https://your-app.vercel.app/health` にアクセス

### メリット
- ✅ 無料プラン
- ✅ 高速
- ✅ 自動デプロイ
- ✅ スリープしない

### デメリット
- ⚠️ サーバーレス関数として動作（10秒タイムアウト）
- ⚠️ 大量リクエストには向かない

---

## 方法3: Railway でデプロイ

### 手順

1. **Railwayにアクセス**
   - https://railway.app/ にアクセス
   - GitHubアカウントでサインアップ/ログイン

2. **新しいプロジェクトを作成**
   - 「New Project」→「Deploy from GitHub repo」を選択
   - `yami-rin/ygoh_list` を選択

3. **設定**
   - 自動的に検出されます
   - Start Command: `node image_proxy_server.js`

4. **デプロイURLを取得**
   - Settings → Networking → Generate Domain

### メリット
- ✅ 無料プラン（$5クレジット/月）
- ✅ スリープしない
- ✅ 設定が簡単

---

## フロントエンド設定

デプロイ後、フロントエンド（card_gallery.html、image_cache_manager.js）のプロキシURLを更新する必要があります。

### 自動切り替えを実装

`image_cache_manager.js` のデフォルトプロキシURLを更新：

```javascript
// デプロイしたURLに変更
const PROXY_URL = 'https://your-app.onrender.com'; // または Vercel URL
```

または、環境に応じて自動切り替え：

```javascript
const PROXY_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://your-app.onrender.com';
```

---

## トラブルシューティング

### Renderでスリープから復帰しない
- 無料プランは15分非アクティブでスリープします
- 初回アクセス時に30秒ほど待ってください

### CORSエラーが発生する
- プロキシサーバーが正しく動作しているか確認
- `/health` エンドポイントにアクセスして確認

### 画像が表示されない
- ブラウザのコンソールでエラーを確認
- プロキシURLが正しいか確認
- 遊戯王公式サイトがアクセス制限をかけていないか確認

---

## 推奨デプロイ方法

**初めての方**: Render.com（最も簡単）
**高速重視**: Vercel
**常時稼働**: Railway（有料プランに移行可能）

---

## 次のステップ

1. 上記のいずれかの方法でデプロイ
2. デプロイURLを取得
3. `card_gallery.html` のプロキシURL設定を更新
4. GitHubにpush
5. 本番環境で動作確認
