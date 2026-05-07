/**
 * SQLite Database Connection Manager
 * Uses sqlite3 npm package for reliable Node.js SQLite binding
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const dbDir = path.join(os.homedir(), 'AppData', 'Local', 'DupScan');
const dbPath = path.join(dbDir, 'dupscan.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

/**
 * Get or create database connection (singleton)
 */
export async function getDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const newDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Failed to open database:', err);
        reject(err);
        return;
      }
      
      // Enable foreign keys
      newDb.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db = newDb;
        console.log(`✅ Database connection established: ${dbPath}`);
        resolve(db);
      });
    });
  });
}

/**
 * Execute query that returns rows (read)
 */
export async function queryDb(sql, params = []) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Query error:', err, 'SQL:', sql);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Execute query that returns single row
 */
export async function queryDbOne(sql, params = []) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        console.error('❌ Query error:', err, 'SQL:', sql);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

/**
 * Execute write operation (insert, update, delete)
 */
export async function execDb(sql, params = []) {
  const database = await getDb();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) {
        console.error('❌ Exec error:', err, 'SQL:', sql);
        reject(err);
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

/**
 * Batch insert records (optimized for large inserts)
 */
export async function batchInsertDb(tableName, records) {
  if (!records || records.length === 0) {
    return { inserted: 0 };
  }

  const database = await getDb();
  return new Promise(async (resolve, reject) => {
    try {
      // Get column names from first record
      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(',');
      const sql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

      // Use transaction for batch insert
      database.serialize(() => {
        database.run('BEGIN TRANSACTION');
        
        let inserted = 0;
        let finished = 0;

        records.forEach((record) => {
          const values = columns.map((col) => record[col]);
          database.run(sql, values, function (err) {
            if (err) {
              database.run('ROLLBACK');
              reject(err);
            } else {
              inserted++;
              finished++;
              if (finished === records.length) {
                database.run('COMMIT', (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve({ inserted });
                  }
                });
              }
            }
          });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Transactional operation (BEGIN, execute callback, COMMIT/ROLLBACK)
 */
export async function transactionDb(callback) {
  const database = await getDb();
  
  return new Promise(async (resolve, reject) => {
    database.run('BEGIN TRANSACTION', async (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const result = await callback();
        database.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      } catch (err) {
        database.run('ROLLBACK', () => {
          reject(err);
        });
      }
    });
  });
}

/**
 * Get database statistics
 */
export async function getDbStats() {
  try {
    const [fileCount, dupGroups, scanCount] = await Promise.all([
      queryDbOne('SELECT COUNT(*) as count FROM files'),
      queryDbOne('SELECT COUNT(*) as count FROM duplicate_groups'),
      queryDbOne('SELECT COUNT(*) as count FROM scan_history'),
    ]);

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
export async function closeDb() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        db = null;
        resolve();
      }
    });
  });
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
