/**
 * Database Initialization API Route
 * GET /api/db/init
 * 
 * Initializes the database on app startup.
 */

import { initializeDatabase } from '../../../../lib/init-db.js';
import { getDbStats } from '../../../../lib/db.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Get stats
    const stats = await getDbStats();
    
    return Response.json({
      status: 'success',
      message: 'Database initialized',
      stats,
    });
  } catch (err) {
    console.error('Database initialization failed:', err);
    return Response.json(
      {
        status: 'error',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
