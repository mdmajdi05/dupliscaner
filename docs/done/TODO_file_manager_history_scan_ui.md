# TODO: File Manager history-first scan and UI fixes
**Started:** 2026-05-06
**Status:** In Progress

## Task Understanding
Implement requested File Manager fixes so data loads first from `%LOCALAPPDATA%/DupScan/history.json`, then scanning runs in background or manually based on mode. Ensure progress is persisted continuously, manual and per-folder BFS scan controls work, auto-scan does not run unless enabled, and refresh/restart preserves previously scanned data. Fix grid sizing/overflow issues, improve lazy rendering behavior, and correct viewer/action issues without removing existing features.

## Affected Files
- features/file-manager/components/FileManagerDashboard.jsx
- features/file-manager/components/FileManagerSidebar.jsx
- features/file-manager/components/FileManagerItemViews.jsx
- features/file-manager/components/VirtualScroller.jsx
- features/file-manager/components/VirtualGridScroller.jsx
- features/file-manager/components/EnhancedFileViewer.jsx
- features/file-manager/components/FolderPickerModal.jsx
- features/file-manager/services/fileManagerService.js
- app/api/fm/scan-bg/route.js
- app/api/fm/ls/route.js
- lib/fm-cache.js
- lib/scanner-worker.js
- features/file-manager/README.md
- CHANGES_MADE.md

## Steps
- [x] Step 1: Read existing file-manager and scan persistence code paths
- [x] Step 2: Implement history-first load and persistent incremental write flow
- [x] Step 3: Add auto/manual scan mode behavior and explicit scan controls
- [x] Step 4: Enforce BFS traversal for manual and per-folder scan flows
- [x] Step 5: Fix grid sizing/overflow and related file-manager UI issues
- [x] Step 6: Improve lazy rendering behavior and reduce unnecessary loading states
- [x] Step 7: Fix in-app/external viewer and file action edge cases
- [x] Step 8: Validate behavior with targeted checks
- [x] Step 9: Update relevant .md files and mark TODO progress
- [ ] Step 10: Add expand and collaps features in both side baar and add sidebaar width controller just like vs code and coursor when hover i can hold and move the size width
- [ ] Step 11: Add expand and collaps features in both side baar and add sidebaar width controller just like vs code and coursor when hover i can hold and move the size width
