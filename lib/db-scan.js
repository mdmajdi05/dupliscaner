/**
 * lib/db-scan.js — Database Scan Layer (ESM)
 *
 * Purpose: Bridge between scanner.py JSON events and SQLite database persistence.
 *
 * Features:
 * - Event processor for all scanner output formats
 * - Batch-write file records to database (transactions)
 * - Duplicate group management (creation and linking)
 * - Scan progress tracking in worker_state
 * - Error recovery and validation
 *
 * Usage:
 * import { createScanProcessor } from './db-scan.js';
 * const processor = await createScanProcessor(scanId, scanType);
 * await processor.processEvent(jsonObject);
 * await processor.flush();
 */

import { getDb, queryDb, queryDbOne, execDb, batchInsertDb } from './db.js';
import { updateWorkerState, updateScanProgress, updateFileHash, upsertDuplicateGroup, insertFilesBatch, markScanComplete } from './db-ops.js';

/**
 * ScanProcessor — Processes scanner.py events and writes to SQLite
 *
 * Buffers events for efficient batch writing:
 * - Files buffered until batch size reached or scan ends
 * - Duplicate groups written immediately
 * - Progress tracked in real-time
 */
class ScanProcessor {
  constructor(scanId, scanType) {
    this.scanId = scanId;
    this.scanType = scanType; // 'duplicates' | 'full'
    this.fileBuffer = [];
    this.duplicateBuffer = [];
    this.batchSize = 500;
    this.fileCount = 0;
    this.dupCount = 0;
    this.startTime = Date.now();
    this.isIncremental = false;
  }

  /**
   * Main event processor — routes events to handlers
   */
  async processEvent(event) {
    if (!event || typeof event !== 'object') return;

    const type = event.type;

    // Route by event type
    if (type === 'start') await this.handleStartEvent(event);
    else if (type === 'incremental_mode') await this.handleIncrementalMode(event);
    else if (type === 'scanning' || type === 'progress') await this.handleProgressEvent(event);
    else if (type === 'phase1_start' || type === 'phase1_complete' || type === 'phase2_start' || type === 'phase2_complete') await this.handlePhaseEvent(event);
    else if (type === 'file_hashed' || type === 'file_unchanged' || type === 'file_deleted' || type === 'file_added' || type === 'file_changed') await this.handleFileEvent(event);
    else if (type === 'file_record') await this.handleFileRecord(event);
    else if (type === 'dup') await this.handleDuplicateEvent(event);
    else if (type === 'done') await this.handleDoneEvent(event);
    else if (type === 'error' || type === 'warning') await this.handleErrorEvent(event);
    // Silently ignore unknown event types (hashing_start, target_info, phase3_start, etc.)
  }

  /**
   * Handle start event — initialize scan record
   */
  async handleStartEvent(event) {
    const { path, mode } = event;
    const scanType = mode || this.scanType;
    const now = Math.floor(Date.now() / 1000);

    // Update worker state to mark scan as running
    updateWorkerState({
      current_scan_id: this.scanId,
      current_scan_type: scanType,
      phase: 'initialization',
      files_processed: 0,
      started_at: now,
    });

    // Record in scan_history
    execDb(
      `INSERT INTO scan_history (scan_id, scan_type, root_path, started_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [this.scanId, scanType, path, now, 'scanning', now]
    );
  }

  /**
   * Handle incremental mode flag
   */
  async handleIncrementalMode(event) {
    this.isIncremental = true;
    const prevHashCount = event.previous_hashes_count || 0;
    console.log(`[ScanProcessor] Incremental mode: ${prevHashCount} previous hashes loaded`);
  }

  /**
   * Handle progress events
   */
  async handleProgressEvent(event) {
    const { done, total, n, phase, files_hashed, files_found, current_dir } = event;

    if (done !== undefined && total !== undefined) {
      updateWorkerState({
        files_processed: done,
        files_to_process: total,
      });
    } else if (phase !== undefined) {
      // Full mode progress
      const fileMetric = files_hashed || files_found || n || 0;
      updateWorkerState({
        phase: `phase${phase}`,
        files_processed: fileMetric,
        current_directory: current_dir || '',
      });
    }
  }

  /**
   * Handle phase markers
   */
  async handlePhaseEvent(event) {
    const { type } = event;

    if (type === 'phase1_start') {
      updateWorkerState({ phase: 'phase1_traversal' });
    } else if (type === 'phase1_complete') {
      const totalFiles = event.total_files || 0;
      updateWorkerState({
        phase: 'phase1_complete',
        files_to_process: totalFiles,
      });
    } else if (type === 'phase2_start') {
      updateWorkerState({
        phase: 'phase2_hashing',
      });
    } else if (type === 'phase2_complete') {
      updateWorkerState({ phase: 'phase2_complete' });
    }
  }

  /**
   * Handle individual file events (full mode)
   */
  async handleFileEvent(event) {
    const { path, hash, size, change_type } = event;

    if (!path) return;

    // Update file in database with hash and change type
    try {
      updateFileHash(path, hash, false, null);
    } catch (err) {
      console.error(`[ScanProcessor] Error updating file ${path}:`, err.message);
    }
  }

  /**
   * Handle file_record events (full mode completion)
   */
  async handleFileRecord(event) {
    const {
      path, name, folder, size, sizeFmt, ext, category, mtime, hash, change_type
    } = event;

    // Buffer file record
    this.fileBuffer.push({
      path,
      name: name || '',
      dir: folder || '',
      size: size || 0,
      file_mtime: mtime || 0,
      hash: hash || null,
      ext: ext || '',
      category: category || 'Others',
      is_duplicate: false,
      duplicate_group_id: null,
      change_type: change_type || 'file_added',
      last_scanned: Math.floor(Date.now() / 1000),
      status: 'indexed',
    });

    this.fileCount++;

    // Flush buffer if threshold reached
    if (this.fileBuffer.length >= this.batchSize) {
      await this.flushFileBuffer();
    }
  }

  /**
   * Handle duplicate event (duplicates mode)
   */
  async handleDuplicateEvent(event) {
    const {
      id, hash, cat, ext, size, waste, count, files
    } = event;

    if (!files || !Array.isArray(files)) return;

    this.dupCount++;

    // Create duplicate group - passing size as 4th arg
    try {
      const { groupId } = upsertDuplicateGroup(hash, files.length, waste || (size * (count - 1)), size);

      // Link files to group as duplicates
      for (const fileInfo of files) {
        execDb(
          `UPDATE files SET is_duplicate = 1, duplicate_group_id = ? WHERE path = ?`,
          [groupId, fileInfo.path]
        );
      }
    } catch (err) {
      console.error(`[ScanProcessor] Error handling duplicate group ${id}:`, err.message);
    }
  }

  /**
   * Handle done event — finalize scan
   */
  async handleDoneEvent(event) {
    const {
      total_dups, total_files, files_hashed, files_unchanged, files_deleted
    } = event;

    // Flush any remaining buffered files
    await this.flushFileBuffer();

    // Calculate duration
    const durationMs = Date.now() - this.startTime;

    // Calculate total waste from duplicate groups
    // Query the database for total waste
    let wasteBytes = 0;
    try {
      const result = queryDbOne(
        'SELECT SUM(waste_bytes) as total_waste FROM duplicate_groups'
      );
      wasteBytes = result?.total_waste || 0;
    } catch (err) {
      console.error('[ScanProcessor] Error getting waste stats:', err.message);
    }

    // Update worker state to mark complete - passing stats object
    markScanComplete(this.scanId, {
      filesFound: this.fileCount || total_files || 0,
      dupGroups: this.dupCount || total_dups || 0,
      filesHashed: files_hashed || 0,
      filesChanged: files_deleted || 0,
      totalWasteBytes: wasteBytes,
      durationMs: durationMs,
    });

    // Record final stats
    const durationSec = Math.round(durationMs / 1000);
    console.log(`[ScanProcessor] Scan ${this.scanId} completed:`);
    console.log(`  Files: ${this.fileCount} | Duplicates: ${this.dupCount}`);
    console.log(`  Duration: ${durationSec}s | Waste: ${wasteBytes} bytes`);

    if (files_hashed !== undefined) {
      console.log(`  Hashed: ${files_hashed} | Unchanged: ${files_unchanged} | Deleted: ${files_deleted}`);
    }
  }

  /**
   * Handle error/warning events
   */
  async handleErrorEvent(event) {
    const { type, msg } = event;
    console.error(`[ScanProcessor] Scanner ${type}:`, msg);

    // Log to database for debugging - using 'data' column instead of 'details'
    try {
      execDb(
        `INSERT INTO scan_events (scan_id, event_type, data) VALUES (?, ?, ?)`,
        [this.scanId, type, msg]
      );
    } catch (err) {
      console.error(`[ScanProcessor] Failed to log error to DB:`, err.message);
    }
  }

  /**
   * Flush buffered files to database (no nested transaction)
   */
  async flushFileBuffer() {
    if (this.fileBuffer.length === 0) return;

    try {
      // Insert all files in batch - no transaction wrapper to avoid nested transaction error
      const placeholders = this.fileBuffer.map(() =>
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).join(',');

      const now = Math.floor(Date.now() / 1000);
      const values = this.fileBuffer.flatMap(f => [
        f.path, f.name, f.dir, f.size, f.file_mtime, f.hash,
        f.ext, f.category, f.is_duplicate ? 1 : 0, f.duplicate_group_id,
        f.last_scanned, f.status, now, now
      ]);

      execDb(
        `INSERT OR REPLACE INTO files
         (path, name, dir, size, file_mtime, hash, ext, category,
          is_duplicate, duplicate_group_id, last_scanned, status, created_at, updated_at)
         VALUES ${placeholders}`,
        values
      );

      console.log(`[ScanProcessor] Flushed ${this.fileBuffer.length} files to database`);
      this.fileBuffer = [];
    } catch (err) {
      console.error(`[ScanProcessor] Error flushing file buffer:`, err.message);
      throw err;
    }
  }

  /**
   * Final flush before processor is destroyed
   */
  async flush() {
    await this.flushFileBuffer();
  }
}

/**
 * Factory function to create and process scanner output stream
 */
export async function createScanProcessor(scanId, scanType) {
  return new ScanProcessor(scanId, scanType);
}

/**
 * Stream JSON-line events from scanner and process them
 *
 * Usage:
 * import { createInterface } from 'readline';
 * const rl = createInterface({ input: scanProcess.stdout });
 * await processScannerStream(rl, processor);
 */
export async function processScannerStream(readlineInterface, processor) {
  return new Promise((resolve, reject) => {
    readlineInterface.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        await processor.processEvent(event);
      } catch (err) {
        console.error(`[ScanProcessor] Failed to parse event: ${line}`, err.message);
      }
    });

    readlineInterface.on('close', async () => {
      try {
        await processor.flush();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    readlineInterface.on('error', reject);
  });
}

export { ScanProcessor };