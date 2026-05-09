Critical Problems in Your Current System
1. Module System Mismatch (Biggest Bug)
lib/db-scan.js uses require() (CommonJS) but lib/db.js uses export (ESM). They cannot work together.
js// db-scan.js - uses require
const { getDb } = require('./db');  // ❌ FAILS - db.js uses ESM exports

// db.js - uses ESM  
export async function getDb() { ... }  // ESM
This means your entire database layer is broken — ScanProcessor can never actually write to SQLite. Data goes nowhere.
2. lib/db-scan.js References Wrong Columns
js// db-scan.js line ~170
await execDb(
  `INSERT INTO scan_events (scan_id, event_type, details) VALUES ...`
);
// But init-db.js creates: (scan_id, event_type, DATA) — not "details"
Also markScanComplete(scanId) is called but the function signature in db-ops.js requires markScanComplete(scanId, stats) — and internally tries to update a column updated_at that doesn't exist in scan_history.
3. Two Competing Storage Systems That Don't Talk
Your DupScan writes to lib/state.js (in-memory) → history.json via addScan(). Your File Manager writes to lib/fm-cache.js → history.json via saveFileIndex(). Both use the same file but write different keys (scanHistory vs fileIndex). When one writes, it reads-then-writes the whole file — race condition guaranteed.
Meanwhile, the new SQLite system writes to dupscan.db. So you have three storage systems that are completely independent and never sync.
4. transactionDb() is Broken for Nested Calls
js// db.js transactionDb runs: BEGIN TRANSACTION
// then calls callback
// callback calls upsertDuplicateGroup
// upsertDuplicateGroup was calling transactionDb again → nested BEGIN → SQLite error
You fixed this partially in db-ops.js by removing the wrapper from upsertDuplicateGroup, but the root issue is that transactionDb uses the sqlite3 callback API which doesn't support true async transactions safely.
5. scanner-worker.js Ignores SQLite Entirely
The worker (lib/scanner-worker.js) writes files via parentPort.postMessage({type: 'upsert', files}) to the parent. The parent (app/api/fm/scan-bg/route.js) catches these and calls ScanProcessor.processEvent() — but converts them to file_record type events. However ScanProcessor.handleFileRecord() tries to call execDb (ESM import) from a CommonJS module. It silently fails.
6. markScanComplete Has Wrong Signature
js// db-ops.js
export async function markScanComplete(scanId, stats) {
  // Updates scan_history SET ... updated_at = ? WHERE scan_id = ?
  // But scan_history has no updated_at column!
}

// db-scan.js calls it as:
await markScanComplete(this.scanId); // Missing stats argument
7. No Conflict Detection is Actually Enforced
checkScanConflict() and atomicStartScan() exist in db-ops.js but are never called from either /api/scan/start or /api/fm/scan-bg. Both routes just kill whatever is running and start fresh. The popup system you want doesn't exist in the frontend either — there's no ScanConflictModal component anywhere.
8. transactionDb Race Condition
jsexport async function transactionDb(callback) {
  database.run('BEGIN TRANSACTION', async (err) => {
    // callback is async but database.run's callback isn't truly awaited
    // If two calls hit this simultaneously, both can BEGIN before either COMMITs
  });
}
The sqlite3 library's callback-based API doesn't handle this correctly. You need better-sqlite3 (synchronous) or proper serialization.
9. fm/scan-bg Creates ScanProcessor but Events Are Wrong Type
js// In fm/scan-bg/route.js, when worker sends 'upsert':
STATE.processor.processEvent({
  type: 'file_record',  // ← converted
  path: file.path,
  ...
})

// But ScanProcessor.handleFileRecord() just buffers it
// Then flushFileBuffer() calls execDb with INSERT OR REPLACE INTO files
// This INSERT has 14 placeholders but the mapping may be wrong
10. history.json Writes Are Not Atomic
js// lib/history.js
export function writeStore(store) {
  fs.writeFileSync(FILE, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
}
If the process crashes mid-write, the file is corrupted. No temp-file-then-rename pattern.

🟡 Your Architecture Prompt Analysis
Your prompt is conceptually correct but has these gaps:
What the prompt gets right:

Single SQLite source of truth ✅
BFS traversal ✅
Incremental scanning logic ✅
Single worker rule ✅
Conflict popup ✅
Python for hashing, Node for DB ✅

What the prompt misses or is ambiguous about:

Module system — Never specifies ESM vs CJS. This is why your implementation broke.
"Python JSON events emit realtime" — Your scanner.py does emit JSON lines, but the Node readline interface that processes them is inside scan/start/route.js which is an HTTP request handler. Long-running scans will timeout or get cut by proxy limits.
"node.js backend un events ko receive kare" — The prompt assumes a clean pipeline but doesn't specify that the Python process should be managed by a persistent background service, not an HTTP route handler.
Conflict popup timing — The prompt says show popup when user clicks scan while another is running. But currently the scan starts in the UI before the server responds with conflict. The frontend needs to check state before showing the scan UI, not after.
"same storage/file me update hota rahe" — This phrase is ambiguous. Your implementation interpreted it as "same history.json" AND "same SQLite DB" — causing dual writes.
Worker state persistence on crash — If Node crashes mid-scan, worker_state.current_scan_id stays set, locking the system. The prompt doesn't address this.


🟢 What Needs to Change
Here's the concrete fix plan:
Fix 1: Standardize Module System
Everything must be ESM. Rename lib/db-scan.js to use import/export. Update next.config.mjs to handle this properly.
Fix 2: Fix Database Transaction Layer
Replace the broken async transactionDb with proper serialized execution:
js// Use better-sqlite3 instead of sqlite3 for synchronous operations
// OR add a proper queue/serializer for async sqlite3
Fix 3: Single Storage — Delete the JSON Path
Make DupScan write to SQLite directly, not history.json. The history.json becomes read-only legacy migration source.
Fix 4: Fix scan/start — Move Python Process to Background Service
The Python scanner should be spawned by a global singleton (lib/scan-manager.js), not inside an HTTP handler.
Fix 5: Implement the Conflict Check UI
Add ScanConflictModal to shared/components/. Wire it to check /api/scan/query?type=state before starting any scan.
Fix 6: Fix markScanComplete and Column Names
js// scan_history needs: completed_at, not updated_at
// Remove updated_at from scan_history schema entirely
Fix 7: Fix db-scan.js scan_events Column
js// Change 'details' → 'data' to match schema
await execDb(
  `INSERT INTO scan_events (scan_id, event_type, data, created_at) VALUES (?, ?, ?, ?)`,
  [this.scanId, type, msg, now]
);

Summary Table
IssueSeverityRoot CauseFixESM/CJS mismatch🔴 Fataldb-scan.js uses require, db.js uses exportConvert all to ESMNo actual DB writes🔴 FatalAbove mismatch causes silent failuresFix module systemWrong column names🔴 Fatalschema vs code mismatchAudit and fixNested transactions🔴 Fatalsqlite3 callback API limitationUse better-sqlite3 or queueConflict check not wired🔴 FatalFunctions exist but never calledWire atomicStartScanDual storage race condition🔴 FatalJSON + SQLite both activeRemove JSON writesNo conflict UI🔴 FatalComponent doesn't existBuild itPrompt ambiguity on module system🟡 MediumPrompt doesn't specify ESM/CJSAdd to next session promptPrompt ambiguity on process lifecycle🟡 MediumHTTP handler vs background serviceClarify in prompthistory.json not atomic🟡 MediumDirect writeFileSyncAdd temp-file renameworker_state stuck on crash🟡 MediumNo cleanup on startupAdd stale lock detectionmarkScanComplete signature wrong🟠 HighCalled without required argsFix signature
Your prompt is 70% correct in intent — the architecture vision is sound. But the implementation has fundamental technical errors (module system, schema mismatches, unwired functions) that prevent anything from working. If your prompt were 100% implemented correctly by someone who caught these issues, the system would work. But as implemented, the SQLite layer is completely non-functional — all data still goes to the legacy JSON/memory system.You said: so update the prompt and give me  dont change my prompt only updateso update the prompt and give me  dont change my prompt only update3:55 amClaude responded: Looking at all the issues I found, here's your updated prompt:Looking at all the issues I found, here's your updated prompt:

Production Architecture — DupScan + File Manager
mujhe ek production level architecture design karwana hai iss app ke liye jisme 2 main system hain: dupscan aur file-manager, dono ek hi data source use kare
Tech Stack Constraint (CRITICAL):

Poora project Next.js 14 App Router hai with ESM ("type": "module" behavior)
Sabhi lib/ files ESM honi chahiye — import/export use karo, require/module.exports bilkul nahi
lib/db-scan.js bhi ESM hona chahiye (abhi CJS hai jo db.js se import nahi ho sakta)
better-sqlite3 use karo sqlite3 ki jagah — kyunki sqlite3 ka callback-based async API nested transactions aur proper serialization support nahi karta. better-sqlite3 synchronous hai aur Next.js server environment me safe hai
Worker threads me better-sqlite3 directly use karo (ye worker-safe hai)


1. DupScan System

ye manual ya auto mode par given targeted folder ko scan kare
BFS traversal use kare
sirf duplicate files ko detect kare aur unhe hi store kare
duplicate files ko dashboard me show kare
user unhe rename, delete aur view kar sake
app open hote hi pehle se stored duplicate data turant dikh jaye (SQLite se direct read)
agar auto scan enable ho to background me worker node ke through scanning hoti rahe
incremental scanning ho (sirf changed/new files scan ho)
same SQLite DB me update hota rahe aur dashboard me sirf duplicate data hi show ho (is_duplicate = 1 filter)


2. File Manager System

ye full data scan kare (duplicate + non-duplicate dono)
folder structure bhi scan kare
real file manager ki tarah sab data show kare
fast startup me wahi stored data instantly render kare bina delay ke (SQLite se)
auto scan enable ho to background me worker node scanning karta rahe
manual mode me ek button ho (start scan) aur ek stop button ho
ye bhi same SQLite DB me data update kare jisme dupscan bhi kar raha hai
ye pura data store kare aur pura hi show kare


3. Common Requirements

dono system ek hi storage use kare — SQLite only, single source of truth
history.json ko permanently hatao data storage ke liye — sirf ek baar migration ke liye use karo phir ignore karo
lib/fm-cache.js aur lib/history.js ke through jo JSON-based storage hai wo completely bypass ho jaye — SQLite direct queries use ho
file metadata + duplicate grouping dono handle ho
incremental update logic ho
ek time par sirf ek scanning process chale (single worker rule)
agar dupscan me scanning chal rahi ho aur user file-manager me scan start kare:

server /api/scan/start ya /api/fm/scan-bg pe pehle worker_state table check kare atomically
agar conflict ho to HTTP 409 return kare with { status: 'conflict', currentScan: { type, startedAt } }
frontend ye 409 pakde aur ScanConflictModal dikhaye (ye component banana hai shared/components/ScanConflictModal.jsx me)
modal me 2 options: "Stop [current] and start [new]" aur "Cancel"
same reverse bhi file-manager se dupscan ke case me ho




4. Backend Architecture

Python scanner (scanner.py) use ho jo fast ho file scanning aur hashing ke liye
Python BFS traversal aur hashing kare, JSON lines stdout pe emit kare
Node.js ek global persistent scan manager (lib/scan-manager.js) maintain kare

Ye HTTP request handler ke andar Python spawn mat karo — /api/scan/start route sirf scan-manager ko instruction deta hai
Actual Python process scan-manager me hota hai jo global.__SCAN_MANAGER pe live rehta hai across requests
Isse long-running scans HTTP timeout se safe rehte hain


Node.js better-sqlite3 se database update kare (synchronous, safe)
Node.js worker state manage kare — worker_state table me single row (id=1) hamesha current state reflect kare
Node.js hi scan control kare (start/stop/switch)

Scan Manager responsibilities:
lib/scan-manager.js
  - startScan(scanId, scanType, rootPath, options)
    → atomically check worker_state (BEGIN IMMEDIATE transaction)
    → agar conflict: throw CONFLICT_ERROR
    → worker_state update karo: current_scan_id, current_scan_type, started_at
    → Python process spawn karo
    → readline se events read karo
    → ScanProcessor ko events do
  - stopScan()
    → Python process kill karo
    → worker_state clear karo
  - getState()
    → worker_state table read karo

5. Realtime System

UI ko realtime update mile via SSE (Server-Sent Events) ya polling
/api/scan/stream — SSE endpoint jo global.__SCAN_STATE.events replay kare
/api/scan/query?type=state — polling endpoint jo directly worker_state table read kare (ye SSE se zyada reliable hai reconnect ke case me)
Frontend dono use kar sakta hai: SSE for live updates + polling fallback


6. UI Logic

DupScan tab: sirf duplicate files show kare (WHERE is_duplicate = 1 query SQLite se)
File Manager tab: sab files show kare (SQLite se paginated query)
App open hote hi: SQLite se data read karo aur instantly render karo — koi JSON parse nahi, koi in-memory rebuild nahi
ScanConflictModal (shared/components/ScanConflictModal.jsx):

Tab hone par dikhao jab 409 aaye scan start karne par
Show karo: "DupScan chal raha hai ([path], [time ago]). Rok ke File Manager scan shuru karein?"
Buttons: "Haan, switch karo" → POST /api/scan/switch { confirmSwitch: true, newScanType } | "Rehne do"




7. Database Design
Single DB file: %LOCALAPPDATA%/DupScan/dupscan.db (Windows) ya ~/.local/share/DupScan/dupscan.db (Linux/Mac)
Use better-sqlite3 — synchronous API, no callback hell, proper transaction support:
jsimport Database from 'better-sqlite3';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
Tables:
sql-- Unified files table (DupScan + File Manager dono use kare)
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dir TEXT NOT NULL,
  ext TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  hash TEXT,
  is_duplicate INTEGER DEFAULT 0,
  duplicate_group_id INTEGER,  -- FK to duplicate_groups.id (INTEGER, not hash)
  file_mtime INTEGER,
  last_scanned INTEGER,
  status TEXT DEFAULT 'active',  -- active | deleted
  category TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (duplicate_group_id) REFERENCES duplicate_groups(id)
);

CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
CREATE INDEX IF NOT EXISTS idx_files_dir ON files(dir);
CREATE INDEX IF NOT EXISTS idx_files_is_duplicate ON files(is_duplicate);

-- Duplicate groups
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,
  file_count INTEGER NOT NULL,
  waste_bytes INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dup_groups_hash ON duplicate_groups(hash);

-- Worker state (singleton, always id=1)
CREATE TABLE IF NOT EXISTS worker_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_scan_id TEXT,        -- NULL means idle
  current_scan_type TEXT,      -- 'duplicates' | 'full' | NULL
  started_at INTEGER,
  phase TEXT DEFAULT 'idle',
  files_processed INTEGER DEFAULT 0,
  files_to_process INTEGER DEFAULT 0,
  current_directory TEXT,
  updated_at INTEGER NOT NULL
);
-- Startup pe ye row exist karni chahiye:
INSERT OR IGNORE INTO worker_state (id, updated_at) VALUES (1, unixepoch());

-- Scan history (audit trail)
CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL UNIQUE,
  scan_type TEXT NOT NULL,
  root_path TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'scanning',  -- scanning | done | stopped | error
  files_found INTEGER DEFAULT 0,
  duplicate_groups_count INTEGER DEFAULT 0,
  total_waste_bytes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
-- NOTE: scan_history me 'updated_at' column nahi hai — mat banana

-- File marks (user decisions: keep/delete/ignore)
CREATE TABLE IF NOT EXISTS file_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL UNIQUE,
  mark_type TEXT NOT NULL,  -- keep | delete | ignore
  marked_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Scan events (error logging + SSE replay)
CREATE TABLE IF NOT EXISTS scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data TEXT,               -- NOTE: column name is 'data', not 'details'
  created_at INTEGER NOT NULL
);

8. Database Operations Layer (lib/db-ops.js)
CRITICAL: Ye file ESM honi chahiye. better-sqlite3 synchronous hai isliye async/await ki zaroorat nahi basic operations me.
js// lib/db.js — singleton better-sqlite3 connection
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const dbDir = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'DupScan')
  : path.join(os.homedir(), '.local', 'share', 'DupScan');

fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'dupscan.db');

let _db = null;
export function getDb() {
  if (!_db) {
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
  }
  return _db;
}
Atomic conflict check + scan start (CRITICAL — ye sahi hona chahiye):
js// lib/db-ops.js
export function atomicStartScan(scanId, scanType, rootPath) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  
  // better-sqlite3 me transaction synchronous hai — race condition impossible
  const startTx = db.transaction(() => {
    const state = db.prepare('SELECT current_scan_id FROM worker_state WHERE id = 1').get();
    if (state?.current_scan_id) {
      throw new Error('CONFLICT_SCAN_RUNNING');
    }
    
    db.prepare(`
      UPDATE worker_state 
      SET current_scan_id = ?, current_scan_type = ?, started_at = ?, 
          phase = 'starting', files_processed = 0, updated_at = ?
      WHERE id = 1
    `).run(scanId, scanType, now, now);
    
    db.prepare(`
      INSERT INTO scan_history (scan_id, scan_type, root_path, started_at, status, created_at)
      VALUES (?, ?, ?, ?, 'scanning', ?)
    `).run(scanId, scanType, rootPath, now, now);
  });
  
  startTx(); // throws 'CONFLICT_SCAN_RUNNING' if conflict
}

export function clearWorkerState() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE worker_state 
    SET current_scan_id = NULL, current_scan_type = NULL, started_at = NULL,
        phase = 'idle', files_processed = 0, current_directory = NULL, updated_at = ?
    WHERE id = 1
  `).run(now);
}

export function updateWorkerProgress(phase, filesProcessed, filesToProcess, currentDir) {
  const db = getDb();
  db.prepare(`
    UPDATE worker_state 
    SET phase = ?, files_processed = ?, files_to_process = ?, 
        current_directory = ?, updated_at = ?
    WHERE id = 1
  `).run(phase, filesProcessed, filesToProcess, currentDir, Math.floor(Date.now() / 1000));
}

export function upsertDuplicateGroup(hash, fileCount, wasteBytes, fileSize) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  // INSERT OR REPLACE returns the rowid
  const result = db.prepare(`
    INSERT INTO duplicate_groups (hash, file_count, waste_bytes, file_size, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      file_count = excluded.file_count,
      waste_bytes = excluded.waste_bytes,
      file_size = excluded.file_size,
      updated_at = excluded.updated_at
  `).run(hash, fileCount, wasteBytes, fileSize, now, now);
  
  const group = db.prepare('SELECT id FROM duplicate_groups WHERE hash = ?').get(hash);
  return group.id;
}

export function batchUpsertFiles(files) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO files (path, name, dir, size, file_mtime, hash, ext, category, 
                       is_duplicate, duplicate_group_id, last_scanned, status, created_at, updated_at)
    VALUES (@path, @name, @dir, @size, @file_mtime, @hash, @ext, @category,
            @is_duplicate, @duplicate_group_id, @last_scanned, @status, @created_at, @updated_at)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      file_mtime = excluded.file_mtime,
      hash = excluded.hash,
      is_duplicate = excluded.is_duplicate,
      duplicate_group_id = excluded.duplicate_group_id,
      last_scanned = excluded.last_scanned,
      updated_at = excluded.updated_at
  `);
  
  const insertMany = db.transaction((fileList) => {
    for (const f of fileList) {
      stmt.run({ ...f, created_at: now, updated_at: now, last_scanned: now });
    }
  });
  
  insertMany(files);
}

export function markFilesAsDuplicate(hash, groupId) {
  const db = getDb();
  db.prepare(`
    UPDATE files SET is_duplicate = 1, duplicate_group_id = ?, updated_at = ?
    WHERE hash = ? AND status = 'active'
  `).run(groupId, Math.floor(Date.now() / 1000), hash);
}

export function markScanComplete(scanId, stats = {}) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  // NOTE: scan_history me updated_at nahi hai
  db.prepare(`
    UPDATE scan_history 
    SET status = 'done', completed_at = ?,
        files_found = ?, duplicate_groups_count = ?, total_waste_bytes = ?
    WHERE scan_id = ?
  `).run(now, stats.filesFound || 0, stats.dupGroups || 0, stats.wasteBytes || 0, scanId);
  
  clearWorkerState();
}

export function getWorkerState() {
  return getDb().prepare('SELECT * FROM worker_state WHERE id = 1').get();
}

// Stale lock detection — app crash ke baad
export function clearStaleLockIfNeeded() {
  const db = getDb();
  const state = db.prepare('SELECT * FROM worker_state WHERE id = 1').get();
  if (!state?.current_scan_id) return;
  
  // Agar 30 minute se zyada purana hai aur koi process nahi chal raha
  const thirtyMinAgo = Math.floor(Date.now() / 1000) - (30 * 60);
  if (state.started_at && state.started_at < thirtyMinAgo) {
    console.warn('[DB] Stale scan lock detected, clearing...');
    clearWorkerState();
  }
}

9. ScanProcessor (lib/db-scan.js) — ESM version
js// lib/db-scan.js — ESM, uses better-sqlite3 via db-ops.js
import { batchUpsertFiles, upsertDuplicateGroup, markFilesAsDuplicate, 
         markScanComplete, updateWorkerProgress } from './db-ops.js';

export class ScanProcessor {
  constructor(scanId, scanType) {
    this.scanId = scanId;
    this.scanType = scanType;
    this.fileBuffer = [];
    this.batchSize = 500;
    this.dupCount = 0;
    this.fileCount = 0;
  }

  processEvent(event) {
    // NOTE: better-sqlite3 synchronous hai so no async needed for DB ops
    // But processEvent can remain async for compatibility
    const type = event?.type;
    if (!type) return;
    
    if (type === 'dup') this._handleDup(event);
    else if (type === 'file_record') this._handleFileRecord(event);
    else if (type === 'scanning' || type === 'progress') this._handleProgress(event);
    else if (type === 'done') this._handleDone(event);
    else if (type === 'error') this._handleError(event);
    // Others silently ignored
  }

  _handleDup(event) {
    const { hash, size, waste, count, files } = event;
    if (!files?.length) return;
    
    const groupId = upsertDuplicateGroup(hash, files.length, waste || 0, size || 0);
    
    // Files ko upsert karo with duplicate info
    const fileRecords = files.map(f => ({
      path: f.path,
      name: f.name || path.basename(f.path),
      dir: f.folder || path.dirname(f.path),
      size: f.size || size || 0,
      file_mtime: f.mtime || 0,
      hash: hash,
      ext: f.ext || path.extname(f.path).toLowerCase(),
      category: f.cat || 'Others',
      is_duplicate: 1,
      duplicate_group_id: groupId,
      status: 'active',
    }));
    
    batchUpsertFiles(fileRecords);
    this.dupCount++;
  }

  _handleFileRecord(event) {
    this.fileBuffer.push({
      path: event.path,
      name: event.name || '',
      dir: event.folder || '',
      size: event.size || 0,
      file_mtime: event.mtime || 0,
      hash: event.hash || null,
      ext: event.ext || '',
      category: event.category || 'Others',
      is_duplicate: 0,
      duplicate_group_id: null,
      status: 'active',
    });
    
    this.fileCount++;
    if (this.fileBuffer.length >= this.batchSize) {
      this.flushFileBuffer();
    }
  }

  _handleProgress(event) {
    updateWorkerProgress(
      event.stage || 'scanning',
      event.done || event.n || 0,
      event.total || 0,
      event.dir || ''
    );
  }

  _handleDone(event) {
    this.flushFileBuffer();
    markScanComplete(this.scanId, {
      filesFound: this.fileCount,
      dupGroups: this.dupCount,
    });
  }

  _handleError(event) {
    console.error('[ScanProcessor] Scanner error:', event.msg);
  }

  flushFileBuffer() {
    if (!this.fileBuffer.length) return;
    batchUpsertFiles(this.fileBuffer);
    this.fileBuffer = [];
  }

  flush() {
    this.flushFileBuffer();
  }
}

export function createScanProcessor(scanId, scanType) {
  return new ScanProcessor(scanId, scanType);
}

10. Incremental Scanning Logic
File change detect karo using:

size comparison
last_scanned vs current file_mtime

Process:
Before scan:
  1. SQLite se sab files fetch karo jahan last_scanned IS NOT NULL
  2. Map banao: { path → { size, mtime, hash } }
  3. Is map ko temp JSON file me likho
  4. Python ko --previous-hashes flag ke saath call karo

Python processing:
  1. Previous hashes load karo
  2. Har file ke liye: current size + mtime compare karo
  3. Agar same hai: emit { type: 'file_unchanged', path, hash: old_hash }
  4. Agar different hai: hash calculate karo, emit { type: 'file_hashed', ... }

Node processing:
  - file_unchanged: sirf last_scanned update karo (hash reuse)
  - file_hashed: full upsert karo with new hash

11. API Routes
/api/scan/start (POST) — DupScan:
js// Ye route sirf scan-manager ko call karta hai
// Python process yahan spawn nahi hota
export async function POST(req) {
  const { scanPath, includeHidden, mode } = await req.json();
  const scanId = `s_${Date.now()}`;
  
  try {
    // atomicStartScan throws if conflict
    atomicStartScan(scanId, 'duplicates', scanPath);
  } catch (err) {
    if (err.message === 'CONFLICT_SCAN_RUNNING') {
      const state = getWorkerState();
      return Response.json({
        status: 'conflict',
        currentScan: {
          type: state.current_scan_type,
          startedAt: state.started_at,
          path: state.current_directory,
        }
      }, { status: 409 });
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
  
  // Background me scan shuru karo (await mat karo)
  startBackgroundScan(scanId, 'duplicates', scanPath, includeHidden).catch(console.error);
  
  return Response.json({ id: scanId, scanPath, startedAt: new Date().toISOString() });
}
/api/scan/switch (POST) — Conflict resolution:
jsexport async function POST(req) {
  const { confirmSwitch, newScanType, newScanPath } = await req.json();
  if (!confirmSwitch) return Response.json({ cancelled: true });
  
  // Current scan stop karo
  stopCurrentScan();
  clearWorkerState();
  
  // Naya scan shuru karo
  const scanId = `s_${Date.now()}`;
  atomicStartScan(scanId, newScanType, newScanPath);
  startBackgroundScan(scanId, newScanType, newScanPath).catch(console.error);
  
  return Response.json({ id: scanId, started: true });
}
/api/scan/query (GET) — State polling:
jsexport async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  
  if (type === 'state') {
    return Response.json(getWorkerState());
  }
  if (type === 'duplicates') {
    const db = getDb();
    const groups = db.prepare(`
      SELECT dg.*, COUNT(f.id) as file_count
      FROM duplicate_groups dg
      JOIN files f ON f.duplicate_group_id = dg.id
      WHERE f.status = 'active'
      GROUP BY dg.id
      ORDER BY dg.waste_bytes DESC
      LIMIT 100
    `).all();
    return Response.json({ groups });
  }
}

12. Frontend Conflict Handling
shared/components/ScanConflictModal.jsx banana hai:
jsx// Jab bhi /api/scan/start ya /api/fm/scan-bg 409 return kare:
export default function ScanConflictModal({ conflict, onSwitch, onCancel }) {
  if (!conflict) return null;
  
  const currentName = conflict.currentScan.type === 'duplicates' ? 'DupScan' : 'File Manager';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" 
         style={{ background: 'rgba(7,9,12,.85)' }}>
      <div className="rounded-xl p-6 w-96" style={{ background: 'var(--s2)', border: '1px solid var(--border2)' }}>
        <div className="text-sm font-bold mb-3" style={{ color: 'var(--amber)' }}>
          ⚠️ Scan Already Running
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          {currentName} scan abhi chal raha hai. Rokke naya scan shuru karein?
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost px-4 py-2 rounded text-xs" onClick={onCancel}>
            Rehne do
          </button>
          <button className="btn-neon px-4 py-2 rounded text-xs" onClick={onSwitch}>
            Haan, switch karo
          </button>
        </div>
      </div>
    </div>
  );
}
useDupScan.js me update:
jsconst startScan = useCallback(async ({ path, hidden, mode }) => {
  const data = await startDupScan({ scanPath: path, includeHidden: hidden, mode });
  
  if (data?.status === 'conflict') {
    setConflict(data);  // Modal dikhao
    return;
  }
  
  if (data?.id) setScanId(data.id);
}, []);

const handleConflictSwitch = useCallback(async () => {
  const data = await fetch('/api/scan/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmSwitch: true, newScanType: 'duplicates', newScanPath: pendingScanPath }),
  }).then(r => r.json());
  
  setConflict(null);
  if (data.id) setScanId(data.id);
}, [pendingScanPath]);

13. App Startup
app/page.js ya app/layout.js me:
js// DB initialize karo + stale lock clear karo
import { initializeDatabase } from '../lib/init-db.js';
import { clearStaleLockIfNeeded } from '../lib/db-ops.js';

// Server component me:
await initializeDatabase();
clearStaleLockIfNeeded();

14. Migration from JSON (one-time)
lib/migrate-from-json.js:
js// history.json read karo
// Scans ke dups array se files + duplicate_groups populate karo
// fileIndex.files se remaining files populate karo
// history.json ko history.json.backup rename karo
// Sirf ek baar chalao on first startup

15. Package Changes
json{
  "dependencies": {
    "better-sqlite3": "^9.0.0"
  }
}
sqlite3 package hatao — better-sqlite3 use karo. sql.js bhi hatao.
next.config.mjs me:
jsconst nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        'better-sqlite3',
        'fs', 'path', 'os', 'child_process', 'worker_threads', 'crypto'
      );
    }
    return config;
  },
};

16. Performance Requirements

batchUpsertFiles — 500 files per transaction (better-sqlite3 transaction is synchronous and very fast)
Large folders efficiently handle ho — BFS + size-grouping first, then hash only candidates
Background worker stable ho — global.__SCAN_MANAGER pe live rahe
UI fast aur responsive ho — SQLite direct queries, no JSON parsing
WAL mode enable karo — concurrent reads during write possible


Solution Requirements Summary
Existing issues jo fix hone chahiye:

lib/db-scan.js ko ESM me convert karo (abhi CJS hai — require use kar raha hai)
sqlite3 package ko better-sqlite3 se replace karo
lib/db.js aur lib/db-ops.js ko better-sqlite3 synchronous API pe rewrite karo
scan_history table me updated_at column nahi hai — markScanComplete fix karo
scan_events table me column data hai, details nahi — fix karo
atomicStartScan ko actually /api/scan/start aur /api/fm/scan-bg me call karo
ScanConflictModal component banao aur frontend me wire karo
Python process ko HTTP handler ke andar spawn karna band karo — lib/scan-manager.js banao
history.json based storage (lib/fm-cache.js, lib/history.js) ko bypass karo for new data — SQLite direct use karo
clearStaleLockIfNeeded app startup pe call karo
duplicate_group_id ko hash (TEXT) ki jagah id (INTEGER FK) se link karo

Existing features jo preserve karni hain:

DupScan tab UI (ResultsView, GalleryView, PreviewModal, StatusPill)
File Manager tab UI (sidebar, grid/list view, virtual scrolling)
Preview API (/api/preview)
Delete, rename, move operations
Scan history sidebar
SSE stream for live updates
Settings modal
Report download