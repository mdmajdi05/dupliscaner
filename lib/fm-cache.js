import fs from 'fs';
import path from 'path';
import os from 'os';
import { readStore, writeStore } from './history.js';

export const ROOT_PATH = process.platform === 'win32' ? 'C:\\' : path.parse(os.homedir()).root;

export const MEDIA_EXTS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tiff', '.tif', '.heic', '.raw', '.ico'],
  video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg', '.ts', '.vob'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff', '.alac'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.odt', '.rtf', '.md', '.epub', '.json', '.html', '.css'],
};

const EXT_SETS = Object.fromEntries(
  Object.entries(MEDIA_EXTS).map(([cat, exts]) => [cat, new Set(exts)])
);

export function getCategory(ext) {
  const e = String(ext || '').toLowerCase();
  for (const [cat, set] of Object.entries(EXT_SETS)) {
    if (set.has(e)) return cat;
  }
  return 'other';
}

export function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function emptyFileIndex() {
  return {
    rootPath: ROOT_PATH,
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

export function normalizeFileIndex(fileIndex) {
  const base = emptyFileIndex();
  const idx = fileIndex && typeof fileIndex === 'object' ? fileIndex : {};
  return {
    ...base,
    ...idx,
    progress: { ...base.progress, ...(idx.progress || {}) },
    files: idx.files && typeof idx.files === 'object' ? idx.files : {},
    folders: idx.folders && typeof idx.folders === 'object' ? idx.folders : {},
    duplicateGroups: Array.isArray(idx.duplicateGroups) ? idx.duplicateGroups : [],
    originals: idx.originals && typeof idx.originals === 'object' ? idx.originals : {},
  };
}

export function loadFileIndex() {
  return normalizeFileIndex(readStore().fileIndex);
}

export function saveFileIndex(fileIndex) {
  const store = readStore();
  store.fileIndex = normalizeFileIndex(fileIndex);
  writeStore(store);
  return store.fileIndex;
}

export function mutateFileIndex(fn) {
  const store = readStore();
  const index = normalizeFileIndex(store.fileIndex);
  const result = fn(index) || index;
  store.fileIndex = normalizeFileIndex(result);
  writeStore(store);
  return store.fileIndex;
}

export function makeFileRecord(filePath, stat = null) {
  const st = stat || fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    ext,
    type: 'file',
    category: getCategory(ext),
    size: st.size,
    sizeFmt: fmtSize(st.size),
    modified: st.mtimeMs,
    folder: dir,
    hash: null,
    dupCount: 0,
    exists: true,
  };
}

export function makeFolderRecord(folderPath) {
  return {
    name: path.basename(folderPath) || folderPath,
    path: folderPath,
    type: 'dir',
    category: 'folder',
    counts: { all: 0, image: 0, video: 0, audio: 0, document: 0, other: 0, duplicates: 0 },
    size: 0,
    updatedAt: Date.now(),
  };
}

function normalizePathForCompare(value) {
  return process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '');
}

function isWithinRoot(filePath, rootPath) {
  const file = normalizePathForCompare(path.resolve(filePath));
  const root = normalizePathForCompare(path.resolve(rootPath));
  return file === root || file.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export function buildDerivedIndex(index) {
  const files = Object.values(index.files || {}).filter((f) => f && f.exists !== false);
  const dupByPath = new Map();
  const folders = {};

  for (const f of files) {
    f.sizeFmt = f.sizeFmt || fmtSize(f.size);
    f.category = f.category || getCategory(f.ext);
    f.folder = f.folder || path.dirname(f.path);
    f.dupCount = 0;

    let cur = f.folder;
    while (cur && isWithinRoot(cur, index.rootPath || ROOT_PATH)) {
      if (!folders[cur]) folders[cur] = makeFolderRecord(cur);
      folders[cur].counts.all += 1;
      folders[cur].counts[f.category] = (folders[cur].counts[f.category] || 0) + 1;
      folders[cur].size += f.size || 0;
      const parent = path.dirname(cur);
      if (!parent || parent === cur) break;
      cur = parent;
    }
  }

  const groups = [];
  const byHash = new Map();
  for (const f of files) {
    if (!f.hash) continue;
    const key = `${f.size}:${f.hash}`;
    if (!byHash.has(key)) byHash.set(key, []);
    byHash.get(key).push(f);
  }

  let n = 0;
  for (const [key, groupFiles] of byHash.entries()) {
    if (groupFiles.length < 2) continue;
    n += 1;
    const [sizeText, hash] = key.split(':');
    const size = Number(sizeText) || groupFiles[0].size || 0;
    const id = `h_${hash}`;
    const originalPath = index.originals[id] && groupFiles.some((f) => f.path === index.originals[id])
      ? index.originals[id]
      : groupFiles[0].path;

    for (const f of groupFiles) {
      f.dupCount = groupFiles.length - 1;
      dupByPath.set(f.path, groupFiles.length - 1);
      let cur = f.folder;
      while (cur && folders[cur]) {
        folders[cur].counts.duplicates += 1;
        const parent = path.dirname(cur);
        if (!parent || parent === cur) break;
        cur = parent;
      }
    }

    groups.push({
      id,
      hash,
      cat: groupFiles[0].category,
      category: groupFiles[0].category,
      ext: groupFiles[0].ext,
      size,
      sizeFmt: fmtSize(size),
      waste: size * (groupFiles.length - 1),
      wasteFmt: fmtSize(size * (groupFiles.length - 1)),
      count: groupFiles.length,
      originalPath,
      files: groupFiles
        .slice()
        .sort((a, b) => (a.path === originalPath ? -1 : b.path === originalPath ? 1 : a.path.localeCompare(b.path))),
    });
  }

  index.duplicateGroups = groups.sort((a, b) => b.waste - a.waste || a.files[0].name.localeCompare(b.files[0].name));
  index.folders = folders;
  index.updatedAt = new Date().toISOString();
  return { index, dupByPath };
}

export function queryFiles(index, options = {}) {
  const {
    rootPath = index.rootPath || ROOT_PATH,
    folder = rootPath,
    category = '',
    ext = '',
    search = '',
    sort = 'name',
    dir = 'asc',
    offset = 0,
    limit = 100,
    recursive = true,
    duplicatesOnly = false,
  } = options;

  const root = folder || rootPath || ROOT_PATH;
  const extNeedle = ext.trim().toLowerCase().replace(/^\*/, '');
  const q = search.trim().toLowerCase();
  const { dupByPath } = buildDerivedIndex(index);

  let items = Object.values(index.files || {}).filter((f) => {
    if (!f || f.exists === false) return false;
    if (!isWithinRoot(f.path, root)) return false;
    if (!recursive && normalizePathForCompare(f.folder) !== normalizePathForCompare(root)) return false;
    if (category && category !== 'all' && f.category !== category) return false;
    if (duplicatesOnly && !dupByPath.has(f.path)) return false;
    if (extNeedle && !f.ext.includes(extNeedle.startsWith('.') ? extNeedle : `.${extNeedle}`)) return false;
    if (q && !`${f.name} ${f.path}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const mult = dir === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    if (sort === 'size') return ((a.size || 0) - (b.size || 0)) * mult;
    if (sort === 'date') return ((a.modified || 0) - (b.modified || 0)) * mult;
    if (sort === 'type') return `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`) * mult;
    if (sort === 'dups') return ((a.dupCount || 0) - (b.dupCount || 0)) * mult;
    return a.name.localeCompare(b.name) * mult;
  });

  const start = Number(offset) || 0;
  const count = Math.max(1, Math.min(500, Number(limit) || 100));
  return {
    items: items.slice(start, start + count),
    total: items.length,
    offset: start,
    limit: count,
    hasMore: start + count < items.length,
  };
}

export function getFolderList(index, options = {}) {
  const { rootPath = index.rootPath || ROOT_PATH, sort = 'duplicates', dir = 'desc', offset = 0, limit = 100 } = options;
  buildDerivedIndex(index);
  const root = rootPath || ROOT_PATH;
  let folders = Object.values(index.folders || {}).filter((f) => f && isWithinRoot(f.path, root));
  const mult = dir === 'asc' ? 1 : -1;
  folders.sort((a, b) => {
    if (sort === 'photos') return ((a.counts.image || 0) - (b.counts.image || 0)) * mult;
    if (sort === 'videos') return ((a.counts.video || 0) - (b.counts.video || 0)) * mult;
    if (sort === 'audio') return ((a.counts.audio || 0) - (b.counts.audio || 0)) * mult;
    if (sort === 'documents') return ((a.counts.document || 0) - (b.counts.document || 0)) * mult;
    if (sort === 'files') return ((a.counts.all || 0) - (b.counts.all || 0)) * mult;
    if (sort === 'name') return a.path.localeCompare(b.path) * (dir === 'desc' ? -1 : 1);
    return ((a.counts.duplicates || 0) - (b.counts.duplicates || 0)) * mult;
  });
  const start = Number(offset) || 0;
  const count = Math.max(1, Math.min(500, Number(limit) || 100));
  return {
    items: folders.slice(start, start + count),
    total: folders.length,
    offset: start,
    limit: count,
    hasMore: start + count < folders.length,
  };
}

export function getImmediateFolders(dirPath, includeHidden = false) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((ent) => ent.isDirectory() && (includeHidden || !ent.name.startsWith('.')))
    .map((ent) => {
      const folderPath = path.join(dirPath, ent.name);
      return { ...makeFolderRecord(folderPath), counts: undefined };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
