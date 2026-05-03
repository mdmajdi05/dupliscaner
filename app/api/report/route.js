import fs from 'fs';
import { getById } from '../../../lib/history.js';
import { S } from '../../../lib/state.js';
export const dynamic = 'force-dynamic';

function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  let dups, scanPath, ts, reportFile;
  if (id) {
    const scan = getById(id);
    if (!scan) return new Response('Not found', { status: 404 });
    dups = scan.dups || []; scanPath = scan.path; ts = scan.startedAt; reportFile = scan.reportPath;
  } else {
    dups = S.dups; scanPath = S.scanPath; ts = S.startedAt; reportFile = S.reportPath;
  }

  // serve existing file if present
  if (reportFile && fs.existsSync(reportFile)) {
    const txt = fs.readFileSync(reportFile, 'utf8');
    return new Response(txt, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8',
                 'Content-Disposition': `attachment; filename="dupscan_${id||'live'}.txt"` }
    });
  }

  // generate on the fly
  const totalWaste = dups.reduce((a,d)=>a+(d.waste||0),0);
  const totalExtra = dups.reduce((a,d)=>a+(d.count-1),0);
  const lines = [
    '═'.repeat(65), '  DUPSCAN — DUPLICATE FILE REPORT',
    `  Path      : ${scanPath}`, `  Generated : ${new Date(ts||Date.now()).toLocaleString()}`,
    `  Groups    : ${dups.length}`, `  Extra copies: ${totalExtra}`, `  Space saved : ${fmtSize(totalWaste)}`,
    '═'.repeat(65), '',
  ];
  const byCat = {};
  for (const d of dups) { if (!byCat[d.cat]) byCat[d.cat]=[]; byCat[d.cat].push(d); }
  for (const [cat, items] of Object.entries(byCat)) {
    lines.push(`\n[${cat.toUpperCase()}]`);
    for (const d of items) {
      lines.push(`  ${d.files[0]?.name}  (${d.sizeFmt} × ${d.count}  |  wasted ${d.wasteFmt})`);
      for (let i=0;i<d.files.length;i++) lines.push(`    ${i===0?'KEEP  ':'DELETE'} ${d.files[i].path}`);
      lines.push('');
    }
  }
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8',
               'Content-Disposition': `attachment; filename="dupscan_${id||'live'}.txt"` }
  });
}
