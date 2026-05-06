'use client';

import { useMemo, useState } from 'react';
import AppSidebar from './AppSidebar';
import PreviewModal from '../../features/dupscan/components/PreviewModal';
import FileManagerDashboard from '../../features/file-manager/components/FileManagerDashboard';
import DupScanWorkspace from '../../features/dupscan/components/DupScanWorkspace';
import useDupScan from '../../features/dupscan/hooks/useDupScan';

export default function Dashboard() {
  const [showFM, setShowFM] = useState(false);
  const {
    status,
    progress,
    scanPath,
    history,
    viewId,
    viewScan,
    fileStatus,
    keepMap,
    filter,
    preview,
    mainTab,
    sidebarOpen,
    dups,
    displayStatus,
    stats,
    setFilter,
    setMainTab,
    setPreview,
    setSidebarOpen,
    selectHistory,
    deleteHistory,
    startScan,
    stopScan,
    downloadReport,
    updateFileStatus,
    clearFileStatus,
    updateKeep,
    deleteFile,
  } = useDupScan();

  const shared = useMemo(() => ({
    dups,
    fileStatus,
    keepMap,
    filter,
    status: displayStatus,
    progress,
    onSetStatus: updateFileStatus,
    onClearStatus: clearFileStatus,
    onSetKeep: updateKeep,
    onDeleteFile: deleteFile,
    onPreview: (group, idx) => setPreview({ group, idx: idx || 0 }),
  }), [
    dups,
    fileStatus,
    keepMap,
    filter,
    displayStatus,
    progress,
    updateFileStatus,
    clearFileStatus,
    updateKeep,
    deleteFile,
    setPreview,
  ]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {sidebarOpen && (
        <AppSidebar
          history={history}
          viewId={viewId}
          status={status}
          onSelect={async (id) => {
            setShowFM(false);
            await selectHistory(id);
          }}
          onDelete={deleteHistory}
          onViewLive={() => { selectHistory(null); setShowFM(false); }}
          onOpenFM={() => setShowFM(true)}
          isFMActive={showFM}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {showFM ? (
          <FileManagerDashboard />
        ) : (
          <DupScanWorkspace
            displayStatus={displayStatus}
            progress={progress}
            viewScan={viewScan}
            scanPath={scanPath}
            startScan={startScan}
            stopScan={stopScan}
            downloadReport={downloadReport}
            dups={dups}
            viewId={viewId}
            filter={filter}
            setFilter={setFilter}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            mainTab={mainTab}
            setMainTab={setMainTab}
            stats={stats}
            shared={shared}
          />
        )}
      </div>

      {preview && (
        <PreviewModal
          group={preview.group}
          startIdx={preview.idx}
          fileStatus={fileStatus}
          keepMap={keepMap}
          onSetStatus={updateFileStatus}
          onClearStatus={clearFileStatus}
          onSetKeep={updateKeep}
          onDeleteFile={deleteFile}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
