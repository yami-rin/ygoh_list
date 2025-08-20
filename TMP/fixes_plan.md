# Fixes Plan

## 1. Tournament Preset Issue
- Line 1017-1018: Variable name collision - using `doc` as both function and variable
- Need to fix: `const doc = await getDoc(doc(db, 'users', currentUser.uid));`
- Should be: `const userDoc = await getDoc(doc(db, 'users', currentUser.uid));`

## 2. Remove Single Record Button
- Find and remove "単発成績" button
- Remove associated modal and functions

## 3. Group Tournament Rounds
- Create collapsible groups for tournament rounds
- Show tournament name with expand/collapse button
- Display all rounds when expanded

## 4. Dark Mode Implementation
- Add dark mode toggle in settings
- Store preference in localStorage
- Apply dark theme classes

## 5. Remove Firebase Status
- Remove Firebase接続OK display from navbar