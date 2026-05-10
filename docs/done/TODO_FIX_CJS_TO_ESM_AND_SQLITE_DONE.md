# TODO: Fix CJS to ESM + sqlite3 to better-sqlite3
**Started:** 2026-05-10
**Status:** DONE
**Completed:** 2026-05-10

## Task Understanding
Convert all CJS files to ESM and replace sqlite3 package with better-sqlite3 across the entire codebase. This fixes the module mismatch bugs identified in the problem guide.

## Affected Files
- lib/db.js (sqlite3 → better-sqlite3)
- lib/db-scan.js (CJS → ESM)
- lib/scanner-worker.js (CJS → ESM)
- package.json (add better-sqlite3, remove sqlite3)
- next.config.mjs (add better-sqlite3 to externals)
- check-db.js (sqlite3 → better-sqlite3 + ESM)
- lib/db-ops.js (async → sync)

## Steps
- [x] Step 1: Update package.json - replace sqlite3 with better-sqlite3
- [x] Step 2: Update next.config.mjs - add better-sqlite3 to externals
- [x] Step 3: Rewrite lib/db.js - convert to better-sqlite3 (synchronous API)
- [x] Step 4: Convert lib/db-scan.js from CJS to ESM
- [x] Step 5: Convert lib/scanner-worker.js from CJS to ESM
- [x] Step 6: Update check-db.js to ESM + better-sqlite3
- [x] Step 7: Update lib/db-ops.js to use synchronous functions
- [x] Step 8: Run npm install
- [x] Step 9: Test build - SUCCESS

## Summary of Changes

### package.json
- Replaced `sqlite3: ^6.0.1` with `better-sqlite3: ^12.9.0`

### next.config.mjs
- Added `better-sqlite3` to externals array

### lib/db.js
- Converted from sqlite3 async callbacks to better-sqlite3 synchronous API
- Fixed cross-platform DB path (Windows/Linux/Mac)
- Uses better-sqlite3 transactions for batch operations

### lib/db-scan.js
- Converted from CJS (require/module.exports) to ESM (import/export)
- Updated to use synchronous db-ops functions
- Fixed upsertDuplicateGroup call to include 4th argument (fileSize)
- Fixed markScanComplete to pass stats object
- Fixed scan_events column name from 'details' to 'data'

### lib/scanner-worker.js
- Converted from CJS to ESM

### lib/db-ops.js
- Converted all async functions to synchronous (since db functions are now sync)
- Fixed markScanComplete to not reference updated_at column

### check-db.js
- Converted from CJS + sqlite3 to ESM + better-sqlite3
- Fixed cross-platform DB path