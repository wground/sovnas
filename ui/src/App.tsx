import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribe, listDir, downloadFile, deleteFile, renameFile, mkdir, UpdateEvent } from './api';
import { FileEntry, Config, SortField, SortDir, ViewMode, UploadProgress } from './types';
import FileBrowser from './components/FileBrowser';
import Toolbar from './components/Toolbar';
import UploadZone from './components/UploadZone';
import SettingsPanel from './components/SettingsPanel';
import Breadcrumb from './components/Breadcrumb';
import Toast from './components/Toast';

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const currentPathRef = useRef('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [config, setConfig] = useState<Config>({
    root: '',
    maxFileSize: 524_288_000,
    connected: false,
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const navigate = useCallback(
    async (path: string) => {
      currentPathRef.current = path;
      setCurrentPath(path);
      setLoading(true);
      try {
        await listDir(path);
      } catch {
        showToast('Failed to list directory', false);
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    const handleEvent = (evt: UpdateEvent) => {
      if (evt.type === 'dir-list') {
        // Normalize paths for comparison
        const normalize = (p: string) => '/' + p.replace(/^\//, '').replace(/\/$/, '');
        if (normalize(evt.path) === normalize(currentPathRef.current)) {
          setEntries(evt.entries);
          setLoading(false);
        }
      } else if (evt.type === 'file-data') {
        // file-data events are no longer used for downloads (we use direct HTTP)
        // kept for backwards compatibility
      } else if (evt.type === 'op-result') {
        showToast(evt.msg || (evt.success ? 'Done' : 'Error'), evt.success);
        if (evt.success) listDir(currentPath).catch(() => {});
      } else if (evt.type === 'config-update') {
        setConfig(evt.config);
      } else if (evt.type === 'daemon-status') {
        setConfig((c) => ({ ...c, connected: evt.connected }));
        if (!evt.connected) showToast('Daemon disconnected', false);
      }
    };

    const unsub = subscribe(handleEvent, () => {
      setTimeout(() => navigate(currentPath), 2000);
    });

    navigate(currentPath);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = a.size - b.size;
      else cmp = a.modified - b.modified;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [entries, sortField, sortDir]);

  const handleSort = (f: SortField) => {
    if (f === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('asc'); }
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Folder name:');
    if (!name?.trim()) return;
    const newPath = currentPath.replace(/\/$/, '') + '/' + name.trim();
    try {
      await mkdir(newPath);
    } catch {
      showToast('Failed to create folder', false);
    }
  };

  const handleDelete = async (path: string) => {
    if (!window.confirm(`Delete "${path.split('/').pop()}"?`)) return;
    try {
      await deleteFile(path);
    } catch {
      showToast('Delete failed', false);
    }
  };

  const handleRename = async (path: string) => {
    const current = path.split('/').pop() ?? '';
    const newName = window.prompt('New name:', current);
    if (!newName?.trim() || newName.trim() === current) return;
    const parent = path.substring(0, path.lastIndexOf('/')) || '/';
    const dst = parent.replace(/\/$/, '') + '/' + newName.trim();
    try {
      await renameFile(path, dst);
    } catch {
      showToast('Rename failed', false);
    }
  };

  const handleDownload = (path: string) => {
    // Download directly from daemon's HTTP server (avoids Chromium insecure-context blocks)
    const dlPort = 8090; // TODO: read from agent config instead of hardcoding (must match daemon.download_server_port in sovnas.config.json)
    const host = window.location.hostname;
    const cleanPath = path.replace(/^\//, '');
    const encoded = cleanPath.split('/').map(encodeURIComponent).join('/');
    window.open(`http://${host}:${dlPort}/${encoded}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#B31B1B]">SovNAS</h1>
        <div
          className={`w-2 h-2 rounded-full ${config.connected ? 'bg-green-500' : 'bg-red-400'}`}
          title={config.connected ? 'Daemon connected' : 'Daemon disconnected'}
        />
        <div className="flex-1" />
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:border-gray-400"
        >
          ⚙ Settings
        </button>
      </header>

      {showSettings && (
        <SettingsPanel config={config} onClose={() => setShowSettings(false)} />
      )}

      <div className="max-w-6xl mx-auto px-4 py-4">
        <Toolbar
          viewMode={viewMode}
          onViewMode={setViewMode}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          onUpload={() => setShowUpload(true)}
          onNewFolder={handleNewFolder}
        />

        <Breadcrumb path={currentPath} onNavigate={navigate} />

        {showUpload && (
          <UploadZone
            currentPath={currentPath}
            maxFileSize={config.maxFileSize}
            onClose={() => setShowUpload(false)}
            onProgress={(name, pct, total) =>
              setUploads((u) => {
                const idx = u.findIndex((x) => x.name === name);
                if (idx >= 0) {
                  const next = [...u];
                  next[idx] = { name, progress: pct, total };
                  return next;
                }
                return [...u, { name, progress: pct, total }];
              })
            }
            onDone={(name) => {
              setUploads((u) => u.filter((x) => x.name !== name));
              showToast(`Uploaded ${name}`);
              listDir(currentPath).catch(() => {});
            }}
            onError={(msg) => showToast(msg, false)}
          />
        )}

        {uploads.length > 0 && (
          <div className="mb-3 space-y-1">
            {uploads.map((u) => (
              <div key={u.name} className="bg-white rounded border border-gray-200 px-3 py-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate">{u.name}</span>
                  <span className="ml-2 shrink-0">{u.progress}%</span>
                </div>
                <div className="h-1 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-1 bg-[#B31B1B] rounded transition-all"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : (
          <FileBrowser
            entries={sortedEntries}
            viewMode={viewMode}
            currentPath={currentPath}
            onNavigate={navigate}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        )}
      </div>

      {toast && <Toast message={toast.msg} success={toast.ok} />}
    </div>
  );
}
