'use client';
import { useState } from 'react';
import { Play, Square, Download, Monitor, FolderSearch, FileScan, PanelLeft,
         Search, SlidersHorizontal, X, CheckCircle, AlertCircle, Loader2,
         List, LayoutGrid } from 'lucide-react';

const CATS = ['All','Photos','Videos','Audio','Documents','Archives','Code','Others'];
const STATUS_FILTERS = [
  {id:'all', label:'All'},
  {id:'unset', label:'Unreviewed'},
  {id:'keep', label:'Keep'},
  {id:'review', label:'Review'},
  {id:'need', label:'Need'},
  {id:'deleted', label:'Deleted'},
];

export default function TopBar({
  status, progress, scanPath, onStart, onStop, onDownload, dups,
  isHistory, viewScan, filter, onFilterChange,
  sidebarOpen, onToggleSidebar, mainTab, onMainTab,
}) {
  const [mode, setMode]         = useState('path');
  const [inputPath, setInputPath] = useState('');
  const [targetFile, setTargetFile] = useState('');
  const [hidden, setHidden]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const scanning = status === 'scanning';
  const pct = progress.total > 0 ? Math.round((progress.done/progress.total)*100) : 0;

  const doStart = () => {
    let path = inputPath.trim();
    if (mode==='full') path = navigator.userAgent.includes('Windows') ? 'C:\\' : '/';
    if (!path) { alert('Enter a path'); return; }
    if (mode==='single' && !targetFile.trim()) { alert('Enter target file path'); return; }
    onStart({path, hidden, mode, targetFile:targetFile.trim()});
  };

  const statusInfo = {
    idle:    {color:'var(--muted)', label:''},
    scanning:{color:'var(--neon)',  label:progress.stage||'Scanning…', spin:true},
    done:    {color:'#22c55e',      label:`✓ ${dups.length} duplicate groups found`},
    stopped: {color:'var(--amber)', label:'Scan stopped'},
    error:   {color:'var(--red)',   label:progress.stage||'Error occurred'},
  }[status]||{color:'var(--muted)',label:''};

  return (
    <div style={{background:'var(--s1)',borderBottom:'1px solid var(--border)'}} className="flex-shrink-0">
      {/* ─── Row 1: controls ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* sidebar + logo */}
        <button className="btn-ghost rounded p-1.5 flex-shrink-0" onClick={onToggleSidebar} title="Toggle sidebar">
          <PanelLeft size={15}/>
        </button>
        <span className="font-black text-sm tracking-wider flex-shrink-0" style={{color:'var(--neon)'}}>DUPSCAN</span>

        {/* mode */}
        <div className="flex rounded overflow-hidden flex-shrink-0" style={{border:'1px solid var(--border)'}}>
          {[
            {id:'path',  icon:<FolderSearch size={11}/>, label:'Folder'},
            {id:'full',  icon:<Monitor size={11}/>,      label:'Full System'},
            {id:'single',icon:<FileScan size={11}/>,     label:'File Dups'},
          ].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-all"
              style={{
                background:mode===m.id?'var(--s4)':'transparent',
                color:mode===m.id?'var(--neon)':'var(--muted)',
                borderRight:'1px solid var(--border)',
              }}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>

        {/* path inputs */}
        {mode!=='full' && (
          <input className="inp flex-1 px-3 py-1.5 min-w-0"
            value={inputPath} onChange={e=>setInputPath(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!scanning&&doStart()}
            placeholder={mode==='single'?'Root folder to search in…':'Folder to scan e.g. /home/user'}
            disabled={scanning}/>
        )}
        {mode==='full' && (
          <div className="flex-1 px-3 py-1.5 text-xs mono rounded" style={{background:'var(--s2)',border:'1px solid var(--border)',color:'var(--dim)'}}>
            Scans entire filesystem — may take several minutes
          </div>
        )}
        {mode==='single' && (
          <input className="inp flex-1 px-3 py-1.5 min-w-0"
            value={targetFile} onChange={e=>setTargetFile(e.target.value)}
            placeholder="Target file path e.g. /home/user/photo.jpg"
            disabled={scanning}/>
        )}

        {/* hidden */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none flex-shrink-0" style={{color:'var(--muted)'}}>
          <input type="checkbox" className="ck" checked={hidden} onChange={e=>setHidden(e.target.checked)} disabled={scanning}/>
          Hidden
        </label>

        {/* start/stop */}
        {!scanning
          ? <button onClick={doStart} className="btn-neon flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-bold flex-shrink-0">
              <Play size={13}/> Scan
            </button>
          : <button onClick={onStop} className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-bold flex-shrink-0"
              style={{background:'rgba(255,71,87,.15)',color:'var(--red)',border:'1px solid rgba(255,71,87,.4)'}}>
              <Square size={13}/> Stop
            </button>
        }

        {/* right-side actions */}
        {dups.length>0 && (
          <button onClick={onDownload} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded text-xs flex-shrink-0">
            <Download size={13}/> Report
          </button>
        )}

        {/* list / gallery toggle */}
        <div className="flex rounded overflow-hidden flex-shrink-0" style={{border:'1px solid var(--border)'}}>
          <button onClick={()=>onMainTab('list')}
            className="flex items-center gap-1 px-2.5 py-1.5 transition-all"
            style={{background:mainTab==='list'?'var(--s4)':'transparent',color:mainTab==='list'?'var(--neon)':'var(--muted)'}}>
            <List size={13}/>
          </button>
          <button onClick={()=>onMainTab('gallery')}
            className="flex items-center gap-1 px-2.5 py-1.5 transition-all"
            style={{background:mainTab==='gallery'?'var(--s4)':'transparent',color:mainTab==='gallery'?'var(--neon)':'var(--muted)'}}>
            <LayoutGrid size={13}/>
          </button>
        </div>

        <button onClick={()=>setShowFilters(!showFilters)}
          className="btn-ghost rounded p-1.5 flex-shrink-0"
          style={{color:showFilters?'var(--neon)':'var(--muted)',borderColor:showFilters?'var(--neon2)':'var(--border)'}}>
          <SlidersHorizontal size={15}/>
        </button>
      </div>

      {/* ─── Row 2: progress ─────────────────────────────────────── */}
      {(scanning||(status!=='idle'&&dups.length>0)) && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 mb-1">
            {statusInfo.spin && <Loader2 size={12} className="anim-spin flex-shrink-0" style={{color:statusInfo.color}}/>}
            <span className="text-xs" style={{color:statusInfo.color}}>{statusInfo.label}</span>
            {scanning&&progress.n>0 && <span className="mono text-xs ml-2" style={{color:'var(--dim)'}}>{progress.n.toLocaleString()} files</span>}
            {scanning&&progress.total>0 && <span className="mono text-xs" style={{color:'var(--dim)'}}>{progress.done.toLocaleString()}/{progress.total.toLocaleString()} ({pct}%)</span>}
          </div>
          {scanning&&progress.total>0 && <div className="pbar"><div className="pfill" style={{width:`${pct}%`}}/></div>}
          {scanning&&progress.dir && <div className="mono text-xs mt-1 truncate" style={{color:'var(--dim)',maxWidth:'70%'}}>↳ {progress.dir}</div>}
        </div>
      )}

      {/* ─── History banner ──────────────────────────────────────── */}
      {isHistory&&viewScan && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs" style={{background:'rgba(250,164,2,.05)',borderTop:'1px solid rgba(250,164,2,.1)'}}>
          <span style={{color:'var(--amber)'}}>📂</span>
          <span className="mono truncate" style={{color:'var(--muted)'}}>{viewScan.path}</span>
          <span style={{color:'var(--dim)'}}>·</span>
          <span style={{color:'var(--dim)'}}>{new Date(viewScan.startedAt).toLocaleString()}</span>
        </div>
      )}

      {/* ─── Filters row ─────────────────────────────────────────── */}
      {showFilters && (
        <div className="px-3 pb-3 pt-2 flex flex-wrap items-center gap-2" style={{borderTop:'1px solid var(--border)',background:'var(--s2)'}}>
          {/* category */}
          <div className="flex flex-wrap gap-1">
            {CATS.map(c=>(
              <button key={c} onClick={()=>onFilterChange(f=>({...f,cat:c}))}
                className="px-2.5 py-1 text-xs rounded-full font-semibold transition-all"
                style={{
                  background:filter.cat===c?'var(--neon)':'var(--s3)',
                  color:filter.cat===c?'#000':'var(--muted)',
                  border:`1px solid ${filter.cat===c?'var(--neon)':'var(--border)'}`,
                }}>
                {c}
              </button>
            ))}
          </div>

          <div className="w-px h-5 mx-1" style={{background:'var(--border)'}}/>

          {/* status filter */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map(s=>(
              <button key={s.id} onClick={()=>onFilterChange(f=>({...f,showStatus:s.id}))}
                className="px-2.5 py-1 text-xs rounded-full font-semibold transition-all"
                style={{
                  background:filter.showStatus===s.id?'var(--s4)':'transparent',
                  color:filter.showStatus===s.id?'var(--text)':'var(--dim)',
                  border:`1px solid ${filter.showStatus===s.id?'var(--border2)':'transparent'}`,
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* search */}
          <div className="flex items-center gap-1.5 ml-auto rounded-lg px-3 py-1.5" style={{background:'var(--s3)',border:'1px solid var(--border)'}}>
            <Search size={11} style={{color:'var(--dim)'}}/>
            <input className="bg-transparent outline-none text-xs mono" style={{width:160,color:'var(--text)',caretColor:'var(--neon)'}}
              placeholder="Search filename or path…"
              value={filter.search} onChange={e=>onFilterChange(f=>({...f,search:e.target.value}))}/>
            {filter.search && <button onClick={()=>onFilterChange(f=>({...f,search:''}))} style={{color:'var(--dim)'}}><X size={11}/></button>}
          </div>

          {/* folder filter */}
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{background:'var(--s3)',border:'1px solid var(--border)'}}>
            <FolderSearch size={11} style={{color:'var(--dim)'}}/>
            <input className="bg-transparent outline-none text-xs mono" style={{width:180,color:'var(--text)',caretColor:'var(--neon)'}}
              placeholder="Filter by folder…"
              value={filter.folder} onChange={e=>onFilterChange(f=>({...f,folder:e.target.value}))}/>
            {filter.folder && <button onClick={()=>onFilterChange(f=>({...f,folder:''}))} style={{color:'var(--dim)'}}><X size={11}/></button>}
          </div>
        </div>
      )}
    </div>
  );
}
