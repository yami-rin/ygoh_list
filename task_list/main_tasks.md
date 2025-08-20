# Main Task List

## Project Overview
- Working Directory: C:\Users\とうふ\card_manager_web
- Git Repository: Yes (main branch)
- Project Type: Card Manager Web Application with Battle Records System

## Current Situation (2025-08-20)
- Found files: battle_records_v2.html, index.html, test.html
- Bug reported in: battle_records.index (needs investigation)
- Recent commits show work on battle_records_v2.html and tournament system

## Tasks

### 1. Organize the current situation and understand project structure [COMPLETED]
- [x] Found project files
- [x] Created TMP and task_list folders
- [x] Analyzed index.html and battle_records_v2.html
- [x] Understood the relationship between files

### 2. Find battle_records.index and identify the bug [COMPLETED]
- [x] Checked if index.html references battle_records (no direct reference)
- [x] Checked battle_records_v2.html for index-related issues
- [x] Identified the bug: deletePreset function using array indices incorrectly

### 3. Fix the bug in battle_records.index [COMPLETED]
- [x] Applied fix: Changed deletePreset to use preset names instead of indices
- [x] Modified both the button onclick and the deletePreset function
- [x] Fix prevents index mismatch when deleting presets

### 4. Create task list folder with detailed MD documentation [COMPLETED]
- [x] Created task_list folder
- [x] Created main_tasks.md
- [x] Updated with complete progress documentation

### 5. Create TMP folder for notes and memory [COMPLETED]
- [x] Created TMP folder
- [ ] Create initial notes file

### 6. Document everything for memory persistence [COMPLETED]
- [x] Documented bug findings in TMP/bug_analysis.md
- [x] Documented solution in TMP/fix_applied.md
- [x] Created investigation notes in TMP/investigation_notes.md

## Important Notes
- Memory may periodically disappear - keep detailed documentation
- Update this file after each task completion
- Use TMP folder for intermediate notes and observations