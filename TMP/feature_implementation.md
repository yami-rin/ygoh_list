# Feature Implementation Plan

## 1. Tournament Name Search
- Add tournament name search field to filter form
- Update applyFilters function to include tournament name

## 2. Fix Column Alignment
- Ensure tournament header columns align with regular rows
- Fix colspan issues

## 3. BO3 Match Support
- Add match format selection (Single/BO3)
- For BO3: Add fields for each game result (○/×)
- Store as: "○×○" format for 2-1 win

## 4. Tweet Button Template
Format:
```
"大会名" 使用"使用デッキ"
"相手デッキ" "先/後""○×○"
"相手デッキ" "先/後""○××"
"コメント"
"サイトURL"
```

## Implementation Steps:
1. Add tournament search field
2. Fix table alignment
3. Add BO3 toggle and game result inputs
4. Add tweet button with formatted output
5. Store BO3 results in database