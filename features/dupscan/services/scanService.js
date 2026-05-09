const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function fetchHistory() {
  const response = await fetch('/api/history');
  if (!response.ok) return [];
  return response.json();
}

export async function fetchHistoryItem(id) {
  const response = await fetch(`/api/history/${id}`);
  if (!response.ok) return null;
  return response.json();
}

export async function deleteHistoryItem(id) {
  return fetch(`/api/history/${id}`, { method: 'DELETE' });
}

export async function patchHistoryItem(id, payload) {
  return fetch(`/api/history/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export async function startDupScan(payload) {
  const response = await fetch('/api/scan/start', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function stopDupScan() {
  return fetch('/api/scan/stop', { method: 'POST' });
}

export async function deleteDupFile(path) {
  return fetch('/api/delete', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path }),
  });
}

// Conflict Resolution API functions
export async function fetchDuplicateGroups(limit = 1000, offset = 0) {
  const response = await fetch(`/api/duplicates/groups?limit=${limit}&offset=${offset}`);
  if (!response.ok) return { groups: [], pagination: {} };
  return response.json();
}

export async function fetchDuplicateGroup(hash) {
  const response = await fetch(`/api/duplicates/groups/${hash}`);
  if (!response.ok) return null;
  return response.json();
}

export async function deleteFile(path) {
  const response = await fetch('/api/delete', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path }),
  });
  return response.ok;
}

export async function markFileAction(path, actionType) {
  const response = await fetch('/api/duplicates/action', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ path, actionType }),
  });
  return response.ok;
}

