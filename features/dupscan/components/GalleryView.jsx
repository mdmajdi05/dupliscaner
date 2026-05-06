'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Crown, ArrowLeftRight, Trash2, ZoomIn, ZoomOut, Eye, Image,
         Video, Music, FileText, File, Shield, Bookmark, CheckCircle2 } from 'lucide-react';
import StatusPill from './StatusPill';
import { getLazyDups } from '../../../lib/scan-controller';

function fmtSize(b){if(!b)return'0 B';const u=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(1024));return`${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;}

const IMG_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg','.avif','.tiff','.tif']);
const VID_EXTS = new Set(['.mp4','.webm','.mkv','.avi','.mov','.wmv','.m4v','.3gp']);
const AUD_EXTS = new Set(['.mp3','.wav','.flac','.aac','.ogg','.m4a','.opus','.wma']);

function getType(ext){
  const e=(ext||'').toLowerCase();
  if(IMG_EXTS.has(e))return'image';
  if(VID_EXTS.has(e))return'video';
  if(AUD_EXTS.has(e))return'audio';
  if(e==='.pdf')return'pdf';
  return'other';
}

const STATUS_ICON = {
  keep:    <Shield size={10} style={{color:'#22c55e'}}/>,
  review:  <Eye size={10} style={{color:'#3b82f6'}}/>,
  need:    <Bookmark size={10} style={{color:'#a855f7'}}/>,
  deleted: <Trash2 size={10} style={{color:'#6b7280'}}/>,
};
const STATUS_COLOR = {keep:'#22c55e',review:'#3b82f6',need:'#a855f7',deleted:'#6b7280'};

function ThumbnailCard({ file, fileIdx, groupId, isKeep, status, tileSize, onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview, group }) {
  const type = getType(file.ext);
  const previewUrl = `/api/preview?p=${encodeURIComponent(file.path)}`;
  const st = status[file.path];
  const isDeleted = st === 'deleted';
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const sz = {sm:80,md:130,lg:180,xl:230}[tileSize]||130;
  const labelSz = {sm:10,md:11,lg:12,xl:13}[tileSize]||11;

  return (
    <div
      className="relative rounded-lg overflow-hidden transition-all cursor-pointer"
      style={{
        width: sz,
        height: tileSize !== 'sm' ? 'auto' : sz,
        border: isKeep ? '2px solid var(--neon)' : `2px solid ${hovered?'var(--border2)':'var(--border)'}`,
        background: 'var(--s2)',
        opacity: isDeleted ? 0.4 : 1,
        boxShadow: isKeep ? '0 0 12px rgba(0,230,118,.2)' : 'none',
      }}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      onClick={()=>onPreview(group, fileIdx)}
    >
      {/* thumbnail */}
      <div style={{width:sz,height:sz,background:'var(--s3)',overflow:'hidden',position:'relative'}}>
        {type==='image'&&!imgError ? (
          <img src={previewUrl} alt={file.name} onError={()=>setImgError(true)}
            style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        ) : type==='video' ? (
          <div className="w-full h-full flex items-center justify-center flex-col gap-1">
            <Video size={sz>100?28:18} style={{color:'#ef4444'}}/>
            {sz>80&&<span style={{fontSize:9,color:'var(--dim)'}}>{file.ext}</span>}
          </div>
        ) : type==='audio' ? (
          <div className="w-full h-full flex items-center justify-center flex-col gap-1">
            <Music size={sz>100?28:18} style={{color:'#a855f7'}}/>
            {sz>80&&<span style={{fontSize:9,color:'var(--dim)'}}>{file.ext}</span>}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-1">
            <File size={sz>100?28:18} style={{color:'var(--dim)'}}/>
            {sz>80&&<span style={{fontSize:9,color:'var(--dim)'}}>{file.ext}</span>}
          </div>
        )}

        {/* hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex flex-col justify-between p-1.5"
            style={{background:'rgba(7,9,12,.75)'}}>
            <div className="flex items-center justify-between">
              {isKeep
                ? <span className="flex items-center gap-0.5 text-xs font-black" style={{color:'var(--neon)',fontSize:10}}>
                    <Crown size={10}/> KEEP
                  </span>
                : <button className="btn-ghost rounded px-1.5 py-0.5 text-xs font-bold"
                    style={{fontSize:10}} onClick={e=>{e.stopPropagation();onSetKeep(groupId,fileIdx);}}>
                    Make KEEP
                  </button>
              }
              <button className="btn-danger rounded p-1" onClick={e=>{e.stopPropagation();onDeleteFile(file.path);}}>
                <Trash2 size={10}/>
              </button>
            </div>
            <div onClick={e=>e.stopPropagation()}>
              <StatusPill value={st||null} onChange={v=>onSetStatus(file.path,v)} onClear={()=>onClearStatus(file.path)} compact/>
            </div>
          </div>
        )}

        {/* KEEP crown badge */}
        {isKeep && !hovered && (
          <div className="absolute top-1 left-1">
            <div className="flex items-center gap-0.5 rounded px-1 py-0.5" style={{background:'rgba(0,230,118,.9)'}}>
              <Crown size={9} style={{color:'#000'}}/>
              {sz>90&&<span style={{color:'#000',fontSize:9,fontWeight:800}}>KEEP</span>}
            </div>
          </div>
        )}

        {/* status badge top-right */}
        {st && !hovered && (
          <div className="absolute top-1 right-1 rounded p-0.5"
            style={{background:`${STATUS_COLOR[st]}30`}}>
            {STATUS_ICON[st]}
          </div>
        )}
      </div>

      {/* label */}
      {tileSize !== 'sm' && (
        <div className="px-1.5 py-1.5">
          <div className="font-semibold truncate" style={{fontSize:labelSz,color:'var(--text)',width:sz-12}}>{file.name}</div>
          {tileSize !== 'md' && (
            <div className="mono truncate" style={{fontSize:9,color:'var(--dim)',width:sz-12}}>{file.folder}</div>
          )}
          <div className="size-badge mt-0.5 inline-block">{file.sizeFmt||fmtSize(file.size)}</div>
        </div>
      )}
    </div>
  );
}

function DupGroupGallery({ dup, tileSize, fileStatus, keepMap, onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview }) {
  const [open, setOpen] = useState(true);
  const keepIdx = keepMap[dup.id] ?? 0;
  const catColor = {Photos:'#f59e0b',Videos:'#ef4444',Audio:'#a855f7',Documents:'#3b82f6',Archives:'#f97316',Code:'#10b981',Others:'#6b7280'}[dup.cat]||'#6b7280';
  
  const sz = {sm:80,md:130,lg:180,xl:230}[tileSize]||130;
  const cols = Math.max(2, Math.floor((window?.innerWidth || 1000) / (sz + 24)));

  return (
    <div className="mb-6">
      {/* group header */}
      <div className="flex items-center gap-2 mb-3 px-2 cursor-pointer hover:bg-gray-800/50 py-2 rounded transition-colors" onClick={()=>setOpen(!open)}>
        <span style={{color:'var(--dim)',fontSize:12}}>{open?'▼':'▶'}</span>
        <span className="text-sm font-semibold truncate" style={{color:'var(--text)',maxWidth:260}}>{dup.files[0]?.name}</span>
        <span className="catbadge" style={{background:`${catColor}20`,color:catColor}}>{dup.cat}</span>
        <span className="catbadge" style={{background:'rgba(239,68,68,.12)',color:'#ef4444'}}>{dup.count} copies</span>
        <span className="text-xs ml-auto font-semibold" style={{color:'#ef4444'}}>−{dup.wasteFmt||fmtSize(dup.waste)}</span>
      </div>

      {open && (
        <div 
          className="gap-3 px-2"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${sz}px, 1fr))`,
            gridAutoRows: 'max-content',
          }}
        >
          {dup.files.map((file,idx)=>(
            <ThumbnailCard key={file.path} file={file} fileIdx={idx} groupId={dup.id}
              isKeep={idx===keepIdx} status={fileStatus} tileSize={tileSize}
              onSetStatus={onSetStatus} onClearStatus={onClearStatus}
              onSetKeep={onSetKeep} onDeleteFile={onDeleteFile}
              onPreview={onPreview} group={dup}/>
          ))}
        </div>
      )}

      <div style={{borderBottom:'1px solid var(--border)',marginTop:16}}/>
    </div>
  );
}

const TILE_SIZES = ['sm','md','lg','xl'];
const TILE_LABELS = {sm:'XS',md:'S',lg:'M',xl:'L'};

export default function GalleryView({
  dups, fileStatus, keepMap, filter, status, progress,
  onSetStatus, onClearStatus, onSetKeep, onDeleteFile, onPreview,
}) {
  const [tileSize, setTileSize] = useState('md');
  const [showType, setShowType] = useState('all'); // all|originals|duplicates|media
  const [batchNumber, setBatchNumber] = useState(0);
  const scrollContainerRef = useRef(null);
  const BATCH_SIZE = 100;

  const filtered = useMemo(()=>{
    let list = dups;
    if (filter.cat!=='All') list=list.filter(d=>d.cat===filter.cat);
    if (filter.search){const q=filter.search.toLowerCase();list=list.filter(d=>d.files.some(f=>f.path.toLowerCase().includes(q)));}
    if (filter.showStatus&&filter.showStatus!=='all'){
      if(filter.showStatus==='unset') list=list.filter(d=>d.files.some(f=>!fileStatus[f.path]));
      else list=list.filter(d=>d.files.some(f=>fileStatus[f.path]===filter.showStatus));
    }
    // media only
    if(showType==='media'){
      const MEDIA_CATS=new Set(['Photos','Videos','Audio']);
      list=list.filter(d=>MEDIA_CATS.has(d.cat));
    }
    return list;
  },[dups,filter,fileStatus,showType]);

  // Reset batch when filter changes
  useEffect(() => {
    setBatchNumber(0);
  }, [filter, showType]);

  // Lazy load batches
  const lazyData = useMemo(() => {
    return getLazyDups(filtered, BATCH_SIZE, batchNumber);
  }, [filtered, batchNumber]);

  const handleScroll = (e) => {
    const container = e.target;
    const scrollPercentage = (container.scrollTop + container.clientHeight) / container.scrollHeight;
    
    if (scrollPercentage > 0.8 && lazyData.hasMore) {
      setBatchNumber(prev => prev + 1);
    }
  };

  if (status==='idle') return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div style={{fontSize:48}}>🖼️</div>
      <div className="text-lg font-bold" style={{color:'var(--text)'}}>Gallery Mode</div>
      <div className="text-sm" style={{color:'var(--muted)'}}>Run a scan to see visual previews of your duplicate files</div>
    </div>
  );

  if (status==='scanning'&&dups.length===0) return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <div className="anim-spin w-10 h-10 rounded-full border-2" style={{borderColor:'var(--neon)',borderTopColor:'transparent'}}/>
      <div className="text-sm" style={{color:'var(--neon)'}}>{progress.stage||'Scanning…'}</div>
    </div>
  );

  const rest={fileStatus,keepMap,onSetStatus,onClearStatus,onSetKeep,onDeleteFile,onPreview};

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* gallery toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{borderBottom:'1px solid var(--border)',background:'var(--s1)'}}>
        {/* show type */}
        <div className="flex gap-1">
          {[
            {id:'all',label:'All Files'},
            {id:'media',label:'📷 Media Only'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setShowType(t.id)}
              className="px-3 py-1 text-xs rounded-full font-semibold transition-all"
              style={{
                background:showType===t.id?'var(--neon)':'var(--s3)',
                color:showType===t.id?'#000':'var(--muted)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5" style={{background:'var(--border)'}}/>

        {/* zoom */}
        <div className="flex items-center gap-1.5">
          <ZoomOut size={14} style={{color:'var(--muted)'}}/>
          <div className="flex gap-0.5">
            {TILE_SIZES.map(s=>(
              <button key={s} onClick={()=>setTileSize(s)}
                className="w-6 h-6 rounded text-xs font-bold transition-all"
                style={{
                  background:tileSize===s?'var(--neon)':'var(--s3)',
                  color:tileSize===s?'#000':'var(--muted)',
                }}>
                {TILE_LABELS[s]}
              </button>
            ))}
          </div>
          <ZoomIn size={14} style={{color:'var(--muted)'}}/>
        </div>

        <span className="ml-auto text-xs mono" style={{color:'var(--dim)'}}>
          {filtered.length} groups · {filtered.reduce((a,d)=>a+d.count,0)} files
        </span>
        {status==='scanning'&&<span className="text-xs font-bold anim-pulse" style={{color:'var(--neon)'}}>● LIVE</span>}
      </div>

      {/* gallery grid with lazy loading */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {lazyData.items.map(d=>(
          <DupGroupGallery key={d.id} dup={d} tileSize={tileSize} {...rest}/>
        ))}
        
        {lazyData.items.length === 0 && filtered.length > 0 && (
          <div className="flex items-center justify-center h-40 text-sm" style={{color:'var(--muted)'}}>
            No results match the current filter.
          </div>
        )}

        {filtered.length === 0 && dups.length > 0 && (
          <div className="flex items-center justify-center h-40 text-sm" style={{color:'var(--muted)'}}>
            No results match the current filter.
          </div>
        )}

        {/* Loading indicator for lazy loading */}
        {status === 'scanning' && lazyData.hasMore && (
          <div className="flex items-center justify-center py-4">
            <div className="text-xs" style={{color:'var(--dim)'}}>
              Scroll to load more... ({lazyData.items.length} of {filtered.length})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
