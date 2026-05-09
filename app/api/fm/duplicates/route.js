import fs from 'fs';
import path from 'path';
import { queryDb, queryDbOne } from '../../../../lib/db.js';
import { initializeDatabase } from '../../../../lib/init-db.js';
import { ROOT_PATH, buildDerivedIndex, loadFileIndex } from '../../../../lib/fm-cache.js';

export const dynamic = 'force-dynamic';

function normalize(value) {
  return process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '').toLowerCase();
}

function within(filePath, rootPath) {
  const file = normalize(path.resolve(filePath));
  const root = normalize(path.resolve(rootPath));
  return file === root || file.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rootPath = searchParams.get('path') || ROOT_PATH;
  const category = searchParams.get('cat') || 'all';
  const offset = Number(searchParams.get('offset') || 0);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 100)));

  // Initialize database
  await initializeDatabase();

  // Try SQLite first for duplicates
  try {
    const sql = `
      SELECT dg.id, dg.hash, dg.file_count, dg.waste_bytes, dg.file_size, dg.created_at,
             f.path, f.name, f.dir, f.size, f.file_mtime, f.ext, f.category
      FROM duplicate_groups dg
      JOIN files f ON f.duplicate_group_id = dg.id
      WHERE f.status = 'active'
      ORDER BY dg.waste_bytes DESC
    `;

    const rows = await queryDb(sql);

    if (rows.length > 0) {
      // Group files by duplicate group
      const groupMap = new Map();
      for (const row of rows) {
        if (!groupMap.has(row.id)) {
          groupMap.set(row.id, {
            id: row.id,
            hash: row.hash,
            file_count: row.file_count,
            waste_bytes: row.waste_bytes,
            file_size: row.file_size,
            cat: row.category || 'Others',
            files: [],
          });
        }
        groupMap.get(row.id).files.push({
          path: row.path,
          name: row.name,
          folder: row.dir,
          size: row.size,
          mtime: row.file_mtime,
          ext: row.ext,
          category: row.category || 'Others',
          alive: fs.existsSync(row.path),
        });
      }

      let groups = Array.from(groupMap.values())
        .map((group) => ({
          ...group,
          files: group.files.filter((file) => within(file.path, rootPath)),
        }))
        .filter((group) => group.files.length > 1);

      if (category && category !== 'all') {
        groups = groups.filter(
          (group) => group.cat === category || group.files.some((file) => file.category === category)
        );
      }

      const total = groups.length;
      return Response.json({
        groups: groups.slice(offset, offset + limit),
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
        status: 'done',
        progress: {},
        source: 'database',
      });
    }
  } catch (err) {
    console.error('[GET /api/fm/duplicates] DB error:', err.message);
  }

  // Fallback to fm-cache
  const index = loadFileIndex();
  buildDerivedIndex(index);

  let groups = (index.duplicateGroups || [])
    .map((group) => ({
      ...group,
      files: group.files
        .filter((file) => within(file.path, rootPath))
        .map((file) => ({ ...file, alive: fs.existsSync(file.path) })),
    }))
    .filter((group) => group.files.length > 1);

  if (category && category !== 'all') {
    groups = groups.filter((group) => group.cat === category || group.files.some((file) => file.category === category));
  }

  const total = groups.length;
  return Response.json({
    groups: groups.slice(offset, offset + limit),
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
    status: index.status,
    progress: index.progress,
  });
}