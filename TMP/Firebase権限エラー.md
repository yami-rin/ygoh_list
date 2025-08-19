# Firebase権限エラーの解決

## エラー内容
```
[code=permission-denied]: Permission denied on resource project card-manager-4c86c
HTTP/3 400
```

## 原因
1. Firestoreのセキュリティルールが適切に設定されていない
2. battleRecordsコレクションへの書き込み権限がない

## 必要なFirestoreセキュリティルール

Firebaseコンソールで以下のルールを設定する必要があります：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // カード管理用
    match /cards/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // 戦績管理用（追加が必要）
    match /battleRecords/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

## 一時的な解決策

開発中は以下のルールでテスト可能（本番環境では使用しないこと）：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## ローカルモードでの回避

ローカルモードを使用すれば、Firebaseを使わずにローカルストレージで動作可能：
- メールアドレスに「local」と入力
- パスワードは任意
- データはブラウザのローカルストレージに保存される