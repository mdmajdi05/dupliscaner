# TODO: Codebase consistency audit and DupScan PDF preview fix
**Started:** 2026-05-07
**Status:** In Progress

## Task Understanding
Analyze the full codebase for consistency issues, identify what should be updated/fixed, compare overlapping work between DupScan and File Manager with best practices, and fix DupScan PDF preview behavior where preview may trigger download or slow/non in-app opening.

## Affected Files
- features/dupscan/components/PreviewModal.jsx
- features/dupscan/components/ResultsView.jsx
- features/dupscan/components/GalleryView.jsx
- features/dupscan/hooks/useDupScan.js
- features/dupscan/services/scanService.js
- app/api/preview/route.js
- features/dupscan/README.md
- features/file-manager/README.md
- docs/architecture.md
- CHANGES_MADE.md

## Steps
- [x] Step 1: Analyze DupScan and File Manager structure and overlapping responsibilities
- [x] Step 2: Identify consistency/quality issues and propose best alignment actions
- [x] Step 3: Root-cause DupScan PDF preview download/open latency issues
- [x] Step 4: Implement targeted fix in DupScan preview flow
- [x] Step 5: Validate behavior and run build/lint checks
- [x] Step 6: Update relevant .md files and TODO progress
