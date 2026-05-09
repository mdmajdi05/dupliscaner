# TODO: Fix Module System and SQLite Integration

**Started:** May 8, 2026
**Status:** In Progress

## Task Understanding

**Root Problem:** 
- lib/db-scan.js uses CommonJS (require) but lib/db.js uses ESM (import/export)
- They cannot work together → entire database layer is broken
- Data is not actually being written to SQLite

**What Must Be Done:**
1. Convert ALL lib files to ESM (import/export only)
2. Replace `sqlite3` npm package with `better-sqlite3` (synchronous, proper transactions)
3. Fix all column name mismatches with schema
4. Remove transactionDb complexity - use better-sqlite3's synchronous API
5. Fix ScanProcessor to actually persist files and duplicate groups to SQLite
6. Wire duplicate detection (handleDuplicateEvent) to update files with correct FK
7. Test end-to-end: scan → files in DB → files in API → files in duplicate groups query

## Affected Files

**lib/**
- db.js (convert to ESM + better-sqlite3)
- db-ops.js (convert to ESM)
- db-scan.js (convert to ESM)
- init-db.js (convert to ESM)
- state.js (if used by db layer)

**app/api/**
- scan/start/route.js (if imports from lib)
- fm/scan-bg/route.js (if imports from lib)
- duplicates/groups/route.js
- duplicates/groups/[hash]/route.js

**package.json**
- Replace sqlite3 with better-sqlite3

## Checklist

- [ ] **Step 1:** Read problem-and-guide.md fully ✓
- [ ] **Step 2:** Read lib/db.js and understand current ESM structure
- [ ] **Step 3:** Read lib/db-scan.js and identify all require() calls
- [ ] **Step 4:** Read lib/db-ops.js and fix function signatures
- [ ] **Step 5:** Read init-db.js and verify schema against code
- [ ] **Step 6:** npm install better-sqlite3
- [ ] **Step 7:** Convert lib/db.js to better-sqlite3 (synchronous API)
- [ ] **Step 8:** Convert lib/db-scan.js to ESM + fix column references
- [ ] **Step 9:** Convert lib/db-ops.js to ESM + fix signatures
- [ ] **Step 10:** Fix app/api/scan/start/route.js imports
- [ ] **Step 11:** Fix app/api/fm/scan-bg/route.js imports
- [ ] **Step 12:** Build and test: npm run build
- [ ] **Step 13:** Test: Manual scan → check DB → check API response
- [ ] **Step 14:** Verify files have duplicate_group_id set correctly
- [ ] **Step 15:** Verify API returns files in duplicate groups
- [ ] **Step 16:** Move TODO to docs/done/

## Critical Notes

- Do NOT skip any file read - understand before changing
- Test after each major change
- Database persistence MUST work - this is blocking everything
- handleDuplicateEvent MUST update files with duplicate_group_id
- API must return files in groups.files array
