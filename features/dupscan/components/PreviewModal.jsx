'use client';
import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Crown, ArrowLeftRight,
         Volume2, VolumeX, Maximize2, File, Music, Video } from 'lucide-react';
import StatusPill from './StatusPill';
import { buildPreviewUrl } from '../../../shared/utils/preview';
import { getPreviewFileType } from '../../../shared/utils/fileType';

function fmtSize(b){if(!b)return'0 B';const u=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(1024));return`${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;}
function fmtDate(ts){if(!ts)return'';return new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});}

function previewUrl(p){return buildPreviewUrl(p);}

const CAT_COLOR={Photos:'#f59e0b',Videos:'#ef4444',Audio:'#a855f7',Documents:'#3b82f6',Archives:'#f97316',Code:'#10b981',Others:'#6b7280'};

function MediaContent({ file, sz }) {
  const type = getPreviewFileType(file.ext);
  const [muted, setMuted] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const url = previewUrl(file.path);

  if (type==='image'&&!imgErr) return (
    <div className="relative w-full h-full flex items-center justify-center" style={{background:'#000'}}>
      <img src={url} alt={file.name} onError={()=>setImgErr(true)}
        style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
    </div>
  );

  if (type==='video') return (
    <div className="relative w-full h-full flex items-center justify-center" style={{background:'#000'}}>
      <video src={url} controls muted={muted}
        style={{maxWidth:'100%',maxHeight:'100%'}}/>
      <button className="absolute top-2 right-2 btn-ghost rounded p-1.5" onClick={()=>setMuted(!muted)}>
        {muted?<VolumeX size={14}/>:<Volume2 size={14}/>}
      </button>
    </div>
  );

  if (type==='audio') return (
    <div className="flex flex-col items-center justify-center gap-4 h-full" style={{background:'var(--s3)'}}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{background:'var(--s4)'}}>
        <Music size={36} style={{color:'#a855f7'}}/>
      </div>
      <audio src={url} controls style={{width:'80%'}}/>
    </div>
  );

  if (type==='pdf') return <iframe src={url} className="w-full h-full" style={{border:'none'}}/>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full" style={{background:'var(--s3)'}}>
      <File size={44} style={{color:'var(--dim)'}}/>
      <span className="text-xs font-bold" style={{color:'var(--muted)'}}>{file.ext||'Unknown type'}</span>
      <a href={url} download={file.name} className="btn-ghost rounded px-4 py-2 text-xs">Download to view</a>
    </div>
  );
}

function FilePane({ file, fileIdx, groupId, isKeep, fileStatus, onSetStatus, onClearStatus, onSetKeep, onDeleteFile }) {
  const st = fileStatus[file.path];
  const isDeleted = st === 'deleted';

  return (
    <div className="flex flex-col min-w-0 flex-1 rounded-xl overflow-hidden"
      style={{
        border:`2px solid ${isKeep?'var(--neon)':'var(--border2)'}`,
        background:'var(--s2)',
        boxShadow: isKeep?'0 0 20px rgba(0,230,118,.15)':'none',
        opacity: isDeleted ? 0.5 : 1,
      }}>
      {/* pane header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{background:isKeep?'rgba(0,230,118,.08)':'var(--s3)',borderBottom:`1px solid ${isKeep?'rgba(0,230,118,.2)':'var(--border)'}`}}>
        {isKeep
          ? <span className="flex items-center gap-1 font-black text-xs" style={{color:'var(--neon)'}}><Crown size={12}/>KEEP</span>
          : <span className="font-bold text-xs" style={{color:'#ef4444'}}>COPY {fileIdx}</span>
        }
        <div className="flex-1"/>
        {isDeleted&&<span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{background:'rgba(107,114,128,.3)',color:'#6b7280'}}>DELETED</span>}
        <span className="size-badge">{file.sizeFmt||fmtSize(file.size)}</span>
        <button className="ml-auto" onClick={()=>window.open(previewUrl(file.path),'_blank')}>
          <Maximize2 size={12} style={{color:'var(--dim)'}}/>
        </button>
      </div>

      {/* media */}
      <div className="flex-1 overflow-hidden" style={{minHeight:200}}>
        <MediaContent file={file}/>
      </div>

      {/* file meta */}
      <div className="px-3 py-2 flex-shrink-0" style={{borderTop:'1px solid var(--border)',background:'var(--s2)'}}>
        <div className="text-sm font-semibold truncate" style={{color:'var(--text)'}}>{file.name}</div>
        <div className="mono text-xs truncate mt-0.5" style={{color:'var(--dim)',fontSize:'10px'}}>{file.path}</div>
        {file.modified && <div className="text-xs mt-0.5" style={{color:'var(--dim)',fontSize:'10px'}}>Modified: {fmtDate(file.modified)}</div>}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 flex-shrink-0 flex-wrap">
        <StatusPill value={st||null} onChange={v=>onSetStatus(file.path,v)} onClear={()=>onClearStatus(file.path)}/>
        {!isKeep && (
          <button className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            onClick={()=>onSetKeep(groupId,fileIdx)}>
            <ArrowLeftRight size={11}/> Make KEEP
          </button>
        )}
        {!isDeleted && (
          <button className="btn-danger flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ml-auto"
            onClick={()=>onDeleteFile(file.path)}>
            <Trash2 size={11}/> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function PreviewModal({ group, startIdx, fileStatus, keepMap, onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onClose }) {
  const [compareIdx, setCompareIdx] = useState(Math.max(1, startIdx||1));
  const files = group.files||[];
  const keepIdx = keepMap[group.id]??0;
  const catColor = CAT_COLOR[group.cat]||'#6b7280';

  useEffect(()=>{
    const h=e=>{
      if(e.key==='Escape')onClose();
      if(e.key==='ArrowRight')setCompareIdx(i=>Math.min(i+1,files.length-1));
      if(e.key==='ArrowLeft')setCompareIdx(i=>Math.max(i,1)===1?1:i-1);
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[onClose,files.length]);

  const compareFile = files[compareIdx===keepIdx ? (compareIdx+1 < files.length ? compareIdx+1 : 0) : compareIdx];
  const compareFileIdx = files.indexOf(compareFile);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{background:'rgba(7,9,12,.97)',backdropFilter:'blur(20px)'}}>
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{borderBottom:'1px solid var(--border)'}}>
        <Crown size={14} style={{color:'var(--neon)'}}/>
        <span className="font-bold" style={{color:'var(--text)'}}>{group.files[0]?.name}</span>
        <span className="catbadge" style={{background:`${catColor}20`,color:catColor}}>{group.cat}</span>
        <span className="size-badge">{group.sizeFmt||fmtSize(group.size)}</span>
        <span className="text-xs" style={{color:'#ef4444'}}>−{group.wasteFmt||fmtSize(group.waste)}</span>

        {/* copy navigator */}
        {files.length > 2 && (
          <div className="flex items-center gap-1 ml-4">
            <span className="text-xs" style={{color:'var(--dim)'}}>Compare with:</span>
            <button className="btn-ghost rounded p-1" onClick={()=>setCompareIdx(i=>Math.max(1,i-1))} disabled={compareIdx<=1}>
              <ChevronLeft size={13}/>
            </button>
            <span className="text-xs mono px-2" style={{color:'var(--muted)'}}>{compareIdx}/{files.length-1}</span>
            <button className="btn-ghost rounded p-1" onClick={()=>setCompareIdx(i=>Math.min(files.length-1,i+1))} disabled={compareIdx>=files.length-1}>
              <ChevronRight size={13}/>
            </button>
          </div>
        )}

        <div className="flex-1"/>
        <button className="btn-ghost rounded p-1.5" onClick={onClose}><X size={16}/></button>
      </div>

      {/* two panes side by side */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* KEEP pane */}
        <FilePane file={files[keepIdx]} fileIdx={keepIdx} groupId={group.id}
          isKeep={true} fileStatus={fileStatus}
          onSetStatus={onSetStatus} onClearStatus={onClearStatus}
          onSetKeep={onSetKeep} onDeleteFile={onDeleteFile}/>

        {/* COMPARE pane */}
        {compareFile && compareFile!==files[keepIdx] && (
          <FilePane file={compareFile} fileIdx={compareFileIdx} groupId={group.id}
            isKeep={false} fileStatus={fileStatus}
            onSetStatus={onSetStatus} onClearStatus={onClearStatus}
            onSetKeep={onSetKeep} onDeleteFile={onDeleteFile}/>
        )}
      </div>

      {/* all copies thumbnails strip */}
      <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0 overflow-x-auto" style={{borderTop:'1px solid var(--border)'}}>
        <span className="text-xs flex-shrink-0" style={{color:'var(--dim)'}}>All {files.length} copies:</span>
        {files.map((f,i)=>{
          const st = fileStatus[f.path];
          const isK = i===keepIdx;
          return (
            <button key={f.path} onClick={()=>!isK&&setCompareIdx(i)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs mono transition-all"
              style={{
                background: isK?'rgba(0,230,118,.15)': compareIdx===i?'var(--s4)':'var(--s2)',
                color: isK?'var(--neon)': compareIdx===i?'var(--text)':'var(--muted)',
                border: `1px solid ${isK?'var(--neon)':compareIdx===i?'var(--border2)':'var(--border)'}`,
                maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>
              {isK&&<Crown size={10}/>}
              {st && <span style={{color:STATUS_COLOR_MAP[st]||'var(--dim)'}}>{STATUS_ICONS[st]}</span>}
              {f.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_COLOR_MAP={keep:'#22c55e',review:'#3b82f6',need:'#a855f7',deleted:'#6b7280'};
const STATUS_ICONS={keep:'🛡',review:'👁',need:'🔖',deleted:'🗑'};
