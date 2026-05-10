import { queryDb } from '../../../lib/db.js';
import { initializeDatabase } from '../../../lib/init-db.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/history
 * Returns scan history from SQLite database (SYNC - FAST!)
 */
export async function GET() {
  try {
    // Initialize database (sync now)
    initializeDatabase();

    // Get all scans ordered by started_at DESC
    const scans = queryDb(
      `SELECT * FROM scan_history
       WHERE scan_type = 'duplicates'
       ORDER BY started_at DESC
       LIMIT 50`
    );

    // Transform to match frontend expected format
    const summary = scans.map(scan => ({
      id: scan.scan_id,
      path: scan.root_path,
      mode: scan.scan_type,
      targetFile: '',
      startedAt: scan.started_at ? new Date(scan.started_at * 1000).toISOString() : null,
      completedAt: scan.completed_at ? new Date(scan.completed_at * 1000).toISOString() : null,
      stats: {
        sets: scan.duplicate_groups_count || 0,
        extra: 0,
        waste: scan.total_waste_bytes || 0,
        byCat: {},
      },
      dups: [],
      marked: {},
      deleted: [],
      dupCount: scan.duplicate_groups_count || 0,
    }));

    return Response.json(summary);
  } catch (err) {
    console.error('[GET /api/history] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}