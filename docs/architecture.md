# Architecture

## Feature-based layout

- `features/file-manager`: file manager UI, FM virtual scrolling, FM API service layer, FM-only tabs (e.g. duplicates from index).
- `features/dupscan`: duplicate scan dashboard, results/gallery, preview modal, scanner stream hook and scan API service.
- `shared`: app shell composition, cross-cutting UI that is not owned by a single feature (`Dashboard`, `AppSidebar`, `SettingsModal`), and pure helpers (`shared/utils/formatters.js`).

## Applied structure

- File Manager network calls live in `features/file-manager/services/fileManagerService.js` (`startFmBackgroundScan` / `stopFmBackgroundScan` vs DupScan scan start).
- File list/grid presentation lives in `features/file-manager/components/FileManagerItemViews.jsx` and `FileManagerDashboard.jsx`.
- DupScan API calls live in `features/dupscan/services/scanService.js`.
- DupScan state and `EventSource` handling live in `features/dupscan/hooks/useDupScan.js`.
- DupScan workspace UI lives in `features/dupscan/components/DupScanWorkspace.jsx` and co-located components (`TopBar`, `StatsBar`, `ResultsView`, `GalleryView`, `PreviewModal`, `StatusPill`).
- The application shell composes both features from `shared/components/Dashboard.jsx` (the only place that imports both feature trees).

## Boundary rule

Feature modules under `features/file-manager` and `features/dupscan` may consume:

- their own feature modules
- `shared/*`
- framework/runtime packages

Direct cross-imports between `file-manager` and `dupscan` are not allowed. The shell in `shared/components/Dashboard.jsx` orchestrates navigation between modes.
