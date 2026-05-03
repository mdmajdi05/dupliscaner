import { readAll } from '../../../lib/history.js';
export const dynamic = 'force-dynamic';

export async function GET() {
  const all = readAll();
  // return summary (no dups array) for list
  const summary = all.map(({ dups, ...rest }) => ({ ...rest, dupCount: dups?.length || 0 }));
  return Response.json(summary);
}
