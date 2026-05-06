# File Manager Feature

This feature owns file browsing, folder exploration, duplicate browsing inside the FM tab, and file actions under `/api/fm/*`.

## Boundaries

- Owns: `components/FileManagerDashboard.jsx`, `components/FileManagerSidebar.jsx`, `components/DuplicatesTab.jsx`, `components/VirtualScroller.jsx`, `components/VirtualGridScroller.jsx`, `components/FolderPickerModal.jsx`, `components/EnhancedFileViewer.jsx`, `components/FileManagerItemViews.jsx`, and clients for `/api/fm/*`.
- Uses shared utilities and shell-owned modals only where needed (e.g. `shared/components/SettingsModal`).
- Must not import DupScan-specific modules under `features/dupscan/`.

## Internal Modules

- `services/fileManagerService.js`: API interaction for file listing, file actions, and FM background index scan (`startFmBackgroundScan` / `stopFmBackgroundScan`).
- `components/FileManagerItemViews.jsx`: grid/list rows, bulk bar, and auto-folder pills used by the main FM screen.
