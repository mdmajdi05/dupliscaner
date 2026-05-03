# 🔍 DupScan — Duplicate File Dashboard

A full Next.js dashboard to find, preview and manage duplicate files.

## Features
- ✅ Real-time scan with live results as duplicates are found
- 📁 Folder-wise + category-wise grouping
- 🖼️ Side-by-side preview (Images, Video, Audio, Documents)
- ✓ Mark files as "reviewed" or "deleted"
- 🗂️ Full scan history (saved to disk)
- 🔎 Filter by category, folder, filename
- 📄 Download scan report as .txt
- 🎯 Find duplicates of a specific file (single-file mode)
- ⚡ Start/Stop scan from dashboard
- 💾 Persistent history across sessions

---

## Setup & Run

### Requirements
- **Node.js** 18+ → https://nodejs.org
- **Python 3** → https://python.org

### Steps

```bash
# 1. Enter the project folder
cd dupscan

# 2. Install dependencies
npm install

# 3. Start the dashboard
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## How to Use

### Scan Modes
| Mode | Description |
|------|-------------|
| **Folder** | Scan a specific folder path |
| **Full System** | Scan entire filesystem (slower) |
| **Find File Dups** | Find all duplicates of ONE specific file |

### Workflow
1. Enter a folder path (e.g. `/home/user` or `C:\Users\Name`)
2. Press **Scan** — results appear in real-time
3. Use **Group by** to switch between Folder / Category / Flat view
4. Click **👁️ Preview** to open side-by-side comparison
5. **✓ Checkbox** = mark as reviewed
6. **🗑️ Delete** = actually delete the file from disk
7. Download **Report** as .txt anytime

---

## File Structure
```
dupscan/
├── scanner.py          ← Python scanner (JSON output)
├── app/
│   ├── api/
│   │   ├── scan/start  ← Start scan
│   │   ├── scan/stop   ← Stop scan
│   │   ├── scan/stream ← SSE real-time events
│   │   ├── history/    ← Saved scan history
│   │   ├── preview/    ← Serve local files
│   │   ├── delete/     ← Delete files
│   │   └── report/     ← Download .txt report
│   └── page.js
├── components/
│   ├── Dashboard.jsx
│   ├── Sidebar.jsx
│   ├── TopBar.jsx
│   ├── StatsBar.jsx
│   ├── ResultsView.jsx
│   └── PreviewModal.jsx
├── lib/
│   ├── state.js        ← Global scan state
│   └── history.js      ← Read/write history.json
└── data/               ← Auto-created: history.json + reports
```

---

## Tips
- The **first file** in each group is the **KEEP** (oldest/original)
- Use **Find File Dups** mode to locate all copies of one specific file
- History is saved automatically when a scan completes
- Report .txt file is also saved in the `data/` folder

---

Made with ❤️ using Next.js 14 + Python 3
