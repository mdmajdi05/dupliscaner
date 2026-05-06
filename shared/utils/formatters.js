export function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
}

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

/** Date + short time (matches legacy sidebar history rows). */
export function fmtDateTimeShort(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return (
    `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  );
}
