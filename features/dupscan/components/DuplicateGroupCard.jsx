'use client';

import { useState } from 'react';

// Helper to get file emoji icon based on extension
function getFileIcon(ext) {
  if (!ext) return '📄';
  const lower = ext.toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(lower)) return '🖼️';
  if (['.mp4', '.webm', '.mkv', '.avi', '.mov'].includes(lower)) return '🎬';
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg'].includes(lower)) return '🎵';
  if (['.pdf'].includes(lower)) return '📕';
  if (['.doc', '.docx', '.txt'].includes(lower)) return '📝';
  if (['.xls', '.xlsx', '.csv'].includes(lower)) return '📊';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(lower)) return '📦';
  return '📄';
}

/**
 * DuplicateGroupCard - Displays a single duplicate group with action options
 */
export default function DuplicateGroupCard({
  group,
  isSelected,
  onToggleSelection,
  onAction,
  disabled,
}) {
  const [expanded, setExpanded] = useState(true);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);

  if (!group || !group.files) return null;

  const fileCount = group.files.length;
  const wasteBytes = group.waste_bytes || 0;
  const waste = formatBytes(wasteBytes);

  // Determine which file is largest
  const largestIndex = group.files.reduce((maxIdx, f, idx) => 
    (f.size > group.files[maxIdx].size) ? idx : maxIdx, 0);

  return (
    <div className={`border rounded-lg overflow-hidden transition ${
      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Group header */}
      <div
        className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelection}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 text-blue-500 rounded cursor-pointer"
          />
        </div>

        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
          <span className="text-2xl">{getFileIcon(group.files[0]?.ext)}</span>
        </div>

        <div className="flex-1">
          <div className="font-semibold text-gray-900">
            {fileCount} duplicate file{fileCount !== 1 ? 's' : ''}
          </div>
          <div className="text-sm text-gray-500">
            Hash: {group.hash.substring(0, 8)}... • {waste} waste
          </div>
        </div>

        <div className="flex-shrink-0 text-gray-400">
          <svg
            className={`w-6 h-6 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* Files list */}
      {expanded && (
        <div className="border-t bg-gray-50">
          {group.files.map((file, idx) => (
            <div
              key={file.path}
              className={`flex items-center gap-4 px-6 py-4 border-b last:border-b-0 ${
                selectedFileIndex === idx ? 'bg-white border-l-4 border-l-blue-500' : ''
              } hover:bg-white transition`}
              onClick={() => setSelectedFileIndex(idx)}
            >
              {/* File icon */}
              <div className="flex-shrink-0 text-2xl">
                {getFileIcon(file.ext)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {file.name}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {file.dir} • {formatBytes(file.size)} • Modified: {formatDate(file.file_mtime)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Hash: {file.hash?.substring(0, 12)}...
                </div>
              </div>

              {/* File size badge */}
              <div className="flex-shrink-0 text-right">
                <div className="font-semibold text-gray-900">
                  {formatBytes(file.size)}
                </div>
                {idx === largestIndex && (
                  <div className="text-xs text-orange-600 font-semibold mt-1">
                    LARGEST
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction('delete', idx);
                  }}
                  disabled={disabled}
                  title="Delete this file"
                  className="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50 transition"
                >
                  Delete
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction('keep', idx);
                  }}
                  disabled={disabled}
                  title="Mark to keep"
                  className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 transition"
                >
                  Keep
                </button>
              </div>
            </div>
          ))}

          {/* Group actions footer */}
          <div className="px-6 py-4 bg-gray-100 flex gap-2 justify-end">
            <button
              onClick={() => onAction('delete-all', null)}
              disabled={disabled}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 transition"
              title="Delete all files in this group"
            >
              Delete All
            </button>

            <button
              onClick={() => onAction('keep-largest', null)}
              disabled={disabled}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition"
              title="Keep largest, delete rest"
            >
              Keep Largest
            </button>

            <button
              onClick={() => onAction('skip-group', null)}
              disabled={disabled}
              className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition"
              title="Skip this group for now"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility functions
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(unixTimestamp) {
  if (!unixTimestamp) return 'Unknown';
  const date = new Date(unixTimestamp * 1000);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
