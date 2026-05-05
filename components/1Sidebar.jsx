'use client';
import { Trash2, Clock, HardDrive, Radio, ChevronRight } from 'lucide-react';

function fmtSize(b) {
  if (!b) return '0 B';
  const u=['B','KB','MB','GB']; const i=Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}

const CAT_COLORS = {
  Photos:'#f59e0b', Videos:'#ef4444', Audio:'#a855f7',
  Documents:'#3b82f6', Archives:'#f97316', Code:'#10b981', Others:'#6b7280',
};

export default function Sidebar({ history, viewId, currentScanId, status, onSelect, onDelete, onViewLive }) {
  const isScanning = status === 'scanning';

  return (
    <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
      style={{ background:'var(--s1)', borderRight:'1px solid var(--border)' }}>

      {/* header */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black"
            style={{ background:'var(--neon)', color:'#000' }}>D</div>
          <span className="text-sm font-bold tracking-wider" style={{ color:'var(--text)' }}>DupScan</span>
        </div>
      </div>

      {/* live scan button */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
        <button
          onClick={onViewLive}
          className="si-item w-full text-left flex items-center gap-2 text-xs"
          style={{ background: viewId === null ? 'var(--s3)' : 'transparent',
                   borderLeft: viewId === null ? '2px solid var(--neon)' : '2px solid transparent' }}
        >
          {isScanning ? (
            <span className="anim-pulse" style={{ color:'var(--neon)' }}><Radio size={12} /></span>
          ) : (
            <Radio size={12} style={{ color: viewId===null ? 'var(--neon)' : 'var(--muted)' }} />
          )}
          <span style={{ color: viewId===null ? 'var(--neon)' : 'var(--muted)' }}>
            {isScanning ? 'Live Scan' : 'Current Scan'}
          </span>
          {isScanning && (
            <span className="ml-auto text-xs anim-pulse" style={{ color:'var(--neon)' }}>●</span>
          )}
        </button>
      </div>

      {/* history label */}
      <div className="px-4 py-2 flex-shrink-0">
        <span className="text-xs font-bold tracking-widest" style={{ color:'var(--dim)' }}>HISTORY</span>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {history.length === 0 && (
          <div className="px-3 py-6 text-center text-xs" style={{ color:'var(--dim)' }}>
            No saved scans yet.<br />Run a scan to see history.
          </div>
        )}
        {history.map(scan => {
          const active = viewId === scan.id;
          return (
            <div key={scan.id}
              className={`si-item ${active ? 'active' : ''} group`}
              onClick={() => onSelect(scan.id)}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  {/* path */}
                  <div className="text-xs font-medium truncate" style={{ color: active ? 'var(--text)' : 'var(--muted)', maxWidth:'130px' }}>
                    {scan.path?.split(/[/\\]/).pop() || scan.path || 'Unknown'}
                  </div>
                  {/* date */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={9} style={{ color:'var(--dim)', flexShrink:0 }} />
                    <span className="text-xs mono" style={{ color:'var(--dim)', fontSize:'10px' }}>
                      {fmtDate(scan.startedAt)}
                    </span>
                  </div>
                  {/* stats */}
                  {scan.stats && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold" style={{ color: active ? 'var(--neon)' : 'var(--muted)' }}>
                        {scan.dupCount || scan.stats?.sets || 0}
                      </span>
                      <span className="text-xs" style={{ color:'var(--dim)', fontSize:'10px' }}>groups</span>
                      <HardDrive size={9} style={{ color:'var(--dim)' }} />
                      <span className="text-xs" style={{ color:'var(--dim)', fontSize:'10px' }}>
                        {fmtSize(scan.stats?.waste || 0)}
                      </span>
                    </div>
                  )}
                </div>
                {/* delete btn */}
                <button
                  className="btn-danger rounded p-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  style={{ fontSize:'10px' }}
                  onClick={e => { e.stopPropagation(); onDelete(scan.id); }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
