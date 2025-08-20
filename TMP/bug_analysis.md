# Bug Analysis - battle_records.index

## Bug Found!
**Location**: battle_records_v2.html, lines 651-677
**Type**: Array index synchronization bug

## Problem Description
The `deletePreset` function has an index bug:

1. Line 651-661: When rendering presets, each preset gets a delete button with `onclick="deletePreset(${index})"`
2. Line 664-665: The deletePreset function uses `splice(index, 1)` to remove the item
3. Line 677: After deletion, `loadPresetList()` is called to re-render

### The Issue:
- The HTML onclick handlers are created with hardcoded array indices
- When an item is deleted from the middle of the array, all subsequent indices shift
- The HTML still has the old indices until the page is refreshed
- This causes the wrong preset to be deleted when clicking delete buttons after one deletion

### Example Scenario:
1. Start with presets: [A(0), B(1), C(2), D(3)]
2. Delete B at index 1
3. Array becomes: [A(0), C(1), D(2)]
4. But HTML buttons still have: A=0, C=2, D=3
5. Clicking delete on D tries to delete index 3, which doesn't exist

## Solution
Instead of using array indices, we should:
1. Add unique IDs to each preset
2. Pass the preset ID or name to deletePreset
3. Find and delete by ID/name instead of index

OR simpler fix:
- Call loadPresetList() immediately after rendering to ensure fresh indices

## Files to Fix
- battle_records_v2.html (lines 656 and 664-665)