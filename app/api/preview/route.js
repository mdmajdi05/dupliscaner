import fs from 'fs';
import path from 'path';
export const dynamic = 'force-dynamic';

const MIME = {
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif',
  '.webp':'image/webp','.bmp':'image/bmp','.svg':'image/svg+xml','.ico':'image/x-icon',
  '.tiff':'image/tiff','.tif':'image/tiff','.avif':'image/avif','.heic':'image/heic',
  '.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska',
  '.avi':'video/x-msvideo','.mov':'video/quicktime','.wmv':'video/x-ms-wmv',
  '.m4v':'video/mp4','.3gp':'video/3gpp','.ts':'video/mp2t',
  '.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac',
  '.aac':'audio/aac','.ogg':'audio/ogg','.m4a':'audio/mp4',
  '.opus':'audio/opus','.wma':'audio/x-ms-wma',
  '.pdf':'application/pdf','.txt':'text/plain','.md':'text/plain',
  '.json':'application/json','.csv':'text/csv','.html':'text/html',
};

function buildHeaders(mime, size, filePath, extra = {}) {
  const fileName = path.basename(filePath).replace(/"/g, '');
  return {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(size),
    'Content-Disposition': `inline; filename="${fileName}"`,
    'Cache-Control': 'public, max-age=300',
    ...extra,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('p');
  if (!filePath) return new Response('missing p', { status: 400 });

  if (!fs.existsSync(filePath)) return new Response('Not found', { status: 404 });
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return new Response('Is a directory', { status: 400 });

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const size = stat.size;
  const range = req.headers.get('range');

  if (range) {
    const [, s, e] = range.match(/bytes=(\d+)-(\d*)/) || [];
    const start = parseInt(s);
    const end = e ? parseInt(e) : Math.min(start + 2 * 1024 * 1024, size - 1);
    const len = end - start + 1;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);
    return new Response(buf, {
      status: 206,
      headers: buildHeaders(mime, len, filePath, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
      }),
    });
  }

  if (size > 20 * 1024 * 1024) {
    // stream large files
    const rs = fs.createReadStream(filePath);
    const ws = new ReadableStream({
      start(c) { rs.on('data',d=>c.enqueue(d)); rs.on('end',()=>c.close()); rs.on('error',e=>c.error(e)); },
      cancel() { rs.destroy(); },
    });
    return new Response(ws, {
      headers: buildHeaders(mime, size, filePath),
    });
  }

  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    headers: buildHeaders(mime, size, filePath),
  });
}
