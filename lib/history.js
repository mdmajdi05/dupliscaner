import fs from 'fs';
import path from 'path';
import os from 'os';

// Get AppData directory - Windows specific
const appDataDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const DIR = path.join(appDataDir, 'DupScan');
const FILE = path.join(DIR, 'history.json');
const REPORTS_DIR = path.join(DIR, 'reports');
const STORE_VERSION = 2;

function ensure() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function emptyFileIndex() {
  return {
    rootPath: process.platform === 'win32' ? 'C:\\' : path.parse(os.homedir()).root,
    includeHidden: false,
    scanMode: 'manual',
    status: 'idle',
    progress: {
      phase: 'idle',
      scanned: 0,
      indexed: 0,
      skipped: 0,
      removed: 0,
      hashed: 0,
      candidates: 0,
      groups: 0,
      currentDir: '',
      startedAt: null,
      updatedAt: null,
      completedAt: null,
    },
    files: {},
    folders: {},
    duplicateGroups: [],
    originals: {},
    updatedAt: null,
  };
}

function normalizeStore(data) {
  if (Array.isArray(data)) {
    return {
      version: STORE_VERSION,
      scanHistory: data,
      fileIndex: emptyFileIndex(),
    };
  }

  const store = data && typeof data === 'object' ? data : {};
  return {
    version: STORE_VERSION,
    scanHistory: Array.isArray(store.scanHistory) ? store.scanHistory : [],
    fileIndex: store.fileIndex && typeof store.fileIndex === 'object'
      ? { ...emptyFileIndex(), ...store.fileIndex }
      : emptyFileIndex(),
  };
}

export function readStore() {
  ensure();
  if (!fs.existsSync(FILE)) return normalizeStore(null);
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return normalizeStore(null);
  }
}

export function writeStore(store) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(normalizeStore(store), null, 2), 'utf8');
}

export function readAll() {
  return readStore().scanHistory;
}

export function writeAll(list) {
  const store = readStore();
  store.scanHistory = Array.isArray(list) ? list : [];
  writeStore(store);
}

export function addScan(scan) {
  const list = readAll();
  list.unshift(scan);
  if (list.length > 50) {
    const toDelete = list.splice(50);
    // Delete associated report files
    for (const s of toDelete) {
      if (s.reportPath && fs.existsSync(s.reportPath)) {
        try { fs.unlinkSync(s.reportPath); } catch {}
      }
    }
  }
  writeAll(list);
  return scan;
}

export function getById(id) { return readAll().find(s => s.id === id) || null; }

export function deleteById(id) {
  const list = readAll();
  const scan = list.find(s => s.id === id);
  if (scan && scan.reportPath && fs.existsSync(scan.reportPath)) {
    try { fs.unlinkSync(scan.reportPath); } catch {}
  }
  const filtered = list.filter(s => s.id !== id);
  writeAll(filtered);
}

export function patchById(id, patch) {
  const list = readAll();
  const i = list.findIndex(s => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  writeAll(list);
  return list[i];
}

export function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}
