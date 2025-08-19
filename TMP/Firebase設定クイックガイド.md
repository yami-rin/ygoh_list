# Firebase設定 クイックガイド（5分で完了）

## 🚀 最速設定手順

### 1. Firestoreルール設定（2分）
1. https://console.firebase.google.com/ 
2. Firestore Database → ルール
3. 全文削除して以下をペースト：

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
4. 「公開」をクリック

### 2. ブラウザ準備（1分）
1. Ctrl + Shift + Delete でキャッシュクリア
2. 「キャッシュされた画像とファイル」にチェック
3. 「データを削除」

### 3. 動作テスト（2分）
1. https://yami-rin.github.io/ygoh_list/battle_records.html
2. 新規登録：
   - メール: test@test.com
   - パスワード: test123
3. 戦績追加してテスト

## ⚠️ それでもエラーが出る場合

### インデックスエラーの場合
1. ブラウザコンソール（F12）を開く
2. エラーメッセージ内のリンクをクリック
3. 「インデックスを作成」をクリック
4. 5分待って再試行

### 権限エラーの場合
1. Firebaseコンソールでルールが「公開」されているか確認
2. 2-3分待って再試行

## 💡 最終手段
問題が続く場合、一時的に以下のルールを使用：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // 全許可（テスト用）
    }
  }
}
```
※本番環境では使用しないこと