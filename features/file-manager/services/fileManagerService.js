const JSON_HEADERS = { 'Content-Type': 'application/json' };

function toQuery(params) {
  return new URLSearchParams(params).toString();
}

export async function fetchScanProgress() {
  const response = await fetch('/api/fm/scan-bg?action=progress');
  if (!response.ok) return null;
  return response.json();
}

export async function startFmBackgroundScan({ path, includeHidden }) {
  return fetch('/api/fm/scan-bg', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: 'start', path, includeHidden }),
  });
}

export async function stopFmBackgroundScan() {
  return fetch('/api/fm/scan-bg', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: 'stop' }),
  });
}

export async function listAutoFolders(limit = 12) {
  const response = await fetch(`/api/fm/scan-bg?action=list-folders&limit=${limit}`);
  if (!response.ok) return { folders: [] };
  return response.json();
}

export async function listFiles({
  path,
  offset,
  limit,
  category,
  search,
  sort,
  dir,
  recursive = '1',
  foldersOnly = false,
  folderSort = 'duplicates',
  ext = '',
}) {
  const query = {
    path,
    offset,
    limit,
    cat: category,
    search,
    sort,
    dir,
    recursive,
    ...(foldersOnly ? { foldersOnly: '1', folderSort } : {}),
    ...(ext ? { ext } : {}),
  };

  const response = await fetch(`/api/fm/ls?${toQuery(query)}`);
  if (!response.ok) return null;
  return response.json();
}

export async function runFileAction(action, payload = {}) {
  const response = await fetch('/api/fm/action', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}
