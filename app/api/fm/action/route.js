import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { buildDerivedIndex, makeFileRecord, mutateFileIndex } from '../../../../lib/fm-cache.js';

export const dynamic = 'force-dynamic';

function updateCacheAfterDelete(filePath) {
  mutateFileIndex((index) => {
    delete index.files[filePath];
    for (const [groupId, originalPath] of Object.entries(index.originals || {})) {
      if (originalPath === filePath) delete index.originals[groupId];
    }
    buildDerivedIndex(index);
    return index;
  });
}

function updateCacheAfterPathChange(src, dest) {
  mutateFileIndex((index) => {
    delete index.files[src];
    if (fs.existsSync(dest) && fs.statSync(dest).isFile()) {
      index.files[dest] = makeFileRecord(dest);
    }
    for (const [groupId, originalPath] of Object.entries(index.originals || {})) {
      if (originalPath === src) index.originals[groupId] = dest;
    }
    buildDerivedIndex(index);
    return index;
  });
}

function updateCacheAfterCopy(dest) {
  mutateFileIndex((index) => {
    if (fs.existsSync(dest) && fs.statSync(dest).isFile()) {
      index.files[dest] = makeFileRecord(dest);
    }
    buildDerivedIndex(index);
    return index;
  });
}

function openInSystem(target, select = false) {
  if (process.platform === 'win32') {
    if (select) {
      spawn('explorer.exe', [`/select,${target}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
    return;
  }

  const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(openCmd, [select ? path.dirname(target) : target], { detached: true, stdio: 'ignore' }).unref();
}

export async function POST(req) {
  try {
    const { action, src, dest, newName, groupId, originalPath } = await req.json();

    if (!action) return Response.json({ error: 'action required' }, { status: 400 });

    if (action === 'mark-original') {
      if (!groupId || !originalPath) return Response.json({ error: 'groupId and originalPath required' }, { status: 400 });
      mutateFileIndex((index) => {
        index.originals[groupId] = originalPath;
        buildDerivedIndex(index);
        return index;
      });
      return Response.json({ ok: true, groupId, originalPath });
    }

    if (!src) return Response.json({ error: 'src required' }, { status: 400 });
    if (!fs.existsSync(src)) return Response.json({ error: 'Source not found' }, { status: 404 });

    switch (action) {
      case 'delete': {
        const st = fs.statSync(src);
        if (st.isDirectory()) return Response.json({ error: 'Cannot delete directory via this API' }, { status: 400 });
        fs.unlinkSync(src);
        updateCacheAfterDelete(src);
        return Response.json({ ok: true });
      }

      case 'rename': {
        if (!newName) return Response.json({ error: 'newName required' }, { status: 400 });
        const dir = path.dirname(src);
        const newPath = path.join(dir, newName);
        if (fs.existsSync(newPath)) return Response.json({ error: 'File already exists' }, { status: 409 });
        fs.renameSync(src, newPath);
        updateCacheAfterPathChange(src, newPath);
        return Response.json({ ok: true, newPath });
      }

      case 'move': {
        if (!dest) return Response.json({ error: 'dest required' }, { status: 400 });
        if (!fs.existsSync(dest) || !fs.statSync(dest).isDirectory()) {
          return Response.json({ error: 'Destination folder not found' }, { status: 404 });
        }
        const fileName = path.basename(src);
        const destFile = path.join(dest, fileName);
        if (fs.existsSync(destFile)) return Response.json({ error: 'File already exists at destination' }, { status: 409 });
        fs.renameSync(src, destFile);
        updateCacheAfterPathChange(src, destFile);
        return Response.json({ ok: true, newPath: destFile });
      }

      case 'copy': {
        if (!dest) return Response.json({ error: 'dest required' }, { status: 400 });
        if (!fs.existsSync(dest) || !fs.statSync(dest).isDirectory()) {
          return Response.json({ error: 'Destination folder not found' }, { status: 404 });
        }
        const fileName = path.basename(src);
        let destFile = path.join(dest, fileName);
        if (fs.existsSync(destFile)) {
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          destFile = path.join(dest, `${base}_copy${ext}`);
        }
        fs.copyFileSync(src, destFile);
        updateCacheAfterCopy(destFile);
        return Response.json({ ok: true, newPath: destFile });
      }

      case 'open':
        openInSystem(src, false);
        return Response.json({ ok: true });

      case 'open-location':
        openInSystem(src, true);
        return Response.json({ ok: true });

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
