'use client';
import { X, Trash2, Edit2, Move, Copy, ExternalLink, MapPin, Maximize2,
         ChevronLeft, ChevronRight, Music, Video, File } from 'lucide-react';
import { useState } from 'react';

function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function previewUrl(p) { return `/api/preview?p=${encodeURIComponent(p)}`; }

function MediaContent({ file }) {
  const [imgErr, setImgErr] = useState(false);
  const url = previewUrl(file.path);
  const cat = file.category;

  if (cat === 'image' && !imgErr) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#000' }}>
      <img src={url} alt={file.name} onError={() => setImgErr(true)}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );

  if (cat === 'video') return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#000' }}>
      <video src={url} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );

  if (cat === 'audio') return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-5" style={{ background: 'var(--s3)' }}>
      <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'var(--s4)' }}>
        <Music size={44} style={{ color: '#a855f7' }} />
      </div>
      <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{file.name}</div>
      <audio src={url} controls style={{ width: '80%' }} />
    </div>
  );

  if (cat === 'document' && ['.pdf', '.txt', '.md', '.json', '.csv', '.html', '.css'].includes(file.ext)) return (
    <iframe src={url} className="w-full h-full" style={{ border: 'none' }} />
  );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--s3)' }}>
      <File size={48} style={{ color: 'var(--dim)' }} />
      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{file.ext || 'Unknown'}</span>
      <a href={url} download={file.name} className="btn-ghost rounded px-4 py-2 text-xs">Download to view</a>
    </div>
  );
}

export default function FMPreviewModal({ file, onClose, onAction }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(7,9,12,.97)', backdropFilter: 'blur(20px)' }}>
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="font-bold truncate" style={{ color: 'var(--text)' }}>{file.name}</span>
        <span className="size-badge">{file.sizeFmt || fmtSize(file.size)}</span>
        <span className="mono text-xs" style={{ color: 'var(--dim)', fontSize: 10 }}>{fmtDate(file.modified)}</span>
        <div className="flex-1" />

        {/* actions */}
        <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => { navigator.clipboard.writeText(file.path); }}>
          <Copy size={11} /> Copy path
        </button>
        <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => onAction('open', file)}>
          <ExternalLink size={11} /> Open
        </button>
        <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => onAction('open-location', file)}>
          <MapPin size={11} /> Location
        </button>
        <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => onAction('rename', file)}>
          <Edit2 size={11} /> Rename
        </button>
        <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => onAction('move', file)}>
          <Move size={11} /> Move
        </button>
        <button className="btn-danger flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs"
          onClick={() => { onAction('delete', file); onClose(); }}>
          <Trash2 size={11} /> Delete
        </button>
        <button className="btn-ghost rounded p-1.5" onClick={onClose}><X size={16} /></button>
      </div>

      {/* media */}
      <div className="flex-1 overflow-hidden">
        <MediaContent file={file} />
      </div>

      {/* footer meta */}
      <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="mono text-xs truncate" style={{ color: 'var(--dim)', fontSize: 10 }}>{file.path}</span>
      </div>
    </div>
  );
}
