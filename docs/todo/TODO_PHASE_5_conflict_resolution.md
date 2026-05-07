# TODO: PHASE 5 - Conflict Resolution UI

**Started:** May 8, 2026  
**Status:** In Progress  
**Priority:** HIGH - User-facing feature for handling duplicate files

---

## Overview

Build UI component to handle user actions when duplicates are found. Users need ability to:
- View duplicate groups
- Select which copy to keep
- Delete, move, or merge duplicates
- Handle conflicts when actions fail

---

## Task Breakdown

### Step 1: Understand Current Duplicate Data Structure
- [ ] Review database schema for duplicate_groups and files
- [ ] Understand how duplicates are linked
- [ ] Check what metadata available for each file (size, mtime, path, etc.)

### Step 2: Create Conflict Resolution API Endpoints
- [ ] GET /api/duplicates/groups - List all duplicate groups
- [ ] GET /api/duplicates/groups/:hash - Get files in group
- [ ] POST /api/duplicates/action - Execute delete/move action
- [ ] Handle partial failures and rollback

### Step 3: Create React Component
- [ ] ConflictModal.jsx - Display duplicate files
- [ ] File comparison (side-by-side)
- [ ] Action buttons (Delete, Keep, Move)
- [ ] Batch operations
- [ ] Progress feedback

### Step 4: Integrate with DupScan UI
- [ ] Add "Resolve Duplicates" button to ResultsView
- [ ] Pass duplicate group data to modal
- [ ] Handle action completion
- [ ] Update results view after action

### Step 5: Error Handling
- [ ] Handle permission denied on delete/move
- [ ] Handle file locked errors
- [ ] Retry logic
- [ ] User feedback on failures

### Step 6: Testing
- [ ] Create test duplicate files
- [ ] Test delete action
- [ ] Test move action
- [ ] Test error scenarios

---

## Database Schema Reference

```sql
-- duplicate_groups table
CREATE TABLE duplicate_groups (
  id TEXT PRIMARY KEY,           -- hash
  hash TEXT NOT NULL,            
  file_count INTEGER NOT NULL,
  waste_bytes INTEGER,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- files table (relevant columns)
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT,
  folder TEXT,
  size INTEGER,
  mtime INTEGER,
  hash TEXT,
  is_duplicate BOOLEAN,
  duplicate_group_id TEXT,       -- references duplicate_groups.hash
  ...
);
```

---

## API Endpoints to Create

### 1. List Duplicate Groups
```
GET /api/duplicates/groups

Response:
{
  groups: [
    {
      hash: "abc123...",
      file_count: 3,
      waste_bytes: 2048000,
      file_size: 1024000,
      files: [
        { path, name, folder, size, mtime, created }
      ]
    }
  ]
}
```

### 2. Get Single Group
```
GET /api/duplicates/groups/:hash

Response:
{
  hash: "abc123...",
  file_count: 3,
  waste_bytes: 2048000,
  files: [
    { path, name, folder, size, mtime, created }
  ]
}
```

### 3. Execute Action
```
POST /api/duplicates/action

Body:
{
  action: "delete" | "move" | "keep",
  groupHash: "abc123...",
  files: [
    { path, action: "delete" | "move" | "keep" },
    { path: "C:\\new\\location", action: "move" }
  ]
}

Response:
{
  success: true,
  deleted: 2,
  moved: 1,
  failures: [],
  warnings: []
}
```

---

## Component Structure

```
DupScanWorkspace.jsx
  ├─ ResultsView.jsx
  │  └─ "Resolve Duplicates" button
  │     └─ ConflictModal.jsx (modal)
  │        ├─ GroupList (list groups)
  │        ├─ FileComparison (show files)
  │        └─ ActionButtons (delete/move/keep)
```

---

## Implementation Plan

**Phase 5A - Database/API Layer:**
1. Query duplicate_groups with file details
2. Create action execution endpoint
3. Implement delete with permission handling
4. Implement move with path handling

**Phase 5B - UI Layer:**
1. ConflictModal component
2. Display groups and files
3. Action buttons and feedback
4. Error handling and retry

**Phase 5C - Integration:**
1. Add button to ResultsView
2. Pass data to modal
3. Refresh after action
4. Progress indicators

---

## Success Criteria

✅ Can list all duplicate groups  
✅ Can delete duplicate files  
✅ Can move duplicate files to new location  
✅ Can keep selected file and delete others  
✅ Permission errors handled gracefully  
✅ Partial failures tracked and reported  
✅ UI provides clear feedback  
✅ Actions are reversible (undo support)  

---

## Notes

- Don't delete files without explicit user confirmation
- Verify files still exist before deleting (race conditions)
- Log all file operations for audit trail
- Keep in mind: DupScan and File Manager both need this
