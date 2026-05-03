import { S, push } from '../../../../lib/state.js';
export const dynamic = 'force-dynamic';
export async function POST() {
  if (S.proc) {
    try { S.proc.kill('SIGTERM'); } catch {}
    setTimeout(() => { if (S.proc) try { S.proc.kill('SIGKILL'); } catch {} }, 2000);
  }
  S.status = 'stopped';
  push({ type:'stopped', ts: new Date().toISOString() });
  return Response.json({ ok: true });
}
