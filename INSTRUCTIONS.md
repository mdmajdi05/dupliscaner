# Refactor Instructions

## Rules

- Do not mix DupScan and File Manager feature logic inside `features/*` (no cross-imports between those folders).
- Put reusable, feature-agnostic UI and helpers in `shared/`.
- App shell composition (`shared/components/Dashboard.jsx`) may wire both features; features must stay isolated from each other.
- Keep each change small and verifiable.
- Preserve existing behavior while refactoring.

## Layout

- `shared/components/` — shell (`Dashboard`, `AppSidebar`, `SettingsModal`).
- `shared/utils/` — formatters and other pure helpers.
- `features/dupscan/` — scan UI, history, preview modal, `useDupScan`, `scanService`.
- `features/file-manager/` — FM dashboard, virtual scrollers, FM services, `/api/fm/*` clients.
- `app/page.js` — imports the shell from `shared/components/Dashboard`.

## Working Agreement

1. Refactor one feature at a time.
2. Extract API calls into feature services.
3. Extract stateful behavior into feature hooks.
4. Keep UI components focused and small.
5. Remove unused legacy files after validating references.
6. After structural moves, run `npm run build` (clear `.next` if the build reports missing API routes spuriously).
