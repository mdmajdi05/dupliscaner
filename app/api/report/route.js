import fs from 'fs';
import { queryDb } from '../../../lib/db.js';
import { S } from '../../../lib/state.js';
import { initializeDatabase } from '../../../lib/init-db.js';

export const dynamic = 'force-dynamic';

function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // Initialize database
  await initializeDatabase();

  let dups, scanPath, ts, reportFile;

  if (id) {
    // Get scan from SQLite
    const scan = queryDb(
      'SELECT * FROM scan_history WHERE scan_id = ?',
      [id]
    )[0];

    if (!scan) return new Response('Not found', { status: 404 });

    scanPath = scan.root_path;
    ts = scan.started_at * 1000;
    reportFile = scan.report_path;

    // Get duplicate groups for this scan
    const dupGroups = queryDb(
      `SELECT dg.*, f.path as file_path, f.name as file_name, f.size as file_size
       FROM duplicate_groups dg
       JOIN files f ON f.duplicate_group_id = dg.id
       WHERE f.is_duplicate = 1
       ORDER BY dg.waste_bytes DESC`
    );

    // Group files by duplicate group
    const groupMap = new Map();
    for (const row of dupGroups) {
      if (!groupMap.has(row.id)) {
        groupMap.set(row.id, {
          id: String(row.id),
          hash: row.hash,
          count: row.file_count,
          size: row.file_size,
          waste: row.waste_bytes,
          cat: 'Others',
          files: [],
        });
      }
      groupMap.get(row.id).files.push({
        path: row.file_path,
        name: row.file_name,
        size: row.file_size,
        sizeFmt: fmtSize(row.file_size),
        waste: row.waste_bytes,
        wasteFmt: fmtSize(row.waste_bytes),
      });
    }

    dups = Array.from(groupMap.values());
  } else {
    // Live scan data from state
    dups = S.dups;
    scanPath = S.scanPath;
    ts = S.startedAt ? new Date(S.startedAt).getTime() : Date.now();
    reportFile = S.reportPath;
  }

  // Serve existing file if present
  if (reportFile && fs.existsSync(reportFile)) {
    const txt = fs.readFileSync(reportFile, 'utf8');
    return new Response(txt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="dupscan_${id||'live'}.txt"`
      }
    });
  }

  // Generate on the fly
  const totalWaste = dups.reduce((a,d)=>a+(d.waste||0),0);
  const totalExtra = dups.reduce((a,d)=>a+(d.count-1),0);
  const lines = [
    '═'.repeat(65), '  DUPSCAN — DUPLICATE FILE REPORT',
    `  Path      : ${scanPath}`, `  Generated : ${new Date(ts||Date.now()).toLocaleString()}`,
    `  Groups    : ${dups.length}`, `  Extra copies: ${totalExtra}`, `  Space saved : ${fmtSize(totalWaste)}`,
    '═'.repeat(65), '',
  ];

  const byCat = {};
  for (const d of dups) {
    const cat = d.cat || 'Others';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(d);
  }

  for (const [cat, items] of Object.entries(byCat)) {
    lines.push(`\n[${cat.toUpperCase()}]`);
    for (const d of items) {
      const wasteFmt = d.waste ? fmtSize(d.waste) : '0 B';
      lines.push(`  ${d.files[0]?.name || 'Unknown'}  (${fmtSize(d.size)} × ${d.count}  |  wasted ${wasteFmt})`);
      for (let i=0; i<d.files.length; i++) {
        lines.push(`    ${i===0 ? 'KEEP  ' : 'DELETE'} ${d.files[i].path}`);
      }
      lines.push('');
    }
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="dupscan_${id||'live'}.txt"`
    }
  });
}