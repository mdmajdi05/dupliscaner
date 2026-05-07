# DupScan — AI Working Instructions

## ⚡ Golden Rules (Never Break These)

1. **Read this file FIRST** before doing anything in this project.
2. **Create a TODO file FIRST** before starting any task — no exceptions.
3. **Never write code without understanding the task fully.**
4. **Never mix DupScan and File Manager logic** inside `features/*`.
5. **Always update relevant `.md` files** after completing work.
6. **Never assume context** — read existing files before editing.
7. **Small, verifiable changes only** — one thing at a time.
8. **Preserve existing behavior** while making changes.

---

## 📁 Project Structure (Memorize This)

```
dupscan/
├── app/
│   ├── page.js                    ← Entry point → imports Dashboard from shared/
│   ├── layout.js
│   ├── globals.css
│   └── api/
│       ├── scan/start|stop|stream ← DupScan scan APIs
│       ├── history/               ← Scan history CRUD
│       ├── preview/               ← File preview API
│       ├── delete/                ← File delete API
│       ├── report/                ← Report download API
│       └── fm/                    ← File Manager APIs only
│           ├── ls/
│           ├── action/
│           ├── scan-bg/
│           ├── duplicates/
│           └── browse-folders/
│
├── shared/
│   ├── components/
│   │   ├── Dashboard.jsx          ← App shell (wires both features)
│   │   ├── AppSidebar.jsx
│   │   └── SettingsModal.jsx
│   └── utils/
│       └── formatters.js          ← Pure helpers (fmtSize, fmtDate, etc.)
│
├── features/
│   ├── dupscan/
│   │   ├── components/
│   │   │   ├── DupScanWorkspace.jsx
│   │   │   ├── TopBar.jsx
│   │   │   ├── StatsBar.jsx
│   │   │   ├── ResultsView.jsx
│   │   │   ├── GalleryView.jsx
│   │   │   ├── PreviewModal.jsx
│   │   │   └── StatusPill.jsx
│   │   ├── hooks/
│   │   │   └── useDupScan.js      ← All DupScan state
│   │   └── services/
│   │       └── scanService.js     ← All DupScan API calls
│   │
│   └── file-manager/
│       ├── components/
│       │   ├── FileManagerDashboard.jsx
│       │   ├── FileManagerSidebar.jsx
│       │   ├── FileManagerItemViews.jsx
│       │   ├── DuplicatesTab.jsx
│       │   ├── VirtualScroller.jsx
│       │   ├── VirtualGridScroller.jsx
│       │   ├── EnhancedFileViewer.jsx
│       │   └── FolderPickerModal.jsx
│       └── services/
│           └── fileManagerService.js ← All FM API calls
│
├── lib/
│   ├── state.js                   ← Global scan state (SSE)
│   ├── history.js                 ← Read/write history.json
│   ├── fm-cache.js                ← File index cache logic
│   ├── scan-controller.js         ← Settings + lazy load helpers
│   └── scanner-worker.js          ← Node worker thread (FM background scan)
│
└── scanner.py                     ← Python duplicate scanner (JSON output)
```

---

## 🔒 Boundary Rules (Critical)

| From | Can Import | Cannot Import |
|------|-----------|---------------|
| `features/dupscan/*` | `shared/*`, own files | `features/file-manager/*` |
| `features/file-manager/*` | `shared/*`, own files | `features/dupscan/*` |
| `shared/components/Dashboard.jsx` | Both features | — |
| `app/page.js` | `shared/components/Dashboard` only | Features directly |

**Cross-imports between `file-manager` and `dupscan` are FORBIDDEN.**

---

📋 TODO Workflow (Mandatory for Every Task)
📂 File Location (STRICT)

All TODO files MUST follow this structure:

docs/
todo/
done/

Step 0 — Ensure Folder Structure

Before creating TODO:

If docs/ does not exist → CREATE it
If docs/todo/ does not exist → CREATE it
If docs/done/ does not exist → CREATE it
Step 1 — Create TODO File (MANDATORY)

Create file ONLY in:

docs/todo/

File name:
TODO_<short_task_name>.md

Example:
docs/todo/TODO_dupscan_add-search.md

❌ NEVER create TODO in root
❌ NEVER create TODO outside docs/todo/

Step 2 — TODO Format
# TODO: <Task Name>
**Started:** <date>
**Status:** In Progress

## Task Understanding
<What exactly needs to be done — in your own words>

## Affected Files
- file1.jsx
- file2.js

## Steps
- [ ] Step 1: Read existing code in affected files
- [ ] Step 2: <specific action>
- [ ] Step 3: <specific action>
- [ ] Step 4: Test the change
- [ ] Step 5: Update relevant .md files
Step 3 — Tick Progress

Update TODO as work progresses:

- [x] Step 1: Read existing code ✓
- [x] Step 2: Added handler function ✓
- [ ] Step 3: Wire to UI
Step 4 — If Work Stops
DO NOT delete TODO
Leave it in docs/todo/
Resume later from first unchecked step
Step 5 — On Completion (STRICT)

After FULL implementation + testing:

Move file:

docs/todo/TODO_.md
→
docs/done/TODO__DONE.md

Add at top:
**Completed:** <date>
**Status:** DONE
### 🚨 STRICT ENFORCEMENT


If AI forgets to move TODO:
→ Task is considered INCOMPLETE


### 🚨 NEVER SKIP


- Don't Skip TODO creation
- Don't Create TODO in root
- Don't Forget to move TODO to done/
- Don't Leave completed TODO in todo/



✅ COMPLETION ENFORCEMENT

A task is ONLY considered COMPLETE if:

Code is implemented ✅
Tested ✅
TODO moved to docs/done/ ✅

❌ If TODO is still in docs/todo/ → task = INCOMPLETE

---

## 🛠️ Working Agreement

1. **Refactor one feature at a time** — never touch both features in one step.
2. **Extract API calls into feature services** — no raw `fetch()` in components.
3. **Extract stateful behavior into hooks** — no heavy logic in JSX.
4. **Keep UI components focused and small** — one job per component.
5. **Remove unused legacy files** only after verifying no references remain.
6. **After structural moves** → run `npm run build` (clear `.next` if API routes seem missing spuriously).
7. **Always update relevant `.md` files** (docs/wiring.md, docs/architecture.md, README.md etc.) after changes.

---
## 🧠 Decision Log

Whenever making a non-trivial change:

- What was changed
- Why it was changed
- Alternatives considered (if any)
---
## Before deleting any file:

- Search for references across project
- Confirm zero imports
- Then delete
---
## If unsure about a change:

- Do NOT modify code
- Add note in TODO
- Ask for clarification or analyze further
---

## 🔍 Before Writing Any Code — Checklist

```
□ Have I read INSTRUCTIONS.md? (this file)
□ Have I created a TODO file for this task?
□ Have I read the existing files I'm about to modify?
□ Do I know which feature this belongs to (dupscan / file-manager / shared)?
□ Am I following the boundary rules (no cross-imports)?
□ Is my change small and verifiable?
□ Will this preserve existing behavior?
```

If any answer is NO → stop and fix it first.

---

## 📦 Key Data & API Contracts

### DupScan APIs (used by `scanService.js`)
- `GET /api/history` — list scan history
- `GET|PATCH|DELETE /api/history/:id` — single scan
- `POST /api/scan/start` — start scan (`{ scanPath, includeHidden, mode, targetFile }`)
- `POST /api/scan/stop` — stop scan
- `GET /api/scan/stream` — SSE event stream
- `POST /api/delete` — delete a file (`{ path }`)
- `GET /api/preview?p=<path>` — serve file for preview
- `GET /api/report?id=<id>` — download report

### File Manager APIs (used by `fileManagerService.js`)
- `GET /api/fm/ls` — list files/folders
- `POST /api/fm/action` — file actions (delete/move/copy/rename/open)
- `GET /api/fm/scan-bg` — background scan progress/control
- `POST /api/fm/scan-bg` — start/stop background scan
- `GET /api/fm/duplicates` — get duplicate groups from index
- `GET /api/fm/browse-folders` — folder navigation picker

---

## 💾 Data Storage

| What | Where |
|------|-------|
| Scan history + file index | `%LOCALAPPDATA%/DupScan/history.json` |
| Scan reports | `%LOCALAPPDATA%/DupScan/reports/report_<id>.txt` |
| User settings | Browser `localStorage` key: `dupscan-settings` |

**Max history:** 50 scans (auto-cleanup removes oldest + their report files)

---

## 🧠 State Architecture

### DupScan State (in `useDupScan.js`)
- `status` — idle | scanning | done | stopped | error
- `liveDups` — duplicate groups found in current scan
- `fileStatus` — per-file keep/review/need/deleted marks
- `keepMap` — which file in each group is the "KEEP"
- `viewScan` — loaded from history (when browsing old scans)
- `filter` — active filter: `{ cat, folder, search, showStatus }`

### File Manager State (in `FileManagerDashboard.jsx`)
- `files` — current folder files (paginated, 100 at a time)
- `isAutoScanning` — background worker status
- `autoFolders` — quick-access folder list with counts
- `scanProgress` — worker progress object

### Global Scan State (`lib/state.js`)
- Shared across API routes via `global.__DS`
- Used for SSE stream replay

---

## 🎨 UI / Styling Rules

- All CSS variables defined in `app/globals.css` — use `var(--neon)`, `var(--bg)` etc.
- Use existing CSS classes: `.btn-neon`, `.btn-ghost`, `.btn-danger`, `.card`, `.catbadge`, `.size-badge`, `.mono`, `.inp`
- Animations: `.anim-fade`, `.anim-pulse`, `.anim-spin`, `.shimmer`
- Font: Syne (headings/UI) + IBM Plex Mono (code/paths)
- **Do NOT add new global CSS** without a strong reason.
- **Do NOT use inline Tailwind classes that aren't in the base stylesheet** for dynamic values — use `style={{}}` instead.

---

## ⚙️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS 3 |
| Icons | lucide-react 0.400 |
| Scanner | Python 3 (JSON lines to stdout) |
| Background scan | Node.js Worker Threads |
| Storage | JSON file in AppData |
| Streaming | Server-Sent Events (SSE) |

---

## 📝 After Every Task — Update These Files

| File | Update when |
|------|-------------|
| `docs/wiring.md` | Imports/API contracts change |
| `docs/architecture.md` | Feature structure changes |
| `features/dupscan/README.md` | DupScan feature changes |
| `features/file-manager/README.md` | FM feature changes |
| `CHANGES_MADE.md` | Any significant change |
| Relevant TODO file | Mark steps done; move to `done/` when complete |

---

## 🚫 Common Mistakes to Avoid

| Mistake | Correct Approach |
|---------|-----------------|
| Writing full component from scratch when only part needs changing | Read file first, use `str_replace` for targeted edits |
| Putting FM logic in DupScan or vice versa | Check boundary rules first |
| Raw `fetch()` calls inside components | Use service layer functions |
| Skipping TODO file creation | Always create TODO first, no exceptions |
| Not reading existing code before editing | Read affected files → then edit |
| Forgetting to update `.md` files | Checklist at end of every task |
| Mixing multiple features in one change | One feature at a time |
| Using `window` or `localStorage` in server context | Guard with `typeof window !== 'undefined'` |

---

## 🔁 Session Resume Protocol

If a task was started in a previous session:

1. Look for a `TODO_*.md` file in the project root.
2. Read it fully — understand what was being done and why.
3. Find the first **unticked** `[ ]` step.
4. Read the relevant source files to get current context.
5. Continue from that step — do not restart.
6. Tick completed steps as you go.

---

*This file is the single source of truth for how AI should work on this project.*  
*Read it at the start of every session. Do not skip.*