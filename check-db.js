import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// Cross-platform database path
const dbDir = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'DupScan')
  : path.join(os.homedir(), '.local', 'share', 'DupScan');

const dbPath = path.join(dbDir, 'dupscan.db');

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const now = Math.floor(Date.now() / 1000);

try {
  const result = db.prepare(
    "INSERT INTO duplicate_groups (hash, file_count, waste_bytes, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(["testhash123", 2, 100, 50, now, now]);

  console.log("Inserted, lastID =", result.lastInsertRowid);

  const rows = db.prepare("SELECT * FROM duplicate_groups").all();
  console.log("Rows:", rows);
} catch (err) {
  console.log("Error:", err.message);
}

db.close();