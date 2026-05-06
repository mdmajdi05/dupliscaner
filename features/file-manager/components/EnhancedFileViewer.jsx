'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, ExternalLink } from 'lucide-react';

function getFileType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff', 'tif'];
  const pdfExts = ['pdf'];
  const docExts = ['doc', 'docx', 'txt', 'rtf', 'odt'];
  const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'm4v', '3gp'];
  
  if (imageExts.includes(ext)) return 'image';
  if (pdfExts.includes(ext)) return 'pdf';
  if (docExts.includes(ext)) return 'doc';
  if (videoExts.includes(ext)) return 'video';
  return 'unknown';
}

export default function EnhancedFileViewer({ file, onClose, onAction, onNext, onPrev, hasNext, hasPrev }) {
  const [zoom, setZoom] = useState(100);
  const [imgError, setImgError] = useState(false);
  
  const fileType = getFileType(file?.path || '');
  const previewUrl = file ? `/api/preview?p=${encodeURIComponent(file.path)}` : '';

  if (!file) return null;

  const fileName = file.name || file.path?.split(/[/\\]/).pop() || 'File';

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50" style={{ background: 'rgba(7,9,12,.95)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{fileName}</h2>
          <p className="text-xs mt-1 mono truncate" style={{ color: 'var(--dim)' }}>{file.path}</p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {fileType === 'image' && (
            <>
              <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-2 hover:bg-gray-700 rounded" title="Zoom out">
                <ZoomOut size={16} style={{ color: 'var(--muted)' }} />
              </button>
              <span className="text-xs w-12 text-center" style={{ color: 'var(--muted)' }}>{zoom}%</span>
              <button onClick={() => setZoom(Math.min(300, zoom + 10))} className="p-2 hover:bg-gray-700 rounded" title="Zoom in">
                <ZoomIn size={16} style={{ color: 'var(--muted)' }} />
              </button>
              <div className="w-px h-6 mx-2" style={{ background: 'var(--border)' }} />
            </>
          )}
          {hasPrev && (
            <button onClick={onPrev} className="p-2 hover:bg-gray-700 rounded" title="Previous">
              <ChevronLeft size={16} style={{ color: 'var(--muted)' }} />
            </button>
          )}
          {hasNext && (
            <button onClick={onNext} className="p-2 hover:bg-gray-700 rounded" title="Next">
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </button>
          )}
          <div className="w-px h-6 mx-2" style={{ background: 'var(--border)' }} />
          <button 
            onClick={() => onAction?.('open', file)} 
            className="p-2 hover:bg-gray-700 rounded" 
            title="Open external"
          >
            <ExternalLink size={16} style={{ color: 'var(--muted)' }} />
          </button>
          <button 
            onClick={() => onAction?.('download', file)} 
            className="p-2 hover:bg-gray-700 rounded" 
            title="Download"
          >
            <Download size={16} style={{ color: 'var(--muted)' }} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded" title="Close">
            <X size={16} style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {fileType === 'image' ? (
          !imgError ? (
            <img
              src={previewUrl}
              alt={fileName}
              onError={() => setImgError(true)}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `scale(${zoom / 100})`,
                transition: 'transform 0.2s',
              }}
            />
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">🖼️</div>
              <p style={{ color: 'var(--muted)' }}>Cannot preview this image</p>
              <button
                onClick={() => onAction?.('open', file)}
                className="mt-4 px-4 py-2 rounded text-sm font-semibold"
                style={{ background: 'var(--neon)', color: '#000' }}
              >
                Open in external viewer
              </button>
            </div>
          )
        ) : fileType === 'pdf' ? (
          <div className="text-center">
            <div className="text-6xl mb-4">📄</div>
            <p style={{ color: 'var(--muted)' }}>PDF preview not available in-app</p>
            <button
              onClick={() => onAction?.('open', file)}
              className="mt-4 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--neon)', color: '#000' }}
            >
              Open PDF
            </button>
          </div>
        ) : fileType === 'doc' ? (
          <div className="text-center">
            <div className="text-6xl mb-4">📝</div>
            <p style={{ color: 'var(--muted)' }}>Document preview not available in-app</p>
            <button
              onClick={() => onAction?.('open', file)}
              className="mt-4 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--neon)', color: '#000' }}
            >
              Open Document
            </button>
          </div>
        ) : fileType === 'video' ? (
          <div className="text-center">
            <div className="text-6xl mb-4">🎥</div>
            <p style={{ color: 'var(--muted)' }}>Video player not available in-app</p>
            <button
              onClick={() => onAction?.('open', file)}
              className="mt-4 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--neon)', color: '#000' }}
            >
              Play Video
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl mb-4">📎</div>
            <p style={{ color: 'var(--muted)' }}>File preview not available</p>
            <button
              onClick={() => onAction?.('open', file)}
              className="mt-4 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--neon)', color: '#000' }}
            >
              Open File
            </button>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="px-6 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--dim)' }}>
        <div className="flex justify-between">
          <span>{file.sizeFmt || 'Unknown size'}</span>
          <span>{file.modified ? new Date(file.modified).toLocaleString() : 'Unknown date'}</span>
        </div>
      </div>
    </div>
  );
}
