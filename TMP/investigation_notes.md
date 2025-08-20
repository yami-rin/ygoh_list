# Investigation Notes - Battle Records Bug

## File Structure Found
- battle_records_v2.html - Main battle records management file with tournament system
- index.html - Large file (28964 tokens) - main application entry point
- test.html - Test file

## Key Findings in battle_records_v2.html

### Firebase Configuration (Line 366-376)
- Firebase is used for authentication and data storage
- Configuration includes visible API key (line 367: apiKey field is empty/hidden in grep output)
- Uses Firebase Auth and Firestore
- Firebase status indicator on line 189

### Potential Issues Identified
1. **Firebase API Key Issue (Line 367)**: The apiKey field appears to be empty or improperly configured
2. **Index reference (Line 195)**: There's a link to index.html from battle_records_v2.html
3. **Window.deletePreset function (Line 664-665)**: Uses array index directly which could cause issues

### Authentication System
- Uses email/password authentication
- Has local mode option (developer-only, not for public use - user enters "local" as email)
- Persistence set to browserLocalPersistence

## Next Steps
1. Check the Firebase apiKey configuration - this might be the "index" bug
2. Verify if Firebase is properly initialized
3. Check for any console errors or initialization issues

## The Bug
The user mentioned "battle_records.index" - this could refer to:
- An indexing issue in the battle_records arrays
- Firebase index configuration issue
- The apiKey being missing or incorrect