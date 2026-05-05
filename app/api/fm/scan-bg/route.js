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

export const dynamic = 'force-dynamic';

const STATE = global.__FM_SCAN || {
  worker: null,
  saveTimer: null,
  workingIndex: null,
};
global.__FM_SCAN = STATE;

function scheduleSave(delay = 800) {
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
  STATE.worker = null;
}

function startScan(rootPath = ROOT_PATH, includeHidden = false) {
  stopWorker();

  const now = new Date().toISOString();
  STATE.workingIndex = loadFileIndex();
  STATE.workingIndex.rootPath = rootPath;
  STATE.workingIndex.includeHidden = includeHidden;
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

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const workerPath = path.resolve(__dirname, '../../../../lib/scanner-worker.js');
  const worker = new Worker(workerPath, { workerData: { rootPath, includeHidden } });
  STATE.worker = worker;

  worker.on('message', (msg) => {
    if (!STATE.workingIndex) STATE.workingIndex = loadFileIndex();

    if (msg.type === 'upsert') {
      for (const file of msg.files || []) {
        STATE.workingIndex.files[file.path] = file;
      }
      scheduleSave();
      return;
    }

    if (msg.type === 'remove') {
      for (const filePath of msg.paths || []) {
        delete STATE.workingIndex.files[filePath];
      }
      scheduleSave();
      return;
    }

    if (msg.type === 'progress') {
      STATE.workingIndex.status = msg.status || 'scanning';
      STATE.workingIndex.progress = {
        ...STATE.workingIndex.progress,
        ...(msg.progress || {}),
        updatedAt: new Date().toISOString(),
      };
      scheduleSave();
      return;
    }

    if (msg.type === 'complete' || msg.type === 'stopped') {
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
    const index = startScan(rootPath, includeHidden);
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

  const index = startScan(body.path || ROOT_PATH, Boolean(body.includeHidden));
  return Response.json({ started: true, rootPath: index.rootPath, includeHidden: index.includeHidden });
}
