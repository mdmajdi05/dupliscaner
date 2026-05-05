import fs from 'fs';
import path from 'path';
import { ROOT_PATH, buildDerivedIndex, loadFileIndex } from '../../../../lib/fm-cache.js';

export const dynamic = 'force-dynamic';

function normalize(value) {
  return process.platform === 'win32' ? String(value || '').toLowerCase() : String(value || '');
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
