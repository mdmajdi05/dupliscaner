/**
 * SQLite Database Connection Manager
 * Uses better-sqlite3 for synchronous, reliable Node.js SQLite binding
 * Wrapped in async functions for backwards compatibility with existing code
 */
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Cross-platform database directory
const dbDir = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'DupScan')
  : path.join(os.homedir(), '.local', 'share', 'DupScan');

const dbPath = path.join(dbDir, 'dupscan.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

/**
 * Get or create database connection (singleton)
 */
export function getDb() {
  if (db) return db;

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log(`✅ Database connection established: ${dbPath}`);
  return db;
}

/**
 * Execute query that returns rows (read)
 */
export function queryDb(sql, params = []) {
  const database = getDb();
  try {
    const stmt = database.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    console.error('❌ Query error:', err, 'SQL:', sql);
    throw err;
  }
}

/**
 * Execute query that returns single row
 */
export function queryDbOne(sql, params = []) {
  const database = getDb();
  try {
    const stmt = database.prepare(sql);
    return stmt.get(...params) || null;
  } catch (err) {
    console.error('❌ Query error:', err, 'SQL:', sql);
    throw err;
  }
}

/**
 * Execute write operation (insert, update, delete)
 */
export function execDb(sql, params = []) {
  const database = getDb();
  try {
    const stmt = database.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastID: result.lastInsertRowid,
      changes: result.changes,
    };
  } catch (err) {
    console.error('❌ Exec error:', err, 'SQL:', sql);
    throw err;
  }
}

/**
 * Batch insert records (optimized for large inserts)
 */
export function batchInsertDb(tableName, records) {
  if (!records || records.length === 0) {
    return { inserted: 0 };
  }

  const database = getDb();
  try {
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

    const insertMany = database.transaction((items) => {
      const stmt = database.prepare(sql);
      for (const record of items) {
        const values = columns.map((col) => record[col]);
        stmt.run(...values);
      }
    });

    insertMany(records);
    return { inserted: records.length };
  } catch (err) {
    console.error('❌ Batch insert error:', err);
    throw err;
  }
}

/**
 * Transactional operation using better-sqlite3's transaction
 */
export function transactionDb(callback) {
  const database = getDb();
  try {
    const transaction = database.transaction(callback);
    return transaction();
  } catch (err) {
    console.error('❌ Transaction error:', err);
    throw err;
  }
}

/**
 * Get database statistics
 */
export function getDbStats() {
  try {
    const fileCount = queryDbOne('SELECT COUNT(*) as count FROM files');
    const dupGroups = queryDbOne('SELECT COUNT(*) as count FROM duplicate_groups');
    const scanCount = queryDbOne('SELECT COUNT(*) as count FROM scan_history');

    return {
      files: fileCount?.count || 0,
      duplicateGroups: dupGroups?.count || 0,
      scans: scanCount?.count || 0,
      path: dbPath,
      size: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    };
  } catch (err) {
    console.error('Error getting DB stats:', err);
    return {
      files: 0,
      duplicateGroups: 0,
      scans: 0,
      path: dbPath,
      size: 0,
    };
  }
}

/**
 * Close database connection (for cleanup)
 */
export function closeDb() {
  if (!db) return;
  try {
    db.close();
    db = null;
    console.log('✅ Database connection closed');
  } catch (err) {
    console.error('Error closing database:', err);
    throw err;
  }
}

export default {
  getDb,
  queryDb,
  queryDbOne,
  execDb,
  batchInsertDb,
  transactionDb,
  getDbStats,
  closeDb,
};