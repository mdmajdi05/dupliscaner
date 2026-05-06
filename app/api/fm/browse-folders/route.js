import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const folderPath = searchParams.get('path') || (process.platform === 'win32' ? 'C:\\' : os.homedir());

    // Validate path exists
    if (!fs.existsSync(folderPath)) {
      return Response.json({ error: 'Path does not exist', folders: [] }, { status: 400 });
    }

    // Check if path is a directory
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      return Response.json({ error: 'Path is not a directory', folders: [] }, { status: 400 });
    }

    // List directories in this folder
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(folderPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ folders, currentPath: folderPath });
  } catch (e) {
    return Response.json({ error: e.message, folders: [] }, { status: 500 });
  }
}
