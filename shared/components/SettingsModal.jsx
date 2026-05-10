'use client';

import { useState, useEffect } from 'react';
import { X, ToggleLeft, ToggleRight, HardDrive, FolderOpen } from 'lucide-react';
import { getSettings, updateSettings } from '../../lib/scan-controller';

const FM_SETTINGS_KEY = 'dupscan-fm-settings';

const defaultFmSettings = {
  autoScan: false,
  scanPath: 'C:\\',
  includeHidden: false,
};

function getFmSettings() {
  try {
    if (typeof window === 'undefined') return defaultFmSettings;
    const stored = localStorage.getItem(FM_SETTINGS_KEY);
    return stored ? { ...defaultFmSettings, ...JSON.parse(stored) } : defaultFmSettings;
  } catch {
    return defaultFmSettings;
  }
}

function saveFmSettings(settings) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FM_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export default function SettingsModal({ isOpen, onClose, onSettingsChange }) {
  const [settings, setSettings] = useState(() => getSettings());
  const [fmSettings, setFmSettings] = useState(() => getFmSettings());

  // Reload settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
      setFmSettings(getFmSettings());
    }
  }, [isOpen]);

  // DupScan handlers
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

  // FileManager handlers
  const handleToggleFmAutoScan = () => {
    const updated = { ...fmSettings, autoScan: !fmSettings.autoScan };
    setFmSettings(updated);
    saveFmSettings(updated);
  };

  const handleFmPathChange = (e) => {
    setFmSettings(prev => ({ ...prev, scanPath: e.target.value }));
  };

  const handleFmPathBlur = () => {
    saveFmSettings(fmSettings);
  };

  const handleToggleFmHidden = () => {
    const updated = { ...fmSettings, includeHidden: !fmSettings.includeHidden };
    setFmSettings(updated);
    saveFmSettings(updated);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg shadow-2xl p-6 w-[450px] max-h-[90vh] overflow-y-auto"
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

        {/* DupScan Section */}
        <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--neon)' }}>
            DupScan (Duplicate Finder)
          </h3>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Auto-scan on startup</label>
              <button onClick={handleToggleAutoScan} className="transition-all">
                {settings.autoScan
                  ? <ToggleRight size={24} style={{ color: 'var(--neon)' }} />
                  : <ToggleLeft size={24} style={{ color: 'var(--dim)' }} />
                }
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--dim)' }}>
              Automatically start duplicate scan when the app loads
            </p>
          </div>

          <div className="mb-4">
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Include hidden files</label>
              <button onClick={handleToggleHidden} className="transition-all">
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
        </div>

        {/* FileManager Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--neon)' }}>
            File Manager (Gallery)
          </h3>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Auto-index on startup</label>
              <button onClick={handleToggleFmAutoScan} className="transition-all">
                {fmSettings.autoScan
                  ? <ToggleRight size={24} style={{ color: 'var(--neon)' }} />
                  : <ToggleLeft size={24} style={{ color: 'var(--dim)' }} />
                }
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--dim)' }}>
              Automatically start file indexing when the app loads
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              <FolderOpen size={14} className="inline mr-2" />
              Default folder
            </label>
            <input
              type="text"
              value={fmSettings.scanPath}
              onChange={handleFmPathChange}
              onBlur={handleFmPathBlur}
              className="w-full px-3 py-2 rounded border"
              style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              placeholder="e.g., C:\"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Include hidden files</label>
              <button onClick={handleToggleFmHidden} className="transition-all">
                {fmSettings.includeHidden
                  ? <ToggleRight size={24} style={{ color: 'var(--neon)' }} />
                  : <ToggleLeft size={24} style={{ color: 'var(--dim)' }} />
                }
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--dim)' }}>
              Index files starting with "." (dot files)
            </p>
          </div>
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