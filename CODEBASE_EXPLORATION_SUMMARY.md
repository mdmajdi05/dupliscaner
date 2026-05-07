# DupScan Codebase Exploration - Complete Summary

**Date:** May 8, 2026  
**Objective:** Understand duplicate group structure, database schema, file relationships, UI display, and existing conflict/action handling

---

## Table of Contents
1. [Duplicate Group Structure](#1-duplicate-group-structure)
2. [File-to-Group Linking](#2-file-to-group-linking)
3. [File Metadata Storage](#3-file-metadata-storage)
4. [UI Display Implementation](#4-ui-display-implementation)
5. [Conflict/Action Handling](#5-conflictaction-handling)
6. [Current Data Flow](#current-data-flow-diagram)
7. [What's Ready to Build](#whats-ready-to-build)

---

## 1. Duplicate Group Structure

### Database Schema
**Location:** `docs/DATABASE_SCHEMA.md`  
**Status:** ✅ Fully designed (partially implemented)

```sql
CREATE TABLE duplicate_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,           -- MD5: all files with same hash
  file_count INTEGER NOT NULL,         -- Number of copies (duplicates)
  waste_bytes INTEGER,                 -- (count-1) * file_size
  file_size INTEGER,                   -- Size of each file in group
  is_priority BOOLEAN DEFAULT 0,       -- User-flagged
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_dup_groups_hash ON duplicate_groups(hash);
```

### How Groups Are Created
**Primary File:** `lib/db-scan.js`

1. **Python scanner** finds duplicates → emits `dup` event with all files
2. **ScanProcessor.handleDuplicateEvent()** (lines 198-217):
   ```javascript
   // 1. Create/update group
   await upsertDuplicateGroup(hash, files.length, waste, size);
   
   // 2. Link each file to group
   for (const fileInfo of files) {
     await execDb(
       `UPDATE files SET is_duplicate = 1, duplicate_group_id = ? WHERE path = ?`,
       [hash, fileInfo.path]
     );
   }
   ```

3. **upsertDuplicateGroup()** in `lib/db-ops.js` (lines 61-87):
   - Check if group exists (SELECT by hash)
   - If exists: UPDATE stats
   - If new: INSERT and return `lastInsertRowid`

### Key Metrics Per Group
- **hash** - Unique identifier (all files in group have same hash)
- **file_count** - Number of copies
- **waste_bytes** - Wasted space = (count - 1) × file_size
- **file_size** - Size of each file (all same in group)

**Example:**
```
Group with 4 identical 2MB files:
- file_count: 4
- file_size: 2097152 bytes (2MB)
- waste_bytes: 6291456 bytes (3×2MB) ← Keep 1, delete 3
```

---

## 2. File-to-Group Linking

### Primary Link Column
**Table:** `files`  
**Column:** `duplicate_group_id` (INTEGER, Foreign Key to `duplicate_groups.id`)

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  -- ... other metadata ...
  is_duplicate BOOLEAN DEFAULT 0,      -- 1 if this file has duplicates
  duplicate_group_id INTEGER,          -- FK to duplicate_groups.id
  
  FOREIGN KEY (duplicate_group_id) REFERENCES duplicate_groups(id)
);

CREATE INDEX idx_files_duplicate_group ON files(duplicate_group_id);
```

### Linking Process
```
1. Scanner finds duplicates with hash "a1b2c3d4"
   ↓
2. ScanProcessor creates duplicate_groups entry
   - id: 42, hash: "a1b2c3d4", file_count: 4, waste_bytes: 6291456
   ↓
3. Updates all 4 files:
   UPDATE files SET 
     is_duplicate = 1, 
     duplicate_group_id = 42 
   WHERE path IN (
     '/path/file1.jpg',
     '/path/file2.jpg',
     '/path/file3.jpg',
     '/path/file4.jpg'
   )
   ↓
4. Query to fetch group members:
   SELECT f.* FROM files f
   WHERE f.duplicate_group_id = 42
   ORDER BY f.size DESC
```

### Current State (Hybrid System)
- **SQLite:** Used for new scans (db-scan.js writes to files + duplicate_groups)
- **JSON History:** Legacy format stores in-memory DupScan results
  - Location: `lib/history.js` (scan JSON stored locally)
  - Structure: `scan.dups[]` with embedded file arrays

**Legacy Format Example:**
```javascript
{
  id: "s_1234567890",
  dups: [
    {
      id: "dup_123",
      hash: "a1b2c3d4",
      cat: "Photos",
      count: 4,
      waste: 6291456,
      files: [
        { path: "/file1.jpg", name: "file1.jpg", size: 2097152 },
        { path: "/file2.jpg", name: "file2.jpg", size: 2097152 },
        { path: "/file3.jpg", name: "file3.jpg", size: 2097152 },
        { path: "/file4.jpg", name: "file4.jpg", size: 2097152 }
      ]
    }
  ]
}
```

---

## 3. File Metadata Storage

### Complete File Record
**Table:** `files` (unified for DupScan + File Manager)  
**Status:** ✅ Schema complete, collection working

```sql
CREATE TABLE files (
  -- Identity
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,           -- Full path (case-sensitive on Linux)
  
  -- File Metadata
  name TEXT NOT NULL,                  -- Filename only
  dir TEXT NOT NULL,                   -- Parent directory
  ext TEXT,                            -- Extension (.jpg, .pdf, etc.)
  
  -- File Properties
  size INTEGER NOT NULL,               -- Bytes
  hash TEXT,                           -- MD5 hash (NULL if not hashed yet)
  is_duplicate BOOLEAN DEFAULT 0,      -- 1 if belongs to duplicate group
  duplicate_group_id INTEGER,          -- FK to duplicate_groups.id
  
  -- Timestamps
  file_mtime INTEGER,                  -- File modification time (UNIX)
  file_ctime INTEGER,                  -- File creation time (UNIX)
  
  -- Tracking
  last_scanned INTEGER,                -- Last scan timestamp
  last_hashed INTEGER,                 -- Last hash timestamp
  status TEXT DEFAULT 'active',        -- active|deleted|ignored
  
  -- Flags
  is_hidden BOOLEAN DEFAULT 0,
  category TEXT,                       -- Photos|Videos|Audio|Documents|...
  
  -- Audit
  created_at INTEGER NOT NULL,         -- DB insertion time
  updated_at INTEGER NOT NULL          -- DB update time
);

-- Performance indexes
CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_files_size ON files(size);
CREATE INDEX idx_files_directory ON files(dir);
CREATE INDEX idx_files_is_duplicate ON files(is_duplicate);
CREATE INDEX idx_files_duplicate_group ON files(duplicate_group_id);
CREATE INDEX idx_files_path ON files(path);
```

### Metadata Collection Flow
```
1. scanner.py executes → finds files
2. Emits file_record events (JSON):
   {
     "type": "file_record",
     "path": "/c/Users/Photo.jpg",
     "name": "Photo.jpg",
     "folder": "/c/Users",
     "size": 2097152,
     "ext": ".jpg",
     "category": "Photos",
     "mtime": 1620000000
   }

3. db-scan.js handleFileRecord() (lines 138-166)
   - Buffers file in memory
   - Batches insert when buffer reaches 500 files

4. Buffered files inserted to database:
   INSERT INTO files (
     path, name, dir, size, ext, category, 
     mtime, created_at, updated_at, status
   ) VALUES (...)

5. Later, if duplicates found:
   UPDATE files SET is_duplicate = 1, 
   duplicate_group_id = ? WHERE path = ?
```

### Metadata Per File Example
```
Path:        /c/Users/md majdi/Pictures/2021/photo1.jpg
Name:        photo1.jpg
Dir:         /c/Users/md majdi/Pictures/2021
Ext:         .jpg
Size:        2097152 (2 MB)
Category:    Photos
Hash:        a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 (after hashing)
Modified:    1620000000 (UNIX timestamp)
Created:     1619999999 (UNIX timestamp)
Duplicate:   true (1)
GroupId:     42 (FK to duplicate_groups.id = 42)
Status:      active
Hidden:      false
LastScanned: 1715000000 (this scan)
LastHashed:  1715000000 (when hash computed)
```

---

## 4. UI Display Implementation

### Component Hierarchy
```
DupScanWorkspace (main workspace)
  ├─ TopBar (search, filter, scan controls)
  ├─ StatsBar (summary: X groups, Y waste)
  └─ ResultsView (main display)
      ├─ FolderSection (groups by folder)
      │  └─ DupGroup (per duplicate group)
      │     ├─ Header (cat icon, filename, count, waste)
      │     ├─ Keep banner (shows which file to keep)
      │     └─ FileRow[] (list of files in group)
      │        ├─ Keep button (crown icon)
      │        ├─ Status pill (delete/keep/mark/ignore)
      │        ├─ Preview button
      │        ├─ File info (name, size, mtime, path)
      │        └─ Actions (copy path, delete from disk)
      └─ GalleryView (alternative: thumbnail grid)
```

### ResultsView Component
**File:** `features/dupscan/components/ResultsView.jsx`

**Grouping & Filtering:**
```javascript
const filtered = useMemo(()=>{
  let list = dups;
  
  // Filter by category
  if (filter.cat !== 'All') 
    list = list.filter(d => d.cat === filter.cat);
  
  // Filter by text search
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(d => 
      d.files.some(f => 
        f.path.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q)
      )
    );
  }
  
  // Filter by folder
  if (filter.folder) {
    const q = filter.folder.toLowerCase();
    list = list.filter(d => 
      d.files.some(f => f.folder.toLowerCase().includes(q))
    );
  }
  
  // Filter by action status
  if (filter.showStatus !== 'all') {
    if (filter.showStatus === 'unset') {
      list = list.filter(d => d.files.some(f => !fileStatus[f.path]));
    } else {
      list = list.filter(d => 
        d.files.some(f => fileStatus[f.path] === filter.showStatus)
      );
    }
  }
  
  return list;
}, [dups, filter, fileStatus]);

// Group by folder or category
const grouped = useMemo(()=>{
  if (groupBy === 'flat') return {_all: filtered};
  
  const m = {};
  for(const d of filtered) {
    const key = groupBy === 'category' ? d.cat : d.files[0]?.folder;
    if(!m[key]) m[key] = [];
    m[key].push(d);
  }
  return m;
}, [filtered, groupBy]);
```

### DupGroup Component (Collapsible Group)
**File:** `features/dupscan/components/ResultsView.jsx` (lines 95-190)

**Shows:**
1. **Collapsed header:**
   - Folder icon
   - First filename
   - Category badge (Photos, Videos, etc.)
   - Count badge ("4 copies")
   - Waste size ("-2 MB")
   - Review count ("2/4 reviewed") if some files have actions

2. **When expanded:**
   - Green banner: "Photo1.jpg will be kept · Click → to change KEEP file"
   - FileRow for each file in group

**Code:**
```jsx
<div className="mb-2 rounded-lg" style={{border:'1px solid var(--border)'}}>
  {/* Header */}
  <div onClick={() => setOpen(!open)}>
    <ChevronIcon />
    <CategoryIcon color={catColor} />
    <span>{dup.files[0]?.name}</span>
    <Badge>{dup.cat}</Badge>
    <Badge>{dup.count} copies</Badge>
    <span>−{fmtSize(dup.waste)}</span>
    {reviewed > 0 && <Badge>{reviewed}/{dup.count} reviewed</Badge>}
  </div>
  
  {/* Keep banner */}
  {open && (
    <div style={{background: 'rgba(0,230,118,.04)'}}>
      <Crown />
      <span>{dup.files[keepIdx]?.name} will be kept</span>
    </div>
  )}
  
  {/* File rows */}
  {open && dup.files.map((file, idx) => (
    <FileRow key={file.path} {...props} />
  ))}
</div>
```

### FileRow Component (Individual File)
**File:** `features/dupscan/components/ResultsView.jsx` (lines 12-68)

**Layout:**
```
[Keep Button] [Status Pill] [Preview] [Info] [Path] [CopyPath] [Delete]
```

**Features:**
- **Keep Button:** Crown icon (if is original) or arrow icon (clickable)
  - Clicking: `onSetKeep(groupId, fileIdx)` → sets this as "keep" file
  - Only one file per group can be "keep"

- **Status Pill:** Shows current action
  - Options: delete | keep | mark | ignore | (empty/unset)
  - Color coded: red | green | yellow | gray | gray
  - Clicking: Opens dropdown to change status

- **Preview Button:** Eye icon → opens PreviewModal

- **File Info:**
  - Name (with strikethrough if deleted)
  - Size badge (e.g., "2.1 MB")
  - Modification date (hidden on small screens)
  - Path (mono font, truncated)

- **Actions (on hover):**
  - Copy path button
  - Delete from disk button (red, trash icon)

**Data Used:**
```javascript
const st = fileStatus[file.path];  // Current action for this file
const isDeleted = st === 'deleted';  // Visual feedback

// Render logic
<div className={isDeleted ? 'opacity-40' : ''}>
  {/* file row content */}
</div>
```

### State Management (useDupScan Hook)
**File:** `features/dupscan/hooks/useDupScan.js` (lines 1-120)

```javascript
const [liveDups, setLiveDups] = useState([]);      // Array of dup groups
const [fileStatus, setFileStatus] = useState({});  // {path: 'delete'|'keep'|'mark'|null}
const [keepMap, setKeepMap] = useState({});        // {groupId: indexOfKeepFile}
const [filter, setFilter] = useState({
  cat: 'All',
  folder: '',
  search: '',
  showStatus: 'all'
});

// Real-time stream from /api/scan/stream
const handleEv = useCallback((ev) => {
  switch (ev.type) {
    case 'dup':
      setLiveDups(prev => 
        prev.find(d => d.id === ev.id) ? prev : [...prev, ev]
      );
      break;
    case 'done':
      setStatus('done');
      break;
    // ... other events
  }
}, []);
```

### Data Passed to UI
```javascript
<DupScanWorkspace
  dups={dups}                    // Current duplicate groups
  fileStatus={fileStatus}        // {path: action_status}
  keepMap={keepMap}              // {groupId: keep_index}
  filter={filter}                // Search/sort/filter criteria
  status={status}                // 'idle'|'scanning'|'done'|'error'
  progress={progress}            // {stage, done, total}
  onSetStatus={...}              // (path, status) → setFileStatus
  onSetKeep={...}                // (groupId, index) → setKeepMap
  onDeleteFile={...}             // (path) → /api/delete
  onPreview={...}                // (group, index) → open preview
/>
```

---

## 5. Conflict/Action Handling

### Current State: ⚠️ Partially Implemented

#### A. File Deletion (✅ Working)
**File:** `app/api/delete/route.js`

```javascript
export async function POST(req) {
  const { path: filePath } = await req.json();
  
  if (!fs.existsSync(filePath)) 
    return Response.json({ ok: true, alreadyGone: true });
  
  const st = fs.statSync(filePath);
  if (st.isDirectory()) 
    return Response.json({ error: 'Cannot delete directory' });
  
  // Delete from disk
  fs.unlinkSync(filePath);
  
  // Update cache
  mutateFileIndex((index) => {
    delete index.files[filePath];
    for (const [groupId, originalPath] of Object.entries(index.originals)) {
      if (originalPath === filePath) 
        delete index.originals[groupId];
    }
    buildDerivedIndex(index);
    return index;
  });
  
  return Response.json({ ok: true });
}
```

**Called from:** `features/dupscan/services/scanService.js`
```javascript
export async function deleteDupFile(path) {
  return fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
}
```

**Issue:** Direct deletion, no undo capability, not transactional.

---

#### B. File Marks Table (✅ Designed, ⚠️ Not Connected)
**File:** `lib/init-db.js` (lines 129-140)

```sql
CREATE TABLE file_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL UNIQUE,
  mark_type TEXT NOT NULL,          -- 'delete'|'keep'|'mark'|'ignore'
  marked_at INTEGER NOT NULL,       -- UNIX timestamp
  marked_by TEXT DEFAULT 'user',    -- 'user'|'auto'|'system'
  
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_marks_type ON file_marks(mark_type);
```

**Function exists but NOT called:**
```javascript
// lib/db-ops.js (lines 213-226)
export async function markFile(filePath, markType) {
  const now = Math.floor(Date.now() / 1000);
  return transactionDb(async () => {
    const file = await queryDbOne('SELECT id FROM files WHERE path = ?', [filePath]);
    if (!file) throw new Error('File not found');
    
    await execDb(
      `INSERT OR REPLACE INTO file_marks (file_id, mark_type, marked_at)
       VALUES (?, ?, ?)`,
      [file.id, markType, now]
    );
  });
}
```

**Status:** Table ready, but UI's `onSetStatus()` doesn't call this. Currently only updates React state.

---

#### C. Keep/Original File Tracking (⚠️ In-Memory Only)
**File:** `app/api/fm/action/route.js` (lines 63-70)

```javascript
if (action === 'mark-original') {
  if (!groupId || !originalPath) 
    return Response.json({ error: 'groupId and originalPath required' });
  
  mutateFileIndex((index) => {
    index.originals[groupId] = originalPath;  // ← Stored in memory only
    buildDerivedIndex(index);
    return index;
  });
  
  return Response.json({ ok: true, groupId, originalPath });
}
```

**Issue:** Stored in `fileIndex.originals` (RAM). Not persisted to database.  
**Missing table:** Need `originals` or `keep_files` table in SQLite.

---

#### D. Scan Conflict Detection (✅ Designed, ⚠️ Not Enforced)
**File:** `lib/db-ops.js`

**Function `checkScanConflict()`** (lines 35-54):
```javascript
export async function checkScanConflict() {
  const state = await getWorkerState();
  
  if (!state.current_scan_id) {
    return { hasConflict: false };
  }
  
  const scan = await queryDbOne(
    'SELECT * FROM scan_history WHERE scan_id = ?',
    [state.current_scan_id]
  );
  
  return {
    hasConflict: true,
    currentScan: scan,
    currentScanType: state.current_scan_type,
  };
}
```

**Function `atomicStartScan()`** (lines 57-88):
```javascript
export async function atomicStartScan(scanId, scanType, rootPath, includeHidden) {
  return transactionDb(async () => {
    // Check if another scan is running
    const state = await getWorkerState();
    if (state && state.current_scan_id) {
      throw new Error('CONFLICT_SCAN_RUNNING');
    }
    
    // Atomically set current scan
    await updateWorkerState({
      current_scan_id: scanId,
      current_scan_type: scanType,
      // ...
    });
    
    return { scanId, historyId };
  });
}
```

**Status:** Functions exist but NOT CALLED from scan APIs.  
**Current behavior:** `/api/scan/start/route.js` still uses legacy state management (doesn't check for conflicts).

---

#### E. Worker State Tracking (✅ Schema Ready)
**File:** `lib/init-db.js` (lines 113-128)

```sql
CREATE TABLE worker_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton (always id=1)
  
  current_scan_id TEXT,            -- NULL if idle, else scan_id
  current_scan_type TEXT,          -- NULL if idle, 'duplicates'|'full'
  
  started_at INTEGER,              -- When current scan started
  
  phase TEXT,                      -- scanning_files|hashing|comparing
  files_processed INTEGER DEFAULT 0,
  files_to_process INTEGER DEFAULT 0,
  current_directory TEXT,
  
  updated_at INTEGER NOT NULL
);
```

**Usage Functions:**
- `getWorkerState()` - Read singleton (lines 10-13)
- `updateWorkerState(updates)` - Update fields atomically (lines 17-26)

---

#### F. User Action History (⚠️ Partially Designed)
**Table:** `scan_events` (for audit trail)

```sql
CREATE TABLE scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  event_type TEXT NOT NULL,       -- 'file_hashed'|'file_deleted'|'error'|...
  data TEXT,                      -- JSON event details
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_scan_events_scan_id ON scan_events(scan_id);
```

**Status:** Defined but mostly used for error logging, not user actions.

---

### Missing: What Needs to Be Built

**High Priority:**
1. ❌ **Conflict Resolution UI Modal**
   - Detect when user tries to start scan while one is running
   - Show which scan is running
   - Let user: cancel new scan | stop current scan | wait

2. ❌ **Persist File Action Choices**
   - Connect UI's `onSetStatus()` → call `markFile()` in DB
   - Save delete/keep/mark decisions to `file_marks` table

3. ❌ **Batch Action Execution**
   - User clicks "Execute" button
   - Perform all marked deletions transactionally
   - Rollback on errors

4. ❌ **Persist Original/Keep File**
   - Add `keep_files` table or use `file_marks` with special type
   - Store which file is "keep" (original) in each group

**Medium Priority:**
5. ⚠️ **Incremental Scanning**
   - Only hash files with changed size/mtime
   - Result: 100x faster second scan

6. ⚠️ **Action Undo**
   - Track all deletions with timestamp
   - Let user recover files from recycle bin

7. ⚠️ **Real-time State Polling**
   - Replace EventSource with `/api/query/state` polling
   - Always accurate, never drops data

---

## Current Data Flow Diagram

```
SCAN PHASE:
───────────
    Python scanner.py
          ↓
    JSON events (stdout)
          ↓
    lib/db-scan.js (ScanProcessor)
    ├─ Insert files to SQLite
    ├─ Create duplicate_groups
    ├─ Link files to groups
    ├─ Maintain state.js (in-memory S.dups)
    └─ Report to legacy history.json
          ↓
    state.js (S.dups array)
          ↓
    /api/scan/stream (EventSource)
          ↓
    UI (React - useDupScan hook)
    └─ Receives dup events in real-time


USER ACTION PHASE:
──────────────────
    User clicks action in UI
    ├─ Delete button → /api/delete
    │  ├─ Delete file from disk
    │  └─ Update fileIndex cache
    │
    ├─ Status pill → setFileStatus (React state only)
    │  ├─ NOT persisted to DB
    │  └─ Lost if page refreshes
    │
    └─ Keep button → onSetKeep
       ├─ Updates keepMap (React state)
       ├─ Calls /api/fm/action?action=mark-original
       └─ Stored in fileIndex.originals (RAM only)


MISSING LAYER:
───────────────
    User actions → /api/actions/mark
                  └─ Persist to file_marks table
                  └─ Make decisions recoverable
```

---

## What's Ready to Build

### ✅ Completely Ready (Schema + Code Exists)
- Database connection layer (lib/db.js)
- Duplicate group creation and linking
- File metadata collection and storage
- Scan history tracking
- Worker state singleton
- Conflict detection functions
- File deletion API
- Basic index structures

### ⚠️ Partially Ready (Schema exists, needs connection)
- File marks table exists but not called from UI
- Conflict functions exist but not called from scan APIs
- Keep file tracking exists but only in memory
- Atomic transaction framework exists but not used in routes

### ❌ Not Yet Implemented
- **Conflict Resolution UI** - Modal to handle simultaneous scans
- **Persist User Decisions** - Save file actions to DB
- **Batch Execution** - Execute all marked deletions atomically
- **Incremental Scanning** - Only hash changed files
- **Action Undo** - Recover deleted files
- **Real-time Polling** - Accurate state sync
- **Action History** - Audit trail of all user decisions

---

## Files by Responsibility

### Database Layer (`lib/`)
- `db.js` - SQLite connection, queryDb, execDb, transactionDb
- `init-db.js` - Schema initialization, migrations
- `db-ops.js` - Higher-level DB operations (upsertDuplicateGroup, markFile, etc.)
- `db-scan.js` - ScanProcessor for Python scanner events

### UI Components (`features/dupscan/components/`)
- `ResultsView.jsx` - Main list display with filtering/grouping
- `DupScanWorkspace.jsx` - Main container
- `StatusPill.jsx` - File action selector (delete/keep/mark/ignore)
- `GalleryView.jsx` - Thumbnail view alternative
- `PreviewModal.jsx` - File preview
- `TopBar.jsx` - Search, filter, scan controls
- `StatsBar.jsx` - Summary statistics

### State Management (`features/dupscan/`)
- `hooks/useDupScan.js` - Main state hook (dups, fileStatus, keepMap)
- `services/scanService.js` - API calls (startDupScan, deleteDupFile, etc.)

### API Routes (`app/api/`)
- `scan/start/route.js` - Start scan (calls db-scan.js)
- `scan/stream/route.js` - EventSource for real-time updates
- `delete/route.js` - Delete file from disk
- `fm/action/route.js` - File manager actions (mark-original, delete, move)
- `history/route.js` - Get/delete scan history

---

## Summary: Ready to Implement

The codebase has excellent **foundational work** completed:
- ✅ SQLite schema fully designed and partially implemented
- ✅ Database layer code exists (connections, transactions, queries)
- ✅ Duplicate group and file linking logic complete
- ✅ UI display working well
- ✅ Conflict detection functions designed

What's needed is **connecting the pieces**:
1. Call conflict detection before starting scans
2. Persist user file action choices to file_marks table
3. Build batch action execution (execute all marked deletions)
4. Add UI modal for conflict resolution
5. Implement incremental scanning (optional, for performance)

**Estimated effort:** 1-2 weeks for core features (1-4), optional 1 week for feature 5.
