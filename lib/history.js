import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'history.json');

function ensure() { if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true }); }

export function readAll() {
  ensure();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

export function writeAll(list) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function addScan(scan) {
  const list = readAll();
  list.unshift(scan);
  if (list.length > 50) list.splice(50);
  writeAll(list);
  return scan;
}

export function getById(id) { return readAll().find(s => s.id === id) || null; }

export function deleteById(id) {
  const list = readAll().filter(s => s.id !== id);
  writeAll(list);
}

export function patchById(id, patch) {
  const list = readAll();
  const i = list.findIndex(s => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  writeAll(list);
  return list[i];
}

export function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}
