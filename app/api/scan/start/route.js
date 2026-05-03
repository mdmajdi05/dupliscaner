import { spawn } from 'child_process';
import path from 'path';
import { S, resetState, push } from '../../../../lib/state.js';
import { addScan } from '../../../../lib/history.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { scanPath, includeHidden, mode, targetFile } = await req.json();
    if (!scanPath) return Response.json({ error: 'scanPath required' }, { status: 400 });

    // kill existing
    if (S.proc) { try { S.proc.kill('SIGTERM'); } catch {} }
    resetState();

    const id = `s_${Date.now()}`;
    S.scanId = id; S.scanPath = scanPath; S.startedAt = new Date().toISOString();
    S.status = 'scanning'; S.mode = mode || 'scan'; S.targetFile = targetFile || '';

    const reportPath = path.join(process.cwd(), 'data', `report_${id}.txt`);
    S.reportPath = reportPath;

    const py = process.platform === 'win32' ? 'python' : 'python3';
    const script = path.join(process.cwd(), 'scanner.py');

    const args = [script, '--path', scanPath, '--report', reportPath];
    if (includeHidden) args.push('--hidden');
    if (mode === 'single' && targetFile) args.push('--file', targetFile);

    const proc = spawn(py, args, { stdio: ['ignore','pipe','pipe'] });
    S.proc = proc;

    let buf = '';
    proc.stdout.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const ev = JSON.parse(t);
          // update state
          if (ev.type === 'dup') S.dups.push(ev);
          else if (ev.type === 'scanning') { S.progress.stage='Scanning files…'; S.progress.n=ev.n; S.progress.dir=ev.dir; }
          else if (ev.type === 'phase2') { S.progress.stage='Comparing files…'; }
          else if (ev.type === 'hashing') { S.progress.stage='Hashing files…'; S.progress.total=ev.candidates; }
          else if (ev.type === 'progress') { S.progress.done=ev.done; S.progress.total=ev.total; }
          else if (ev.type === 'done') { S.status='done'; persistHistory(id, reportPath); }
          else if (ev.type === 'stopped') { S.status='stopped'; }
          else if (ev.type === 'error') { S.status='error'; S.progress.stage=ev.msg; }
          push(ev);
        } catch {}
      }
    });
    proc.stderr.on('data', d => console.error('py:', d.toString().trim()));
    proc.on('close', code => {
      if (S.status === 'scanning') {
        S.status = code === 0 ? 'done' : 'error';
        const ev = { type: code === 0 ? 'done' : 'error', msg: code !== 0 ? `exited ${code}` : undefined };
        push(ev);
        if (code === 0) persistHistory(id, reportPath);
      }
      S.proc = null;
    });
    proc.on('error', err => {
      S.status = 'error'; S.progress.stage = err.message;
      push({ type:'error', msg: err.message }); S.proc = null;
    });

    return Response.json({ id });
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
