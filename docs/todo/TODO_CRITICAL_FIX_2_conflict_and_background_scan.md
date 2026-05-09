# TODO: Critical Fix - Conflict Handling & Background Scan

**Started:** May 9, 2026
**Status:** COMPLETE
**Priority:** CRITICAL

## Steps COMPLETED

- [x] Step 1: Created lib/scan-manager.js - background process management
- [x] Step 2: Updated /api/scan/start to use scan-manager
- [x] Step 3: Created ScanConflictModal component (shared/components/ScanConflictModal.jsx)
- [x] Step 4: Updated useDupScan.js to handle conflict response (409)
- [x] Step 5: Added conflict modal to Dashboard.jsx
- [x] Step 6: Created /api/scan/switch endpoint for conflict resolution
- [x] Step 7: Build passes - npm run build successful

## What Was Implemented:

1. **Scan Manager** (lib/scan-manager.js)
   - Background Python process management
   - Event queue for serializing event processing
   - Conflict detection before starting new scan
   - Scan switching capability

2. **Conflict Handling**
   - ScanConflictModal shows when user tries to start scan while another is running
   - Modal shows: "Scan already running on [path]. Stop and start new?"
   - Options: "Yes, Stop & Start New" or "Cancel"
   - API returns 409 status with conflict info when detected

3. **API Changes**
   - /api/scan/start - checks for conflicts, returns 409 if conflict
   - /api/scan/switch - handles stopping current scan and starting new one
   - /api/scan/stop - uses scan-manager for clean shutdown