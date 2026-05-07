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

