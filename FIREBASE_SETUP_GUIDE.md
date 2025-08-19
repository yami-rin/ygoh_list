# Firebase サーバーでbattle_recordsを動作させる完全ガイド

## 前提条件
- Cloud Firestore API: ✅ 有効
- Identity Toolkit API: ✅ 有効

## 📋 設定手順

### ステップ1: Firebaseコンソールにアクセス
1. https://console.firebase.google.com/ にアクセス
2. プロジェクト「card-manager-4c86c」を選択

---

### ステップ2: Firestoreセキュリティルールの設定

1. 左メニューから「**Firestore Database**」をクリック
2. 上部タブから「**ルール**」を選択
3. 以下のルールを**すべて削除してから**コピー＆ペースト：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // カード管理用コレクション
    match /cards/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 戦績管理用コレクション（重要！）
    match /battleRecords/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // その他のコレクション
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. 「**公開**」ボタンをクリック
5. 公開完了のメッセージが表示されるまで待つ（約1-2分）

---

### ステップ3: Firestoreインデックスの作成

battleRecordsコレクションに複合インデックスが必要です。

#### 方法A: 自動作成（推奨）
1. https://yami-rin.github.io/ygoh_list/battle_records.html にアクセス
2. Firebaseアカウントでログイン
3. エラーが出た場合、コンソールにインデックス作成用のリンクが表示される
4. リンクをクリックして「インデックスを作成」

#### 方法B: 手動作成
1. Firebaseコンソールで「**Firestore Database**」→「**インデックス**」タブ
2. 「**インデックスを作成**」をクリック
3. 以下の設定：
   - **コレクションID**: `battleRecords`
   - **フィールド1**: `userId` (昇順)
   - **フィールド2**: `date` (降順)
   - **クエリスコープ**: コレクション
4. 「**作成**」をクリック（作成完了まで5-10分）

---

### ステップ4: Authentication設定の確認

1. 左メニューから「**Authentication**」をクリック
2. 「**Sign-in method**」タブを選択
3. 「**メール/パスワード**」が有効になっていることを確認
   - 無効の場合：クリックして有効化

---

### ステップ5: 動作確認

1. **ブラウザのキャッシュをクリア**（重要！）
   - Chrome: Ctrl + Shift + Delete
   - 「キャッシュされた画像とファイル」を選択
   - 「データを削除」

2. **battle_recordsにアクセス**
   - https://yami-rin.github.io/ygoh_list/battle_records.html

3. **新規アカウントでテスト**
   - メールアドレス: test@example.com（任意）
   - パスワード: 任意の6文字以上
   - 「新規登録」をクリック

4. **戦績を追加**
   - 必須項目を入力
   - 「保存」をクリック
   - エラーが出ないことを確認

---

## 🔧 トラブルシューティング

### エラー: permission-denied
**原因**: セキュリティルールが正しく設定されていない
**解決策**: 
- ステップ2のルールを再度設定
- 「公開」後、2-3分待ってから再試行

### エラー: failed-precondition
**原因**: インデックスが作成されていない
**解決策**: 
- ブラウザのコンソール（F12）を確認
- 表示されるリンクをクリックしてインデックス作成
- 5-10分待ってから再試行

### エラー: HTTP 400
**原因**: Firebase SDKのバージョン問題
**解決策**: 
- ブラウザキャッシュをクリア
- ページを強制リロード（Ctrl + F5）

### エラー: undefined field value
**原因**: データ検証の問題（修正済み）
**解決策**: 
- 最新版を使用していることを確認
- キャッシュクリア後に再試行

---

## ✅ 確認ポイントチェックリスト

- [ ] Firestoreセキュリティルールに`battleRecords`が含まれている
- [ ] ルールを「公開」した
- [ ] メール/パスワード認証が有効
- [ ] ブラウザキャッシュをクリアした
- [ ] 最新版のコードを使用している（GitHub Pages）

---

## 📝 重要な注意事項

1. **セキュリティルールは必須**
   - `battleRecords`コレクションへのアクセス許可が必要
   - ルール変更後は必ず「公開」をクリック

2. **インデックス作成には時間がかかる**
   - 自動作成：5-10分
   - エラーが続く場合は作成完了を待つ

3. **キャッシュクリアは重要**
   - 古いバージョンのコードが残っていると動作しない
   - 問題が続く場合はシークレットウィンドウで試す

---

## 🎯 最終確認

すべて設定後、以下を確認：
1. ログインできる
2. 戦績を追加できる
3. 追加した戦績が一覧に表示される
4. 編集・削除ができる

問題が解決しない場合は、エラーメッセージと共にお知らせください。