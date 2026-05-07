/**
 * Migration System - Manages database schema versioning
 * Runs pending migrations on app startup
 */

import { getDb, queryDb, execDb } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get or create migrations tracking table
 */
async function ensureMigrationsTable() {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT NOT NULL UNIQUE,
      executed_at INTEGER NOT NULL
    );
  `);
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  await ensureMigrationsTable();
  const result = await queryDb(
    'SELECT migration_name FROM schema_migrations ORDER BY executed_at ASC'
  );
  return result.map((r) => r.migration_name);
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations() {
  const executed = await getExecutedMigrations();
  const migrationsDir = __dirname;
  
  // Find all migration files (001_*.js, 002_*.js, etc.)
  const files = fs.readdirSync(migrationsDir);
  const migrationFiles = files
    .filter((f) => /^\d{3}_.*\.js$/.test(f))
    .sort();

  const pending = [];
  for (const file of migrationFiles) {
    const name = file.replace('.js', '');
    if (!executed.includes(name)) {
      pending.push(name);
    }
  }
  
  return pending;
}

/**
 * Load and execute a migration
 */
async function executeMigration(migrationName) {
  try {
    const modulePath = path.join(__dirname, `${migrationName}.js`);
    const module = await import(`./${migrationName}.js`);
    
    if (!module.up) {
      throw new Error(`Migration ${migrationName} does not export 'up' function`);
    }

    console.log(`  ▶ Running migration: ${migrationName}`);
    
    // Run the migration
    await module.up();
    
    // Record in migrations table
    const db = await getDb();
    db.run(
      'INSERT INTO schema_migrations (migration_name, executed_at) VALUES (?, ?)',
      [migrationName, Math.floor(Date.now() / 1000)]
    );
    
    console.log(`  ✅ Completed: ${migrationName}`);
  } catch (err) {
    console.error(`  ❌ Migration failed: ${migrationName}`, err);
    throw err;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  try {
    await ensureMigrationsTable();
    
    const pending = await getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`🔄 Running ${pending.length} migration(s)...`);
    
    for (const name of pending) {
      await executeMigration(name);
    }
    
    console.log('✅ All migrations completed');
  } catch (err) {
    console.error('❌ Migration system error:', err);
    throw err;
  }
}

/**
 * Rollback a migration (for development/testing)
 */
export async function rollbackMigration(migrationName) {
  try {
    const modulePath = path.join(__dirname, `${migrationName}.js`);
    const module = await import(`./${migrationName}.js`);
    
    if (!module.down) {
      console.warn(`Migration ${migrationName} does not support rollback`);
      return;
    }

    console.log(`⏮ Rolling back: ${migrationName}`);
    await module.down();
    
    const db = await getDb();
    db.run(
      'DELETE FROM schema_migrations WHERE migration_name = ?',
      [migrationName]
    );
    
    console.log(`✅ Rolled back: ${migrationName}`);
  } catch (err) {
    console.error(`❌ Rollback failed: ${migrationName}`, err);
    throw err;
  }
}

export default {
  runMigrations,
  rollbackMigration,
  getExecutedMigrations,
  getPendingMigrations,
};
