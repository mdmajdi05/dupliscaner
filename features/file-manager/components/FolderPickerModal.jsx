'use client';

import { useState, useEffect, useRef } from 'react';
import { FolderOpen, ChevronRight, X } from 'lucide-react';

export default function FolderPickerModal({ isOpen, onClose, onSelect, initialPath = 'C:\\' }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    loadFolders(currentPath);
  }, [currentPath, isOpen]);

  const loadFolders = async (path) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/fm/browse-folders?path=${encodeURIComponent(path)}`);
      if (r.ok) {
        const data = await r.json();
        setFolders(data.folders || []);
        
        // Update breadcrumbs
        const parts = path.split(/[/\\]+/).filter(Boolean);
        const crumbs = [];
        let currentBreadPath = '';
        for (let i = 0; i < parts.length; i++) {
          if (i === 0) {
            currentBreadPath = parts[i] + (path.startsWith('/') ? '/' : '\\');
          } else {
            currentBreadPath = currentBreadPath + (path.includes('/') ? '/' : '\\') + parts[i];
          }
          crumbs.push({ label: parts[i], path: currentBreadPath });
        }
        setBreadcrumbs(crumbs);
      }
    } catch (e) {
      console.error('Error loading folders:', e);
    }
    setLoading(false);
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  const handleSelectFolder = () => {
    onSelect(currentPath);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-lg shadow-2xl p-6 w-96 max-h-96 flex flex-col"
        style={{ background: 'var(--s1)', color: 'var(--text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Select Destination</h2>
          <button
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="mb-4 text-xs" style={{ color: 'var(--dim)' }}>
          <span>{currentPath}</span>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto mb-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--s2)' }}>
          {loading ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading folders...</div>
          ) : folders.length > 0 ? (
            <div>
              {folders.map(folder => (
                <button
                  key={folder.path}
                  onClick={() => handleNavigate(folder.path)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-800 transition-colors text-left"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <FolderOpen size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <span className="truncate flex-1">{folder.name}</span>
                  <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>No folders found</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded text-sm transition-colors"
            style={{ background: 'var(--s3)', color: 'var(--muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSelectFolder}
            className="flex-1 px-4 py-2 rounded text-sm font-semibold transition-colors"
            style={{ background: 'var(--neon)', color: '#000' }}
          >
            Select This
          </button>
        </div>
      </div>
    </div>
  );
}
