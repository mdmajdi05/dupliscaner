# Wiring

## App entry

- Page: `app/page.js` → `shared/components/Dashboard.jsx`

## File Manager

- UI entry: `features/file-manager/components/FileManagerDashboard.jsx`
- Service layer: `features/file-manager/services/fileManagerService.js` (`startFmBackgroundScan` / `stopFmBackgroundScan` for index scans, `listDuplicateGroups`, `runFileAction`)
- Presentational pieces: `features/file-manager/components/FileManagerItemViews.jsx`
- Shared utility usage: `shared/utils/formatters.js`, `shared/utils/preview.js`, `shared/utils/fileType.js`
- Settings UI: `shared/components/SettingsModal.jsx` (embedded from FM and DupScan top bar)

## DupScan

- State hook: `features/dupscan/hooks/useDupScan.js`
- Service layer: `features/dupscan/services/scanService.js`
- UI workspace: `features/dupscan/components/DupScanWorkspace.jsx`
- Co-located UI: `TopBar`, `StatsBar`, `ResultsView`, `GalleryView`, `PreviewModal`, `StatusPill` under `features/dupscan/components/`
- Shared preview/type helpers: `shared/utils/preview.js` and `shared/utils/fileType.js` are used by DupScan preview/gallery components

## API Contracts Used by File Manager Service

- `GET /api/fm/ls`
- `POST /api/fm/action`
- `GET /api/fm/scan-bg?action=progress`
- `GET /api/fm/scan-bg?action=list-folders&limit=N`
- `POST /api/fm/scan-bg` with `{ action: "start" | "stop" }`

## API Contracts Used by DupScan Service

- `GET /api/history`
- `GET|PATCH|DELETE /api/history/:id`
- `POST /api/scan/start`
- `POST /api/scan/stop`
- `POST /api/delete`

## Refactor safety notes

- Prefer moving new FM or DupScan UI under the matching `features/*` folder instead of a root `components/` package.
- Preserve endpoint contracts to avoid runtime regressions.
- Tailwind `content` globs include `./features/**/*` and `./shared/**/*` so moved files stay purged correctly.
