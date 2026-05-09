// app/api/duplicates/groups/route.js - List duplicate groups
import { queryDb, transactionDb } from '../../../../lib/db.js';
import { initializeDatabase } from '../../../../lib/init-db.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/duplicates/groups
 * 
 * Returns all duplicate groups with file details
 * 
 * Query params:
 *  - limit: max groups to return (default: 100)
 *  - offset: pagination offset (default: 0)
 *  - sort: by waste_bytes|file_count|created_at (default: waste_bytes)
 *  - dir: asc|desc (default: desc)
 */
export async function GET(req) {
  try {
    // Ensure database is initialized
    await initializeDatabase();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
    const offset = Number(searchParams.get('offset') || 0);
    const sort = searchParams.get('sort') || 'waste_bytes';
    const dir = searchParams.get('dir') || 'desc';

    // Validate sort column
    const validSorts = ['waste_bytes', 'file_count', 'created_at'];
    if (!validSorts.includes(sort)) {
      return Response.json({ error: 'Invalid sort column' }, { status: 400 });
    }

    // Get all duplicate groups ordered by waste
    const groups = await queryDb(
      `SELECT 
        id, hash, file_count, waste_bytes, file_size, created_at, updated_at
       FROM duplicate_groups
       ORDER BY ${sort} ${dir === 'asc' ? 'ASC' : 'DESC'}
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Get total count
    const countResult = await queryDb('SELECT COUNT(*) as total FROM duplicate_groups');
    const total = countResult[0]?.total || 0;

    // Get file details for each group
    const groupsWithFiles = await Promise.all(
      groups.map(async (group) => {
        const files = await queryDb(
          `SELECT 
            path, name, dir, size, file_mtime, hash, ext, category, status,
            is_duplicate, duplicate_group_id
           FROM files
           WHERE duplicate_group_id = ?
           ORDER BY size DESC, file_mtime DESC`,
          [group.id]
        );

        return {
          ...group,
          files: files || []
        };
      })
    );

    return Response.json({
      groups: groupsWithFiles,
      pagination: {
        total,
        limit,
        offset,
        returned: groupsWithFiles.length
      }
    });
  } catch (err) {
    console.error('[GET /api/duplicates/groups] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
