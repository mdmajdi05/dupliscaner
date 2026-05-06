'use client';
import { useMemo, useState } from 'react';
import { FolderOpen, ChevronDown, ChevronRight, Eye, Trash2, Copy,
         Image, Video, Music, FileText, Archive, Code2, File,
         Crown, ArrowLeftRight } from 'lucide-react';
import StatusPill from './StatusPill';

function fmtSize(b){if(!b)return'0 B';const u=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(1024));return`${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;}
function fmtDate(ts){if(!ts)return'';return new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});}

const CAT_ICON = {Photos:<Image size={12}/>,Videos:<Video size={12}/>,Audio:<Music size={12}/>,Documents:<FileText size={12}/>,Archives:<Archive size={12}/>,Code:<Code2 size={12}/>,Others:<File size={12}/>};
const CAT_COLOR= {Photos:'#f59e0b',Videos:'#ef4444',Audio:'#a855f7',Documents:'#3b82f6',Archives:'#f97316',Code:'#10b981',Others:'#6b7280'};

function FileRow({ file, fileIdx, groupId, isKeep, fileStatus, onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview, group }) {
  const st = fileStatus[file.path];
  const isDeleted = st === 'deleted';
  const [copied, setCopied] = useState(false);

  return (
    <div className={`group/row flex items-center gap-2 px-3 py-2.5 transition-all ${isDeleted?'opacity-40':''}`}
      style={{
        borderBottom:'1px solid var(--border)',
        background: isKeep ? 'rgba(0,230,118,.03)' : 'transparent',
      }}>

      {/* KEEP crown / set-keep btn */}
      <div className="flex-shrink-0 w-10 flex items-center justify-center">
        {isKeep ? (
          <div className="flex items-center gap-1">
            <Crown size={13} style={{color:'var(--neon)'}}/>
          </div>
        ) : (
          <button
            className="opacity-0 group-hover/row:opacity-100 btn-ghost rounded p-1 transition-all text-xs"
            onClick={()=>onSetKeep(groupId, fileIdx)}
            title="Make this the KEEP (original)">
            <ArrowLeftRight size={11}/>
          </button>
        )}
      </div>

      {/* status pill */}
      <div className="flex-shrink-0">
        <StatusPill
          value={st||null}
          onChange={v=>onSetStatus(file.path,v)}
          onClear={()=>onClearStatus(file.path)}
          compact
        />
      </div>

      {/* preview */}
      <button className="btn-ghost rounded p-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
        onClick={()=>onPreview(group, fileIdx)} title="Preview">
        <Eye size={12}/>
      </button>

      {/* file info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isKeep && <span className="text-xs font-black px-1.5 py-0 rounded" style={{background:'rgba(0,230,118,.15)',color:'var(--neon)',fontSize:'9px'}}>KEEP</span>}
          <span className="text-sm font-semibold truncate" style={{color:isDeleted?'var(--dim)':'var(--text)',textDecoration:isDeleted?'line-through':'none'}}>
            {file.name}
          </span>
          <span className="size-badge flex-shrink-0">{file.sizeFmt||fmtSize(file.size)}</span>
          {file.modified && <span className="text-xs flex-shrink-0 hidden xl:block" style={{color:'var(--dim)',fontSize:'10px'}}>{fmtDate(file.modified)}</span>}
        </div>
        <div className="mono text-xs truncate mt-0.5" style={{color:'var(--dim)',fontSize:'10px',maxWidth:500}}>
          {file.path}
        </div>
      </div>

      {/* right actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button className="btn-ghost rounded p-1" onClick={()=>{navigator.clipboard.writeText(file.path);setCopied(true);setTimeout(()=>setCopied(false),1200);}} title="Copy path">
          {copied?<span style={{color:'var(--neon)',fontSize:'11px'}}>✓</span>:<Copy size={11}/>}
        </button>
        <button className="btn-danger rounded p-1" onClick={()=>onDeleteFile(file.path)} title="Delete from disk">
          <Trash2 size={11}/>
        </button>
      </div>
    </div>
  );
}

function DupGroup({ dup, fileStatus, keepMap, onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview }) {
  const [open, setOpen] = useState(true);
  const catColor = CAT_COLOR[dup.cat]||'#6b7280';
  const keepIdx = keepMap[dup.id] ?? 0;

  // how many files have a status
  const reviewed = dup.files.filter(f=>fileStatus[f.path]).length;

  return (
    <div className="mb-2 rounded-lg overflow-hidden anim-fade" style={{border:'1px solid var(--border)',background:'var(--s2)'}}>
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        style={{background:'var(--s3)'}}
        onClick={()=>setOpen(!open)}>
        <span style={{color:'var(--dim)',flexShrink:0}}>{open?<ChevronDown size={12}/>:<ChevronRight size={12}/>}</span>
        <span style={{color:catColor,flexShrink:0}}>{CAT_ICON[dup.cat]||<File size={12}/>}</span>
        <span className="text-sm font-semibold truncate" style={{color:'var(--text)',maxWidth:280}}>{dup.files[0]?.name}</span>
        <span className="catbadge flex-shrink-0" style={{background:`${catColor}20`,color:catColor}}>{dup.cat}</span>
        <span className="catbadge flex-shrink-0" style={{background:'rgba(239,68,68,.12)',color:'#ef4444'}}>{dup.count} copies</span>
        <span className="size-badge flex-shrink-0">{dup.sizeFmt||fmtSize(dup.size)}</span>
        {reviewed>0 && <span className="catbadge flex-shrink-0" style={{background:'rgba(0,230,118,.1)',color:'var(--neon)'}}>{reviewed}/{dup.count} reviewed</span>}
        <span className="text-xs ml-auto flex-shrink-0 font-semibold" style={{color:'#ef4444'}}>−{dup.wasteFmt||fmtSize(dup.waste)}</span>
      </div>

      {/* keep instruction banner */}
      {open && (
        <div className="flex items-center gap-2 px-3 py-1.5" style={{background:'rgba(0,230,118,.04)',borderBottom:'1px solid rgba(0,230,118,.08)'}}>
          <Crown size={11} style={{color:'var(--neon)',flexShrink:0}}/>
          <span className="text-xs" style={{color:'var(--muted)'}}>
            <span style={{color:'var(--neon)',fontWeight:700}}>{dup.files[keepIdx]?.name}</span>
            {' '}will be kept · Click <ArrowLeftRight size={10} style={{display:'inline',verticalAlign:'middle'}}/> on any row to change the KEEP file
          </span>
        </div>
      )}

      {/* rows */}
      {open && dup.files.map((file,idx)=>(
        <FileRow key={file.path} file={file} fileIdx={idx} groupId={dup.id}
          isKeep={idx===keepIdx}
          fileStatus={fileStatus} onSetStatus={onSetStatus} onClearStatus={onClearStatus}
          onSetKeep={onSetKeep} onDeleteFile={onDeleteFile} onPreview={onPreview} group={dup}/>
      ))}
    </div>
  );
}

function FolderSection({ folder, groups, ...rest }) {
  const [open, setOpen] = useState(true);
  const totalWaste = groups.reduce((a,g)=>a+(g.waste||0),0);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-2 py-2 cursor-pointer select-none rounded-md transition-colors hover:bg-[var(--s2)]"
        onClick={()=>setOpen(!open)}>
        <span style={{color:'var(--dim)'}}>{open?<ChevronDown size={12}/>:<ChevronRight size={12}/>}</span>
        <FolderOpen size={13} style={{color:'#f59e0b',flexShrink:0}}/>
        <span className="text-xs mono truncate flex-1 font-medium" style={{color:'var(--muted)'}}>{folder}</span>
        <span className="catbadge" style={{background:'var(--s3)',color:'var(--dim)'}}>{groups.length} groups</span>
        <span className="text-xs mono" style={{color:'#ef4444'}}>−{fmtSize(totalWaste)}</span>
      </div>
      {open && (
        <div className="pl-4 mt-1" style={{borderLeft:'2px solid var(--border)'}}>
          {groups.map(g=><DupGroup key={g.id} dup={g} {...rest}/>)}
        </div>
      )}
    </div>
  );
}

export default function ResultsView({
  dups, fileStatus, keepMap, filter, status, progress,
  onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview,
}) {
  const [groupBy, setGroupBy] = useState('folder');

  const filtered = useMemo(()=>{
    let list = dups;
    if (filter.cat !== 'All') list = list.filter(d=>d.cat===filter.cat);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(d=>d.files.some(f=>f.path.toLowerCase().includes(q)||f.name.toLowerCase().includes(q)));
    }
    if (filter.folder) {
      const q = filter.folder.toLowerCase();
      list = list.filter(d=>d.files.some(f=>f.folder.toLowerCase().includes(q)));
    }
    if (filter.showStatus && filter.showStatus !== 'all') {
      if (filter.showStatus === 'unset') {
        list = list.filter(d=>d.files.some(f=>!fileStatus[f.path]));
      } else {
        list = list.filter(d=>d.files.some(f=>fileStatus[f.path]===filter.showStatus));
      }
    }
    return list;
  }, [dups, filter, fileStatus]);

  const grouped = useMemo(()=>{
    if (groupBy==='flat') return {_all:filtered};
    if (groupBy==='category') {
      const m={};
      for(const d of filtered){if(!m[d.cat])m[d.cat]=[];m[d.cat].push(d);}
      return m;
    }
    // folder
    const m={};
    for(const d of filtered){
      const folder=d.files[0]?.folder||'Unknown';
      if(!m[folder])m[folder]=[];m[folder].push(d);
    }
    return m;
  },[filtered,groupBy]);

  // empty states
  if (status==='idle') return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div style={{fontSize:48}}>🔍</div>
      <div className="text-lg font-bold" style={{color:'var(--text)'}}>Ready to scan</div>
      <div className="text-sm" style={{color:'var(--muted)'}}>Choose a folder path and press Scan</div>
    </div>
  );

  if (status==='scanning'&&dups.length===0) return (
    <div className="h-full flex items-center justify-center flex-col gap-4">
      <div className="w-14 h-14 rounded-full flex items-center justify-center shimmer" style={{background:'var(--s3)'}}>
        <div className="anim-spin" style={{color:'var(--neon)'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-18 0" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      <div className="text-sm font-bold" style={{color:'var(--neon)'}}>{progress.stage||'Scanning…'}</div>
      {progress.n>0&&<div className="mono text-xs" style={{color:'var(--muted)'}}>{progress.n.toLocaleString()} files found</div>}
      {progress.dir&&<div className="mono text-xs truncate max-w-md text-center" style={{color:'var(--dim)'}}>↳ {progress.dir}</div>}
    </div>
  );

  if ((status==='done'||status==='stopped')&&dups.length===0) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div style={{fontSize:48}}>🎉</div>
      <div className="text-lg font-bold neon-txt">No duplicates found!</div>
      <div className="text-sm" style={{color:'var(--muted)'}}>Your folder is completely clean.</div>
    </div>
  );

  const groupKeys = Object.keys(grouped).sort();
  const rest = {fileStatus,keepMap,onSetStatus,onClearStatus,onSetKeep,onDeleteFile,onPreview};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* sub-toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{borderBottom:'1px solid var(--border)',background:'var(--s1)'}}>
        <span className="text-xs" style={{color:'var(--dim)'}}>Group:</span>
        {['folder','category','flat'].map(g=>(
          <button key={g} onClick={()=>setGroupBy(g)}
            className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all"
            style={{
              background:groupBy===g?'var(--neon)':'var(--s3)',
              color:groupBy===g?'#000':'var(--muted)',
            }}>
            {g.charAt(0).toUpperCase()+g.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs mono" style={{color:'var(--dim)'}}>
          {filtered.length} groups {filtered.length!==dups.length&&`of ${dups.length}`}
        </span>
        {status==='scanning'&&<span className="text-xs font-bold anim-pulse" style={{color:'var(--neon)'}}>● LIVE</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {groupBy==='flat'
          ? filtered.map(d=><DupGroup key={d.id} dup={d} {...rest}/>)
          : groupKeys.map(k=>(
              groupBy==='folder'
                ? <FolderSection key={k} folder={k} groups={grouped[k]} {...rest}/>
                : (
                  <div key={k} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{color:CAT_COLOR[k]||'#6b7280'}}>{CAT_ICON[k]||<File size={14}/>}</span>
                      <span className="font-bold" style={{color:'var(--text)'}}>{k}</span>
                      <span className="catbadge" style={{background:'var(--s3)',color:'var(--dim)'}}>{grouped[k].length} groups</span>
                    </div>
                    {grouped[k].map(d=><DupGroup key={d.id} dup={d} {...rest}/>)}
                  </div>
                )
            ))
        }
        {filtered.length===0&&dups.length>0&&(
          <div className="flex items-center justify-center h-40 text-sm" style={{color:'var(--muted)'}}>
            No results match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
