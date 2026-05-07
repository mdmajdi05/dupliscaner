# TODO: Shared consistency refactor for DupScan and File Manager
**Started:** 2026-05-07
**Status:** In Progress

## Task Understanding
Implement approved global/shared consistency improvements by introducing shared preview and file-type helpers, aligning service usage (remove direct API fetch usage in File Manager duplicates view), and standardizing response handling patterns where feasible without violating feature boundaries.

## Affected Files
- shared/utils/preview.js
- shared/utils/fileType.js
- features/file-manager/services/fileManagerService.js
- features/file-manager/components/DuplicatesTab.jsx
- features/dupscan/components/PreviewModal.jsx
- features/dupscan/components/GalleryView.jsx
- features/dupscan/README.md
- features/file-manager/README.md
- docs/wiring.md
- CHANGES_MADE.md

## Steps
- [x] Step 1: Read current duplicates and preview-related files in both features
- [x] Step 2: Add shared preview URL and file-type helper utilities
- [x] Step 3: Refactor File Manager duplicates tab to use service layer only
- [x] Step 4: Refactor DupScan preview/gallery to consume shared helpers
- [x] Step 5: Validate with lint/build checks
- [x] Step 6: Update relevant .md files and TODO progress
