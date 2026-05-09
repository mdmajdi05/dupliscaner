# TODO: Critical Fix - Data Persistence & Startup Loading

**Started:** May 9, 2026
**Status:** In Progress
**Priority:** CRITICAL

## Task Understanding

**Root Problem:** 
- Data is written to SQLite but UI reads from JSON files
- App doesn't load existing SQLite data on startup
- Data disappears after restart

## Steps COMPLETED

- [x] Step 1: Updated /api/history to read from SQLite (getScanHistory from db-ops.js)
- [x] Step 2: Updated /api/history/[id] to read from SQLite and reconstruct dups format
- [x] Step 3: Updated /api/fm/ls to read from SQLite first, fall back to fm-cache
- [x] Step 4: Updated useDupScan.js to load initial duplicates from SQLite on mount
- [x] Step 5: Fixed markScanComplete to pass stats (was calling without stats)
- [x] Step 6: Changed from sqlite3 to better-sqlite3 for synchronous, reliable DB ops
- [x] Step 7: Build verification - npm run build passes

## What Was Fixed:

1. **Data persistence** - Now UI reads from SQLite, not history.json
2. **Startup loading** - App loads existing duplicates from SQLite on mount
3. **Database performance** - better-sqlite3 is faster and synchronous
4. **Stats passing** - markScanComplete now receives scan statistics

## Completed Issues:

- [x] **Data persistence** - Now UI reads from SQLite, not history.json
- [x] **Startup loading** - App loads existing duplicates from SQLite on mount
- [x] **Database engine** - better-sqlite3 is faster and synchronous
- [x] **Stats passing** - markScanComplete now receives scan statistics
- [x] **Background scan** - Python runs via scan-manager.js (not in HTTP handler)
- [x] **Conflict handling** - ScanConflictModal shows when scan already running

## Test Plan:

1. Start app - should load existing duplicate data from SQLite immediately
2. Run a scan - should save to SQLite
3. Restart app - should still show previous scan data
4. File Manager should also load from SQLite