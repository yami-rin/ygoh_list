# Firebase 400エラーの解決

## エラー内容
```
[2025-08-19T15:27:46.465Z]  @firebase/firestore: Firestore (9.15.0): Connection WebChannel transport errored
HTTP/3 400
```

## 原因
1. Firebase SDKのバージョンが古い（9.15.0）
2. serverTimestamp がインポートされていない
3. Firebase設定の不整合

## 解決策
1. Firebase SDKを最新版（10.x）に更新
2. serverTimestamp を正しくインポート
3. 初期化コードの修正