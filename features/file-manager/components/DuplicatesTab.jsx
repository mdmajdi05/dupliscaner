'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeftRight, Copy, Crown, Eye, File, FileText,
  Image, Loader, MapPin, Music, Play, RefreshCw, Shield, Square,
  Trash2, Video, X
} from 'lucide-react';
import { fmtSize } from '../../../shared/utils/formatters';
import { buildPreviewUrl } from '../../../shared/utils/preview';
import {
  listDuplicateGroups,
  runFileAction,
  startFmBackgroundScan,
  stopFmBackgroundScan,
} from '../services/fileManagerService';

const DUP_TABS = [
  { id: 'all', label: 'All', icon: Shield },
  { id: 'image', label: 'Photos', icon: Image },
  { id: 'video', label: 'Videos', icon: Video },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'other', label: 'Others', icon: File },
];

const CAT_COLOR = {
  image: '#f59e0b',
  video: '#ef4444',
  audio: '#a855f7',
  document: '#3b82f6',
  other: '#6b7280',
};

function AudioButton({ file }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef(null);

  const toggle = (e) => {
    e.stopPropagation();
    if (!ref.current) {
      ref.current = new Audio(buildPreviewUrl(file.path));
      ref.current.onended = () => setPlaying(false);
    }
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <button
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: playing ? 'var(--neon)' : 'rgba(0,230,118,.14)', border: '1px solid var(--neon)' }}
      onClick={toggle}
      title={playing ? 'Pause' : 'Play'}
    >
      {playing ? <Square size={8} style={{ color: '#000' }} /> : <Play size={9} style={{ color: 'var(--neon)' }} />}
    </button>
  );
}

function CompareMedia({ file }) {
  if (!file?.alive) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--dim)' }}>
        File is missing on disk
      </div>
    );
  }

  if (file.category === 'image') {
    return <img src={buildPreviewUrl(file.path)} alt={file.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
  }
  if (file.category === 'video') {
    return <video src={buildPreviewUrl(file.path)} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />;
  }
  if (file.category === 'audio') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full">
        <Music size={42} style={{ color: CAT_COLOR.audio }} />
        <audio src={buildPreviewUrl(file.path)} controls style={{ width: '90%' }} />
      </div>
    );
  }
  if (file.category === 'document' && file.ext === '.pdf') {
    return <iframe src={buildPreviewUrl(file.path)} className="w-full h-full" style={{ border: 'none' }} />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <File size={42} style={{ color: 'var(--dim)' }} />
      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{file.ext || 'file'}</span>
      <button className="btn-ghost rounded px-3 py-1.5 text-xs" onClick={() => window.open(buildPreviewUrl(file.path), '_blank')}>
        Open preview
      </button>
    </div>
  );
}

function CompareModal({ group, file, onClose }) {
  const original = group.files.find((item) => item.path === group.originalPath) || group.files[0];
  const target = file.path === original.path ? group.files.find((item) => item.path !== original.path) || file : file;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(7,9,12,.97)' }}>
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <ArrowLeftRight size={15} style={{ color: 'var(--neon)' }} />
        <span className="font-bold" style={{ color: 'var(--text)' }}>Duplicate comparison</span>
        <span className="size-badge">{group.sizeFmt || fmtSize(group.size)}</span>
        <button className="btn-ghost rounded p-1.5 ml-auto" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-0 min-h-0">
        {[original, target].map((item, idx) => (
          <div key={`${item.path}-${idx}`} className="flex flex-col min-w-0" style={{ borderRight: idx === 0 ? '1px solid var(--border)' : 'none' }}>
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--s1)' }}>
              {idx === 0 && <Crown size={12} style={{ color: 'var(--neon)' }} />}
              <span className="text-xs font-black" style={{ color: idx === 0 ? 'var(--neon)' : '#ef4444' }}>
                {idx === 0 ? 'ORIGINAL' : 'DUPLICATE'}
              </span>
              <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{item.name}</span>
              {!item.alive && <span className="catbadge ml-auto" style={{ color: '#ef4444', background: 'rgba(239,68,68,.12)' }}>missing</span>}
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center" style={{ background: '#000' }}>
              <CompareMedia file={item} />
            </div>
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="mono text-xs truncate" style={{ color: 'var(--dim)' }}>{item.path}</span>
              <button className="btn-ghost rounded p-1 ml-auto" title="Copy path" onClick={() => navigator.clipboard.writeText(item.path)}>
                <Copy size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileRow({ file, group, selected, onSelect, onDelete, onMarkOriginal, onCompare }) {
  const isOriginal = file.path === group.originalPath;

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2.5"
      style={{
        borderBottom: '1px solid var(--border)',
        borderLeft: isOriginal ? '3px solid var(--neon)' : '3px solid transparent',
        background: isOriginal ? 'rgba(0,230,118,.035)' : 'transparent',
      }}
    >
      <button
        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: selected.has(file.path) ? 'var(--neon)' : 'var(--s4)', border: '1px solid var(--border2)' }}
        onClick={() => onSelect(file.path)}
      >
        {selected.has(file.path) && <span style={{ color: '#000', fontSize: 9, fontWeight: 900 }}>x</span>}
      </button>

      {isOriginal ? (
        <div className="w-14 flex items-center gap-1 flex-shrink-0">
          <Crown size={11} style={{ color: 'var(--neon)' }} />
          <span style={{ color: 'var(--neon)', fontSize: 9, fontWeight: 900 }}>ORIG</span>
        </div>
      ) : (
        <button className="btn-ghost rounded px-1.5 py-1 text-xs w-14" onClick={() => onMarkOriginal(group.id, file.path)}>
          Make
        </button>
      )}

      {file.category === 'audio' && <AudioButton file={file} />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{file.name}</span>
          <span className="size-badge">{file.sizeFmt || fmtSize(file.size)}</span>
          {!file.alive && <span className="catbadge" style={{ color: '#ef4444', background: 'rgba(239,68,68,.12)' }}>missing</span>}
        </div>
        <div className="mono text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10 }}>{file.path}</div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="btn-ghost rounded p-1" title="Compare" onClick={() => onCompare(group, file)} disabled={!file.alive}>
          <Eye size={11} />
        </button>
        <button className="btn-ghost rounded p-1" title="Copy path" onClick={() => navigator.clipboard.writeText(file.path)}>
          <Copy size={11} />
        </button>
        <button className="btn-ghost rounded p-1" title="Go to file location"
          onClick={() => runFileAction('open-location', { src: file.path })}>
          <MapPin size={11} />
        </button>
        {!isOriginal && (
          <button className="btn-danger rounded p-1" title="Delete duplicate" onClick={() => onDelete(file.path)}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function DupGroup({ group, selected, onSelect, onDelete, onMarkOriginal, onCompare }) {
  const [open, setOpen] = useState(true);
  const color = CAT_COLOR[group.cat] || '#6b7280';
  const aliveCopies = group.files.filter((file) => file.alive).length;

  return (
    <div className="mb-2 rounded-lg overflow-hidden" style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" style={{ background: 'var(--s3)' }} onClick={() => setOpen(!open)}>
        <span style={{ color: 'var(--dim)', fontSize: 10 }}>{open ? 'v' : '>'}</span>
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)', maxWidth: 300 }}>
          {group.files[0]?.name || group.hash}
        </span>
        <span className="catbadge" style={{ background: `${color}20`, color }}>{group.cat}</span>
        <span className="catbadge" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>{group.count} copies</span>
        <span className="size-badge">{group.sizeFmt || fmtSize(group.size)}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{aliveCopies} alive</span>
        <span className="text-xs ml-auto font-bold" style={{ color: '#ef4444' }}>
          {group.wasteFmt || fmtSize(group.waste)} waste
        </span>
      </div>
      {open && group.files.map((file) => (
        <FileRow
          key={file.path}
          file={file}
          group={group}
          selected={selected}
          onSelect={onSelect}
          onDelete={onDelete}
          onMarkOriginal={onMarkOriginal}
          onCompare={onCompare}
        />
      ))}
    </div>
  );
}

export default function DuplicatesTab({ rootPath = 'C:\\', includeHidden = false }) {
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [compare, setCompare] = useState(null);
  const pollRef = useRef(null);

  const loadGroups = useCallback(async () => {
    const { ok, data } = await listDuplicateGroups({ path: rootPath || 'C:\\', cat: activeSubTab, limit: 100 });
    if (!ok) return;
    setGroups(data.groups || []);
    setStatus(data.status || 'idle');
    setProgress(data.progress || {});
  }, [activeSubTab, rootPath]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadGroups, status === 'scanning' ? 1200 : 4000);
    return () => clearInterval(pollRef.current);
  }, [loadGroups, status]);

  const startScan = async () => {
    await startFmBackgroundScan({ path: rootPath || 'C:\\', includeHidden, mode: 'manual' });
    setStatus('scanning');
    setTimeout(loadGroups, 700);
  };

  const stopScan = async () => {
    await stopFmBackgroundScan();
    setStatus('stopped');
    setTimeout(loadGroups, 500);
  };

  const onSelect = (filePath) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(filePath) ? next.delete(filePath) : next.add(filePath);
      return next;
    });
  };

  const deletePath = async (filePath) => {
    if (!confirm(`Delete duplicate?\n\n${filePath}`)) return;
    await runFileAction('delete', { src: filePath });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
    loadGroups();
  };

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} selected duplicate files?`)) return;
    for (const filePath of selected) {
      await runFileAction('delete', { src: filePath });
    }
    setSelected(new Set());
    loadGroups();
  };

  const markOriginal = async (groupId, originalPath) => {
    await runFileAction('mark-original', { groupId, originalPath });
    loadGroups();
  };

  const filteredStats = useMemo(() => {
    const waste = groups.reduce((sum, group) => sum + (group.waste || 0), 0);
    const extra = groups.reduce((sum, group) => sum + Math.max(0, (group.count || group.files.length) - 1), 0);
    return { waste, extra };
  }, [groups]);

  const pct = progress.candidates > 0 ? Math.round(((progress.hashed || 0) / progress.candidates) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center flex-shrink-0 overflow-x-auto" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
        {DUP_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all flex-shrink-0"
              style={{
                background: activeSubTab === tab.id ? 'var(--s2)' : 'transparent',
                color: activeSubTab === tab.id ? 'var(--neon)' : 'var(--muted)',
                borderBottom: activeSubTab === tab.id ? '2px solid var(--neon)' : '2px solid transparent',
              }}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 px-3">
          <button className="btn-ghost rounded p-1.5" onClick={loadGroups} title="Refresh duplicates">
            <RefreshCw size={12} />
          </button>
          {status === 'scanning' ? (
            <button className="btn-danger flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" onClick={stopScan}>
              <Square size={11} /> Stop
            </button>
          ) : (
            <button className="btn-neon flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" onClick={startScan}>
              <Play size={11} /> Scan {rootPath || 'C:\\'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0" style={{ background: 'var(--s1)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold" style={{ color: groups.length ? '#ef4444' : 'var(--muted)' }}>
          {groups.length} duplicate groups
        </span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{filteredStats.extra} extra files</span>
        <span className="text-xs font-bold" style={{ color: '#ef4444' }}>{fmtSize(filteredStats.waste)} waste</span>
        {status === 'scanning' && (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--neon)' }}>
            <Loader size={11} className="anim-spin" />
            {progress.phase || 'scanning'} {pct ? `${pct}%` : ''}
          </span>
        )}
        {selected.size > 0 && (
          <>
            <span className="text-xs font-bold ml-auto" style={{ color: 'var(--neon)' }}>{selected.size} selected</span>
            <button className="btn-danger rounded px-2.5 py-1 text-xs" onClick={bulkDelete}>Delete selected</button>
            <button className="btn-ghost rounded px-2 py-1 text-xs" onClick={() => setSelected(new Set())}>Clear</button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {groups.length === 0 ? (
          <div className="h-full flex items-center justify-center flex-col gap-3">
            <AlertTriangle size={42} style={{ color: 'var(--dim)' }} />
            <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>No cached duplicates yet</div>
            <div className="text-sm text-center" style={{ color: 'var(--muted)' }}>
              Start background scan. Existing cache will show here instantly next time.
            </div>
          </div>
        ) : groups.map((group) => (
          <DupGroup
            key={group.id}
            group={group}
            selected={selected}
            onSelect={onSelect}
            onDelete={deletePath}
            onMarkOriginal={markOriginal}
            onCompare={(dupGroup, file) => setCompare({ group: dupGroup, file })}
          />
        ))}
      </div>

      {compare && (
        <CompareModal
          group={compare.group}
          file={compare.file}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}
