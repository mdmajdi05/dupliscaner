// Incremental BFS scanner for the File Manager with Gallery.
// Runs in a Node worker thread so the Next UI never blocks.
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MEDIA_EXTS = {
  image: new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tiff', '.tif', '.heic', '.raw', '.ico']),
  video: new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg', '.ts', '.vob']),
  audio: new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff', '.alac']),
  document: new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.odt', '.rtf', '.md', '.epub', '.json', '.html', '.css']),
};

const ALWAYS_SKIP_DIRS = new Set([
  '$RECYCLE.BIN',
  'System Volume Information',
  '.git',
  'node_modules',
  '__pycache__',
  '.next',
  '.cache',
  'Cache',
  'tmp',
  'temp',
]);

const DEFAULT_ROOT = process.platform === 'win32' ? 'C:\\' : path.parse(os.homedir()).root;
const appDataDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const storePath = path.join(appDataDir, 'DupScan', 'history.json');
let stopped = false;

parentPort.on('message', (msg) => {
  if (msg && msg.type === 'stop') stopped = true;
});

function emit(obj) {
  parentPort.postMessage(obj);
}

function getCategory(ext) {
  const e = String(ext || '').toLowerCase();
  for (const [cat, set] of Object.entries(MEDIA_EXTS)) {
    if (set.has(e)) return cat;
  }
  return 'other';
}

function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function readCachedFiles() {
  try {
    if (!fs.existsSync(storePath)) return {};
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    if (Array.isArray(raw)) return {};
    return raw.fileIndex && raw.fileIndex.files && typeof raw.fileIndex.files === 'object'
      ? raw.fileIndex.files
      : {};
  } catch {
    return {};
  }
}

function normalizeForCompare(value) {
  return process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '');
}

function isWithinRoot(filePath, rootPath) {
  const file = normalizeForCompare(path.resolve(filePath));
  const root = normalizeForCompare(path.resolve(rootPath));
  return file === root || file.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function isHiddenName(name) {
  return name.startsWith('.');
}

function shouldSkipDir(name, includeHidden) {
  if (ALWAYS_SKIP_DIRS.has(name)) return true;
  if (!includeHidden && isHiddenName(name)) return true;
  return false;
}

function makeRecord(filePath, stat, previous) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ...(previous || {}),
    name: path.basename(filePath),
    path: filePath,
    ext,
    type: 'file',
    category: getCategory(ext),
    size: stat.size,
    sizeFmt: fmtSize(stat.size),
    modified: stat.mtimeMs,
    folder: path.dirname(filePath),
    exists: true,
    dupCount: previous?.dupCount || 0,
    hash: previous?.hash || null,
  };
}

function unchanged(prev, stat) {
  return prev && prev.exists !== false && prev.size === stat.size && Math.abs((prev.modified || 0) - stat.mtimeMs) < 1;
}

function hashFile(filePath) {
  const h = crypto.createHash('md5');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 256);
  try {
    while (!stopped) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!read) break;
      h.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return stopped ? null : h.digest('hex');
}

function flushBatch(batch) {
  if (!batch.length) return;
  emit({ type: 'upsert', files: batch.splice(0, batch.length) });
}

function run() {
  const rootPath = workerData.rootPath || DEFAULT_ROOT;
  const includeHidden = Boolean(workerData.includeHidden);
  const startedAt = new Date().toISOString();
  const cached = readCachedFiles();
  const nextFiles = {};
  const seen = new Set();
  const queue = [rootPath];
  const batch = [];
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  let lastProgress = Date.now();

  emit({
    type: 'progress',
    status: 'scanning',
    progress: { phase: 'discovering', scanned, indexed, skipped, removed: 0, currentDir: rootPath, startedAt, updatedAt: startedAt },
  });

  while (queue.length && !stopped) {
    const dir = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      errors += 1;
      continue;
    }

    for (const ent of entries) {
      if (stopped) break;
      const fullPath = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) {
          if (!shouldSkipDir(ent.name, includeHidden)) queue.push(fullPath);
          continue;
        }
        if (!ent.isFile()) continue;
        if (!includeHidden && isHiddenName(ent.name)) continue;

        const stat = fs.statSync(fullPath);
        if (stat.size < 0) continue;
        const prev = cached[fullPath];
        const rec = makeRecord(fullPath, stat, prev);
        seen.add(fullPath);
        scanned += 1;

        if (unchanged(prev, stat)) {
          nextFiles[fullPath] = rec;
          skipped += 1;
        } else {
          rec.hash = null;
          nextFiles[fullPath] = rec;
          indexed += 1;
          batch.push(rec);
        }

        if (batch.length >= 100) flushBatch(batch);
        if (Date.now() - lastProgress > 500) {
          lastProgress = Date.now();
          emit({
            type: 'progress',
            status: 'scanning',
            progress: { phase: 'discovering', scanned, indexed, skipped, errors, currentDir: dir, startedAt, updatedAt: new Date().toISOString() },
          });
        }
      } catch {
        errors += 1;
      }
    }
  }

  flushBatch(batch);

  const removed = [];
  for (const filePath of Object.keys(cached)) {
    if (isWithinRoot(filePath, rootPath) && !seen.has(filePath)) removed.push(filePath);
  }
  if (removed.length) emit({ type: 'remove', paths: removed });

  const bySize = new Map();
  for (const rec of Object.values(nextFiles)) {
    if (!rec || rec.size <= 0) continue;
    if (!bySize.has(rec.size)) bySize.set(rec.size, []);
    bySize.get(rec.size).push(rec);
  }

  const candidates = [...bySize.values()].filter((group) => group.length > 1);
  const candidateCount = candidates.reduce((sum, group) => sum + group.length, 0);
  let hashed = 0;
  emit({
    type: 'progress',
    status: 'scanning',
    progress: { phase: 'hashing', scanned, indexed, skipped, removed: removed.length, hashed, candidates: candidateCount, errors, currentDir: '', startedAt, updatedAt: new Date().toISOString() },
  });

  for (const group of candidates) {
    if (stopped) break;
    for (const rec of group) {
      if (stopped) break;
      try {
        if (!rec.hash) {
          rec.hash = hashFile(rec.path);
          batch.push(rec);
        }
      } catch {
        rec.hash = null;
        errors += 1;
      }
      hashed += 1;
      if (batch.length >= 50) flushBatch(batch);
      if (hashed % 25 === 0) {
        emit({
          type: 'progress',
          status: 'scanning',
          progress: { phase: 'hashing', scanned, indexed, skipped, removed: removed.length, hashed, candidates: candidateCount, errors, currentDir: rec.folder, startedAt, updatedAt: new Date().toISOString() },
        });
      }
    }
  }

  flushBatch(batch);

  emit({
    type: stopped ? 'stopped' : 'complete',
    status: stopped ? 'stopped' : 'done',
    rootPath,
    includeHidden,
    progress: {
      phase: stopped ? 'stopped' : 'done',
      scanned,
      indexed,
      skipped,
      removed: removed.length,
      hashed,
      candidates: candidateCount,
      errors,
      currentDir: '',
      startedAt,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  });
}

try {
  run();
} catch (err) {
  emit({ type: 'error', error: err.message });
}
