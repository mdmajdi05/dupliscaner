import { S } from '../../../../lib/state.js';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(ctrl) {
      const send = obj => {
        try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch {}
      };

      // sync current state
      send({ type:'sync', status: S.status, progress: S.progress,
             dupCount: S.dups.length, scanPath: S.scanPath, mode: S.mode });

      // replay buffered events
      for (const ev of S.events) send(ev);

      // heartbeat
      const hb = setInterval(() => send({ type:'hb' }), 20000);

      const handler = ev => send(ev);
      S.ee.on('ev', handler);

      // cleanup on disconnect
      const cleanup = () => { S.ee.off('ev', handler); clearInterval(hb); };
      ctrl.signal?.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
