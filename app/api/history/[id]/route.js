import { getById, deleteById, patchById } from '../../../../lib/history.js';
export const dynamic = 'force-dynamic';

export async function GET(_, { params }) {
  const s = getById(params.id);
  if (!s) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(s);
}

export async function DELETE(_, { params }) {
  deleteById(params.id);
  return Response.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const patch = await req.json();
  const updated = patchById(params.id, patch);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(updated);
}
