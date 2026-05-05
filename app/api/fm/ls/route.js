import fs from 'fs';
import path from 'path';
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
