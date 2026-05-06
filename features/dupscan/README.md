# DupScan Feature

This feature owns duplicate scan lifecycle, stream handling, history loading/persisting, and DupScan dashboard UI.

## Boundaries

- Owns DupScan state and API orchestration in `features/dupscan/hooks` and `features/dupscan/services`.
- Owns DupScan-only UI: `DupScanWorkspace`, `TopBar`, `StatsBar`, `ResultsView`, `GalleryView`, `PreviewModal`, `StatusPill`.
- May use shared utilities from `shared/` (e.g. `fmtSize` in `StatsBar`).
- Must not import File Manager modules under `features/file-manager/` or FM service clients.

## Internal Modules

- `services/scanService.js`: API interactions for scan start/stop, history CRUD, and delete actions.
- `hooks/useDupScan.js`: DupScan state machine and event stream management.
- `components/DupScanWorkspace.jsx`: composes DupScan shell pieces (top bar, stats, list/gallery).
