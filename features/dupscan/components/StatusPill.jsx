'use client';
import { useState, useRef, useEffect } from 'react';
import { Shield, Eye, Bookmark, Trash2, X, ChevronDown } from 'lucide-react';

const OPTIONS = [
  { id:'keep',   label:'Keep',   icon:<Shield size={11}/>,   bg:'rgba(34,197,94,.15)',   color:'#22c55e', border:'rgba(34,197,94,.4)' },
  { id:'review', label:'Review', icon:<Eye size={11}/>,      bg:'rgba(59,130,246,.15)',  color:'#3b82f6', border:'rgba(59,130,246,.4)' },
  { id:'need',   label:'Need',   icon:<Bookmark size={11}/>, bg:'rgba(168,85,247,.15)',  color:'#a855f7', border:'rgba(168,85,247,.4)' },
  { id:'deleted',label:'Deleted',icon:<Trash2 size={11}/>,   bg:'rgba(107,114,128,.15)', color:'#6b7280', border:'rgba(107,114,128,.4)' },
];

export default function StatusPill({ value, onChange, onClear, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const opt = OPTIONS.find(o=>o.id===value) || null;

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return ()=>document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={()=>setOpen(!open)}
        className="flex items-center gap-1 rounded-full transition-all text-xs font-semibold"
        style={{
          background: opt ? opt.bg : 'var(--s3)',
          color:       opt ? opt.color : 'var(--dim)',
          border:      `1px solid ${opt ? opt.border : 'var(--border)'}`,
          padding:     compact ? '2px 7px' : '3px 10px',
          whiteSpace:  'nowrap',
        }}>
        {opt ? opt.icon : null}
        {!compact && <span>{opt ? opt.label : 'Set status'}</span>}
        {compact && opt && <span>{opt.label}</span>}
        {!compact && <ChevronDown size={9} style={{marginLeft:2}}/>}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 rounded-lg overflow-hidden shadow-xl"
          style={{
            background:'var(--s3)', border:'1px solid var(--border2)',
            minWidth:130, left:0, top:'100%',
          }}>
          {OPTIONS.map(o=>(
            <button key={o.id}
              onClick={()=>{ onChange(o.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all text-left"
              style={{
                background: value===o.id ? o.bg : 'transparent',
                color: value===o.id ? o.color : 'var(--muted)',
              }}
              onMouseEnter={e=>e.currentTarget.style.background=o.bg}
              onMouseLeave={e=>e.currentTarget.style.background=value===o.id?o.bg:'transparent'}>
              <span style={{color:o.color}}>{o.icon}</span>
              {o.label}
              {value===o.id && <span className="ml-auto" style={{color:o.color}}>✓</span>}
            </button>
          ))}
          {value && (
            <>
              <div style={{borderTop:'1px solid var(--border)',margin:'2px 0'}}/>
              <button onClick={()=>{ onClear(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold"
                style={{color:'var(--dim)'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--s4)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <X size={11}/> Clear status
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
