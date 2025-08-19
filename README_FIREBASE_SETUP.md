# Firebase セットアップガイド

## Firestoreセキュリティルールの設定

このアプリケーションを正常に動作させるには、Firebaseコンソールでセキュリティルールを設定する必要があります。

### 手順

1. **Firebaseコンソールにアクセス**
   - https://console.firebase.google.com/
   - プロジェクト「card-manager-4c86c」を選択

2. **Firestore Databaseを開く**
   - 左メニューから「Firestore Database」を選択
   - 上部タブから「ルール」を選択

3. **以下のルールをコピー＆ペースト**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザー認証の確認
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // ドキュメントの所有者確認
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // カード管理コレクション
    match /cards/{cardId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
      allow update: if isAuthenticated() && isOwner(resource.data.userId);
      allow delete: if isAuthenticated() && isOwner(resource.data.userId);
    }
    
    // 戦績管理コレクション
    match /battleRecords/{recordId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
      allow update: if isAuthenticated() && isOwner(resource.data.userId);
      allow delete: if isAuthenticated() && isOwner(resource.data.userId);
    }
  }
}
```

4. **「公開」ボタンをクリック**

## トラブルシューティング

### 「Permission denied」エラーが出る場合

一時的に以下のルールでテストできます（**開発環境のみ**）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### ローカルモードの使用

Firebaseを使わずにローカルで動作させる場合：
1. ログイン画面でメールアドレスに「local」と入力
2. パスワードは任意の文字列
3. データはブラウザのローカルストレージに保存されます

## 注意事項

- セキュリティルールは本番環境では慎重に設定してください
- ユーザーは自分のデータのみアクセス可能になっています
- ルール変更後、反映まで数分かかる場合があります