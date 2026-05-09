'use client';

import TopBar from './TopBar';
import StatsBar from './StatsBar';
import ResultsView from './ResultsView';
import GalleryView from './GalleryView';

export default function DupScanWorkspace({
  displayStatus,
  progress,
  viewScan,
  scanPath,
  startScan,
  stopScan,
  downloadReport,
  dups,
  viewId,
  filter,
  setFilter,
  sidebarOpen,
  setSidebarOpen,
  mainTab,
  setMainTab,
  stats,
  shared,
}) {
  return (
    <>
      <TopBar
        status={displayStatus}
        progress={progress}
        scanPath={viewScan?.path || scanPath}
        onStart={startScan}
        onStop={stopScan}
        onDownload={downloadReport}
        dups={dups}
        isHistory={!!viewId}
        viewScan={viewScan}
        filter={filter}
        onFilterChange={setFilter}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        mainTab={mainTab}
        onMainTab={setMainTab}
      />
      <StatsBar stats={stats} />
      <div className="flex-1 overflow-hidden">
        {mainTab === 'list' && <ResultsView {...shared} />}
        {mainTab === 'gallery' && <GalleryView {...shared} />}
      </div>
    </>
  );
}
