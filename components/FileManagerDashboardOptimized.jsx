'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image, Video, Music, FileText, File, Copy2, LayoutGrid, List,
  Search, X, SlidersHorizontal, FolderOpen, ChevronRight,
  Trash2, Move, Edit2, Copy, ExternalLink, MapPin, Play, Pause,
  CheckSquare, Square, ZoomIn, ZoomOut, RefreshCw,
  Shield, AlertTriangle, HardDrive, Zap, Loader
} from 'lucide-react';
import FileManagerSidebar from './FileManagerSidebar';
import FMPreviewModal from './FMPreviewModal';
import DuplicatesTab from './DuplicatesTab';
import VirtualGridScroller from './VirtualGridScroller';
import VirtualScroller from './VirtualScroller';

// ── constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',      label: 'All',       icon: HardDrive },
  { id: 'image',    label: 'Photos',    icon: Image },
  { id: 'video',    label: 'Videos',    icon: Video },
  { id: 'audio',    label: 'Audio',     icon: Music },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'other',    label: 'Others',    icon: File },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
];

const DEFAULT_ROOT = 'C:\\';

const CAT_COLOR = {
  image: '#f59e0b', video: '#ef4444', audio: '#a855f7',
  document: '#3b82f6', other: '#6b7280', folder: '#f59e0b',
};

const CAT_ICON = {
  image: Image, video: Video, audio: Music, document: FileText,
  other: File, folder: FolderOpen,
};

function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
}

// ── FileGridItem ──────────────────────────────────────────────────────────────
function FileGridItem({ file, zoom, selected, onSelect, onOpen, onAction, playingAudio, onPlayAudio }) {
  const sz = Math.round(60 + zoom * 2.2);
  const isSel = selected.has(file.path);
  const Ic = CAT_ICON[file.category] || File;
  const isImg = file.category === 'image';
  const isAudio = file.category === 'audio';
  const isPlaying = playingAudio === file.path;

  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer group transition-all"
      style={{
        border: isSel ? '2px solid var(--neon)' : '2px solid var(--border)',
        background: 'var(--s2)',
        boxShadow: isSel ? '0 0 10px rgba(0,230,118,.2)' : 'none',
      }}
      onClick={e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          onSelect(file.path, 'toggle');
        } else if (file.type === 'dir') {
          onAction('open-folder', file);
        } else {
          onOpen(file);
        }
      }}
    >
      {/* checkbox */}
      <div
        className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ opacity: isSel ? 1 : undefined }}
        onClick={e => { e.stopPropagation(); onSelect(file.path, 'toggle'); }}
      >
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: isSel ? 'var(--neon)' : 'rgba(7,9,12,.7)', border: '1.5px solid var(--border2)' }}>
          {isSel && <span style={{ color: '#000', fontSize: 11, fontWeight: 800 }}>✓</span>}
        </div>
      </div>

      {/* thumbnail area */}
      <div style={{ width: '100%', aspectRatio: '1', background: 'var(--s3)', position: 'relative', overflow: 'hidden' }}>
        {isImg ? (
          <img
            src={`/api/preview?p=${encodeURIComponent(file.path)}`}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Ic size={Math.max(16, Math.min(40, sz / 4))} style={{ color: CAT_COLOR[file.category] || 'var(--dim)' }} />
            {sz > 80 && <span style={{ fontSize: 9, color: 'var(--dim)' }}>{file.ext}</span>}
          </div>
        )}

        {/* audio play button */}
        {isAudio && (
          <button
            className="absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all"
            style={{ background: isPlaying ? 'var(--neon)' : 'rgba(0,230,118,.8)' }}
            onClick={e => { e.stopPropagation(); onPlayAudio(isPlaying ? null : file.path); }}
          >
            {isPlaying
              ? <Pause size={11} style={{ color: '#000' }} />
              : <Play size={11} style={{ color: '#000' }} />
            }
          </button>
        )}

        {/* duplicate badge */}
        {file.dupCount > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 rounded text-xs font-bold"
            style={{ background: 'rgba(239,68,68,.9)', color: '#fff', fontSize: 9 }}>
            {file.dupCount} dup
          </div>
        )}
      </div>

      {/* label */}
      {sz > 70 && (
        <div className="px-1.5 py-1.5">
          <div className="font-semibold truncate" style={{ fontSize: Math.max(10, Math.min(13, sz / 12)), color: 'var(--text)' }}>
            {file.name}
          </div>
          {sz > 100 && (
            <div className="mono mt-0.5" style={{ fontSize: 9, color: 'var(--dim)' }}>
              {file.sizeFmt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── FileListItem ──────────────────────────────────────────────────────────────
function FileListItem({ file, selected, onSelect, onOpen, onAction, playingAudio, onPlayAudio }) {
  const isSel = selected.has(file.path);
  const Ic = CAT_ICON[file.category] || File;
  const isAudio = file.category === 'audio';
  const isPlaying = playingAudio === file.path;

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
      style={{
        background: isSel ? 'rgba(0,230,118,.06)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        borderLeft: isSel ? '2px solid var(--neon)' : '2px solid transparent',
      }}
      onClick={e => {
        if (e.ctrlKey || e.metaKey) { onSelect(file.path, 'toggle'); }
        else if (file.type === 'dir') onAction('open-folder', file);
        else onOpen(file);
      }}
    >
      {/* checkbox */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{
          opacity: isSel ? 1 : undefined,
          background: isSel ? 'var(--neon)' : 'var(--s3)',
          border: '1.5px solid var(--border2)',
        }}
        onClick={e => { e.stopPropagation(); onSelect(file.path, 'toggle'); }}
      >
        {isSel && <span style={{ color: '#000', fontSize: 10, fontWeight: 800 }}>✓</span>}
      </div>

      {/* icon */}
      <Ic size={14} style={{ color: CAT_COLOR[file.category] || 'var(--dim)', flexShrink: 0 }} />

      {/* name + path */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{file.name}</div>
        <div className="mono text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10 }}>{file.path}</div>
      </div>

      {/* audio play */}
      {isAudio && (
        <button
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: isPlaying ? 'var(--neon)' : 'rgba(0,230,118,.15)', border: '1px solid var(--neon)' }}
          onClick={e => { e.stopPropagation(); onPlayAudio(isPlaying ? null : file.path); }}
        >
          {isPlaying ? <Pause size={9} style={{ color: '#000' }} /> : <Play size={9} style={{ color: 'var(--neon)' }} />}
        </button>
      )}

      {/* duplicate badge */}
      {file.dupCount > 0 && (
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold"
          style={{ background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10 }}>
          {file.dupCount} dup
        </span>
      )}

      {/* size + date */}
      <span className="flex-shrink-0 mono text-xs" style={{ color: 'var(--dim)', fontSize: 10, minWidth: 56, textAlign: 'right' }}>
        {file.sizeFmt}
      </span>
      <span className="flex-shrink-0 text-xs" style={{ color: 'var(--dim)', fontSize: 10, minWidth: 64, textAlign: 'right' }}>
        {fmtDate(file.modified)}
      </span>

      {/* actions */}
      {file.type !== 'dir' && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="btn-ghost rounded p-1" title="Copy path"
            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(file.path); }}>
            <Copy size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Go to file location"
            onClick={e => { e.stopPropagation(); onAction('open-location', file); }}>
            <MapPin size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Open file"
            onClick={e => { e.stopPropagation(); onAction('open', file); }}>
            <ExternalLink size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Scan this file for duplicates"
            onClick={e => { e.stopPropagation(); onAction('scan-duplicates', file); }}>
            <RefreshCw size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Rename"
            onClick={e => { e.stopPropagation(); onAction('rename', file); }}>
            <Edit2 size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Move"
            onClick={e => { e.stopPropagation(); onAction('move', file); }}>
            <Move size={11} />
          </button>
          <button className="btn-danger rounded p-1" title="Delete"
            onClick={e => { e.stopPropagation(); onAction('delete', file); }}>
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── BulkBar ───────────────────────────────────────────────────────────────────
function BulkBar({ count, onDelete, onCopy, onMove, onClear }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
      style={{ background: 'rgba(0,230,118,.08)', borderBottom: '1px solid rgba(0,230,118,.2)' }}>
      <span className="text-xs font-bold" style={{ color: 'var(--neon)' }}>{count} selected</span>
      <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onCopy}>
        <Copy size={11} /> Copy paths
      </button>
      <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onMove}>
        <Move size={11} /> Move
      </button>
      <button className="btn-danger flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onDelete}>
        <Trash2 size={11} /> Delete
      </button>
      <button className="btn-ghost rounded px-2 py-1 text-xs ml-auto" onClick={onClear}>
        <X size={11} />
      </button>
    </div>
  );
}

// ── AutoFolderPill ────────────────────────────────────────────────────────────
function AutoFolderPill({ folder, count, scanning, onClick }) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all"
      style={{
        background: count > 0 ? 'rgba(0,230,118,.1)' : 'var(--s3)',
        border: '1px solid var(--border)',
        color: count > 0 ? 'var(--neon)' : 'var(--muted)',
      }}
      onClick={onClick}
    >
      <FolderOpen size={11} />
      <span className="truncate max-w-[120px]">{folder.split(/[/\\]/).pop() || folder}</span>
      {scanning && <Loader size={10} className="anim-spin" />}
      {count > 0 && <span className="text-xs font-bold">{count}</span>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FileManagerDashboardOptimized({ onNavigateDupScan }) {
  const [activeTab, setActiveTab] = useState('all');
  const [rootPath, setRootPath]   = useState(DEFAULT_ROOT);
  const [inputPath, setInputPath] = useState(DEFAULT_ROOT);
  const [curFolder, setCurFolder] = useState(DEFAULT_ROOT);
  const [files, setFiles]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const [hasMore, setHasMore]     = useState(false);

  const [viewMode, setViewMode]   = useState('grid');
  const [zoom, setZoom]           = useState(40);
  const [search, setSearch]       = useState('');
  const [extFilter, setExtFilter] = useState('');
  const [sortBy, setSortBy]       = useState('name');
  const [sortDir, setSortDir]     = useState('asc');
  const [folderSort, setFolderSort] = useState('duplicates');
  const [showFolders, setShowFolders] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [selected, setSelected]   = useState(new Set());
  const [preview, setPreview]     = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRef = useRef(null);

  // Background scanning state
  const [autoFolders, setAutoFolders] = useState([]);
  const [folderStats, setFolderStats] = useState({});
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ phase: 'idle' });

  // action modal state
  const [actionModal, setActionModal] = useState(null);
  const [actionInput, setActionInput] = useState('');
  const [containerDims, setContainerDims] = useState({ height: 600, width: 800 });
  const containerRef = useRef(null);
  const startedScanRef = useRef(false);

  const LIMIT = 100;

  // ── Auto-detect and start scanning common folders ────────────────────────
  const refreshScanProgress = useCallback(async () => {
    try {
      const r = await fetch('/api/fm/scan-bg?action=progress');
      if (!r.ok) return null;
      const data = await r.json();
      setScanProgress(data.progress || {});
      setIsAutoScanning(data.status === 'scanning');
      if (data.rootPath) {
        setRootPath(data.rootPath);
        setInputPath(data.rootPath);
        setCurFolder(prev => prev || data.rootPath);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const startBackgroundScan = useCallback(async (path = rootPath, hidden = includeHidden) => {
    setIsAutoScanning(true);
    await fetch('/api/fm/scan-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', path, includeHidden: hidden }),
    });
    setTimeout(refreshScanProgress, 500);
  }, [includeHidden, refreshScanProgress, rootPath]);

  const stopBackgroundScan = useCallback(async () => {
    await fetch('/api/fm/scan-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    setIsAutoScanning(false);
    setTimeout(refreshScanProgress, 300);
  }, [refreshScanProgress]);

  useEffect(() => {
    const init = async () => {
      const data = await refreshScanProgress();
      const resolvedRoot = data?.rootPath || DEFAULT_ROOT;
      setRootPath(resolvedRoot);
      setInputPath(resolvedRoot);
      setCurFolder(resolvedRoot);
      if (!startedScanRef.current && data?.status !== 'scanning') {
        startedScanRef.current = true;
        setTimeout(() => startBackgroundScan(resolvedRoot, includeHidden), 250);
      }
    };
    init();
  }, [includeHidden, refreshScanProgress, startBackgroundScan]);

  // ── Poll folder stats while scanning ──────────────────────────────────────
  // ── Load files ──────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (folder, off = 0, append = false) => {
    if (!folder) return;
    setLoading(true);
    try {
      const cat = activeTab === 'all' || activeTab === 'duplicates' ? '' : activeTab;
      const params = new URLSearchParams({
        path: folder,
        offset: off,
        limit: LIMIT,
        cat,
        search,
        sort: showFolders ? folderSort : sortBy,
        dir: sortDir,
        recursive: '1',
        ...(showFolders ? { foldersOnly: '1', folderSort } : {}),
        ...(extFilter ? { ext: extFilter } : {}),
      });
      const r = await fetch(`/api/fm/ls?${params}`);
      if (!r.ok) return;
      const data = await r.json();
      setFiles(prev => append ? [...prev, ...(data.items || [])] : (data.items || []));
      setTotal(data.total || 0);
      setOffset(off);
      setHasMore(data.hasMore || false);
    } catch {}
    setLoading(false);
  }, [activeTab, extFilter, folderSort, search, showFolders, sortBy, sortDir]);

  useEffect(() => {
    if (curFolder) { setFiles([]); loadFiles(curFolder, 0); }
  }, [activeTab, curFolder, extFilter, folderSort, loadFiles, search, showFolders, sortBy, sortDir]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const data = await refreshScanProgress();
      try {
        const r = await fetch('/api/fm/scan-bg?action=list-folders&limit=12');
        if (r.ok) {
          const foldersData = await r.json();
          setAutoFolders(foldersData.folders || []);
          const stats = {};
          for (const folder of foldersData.folders || []) stats[folder.path] = folder.count || 0;
          setFolderStats(stats);
        }
      } catch {}
      if (data?.status === 'scanning' && curFolder) {
        loadFiles(curFolder, 0, false);
      }
    }, isAutoScanning ? 1500 : 5000);

    return () => clearInterval(pollInterval);
  }, [curFolder, isAutoScanning, loadFiles, refreshScanProgress]);

  const handleGoPath = () => {
    const p = inputPath.trim();
    if (!p) return;
    setRootPath(p);
    setCurFolder(p);
    startBackgroundScan(p, includeHidden);
  };

  const handleSelectFolder = (path) => {
    setCurFolder(path);
  };

  const handleSelect = (filePath, mode) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (mode === 'toggle') {
        next.has(filePath) ? next.delete(filePath) : next.add(filePath);
      } else if (mode === 'all') {
        files.forEach(f => next.add(f.path));
      } else if (mode === 'clear') {
        next.clear();
      }
      return next;
    });
  };

  const handleAction = async (type, file) => {
    if (type === 'open-folder') {
      setCurFolder(file.path);
      setShowFolders(false);
      return;
    }

    if (type === 'open' || type === 'open-location') {
      await fetch('/api/fm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: type, src: file.path }),
      });
      return;
    }

    if (type === 'scan-duplicates') {
      setActiveTab('duplicates');
      await startBackgroundScan(rootPath || DEFAULT_ROOT, includeHidden);
      return;
    }

    if (type === 'delete') {
      if (!confirm(`Delete: ${file.path}?\n\nCannot be undone.`)) return;
      const r = await fetch('/api/fm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', src: file.path }),
      });
      if (r.ok) setFiles(prev => prev.filter(f => f.path !== file.path));
      else { const d = await r.json(); alert(d.error); }
    } else {
      setActionModal({ type, file });
      setActionInput(type === 'rename' ? file.name : '');
    }
  };

  const submitAction = async () => {
    if (!actionModal) return;
    const { type, file, files: modalFiles } = actionModal;
    const targets = modalFiles || (file?.path ? [file.path] : []);
    let ok = true;
    let lastError = '';

    for (const src of targets) {
      const r = await fetch('/api/fm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          src,
          ...(type === 'rename' ? { newName: actionInput } : { dest: actionInput }),
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        ok = false;
        lastError = data.error || 'Action failed';
        break;
      }
    }

    if (ok) {
      setActionModal(null);
      setSelected(new Set());
      loadFiles(curFolder, 0);
    } else {
      alert(lastError);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} files? Cannot be undone.`)) return;
    for (const p of selected) {
      await fetch('/api/fm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', src: p }),
      });
    }
    setSelected(new Set());
    loadFiles(curFolder, 0);
  };

  const handlePlayAudio = (filePath) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (!filePath) { setPlayingAudio(null); return; }
    setPlayingAudio(filePath);
    const audio = new Audio(`/api/preview?p=${encodeURIComponent(filePath)}`);
    audioRef.current = audio;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingAudio(null);
  };

  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  useEffect(() => {
    if (!containerRef.current) return;
    const updateDims = () => {
      if (containerRef.current) {
        setContainerDims({
          height: containerRef.current.clientHeight,
          width: containerRef.current.clientWidth,
        });
      }
    };
    updateDims();
    const timer = setTimeout(updateDims, 100);
    window.addEventListener('resize', updateDims);
    return () => { clearTimeout(timer); window.removeEventListener('resize', updateDims); };
  }, []);

  const containerHeight = containerDims.height - 20;
  const cols = Math.max(2, Math.floor(containerDims.width / (60 + zoom * 2.2)));

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* ── Left panel: folder tree ── */}
      <div className="w-52 flex-shrink-0 flex flex-col" style={{ background: 'var(--s1)', borderRight: '1px solid var(--border)' }}>
        {/* path input */}
        <div className="p-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex gap-1">
            <input
              className="inp flex-1 px-2 py-1.5 text-xs"
              placeholder="Root path…"
              value={inputPath}
              onChange={e => setInputPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGoPath()}
            />
            <button className="btn-neon px-2 py-1 rounded text-xs" onClick={handleGoPath}>Go</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <FileManagerSidebar
            rootPath={rootPath}
            selectedFolder={curFolder}
            onSelectFolder={handleSelectFolder}
          />
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ── Tab bar ── */}
        <div className="flex items-center flex-shrink-0 overflow-x-auto" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
          {TABS.map(tab => {
            const Ic = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all flex-shrink-0"
                style={{
                  background: activeTab === tab.id ? 'var(--s2)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--neon)' : 'var(--muted)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--neon)' : '2px solid transparent',
                }}
              >
                <Ic size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Auto-folders row ── */}
        {autoFolders.length > 0 && (
          <div className="flex-shrink-0 overflow-x-auto px-3 py-2 flex gap-2" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
            <Zap size={12} style={{ color: 'var(--neon)', flexShrink: 0, marginTop: 2 }} />
            {autoFolders.map((folder) => (
              <AutoFolderPill
                key={folder.path}
                folder={folder.path}
                count={folderStats[folder.path] || 0}
                scanning={isAutoScanning}
                onClick={() => setCurFolder(folder.path)}
              />
            ))}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {/* breadcrumb */}
          {curFolder && (
            <div className="flex items-center gap-1 text-xs mono truncate flex-1" style={{ color: 'var(--muted)', maxWidth: 300 }}>
              <FolderOpen size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span className="truncate">{curFolder}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs mono" style={{ color: isAutoScanning ? 'var(--neon)' : 'var(--dim)' }}>
            {isAutoScanning && <Loader size={11} className="anim-spin" />}
            <span>{scanProgress.phase || 'cache'}</span>
            {scanProgress.scanned > 0 && <span>{Number(scanProgress.scanned).toLocaleString()} scanned</span>}
          </div>

          {/* search */}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: 'var(--s3)', border: '1px solid var(--border)' }}>
            <Search size={11} style={{ color: 'var(--dim)' }} />
            <input
              className="bg-transparent outline-none text-xs mono"
              style={{ width: 140, color: 'var(--text)', caretColor: 'var(--neon)' }}
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')} style={{ color: 'var(--dim)' }}><X size={10} /></button>}
          </div>

          {/* ext filter */}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: 'var(--s3)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--dim)', fontSize: 10 }}>.ext</span>
            <input
              className="bg-transparent outline-none text-xs mono"
              style={{ width: 60, color: 'var(--text)', caretColor: 'var(--neon)' }}
              placeholder="jpg, mp4…"
              value={extFilter}
              onChange={e => setExtFilter(e.target.value)}
            />
          </div>

          <button
            className="btn-ghost rounded px-2 py-1 text-xs"
            style={{ color: showFolders ? 'var(--neon)' : 'var(--muted)' }}
            onClick={() => setShowFolders(v => !v)}
            title="Show folders with file counts"
          >
            Folders
          </button>

          <label className="flex items-center gap-1 text-xs" style={{ color: includeHidden ? 'var(--neon)' : 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={e => setIncludeHidden(e.target.checked)}
              style={{ accentColor: 'var(--neon)' }}
            />
            Hidden
          </label>

          <select className="inp px-2 py-1 text-xs" value={showFolders ? folderSort : sortBy}
            onChange={e => showFolders ? setFolderSort(e.target.value) : setSortBy(e.target.value)}
            style={{ width: 96 }}>
            {showFolders ? (
              <>
                <option value="duplicates">Duplicates</option>
                <option value="files">Files</option>
                <option value="photos">Photos</option>
                <option value="videos">Videos</option>
                <option value="audio">Audio</option>
                <option value="documents">Docs</option>
                <option value="name">Name</option>
              </>
            ) : (
              <>
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="date">Date</option>
                <option value="type">Type</option>
                <option value="dups">Dupes</option>
              </>
            )}
          </select>

          <button className="btn-ghost rounded px-2 py-1 text-xs" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>

          {/* view toggle */}
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button
              className="px-2 py-1.5 transition-all"
              style={{ background: viewMode === 'grid' ? 'var(--s4)' : 'transparent', color: viewMode === 'grid' ? 'var(--neon)' : 'var(--muted)' }}
              onClick={() => setViewMode('grid')}>
              <LayoutGrid size={13} />
            </button>
            <button
              className="px-2 py-1.5 transition-all"
              style={{ background: viewMode === 'list' ? 'var(--s4)' : 'transparent', color: viewMode === 'list' ? 'var(--neon)' : 'var(--muted)' }}
              onClick={() => setViewMode('list')}>
              <List size={13} />
            </button>
          </div>

          {/* zoom slider (grid only) */}
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1.5">
              <ZoomOut size={12} style={{ color: 'var(--dim)' }} />
              <input
                type="range" min="0" max="100" value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                style={{ width: 80, accentColor: 'var(--neon)' }}
              />
              <ZoomIn size={12} style={{ color: 'var(--dim)' }} />
            </div>
          )}

          {/* select all */}
          <button className="btn-ghost rounded p-1.5" title="Select all" onClick={() => handleSelect(null, 'all')}>
            <CheckSquare size={13} />
          </button>

          {/* refresh */}
          <button className="btn-ghost rounded p-1.5" title="Refresh" onClick={() => loadFiles(curFolder, 0)}>
            <RefreshCw size={13} className={loading ? 'anim-spin' : ''} />
          </button>

          {isAutoScanning ? (
            <button className="btn-danger rounded px-2 py-1 text-xs" onClick={stopBackgroundScan}>Stop scan</button>
          ) : (
            <button className="btn-neon rounded px-2 py-1 text-xs" onClick={() => startBackgroundScan(rootPath, includeHidden)}>Scan C:</button>
          )}

          <span className="ml-auto text-xs mono" style={{ color: 'var(--dim)' }}>
            {filteredFiles.length}{total > filteredFiles.length ? `/${total}` : ''} files
          </span>
        </div>

        {/* bulk action bar */}
        <BulkBar
          count={selected.size}
          onDelete={handleBulkDelete}
          onCopy={() => navigator.clipboard.writeText([...selected].join('\n'))}
          onMove={() => {
            setActionModal({ type: 'move', files: [...selected] });
            setActionInput('');
          }}
          onClear={() => handleSelect(null, 'clear')}
        />

        {/* ── Content area with virtual scrolling ── */}
        <div ref={containerRef} className="flex-1 overflow-hidden min-w-0">
          {activeTab === 'duplicates' ? (
            <DuplicatesTab rootPath={rootPath || curFolder || DEFAULT_ROOT} includeHidden={includeHidden} />
          ) : !curFolder ? (
            <div className="h-full flex items-center justify-center flex-col gap-3">
              <div style={{ fontSize: 48 }}>📁</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>File Manager</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {isAutoScanning ? '🔍 Scanning common folders...' : 'Enter a folder path or select from quick access'}
              </div>
            </div>
          ) : filteredFiles.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center flex-col gap-3">
              <div style={{ fontSize: 48 }}>📂</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>No files found{search ? ` matching "${search}"` : ''}</div>
            </div>
          ) : viewMode === 'grid' ? (
            <VirtualGridScroller
              items={filteredFiles}
              colWidth={60 + zoom * 2.2}
              itemHeight={100 + zoom * 2.2}
              containerHeight={containerHeight}
              gap={8}
              renderItem={(file, idx) => (
                <FileGridItem
                  file={file}
                  zoom={zoom}
                  selected={selected}
                  onSelect={handleSelect}
                  onOpen={setPreview}
                  onAction={handleAction}
                  playingAudio={playingAudio}
                  onPlayAudio={handlePlayAudio}
                />
              )}
              onEndReached={() => {
                if (hasMore && !loading) {
                  loadFiles(curFolder, offset + LIMIT, true);
                }
              }}
              className="w-full h-full"
            />
          ) : (
            <VirtualScroller
              items={filteredFiles}
              itemHeight={50}
              containerHeight={containerHeight}
              renderItem={(file, idx) => (
                <FileListItem
                  file={file}
                  selected={selected}
                  onSelect={handleSelect}
                  onOpen={setPreview}
                  onAction={handleAction}
                  playingAudio={playingAudio}
                  onPlayAudio={handlePlayAudio}
                />
              )}
              onEndReached={() => {
                if (hasMore && !loading) {
                  loadFiles(curFolder, offset + LIMIT, true);
                }
              }}
              className="w-full h-full"
            />
          )}

          {loading && (
            <div className="flex justify-center py-4">
              <div className="anim-spin w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--neon)', borderTopColor: 'transparent' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {preview && (
        <FMPreviewModal
          file={preview}
          onClose={() => setPreview(null)}
          onAction={handleAction}
        />
      )}

      {/* ── Action Modal ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,9,12,.85)' }}>
          <div className="rounded-xl p-5 w-96" style={{ background: 'var(--s2)', border: '1px solid var(--border2)' }}>
            <div className="text-sm font-bold mb-3 capitalize" style={{ color: 'var(--text)' }}>
              {actionModal.type} File
            </div>
            <div className="text-xs mono mb-2 truncate" style={{ color: 'var(--dim)' }}>
              {actionModal.file?.path}
            </div>
            <input
              className="inp w-full px-3 py-2 mb-4"
              placeholder={actionModal.type === 'rename' ? 'New name…' : 'Destination folder path…'}
              value={actionInput}
              onChange={e => setActionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAction()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost px-4 py-2 rounded text-xs" onClick={() => setActionModal(null)}>Cancel</button>
              <button className="btn-neon px-4 py-2 rounded text-xs" onClick={submitAction}>
                {actionModal.type === 'rename' ? 'Rename' : actionModal.type === 'move' ? 'Move' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} />
    </div>
  );
}
