'use client';

import { useCallback, useEffect, useState } from 'react';
import DuplicateGroupCard from './DuplicateGroupCard';

/**
 * DuplicatesResolver - Main UI for conflict resolution
 * Displays duplicate groups and allows users to manage/delete files
 */
export default function DuplicatesResolver({ onAction }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [actionInProgress, setActionInProgress] = useState(false);

  // Load duplicate groups from API
  const loadDuplicates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/duplicates/groups?limit=1000');
      if (!response.ok) throw new Error(`Failed to load duplicates: ${response.status}`);
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('[DuplicatesResolver] Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  // Toggle group selection
  const toggleGroupSelection = useCallback((groupId) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Handle action on a group
  const handleGroupAction = useCallback(async (groupId, action, fileIndexToDelete) => {
    setActionInProgress(true);
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('Group not found');

      let filePath = null;
      if (action === 'delete' && fileIndexToDelete !== undefined) {
        filePath = group.files[fileIndexToDelete]?.path;
        if (!filePath) throw new Error('File not found');
      }

      // Call onAction callback or perform direct API call
      if (onAction) {
        await onAction(action, { groupId, filePath });
      } else {
        // Direct API call for delete
        if (action === 'delete' && filePath) {
          const response = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
          });
          if (!response.ok) throw new Error('Delete failed');
        }
      }

      // Refresh list
      await loadDuplicates();
    } catch (err) {
      console.error('[DuplicatesResolver] Action error:', err);
      setError(err.message);
    } finally {
      setActionInProgress(false);
    }
  }, [groups, onAction, loadDuplicates]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4 text-gray-500">Loading duplicates...</div>
          <div className="inline-block animate-spin">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <div className="text-lg font-semibold mb-2">No duplicates found</div>
          <div className="text-sm">Run a scan to find duplicate files</div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
  const totalWaste = groups.reduce((sum, g) => sum + (g.waste_bytes || 0), 0);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Conflict Resolution</h2>
            <p className="text-sm text-gray-500 mt-1">
              {groups.length} duplicate group{groups.length !== 1 ? 's' : ''} 
              {' '} • {totalFiles} file{totalFiles !== 1 ? 's' : ''} 
              {' '} • {formatBytes(totalWaste)} waste
            </p>
          </div>
          <button
            onClick={loadDuplicates}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 mx-4 mt-4 rounded">
          {error}
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-4 p-6">
          {groups.map((group) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              isSelected={selectedGroups.has(group.id)}
              onToggleSelection={() => toggleGroupSelection(group.id)}
              onAction={(action, fileIdx) => handleGroupAction(group.id, action, fileIdx)}
              disabled={actionInProgress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Utility function to format bytes
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
