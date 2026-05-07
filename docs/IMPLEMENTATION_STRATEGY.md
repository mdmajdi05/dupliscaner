# IMPLEMENTATION STRATEGY - Detailed Migration Path

## Overview

This document outlines a **step-by-step migration** from the current JSON-based system to a production-ready SQLite + Worker State system, WITHOUT breaking existing features.

The approach is **incremental** - each phase builds on previous phases, with regular testing.

---

## Phase-by-Phase Breakdown

---

## PHASE 2: Core Database Infrastructure Setup

### Objective
Set up SQLite, create schema, and establish connection management.

**Duration:** 1-2 days

**Deliverable:** App can create/open SQLite DB, run queries

### Steps

#### 2.1 Create Database Module: `lib/db.js`
- Singleton SQLite connection
- Connection pooling (max 5 concurrent)
- Error handling + auto-recovery
- Migration runner

#### 2.2 Create Initialization Module: `lib/init-db.js`
- Run on app startup
- Create tables if not exist
- Check schema version
- Auto-migrate if needed

#### 2.3 Create Migration System: `lib/migrations/`
- Migration files: `001_create_tables.js`, `002_add_indexes.js`, etc
- Track which migrations have run
- Allow rollback
- Version stored in DB

#### 2.4 Add Package Dependencies
- `better-sqlite3` or `sqlite3` package
- Minimal, reliable, tested

#### 2.5 Test Locally
- DB created in correct location
- Tables created with correct schema
- Connection works
- Errors handled gracefully

---

## PHASE 3: Python Scanner Enhancement

### Objective
Extend scanner.py to support BOTH duplicate detection AND full file listing.

**Duration:** 1-2 days

**Deliverable:** Python script supports `--mode=duplicates|full` and incremental mode

### Changes to `scanner.py`

#### 3.1 Add Mode Support
```python
# Current behavior (keep it):
--path C:\Users --mode=duplicates  # Find only duplicates

# New behavior (add it):
--path C:\Users --mode=full        # List all files with metadata
```

#### 3.2 Add Incremental Mode
```python
--previous-hashes previous_hashes.json  # File containing previously hashed files
# Includes: path, size, mtime, hash
# Script skips files with matching size+mtime
```

#### 3.3 Improve Output Format
- Change from `{type: ...}` to structured event format
- Each line: `{event, data}`
- Events: `file_found`, `file_skipped`, `duplicate_detected`, `hash_calculated`, `progress`, `complete`

#### 3.4 Example New Output Format
```json
{"event": "phase", "value": "scanning"}
{"event": "file_found", "path": "/foo/file.txt", "size": 1024, "mtime": 1234567890}
{"event": "file_skipped", "path": "/bar/file.jpg", "reason": "unchanged"}
{"event": "hash_progress", "hashed": 100, "total": 500}
{"event": "duplicate_found", "hash": "abc123", "files": ["/foo/1.jpg", "/foo/2.jpg"], "size": 512000}
{"event": "complete", "mode": "duplicates", "total_files": 5000, "duplicates_found": 45}
```

#### 3.5 Test
- Run with --mode=duplicates on test folder
- Run with --mode=full on test folder
- Run with --previous-hashes (incremental) on test folder
- Verify output format

---

## PHASE 4A: Create Database Write Layer

### Objective
Build reusable functions to write scan results to SQLite atomically.

**Duration:** 1 day

**Deliverable:** `lib/db-scan.js` with all DB write operations

### Create `lib/db-scan.js`

```javascript
// This module handles all database writes for scans

export async function beginScan(scanId, scanType, rootPath, includeHidden) {
  // Insert into scan_history
  // Update worker_state (atomic check-and-set)
  // Return scan record
}

export async function insertBatchFiles(files) {
  // INSERT/UPDATE files table
  // Batched for performance (1000s at once)
  // Disable indexes, insert, rebuild indexes
}

export async function updateFileDuplicate(hash, fileIds, wasteBytes) {
  // UPDATE files.is_duplicate, duplicate_group_id
  // INSERT into duplicate_groups if new
  // Update count
}

export async function markScanComplete(scanId, stats) {
  // UPDATE scan_history.completed_at, status, stats
  // UPDATE worker_state.current_scan_id = NULL (clear)
}

export async function checkConflict() {
  // SELECT FROM worker_state WHERE current_scan_id IS NOT NULL
  // Return: { inProgress: bool, scanType, scanId }
}

export async function atomicStartScan(scanId, scanType, ...) {
  // BEGIN TRANSACTION
  // Check conflict
  // IF conflict: ROLLBACK + RETURN error
  // ELSE: INSERT scan_history + UPDATE worker_state
  // COMMIT
  // RETURN ok
}
```

---

## PHASE 4B: Update Backend Scan APIs

### Objective
Modify `/api/scan/start` and `/api/fm/scan-bg` to use SQLite + conflict handling.

**Duration:** 2-3 days

**Deliverable:** Both APIs work with SQLite and show conflict UI

### 4B.1 Update `/api/scan/start` (DupScan)

**Changes:**
```javascript
POST /api/scan/start

// NEW: Check for conflicts
const conflict = await checkConflict();
if (conflict) {
  return Response.json({
    status: 'conflict',
    currentScan: { type: conflict.scanType, startedAt: ... },
    options: ['stop_current_and_start', 'cancel']
  }, { status: 409 });
}

// NEW: Atomic start
const ok = await atomicStartScan(scanId, 'duplicates', scanPath, ...);
if (!ok) {
  return Response.json({ error: 'Failed to start scan' }, { status: 409 });
}

// EXISTING: Spawn Python scanner
// NEW: Write results to SQLite instead of S.dups
proc.stdout.on('data', async chunk => {
  for (const line of lines) {
    const ev = JSON.parse(line);
    
    if (ev.event === 'file_found') {
      // Queue for batch insert
      fileBatch.push({...});
      if (fileBatch.length >= 1000) {
        await insertBatchFiles(fileBatch);
        fileBatch = [];
      }
    }
    
    if (ev.event === 'duplicate_found') {
      // Record duplicate group
      await updateFileDuplicate(ev.hash, ev.fileIds, ev.waste);
    }
  }
});

// NEW: Update progress in DB
setInterval(async () => {
  await updateScanProgress(scanId, progress);
}, 500);

// NEW: On complete
proc.on('close', async code => {
  await markScanComplete(scanId, stats);
});
```

### 4B.2 Update `/api/fm/scan-bg` (File Manager)

**Changes:**
- Same conflict checking
- Atomically start scan with `scanType = 'full'`
- Worker writes to SQLite instead of fileIndex

### 4B.3 Create New Endpoint: `/api/scan/query`

**Purpose:** Backend query endpoint for both UI and conflict checking

```javascript
GET /api/scan/query?type=state|duplicates|files

// type=state → returns current worker_state
// type=duplicates → returns all duplicate files (DupScan view)
// type=files → returns all files (FM view)
// type=duplicate-groups → returns groups with member counts
```

### 4B.4 Create New Endpoint: `/api/scan/switch`

**Purpose:** Handle switching from one scan to another

```javascript
POST /api/scan/switch
Body: { confirmSwitch: true, newScanType: 'duplicates'|'full' }

// Stops current scan
// Starts new scan
// Atomically managed
```

---

## PHASE 5: Create Conflict Resolution UI

### Objective
Build UI modal for handling scan conflicts.

**Duration:** 1 day

**Deliverable:** Conflict modal component that works in both tabs

### 5.1 Create `shared/components/ScanConflictModal.jsx`

```javascript
// Shows conflict and options:
// - "Stop X and start Y" button
// - "Cancel" button
// - Current scan progress
```

### 5.2 Update `shared/components/Dashboard.jsx`

- Show conflict modal when conflict response received
- Handle user choice (switch or cancel)

### 5.3 Update Both Feature Service Layers

- **`features/dupscan/services/scanService.js`** - handle conflict response
- **`features/file-manager/services/fileManagerService.js`** - handle conflict response

---

## PHASE 6: Incremental Scanning Implementation

### Objective
Detect file changes and only hash changed files.

**Duration:** 2-3 days

**Deliverable:** Second scan 50%+ faster than first

### 6.1 Change Detection Algorithm

**Before scan:**
```javascript
// Get all files from DB
const previousFiles = await db.query(`
  SELECT path, size, file_mtime 
  FROM files 
  WHERE last_scan_id = (SELECT id FROM scans ORDER BY id DESC LIMIT 1)
`);

// Create map for O(1) lookup
const prevMap = new Map(previousFiles.map(f => [f.path, f]));

// Write to temp JSON for Python to read
writeSync('previous_hashes.json', JSON.stringify(prevMap));
```

**Python processing:**
```python
# Load previous hashes
previous = json.load(open('previous_hashes.json'))

# During traversal:
for file in walk(root):
  prev = previous.get(file.path)
  
  if prev and prev['size'] == os.path.getsize(file) and \
     prev['mtime'] == os.path.getmtime(file):
    # File unchanged - reuse old hash
    emit({event: 'file_unchanged', path: file, hash: prev['hash']})
  else:
    # File changed or new - need to hash
    emit({event: 'file_changed', path: file, hash: new_hash()})
```

### 6.2 Database Update Logic

```javascript
// Receive events from Python
if (ev.event === 'file_unchanged') {
  // INSERT file with old hash, no re-hashing needed
  await insertFile(ev.path, { hash: ev.hash, ... });
}

if (ev.event === 'file_changed') {
  // UPDATE file with new hash, mark as re-hashed
  await updateFileHash(ev.path, ev.hash);
}
```

### 6.3 Test Incremental

- Run scan 1: Full C:\Users (5M files) → takes 10 minutes
- Modify 10 files
- Run scan 2: Should skip 4.99M files, only hash 10 → takes 5 seconds

---

## PHASE 7: Real-Time Updates & Event Streaming

### Objective
Replace EventSource replay buffer with persistent event log or websocket.

**Duration:** 2-3 days

**Deliverable:** Real-time UI updates, no missed events

### 7.1 Add Persistent Event Log (Option A: Simple)

**Add to DB:**
```sql
CREATE TABLE scan_events (
  id INTEGER PRIMARY KEY,
  scan_id TEXT,
  event_type TEXT,
  data JSON,
  created_at INTEGER
);
```

**Benefit:** Never lose events, can replay
**Drawback:** More DB writes

### 7.2 Improve EventSource (Option B: Current + Enhancement)

**Keep:** Current EventSource approach
**Add:** Disk-based backup queue
- Events written to SQLite log
- If client reconnects, serve from log starting from last ack

### 7.3 Update UI Hooks

- `useDupScan.js` - read from `/api/scan/query?type=state` periodically
- `FileManagerDashboard.jsx` - same polling approach
- Show progress from query endpoint

**Why:** Simpler than real-time, still fast (poll every 200ms)

---

## PHASE 8: Migration from JSON to SQLite

### Objective
Migrate all existing history data to SQLite.

**Duration:** 1 day

**Deliverable:** Old history.json data accessible in new DB

### 8.1 Create Migration Utility: `lib/migrate-to-sqlite.js`

```javascript
export async function migrateHistoryJson() {
  // Read history.json
  const history = readFileSync(historyPath, 'utf8');
  const { scans = [], fileIndex = {} } = JSON.parse(history);
  
  // For each scan in scans[]
  for (const scan of scans) {
    // INSERT into scan_history
    // INSERT files from scan.dups
    // UPDATE files.is_duplicate, duplicate_group_id
  }
  
  // For fileIndex
  // INSERT all files from fileIndex.files
  // INSERT duplicate_groups from fileIndex.duplicateGroups
  
  // Backup original
  renameSync(historyPath, historyPath + '.backup');
  
  // DB is now source of truth
}
```

### 8.2 Run on First App Start with SQLite

- Check if history.json exists but not DB
- If yes, run migration
- Delete history.json (or keep as backup)
- Continue

---

## PHASE 9: Full Integration & Testing

### Objective
All systems working together without conflicts.

**Duration:** 3-5 days

**Deliverable:** Production-ready system

### 9.1 Test Scenarios

#### Scenario 1: Sequential Scans
- Start DupScan → completes ✓
- Data persisted in DB ✓
- Start FM scan → completes ✓
- Data persisted in DB ✓
- Both views show correct data ✓

#### Scenario 2: Conflict Handling
- Start DupScan
- While running, click FM scan
- Conflict modal appears ✓
- User clicks "Stop DupScan and start FM"
- DupScan stops ✓
- FM starts ✓
- UI updates correctly ✓

#### Scenario 3: Incremental Scanning
- First scan: 1M files, 10 min
- Modify 100 files
- Second scan: detects changes, 10 sec ✓
- All results correct ✓

#### Scenario 4: Large File Sets
- Scan folder with 500k+ files
- UI responsive ✓
- Progress updates in real-time ✓
- All files indexed ✓
- Duplicates correctly identified ✓

#### Scenario 5: App Restart During Scan
- Start scan
- Kill app mid-scan
- Restart app
- UI shows previous scan data (from DB) ✓
- Can query state ✓
- No corruption ✓

#### Scenario 6: Data Consistency
- Run DupScan, find duplicates
- Run FM scan on same folder
- Both see same files ✓
- Duplicate groups match ✓
- Mark file in DupScan view
- Switch to FM view
- Mark persisted ✓

### 9.2 Performance Benchmarks

- Full scan 1M files: < 15 minutes
- Incremental scan (10% changed): < 2 minutes
- DB queries < 100ms
- UI response time < 50ms

### 9.3 Stability Testing

- Run scans for 24 hours
- Check for memory leaks
- Check for file corruption
- Check DB integrity

---

## PHASE 10: Cleanup & Documentation

### Objective
Remove old code, update docs, prepare for production.

**Duration:** 1-2 days

**Deliverable:** Clean codebase, comprehensive docs

### 10.1 Remove Legacy Code

- Delete old state management if replaced
- Remove old history.js functions if not needed
- Clean up old event replay buffer code

### 10.2 Update Documentation

- `docs/architecture.md` - new SQLite-based design
- `docs/wiring.md` - new API contracts with conflict handling
- `docs/MIGRATION_GUIDE.md` - how to migrate custom plugins
- `features/dupscan/README.md` - updated with new backend
- `features/file-manager/README.md` - updated with new backend

### 10.3 Create Operations Guide

- How to backup SQLite DB
- How to restore from backup
- How to debug DB issues
- Performance tuning tips

---

## Rollback & Fallback Strategy

### If SQLite Fails
- Fall back to JSON (temporarily)
- Log the error
- Continue operation (degraded mode)
- Alert user

### If Migration Fails
- Keep old history.json
- Don't migrate yet
- User can try again later

### If Scan Conflicts
- Don't start new scan
- Return error to UI
- Let user make choice

---

## Timeline Summary

```
PHASE 2 (Infrastructure)      ████░░░░░░ 1-2 days
PHASE 3 (Python)              ████░░░░░░ 1-2 days
PHASE 4A (DB Layer)           ███░░░░░░░ 1 day
PHASE 4B (API Updates)        ██████░░░░ 2-3 days
PHASE 5 (Conflict UI)         ███░░░░░░░ 1 day
PHASE 6 (Incremental)        ██████░░░░ 2-3 days
PHASE 7 (Real-time)          ██████░░░░ 2-3 days
PHASE 8 (Migration)           ███░░░░░░░ 1 day
PHASE 9 (Testing)             ████████░░ 3-5 days
PHASE 10 (Cleanup)            ████░░░░░░ 1-2 days
                              ─────────────────
                              TOTAL: 3-4 weeks
```

---

## Existing Features Protection

✅ **Preserved:**
- DupScan tab continues to show duplicates
- File Manager tab continues to show files
- Delete, rename, move operations work
- Preview functionality works
- Gallery view works
- History tracking works
- Settings persist
- UI/UX looks identical

✅ **Improved:**
- No conflicts between scans
- Faster incremental scans
- More reliable data
- Better performance on large file sets
- Real-time progress updates

---

## Success Criteria

1. ✅ All existing tests pass
2. ✅ No conflicts between DupScan and FM scans
3. ✅ Second scan 50%+ faster than first (incremental)
4. ✅ Can handle 1M+ file sets without slowdown
5. ✅ UI responsive during large scans
6. ✅ All data persisted reliably
7. ✅ Can resume after app crash
8. ✅ Conflict resolution UI works
9. ✅ Zero data corruption in testing
10. ✅ Production-ready documentation
