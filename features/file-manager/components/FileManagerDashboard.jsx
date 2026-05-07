'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import {
  Image,
  Video,
  Music,
  FileText,
  File,
  Copy,
  LayoutGrid,
  List,
  Search,
  X,
  FolderOpen,
  CheckSquare,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  HardDrive,
  Zap,
  Loader,
  Settings,
  Play,
  PauseCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
} from 'lucide-react';

import FileManagerSidebar from './FileManagerSidebar';
import DuplicatesTab from './DuplicatesTab';
import VirtualGridScroller from './VirtualGridScroller';
import VirtualScroller from './VirtualScroller';
import SettingsModal from '../../../shared/components/SettingsModal';
import FolderPickerModal from './FolderPickerModal';
import EnhancedFileViewer from './EnhancedFileViewer';
import {
  fetchScanProgress,
  listAutoFolders,
  listFiles,
  runFileAction,
  startFmBackgroundScan,
  stopFmBackgroundScan,
} from '../services/fileManagerService';
import {
  AutoFolderPill,
  BulkBar,
  FileGridItem,
  FileListItem,
} from './FileManagerItemViews';



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





// ── Main component ────────────────────────────────────────────────────────────

export default function FileManagerDashboard() {
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
  const [scanMode, setScanMode] = useState('manual');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);


  // action modal state

  const [actionModal, setActionModal] = useState(null);

  const [actionInput, setActionInput] = useState('');

  const [containerDims, setContainerDims] = useState({ height: 600, width: 800 });
  const containerRef = useRef(null);
  const startedScanRef = useRef(false);
  const hydratedSettingsRef = useRef(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerFor, setFolderPickerFor] = useState(null);

  const LIMIT = 100;



  // ── Auto-detect and start scanning common folders ────────────────────────

  const refreshScanProgress = useCallback(async () => {
    try {
      const data = await fetchScanProgress();
      if (!data) return null;
      setScanProgress(data.progress || {});
      setIsAutoScanning(data.status === 'scanning');
      if (data.scanMode === 'auto' || data.scanMode === 'manual') setScanMode(data.scanMode);
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
    await startFmBackgroundScan({ path, includeHidden: hidden, mode: scanMode });
    setTimeout(refreshScanProgress, 500);
  }, [includeHidden, refreshScanProgress, rootPath, scanMode]);

  const stopBackgroundScan = useCallback(async () => {
    await stopFmBackgroundScan();
    setIsAutoScanning(false);
    setTimeout(refreshScanProgress, 300);
  }, [refreshScanProgress]);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedSettingsRef.current) return;
    hydratedSettingsRef.current = true;
    try {
      const savedMode = window.localStorage.getItem('fm-scan-mode');
      if (savedMode === 'auto' || savedMode === 'manual') setScanMode(savedMode);
      const savedPath = window.localStorage.getItem('fm-root-path');
      if (savedPath) {
        setRootPath(savedPath);
        setInputPath(savedPath);
        setCurFolder(savedPath);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('fm-scan-mode', scanMode); } catch {}
  }, [scanMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('fm-root-path', rootPath); } catch {}
  }, [rootPath]);

  useEffect(() => {
    const init = async () => {
      const data = await refreshScanProgress();
      const resolvedRoot = data?.rootPath || DEFAULT_ROOT;
      setRootPath(resolvedRoot);
      setInputPath(resolvedRoot);
      setCurFolder(resolvedRoot);
      if (!startedScanRef.current && scanMode === 'auto' && data?.status !== 'scanning') {
        startedScanRef.current = true;
        setTimeout(() => startBackgroundScan(resolvedRoot, includeHidden), 250);
      }
    };
    init();
  }, [includeHidden, refreshScanProgress, scanMode, startBackgroundScan]);

  // ── Poll folder stats while scanning ──────────────────────────────────────

  // ── Load files ──────────────────────────────────────────────────────────────

  const loadFiles = useCallback(async (folder, off = 0, append = false) => {

    if (!folder) return;

    if (!append) setLoading(true);

    try {

      const cat = activeTab === 'all' || activeTab === 'duplicates' ? '' : activeTab;

      const data = await listFiles({
        path: folder,
        offset: off,
        limit: LIMIT,
        category: cat,
        search,
        sort: showFolders ? folderSort : sortBy,
        dir: sortDir,
        foldersOnly: showFolders,
        folderSort,
        ext: extFilter,
      });
      if (!data) return;

      setFiles(prev => append ? [...prev, ...(data.items || [])] : (data.items || []));

      setTotal(data.total || 0);

      setOffset(off);

      setHasMore(data.hasMore || false);

    } catch {}
    if (!append) setLoading(false);
  }, [activeTab, extFilter, folderSort, search, showFolders, sortBy, sortDir]);

  useEffect(() => {
    if (curFolder) { setFiles([]); loadFiles(curFolder, 0); }
  }, [activeTab, curFolder, extFilter, folderSort, loadFiles, search, showFolders, sortBy, sortDir]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const data = await refreshScanProgress();
      try {
        const foldersData = await listAutoFolders(12);
        setAutoFolders(foldersData.folders || []);
        const stats = {};
        for (const folder of foldersData.folders || []) stats[folder.path] = folder.count || 0;
        setFolderStats(stats);
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
    if (scanMode === 'auto') startBackgroundScan(p, includeHidden);
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
      await runFileAction(type, { src: file.path });
      return;
    }

    if (type === 'scan-duplicates') {
      setActiveTab('duplicates');
      await startBackgroundScan(rootPath || DEFAULT_ROOT, includeHidden);
      return;
    }
    if (type === 'scan-folder') {
      const pathToScan = file?.type === 'dir' ? file.path : curFolder;
      if (pathToScan) await startBackgroundScan(pathToScan, includeHidden);
      return;
    }

    if (type === 'delete') {
      if (!confirm(`Delete: ${file.path}?\n\nCannot be undone.`)) return;
      const { ok, data } = await runFileAction('delete', { src: file.path });
      if (ok) setFiles(prev => prev.filter(f => f.path !== file.path));
      else alert(data.error);

    } else if (type === 'move' || type === 'copy') {
      // Use folder picker for move/copy destination
      setActionModal({ type, file });
      setActionInput('');
      setFolderPickerFor(type);
      setShowFolderPicker(true);
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
      const { ok: actionOk, data } = await runFileAction(type, {
        src,
        ...(type === 'rename' ? { newName: actionInput } : { dest: actionInput }),
      });
      if (!actionOk || !data.ok) {
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
      await runFileAction('delete', { src: p });
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

  return (

    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel: folder tree ── */}

      <div className={`${sidebarCollapsed ? 'w-12' : 'w-52'} flex-shrink-0 flex flex-col transition-all`} style={{ background: 'var(--s1)', borderRight: '1px solid var(--border)' }}>

        {/* path input */}

        <div className="p-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>

          <div className="flex gap-1">
            <button
              className="btn-ghost px-1.5 py-1 rounded text-xs"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
            </button>
            {!sidebarCollapsed && (
              <>

            <input

              className="inp flex-1 px-2 py-1.5 text-xs"

              placeholder="Root path…"

              value={inputPath}

              onChange={e => setInputPath(e.target.value)}

              onKeyDown={e => e.key === 'Enter' && handleGoPath()}

            />

            <button className="btn-neon px-2 py-1 rounded text-xs" onClick={handleGoPath}>Go</button>
              </>
            )}

          </div>

        </div>

        <div className="flex-1 overflow-hidden">

          {!sidebarCollapsed && <FileManagerSidebar

            rootPath={rootPath}

            selectedFolder={curFolder}

            onSelectFolder={handleSelectFolder}

          />}

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
          <button className="btn-ghost rounded p-1.5" onClick={() => setToolbarCollapsed(v => !v)} title="Collapse/expand toolbar">
            <ChevronsUpDown size={13} />
          </button>
          {!toolbarCollapsed && (
            <>
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
            <button className="btn-danger rounded px-2 py-1 text-xs" onClick={stopBackgroundScan}><PauseCircle size={12} /> Stop scan</button>
          ) : (
            <button className="btn-neon rounded px-2 py-1 text-xs" onClick={() => startBackgroundScan(curFolder || rootPath, includeHidden)}><Play size={12} /> Start scan</button>
          )}
          <select className="inp px-2 py-1 text-xs" value={scanMode} onChange={(e) => setScanMode(e.target.value)} style={{ width: 95 }}>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>

          <button className="btn-ghost rounded p-1.5" title="Settings" onClick={() => setShowSettings(true)}>
            <Settings size={13} />
          </button>

          <span className="ml-auto text-xs mono" style={{ color: 'var(--dim)' }}>

            {filteredFiles.length}{total > filteredFiles.length ? `/${total}` : ''} files

          </span>
            </>
          )}

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

        <EnhancedFileViewer

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

            {(actionModal.type === 'move' || actionModal.type === 'copy') ? (

              <div className="mb-4">

                <div className="text-xs mb-2" style={{ color: 'var(--dim)' }}>

                  Destination: <span style={{ color: 'var(--neon)' }}>{actionInput || 'Click browse...'}</span>

                </div>

                <button 

                  className="btn-ghost w-full px-3 py-2 text-xs rounded mb-4"

                  onClick={() => setShowFolderPicker(true)}

                >

                  Browse Folders...

                </button>

              </div>

            ) : (

              <input

                className="inp w-full px-3 py-2 mb-4"

                placeholder={actionModal.type === 'rename' ? 'New name…' : 'Destination folder path…'}

                value={actionInput}

                onChange={e => setActionInput(e.target.value)}

                onKeyDown={e => e.key === 'Enter' && submitAction()}

                autoFocus

              />

            )}

            <div className="flex gap-2 justify-end">

              <button className="btn-ghost px-4 py-2 rounded text-xs" onClick={() => setActionModal(null)}>Cancel</button>

              <button className="btn-neon px-4 py-2 rounded text-xs" onClick={submitAction} disabled={(actionModal.type === 'move' || actionModal.type === 'copy') && !actionInput}>

                {actionModal.type === 'rename' ? 'Rename' : actionModal.type === 'move' ? 'Move' : 'Copy'}

              </button>

            </div>

          </div>

        </div>

      )}



      <audio ref={audioRef} />

      {/* ── Settings Modal ── */}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* ── Folder Picker Modal ── */}

      {showFolderPicker && (

        <FolderPickerModal

          isOpen={showFolderPicker}

          onClose={() => setShowFolderPicker(false)}

          onSelect={(path) => {

            if (folderPickerFor === 'move') {

              setActionInput(path);

            } else if (folderPickerFor === 'copy') {

              setActionInput(path);

            }

            setShowFolderPicker(false);

            setFolderPickerFor(null);

          }}

        />

      )}

    </div>

  );

}

