#!/usr/bin/env python3
"""DupScan — Real-time duplicate file scanner. Outputs JSON lines to stdout.

Modes:
  - duplicates: Find duplicate files (default, current behavior)
  - full: Traverse all files, hash all, report all with metadata

Incremental Mode:
  - --previous-hashes: Accept JSON file with previous hashing results
  - Only hash files with changed size/mtime
  - Output change types: file_changed|file_unchanged|file_deleted|file_added
"""
import os, hashlib, sys, json, signal, argparse
from collections import defaultdict
from pathlib import Path
from datetime import datetime

CATEGORIES = {
    "Photos":    {".jpg",".jpeg",".png",".gif",".bmp",".webp",".heic",".raw",".tiff",".tif",".svg",".ico",".avif"},
    "Videos":    {".mp4",".mkv",".avi",".mov",".wmv",".flv",".webm",".m4v",".3gp",".mpg",".mpeg",".ts",".vob"},
    "Audio":     {".mp3",".wav",".flac",".aac",".ogg",".m4a",".wma",".opus",".aiff",".alac"},
    "Documents": {".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt",".csv",".odt",".rtf",".md",".epub"},
    "Archives":  {".zip",".rar",".7z",".tar",".gz",".bz2",".iso",".dmg",".cab"},
    "Code":      {".py",".js",".ts",".jsx",".tsx",".html",".css",".java",".cpp",".c",".go",".rs",".php",".rb"},
}
SKIP_DIRS = {'.git','node_modules','__pycache__','.Trash','Trash','.cache','Cache','tmp','temp',
             'System Volume Information','$RECYCLE.BIN','Windows','Program Files','SteamApps'}

running = True

def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)

def handle_signal(s, f):
    global running
    running = False
    emit({"type":"stopped","ts":now()})
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

def now(): return datetime.now().isoformat()

def get_cat(ext):
    e = ext.lower()
    for cat, exts in CATEGORIES.items():
        if e in exts: return cat
    return "Others"

def fmt(b):
    for u in ['B','KB','MB','GB']:
        if b < 1024: return f"{b:.1f} {u}"
        b /= 1024
    return f"{b:.1f} TB"

def file_hash(path, chunk=65536):
    h = hashlib.md5()
    try:
        with open(path, 'rb') as f:
            while True:
                c = f.read(chunk)
                if not c: break
                h.update(c)
        return h.hexdigest()
    except: return None

def load_previous_hashes(file_path):
    """Load previous hashing results from JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return {item['path']: item for item in data.get('files', [])}
    except:
        return {}

def get_file_metadata(path):
    """Get file metadata (size, mtime, hash, etc)."""
    try:
        st = os.stat(path)
        size = st.st_size
        mtime = int(st.st_mtime)
        ext = Path(path).suffix.lower()
        return {
            'path': path,
            'name': Path(path).name,
            'folder': str(Path(path).parent),
            'size': size,
            'mtime': mtime,
            'ext': ext,
            'category': get_cat(ext),
        }
    except:
        return None

def scan_duplicates(root, skip_hidden, report_path, single_file=None):
    """Original mode: Find duplicate files (size grouping + hash comparison)."""
    global running
    emit({"type":"start","path":root,"ts":now(),"mode":"duplicates"})

    by_size = defaultdict(list)
    n = 0

    if single_file:
        if not os.path.isfile(single_file):
            emit({"type":"error","msg":f"File not found: {single_file}"}); return
        target_hash = file_hash(single_file)
        target_size = os.path.getsize(single_file)
        if not target_hash:
            emit({"type":"error","msg":"Cannot read target file"}); return
        emit({"type":"target_info","path":single_file,"hash":target_hash,"size":target_size,"sizeFmt":fmt(target_size)})
        for dp, dns, fns in os.walk(root):
            if not running: break
            if skip_hidden: dns[:] = [d for d in dns if not d.startswith('.') and d not in SKIP_DIRS]
            for fn in fns:
                if not running: break
                if skip_hidden and fn.startswith('.'): continue
                fp = os.path.join(dp, fn)
                try:
                    sz = os.path.getsize(fp)
                    if sz == target_size: by_size[sz].append(fp)
                    n += 1
                except: pass
            if n % 500 == 0: emit({"type":"scanning","n":n,"dir":dp})
    else:
        for dp, dns, fns in os.walk(root):
            if not running: break
            if skip_hidden: dns[:] = [d for d in dns if not d.startswith('.') and d not in SKIP_DIRS]
            for fn in fns:
                if not running: break
                if skip_hidden and fn.startswith('.'): continue
                fp = os.path.join(dp, fn)
                try:
                    sz = os.path.getsize(fp)
                    if sz > 0: by_size[sz].append(fp)
                    n += 1
                except: pass
            if n % 500 == 0: emit({"type":"scanning","n":n,"dir":dp})

    emit({"type":"phase2","total":n})

    candidates = {s:p for s,p in by_size.items() if len(p) > 1}
    total_cands = sum(len(v) for v in candidates.values())
    emit({"type":"hashing","candidates":total_cands})

    checked = 0
    dup_id = 0
    report_lines = [
        f"DUPSCAN REPORT",
        f"Scan path : {root}",
        f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"{'='*60}","",
    ]

    for sz, paths in sorted(candidates.items(), key=lambda x:-x[0]):
        if not running: break
        hgroups = defaultdict(list)
        for p in paths:
            if not running: break
            h = file_hash(p) if not single_file else (file_hash(p) if file_hash(p)==target_hash else None)
            if h: hgroups[h].append(p)
            checked += 1
            if checked % 200 == 0: emit({"type":"progress","done":checked,"total":total_cands})

        for h, fps in hgroups.items():
            if len(fps) < 2: continue
            if single_file and single_file not in fps: continue
            dup_id += 1
            ext = Path(fps[0]).suffix
            cat = get_cat(ext)
            waste = sz * (len(fps)-1)
            files_info = []
            for fp in fps:
                try:
                    st = os.stat(fp)
                    files_info.append({
                        "path": fp, "name": Path(fp).name,
                        "folder": str(Path(fp).parent),
                        "size": sz, "sizeFmt": fmt(sz),
                        "ext": ext.lower(),
                        "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                    })
                except:
                    files_info.append({"path":fp,"name":Path(fp).name,"folder":str(Path(fp).parent),"size":sz,"sizeFmt":fmt(sz),"ext":ext.lower(),"modified":None})

            obj = {
                "type":"dup","id":f"d{dup_id}","hash":h,"cat":cat,"ext":ext.lower(),
                "size":sz,"sizeFmt":fmt(sz),"waste":waste,"wasteFmt":fmt(waste),
                "count":len(fps),"files":files_info
            }
            emit(obj)

            report_lines.append(f"[{cat}] {Path(fps[0]).name}")
            report_lines.append(f"  Size: {fmt(sz)} x{len(fps)} copies  |  Wasted: {fmt(waste)}")
            for i,fp in enumerate(fps):
                report_lines.append(f"  {'KEEP  ' if i==0 else 'DELETE'} {fp}")
            report_lines.append("")

    emit({"type":"progress","done":total_cands,"total":total_cands})

    try:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        emit({"type":"report_saved","path":report_path})
    except Exception as e:
        emit({"type":"error","msg":str(e)})

    emit({"type":"done","ts":now(),"total_dups":dup_id})


def scan_full(root, skip_hidden, previous_hashes_file=None):
    """Full mode: Traverse all files, hash all, report all with metadata."""
    global running
    emit({"type":"start","path":root,"ts":now(),"mode":"full"})
    
    previous_hashes = {}
    is_incremental = False
    if previous_hashes_file:
        try:
            previous_hashes = load_previous_hashes(previous_hashes_file)
            is_incremental = True
            emit({"type":"incremental_mode","previous_hashes_count":len(previous_hashes)})
        except Exception as e:
            emit({"type":"warning","msg":f"Failed to load previous hashes: {str(e)}"})
    
    emit({"type":"phase1_start","description":"Traversing directory..."})
    all_files = {}
    file_count = 0
    
    for dp, dns, fns in os.walk(root):
        if not running: break
        if skip_hidden:
            dns[:] = [d for d in dns if not d.startswith('.') and d not in SKIP_DIRS]
        
        for fn in fns:
            if not running: break
            if skip_hidden and fn.startswith('.'): continue
            
            fp = os.path.join(dp, fn)
            metadata = get_file_metadata(fp)
            if metadata:
                all_files[fp] = metadata
                file_count += 1
            
            if file_count % 500 == 0:
                emit({"type":"progress","phase":1,"files_found":file_count,"current_dir":dp})
    
    emit({"type":"phase1_complete","total_files":file_count})
    
    emit({"type":"phase2_start","description":"Hashing files...","is_incremental":is_incremental})
    
    files_to_hash = []
    files_unchanged = []
    files_deleted = []
    
    for path, metadata in all_files.items():
        prev = previous_hashes.get(path)
        
        if prev:
            if prev.get('size') == metadata['size'] and prev.get('mtime') == metadata['mtime']:
                metadata['hash'] = prev.get('hash')
                metadata['change_type'] = 'file_unchanged'
                files_unchanged.append(path)
                emit({"type":"file_unchanged","path":path,"hash":metadata['hash']})
            else:
                metadata['change_type'] = 'file_changed'
                files_to_hash.append(path)
        else:
            metadata['change_type'] = 'file_added'
            files_to_hash.append(path)
    
    for prev_path in previous_hashes:
        if prev_path not in all_files:
            files_deleted.append(prev_path)
            emit({"type":"file_deleted","path":prev_path})
    
    emit({"type":"hashing_start","files_to_hash":len(files_to_hash),"files_unchanged":len(files_unchanged),"files_deleted":len(files_deleted)})
    
    hashed = 0
    for path in files_to_hash:
        if not running: break
        metadata = all_files[path]
        h = file_hash(path)
        if h:
            metadata['hash'] = h
            emit({"type":"file_hashed","path":path,"hash":h,"size":metadata['size'],"change_type":metadata['change_type']})
        else:
            emit({"type":"file_hash_error","path":path,"error":"Cannot read file"})
        
        hashed += 1
        if hashed % 100 == 0:
            emit({"type":"progress","phase":2,"files_hashed":hashed,"total_to_hash":len(files_to_hash)})
    
    emit({"type":"phase2_complete","files_hashed":hashed})
    
    emit({"type":"phase3_start","description":"Emitting results...","total_files":len(all_files)})
    
    emitted = 0
    for path, metadata in all_files.items():
        if not running: break
        emit({
            "type": "file_record",
            "path": path,
            "name": metadata['name'],
            "folder": metadata['folder'],
            "size": metadata['size'],
            "sizeFmt": fmt(metadata['size']),
            "ext": metadata['ext'],
            "category": metadata['category'],
            "mtime": metadata['mtime'],
            "hash": metadata.get('hash'),
            "change_type": metadata.get('change_type', 'file_added')
        })
        emitted += 1
        if emitted % 500 == 0:
            emit({"type":"progress","phase":3,"files_emitted":emitted,"total_files":len(all_files)})
    
    emit({"type":"done","ts":now(),"mode":"full","total_files":len(all_files),"files_hashed":hashed,"files_unchanged":len(files_unchanged),"files_deleted":len(files_deleted)})


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--path", default=os.path.expanduser("~"))
    p.add_argument("--mode", default="duplicates", choices=["duplicates", "full"], help="Scan mode: duplicates or full")
    p.add_argument("--report", default="")
    p.add_argument("--hidden", action="store_true")
    p.add_argument("--file", default="", help="Find duplicates of a specific file (duplicates mode only)")
    p.add_argument("--previous-hashes", default="", help="Path to JSON file with previous hashing results (incremental mode)")
    args = p.parse_args()
    
    if args.mode == "duplicates":
        report_path = args.report
        if not report_path:
            appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~\\AppData\\Local'))
            reports_dir = os.path.join(appdata, 'DupScan', 'reports')
            os.makedirs(reports_dir, exist_ok=True)
            report_path = os.path.join(reports_dir, f"report_{int(datetime.now().timestamp()*1000)}.txt")
        else:
            os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        scan_duplicates(args.path, not args.hidden, report_path, args.file or None)
    
    elif args.mode == "full":
        scan_full(args.path, not args.hidden, args.previous_hashes or None)
