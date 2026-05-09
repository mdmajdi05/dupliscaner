import { spawn } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';
import os from 'os';
import { S, resetState, push } from '../../../../lib/state.js';
import { addScan } from '../../../../lib/history.js';
import { createScanProcessor, processScannerStream } from '../../../../lib/db-scan.js';
import { getWorkerState } from '../../../../lib/db-ops.js';
import { initializeDatabase } from '../../../../lib/init-db.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await initializeDatabase();

    const { scanPath, includeHidden, mode, targetFile } = await req.json();
    if (!scanPath) return Response.json({ error: 'scanPath required' }, { status: 400 });

    // Check for running scan - conflict detection
    const workerState = getWorkerState();
    if (workerState && workerState.current_scan_id && S.status === 'scanning') {
      // Return conflict info to frontend
      return Response.json({
        status: 'conflict',
        currentScan: {
          type: workerState.current_scan_type || 'duplicates',
          startedAt: workerState.started_at,
          path: workerState.current_directory || S.scanPath,
        }
      }, { status: 409 });
    }

    // kill existing
    if (S.proc) { try { S.proc.kill('SIGTERM'); } catch {} }
    resetState();

    const id = `s_${Date.now()}`;
    S.scanId = id; S.scanPath = scanPath; S.startedAt = new Date().toISOString();
    S.status = 'scanning'; S.mode = mode || 'scan'; S.targetFile = targetFile || '';

    // Use AppData path for reports
    const appDataDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const reportsDir = path.join(appDataDir, 'DupScan', 'reports');
    const reportPath = path.join(reportsDir, `report_${id}.txt`);
    S.reportPath = reportPath;

    const py = process.platform === 'win32' ? 'python' : 'python3';
    const script = path.join(process.cwd(), 'scanner.py');

    const args = [script, '--path', scanPath, '--report', reportPath, '--mode', 'duplicates'];
    if (includeHidden) args.push('--hidden');
    if (mode === 'single' && targetFile) args.push('--file', targetFile);

    const proc = spawn(py, args, { stdio: ['ignore','pipe','pipe'] });
    S.proc = proc;

    // Create ScanProcessor for database persistence
    const processor = await createScanProcessor(id, 'duplicates');

    // Create readline interface for JSON-line events
    const rl = createInterface({
      input: proc.stdout,
      crlfDelay: Infinity,
    });

    // Process events - route to processor AND maintain legacy state
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        
        // Send to processor for database persistence
        await processor.processEvent(event);
        
        // Also maintain legacy in-memory state for SSE
        if (event.type === 'dup') S.dups.push(event);
        else if (event.type === 'scanning') { S.progress.stage='Scanning files…'; S.progress.n=event.n; S.progress.dir=event.dir; }
        else if (event.type === 'phase2') { S.progress.stage='Comparing files…'; }
        else if (event.type === 'hashing') { S.progress.stage='Hashing files…'; S.progress.total=event.candidates; }
        else if (event.type === 'progress') { S.progress.done=event.done; S.progress.total=event.total; }
        else if (event.type === 'stopped') { S.status='stopped'; }
        else if (event.type === 'error') { S.status='error'; S.progress.stage=event.msg; }
        push(event);
      } catch (err) {
        console.error(`[scan/start] Event processing error:`, err.message);
      }
    });

    rl.on('close', async () => {
      try {
        await processor.flush();
        console.log(`[scan/start] Scan ${id} successfully flushed to database`);
        // Save to history.json for UI sidebar
        persistHistory(id, reportPath);
      } catch (err) {
        console.error(`[scan/start] Flush error:`, err.message);
      }
    });

    rl.on('error', (err) => {
      console.error(`[scan/start] Readline error:`, err.message);
    });

    proc.stderr.on('data', d => console.error('[scan/start] py:', d.toString().trim()));
    
    proc.on('error', err => {
      S.status = 'error'; S.progress.stage = err.message;
      push({ type:'error', msg: err.message }); 
      S.proc = null;
    });

    proc.on('close', code => {
      if (S.proc === proc) S.proc = null;
    });

    return Response.json({ id, scanPath, startedAt: S.startedAt });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

function persistHistory(id, reportPath) {
  try {
    const totalWaste = S.dups.reduce((a,d) => a + (d.waste||0), 0);
    const totalExtra = S.dups.reduce((a,d) => a + (d.count-1), 0);
    const byCat = {};
    for (const d of S.dups) {
      if (!byCat[d.cat]) byCat[d.cat] = { groups:0, waste:0 };
      byCat[d.cat].groups++; byCat[d.cat].waste += d.waste||0;
    }
    addScan({
      id, path: S.scanPath, mode: S.mode, targetFile: S.targetFile,
      startedAt: S.startedAt, completedAt: new Date().toISOString(),
      stats: { sets: S.dups.length, extra: totalExtra, waste: totalWaste, byCat },
      dups: S.dups, reportPath,
      marked: {}, deleted: [],
    });
  } catch (e) { console.error('persist err', e); }
}
