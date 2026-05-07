/**
 * Database Operations - Common query helpers (async version)
 * Provides reusable functions for all database operations
 */

import { getDb, queryDb, queryDbOne, execDb, transactionDb, batchInsertDb } from './db.js';

/**
 * Query worker state
 */
export async function getWorkerState() {
  return queryDbOne('SELECT * FROM worker_state WHERE id = 1');
}

/**
 * Update worker state atomically
 */
export async function updateWorkerState(updates) {
  const now = Math.floor(Date.now() / 1000);
  const setClauses = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(', ');
  const values = Object.values(updates);
  
  return execDb(
    `UPDATE worker_state SET ${setClauses}, updated_at = ? WHERE id = 1`,
    [...values, now]
  );
}

/**
 * Check for scan conflicts (atomic)
 */
export async function checkScanConflict() {
  const state = await getWorkerState();
  if (!state.current_scan_id) {
    return { hasConflict: false };
  }
  
  // Get running scan info
  const scan = await queryDbOne(
    'SELECT * FROM scan_history WHERE scan_id = ?',
    [state.current_scan_id]
  );
  
  return {
    hasConflict: true,
    currentScan: scan,
    currentScanType: state.current_scan_type,
  };
}

/**
 * Atomically start a scan (with conflict checking)
 */
export async function atomicStartScan(scanId, scanType, rootPath, includeHidden) {
  return transactionDb(async () => {
    // Check if another scan is running
    const state = await getWorkerState();
    if (state && state.current_scan_id) {
      throw new Error('CONFLICT_SCAN_RUNNING');
    }
    
    // Insert scan history
    const now = Math.floor(Date.now() / 1000);
    const result = await execDb(
      `INSERT INTO scan_history 
        (scan_id, scan_type, root_path, include_hidden, started_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [scanId, scanType, rootPath, includeHidden ? 1 : 0, now, 'scanning', now]
    );
    
    // Update worker state
    await updateWorkerState({
      current_scan_id: scanId,
      current_scan_type: scanType,
      started_at: now,
      phase: 'starting',
      files_processed: 0,
      files_to_process: 0,
      current_directory: rootPath,
    });
    
    return { scanId, historyId: result.lastInsertRowid };
  });
}

/**
 * Mark scan as complete
 */
export async function markScanComplete(scanId, stats) {
  const now = Math.floor(Date.now() / 1000);
  return transactionDb(async () => {
    // Update scan history
    await execDb(
      `UPDATE scan_history 
       SET status = ?, completed_at = ?, duration_ms = ?, 
           files_found = ?, files_hashed = ?, files_changed = ?,
           duplicate_groups_count = ?, total_waste_bytes = ?, updated_at = ?
       WHERE scan_id = ?`,
      [
        'done',
        now,
        stats.durationMs || 0,
        stats.filesFound || 0,
        stats.filesHashed || 0,
        stats.filesChanged || 0,
        stats.duplicateGroupsCount || 0,
        stats.totalWasteBytes || 0,
        now,
        scanId,
      ]
    );
    
    // Clear worker state
    await updateWorkerState({
      current_scan_id: null,
      current_scan_type: null,
      phase: 'idle',
      files_processed: 0,
      files_to_process: 0,
      current_directory: null,
    });
  });
}

/**
 * Insert files in batch
 */
export async function insertFilesBatch(files) {
  if (!files || files.length === 0) return { inserted: 0 };
  
  // Add timestamps
  const now = Math.floor(Date.now() / 1000);
  const filesWithTimestamp = files.map((f) => ({
    ...f,
    created_at: f.created_at || now,
    updated_at: f.updated_at || now,
  }));
  
  return batchInsertDb('files', filesWithTimestamp);
}

/**
 * Update file hash and duplicate info
 */
export async function updateFileHash(path, hash, isDuplicate = false, duplicateGroupId = null) {
  const now = Math.floor(Date.now() / 1000);
  return execDb(
    `UPDATE files 
     SET hash = ?, is_duplicate = ?, duplicate_group_id = ?, last_hashed = ?, updated_at = ?
     WHERE path = ?`,
    [hash, isDuplicate ? 1 : 0, duplicateGroupId, now, now, path]
  );
}

/**
 * Create or update duplicate group
 */
export async function upsertDuplicateGroup(hash, fileCount, wasteBytes, fileSize) {
  const now = Math.floor(Date.now() / 1000);
  
  // Check if group exists
  const existing = await queryDbOne(
    'SELECT id FROM duplicate_groups WHERE hash = ?',
    [hash]
  );
  
  if (existing) {
    // Update existing group
    await execDb(
      `UPDATE duplicate_groups 
       SET file_count = ?, waste_bytes = ?, file_size = ?, updated_at = ?
       WHERE hash = ?`,
      [fileCount, wasteBytes, fileSize, now, hash]
    );
    return { groupId: existing.id, isNew: false };
  } else {
    // Insert new group
    const result = await execDb(
      `INSERT INTO duplicate_groups 
       (hash, file_count, waste_bytes, file_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hash, fileCount, wasteBytes, fileSize, now, now]
    );
    return { groupId: result.lastInsertRowid, isNew: true };
  }
}

/**
 * Get all duplicate files for UI
 */
export async function getDuplicateFiles(limit = 10000, offset = 0) {
  return queryDb(
    `SELECT f.* FROM files f
     WHERE f.is_duplicate = 1
     ORDER BY f.duplicate_group_id, f.size DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

/**
 * Get files in specific folder (for File Manager)
 */
export async function getFilesInFolder(folderPath, limit = 100, offset = 0) {
  return queryDb(
    `SELECT * FROM files
     WHERE dir = ? AND status = 'active'
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [folderPath, limit, offset]
  );
}

/**
 * Get duplicate group details
 */
export async function getDuplicateGroupFiles(groupId) {
  return queryDb(
    `SELECT f.* FROM files f
     WHERE f.duplicate_group_id = ? AND f.status = 'active'
     ORDER BY f.size DESC`,
    [groupId]
  );
}

/**
 * Update scan progress
 */
export async function updateScanProgress(phase, filesProcessed, filesToProcess, currentDir) {
  const now = Math.floor(Date.now() / 1000);
  return execDb(
    `UPDATE worker_state 
     SET phase = ?, files_processed = ?, files_to_process = ?, current_directory = ?, updated_at = ?
     WHERE id = 1`,
    [phase, filesProcessed, filesToProcess, currentDir, now]
  );
}

/**
 * Get scan history (latest first)
 */
export async function getScanHistory(limit = 50, offset = 0) {
  return queryDb(
    `SELECT * FROM scan_history
     ORDER BY started_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

/**
 * Get single scan by ID
 */
export async function getScan(scanId) {
  return queryDbOne(
    'SELECT * FROM scan_history WHERE scan_id = ?',
    [scanId]
  );
}

/**
 * Count total files with duplicates
 */
export async function getDuplicateStats() {
  const result = await queryDbOne(
    `SELECT 
       COUNT(DISTINCT duplicate_group_id) as groups,
       COUNT(*) as duplicate_files,
       SUM(waste_bytes) as total_waste
     FROM files WHERE is_duplicate = 1`
  );
  
  return {
    duplicateGroups: result?.groups || 0,
    duplicateFiles: result?.duplicate_files || 0,
    totalWaste: result?.total_waste || 0,
  };
}

/**
 * Mark file for deletion/keep
 */
export async function markFile(filePath, markType) {
  const now = Math.floor(Date.now() / 1000);
  
  return transactionDb(async () => {
    const file = await queryDbOne('SELECT id FROM files WHERE path = ?', [filePath]);
    if (!file) throw new Error('File not found');
    
    await execDb(
      `INSERT OR REPLACE INTO file_marks (file_id, mark_type, marked_at)
       VALUES (?, ?, ?)`,
      [file.id, markType, now]
    );
  });
}

/**
 * Get file marks
 */
export async function getFileMarks(markType = null) {
  if (markType) {
    return queryDb(
      `SELECT f.*, fm.mark_type FROM files f
       JOIN file_marks fm ON f.id = fm.file_id
       WHERE fm.mark_type = ?`,
      [markType]
    );
  } else {
    return queryDb(
      `SELECT f.*, fm.mark_type FROM files f
       JOIN file_marks fm ON f.id = fm.file_id`
    );
  }
}

export default {
  getWorkerState,
  updateWorkerState,
  checkScanConflict,
  atomicStartScan,
  markScanComplete,
  insertFilesBatch,
  updateFileHash,
  upsertDuplicateGroup,
  getDuplicateFiles,
  getFilesInFolder,
  getDuplicateGroupFiles,
  updateScanProgress,
  getScanHistory,
  getScan,
  getDuplicateStats,
  markFile,
  getFileMarks,
};
