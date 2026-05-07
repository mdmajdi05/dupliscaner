# ISSUES FOUND - Root Cause Analysis

## Critical Issues (Breaking Production)

### CRITICAL-1: No Mutual Exclusion Between Scans

**Problem:**
- User starts DupScan on `C:\Users`
- While it's running, user switches to File Manager and clicks "Scan"
- Both systems access `lib/state.js` S object and history.json simultaneously
- They overwrite each other's progress
- Scan results become corrupted or mixed

**Root Cause:**
- No worker state machine
- No check for "is another scan active?"
- No lock on history.json or state.js
- Both use global S object that can be accessed concurrently

**Impact:**
- Scan results are unreliable
- UI shows mixed/incomplete data
- History gets corrupted
- Users can't trust the tool

**Current Code Location:**
- `lib/state.js` - global S object has no protection
- `app/api/scan/start` - no check if worker exists or FM scan active
- `app/api/fm/scan-bg` - no check if DupScan is running

---

### CRITICAL-2: Data Consistency Between DupScan and File Manager

**Problem:**
- DupScan stores duplicates separately from FM
- DupScan saves to `scans[]` array
- FM saves to `fileIndex` and `duplicateGroups`
- If user runs DupScan, deletes a duplicate, then runs FM scan:
  - FM doesn't know file was deleted
  - File reappears in file list
  - Duplicate groups don't match
  
**Root Cause:**
- Two separate data structures for same information
- No shared duplicate group ID system
- DupScan marked files but doesn't update fileIndex
- FM creates groups but DupScan doesn't use them

**Impact:**
- User gets different data in each view
- Can't trust which files are actually duplicates
- Delete operations in one view don't sync to other

**Current Code Location:**
- `app/api/scan/start` - saves to scans[] (persistHistory)
- `app/api/fm/scan-bg` - builds fileIndex and duplicateGroups
- `history.js` - stores scans and fileIndex separately

---

### CRITICAL-3: Python Scanner Only Supports Duplicate Mode

**Problem:**
- scanner.py designed for DupScan (size grouping → hashing)
- File Manager needs FULL file listing (all files, not just duplicates)
- Currently FM uses Python for single-file hash lookup, but not full scan
- This limits FM scan capability

**Root Cause:**
- Python script hardcoded for "find duplicates" workflow
- No `--mode=full` or `--mode=list` flag
- FM's worker uses Node directly for traversal (less efficient than Python)

**Impact:**
- FM can't leverage Python's fast duplicate detection
- Inconsistent scanning between the two systems
- Can't unify scanning logic

**Current Code Location:**
- `scanner.py` - only has duplicate detection mode
- `lib/scanner-worker.js` - does BFS directly in Node (not as efficient)

---

### CRITICAL-4: No Incremental Scanning

**Problem:**
- DupScan: Always full scan from scratch
- FM: Worker reads cached index but doesn't track what changed
- If user scans C:\Users (1M files) three times:
  - First scan: hash 1M files (slow)
  - Second scan: hash 1M files again (should only hash changed ones)
  - Third scan: hash 1M files again (wasteful)

**Root Cause:**
- No change detection at file level
- scanner.py doesn't accept previous hashes
- No metadata storage of "last scanned mtime" per file
- No diff calculation before hashing

**Impact:**
- Slow repeated scans
- Bad performance on large file systems
- Workers constantly hashing unchanged files
- Users have poor experience with auto-scan

**Current Code Location:**
- `scanner.py` - always full scan
- `lib/scanner-worker.js` - reads cache but does full traversal anyway

---

## Major Architectural Issues (Affecting Stability)

### MAJOR-1: EventSource Replay Buffer Unreliable

**Problem:**
- DupScan uses EventSource + replay buffer pattern
- Buffer limited to 5000 events
- If client connects mid-scan with >5000 events:
  - Old events are dropped (shift())
  - Client misses data
  - UI shows incomplete results

**Root Cause:**
- Simple ring buffer (FIFO) in memory
- No persistent event log
- No client offset tracking
- No replay guarantee

**Impact:**
- Clients can miss events
- Scan data incomplete if buffer overflows
- UI can't properly reconstruct state

**Current Code Location:**
- `lib/state.js` - events array with max 5000
- `features/dupscan/hooks/useDupScan.js` - opens EventSource
- `app/api/scan/stream` - serves from events buffer

---

### MAJOR-2: Worker Communication Not Persistent

**Problem:**
- FM worker communicates with parent via postMessage
- If parent dies, messages are lost
- If parent not listening at exact moment, message might be missed
- No retry or acknowledgment mechanism

**Root Cause:**
- No message queue
- No ack/nack system
- Simple fire-and-forget communication
- No persistence layer

**Impact:**
- Progress updates might be lost
- Files might not be saved if parent crashes
- Partial state corruption

**Current Code Location:**
- `lib/scanner-worker.js` - parentPort.postMessage()
- `app/api/fm/scan-bg` - worker.on('message', ...)

---

### MAJOR-3: No Atomic File Writes

**Problem:**
- history.json written directly without atomic operations
- If write fails mid-way:
  - File becomes corrupted (invalid JSON)
  - App can't read it on restart
  - Data is lost

**Root Cause:**
- Simple fs.writeFileSync() without transactions
- No temp file + rename pattern
- No backup/rollback

**Impact:**
- Data loss on write failure
- App becomes unstable if history.json corrupted
- Hard to recover

**Current Code Location:**
- `lib/history.js` - saveFileIndex, addScan (fs.writeFileSync)
- `app/api/fm/scan-bg` - saveFileIndex

---

## Performance Issues

### PERF-1: Large File Sets (100k+) Become Slow

**Problem:**
- All file metadata stored in S.dups array (memory)
- All worker data stored in STATE.workingIndex (memory)
- For 100k+ files:
  - Memory usage explodes
  - Garbage collection pauses
  - UI becomes sluggish

**Root Cause:**
- No database (would handle large sets gracefully)
- All data in memory
- No pagination or lazy loading of results

**Impact:**
- Tool unsuitable for large file systems
- Workers crash on large scans
- UI freezes

---

### PERF-2: No Hashing Optimization

**Problem:**
- Every file hashed individually
- No batching of hash operations
- For 100k files needing hash:
  - 100k sequential hash calculations
  - Each one synchronous
  - Slow overall

**Root Cause:**
- scanner.py and scanner-worker.js do sequential hashing
- No batch processing
- No priority queue (could hash smaller files first)

**Impact:**
- Scans take longer than necessary
- CPU underutilized (could parallelize)

---

### PERF-3: File Traversal Not Optimized

**Problem:**
- BFS traversal visits every file
- No early termination
- No caching of directory structure
- Each scan re-traverses same folders

**Root Cause:**
- Simple os.walk() in Python
- No incremental directory tracking
- No tree structure cache

**Impact:**
- Traversal time wasted on unchanged directories

---

## Data Flow Issues

### DATAFLOW-1: No Single Source of Truth

**Problem:**
- DupScan truth: `scans[]` array in history.json
- FM truth: `fileIndex` + `duplicateGroups` in history.json
- These can diverge:
  - DupScan marks file deleted, FM doesn't see it
  - FM indexes file, DupScan doesn't know about group
  - Two systems have different duplicate group IDs

**Root Cause:**
- Separate data structures
- No unified schema
- No synchronization mechanism

**Impact:**
- Can't trust any single view
- User sees conflicting data between tabs

---

### DATAFLOW-2: Marked Files Not Synced

**Problem:**
- User marks file as "keep" or "delete" in DupScan
- Goes to File Manager
- File still appears in file tree (not marked)
- Goes back to DupScan
- Mark is lost if scan reloaded

**Root Cause:**
- Marks stored in history scan object
- FM doesn't read or update marks
- No sync between views

**Impact:**
- User's decisions not preserved across views

---

## UI/UX Issues

### UX-1: No Conflict Warning

**Problem:**
- User starts DupScan scan
- While running, user tries to start FM scan
- Nothing happens or errors occur silently
- User confused about what's running

**Root Cause:**
- No conflict modal
- No state query endpoint
- No feedback to user

**Impact:**
- Poor user experience
- User doesn't know what's happening

---

## Summary by Severity

### Must Fix (Before Production):
1. Mutual exclusion for scans ← CRITICAL
2. Data consistency across systems ← CRITICAL
3. Python scanner needs full-mode ← CRITICAL
4. Incremental scanning ← CRITICAL
5. Atomic writes ← CRITICAL

### Should Fix (For Stability):
6. EventSource reliability
7. Worker communication persistence
8. Large file set performance
9. Conflict UI/warning

### Nice to Have (Optimization):
10. Hashing parallelization
11. Directory traversal optimization
12. Single source of truth restructure
