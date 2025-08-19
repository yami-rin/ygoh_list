# undefined値エラーの修正

## エラー内容
```
Function addDoc() called with invalid data. 
Unsupported field value: undefined
```

## 原因
Firestoreはundefined値を受け付けない。
オプションフィールドが未入力の場合、undefinedがそのまま送信されていた。

## 修正内容

### saveRecord関数の修正
1. 必須フィールドのみ最初に設定
2. オプションフィールドは値がある場合のみ追加
3. 空文字列もundefinedと同様に除外

### 修正後のデータ構造
```javascript
// 必須フィールド
recordData = {
    date,
    format, 
    myDeck,
    result,
    updatedAt
}

// オプションフィールド（値がある場合のみ追加）
if (tournament) recordData.tournament = tournament;
if (store) recordData.store = store;
if (opponentDeck) recordData.opponentDeck = opponentDeck;
// ... etc
```

## テスト項目
- [ ] 必須項目のみで保存できる
- [ ] オプション項目を入力しても保存できる
- [ ] マッチ戦の詳細も正しく保存される
- [ ] 編集時にデータが正しく復元される