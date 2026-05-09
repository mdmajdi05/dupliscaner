'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings, updateSettings, shouldAutoScan } from '../../../lib/scan-controller';
import {
  deleteDupFile,
  deleteHistoryItem,
  fetchHistory,
  fetchHistoryItem,
  fetchDuplicateGroups,
  patchHistoryItem,
  startDupScan,
  stopDupScan,
} from '../services/scanService';

export default function useDupScan() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ stage: '', n: 0, done: 0, total: 0, dir: '' });
  const [liveDups, setLiveDups] = useState([]);
  const [scanId, setScanId] = useState(null);
  const [scanPath, setScanPath] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [viewId, setViewId] = useState(null);
  const [viewScan, setViewScan] = useState(null);
  const [fileStatus, setFileStatus] = useState({});
  const [keepMap, setKeepMap] = useState({});
  const [filter, setFilter] = useState({ cat: 'All', folder: '', search: '', showStatus: 'all' });
  const [preview, setPreview] = useState(null);
  const [mainTab, setMainTab] = useState('list');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conflict, setConflict] = useState(null);
  const esRef = useRef(null);
  const persistRef = useRef(null);
  const pendingScanRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    setHistory(await fetchHistory());
  }, []);

  // Load existing duplicates from SQLite on startup
  const loadSavedDuplicates = useCallback(async () => {
    try {
      const data = await fetchDuplicateGroups(500, 0);
      if (data?.groups?.length > 0) {
        const transformed = data.groups.map(g => ({
          id: g.id,
          hash: g.hash,
          count: g.file_count,
          size: g.file_size,
          waste: g.waste_bytes,
          cat: g.files?.[0]?.category || 'Others',
          ext: g.files?.[0]?.ext || '',
          files: g.files || [],
        }));
        setLiveDups(transformed);
        console.log('[useDupScan] Loaded', transformed.length, 'saved duplicate groups from DB');
      }
    } catch (err) {
      console.error('[useDupScan] Failed to load saved duplicates:', err.message);
    }
  }, []);

  useEffect(() => {
    if (initialized) return;
    const settings = getSettings();
    setAutoScanMode(settings.autoScan);
    // Load saved data first, then history
    loadSavedDuplicates().then(() => refreshHistory()).finally(() => setInitialized(true));
  }, [initialized, refreshHistory, loadSavedDuplicates]);

  const handleEv = useCallback((ev) => {
    switch (ev.type) {
      case 'sync': setStatus(ev.status); setProgress(ev.progress || {}); break;
      case 'start':
        setStatus('scanning'); setLiveDups([]); setFileStatus({}); setKeepMap({});
        setProgress({ stage: 'Starting…', n: 0, done: 0, total: 0, dir: '' });
        break;
      case 'scanning': setProgress((p) => ({ ...p, stage: 'Scanning files…', n: ev.n, dir: ev.dir })); break;
      case 'phase2': setProgress((p) => ({ ...p, stage: 'Comparing…' })); break;
      case 'hashing': setProgress((p) => ({ ...p, stage: 'Hashing…', total: ev.candidates })); break;
      case 'progress': setProgress((p) => ({ ...p, done: ev.done, total: ev.total })); break;
      case 'dup': setLiveDups((prev) => (prev.find((d) => d.id === ev.id) ? prev : [...prev, ev])); break;
      case 'done':
        setStatus('done'); setProgress((p) => ({ ...p, stage: 'Scan complete!' }));
        setTimeout(refreshHistory, 1200);
        break;
      case 'stopped': setStatus('stopped'); break;
      case 'error': setStatus('error'); setProgress((p) => ({ ...p, stage: ev.msg || 'Error' })); break;
      default: break;
    }
  }, [refreshHistory]);

  const openStream = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource('/api/scan/stream');
    esRef.current = es;
    es.onmessage = (e) => { try { handleEv(JSON.parse(e.data)); } catch {} };
    es.onerror = () => setTimeout(() => { if (esRef.current) openStream(); }, 3000);
  }, [handleEv]);

  useEffect(() => {
    openStream();
    return () => { if (esRef.current) esRef.current.close(); };
  }, [openStream]);

  const startScan = useCallback(async ({ path, hidden, mode, targetFile }) => {
    setScanPath(path);
    setLiveDups([]);
    setFileStatus({}); setKeepMap({}); setViewId(null); setViewScan(null);
    setProgress({ stage: 'Starting…', n: 0, done: 0, total: 0, dir: '' });
    updateSettings({ scanPath: path, includeHidden: hidden || false });

    // Store pending scan for conflict resolution
    pendingScanRef.current = { path, hidden, mode, targetFile };

    const data = await startDupScan({ scanPath: path, includeHidden: hidden, mode, targetFile });

    // Check for conflict - 409 response
    if (data?.status === 'conflict') {
      setConflict(data);
      return;
    }

    if (data?.id) {
      setScanId(data.id);
      setStatus('scanning');
    } else {
      setStatus('error');
    }
  }, []);

  // Handle conflict - switch to new scan
  const handleConflictSwitch = useCallback(async () => {
    if (!pendingScanRef.current || !conflict) return;

    const pending = pendingScanRef.current;

    // Stop current scan first
    await stopDupScan();

    // Now start new scan
    setConflict(null);
    const data = await startDupScan({ scanPath: pending.path, includeHidden: pending.hidden, mode: pending.mode, targetFile: pending.targetFile });

    if (data?.id) {
      setScanId(data.id);
      setStatus('scanning');
    } else {
      setStatus('error');
    }

    pendingScanRef.current = null;
  }, [conflict]);

  // Cancel conflict
  const handleConflictCancel = useCallback(() => {
    setConflict(null);
    pendingScanRef.current = null;
  }, []);

  // Auto-scan only if: autoScan is enabled AND no data in DB
  useEffect(() => {
    if (!initialized || !autoScanMode || status !== 'idle') return;
    // Only start scan if NO data was loaded from DB
    // If dups loaded > 0, just show them - don't scan
    if (liveDups.length > 0) return;
    if (!shouldAutoScan(history)) return;
    const settings = getSettings();
    startScan({
      path: settings.scanPath || 'C:\\Users',
      hidden: settings.includeHidden || false,
      mode: 'scan',
    });
  }, [initialized, autoScanMode, status, history, startScan, liveDups.length]);

  const stopScan = useCallback(() => {
    stopDupScan();
    setStatus('stopped');
  }, []);

  const selectHistory = useCallback(async (id) => {
    if (!id) { setViewId(null); setViewScan(null); setFileStatus({}); setKeepMap({}); return; }
    setViewId(id);
    const scan = await fetchHistoryItem(id);
    if (!scan) return;
    setViewScan(scan);
    setFileStatus(scan.fileStatus || {});
    setKeepMap(scan.keepMap || {});
  }, []);

  const deleteHistory = useCallback(async (id) => {
    await deleteHistoryItem(id);
    if (viewId === id) { setViewId(null); setViewScan(null); }
    refreshHistory();
  }, [refreshHistory, viewId]);

  const persist = useCallback((fs, km) => {
    const sid = viewId || scanId;
    if (!sid) return;
    clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => {
      patchHistoryItem(sid, { fileStatus: fs, keepMap: km });
    }, 600);
  }, [viewId, scanId]);

  const updateFileStatus = useCallback((path, st) => {
    setFileStatus((prev) => {
      const next = { ...prev, [path]: st };
      persist(next, keepMap);
      return next;
    });
  }, [keepMap, persist]);

  const clearFileStatus = useCallback((path) => {
    setFileStatus((prev) => {
      const next = { ...prev };
      delete next[path];
      persist(next, keepMap);
      return next;
    });
  }, [keepMap, persist]);

  const updateKeep = useCallback((groupId, idx) => {
    setKeepMap((prev) => {
      const next = { ...prev, [groupId]: idx };
      persist(fileStatus, next);
      return next;
    });
  }, [fileStatus, persist]);

  const deleteFile = useCallback(async (path) => {
    if (!confirm(`Delete this file from disk?\n\n${path}\n\nThis cannot be undone.`)) return;
    const response = await deleteDupFile(path);
    if (response.ok) updateFileStatus(path, 'deleted');
    else alert('Delete failed — check permissions.');
  }, [updateFileStatus]);

  const downloadReport = useCallback(() => {
    const sid = viewId || scanId;
    const a = document.createElement('a');
    a.href = sid ? `/api/report?id=${sid}` : '/api/report';
    a.download = `dupscan_${sid || 'report'}.txt`;
    a.click();
  }, [scanId, viewId]);

  const dups = viewScan ? (viewScan.dups || []) : liveDups;
  const displayStatus = viewId ? 'done' : status;
  const allStatuses = Object.values(fileStatus);
  const stats = {
    sets: dups.length,
    extra: dups.reduce((a, d) => a + (d.count - 1), 0),
    waste: dups.reduce((a, d) => a + (d.waste || 0), 0),
    keep: allStatuses.filter((v) => v === 'keep').length,
    review: allStatuses.filter((v) => v === 'review').length,
    need: allStatuses.filter((v) => v === 'need').length,
    deleted: allStatuses.filter((v) => v === 'deleted').length,
  };

  return {
    status,
    progress,
    scanPath,
    history,
    viewId,
    viewScan,
    fileStatus,
    keepMap,
    filter,
    preview,
    mainTab,
    sidebarOpen,
    dups,
    displayStatus,
    stats,
    conflict,
    setFilter,
    setMainTab,
    setPreview,
    setSidebarOpen,
    selectHistory,
    deleteHistory,
    startScan,
    stopScan,
    downloadReport,
    updateFileStatus,
    clearFileStatus,
    updateKeep,
    handleConflictSwitch,
    handleConflictCancel,
    deleteFile,
  };
}
