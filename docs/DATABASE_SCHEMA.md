# DATABASE SCHEMA Design - SQLite

## Database Location

```
%LOCALAPPDATA%/DupScan/dupscan.db (SQLite 3)
```

---

## Tables Schema

### 1. `files` - All indexed files (unified for both DupScan + File Manager)

```sql
CREATE TABLE files (
  -- Primary Key
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,  -- Full file path (case-sensitive on Linux, insensitive on Windows)
  
  -- File Metadata
  name TEXT NOT NULL,          -- Just filename
  dir TEXT NOT NULL,           -- Parent directory path
  ext TEXT,                    -- File extension (.jpg, .pdf, etc)
  
  -- File Properties
  size INTEGER NOT NULL,       -- File size in bytes
  hash TEXT,                   -- MD5 hash (NULL if not hashed yet)
  is_duplicate BOOLEAN DEFAULT 0,  -- 1 if this file has duplicates
  duplicate_group_id INTEGER,  -- FK to duplicate_groups.id (NULL if unique)
  
  -- Timestamps
  file_mtime INTEGER,          -- File modification time (UNIX timestamp)
  file_ctime INTEGER,          -- File creation time
  
  -- Tracking
  last_scanned INTEGER,        -- Last scan timestamp (UNIX)
  last_hashed INTEGER,         -- Last hash timestamp (UNIX)
  status TEXT DEFAULT 'active', -- active|deleted|ignored
  
  -- Flags
  is_hidden BOOLEAN DEFAULT 0,
  category TEXT,               -- Photos|Videos|Audio|Documents|Archives|Code|Others
  
  -- Audit
  created_at INTEGER NOT NULL, -- DB insertion time
  updated_at INTEGER NOT NULL, -- DB update time
  
  FOREIGN KEY (duplicate_group_id) REFERENCES duplicate_groups(id)
);

CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_files_size ON files(size);
CREATE INDEX idx_files_directory ON files(dir);
CREATE INDEX idx_files_is_duplicate ON files(is_duplicate);
CREATE INDEX idx_files_duplicate_group ON files(duplicate_group_id);
CREATE INDEX idx_files_path ON files(path);
```

### 2. `duplicate_groups` - Groups of identical files

```sql
CREATE TABLE duplicate_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Identification
  hash TEXT NOT NULL UNIQUE,   -- MD5 hash (all files in this group have same hash)
  
  -- Statistics
  file_count INTEGER NOT NULL, -- Number of files with this hash
  waste_bytes INTEGER,         -- Total waste = (count-1) * size
  file_size INTEGER,           -- Size of each file in group
  
  -- Flags
  is_priority BOOLEAN DEFAULT 0, -- Mark for user attention
  
  -- Audit
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_dup_groups_hash ON duplicate_groups(hash);
```

### 3. `scan_history` - Audit trail of all scans

```sql
CREATE TABLE scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Scan Identity
  scan_id TEXT NOT NULL UNIQUE,    -- s_<timestamp> or fm_<timestamp>
  scan_type TEXT NOT NULL,         -- 'duplicates' (DupScan) | 'full' (File Manager)
  
  -- Scan Details
  root_path TEXT NOT NULL,         -- Which folder was scanned
  include_hidden BOOLEAN DEFAULT 0,
  
  -- Execution Info
  started_at INTEGER NOT NULL,     -- UNIX timestamp
  completed_at INTEGER,            -- NULL if still scanning
  duration_ms INTEGER,             -- Total time in ms
  
  -- Results
  status TEXT NOT NULL,            -- idle|scanning|done|stopped|error
  error_msg TEXT,                  -- NULL if no error
  
  -- Statistics
  files_found INTEGER,             -- Total files scanned
  files_hashed INTEGER,            -- Files that were hashed
  files_changed INTEGER,           -- Files changed since last scan
  duplicate_groups_count INTEGER,  -- Number of duplicate groups found
  total_waste_bytes INTEGER,       -- Total wasted space
  
  -- Flags
  is_auto_scan BOOLEAN DEFAULT 0,  -- Whether triggered by auto-scan
  is_incremental BOOLEAN DEFAULT 0, -- Whether incremental or full
  
  -- Audit
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_scan_history_type ON scan_history(scan_type);
CREATE INDEX idx_scan_history_status ON scan_history(status);
CREATE INDEX idx_scan_history_started ON scan_history(started_at);
```

### 4. `worker_state` - Current scanning state (singleton)

```sql
CREATE TABLE worker_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Always 1 (singleton)
  
  -- Current State
  current_scan_id TEXT,            -- NULL if idle, else scan_id from scan_history
  current_scan_type TEXT,          -- NULL if idle, else 'duplicates'|'full'
  
  -- Timing
  started_at INTEGER,              -- When current scan started
  
  -- Progress
  phase TEXT,                      -- scanning_files|hashing|comparing|done
  files_processed INTEGER DEFAULT 0,
  files_to_process INTEGER DEFAULT 0,
  current_directory TEXT,
  
  -- Last State Save
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_worker_state_singleton ON worker_state(id);
```

### 5. `file_marks` - User marks (keep/delete/skip) for duplicates

```sql
CREATE TABLE file_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  file_id INTEGER NOT NULL UNIQUE,  -- FK to files.id
  
  -- Mark Info
  mark_type TEXT NOT NULL,         -- keep|delete|skip|review
  marked_at INTEGER NOT NULL,      -- UNIX timestamp
  marked_by TEXT DEFAULT 'user',   -- user|auto
  
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_marks_type ON file_marks(mark_type);
```

### 6. `settings` - Application settings

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Example rows:
-- key='autoScan', value='0'|'1'
-- key='scanPath', value='C:\Users'
-- key='includeHidden', value='0'|'1'
-- key='lastDupScanId', value='s_1234567890'
-- key='lastFmScanId', value='fm_1234567890'
```

---

## Key Design Decisions

### 1. Unified Files Table
- Single source of truth for all files (whether found by DupScan or FM)
- Both systems append/update to same table
- No duplicated data between subsystems
- Consistent file metadata across features

### 2. Incremental Scanning Support
- `last_scanned` timestamp per file allows change detection
- Can compare: current file mtime vs last_scanned → file changed
- Next scan: skip unchanged files (if mtime & size same)
- Only hash changed files → huge performance boost

### 3. Worker State Tracking
- `worker_state` table tracks "what is currently scanning"
- Before starting scan, check if `worker_state.current_scan_id` is NULL
- If not NULL → conflict exists → show popup
- Atomic check-and-update in transaction

### 4. Duplicate Groups Separation
- `duplicate_groups` is lightweight (just hash + count)
- Can be rebuilt from `files` table if corrupted
- Efficient to query "all files in this group" via `files.duplicate_group_id`

### 5. Audit Trail
- `scan_history` keeps record of every scan
- Useful for debugging, resuming, analytics
- Can see progression over time

### 6. Marks Isolation
- `file_marks` separate from `files` to keep table lean
- Only created for files that user explicitly marks
- Efficient queries for "show marked files"

---

## Indexes Strategy

### Performance-Critical Indexes
- `idx_files_hash` - for duplicate detection (find "all files with hash X")
- `idx_files_size` - for size-grouping phase
- `idx_files_duplicate_group` - for querying duplicate group members
- `idx_files_path` - for fast path lookup (prevent duplicate inserts)

### Query Optimization Indexes
- `idx_files_directory` - for listing files in folder (FM view)
- `idx_files_is_duplicate` - for DupScan tab filtering
- `idx_dup_groups_hash` - for group lookups
- `idx_scan_history_type` - for filtering scans by type
- `idx_file_marks_type` - for finding marked files

---

## Transactions & Locking

### Scan Start - Atomic Check
```sql
BEGIN TRANSACTION;
  SELECT current_scan_id FROM worker_state WHERE id = 1;
  IF (result is NULL):
    UPDATE worker_state SET current_scan_id = ?, current_scan_type = ?, ...;
  ELSE:
    -- Conflict
    ROLLBACK;
COMMIT;
```

### Batch File Insert - Performance
```sql
BEGIN TRANSACTION;
  INSERT INTO files (path, name, dir, size, hash, ...) VALUES (...), (...), ...;  -- 1000s at once
COMMIT;
```

### Incremental Hash Update
```sql
BEGIN TRANSACTION;
  UPDATE files SET hash = ?, last_hashed = ? WHERE path = ?;
  UPDATE duplicate_groups SET file_count = ? WHERE hash = ?;
COMMIT;
```

---

## Migration from JSON to SQLite

### Phase 1: Read JSON
- Load existing history.json
- Parse `scans[]` and `fileIndex`

### Phase 2: Schema Creation
- Create SQLite DB
- Create all tables

### Phase 3: Data Import
- Convert `scans[].dups` → populate `files` + `duplicate_groups`
- Convert `fileIndex.files` → populate `files` (with is_duplicate = false for non-dups)
- Convert `fileIndex.duplicateGroups` → update `files.is_duplicate` and `duplicate_group_id`
- Convert scan metadata → populate `scan_history`

### Phase 4: Backward Compatibility
- Keep history.json as backup
- Read from SQLite going forward
- Fallback to JSON if DB corrupted

---

## Performance Considerations

### For Large File Sets (1M+ files)
- Use PRAGMA optimizations:
  ```sql
  PRAGMA journal_mode = WAL;      -- Write-Ahead Logging for better concurrency
  PRAGMA synchronous = NORMAL;    -- Balance safety vs speed
  PRAGMA cache_size = 10000;      -- Larger cache for large result sets
  PRAGMA temp_store = MEMORY;     -- In-memory temp for sorting
  ```

### Hashing Batching
- Don't hash all at once
- Batch updates: hash 1000 files → INSERT/UPDATE → repeat
- Keep memory footprint low

### Index Maintenance
- Disable indexes during massive inserts
- Rebuild after insert complete
- PRAGMA optimize; after scan complete

---

## Example Queries

### Find all duplicates
```sql
SELECT * FROM files 
WHERE is_duplicate = 1 
ORDER BY duplicate_group_id;
```

### Find duplicates in specific folder
```sql
SELECT f.* FROM files f
WHERE f.dir LIKE '/path/to/folder%'
  AND f.is_duplicate = 1;
```

### Get duplicate group with all members
```sql
SELECT f.* FROM files f
WHERE f.duplicate_group_id = ? 
ORDER BY f.size DESC;
```

### Check if scan already running
```sql
SELECT current_scan_id FROM worker_state WHERE id = 1;
```

### Get incremental changes since last scan
```sql
SELECT * FROM files 
WHERE last_scanned IS NULL 
  OR file_mtime > last_scanned
  OR status = 'active' AND path NOT IN (SELECT path FROM files WHERE last_scanned > ?)
ORDER BY size DESC;
```

### Get scan statistics
```sql
SELECT 
  COUNT(*) as total_files,
  COUNT(DISTINCT hash) as unique_hashes,
  SUM(CASE WHEN is_duplicate=1 THEN 1 ELSE 0 END) as duplicate_files,
  SUM(waste_bytes) as total_waste
FROM files
JOIN duplicate_groups ON files.duplicate_group_id = duplicate_groups.id;
```
