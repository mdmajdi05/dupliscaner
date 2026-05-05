'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ResultsView from './ResultsView';
import GalleryView from './GalleryView';
import PreviewModal from './PreviewModal';
import StatsBar from './StatsBar';

export default function Dashboard() {
  const [status, setStatus]     = useState('idle');
  const [progress, setProgress] = useState({ stage:'', n:0, done:0, total:0, dir:'' });
  const [liveDups, setLiveDups] = useState([]);
  const [scanId, setScanId]     = useState(null);
  const [scanPath, setScanPath] = useState('');

  const [history, setHistory]   = useState([]);
  const [viewId, setViewId]     = useState(null);
  const [viewScan, setViewScan] = useState(null);

  // fileStatus: { [path]: 'keep'|'review'|'need'|'deleted' }
  const [fileStatus, setFileStatus] = useState({});
  // keepMap: { [dupGroupId]: number } - which index is the "KEEP" file
  const [keepMap, setKeepMap]       = useState({});

  const [filter, setFilter]     = useState({ cat:'All', folder:'', search:'', showStatus:'all' });
  const [preview, setPreview]   = useState(null);
  const [mainTab, setMainTab]   = useState('list');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const esRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    const r = await fetch('/api/history');
    if (r.ok) setHistory(await r.json());
  }, []);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const openStream = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource('/api/scan/stream');
    esRef.current = es;
    es.onmessage = e => { try { handleEv(JSON.parse(e.data)); } catch {} };
    es.onerror = () => setTimeout(() => { if (esRef.current) openStream(); }, 3000);
  }, []); // eslint-disable-line

  useEffect(() => {
    openStream();
    return () => { if (esRef.current) esRef.current.close(); };
  }, [openStream]);

  const handleEv = useCallback((ev) => {
    switch (ev.type) {
      case 'sync': setStatus(ev.status); setProgress(ev.progress||{}); break;
      case 'start':
        setStatus('scanning'); setLiveDups([]); setFileStatus({}); setKeepMap({});
        setProgress({stage:'Starting…',n:0,done:0,total:0,dir:''});
        break;
      case 'scanning': setProgress(p=>({...p,stage:'Scanning files…',n:ev.n,dir:ev.dir})); break;
      case 'phase2':   setProgress(p=>({...p,stage:'Comparing…'})); break;
      case 'hashing':  setProgress(p=>({...p,stage:'Hashing…',total:ev.candidates})); break;
      case 'progress': setProgress(p=>({...p,done:ev.done,total:ev.total})); break;
      case 'dup':
        setLiveDups(prev => prev.find(d=>d.id===ev.id) ? prev : [...prev, ev]);
        break;
      case 'done':
        setStatus('done'); setProgress(p=>({...p,stage:'Scan complete!'}));
        setTimeout(refreshHistory,1200);
        break;
      case 'stopped': setStatus('stopped'); break;
      case 'error':   setStatus('error'); setProgress(p=>({...p,stage:ev.msg||'Error'})); break;
    }
  }, [refreshHistory]);

  const startScan = async ({path,hidden,mode,targetFile}) => {
    setScanPath(path); setStatus('scanning'); setLiveDups([]);
    setFileStatus({}); setKeepMap({}); setViewId(null); setViewScan(null);
    setProgress({stage:'Starting…',n:0,done:0,total:0,dir:''});
    const r = await fetch('/api/scan/start',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({scanPath:path,includeHidden:hidden,mode,targetFile}),
    });
    if (r.ok) { const {id}=await r.json(); setScanId(id); }
    else setStatus('error');
  };

  const stopScan = () => { fetch('/api/scan/stop',{method:'POST'}); setStatus('stopped'); };

  const selectHistory = async (id) => {
    if (!id) { setViewId(null); setViewScan(null); setFileStatus({}); setKeepMap({}); return; }
    setViewId(id);
    const r = await fetch(`/api/history/${id}`);
    if (r.ok) {
      const scan = await r.json();
      setViewScan(scan);
      setFileStatus(scan.fileStatus||{});
      setKeepMap(scan.keepMap||{});
    }
  };

  const deleteHistory = async (id) => {
    await fetch(`/api/history/${id}`,{method:'DELETE'});
    if (viewId===id) { setViewId(null); setViewScan(null); }
    refreshHistory();
  };

  const persistRef = useRef(null);
  const persist = useCallback(async (fs, km) => {
    const sid = viewId || scanId;
    if (!sid) return;
    // debounce
    clearTimeout(persistRef.current);
    persistRef.current = setTimeout(async () => {
      await fetch(`/api/history/${sid}`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fileStatus:fs,keepMap:km}),
      });
    }, 600);
  }, [viewId, scanId]);

  const updateFileStatus = useCallback((path, st) => {
    setFileStatus(prev => {
      const next = {...prev, [path]: st};
      persist(next, keepMap);
      return next;
    });
  }, [keepMap, persist]);

  const clearFileStatus = useCallback((path) => {
    setFileStatus(prev => {
      const next = {...prev};
      delete next[path];
      persist(next, keepMap);
      return next;
    });
  }, [keepMap, persist]);

  const updateKeep = useCallback((groupId, idx) => {
    setKeepMap(prev => {
      const next = {...prev, [groupId]: idx};
      persist(fileStatus, next);
      return next;
    });
  }, [fileStatus, persist]);

  const deleteFile = async (path) => {
    if (!confirm(`Delete this file from disk?\n\n${path}\n\nThis cannot be undone.`)) return;
    const r = await fetch('/api/delete',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path}),
    });
    if (r.ok) updateFileStatus(path,'deleted');
    else alert('Delete failed — check permissions.');
  };

  const downloadReport = () => {
    const sid = viewId||scanId;
    const a = document.createElement('a');
    a.href = sid ? `/api/report?id=${sid}` : '/api/report';
    a.download = `dupscan_${sid||'report'}.txt`;
    a.click();
  };

  const dups = viewScan ? (viewScan.dups||[]) : liveDups;
  const displayStatus = viewId ? 'done' : status;

  const stats = (() => {
    const all = Object.values(fileStatus);
    return {
      sets:  dups.length,
      extra: dups.reduce((a,d)=>a+(d.count-1),0),
      waste: dups.reduce((a,d)=>a+(d.waste||0),0),
      keep:    all.filter(v=>v==='keep').length,
      review:  all.filter(v=>v==='review').length,
      need:    all.filter(v=>v==='need').length,
      deleted: all.filter(v=>v==='deleted').length,
    };
  })();

  const shared = {
    dups, fileStatus, keepMap, filter, status:displayStatus, progress,
    onSetStatus: updateFileStatus,
    onClearStatus: clearFileStatus,
    onSetKeep: updateKeep,
    onDeleteFile: deleteFile,
    onPreview: (group, idx) => setPreview({group,idx:idx||0}),
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'var(--bg)'}}>
      {sidebarOpen && (
        <Sidebar history={history} viewId={viewId} status={status}
          onSelect={selectHistory} onDelete={deleteHistory}
          onViewLive={()=>selectHistory(null)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          status={displayStatus} progress={progress}
          scanPath={viewScan?.path||scanPath}
          onStart={startScan} onStop={stopScan} onDownload={downloadReport}
          dups={dups} isHistory={!!viewId} viewScan={viewScan}
          filter={filter} onFilterChange={setFilter}
          sidebarOpen={sidebarOpen} onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)}
          mainTab={mainTab} onMainTab={setMainTab}
        />
        <StatsBar stats={stats} />
        <div className="flex-1 overflow-hidden">
          {mainTab==='list'
            ? <ResultsView {...shared} />
            : <GalleryView {...shared} />
          }
        </div>
      </div>

      {preview && (
        <PreviewModal
          group={preview.group} startIdx={preview.idx}
          fileStatus={fileStatus} keepMap={keepMap}
          onSetStatus={updateFileStatus} onClearStatus={clearFileStatus}
          onSetKeep={updateKeep} onDeleteFile={deleteFile}
          onClose={()=>setPreview(null)}
        />
      )}
    </div>
  );
}
