// app/api/fm/scan-bg/route.js - Cache-first C drive scanner controller
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROOT_PATH,
  buildDerivedIndex,
  getFolderList,
  loadFileIndex,
  mutateFileIndex,
  saveFileIndex,
} from '../../../../lib/fm-cache.js';
import { createScanProcessor } from '../../../../lib/db-scan.js';
import { initializeDatabase } from '../../../../lib/init-db.js';
import { atomicStartScan, checkScanConflict } from '../../../../lib/db-ops.js';

export const dynamic = 'force-dynamic';

const STATE = global.__FM_SCAN || {
  worker: null,
  saveTimer: null,
  workingIndex: null,
  processor: null,
};
global.__FM_SCAN = STATE;

function scheduleSave(delay = 150) {
  clearTimeout(STATE.saveTimer);
  STATE.saveTimer = setTimeout(() => {
    if (!STATE.workingIndex) return;
    buildDerivedIndex(STATE.workingIndex);
    saveFileIndex(STATE.workingIndex);
  }, delay);
}

function stopWorker() {
  if (!STATE.worker) return;
  try { STATE.worker.postMessage({ type: 'stop' }); } catch {}
  try { STATE.worker.terminate(); } catch {}

  // Flush remaining buffered files before stopping
  if (STATE.processor) {
    STATE.processor.flush()
      .then(() => console.log('[fm/scan-bg] Flushed on stop'))
      .catch(err => console.error('[fm/scan-bg] Flush error on stop:', err.message));
  }

  STATE.worker = null;
  // Keep processor for a moment then clear after flush
  setTimeout(() => { STATE.processor = null; }, 1000);
}

async function startScan(rootPath = ROOT_PATH, includeHidden = false, mode = 'manual') {
  stopWorker();

  // Check for conflict using atomicStartScan
  const scanId = `fm_${Date.now()}`;
  try {
    atomicStartScan(scanId, 'full', rootPath, includeHidden);
  } catch (err) {
    if (err.message === 'CONFLICT_SCAN_RUNNING') {
      throw new Error('Another scan is already running');
    }
    throw err;
  }

  const now = new Date().toISOString();
  STATE.workingIndex = loadFileIndex();
  STATE.workingIndex.rootPath = rootPath;
  STATE.workingIndex.includeHidden = includeHidden;
  STATE.workingIndex.scanMode = mode;
  STATE.workingIndex.status = 'scanning';
  STATE.workingIndex.progress = {
    ...STATE.workingIndex.progress,
    phase: 'starting',
    scanned: 0,
    indexed: 0,
    skipped: 0,
    removed: 0,
    hashed: 0,
    candidates: 0,
    groups: STATE.workingIndex.duplicateGroups?.length || 0,
    currentDir: rootPath,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
  saveFileIndex(STATE.workingIndex);

  // Create ScanProcessor for database persistence
  STATE.processor = await createScanProcessor(scanId, 'full');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const workerPath = path.resolve(__dirname, '../../../../lib/scanner-worker.js');
  const worker = new Worker(workerPath, { workerData: { rootPath, includeHidden } });
  STATE.worker = worker;

  worker.on('message', (msg) => {
    console.log(`[fm/scan-bg] Worker message type: ${msg?.type}`);
    if (!STATE.workingIndex) STATE.workingIndex = loadFileIndex();

    if (msg.type === 'upsert') {
      for (const file of msg.files || []) {
        STATE.workingIndex.files[file.path] = file;
        // Also send to processor for database persistence
        if (STATE.processor) {
          STATE.processor.processEvent({
            type: 'file_record',
            path: file.path,
            name: file.name || path.basename(file.path),
            folder: file.folder || path.dirname(file.path),
            size: file.size,
            mtime: Math.floor((file.modified || Date.now()) / 1000),
            hash: file.hash,
            ext: file.ext,
            category: file.category,
          }).catch(err => console.error('[fm/scan-bg] processor error:', err.message));
        }
      }
      scheduleSave(60);
      return;
    }

    if (msg.type === 'remove') {
      for (const filePath of msg.paths || []) {
        delete STATE.workingIndex.files[filePath];
      }
      scheduleSave(60);
      return;
    }

    if (msg.type === 'progress') {
      STATE.workingIndex.status = msg.status || 'scanning';
      STATE.workingIndex.progress = {
        ...STATE.workingIndex.progress,
        ...(msg.progress || {}),
        updatedAt: new Date().toISOString(),
      };
      // Send progress event to processor
      if (STATE.processor) {
        STATE.processor.processEvent({
          type: 'progress',
          done: msg.progress?.scanned || 0,
          total: msg.progress?.indexed || 0,
          phase: msg.progress?.phase,
          current_dir: msg.progress?.currentDir,
        }).catch(err => console.error('[fm/scan-bg] processor error:', err.message));
      }
      scheduleSave(120);
      return;
    }

    if (msg.type === 'complete' || msg.type === 'stopped') {
      console.log(`[fm/scan-bg] Worker finished with type=${msg.type}, progress=${JSON.stringify(msg.progress || {})}`);
      STATE.workingIndex.status = msg.status || (msg.type === 'complete' ? 'done' : 'stopped');
      STATE.workingIndex.rootPath = msg.rootPath || rootPath;
      STATE.workingIndex.includeHidden = Boolean(msg.includeHidden);
      STATE.workingIndex.progress = {
        ...STATE.workingIndex.progress,
        ...(msg.progress || {}),
        updatedAt: new Date().toISOString(),
      };
      buildDerivedIndex(STATE.workingIndex);
      STATE.workingIndex.progress.groups = STATE.workingIndex.duplicateGroups.length;
      saveFileIndex(STATE.workingIndex);

      // Flush processor to database
      if (STATE.processor) {
        console.log(`[fm/scan-bg] Flushing processor with ${STATE.processor.fileBuffer?.length || 0} files buffered`);
        STATE.processor.flush()
          .then(() => console.log('[fm/scan-bg] Scan flushed to database'))
          .catch(err => console.error('[fm/scan-bg] Flush error:', err.message));
      }

      STATE.worker = null;
      return;
    }

    if (msg.type === 'error') {
      STATE.workingIndex.status = 'error';
      STATE.workingIndex.progress = {
        ...STATE.workingIndex.progress,
        phase: 'error',
        error: msg.error,
        updatedAt: new Date().toISOString(),
      };
      saveFileIndex(STATE.workingIndex);

      // Send error to processor
      if (STATE.processor) {
        STATE.processor.flush()
          .catch(err => console.error('[fm/scan-bg] Flush error:', err.message));
      }

      STATE.worker = null;
    }
  });

  worker.on('error', (err) => {
    mutateFileIndex((index) => {
      index.status = 'error';
      index.progress = { ...index.progress, phase: 'error', error: err.message, updatedAt: new Date().toISOString() };
      return index;
    });
    STATE.worker = null;
  });

  worker.on('exit', () => {
    if (STATE.worker === worker) STATE.worker = null;
  });

  return STATE.workingIndex;
}

function progressPayload() {
  const index = loadFileIndex();
  return {
    rootPath: index.rootPath || ROOT_PATH,
    includeHidden: Boolean(index.includeHidden),
    scanMode: index.scanMode || 'manual',
    status: STATE.worker ? 'scanning' : index.status,
    progress: index.progress || {},
    totals: {
      files: Object.keys(index.files || {}).length,
      folders: Object.keys(index.folders || {}).length,
      duplicateGroups: index.duplicateGroups?.length || 0,
    },
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'progress';
  const rootPath = searchParams.get('path') || ROOT_PATH;
  const includeHidden = searchParams.get('hidden') === '1';

  if (action === 'start' || action === 'auto') {
    // Check conflict first
    const conflict = checkScanConflict();
    if (conflict.hasConflict) {
      return Response.json({
        error: 'Another scan is already running',
        conflict: true,
        currentScan: conflict.currentScan,
      }, { status: 409 });
    }

    const index = await startScan(rootPath, includeHidden, searchParams.get('mode') || 'manual');
    return Response.json({ started: true, rootPath: index.rootPath, includeHidden });
  }

  if (action === 'stop') {
    stopWorker();
    const index = mutateFileIndex((idx) => {
      idx.status = 'stopped';
      idx.progress = { ...idx.progress, phase: 'stopped', updatedAt: new Date().toISOString() };
      return idx;
    });
    return Response.json({ stopped: true, status: index.status });
  }

  if (action === 'progress') {
    return Response.json(progressPayload());
  }

  if (action === 'list-folders') {
    const index = loadFileIndex();
    const folders = getFolderList(index, {
      rootPath: index.rootPath || ROOT_PATH,
      sort: searchParams.get('sort') || 'duplicates',
      dir: searchParams.get('dir') || 'desc',
      limit: Number(searchParams.get('limit') || 20),
    }).items;
    return Response.json({
      rootPath: index.rootPath || ROOT_PATH,
      scanning: Boolean(STATE.worker),
      folders: [
        {
          path: index.rootPath || ROOT_PATH,
          count: Object.keys(index.files || {}).length,
          scanning: Boolean(STATE.worker),
        },
        ...folders.map((folder) => ({
          path: folder.path,
          count: folder.counts?.all || 0,
          duplicates: folder.counts?.duplicates || 0,
          counts: folder.counts,
          scanning: false,
        })),
      ],
    });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(req) {
  // Ensure database is initialized
  await initializeDatabase();

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'start';

  if (action === 'stop') {
    stopWorker();
    const index = mutateFileIndex((idx) => {
      idx.status = 'stopped';
      idx.progress = { ...idx.progress, phase: 'stopped', updatedAt: new Date().toISOString() };
      return idx;
    });
    return Response.json({ stopped: true, status: index.status });
  }

  // Check conflict before starting
  const conflict = checkScanConflict();
  if (conflict.hasConflict) {
    return Response.json({
      error: 'Another scan is already running',
      conflict: true,
      currentScan: conflict.currentScan,
    }, { status: 409 });
  }

  const index = await startScan(body.path || ROOT_PATH, Boolean(body.includeHidden), body.mode || 'manual');
  return Response.json({ started: true, rootPath: index.rootPath, includeHidden: index.includeHidden });
}