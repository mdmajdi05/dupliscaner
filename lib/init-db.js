/**
 * Database Initialization - Schema Setup & Migration Runner
 * Runs on app startup to ensure all tables exist
 */

import { getDb, execDb } from './db.js';
import { runMigrations } from './migrations/index.js';

/**
 * Create all tables
 */
async function createTables() {
  try {
    // Files table - unified for both DupScan and File Manager
    await execDb(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        dir TEXT NOT NULL,
        ext TEXT,
        
        size INTEGER NOT NULL,
        hash TEXT,
        is_duplicate BOOLEAN DEFAULT 0,
        duplicate_group_id INTEGER,
        
        file_mtime INTEGER,
        file_ctime INTEGER,
        
        last_scanned INTEGER,
        last_hashed INTEGER,
        status TEXT DEFAULT 'active',
        
        is_hidden BOOLEAN DEFAULT 0,
        category TEXT,
        
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        
        FOREIGN KEY (duplicate_group_id) REFERENCES duplicate_groups(id)
      );
    `);
    
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_directory ON files(dir);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_is_duplicate ON files(is_duplicate);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_duplicate_group ON files(duplicate_group_id);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_dir_status ON files(dir, status);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_dir_status_category ON files(dir, status, category);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);`);

    // Duplicate groups table
    await execDb(`
      CREATE TABLE IF NOT EXISTS duplicate_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        file_count INTEGER NOT NULL,
        waste_bytes INTEGER,
        file_size INTEGER,
        is_priority BOOLEAN DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    
    await execDb(`CREATE INDEX IF NOT EXISTS idx_dup_groups_hash ON duplicate_groups(hash);`);

    // Scan history table
    await execDb(`
      CREATE TABLE IF NOT EXISTS scan_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL UNIQUE,
        scan_type TEXT NOT NULL,
        root_path TEXT NOT NULL,
        include_hidden BOOLEAN DEFAULT 0,
        
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        
        status TEXT NOT NULL,
        error_msg TEXT,
        
        files_found INTEGER,
        files_hashed INTEGER,
        files_changed INTEGER,
        duplicate_groups_count INTEGER,
        total_waste_bytes INTEGER,
        
        is_auto_scan BOOLEAN DEFAULT 0,
        is_incremental BOOLEAN DEFAULT 0,
        
        created_at INTEGER NOT NULL
      );
    `);
    
    await execDb(`CREATE INDEX IF NOT EXISTS idx_scan_history_type ON scan_history(scan_type);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_scan_history_started ON scan_history(started_at);`);

    // Worker state table (singleton)
    await execDb(`
      CREATE TABLE IF NOT EXISTS worker_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_scan_id TEXT,
        current_scan_type TEXT,
        started_at INTEGER,
        
        phase TEXT,
        files_processed INTEGER DEFAULT 0,
        files_to_process INTEGER DEFAULT 0,
        current_directory TEXT,
        
        updated_at INTEGER NOT NULL
      );
    `);
    
    await execDb(`CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_state_singleton ON worker_state(id);`);

    // Initialize worker_state singleton
    const timestamp = Math.floor(Date.now() / 1000);
    await execDb(
      `INSERT OR IGNORE INTO worker_state (id, updated_at) VALUES (?, ?)`,
      [1, timestamp]
    );

    // File marks table
    await execDb(`
      CREATE TABLE IF NOT EXISTS file_marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL UNIQUE,
        mark_type TEXT NOT NULL,
        marked_at INTEGER NOT NULL,
        marked_by TEXT DEFAULT 'user',
        
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );
    `);
    
    await execDb(`CREATE INDEX IF NOT EXISTS idx_file_marks_type ON file_marks(mark_type);`);

    // Scan events table (for audit trail and real-time streaming)
    await execDb(`
      CREATE TABLE IF NOT EXISTS scan_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL
      );
    `);
    
    await execDb(`CREATE INDEX IF NOT EXISTS idx_scan_events_scan_id ON scan_events(scan_id);`);
    await execDb(`CREATE INDEX IF NOT EXISTS idx_scan_events_type ON scan_events(event_type);`);

    // Settings table
    await execDb(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    console.log('✅ All database tables created successfully');
    return true;
  } catch (err) {
    console.error('❌ Error creating tables:', err);
    throw err;
  }
}

/**
 * Initialize database - runs on app startup
 */
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Create all tables if they don't exist
    await createTables();
    
    // Run migrations
    await runMigrations();
    
    console.log('✅ Database initialized successfully');
    return true;
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    throw err;
  }
}

/**
 * Reset database (for testing)
 */
export async function resetDatabase() {
  try {
    await execDb(`DROP TABLE IF EXISTS file_marks;`);
    await execDb(`DROP TABLE IF EXISTS scan_events;`);
    await execDb(`DROP TABLE IF EXISTS worker_state;`);
    await execDb(`DROP TABLE IF EXISTS scan_history;`);
    await execDb(`DROP TABLE IF EXISTS duplicate_groups;`);
    await execDb(`DROP TABLE IF EXISTS files;`);
    await execDb(`DROP TABLE IF EXISTS settings;`);
    await execDb(`DROP TABLE IF EXISTS schema_migrations;`);
    console.log('✅ Database reset complete');
    await createTables();
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    throw err;
  }
}

export default {
  initializeDatabase,
  resetDatabase,
};
