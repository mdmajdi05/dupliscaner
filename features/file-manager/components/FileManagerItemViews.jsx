import {
  File,
  FileText,
  FolderOpen,
  Image,
  MapPin,
  Move,
  Music,
  Pause,
  Play,
  Video,
  Copy,
  Edit2,
  ExternalLink,
  RefreshCw,
  Trash2,
  X,
  Loader,
} from 'lucide-react';
import { fmtDate } from '../../../shared/utils/formatters';

const CAT_COLOR = {
  image: '#f59e0b',
  video: '#ef4444',
  audio: '#a855f7',
  document: '#3b82f6',
  other: '#6b7280',
  folder: '#f59e0b',
};

const CAT_ICON = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  other: File,
  folder: FolderOpen,
};

export function FileGridItem({
  file, zoom, selected, onSelect, onOpen, onAction, playingAudio, onPlayAudio,
}) {
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
        width: '100%',
        height: '100%',
        border: isSel ? '2px solid var(--neon)' : '2px solid var(--border)',
        background: 'var(--s2)',
        boxShadow: isSel ? '0 0 10px rgba(0,230,118,.2)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) onSelect(file.path, 'toggle');
        else if (file.type === 'dir') onAction('open-folder', file);
        else onOpen(file);
      }}
    >
      <div
        className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ opacity: isSel ? 1 : undefined }}
        onClick={(e) => { e.stopPropagation(); onSelect(file.path, 'toggle'); }}
      >
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: isSel ? 'var(--neon)' : 'rgba(7,9,12,.7)', border: '1.5px solid var(--border2)' }}
        >
          {isSel && <span style={{ color: '#000', fontSize: 11, fontWeight: 800 }}>✓</span>}
        </div>
      </div>

      <div style={{ width: '100%', flex: '1 1 auto', minHeight: 0, background: 'var(--s3)', position: 'relative', overflow: 'hidden' }}>
        {isImg ? (
          <img
            src={`/api/preview?p=${encodeURIComponent(file.path)}`}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Ic size={Math.max(16, Math.min(40, sz / 4))} style={{ color: CAT_COLOR[file.category] || 'var(--dim)' }} />
            {sz > 80 && <span style={{ fontSize: 9, color: 'var(--dim)' }}>{file.ext}</span>}
          </div>
        )}

        {isAudio && (
          <button
            className="absolute bottom-1 right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all"
            style={{ background: isPlaying ? 'var(--neon)' : 'rgba(0,230,118,.8)' }}
            onClick={(e) => { e.stopPropagation(); onPlayAudio(isPlaying ? null : file.path); }}
          >
            {isPlaying ? <Pause size={11} style={{ color: '#000' }} /> : <Play size={11} style={{ color: '#000' }} />}
          </button>
        )}

        {file.dupCount > 0 && (
          <div
            className="absolute top-1.5 right-1.5 px-1.5 rounded text-xs font-bold"
            style={{ background: 'rgba(239,68,68,.9)', color: '#fff', fontSize: 9 }}
          >
            {file.dupCount} dup
          </div>
        )}
      </div>

      {sz > 70 && (
        <div className="px-1.5 py-1.5 flex-shrink-0">
          <div className="font-semibold truncate" style={{ fontSize: Math.max(10, Math.min(13, sz / 12)), color: 'var(--text)' }}>
            {file.name}
          </div>
          {sz > 100 && <div className="mono mt-0.5" style={{ fontSize: 9, color: 'var(--dim)' }}>{file.sizeFmt}</div>}
        </div>
      )}
    </div>
  );
}

export function FileListItem({
  file, selected, onSelect, onOpen, onAction, playingAudio, onPlayAudio,
}) {
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
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) onSelect(file.path, 'toggle');
        else if (file.type === 'dir') onAction('open-folder', file);
        else onOpen(file);
      }}
    >
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ opacity: isSel ? 1 : undefined, background: isSel ? 'var(--neon)' : 'var(--s3)', border: '1.5px solid var(--border2)' }}
        onClick={(e) => { e.stopPropagation(); onSelect(file.path, 'toggle'); }}
      >
        {isSel && <span style={{ color: '#000', fontSize: 10, fontWeight: 800 }}>✓</span>}
      </div>

      <Ic size={14} style={{ color: CAT_COLOR[file.category] || 'var(--dim)', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{file.name}</div>
        <div className="mono text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10 }}>{file.path}</div>
      </div>

      {isAudio && (
        <button
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: isPlaying ? 'var(--neon)' : 'rgba(0,230,118,.15)', border: '1px solid var(--neon)' }}
          onClick={(e) => { e.stopPropagation(); onPlayAudio(isPlaying ? null : file.path); }}
        >
          {isPlaying ? <Pause size={9} style={{ color: '#000' }} /> : <Play size={9} style={{ color: 'var(--neon)' }} />}
        </button>
      )}

      {file.dupCount > 0 && (
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10 }}>
          {file.dupCount} dup
        </span>
      )}

      <span className="flex-shrink-0 mono text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10, width: 72, textAlign: 'right' }}>{file.sizeFmt}</span>
      <span className="flex-shrink-0 text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10, width: 108, textAlign: 'right' }}>{fmtDate(file.modified)}</span>

      {file.type !== 'dir' ? (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="btn-ghost rounded p-1" title="Copy path" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(file.path); }}>
            <Copy size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Go to file location" onClick={(e) => { e.stopPropagation(); onAction('open-location', file); }}>
            <MapPin size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Open file" onClick={(e) => { e.stopPropagation(); onAction('open', file); }}>
            <ExternalLink size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Scan this file for duplicates" onClick={(e) => { e.stopPropagation(); onAction('scan-duplicates', file); }}>
            <RefreshCw size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Rename" onClick={(e) => { e.stopPropagation(); onAction('rename', file); }}>
            <Edit2 size={11} />
          </button>
          <button className="btn-ghost rounded p-1" title="Move" onClick={(e) => { e.stopPropagation(); onAction('move', file); }}>
            <Move size={11} />
          </button>
          <button className="btn-danger rounded p-1" title="Delete" onClick={(e) => { e.stopPropagation(); onAction('delete', file); }}>
            <Trash2 size={11} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="btn-neon rounded px-1.5 py-1 text-xs" title="Scan this folder" onClick={(e) => { e.stopPropagation(); onAction('scan-folder', file); }}>
            Scan
          </button>
        </div>
      )}
    </div>
  );
}

export function BulkBar({ count, onDelete, onCopy, onMove, onClear }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{ background: 'rgba(0,230,118,.08)', borderBottom: '1px solid rgba(0,230,118,.2)' }}>
      <span className="text-xs font-bold" style={{ color: 'var(--neon)' }}>{count} selected</span>
      <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onCopy}><Copy size={11} /> Copy paths</button>
      <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onMove}><Move size={11} /> Move</button>
      <button className="btn-danger flex items-center gap-1.5 px-2.5 py-1 rounded text-xs" onClick={onDelete}><Trash2 size={11} /> Delete</button>
      <button className="btn-ghost rounded px-2 py-1 text-xs ml-auto" onClick={onClear}><X size={11} /></button>
    </div>
  );
}

export function AutoFolderPill({ folder, count, scanning, onClick }) {
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

