// app/api/duplicates/groups/[hash]/route.js - Get single duplicate group
import { queryDb } from '../../../../../lib/db.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/duplicates/groups/:hash
 * 
 * Returns files in a specific duplicate group
 */
export async function GET(req, { params }) {
  try {
    const { hash } = params;

    if (!hash) {
      return Response.json({ error: 'hash required' }, { status: 400 });
    }

    // Get group info
    const group = await queryDb(
      `SELECT id, hash, file_count, waste_bytes, file_size, created_at, updated_at
       FROM duplicate_groups
       WHERE hash = ?`,
      [hash]
    );

    if (!group || group.length === 0) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get all files in group
    const files = await queryDb(
      `SELECT 
        path, name, dir, size, file_mtime, hash, ext, category, status,
        is_duplicate, duplicate_group_id
       FROM files
       WHERE duplicate_group_id = ?
       ORDER BY size DESC, file_mtime DESC`,
      [group[0].id]
    );

    return Response.json({
      group: group[0],
      files: files || []
    });
  } catch (err) {
    console.error('[GET /api/duplicates/groups/:hash] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
