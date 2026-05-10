import fs from 'fs';
import path from 'path';
import { queryDb, queryDbOne } from '../../../../lib/db.js';
import { initializeDatabase } from '../../../../lib/init-db.js';
import {
  ROOT_PATH,
  buildDerivedIndex,
  fmtSize,
  getCategory,
  getFolderList,
  getImmediateFolders,
  loadFileIndex,
  queryFiles,
} from '../../../../lib/fm-cache.js';

export const dynamic = 'force-dynamic';

// Get files from SQLite (OPTIMIZED - single query with count)
function getFilesFromDb(dirPath, options = {}) {
  const { category = '', ext = '', search = '', offset = 0, limit = 100 } = options;
  const extNeedle = ext.trim().toLowerCase().replace(/^\*/, '');
  const q = search.trim().toLowerCase();

  // Build WHERE clause
  let whereClause = 'WHERE dir = ? AND status = ?';
  const params = [dirPath, 'active'];
  let countParams = [dirPath, 'active'];

  if (category && category !== 'all') {
    whereClause += ' AND category = ?';
    params.push(category);
    countParams.push(category);
  }

  if (extNeedle) {
    whereClause += ' AND ext LIKE ?';
    params.push(`%${extNeedle}%`);
    countParams.push(`%${extNeedle}%`);
  }

  if (q) {
    whereClause += ' AND (name LIKE ? OR path LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
    countParams.push(`%${q}%`, `%${q}%`);
  }

  try {
    // Single query: get files + count in one go using window function
    const sql = `
      SELECT *, COUNT(*) OVER() as total_count
      FROM files
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const files = queryDb(sql, params);
    const total = files.length > 0 ? files[0].total_count || 0 : 0;

    return {
      items: files.map(f => ({
        name: f.name,
        path: f.path,
        ext: f.ext || '',
        type: 'file',
        category: f.category || 'Others',
        size: f.size || 0,
        sizeFmt: fmtSize(f.size || 0),
        modified: (f.file_mtime || 0) * 1000,
        folder: f.dir,
        dupCount: f.is_duplicate ? 1 : 0,
      })),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      source: 'database',
    };
  } catch (err) {
    console.error('[getFilesFromDb] Error:', err.message);
    return null;
  }
}

// Get folders from SQLite (OPTIMIZED - direct query)
function getFoldersFromDb(parentPath) {
  try {
    // Get immediate subdirectories directly
    const folders = queryDb(
      `SELECT DISTINCT dir FROM files
       WHERE dir LIKE ? AND dir != ? AND status = 'active'
       ORDER BY dir ASC LIMIT 50`,
      [parentPath.replace(/\\/g, '/') + '/%', parentPath.replace(/\\/g, '/')]
    );

    const folderMap = new Map();
    const parentNorm = parentPath.replace(/\\/g, '/');

    for (const f of folders) {
      const relPath = f.dir.replace(parentNorm, '').split('/').filter(Boolean);
      if (relPath.length > 0) {
        const firstFolder = relPath[0];
        if (!folderMap.has(firstFolder)) {
          folderMap.set(firstFolder, {
            name: firstFolder,
            path: path.join(parentPath, firstFolder),
            type: 'dir',
            category: 'folder',
          });
        }
      }
    }

    return Array.from(folderMap.values());
  } catch (err) {
    console.error('[getFoldersFromDb] Error:', err.message);
    return [];
  }
}

function directFileList(dirPath, options) {
  const { category = '', ext = '', search = '', offset = 0, limit = 100 } = options;
  const extNeedle = ext.trim().toLowerCase().replace(/^\*/, '');
  const q = search.trim().toLowerCase();
  const items = [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const ent of entries) {
    try {
      const fullPath = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        items.push({ name: ent.name, path: fullPath, type: 'dir', category: 'folder' });
        continue;
      }
      if (!ent.isFile()) continue;

      const fileExt = path.extname(ent.name).toLowerCase();
      const cat = getCategory(fileExt);
      if (category && category !== 'all' && cat !== category) continue;
      if (extNeedle && !fileExt.includes(extNeedle.startsWith('.') ? extNeedle : `.${extNeedle}`)) continue;
      if (q && !`${ent.name} ${fullPath}`.toLowerCase().includes(q)) continue;

      const st = fs.statSync(fullPath);
      items.push({
        name: ent.name,
        path: fullPath,
        ext: fileExt,
        type: 'file',
        category: cat,
        size: st.size,
        sizeFmt: fmtSize(st.size),
        modified: st.mtimeMs,
        folder: dirPath,
        dupCount: 0,
      });
    } catch {}
  }

  items.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  const start = Number(offset) || 0;
  const count = Math.max(1, Math.min(500, Number(limit) || 100));
  return { items: items.slice(start, start + count), total: items.length, offset: start, limit: count, hasMore: start + count < items.length };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const dirPath = searchParams.get('path') || ROOT_PATH;
  const dirsOnly = searchParams.get('dirsOnly') === '1';
  const foldersOnly = searchParams.get('foldersOnly') === '1';
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const ext = searchParams.get('ext') || '';
  const category = searchParams.get('cat') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'name';
  const dir = searchParams.get('dir') || 'asc';
  const recursive = searchParams.get('recursive') !== '0';
  const duplicatesOnly = searchParams.get('dups') === '1';

  try {
    if (!fs.existsSync(dirPath)) return Response.json({ error: 'Path not found' }, { status: 404 });
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return Response.json({ error: 'Not a directory' }, { status: 400 });

    // Initialize DB (sync now)
    initializeDatabase();

    // If not dirsOnly, try to get files from SQLite (FAST!)
    if (!dirsOnly && !foldersOnly) {
      const dbResult = getFilesFromDb(dirPath, { category, ext, search, offset, limit });
      if (dbResult && dbResult.items.length > 0) {
        return Response.json(dbResult);
      }
    }

    // If foldersOnly, get folders from SQLite
    if (foldersOnly) {
      const dbFolders = getFoldersFromDb(dirPath);
      if (dbFolders.length > 0) {
        return Response.json({
          items: dbFolders,
          total: dbFolders.length,
          offset: 0,
          limit: dbFolders.length,
          hasMore: false,
          source: 'database',
        });
      }
    }

    // Fallback to fm-cache if SQLite has no data
    const index = loadFileIndex();
    buildDerivedIndex(index);

    if (dirsOnly) {
      const cached = index.folders || {};
      const items = getImmediateFolders(dirPath).map((folder) => ({
        ...folder,
        counts: cached[folder.path]?.counts,
        duplicateCount: cached[folder.path]?.counts?.duplicates || 0,
      }));
      return Response.json({ items, total: items.length, offset: 0, limit: items.length, hasMore: false });
    }

    if (foldersOnly) {
      return Response.json(getFolderList(index, {
        rootPath: dirPath,
        sort: searchParams.get('folderSort') || sort,
        dir,
        offset,
        limit,
      }));
    }

    const result = queryFiles(index, {
      rootPath: index.rootPath || ROOT_PATH,
      folder: dirPath,
      category,
      ext,
      search,
      sort,
      dir,
      offset,
      limit,
      recursive,
      duplicatesOnly,
    });

    if (result.total === 0 && !duplicatesOnly) {
      const fallback = directFileList(dirPath, { category, ext, search, offset, limit });
      return Response.json({ ...fallback, source: 'filesystem', cacheStatus: index.status, progress: index.progress });
    }

    return Response.json({ ...result, source: 'cache', cacheStatus: index.status, progress: index.progress });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}