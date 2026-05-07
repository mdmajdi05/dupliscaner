/**
 * Database Initialization API Route
 * Runs automatically on app startup via import in layout.js
 * 
 * This route ensures the database is initialized before any other
 * API routes try to use it.
 */

import { initializeDatabase } from '../../../lib/init-db.js';
import { getDbStats } from '../../../lib/db.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/_init
 * Initialize database if not already initialized
 */
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
