import fs from 'fs';
import { buildDerivedIndex, mutateFileIndex } from '../../../lib/fm-cache.js';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { path: filePath } = await req.json();
    if (!filePath) return Response.json({ error: 'path required' }, { status: 400 });
    if (!fs.existsSync(filePath)) return Response.json({ ok: true, alreadyGone: true });
    const st = fs.statSync(filePath);
    if (st.isDirectory()) return Response.json({ error: 'Cannot delete directory' }, { status: 400 });
    fs.unlinkSync(filePath);
    mutateFileIndex((index) => {
      delete index.files[filePath];
      for (const [groupId, originalPath] of Object.entries(index.originals || {})) {
        if (originalPath === filePath) delete index.originals[groupId];
      }
      buildDerivedIndex(index);
      return index;
    });
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
