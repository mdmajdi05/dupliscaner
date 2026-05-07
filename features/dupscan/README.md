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

## Recent Notes

- DupScan preview now relies on `/api/preview` responses with explicit inline `Content-Disposition`, which improves in-app PDF rendering behavior and reduces browser download fallback for preview actions.
- Preview URL generation and preview file-type classification are now consolidated in shared utilities (`shared/utils/preview.js`, `shared/utils/fileType.js`) and used by DupScan gallery/preview components.
