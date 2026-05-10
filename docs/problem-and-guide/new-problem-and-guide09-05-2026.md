🔴 Critical Bugs — App Completely Broken
1. ESM/CJS Module Mismatch (lib/db-scan.js)
Ye sabse bada bug hai. lib/db-scan.js ka top:
jsconst { getDb, queryDb, execDb } = require('./db'); // CJS
aur bottom:
jsmodule.exports = { ScanProcessor, createScanProcessor, processScannerStream }; // CJS
Lekin lib/db.js pure ESM hai (export async function getDb()). Ye do files ek doosre ko kabhi import nahi kar sakti. Matlab ScanProcessor ka database pe koi bhi write silently fail ho jaata hai. Saara SQLite persistence layer dead hai. Data sirf JSON me jaata hai.
2. package.json mein better-sqlite3 nahi hai
package-lock.json mein better-sqlite3 hai (kisi ne install kiya), lekin package.json mein sirf sqlite3 hai. Agar koi fresh npm install kare — better-sqlite3 install nahi hoga. Aur lib/db.js abhi bhi sqlite3 (async, callback-based) use kar raha hai, better-sqlite3 nahi — problem guide ke contra.
3. getWorkerState() bina await ke call ho raha hai
app/api/scan/start/route.js mein:
jsconst workerState = getWorkerState(); // async function, await missing!
if (workerState && workerState.current_scan_id...) // undefined.property → crash
Conflict detection kabhi kaam nahi karta kyunki workerState ek pending Promise hai, object nahi.
4. scan_history table mein updated_at column nahi hai
lib/db-ops.js ka markScanComplete:
sqlUPDATE scan_history SET ... updated_at = ? WHERE scan_id = ?
Lekin lib/init-db.js mein scan_history create hoti hai bina updated_at column ke. Ye SQL error throw karega har scan complete hone pe.
5. scan_events mein column name galat hai
lib/db-scan.js:
sqlINSERT INTO scan_events (scan_id, event_type, details) VALUES ...
Lekin init-db.js mein column data hai, details nahi. Har error log fail hoga.
6. lib/db.js mein path Windows-only hai
jsconst dbDir = path.join(os.homedir(), 'AppData', 'Local', 'DupScan');
Linux/Mac pe ye path exist nahi karta. Platform check missing hai. Prompt mein cross-platform support clearly mention hai.

🟠 Major Issues — Functionality Broken
7. /api/history abhi bhi history.json read karta hai
TODO file mein likha hai "Updated /api/history to read from better-SQLite3" — lekin actual code:
jsimport { readAll } from '../../../lib/history.js'; // JSON!
better-SQLite3 se data load hota hi nahi app startup pe DupScan tab mein.
8. lib/scanner-worker.js ka better-SQLite3 se koi connection nahi
Worker thread abhi bhi readCachedFiles() se history.json padhta hai aur fm-cache.js ke through JSON likhta hai. SQLite integration zero hai File Manager side pe.
9. next.config.mjs mein better-sqlite3 externals mein nahi
jsconfig.externals.push('fs', 'path', 'os', 'child_process', 'worker_threads', 'crypto')
// better-sqlite3 missing!
Native addon ko externals mein daalna zaroori hai, warna webpack bundle karne ki koshish karta hai aur crash hota hai.
10. atomicStartScan actual scan routes mein call nahi hoti
lib/db-ops.js mein function exist karta hai, documented bhi hai — lekin /api/scan/start aur /api/fm/scan-bg dono isko call nahi karte. Single worker rule enforce nahi ho raha.
11. upsertDuplicateGroup ko 4 arguments chahiye, 3 diye
lib/db-scan.js mein handleDuplicateEvent:
jsawait upsertDuplicateGroup(hash, files.length, waste || (size * (count - 1)));
// Missing 4th arg: fileSize
lib/db-ops.js signature: upsertDuplicateGroup(hash, fileCount, wasteBytes, fileSize). Grouping partial data save karega.
12. markScanComplete wrong signature se call ho raha hai
lib/db-scan.js mein:
jsawait markScanComplete(this.scanId); // No stats!
Lekin lib/db-ops.js mein function (scanId, stats) expect karta hai aur stats object se fields update karta hai. Scan completion stats save nahi honge.
13. transactionDb nested calls pe crash karta hai
sqlite3 callback API true nested transactions support nahi karta. Jab handleDuplicateEvent upsertDuplicateGroup ko call karta hai jo khud transactionDb use karta hai, aur ye already ek transaction ke andar hai — BEGIN TRANSACTION error aata hai. Ye TODO docs mein bhi documented hai par fix nahi hua.

🟡 Architecture Problems — Future Crashes
14. Python process HTTP handler ke andar spawn hota hai
/api/scan/start ek HTTP request handler hai jo Python process spawn karta hai. Long-running scans pe proxy timeouts aa sakte hain. lib/scan-manager.js banana tha (TODO mein "COMPLETE" mark hai) — lekin file uploaded codebase mein nazar nahi aata.
15. history.json writes atomic nahi
jsfs.writeFileSync(FILE, JSON.stringify(...), 'utf8');
Process crash on mid-write → corrupted JSON → app crash on restart. Temp-file-then-rename pattern missing hai.
16. Worker state stuck on crash
Agar app mid-scan crash ho, worker_state.current_scan_id set rehta hai — phir se scan start nahi ho sakta. clearStaleLockIfNeeded() problem guide mein mention hai par codebase mein implement nahi hua.
17. fileStatus aur keepMap SQLite mein persist nahi hote
User ke mark decisions (delete/keep/review) sirf history.json mein patchHistoryItem ke through save hote hain. file_marks table ready hai database mein par connected nahi.
18. EventSource replay buffer 5000 limit
lib/state.js mein buffer 5000 events pe cap hai. Bade scans pe client reconnect kare to events miss ho sakte hain.

🟢 Jo Cheez Actually Kaam Kar Rahi Hai

Python scanner.py — dono modes (duplicates, full) properly implement hain, incremental flag support hai
File preview API (/api/preview) — range requests, MIME types, streaming sab theek
Virtual scrolling components — VirtualScroller.jsx aur VirtualGridScroller.jsx solid hain
SSE stream (/api/scan/stream) — basic real-time updates working
DupScan UI — ResultsView, GalleryView, PreviewModal, StatusPill sab functional
File Manager UI — sidebar, grid/list, duplicate tab, folder picker working
Conflict modal — Dashboard.jsx mein inline implement hai, UI side kaam karta hai
lib/init-db.js — schema creation correct hai (sirf updated_at issue chhod ke)
shared/utils/ — formatters.js, preview.js, fileType.js clean aur reusable


Step-by-Step Fix Plan
Step 1 — Fix module system (2-3 ghante):
lib/db-scan.js ko ESM mein convert karo:
js// Top pe:
import { getDb, queryDb, execDb, transactionDb } from './db.js';
// Bottom pe:
export { ScanProcessor, createScanProcessor, processScannerStream };
module.exports aur require() hata do completely.
Step 2 — better-sqlite3 properly setup karo:
bashnpm install better-sqlite3
package.json update karo. lib/db.js ko rewrite karo synchronous API pe:
jsimport Database from 'better-sqlite3';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
next.config.mjs mein add karo:
jsconfig.externals.push('better-sqlite3', ...)
Step 3 — Platform-safe DB path:
jsconst dbDir = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'DupScan')
  : path.join(os.homedir(), '.local', 'share', 'DupScan');
Step 4 — Fix getWorkerState await:
jsconst workerState = await getWorkerState(); // await ADD karo
Step 5 — Fix scan_history schema — updated_at hata do markScanComplete se:
sqlUPDATE scan_history SET status=?, completed_at=?, files_found=?, ... WHERE scan_id=?
-- updated_at remove karo
Step 6 — Fix scan_events column:
js// 'details' → 'data'
INSERT INTO scan_events (scan_id, event_type, data, created_at) VALUES (?,?,?,?)
Step 7 — Fix upsertDuplicateGroup 4th arg:
jsawait upsertDuplicateGroup(hash, files.length, waste || (size * (count - 1)), size);
// size as 4th arg add karo
Step 8 — markScanComplete stats pass karo:
jsawait markScanComplete(this.scanId, {
  filesFound: this.fileCount,
  dupGroups: this.dupCount,
  wasteBytes: 0,
});
Step 9 — /api/history ko SQLite se connect karo:
jsimport { getScanHistory } from '../../../lib/db-ops.js';
export async function GET() {
  const scans = await getScanHistory();
  return Response.json(scans);
}
Step 10 — clearStaleLockIfNeeded implement karo:
js// lib/db-ops.js mein
export function clearStaleLockIfNeeded() {
  const state = getWorkerState();
  if (!state?.current_scan_id) return;
  const thirtyMinAgo = Math.floor(Date.now() / 1000) - 1800;
  if (state.started_at && state.started_at < thirtyMinAgo) {
    clearWorkerState();
  }
}
// app/layout.js mein call karo

Prompt ke Requirements vs Implementation
Tumhara original prompt bahut solid tha. Problem ye hai ki implementation 70% correct intent pe hai lekin fundamental technical errors ne sab break kar diya:
RequirementStatusIssueSQLite single source of truth❌ Brokendb-scan.js ESM/CJS mismatchbetter-sqlite3❌ Missingpackage.json mein nahi, db.js abhi sqlite3Conflict detection⚠️ PartialUI modal hai, await missing, atomicStartScan not calledIncremental scanning✅ Python sideNode side not connectedBFS traversal✅ Workingscanner-worker.js meinReal-time SSE✅ Workingstate.js + stream routeDupScan UI✅ WorkingResultsView, Gallery etc.File Manager UI✅ WorkingDashboard, sidebarSingle worker rule❌ Not enforcedatomicStartScan not wiredBackground scan✅ Workingworker thread spawningPython events → Node → DB❌ Brokenimport fails silentlyApp startup load from DB❌ Not workinghistory.json se read ho raha