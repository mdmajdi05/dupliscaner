# NEW ARCHITECTURE - Design Overview

## System Diagram - After Redesign

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌────────────────────┬──────────────────────────────┐  │
│  │ DupScan Tab        │ File-Manager Tab             │  │
│  │ Queries:           │ Queries:                     │  │
│  │ /api/query/dups    │ /api/query/files             │  │
│  │ /api/query/state   │ /api/query/state             │  │
│  └────────────────────┴──────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Conflict Modal (Shared)                          │   │
│  │ "Stop X and start Y?" or "Cancel"                │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│           Backend API Layer (Node.js)                    │
│  ┌──────────────────────┬──────────────────────────────┐ │
│  │ Scan Control APIs    │ Query APIs                   │ │
│  │ /api/scan/start      │ /api/query/state             │ │
│  │ /api/scan/switch     │ /api/query/duplicates        │ │
│  │ /api/scan/stop       │ /api/query/files             │ │
│  └──────────────────────┴──────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Worker Management                                 │   │
│  │ - Atomic conflict checking                        │   │
│  │ - Scan state machine                              │   │
│  │ - Worker thread lifecycle                         │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│         Scanner Execution Layer                          │
│  ┌─────────────────────┬──────────────────────────────┐  │
│  │ Python Scanner      │ Node Worker Thread           │  │
│  │ (Subprocess)        │ (scanner-worker.js)          │  │
│  │                     │                              │  │
│  │ Modes:              │ Receives:                    │  │
│  │ --mode=duplicates   │ - Python events              │  │
│  │ --mode=full         │ - File metadata              │  │
│  │                     │ Batches & writes to SQLite   │  │
│  │ Output:             │                              │  │
│  │ JSON lines          │ Sends progress to parent     │  │
│  │ (event-based)       │                              │  │
│  └─────────────────────┴──────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│                   SQLite Database                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Single Source of Truth                           │   │
│  │ - files (unified, all files)                     │   │
│  │ - duplicate_groups (hash-based groups)           │   │
│  │ - scan_history (audit trail)                     │   │
│  │ - worker_state (current scan status)             │   │
│  │ - file_marks (user marks)                        │   │
│  │ - settings (app config)                          │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Atomic Transactions                              │   │
│  │ - Scan start checked atomically                  │   │
│  │ - Batch writes for performance                   │   │
│  │ - Indexes rebuilt after inserts                  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Data Flow Comparison

### CURRENT (Broken)

```
User clicks DupScan
         ↓
POST /api/scan/start
         ↓
Global S.status = 'scanning'
Global S.dups = []
         ↓
Spawn Python scanner.py
         ↓
Python outputs JSON lines
         ↓
Backend accumulates in S.dups (memory)
         ↓
Events stored in S.events buffer (ring)
         ↓
GET /api/scan/stream (SSE)
         ↓
Frontend receives events from buffer
         ↓
Updates UI state (liveDups)
         ↓
On complete, persistHistory() writes to history.json
         ↓
Data stored in history.json (JSON file)

PROBLEM: 
- If two systems scan simultaneously → S object corrupted
- If client reconnects → might miss events (buffer overflow)
- If app crashes mid-scan → history.json corrupted
- All data in memory → slow for 100k+ files
```

### NEW (Fixed)

```
User clicks DupScan
         ↓
POST /api/scan/start { scanType: 'duplicates', path, ... }
         ↓
Backend: atomicStartScan() in transaction:
  1. BEGIN TX
  2. SELECT worker_state.current_scan_id (check if already running)
  3. IF running: ROLLBACK + RETURN { status: 'conflict', ... }
  4. IF free: UPDATE worker_state, INSERT scan_history
  5. COMMIT
         ↓
Spawn Python scanner.py --mode=duplicates --previous-hashes ...
         ↓
Python outputs event-based JSON lines:
  {event: "file_found", path, size, mtime}
  {event: "file_unchanged", path, hash}  # incremental
  {event: "duplicate_found", hash, files, waste}
  {event: "progress", hashed: X, total: Y}
  {event: "complete"}
         ↓
Backend Worker Thread:
  - Parses each event
  - Batches file inserts (1000 at a time)
  - Executes: INSERT files (...), (...), (...)
  - Updates: worker_state.files_processed
  - No memory bloat
         ↓
Database writes atomically:
  - Each batch: BEGIN TX → INSERT → COMMIT
  - All data persisted immediately
  - No buffer overflow possible
  - No data loss on crash
         ↓
Frontend polls: GET /api/query/state
         ↓
Backend queries:
  SELECT status, phase, files_processed, total FROM worker_state
  Returns current progress
         ↓
Frontend renders from query response
         ↓
On complete:
  1. Worker stops
  2. Backend: UPDATE worker_state.current_scan_id = NULL
  3. Data is already in SQLite
  4. Next query returns: { status: 'idle' }
         ↓
Frontend: Can now query results
  GET /api/query/duplicates → Returns all dups from DB
         ↓
Data reliably available in SQLite
  - Survives app restart
  - Survives scan interruption
  - Survives power loss (with SQLite durability)
```

---

## Key Architecture Changes

### 1. Conflict Detection (New)

**Before:**
```
No checking. Both systems can scan simultaneously.
Result: Corruption
```

**After:**
```
Worker State Table (singleton):
{
  id: 1,
  current_scan_id: 's_1234567890' OR NULL,
  current_scan_type: 'duplicates' OR 'full',
  phase: 'scanning_files',
  started_at: timestamp
}

Check before starting:
  SELECT current_scan_id FROM worker_state
  IF not NULL: Return conflict response
  ELSE: Atomically start scan
```

### 2. Single Source of Truth (New)

**Before:**
- DupScan: `history.json.scans[]` array
- FM: `history.json.fileIndex` object
- Two systems, two data structures
- Could diverge

**After:**
- Everything in SQLite `files` table
- Single unified schema
- DupScan: Filter by `is_duplicate = 1`
- FM: Select all files
- Always consistent

### 3. Incremental Scanning (New)

**Before:**
```
Always full scan:
Scan 1: Hash all 1M files
Scan 2: Hash all 1M files again (wasteful)
Scan 3: Hash all 1M files again (wasteful)
```

**After:**
```
Scan 1: Hash all 1M files
Scan 2: 
  - Detect which files changed (size+mtime check)
  - Hash only 10k changed files
  - Reuse old hashes for 990k unchanged files
  - 100x faster!
Scan 3:
  - Same: hash only changed files
```

### 4. Reliable Real-Time Updates (New)

**Before:**
- EventSource with 5000-event buffer
- Buffer can overflow
- Events can be missed
- No recovery

**After:**
- Query `/api/query/state` every 200ms
- Returns current progress from DB
- Always accurate
- Never misses data
- Works even after disconnect/reconnect

### 5. Atomic Operations (New)

**Before:**
- history.json written sequentially
- Can be corrupted if process dies mid-write
- No recovery mechanism

**After:**
- SQLite transactions
- All-or-nothing writes
- Can recover from crash
- ACID guarantees

---

## API Contract Changes

### Current APIs (Keep but Enhance)

```javascript
// Existing DupScan APIs - now backed by SQLite
POST   /api/scan/start      → responses now include conflict detection
GET    /api/scan/stream     → replaced by query endpoint (optional legacy)
POST   /api/scan/stop       → now atomic
POST   /api/delete          → updates SQLite

// Existing History APIs - now query SQLite
GET    /api/history         → queries scan_history table
GET    /api/history/:id     → queries scan_history + files table
PATCH  /api/history/:id     → updates file_marks table
DELETE /api/history/:id     → soft-deletes from SQLite
```

### New APIs (Add)

```javascript
// State & Conflict Resolution
GET  /api/scan/query?type=state              → { status, phase, progress }
POST /api/scan/switch { confirmSwitch }      → stops one, starts another

// Query Results (replaces /api/scan/stream for new UI)
GET  /api/query/duplicates?limit=100         → all duplicate files
GET  /api/query/files?path=&limit=100        → all files (FM view)
GET  /api/query/duplicate-groups             → groups with member counts
```

### Removed APIs (Cleanup)

```javascript
// These can be removed if not used:
// GET /api/report        → use DB export instead
// GET /api/preview       → keep, still needed
// Other internal-only APIs → cleanup
```

---

## Database Query Patterns

### For DupScan Tab (Show Only Duplicates)

```sql
-- Get all duplicate files
SELECT * FROM files
WHERE is_duplicate = 1
ORDER BY duplicate_group_id, size DESC;

-- Get files in specific duplicate group
SELECT * FROM files
WHERE duplicate_group_id = ?
ORDER BY path;

-- Get stats for duplicates
SELECT 
  COUNT(DISTINCT duplicate_group_id) as groups,
  SUM(waste_bytes) as total_waste,
  COUNT(*) as duplicate_files
FROM files WHERE is_duplicate = 1;
```

### For File Manager Tab (Show All Files)

```sql
-- Get all files in folder
SELECT * FROM files
WHERE dir LIKE ?
ORDER BY name;

-- Get files with pagination
SELECT * FROM files
WHERE dir = ?
ORDER BY name
LIMIT 100 OFFSET 0;

-- Get file tree
SELECT DISTINCT dir FROM files
WHERE dir LIKE ?
ORDER BY dir;
```

### For Conflict Detection

```sql
-- Check if scan running
SELECT current_scan_id, current_scan_type FROM worker_state WHERE id = 1;

-- Get running scan info
SELECT * FROM scan_history
WHERE id = (SELECT current_scan_id FROM worker_state WHERE id = 1)
LIMIT 1;
```

---

## State Machine - Worker States

```
     ┌─────────────────────────────────────────────────┐
     │                                                  │
     ▼                                                  │
┌─────────┐  start_dup_scan    ┌──────────────────┐   │
│  IDLE   │─────────────────→  │  SCANNING_DUPS   │   │
│ (id:1)  │  (check atomic)    │ (phase: vary)    │   │
└─────────┘                     └──────────────────┘   │
     ▲                                   │              │
     │                                   │ on_complete  │
     │    start_full_scan    ┌──────────────────┐      │
     └─────────────────────│  SCANNING_FULL   │      │
     ┌─────────────────────└──────────────────┘      │
     │                             │                  │
     └─────────────────────────────┘ on_stop
     

Phases within SCANNING_*:
  - scanning_files: BFS traversal
  - hashing: Computing hashes
  - comparing: Finding duplicates (DupScan only)
  - done: Completed
  - error: Error occurred
```

---

## Performance Characteristics

### Memory Usage

**Current:**
- 1M files: ~2GB RAM (entire index in S object)
- Large scans cause GC pauses

**New:**
- 1M files: ~100MB RAM (batches of 1000)
- No GC pauses
- Scalable to 10M+ files

### Scan Time

**Current (Full Scan Every Time):**
- First scan 1M files: 10 min
- Second scan 1M files: 10 min (all files re-hashed)
- Third scan: 10 min

**New (Incremental):**
- First scan 1M files: 10 min
- Second scan (10% changed): 1 min (only 100k changed files hashed)
- Third scan (10% changed): 1 min

**Speedup: 10x for incremental scans**

### Database Queries

**Current:** N/A (JSON file parsing)

**New:**
- Query all duplicates: < 50ms
- Query all files in folder: < 100ms
- Get duplicate group: < 10ms

---

## Migration Path - Zero Downtime

### Before Switching to SQLite

1. **Prepare Phase:**
   - Add SQLite code alongside JSON code
   - Both work in parallel
   - Scans still write to JSON

2. **Test Phase:**
   - Parallel writing: same data to both JSON and SQLite
   - Compare results
   - Fix any discrepancies
   - Stabilize for weeks

3. **Switch Phase:**
   - Enable SQLite as primary storage
   - Keep JSON as backup
   - New scans use SQLite

4. **Fallback:**
   - If issues, revert to JSON
   - Keep both systems active

5. **Cleanup:**
   - After weeks of stable operation
   - Remove JSON code
   - Archive JSON backups

---

## Risk Mitigation

### Risk 1: SQLite Corruption
**Mitigation:**
- Regular DB integrity checks
- Atomic transactions
- WAL mode for better recovery
- Automatic backup before each scan

### Risk 2: Migration Loses Data
**Mitigation:**
- Validate each migrated record
- Compare counts before/after
- Keep old JSON file as backup
- Test migration on copy first

### Risk 3: Scans Break During Transition
**Mitigation:**
- Feature flag to enable/disable SQLite
- Run old and new systems in parallel
- Compare results
- Only switch when 100% confident

### Risk 4: Large File Sets Slow Down
**Mitigation:**
- Performance testing at 1M+ files
- Batch processing (not all at once)
- Index optimization
- Query analysis and tuning

---

## Rollout Plan

```
Week 1: Infrastructure + DB schema
Week 2: Python scanner + DB write layer
Week 3: API integration + conflict handling
Week 4: Incremental scanning + real-time updates
Week 5: Migration + testing
Week 6: Parallel operation + validation
Week 7+: Monitor, stabilize, cleanup
```

---

## Success Metrics

1. ✅ Conflict detection works 100% of the time
2. ✅ No data corruption in SQLite
3. ✅ Incremental scans 10x faster
4. ✅ UI responsive (< 100ms queries)
5. ✅ Can handle 1M+ files
6. ✅ Zero data loss on crash
7. ✅ App startup < 2 seconds (loads from DB)
8. ✅ User experience identical to before
9. ✅ Production-ready documentation
10. ✅ Team ready to maintain system
