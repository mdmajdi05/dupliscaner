# CURRENT ARCHITECTURE Analysis

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                     │
│  ┌──────────────────────┬──────────────────────────────┐ │
│  │  DupScan Tab         │  File-Manager Tab            │ │
│  │  (useDupScan hook)   │  (FileManagerDashboard)      │ │
│  └──────────────────────┴──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Backend (Next.js API Routes)                │
│  ┌────────────────────────┬──────────────────────────┐  │
│  │ DupScan APIs           │ File-Manager APIs        │  │
│  │ /api/scan/start        │ /api/fm/scan-bg          │  │
│  │ /api/scan/stop         │ /api/fm/ls               │  │
│  │ /api/scan/stream (SSE) │ /api/fm/action           │  │
│  │ /api/history/*         │ /api/fm/duplicates       │  │
│  │ /api/delete            │ /api/fm/browse-folders   │  │
│  │ /api/preview           │                          │  │
│  │ /api/report            │                          │  │
│  └────────────────────────┴──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
       ↓                                      ↓
  ┌─────────────────────┐          ┌──────────────────┐
  │ Python Scanner      │          │ Node Worker      │
  │ (scanner.py)        │          │ (scanner-worker)│
  │ - BFS traversal     │          │ - BFS traversal │
  │ - Size grouping     │          │ - Incremental   │
  │ - MD5 hashing       │          │ - File indexing │
  └─────────────────────┘          └──────────────────┘
       ↓                                   ↓
  ┌─────────────────────┐          ┌──────────────────┐
  │ lib/state.js        │          │ history.json     │
  │ (Global state)      │          │ (File cache)     │
  │ - Current scan dups │          │ - fileIndex      │
  │ - Progress          │          │ - scan history   │
  │ - Event replay      │          │ - duplicate info │
  └─────────────────────┘          └──────────────────┘
```

## Data Flow - DupScan Scan

```
Frontend (startScan)
    ↓
POST /api/scan/start { scanPath, includeHidden, mode }
    ↓
spawn(python scanner.py --path ... )
    ↓
Python emits JSON lines:
  {type: "scanning", n: 1000, dir: "/foo"}
  {type: "hashing", candidates: 500}
  {type: "progress", done: 100, total: 500}
  {type: "dup", id: "...", files: [...], waste: 1024, ...}
  {type: "done"}
    ↓
Backend (lib/state.js):
  - Accumulates dups in S.dups array
  - Updates progress in S.progress
  - Emits events to EventSource replay buffer
    ↓
GET /api/scan/stream (SSE):
  - Frontend opens EventSource to /api/scan/stream
  - Receives events from replay buffer
  - Updates UI state (liveDups, progress)
    ↓
On completion:
  - persistHistory() → writes to history.json
  - History includes: scan metadata + S.dups array
```

## Data Flow - File Manager Scan

```
Frontend (startFmBackgroundScan)
    ↓
POST /api/fm/scan-bg { action: "start", path, includeHidden }
    ↓
Create Worker thread (scanner-worker.js)
    ↓
Worker does BFS traversal:
  - Reads cached fileIndex from history.json
  - Traverses root folder
  - Emits messages to parent:
    {type: "upsert", files: [...]}
    {type: "progress", progress: {...}}
    {type: "remove", paths: [...]}
    {type: "complete"}
    ↓
Backend (app/api/fm/scan-bg):
  - Receives messages
  - Updates STATE.workingIndex
  - Periodically saves to history.json
    ↓
Frontend polls or listens for progress:
  GET /api/fm/scan-bg?action=progress
  - Returns STATE.workingIndex.status + progress
```

## Current Storage Structure

### history.json (DupScan)
```json
{
  "scans": [
    {
      "id": "s_1234567890",
      "path": "C:\\Users",
      "mode": "scan",
      "startedAt": "2026-05-07T10:00:00Z",
      "completedAt": "2026-05-07T10:05:00Z",
      "stats": {
        "sets": 15,
        "extra": 45,
        "waste": 1073741824,
        "byCat": { "Photos": {...}, "Videos": {...} }
      },
      "dups": [
        {
          "id": "d_abc123",
          "hash": "abc123def456...",
          "cat": "Photos",
          "count": 3,
          "waste": 1024000,
          "files": [
            { "path": "C:\\Pics\\pic1.jpg", "size": 512000, "mtime": "..." },
            { "path": "C:\\Pics\\pic2.jpg", "size": 512000, "mtime": "..." }
          ]
        }
      ],
      "marked": {},
      "deleted": [],
      "reportPath": "..."
    }
  ],
  "fileIndex": {
    "rootPath": "C:\\",
    "status": "done",
    "scanMode": "manual",
    "files": {
      "C:\\file1.txt": { name, path, ext, type, category, size, sizeFmt, mtime, hash, isDuplicate, ... },
      "C:\\file2.jpg": { ... }
    },
    "duplicateGroups": [
      { hash, waste, count, files: [...] }
    ]
  }
}
```

## Key Issues

### Issue 1: No Conflict Handling
- DupScan scan can start while FM is scanning (via worker)
- Both can modify S and history.json simultaneously
- No state machine to track which system is active
- UI doesn't warn or prevent conflicts

### Issue 2: Two Data Storage Systems
- DupScan stores in `scans[]` array with duplicates
- FM stores in `fileIndex` with all files + duplicateGroups
- They use same file but different structure
- Can get out of sync if both modify simultaneously
- No atomic transactions

### Issue 3: No Real Incremental Scanning
- DupScan: Always full scan (no tracking of what changed)
- FM: Reads cached index but still full traversal if mtime/size changed
- No change detection at file level
- No optimization to hash only modified files

### Issue 4: Python Scanner Limitations
- Only supports duplicate detection mode
- Doesn't support full file listing (FM needs all files, not just duplicates)
- No incremental mode (doesn't accept previous hashes)
- Output format (JSON lines) but not structured for incremental updates
- No metadata for incremental change detection

### Issue 5: Unreliable Real-Time Updates
- DupScan uses EventSource but relies on replay buffer
- If client reconnects, might miss events or get duplicates
- No guarantee of order or completeness
- Worker communication (FM) uses postMessage but parent might miss messages if not listening

### Issue 6: No Proper Worker State Machine
- Can't query "what is currently scanning?"
- Can't know if DupScan or FM is active
- Can't switch from one scan to another gracefully
- No conflict resolution logic

### Issue 7: Performance Issues
- Large file sets (100k+ files) slow with JSON in memory
- No database indexing
- Every field stored in memory during scan
- Hashing not optimized (no batching)
- Full traversal even if only need changes

### Issue 8: App Restart Issues
- No persistent state about ongoing scans
- If app crashes mid-scan, data may be corrupted
- No recovery mechanism
- File index might be half-written

### Issue 9: No Atomic Operations
- history.json writes not atomic
- Worker saves with race conditions
- Multiple processes can corrupt the file
- No file locking

### Issue 10: Data Consistency Issues
- DupScan marks files as "deleted" but doesn't remove them from fileIndex
- FM creates duplicateGroups but DupScan doesn't use them
- Two systems don't share duplicate group IDs
- Can't trust which system "owns" what data
