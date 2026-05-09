const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tiff', '.tif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.3gp']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.opus', '.wma']);

export function getPreviewFileType(ext = '') {
  const normalized = String(ext || '').toLowerCase();
  if (IMAGE_EXTS.has(normalized)) return 'image';
  if (VIDEO_EXTS.has(normalized)) return 'video';
  if (AUDIO_EXTS.has(normalized)) return 'audio';
  if (normalized === '.pdf') return 'pdf';
  return 'other';
}

export function getFileIcon(ext) {
  if (!ext) return '📄';
  
  const extLower = ext.toLowerCase();
  
  // Document types
  if (['.pdf', '.doc', '.docx', '.txt', '.md'].includes(extLower)) return '📄';
  
  // Image types
  if (IMAGE_EXTS.has(extLower)) return '🖼️';
  
  // Video types
  if (VIDEO_EXTS.has(extLower)) return '🎬';
  
  // Audio types
  if (AUDIO_EXTS.has(extLower)) return '🎵';
  
  // Archive types
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(extLower)) return '📦';
  
  // Code types
  if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.cs'].includes(extLower)) return '💻';
  
  // Spreadsheet types
  if (['.xls', '.xlsx', '.csv'].includes(extLower)) return '📊';
  
  // Presentation types
  if (['.ppt', '.pptx', '.odp'].includes(extLower)) return '🎯';
  
  // Default
  return '📄';
}

