/**
 * Scan Controller - Manages scanning modes, persistence, and background scanning
 */

const SETTINGS_KEY = 'dupscan-settings';

export const defaultSettings = {
  autoScan: false,          // Auto scan on startup
  scanPath: 'C:\\Users',    // Default scan path
  includeHidden: false,
  lastScanId: null,
  lastScannedAt: null,
};

export function getSettings() {
  try {
    if (typeof window === 'undefined') return defaultSettings;
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function updateSettings(patch) {
  const current = getSettings();
  const updated = { ...current, ...patch };
  saveSettings(updated);
  return updated;
}

/**
 * Should auto-start background scan?
 * Returns true ONLY if:
 * - autoScan is enabled in settings
 * - AND no duplicate data exists in database
 * If DB already has data, just load it - don't scan
 */
export function shouldAutoScan(scanHistory = []) {
  const settings = getSettings();
  // If autoScan is disabled, never auto-scan
  if (!settings.autoScan) return false;

  // Auto-scan only if there's data in DB
  // This check is done in the hook - if dups loaded are 0, then start scan
  return true;
}

/**
 * Format file size consistently
 */
export function fmtSize(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b)/Math.log(1024));
  return `${(b/Math.pow(1024,i)).toFixed(1)} ${u[i]}`;
}

/**
 * Filter duplicates by category
 */
export function filterDupsByCategory(dups, category) {
  if (category === 'All') return dups;
  const catMap = {
    'Photos': 'Photos',
    'Videos': 'Videos',
    'Audio': 'Audio',
    'Documents': 'Documents',
    'Archives': 'Archives',
    'Code': 'Code',
    'Others': 'Others',
  };
  return dups.filter(d => d.cat === catMap[category]);
}

/**
 * Get duplicate statistics
 */
export function getDuplicateStats(dups) {
  const stats = {
    totalGroups: dups.length,
    totalWaste: 0,
    totalExtraFiles: 0,
    byCategory: {},
  };
  
  for (const dup of dups) {
    stats.totalWaste += dup.waste || 0;
    stats.totalExtraFiles += dup.count - 1;
    
    if (!stats.byCategory[dup.cat]) {
      stats.byCategory[dup.cat] = { groups: 0, waste: 0 };
    }
    stats.byCategory[dup.cat].groups++;
    stats.byCategory[dup.cat].waste += dup.waste || 0;
  }
  
  return stats;
}

/**
 * Lazy load duplicates in batches
 */
export function getLazyDups(dups, batchSize = 100, batchNumber = 0) {
  const start = batchNumber * batchSize;
  const end = start + batchSize;
  return {
    items: dups.slice(start, end),
    total: dups.length,
    hasMore: end < dups.length,
    currentBatch: batchNumber,
  };
}
