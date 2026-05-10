import { queryDb, queryDbOne, execDb } from '../../../../lib/db.js';
import { initializeDatabase } from '../../../../lib/init-db.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/history/[id]
 * Returns single scan with duplicate groups from SQLite (SYNC - FAST!)
 */
export async function GET(_, { params }) {
  try {
    initializeDatabase();

    // Get scan from history
    const scan = queryDbOne(
      'SELECT * FROM scan_history WHERE scan_id = ?',
      [params.id]
    );

    if (!scan) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Get duplicate groups for this scan (via files) - FAST with indexes
    const duplicateGroups = queryDb(
      `SELECT dg.*, f.path, f.name, f.dir, f.size, f.file_mtime, f.ext, f.category
       FROM duplicate_groups dg
       JOIN files f ON f.duplicate_group_id = dg.id
       WHERE f.is_duplicate = 1
       ORDER BY dg.waste_bytes DESC
       LIMIT 5000`
    );

    // Transform to match frontend format
    const dups = [];
    const groupMap = new Map();

    for (const row of duplicateGroups) {
      if (!groupMap.has(row.id)) {
        groupMap.set(row.id, {
          id: String(row.id),
          hash: row.hash,
          count: row.file_count,
          size: row.file_size,
          waste: row.waste_bytes,
          cat: row.category || 'Others',
          ext: row.ext || '',
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
      });
    }

    dups.push(...groupMap.values());

    return Response.json({
      id: scan.scan_id,
      path: scan.root_path,
      mode: scan.scan_type,
      targetFile: '',
      startedAt: scan.started_at ? new Date(scan.started_at * 1000).toISOString() : null,
      completedAt: scan.completed_at ? new Date(scan.completed_at * 1000).toISOString() : null,
      stats: {
        sets: scan.duplicate_groups_count || 0,
        extra: dups.reduce((a, d) => a + (d.count - 1), 0),
        waste: scan.total_waste_bytes || 0,
        byCat: {},
      },
      dups,
      marked: {},
      deleted: [],
    });
  } catch (err) {
    console.error('[GET /api/history/[id]] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/history/[id]
 */
export async function DELETE(_, { params }) {
  try {
    initializeDatabase();
    execDb('DELETE FROM scan_history WHERE scan_id = ?', [params.id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/history/[id]] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/history/[id]
 */
export async function PATCH(req, { params }) {
  try {
    initializeDatabase();
    const patch = await req.json();
    const scan = queryDbOne(
      'SELECT * FROM scan_history WHERE scan_id = ?',
      [params.id]
    );
    if (!scan) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({
      id: scan.scan_id,
      path: scan.root_path,
      mode: scan.scan_type,
      ...patch,
    });
  } catch (err) {
    console.error('[PATCH /api/history/[id]] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}