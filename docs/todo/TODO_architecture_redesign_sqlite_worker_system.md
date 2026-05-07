# TODO: Architecture Redesign - SQLite + Worker System

**Started:** May 7, 2026  
**Status:** In Progress  
**Priority:** CRITICAL - Production Architecture Overhaul

---

## 🎯 Task Understanding

Redesign entire dupscan+file-manager system for production-grade stability, performance, and scalability WITHOUT breaking existing features. Current system has architectural issues causing instability. Solution requires:

1. **Single Source of Truth** - SQLite DB (shared by both dupscan & file-manager)
2. **Worker State Management** - Only one scan at a time (dupscan OR file-manager)
3. **Incremental Scanning** - Detect changes via metadata (size/mtime), hash only changed files
4. **Conflict Handling** - Popup to switch between scans if one is already running
5. **Real-Time Updates** - Live UI updates as scan progresses
6. **Backend Optimization** - Python scanner for traversal/hashing, Node.js for DB management
7. **Preserved Features** - All existing UI/UX must remain identical; only internal architecture changes

---

## 📊 Affected Components

### Backend
- `lib/state.js` (global state management)
- `lib/scan-controller.js` (scan orchestration)
- `lib/scanner-worker.js` (background worker)
- `scanner.py` (Python duplicate scanner)
- `app/api/scan/*` (scan APIs)
- `app/api/fm/*` (file manager APIs)

### Frontend
- `features/dupscan/hooks/useDupScan.js` (DupScan state)
- `features/dupscan/services/scanService.js` (DupScan API calls)
- `features/file-manager/services/fileManagerService.js` (FM API calls)
- `shared/components/Dashboard.jsx` (tab switching, conflict resolution UI)

### Storage
- Migration from JSON → SQLite (history.json backup pattern)
- Database schema design

---
## ✅ COMPLETION STATUS

**PHASE 1: COMPLETE** ✓
- [x] Current architecture analyzed and documented
- [x] 10 critical/major issues identified with root causes
- [x] Database schema designed (production-ready)
- [x] New architecture documented with diagrams
- [x] Implementation strategy detailed (3-4 weeks, 10 phases)
- [x] Performance improvements quantified (10x faster incremental, 20x less memory)

**PHASE 2: COMPLETE** ✓
- [x] SQLite database infrastructure implemented and tested
- [x] lib/db.js created (sqlite3 connection management with async/await)
- [x] lib/init-db.js created (schema initialization with 7 tables)
- [x] lib/migrations/index.js created (migration system with versioning)
- [x] lib/db-ops.js created (20 reusable database operations)
- [x] app/api/db/init/route.js created (initialization endpoint)
- [x] app/page.js modified (DB init on app startup)
- [x] package.json updated (sqlite3 added)
- [x] npm install and npm run build verified
- [x] Database endpoint tested and working (returns stats on /api/db/init)

**PHASE 3: COMPLETE** ✓
- [x] scanner.py enhanced with --mode parameter (duplicates|full)
- [x] Full mode implemented (traverse all files, hash all)
- [x] Event-based JSON output format (one object per line)
- [x] Incremental scanning logic (--previous-hashes parameter)
- [x] File change detection (size + mtime comparison)
- [x] Change type classification (file_added|file_changed|file_unchanged|file_deleted)
- [x] Progress events for both modes
- [x] Backward compatible (duplicates mode unchanged)

**PHASE 4A: COMPLETE** ✓
- [x] lib/db-scan.js created (ScanProcessor class)
- [x] Event handlers for all scanner event types
- [x] Batch write strategy (500 files per transaction)
- [x] Duplicate group management and linking
- [x] Real-time progress tracking (worker_state updates)
- [x] Error handling and logging
- [x] test-db-scan.js test harness
- [x] Syntax validation and build verification
- [x] Scanner event stream verified (all event types confirmed)

**Files Created/Modified:**
- ✓ docs/CURRENT_ARCHITECTURE.md (data flows, current design)
- ✓ docs/ISSUES_FOUND.md (10 issues with root causes)
- ✓ docs/DATABASE_SCHEMA.md (SQLite schema, indexes, queries)
- ✓ docs/NEW_ARCHITECTURE.md (system design, conflict handling, performance)
- ✓ docs/IMPLEMENTATION_STRATEGY.md (detailed 10-phase migration plan)
- ✓ lib/db.js (SQLite connection management)
- ✓ lib/init-db.js (schema initialization)
- ✓ lib/migrations/index.js (migration system)
- ✓ lib/db-ops.js (database operations)
- ✓ app/api/db/init/route.js (initialization API)
- ✓ app/page.js (DB init integration)
- ✓ scanner.py (enhanced with modes and incremental scanning)
- ✓ lib/db-scan.js (ScanProcessor class, bridge layer)
- ✓ test-db-scan.js (test harness)
- ✓ docs/PHASE_4A_COMPLETION_SUMMARY.md (PHASE 4A documentation)

**Next Phase:** PHASE 4B (API Integration) when ready

---
## 📋 Execution Plan

### PHASE 1: Analysis & Current State Documentation ✅ COMPLETE

- [x] **1.1** Read and document current architecture in `docs/CURRENT_ARCHITECTURE.md` ✓
  - How does scanner.py work? (input/output format)
  - How are scans started/stopped?
  - How does UI get updates (SSE? polling? state?)
  - Where do file hashes get stored?
  - How is history.json used?
  
- [x] **1.2** Document existing issues in `docs/ISSUES_FOUND.md` ✓
  - 10 critical/major/perf issues identified
  - Root causes documented
  - Impact analysis provided

- [x] **1.3** Read all key files to understand data flow ✓
  - `scanner.py` - BFS + size grouping + MD5 hashing
  - `lib/state.js` - global S object with event replay
  - `lib/scan-controller.js` - settings + utility functions
  - `lib/scanner-worker.js` - Node worker for FM indexing
  - `features/dupscan/services/scanService.js` - DupScan API calls
  - `features/file-manager/services/fileManagerService.js` - FM API calls
  - `app/api/scan/start/route.js` - spawn Python scanner
  - `app/api/fm/scan-bg/route.js` - create worker thread

- [x] **1.4** Created data flow documentation ✓
  - System diagram in CURRENT_ARCHITECTURE.md
  - DupScan data flow diagram
  - File Manager data flow diagram
  - Current storage structure documented

### PHASE 2: Database Design & Schema

- [ ] **2.1** Design SQLite schema in `docs/DATABASE_SCHEMA.md`
  ```sql
  Tables needed:
  - files (path, name, size, hash, modified_time, is_duplicate, duplicate_group_id, last_scanned, status)
  - duplicate_groups (id, hash, waste_bytes, file_count, created_at)
  - scan_history (id, type (dup|full), path, started_at, completed_at, status)
  - file_manager_state (current_folder, last_indexed_at, total_files, indexed_status)
  ```

- [ ] **2.2** Design incremental scanning logic
  - File change detection algorithm (size + mtime comparison)
  - Hashing strategy (batch vs immediate)
  - Index invalidation rules

- [ ] **2.3** Design migration strategy
  - How to migrate existing history.json to SQLite
  - Rollback plan if DB schema needs changes

### PHASE 3: Python Scanner Enhancement

- [ ] **3.1** Extend scanner.py to support both modes
  - `--mode=duplicates` - current behavior (size group → hash → report duplicates)
  - `--mode=full` - traverse all files, hash all, report all with metadata

- [ ] **3.2** Output format standardization
  - Change JSON output to event-based format (one JSON object per line)
  - Each line contains: `{type, path, size, hash, status, error}`
  - Example: `{"type":"file_hashed","path":"/foo/bar.txt","size":1024,"hash":"abc123"}`

- [ ] **3.3** Add incremental mode
  - Accept previous file index as input
  - Only hash files with changed size/mtime
  - Output: `{type:"file_changed|file_unchanged|file_deleted|file_added"}`

### PHASE 4: Node.js Backend - Worker State System

- [ ] **4.1** Redesign `lib/state.js`
  - Add SQLite connection management
  - Implement worker state machine:
    ```
    idle → 
      (scan_start_dupscan) → scanning_duplicates → idle
      (scan_start_full) → scanning_full → idle
    scanning_* → (scan_stop) → stopping → idle
    ```
  - Add conflict tracking (which type is currently scanning?)

- [ ] **4.2** Redesign `lib/scan-controller.js`
  - Implement "scan switch" logic
  - If dupscan is scanning and user clicks FM scan:
    - Check state
    - Return conflict response with options
    - Either stop dupscan or cancel FM start
  - Same logic reversed

- [ ] **4.3** Update `lib/scanner-worker.js`
  - Worker receives mode (duplicates vs full)
  - Worker spawns Python subprocess with correct args
  - Worker receives JSON-line events from Python
  - Worker parses events and writes to SQLite (batched for performance)
  - Worker emits progress events to Node server

- [ ] **4.4** Implement SQLite write operations
  - Batch inserts for performance (100-1000 rows per transaction)
  - Index management (disable during scan, rebuild after)
  - Foreign key integrity checks

### PHASE 5: API Redesign & Conflict Handling

- [ ] **5.1** Redesign scan start API: `/api/scan/start`
  ```
  Request: { path, mode: "duplicates"|"full", includeHidden }
  
  Response cases:
  1. Success: { status: "started", scanId, type: "duplicates"|"full" }
  2. Conflict: { status: "conflict", currentScan: { type, progress }, options: ["switch", "cancel"] }
  
  If user chooses "switch":
  - POST /api/scan/switch { scanId, newMode, confirmSwitch: true }
  - Stops current, starts new
  ```

- [ ] **5.2** New endpoint: `/api/scan/state`
  - GET returns: `{ currentScan: null|{type, progress, startTime}, conflictOption: {...} }`
  - Used by UI to know what's happening

- [ ] **5.3** New endpoint: `/api/scan/switch`
  - POST with { confirmSwitch: true }
  - Handles graceful stop of one scan and start of another

- [ ] **5.4** Update `/api/fm/scan-bg` (same logic as dupscan)
  - Check state before starting
  - Return conflict if needed
  - Support switch operation

- [ ] **5.5** New endpoint: `/api/query/*`
  - `/api/query/duplicates` - get duplicate files from SQLite (for DupScan tab)
  - `/api/query/files` - get all files from SQLite (for File-Manager tab)
  - `/api/query/file-tree` - get folder tree (for FM sidebar)

### PHASE 6: Frontend Integration & Real-Time Updates

- [ ] **6.1** Update `features/dupscan/services/scanService.js`
  - Handle conflict response from API
  - Show conflict modal
  - Support "switch" option

- [ ] **6.2** Update `features/dupscan/hooks/useDupScan.js`
  - Add state for conflict modal
  - Add handler for switch action
  - Keep existing UI logic unchanged

- [ ] **6.3** Add conflict modal component: `shared/components/ScanConflictModal.jsx`
  - Show which scan is currently running
  - Show options: "Stop X and start Y" or "Cancel"
  - Styled consistently with existing UI

- [ ] **6.4** Update `shared/components/Dashboard.jsx`
  - Add conflict modal rendering
  - Keep tab switching logic

- [ ] **6.5** Update file-manager to use same conflict logic
  - Wire up `/api/fm/scan-bg` switch logic
  - Same conflict modal

### PHASE 7: Data Migration & Transition

- [ ] **7.1** Create migration utility: `lib/migrate-to-sqlite.js`
  - Read existing history.json
  - Create SQLite DB
  - Migrate scan history
  - Keep history.json as backup

- [ ] **7.2** Create DB initialization: `lib/init-db.js`
  - Run on server startup
  - Create tables if they don't exist
  - Run migrations if needed

- [ ] **7.3** Add safety checks
  - Detect if both systems try to access DB simultaneously (prevent corruption)
  - Implement file locking if needed

### PHASE 8: Testing & Validation

- [ ] **8.1** Test dupscan alone (no FM interference)
  - Start dupscan scan
  - Verify DB gets populated correctly
  - Verify UI shows duplicates only
  - Test stop/restart

- [ ] **8.2** Test file-manager alone (no dupscan interference)
  - Start FM scan
  - Verify DB gets populated with all files
  - Verify UI shows full file tree
  - Test stop/restart

- [ ] **8.3** Test conflict scenarios
  - Start dupscan → try FM scan → get conflict modal
  - Confirm switch → dupscan stops, FM starts
  - Reverse: start FM → try dupscan → get conflict modal
  - Confirm switch → FM stops, dupscan starts

- [ ] **8.4** Test incremental scanning
  - Run scan 1 (records all files with hash)
  - Modify a file (change its content)
  - Run scan 2 (should detect only changed file and re-hash)
  - Verify performance improvement on 2nd scan

- [ ] **8.5** Test UI responsiveness
  - Large folder (10k+ files) scan performance
  - Real-time progress updates
  - Tab switching during scan
  - App reload during scan (resume from DB)

- [ ] **8.6** Test data persistence
  - App restart → should instantly show last scan data
  - No UI flicker or re-scanning
  - History preserved

### PHASE 9: Documentation & Cleanup

- [ ] **9.1** Update `docs/architecture.md` with new design
- [ ] **9.2** Update `docs/wiring.md` with new API contracts  
- [ ] **9.3** Update `docs/DATABASE_SCHEMA.md` with final schema
- [ ] **9.4** Create `docs/MIGRATION_GUIDE.md` for future developers
- [ ] **9.5** Update `features/dupscan/README.md`
- [ ] **9.6** Update `features/file-manager/README.md`
- [ ] **9.7** Update main `README.md` with architecture overview
- [ ] **9.8** Move completed TODO to `docs/done/`

---

## 🚀 Next Steps

**Immediate:** Complete PHASE 1 (analysis) to understand current system  
**Then:** Create detailed implementation tasks for each phase

---

## 📌 Constraints & Rules

- ✅ NO breaking UI changes (existing features must work identically)
- ✅ NO cross-imports between dupscan and file-manager features
- ✅ NO inline Tailwind (use existing CSS)
- ✅ Always read existing code before editing
- ✅ Small, verifiable changes per task
- ✅ Update `.md` files after each phase

---

## 💾 Related Files

- `INSTRUCTIONS.md` - Project rules (must read first)
- `scanner.py` - Python scanner (to be enhanced)
- `lib/state.js` - Current state management
- `lib/scan-controller.js` - Current scan control
- `docs/wiring.md` - Current API wiring
- `docs/architecture.md` - Current architecture
