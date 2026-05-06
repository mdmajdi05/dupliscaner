'use client';

import { useState } from 'react';
import { X, ToggleLeft, ToggleRight, HardDrive } from 'lucide-react';
import { getSettings, updateSettings } from '../../lib/scan-controller';

export default function SettingsModal({ isOpen, onClose, onSettingsChange }) {
  const [settings, setSettings] = useState(() => getSettings());

  const handleToggleAutoScan = () => {
    const updated = { ...settings, autoScan: !settings.autoScan };
    setSettings(updated);
    updateSettings(updated);
    onSettingsChange?.(updated);
  };

  const handleScanPathChange = (e) => {
    const path = e.target.value;
    setSettings(prev => ({ ...prev, scanPath: path }));
  };

  const handleScanPathBlur = () => {
    updateSettings({ scanPath: settings.scanPath });
    onSettingsChange?.(settings);
  };

  const handleToggleHidden = () => {
    const updated = { ...settings, includeHidden: !settings.includeHidden };
    setSettings(updated);
    updateSettings(updated);
    onSettingsChange?.(updated);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg shadow-2xl p-6 w-96 max-h-96 overflow-y-auto"
        style={{ background: 'var(--s1)', color: 'var(--text)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold">Auto-scan on startup</label>
            <button
              onClick={handleToggleAutoScan}
              className="transition-all"
            >
              {settings.autoScan
                ? <ToggleRight size={24} style={{ color: 'var(--neon)' }} />
                : <ToggleLeft size={24} style={{ color: 'var(--dim)' }} />
              }
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--dim)' }}>
            Automatically start scanning when the app loads (if last scan was {'>'}1 hour ago)
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">
            <HardDrive size={14} className="inline mr-2" />
            Default scan path
          </label>
          <input
            type="text"
            value={settings.scanPath}
            onChange={handleScanPathChange}
            onBlur={handleScanPathBlur}
            className="w-full px-3 py-2 rounded border"
            style={{
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            placeholder="e.g., C:\Users"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--dim)' }}>
            Path to scan when auto-scan triggers
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold">Include hidden files</label>
            <button
              onClick={handleToggleHidden}
              className="transition-all"
            >
              {settings.includeHidden
                ? <ToggleRight size={24} style={{ color: 'var(--neon)' }} />
                : <ToggleLeft size={24} style={{ color: 'var(--dim)' }} />
              }
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--dim)' }}>
            Scan files starting with "." (dot files)
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded font-semibold transition-colors"
          style={{ background: 'var(--neon)', color: '#000' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
