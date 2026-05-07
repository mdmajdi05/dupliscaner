# File Manager Feature

This feature owns file browsing, folder exploration, duplicate browsing inside the FM tab, and file actions under `/api/fm/*`.

## Boundaries

- Owns: `components/FileManagerDashboard.jsx`, `components/FileManagerSidebar.jsx`, `components/DuplicatesTab.jsx`, `components/VirtualScroller.jsx`, `components/VirtualGridScroller.jsx`, `components/FolderPickerModal.jsx`, `components/EnhancedFileViewer.jsx`, `components/FileManagerItemViews.jsx`, and clients for `/api/fm/*`.
- Uses shared utilities and shell-owned modals only where needed (e.g. `shared/components/SettingsModal`).
- Must not import DupScan-specific modules under `features/dupscan/`.

## Internal Modules

- `services/fileManagerService.js`: API interaction for file listing, file actions, and FM background index scan (`startFmBackgroundScan` / `stopFmBackgroundScan`).
- `components/FileManagerItemViews.jsx`: grid/list rows, bulk bar, and auto-folder pills used by the main FM screen.

## Recent Behavior Updates

- Startup now prefers cached data from `%LOCALAPPDATA%/DupScan/history.json` and does not force a new scan unless scan mode is set to `auto`.
- Scan mode (`auto`/`manual`) and selected root path are persisted in browser storage for stable refresh behavior.
- Background scan progress and discovered files are written more frequently to the AppData store to keep partial results after app/system close.
- Manual controls support explicit start/stop and per-folder scan trigger (BFS traversal is handled in `lib/scanner-worker.js` queue flow).
- Grid virtualization now keeps fixed tile sizing to reduce overflow/uneven cards, and file viewer supports in-app/external viewing modes.
- Duplicates view now uses File Manager service APIs only (no direct component-level `fetch`), improving consistency and easier contract maintenance.
- Shared preview/type helpers from `shared/utils` are now consumed in duplicates UI for parity with DupScan preview behavior.
