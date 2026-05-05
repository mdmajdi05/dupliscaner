# Quick Start Guide - DupScan Gallery App

## 🚀 Getting Started

### **Step 1: Start the App**
```bash
cd dupscan
npm run dev
```

Server starts on `http://localhost:3003`

### **Step 2: Open File Manager**
Click the "File Manager" section (if not already visible)

### **Step 3: Wait for Auto-Scan** (2-3 seconds)
- 🔍 App automatically scans common folders
- Shows progress indicator
- Quick-access pills appear at top

### **Step 4: Browse Your Gallery**
- Click any folder pill (Pictures, Videos, Downloads, Music)
- Files load instantly
- Scroll smoothly through thousands of photos/videos

---

## ⚡ Key Features to Try

### **Quick Access Folders**
```
⚡ [Pictures (234)] [Videos (89)] [Downloads (156)] [Music (45)]
```
- Click any pill to view that folder
- Counts update as scanning continues
- Spinner shows which folder is being scanned

### **Fast Scrolling**
- Zoom in/out with slider (smooth!)
- Scroll thousands of files without lag
- Switch between Grid and List view

### **Smart Search**
- Search as you type
- Filters files instantly
- Works while background scan continues

### **File Management**
- Select multiple files (Ctrl+Click)
- Bulk delete/copy/move
- Preview images and play audio
- Open preview modal for details

---

## 🎯 What's Happening Behind the Scenes

1. **Auto-Detection** ✅
   - App detects common media folders
   - Windows: Pictures, Videos, Downloads, Music, OneDrive
   - macOS/Linux: Pictures, Videos, Downloads, Music

2. **Background Scanning** ✅
   - Worker threads scan folders (non-blocking)
   - Scans run in separate CPU threads
   - Main UI never freezes

3. **Instant Display** ✅
   - Cached results show immediately
   - File counts update in real-time
   - No waiting for full scan

4. **Virtual Scrolling** ✅
   - Only visible items rendered
   - Smooth 60fps scrolling
   - Handles 10,000+ files

---

## 💻 System Requirements

- **Node.js**: 14+
- **RAM**: 512MB+ recommended
- **Disk**: 200MB free for cache

---

## 🔧 Customization

Want to modify auto-scan folders? Edit `/app/api/fm/scan-bg/route.js`:

```javascript
function getCommonMediaFolders() {
  const home = os.homedir();
  const folders = [];
  
  // Add your custom folders here
  folders.push(
    path.join(home, 'Pictures'),
    path.join(home, 'Videos'),
    path.join(home, 'Downloads'),
    path.join(home, 'Music'),
    // Add more...
  );
  
  return folders.filter(f => fs.existsSync(f));
}
```

---

## 🐛 Troubleshooting

### **"No files found"**
- Check that folders exist and are readable
- Wait 2-3 seconds for initial scan
- Try refreshing with Refresh button

### **Slow Scrolling**
- Reduce zoom level (fewer items on screen)
- Try List view instead of Grid
- Check browser DevTools for performance

### **Not Showing Common Folders**
- Ensure Pictures/Videos/Downloads exist
- Check folder permissions
- Manually enter path using "Root path" input

### **Worker Thread Errors**
- Restart dev server (`npm run dev`)
- Check Node.js version (14+)
- Clear browser cache

---

## 📱 Mobile-Like Features

✨ Your app now has:
- **Instant Loading**: Click and see files immediately
- **Smooth Scrolling**: No jank with thousands of files
- **Background Work**: Scanning never blocks UI
- **Real-time Updates**: File counts update as scan progresses
- **Quick Navigation**: Folder pills for instant access

It's like a real mobile gallery! 📸

---

## 🎬 Common Workflows

### **Browse Photos**
1. Wait for auto-scan (pictures folder will auto-load)
2. Scroll through photos smoothly
3. Click photo to preview
4. Zoom slider to adjust view size

### **Find Videos**
1. Click "Videos" pill (or Videos folder tab)
2. Videos load instantly from cache
3. Play preview with click
4. Filter by extension (.mp4, .mkv, etc.)

### **Manage Downloads**
1. Click "Downloads" pill
2. Select files with Ctrl+Click
3. Bulk delete/move/copy
4. Or drag-select multiple items

### **Search Across All**
1. Make sure "All" tab is selected
2. Type in search box
3. Results filter instantly
4. Works while scanning continues

---

## ⚙️ Performance Tips

1. **First Launch**: Be patient for initial scan (2-3 seconds)
2. **Large Folders**: Scanning 10,000+ files takes time but runs in background
3. **Smooth Scrolling**: Virtual scrolling means no lag with massive libraries
4. **Fast Re-opens**: Results are cached, so reopening folders is instant

---

## 📊 What's Indexed

**Media Files Only:**
- Images: jpg, png, gif, webp, bmp, svg, avif, heic, raw, etc.
- Videos: mp4, mkv, avi, mov, wmv, flv, webm, m4v, 3gp, etc.
- Audio: mp3, wav, flac, aac, ogg, m4a, wma, opus, etc.
- Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, etc.

System files and program directories are skipped.

---

## 🆘 Getting Help

If something doesn't work:

1. **Check browser console** (F12 → Console)
2. **Restart dev server** (`npm run dev`)
3. **Clear cache** (Ctrl+Shift+Delete)
4. **Check Node.js version** (`node --version`)
5. **Look in logs** (Terminal output)

---

## 🎉 Enjoy Your Gallery App!

Your DupScan app is now a modern, responsive file manager that feels like a native mobile app. Enjoy browsing your media files with zero freezing and smooth scrolling! 📸✨
