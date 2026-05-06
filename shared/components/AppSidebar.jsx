'use client';

import { Trash2, Clock, HardDrive, Radio, FolderSearch } from 'lucide-react';
import { fmtSize, fmtDateTimeShort } from '../utils/formatters';

export default function AppSidebar({
  history,
  viewId,
  status,
  onSelect,
  onDelete,
  onViewLive,
  onOpenFM,
  isFMActive,
}) {
  const isScanning = status === 'scanning';

  return (
    <div
      className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--s1)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-xs font-black"
            style={{ background: 'var(--neon)', color: '#000' }}
          >
            D
          </div>
          <span className="text-sm font-bold tracking-wider" style={{ color: 'var(--text)' }}>DupScan</span>
        </div>
      </div>

      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onOpenFM}
          className="si-item w-full text-left flex items-center gap-2 text-xs"
          style={{
            background: isFMActive ? 'var(--s3)' : 'transparent',
            borderLeft: isFMActive ? '2px solid var(--neon)' : '2px solid transparent',
          }}
        >
          <FolderSearch size={12} style={{ color: isFMActive ? 'var(--neon)' : 'var(--muted)' }} />
          <span style={{ color: isFMActive ? 'var(--neon)' : 'var(--muted)', fontWeight: 600 }}>
            File manager with gallery
          </span>
        </button>
      </div>

      <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onViewLive}
          className="si-item w-full text-left flex items-center gap-2 text-xs"
          style={{
            background: viewId === null && !isFMActive ? 'var(--s3)' : 'transparent',
            borderLeft: viewId === null && !isFMActive ? '2px solid var(--neon)' : '2px solid transparent',
          }}
        >
          {isScanning ? (
            <span className="anim-pulse" style={{ color: 'var(--neon)' }}><Radio size={12} /></span>
          ) : (
            <Radio size={12} style={{ color: viewId === null && !isFMActive ? 'var(--neon)' : 'var(--muted)' }} />
          )}
          <span style={{ color: viewId === null && !isFMActive ? 'var(--neon)' : 'var(--muted)' }}>
            {isScanning ? 'Live Scan' : 'DupScan'}
          </span>
          {isScanning && (
            <span className="ml-auto text-xs anim-pulse" style={{ color: 'var(--neon)' }}>●</span>
          )}
        </button>
      </div>

      <div className="px-4 py-2 flex-shrink-0">
        <span className="text-xs font-bold tracking-widest" style={{ color: 'var(--dim)' }}>HISTORY</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {history.length === 0 && (
          <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--dim)' }}>
            No saved scans yet.<br />Run a scan to see history.
          </div>
        )}
        {history.map((scan) => {
          const active = viewId === scan.id && !isFMActive;
          return (
            <div
              key={scan.id}
              className={`si-item ${active ? 'active' : ''} group`}
              onClick={() => onSelect(scan.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(scan.id)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    style={{ color: active ? 'var(--text)' : 'var(--muted)', maxWidth: '130px' }}
                  >
                    {scan.path?.split(/[/\\]/).pop() || scan.path || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={9} style={{ color: 'var(--dim)', flexShrink: 0 }} />
                    <span className="text-xs mono" style={{ color: 'var(--dim)', fontSize: '10px' }}>
                      {fmtDateTimeShort(scan.startedAt)}
                    </span>
                  </div>
                  {scan.stats && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold" style={{ color: active ? 'var(--neon)' : 'var(--muted)' }}>
                        {scan.dupCount || scan.stats?.sets || 0}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--dim)', fontSize: '10px' }}>groups</span>
                      <HardDrive size={9} style={{ color: 'var(--dim)' }} />
                      <span className="text-xs" style={{ color: 'var(--dim)', fontSize: '10px' }}>
                        {fmtSize(scan.stats?.waste || 0)}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-danger rounded p-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  style={{ fontSize: '10px' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(scan.id); }}
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
