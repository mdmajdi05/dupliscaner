#!/usr/bin/env python3
"""DupScan — Real-time duplicate file scanner. Outputs JSON lines to stdout."""
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

def scan(root, skip_hidden, report_path, single_file=None):
    global running
    emit({"type":"start","path":root,"ts":now(),"mode":"single" if single_file else "scan"})

    # ── Phase 1: collect files ──────────────────────────────────────
    by_size = defaultdict(list)
    n = 0

    if single_file:
        # Find duplicates of a specific file
        if not os.path.isfile(single_file):
            emit({"type":"error","msg":f"File not found: {single_file}"}); return
        target_hash = file_hash(single_file)
        target_size = os.path.getsize(single_file)
        if not target_hash:
            emit({"type":"error","msg":"Cannot read target file"}); return
        emit({"type":"target_info","path":single_file,"hash":target_hash,"size":target_size,"sizeFmt":fmt(target_size)})
        # Now scan root for same-size files
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

    # ── Phase 2: hash comparison ────────────────────────────────────
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

            # report
            report_lines.append(f"[{cat}] {Path(fps[0]).name}")
            report_lines.append(f"  Size: {fmt(sz)} x{len(fps)} copies  |  Wasted: {fmt(waste)}")
            for i,fp in enumerate(fps):
                report_lines.append(f"  {'KEEP  ' if i==0 else 'DELETE'} {fp}")
            report_lines.append("")

    emit({"type":"progress","done":total_cands,"total":total_cands})

    # ── Phase 3: save report ────────────────────────────────────────
    try:
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        emit({"type":"report_saved","path":report_path})
    except Exception as e:
        emit({"type":"error","msg":str(e)})

    emit({"type":"done","ts":now(),"total_dups":dup_id})

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--path", default=os.path.expanduser("~"))
    p.add_argument("--report", default="data/report.txt")
    p.add_argument("--hidden", action="store_true")
    p.add_argument("--file", default="", help="Find duplicates of a specific file")
    args = p.parse_args()
    scan(args.path, not args.hidden, args.report, args.file or None)
