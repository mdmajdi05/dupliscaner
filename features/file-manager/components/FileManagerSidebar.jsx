'use client';
import { useState, useCallback } from 'react';
import {
  FolderOpen, FolderClosed, ChevronRight, ChevronDown,
  HardDrive, Loader2
} from 'lucide-react';

export default function FileManagerSidebar({ rootPath, selectedFolder, onSelectFolder }) {
  const [tree, setTree] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState({});

  const loadChildren = useCallback(async (path) => {
    if (tree[path]) return;
    setLoading(l => ({ ...l, [path]: true }));
    try {
      const r = await fetch(`/api/fm/ls?path=${encodeURIComponent(path)}&dirsOnly=1`);
      if (r.ok) {
        const { items } = await r.json();
        setTree(t => ({ ...t, [path]: items || [] }));
      }
    } catch {}
    setLoading(l => ({ ...l, [path]: false }));
  }, [tree]);

  const toggle = useCallback(async (path) => {
    const next = !expanded[path];
    setExpanded(e => ({ ...e, [path]: next }));
    if (next) await loadChildren(path);
  }, [expanded, loadChildren]);

  function TreeNode({ path, name, depth = 0 }) {
    const children = tree[path];
    const isOpen = expanded[path];
    const isLoading = loading[path];
    const isSelected = selectedFolder === path;

    return (
      <div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer select-none transition-colors"
          style={{
            paddingLeft: 8 + depth * 16,
            background: isSelected ? 'rgba(0,230,118,.12)' : 'transparent',
            color: isSelected ? 'var(--neon)' : 'var(--muted)',
            borderLeft: isSelected ? '2px solid var(--neon)' : '2px solid transparent',
          }}
          onClick={() => { onSelectFolder(path); toggle(path); }}
        >
          <span style={{ color: 'var(--dim)', flexShrink: 0, width: 12 }}>
            {isLoading
              ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              : isOpen
                ? <ChevronDown size={10} />
                : <ChevronRight size={10} />
            }
          </span>
          {isOpen
            ? <FolderOpen size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
            : <FolderClosed size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
          }
          <span className="text-xs truncate" style={{ maxWidth: 140 }}>{name || path}</span>
        </div>
        {isOpen && children && (
          <div>
            {children.map(c => (
              <TreeNode key={c.path} path={c.path} name={c.name} depth={depth + 1} />
            ))}
            {children.length === 0 && (
              <div className="text-xs py-1" style={{ paddingLeft: 24 + (depth + 1) * 16, color: 'var(--dim)' }}>
                Empty
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 flex-shrink-0 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <HardDrive size={12} style={{ color: 'var(--neon)' }} />
        <span className="text-xs font-bold tracking-widest" style={{ color: 'var(--dim)' }}>FOLDERS</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {rootPath ? (
          <TreeNode path={rootPath} name={rootPath.split(/[/\\]/).pop() || rootPath} />
        ) : (
          <div className="text-xs px-3 py-4 text-center" style={{ color: 'var(--dim)' }}>
            Enter a root path above
          </div>
        )}
      </div>
    </div>
  );
}