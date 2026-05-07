export function buildPreviewUrl(filePath) {
  return `/api/preview?p=${encodeURIComponent(filePath)}`;
}

