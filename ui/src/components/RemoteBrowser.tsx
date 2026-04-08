import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileEntry, RemoteShare, SortField, SortDir } from '../types';
import { remoteLs, remoteDownload, remoteMkdir, remoteRm, remoteUploadFile } from '../api';
import { formatBytes, formatDate } from '../utils';

interface Props {
  host: string;
  basePath: string;
  perm: 'read' | 'read-write';
  entries: FileEntry[];
  currentRemotePath: string;
  loading: boolean;
  onNavigate: (path: string) => void;
  onClose: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}

export default function RemoteBrowser({
  host, basePath, perm, entries, currentRemotePath, loading, onNavigate, onClose, showToast,
}: Props) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownload = async (path: string) => {
    try {
      await remoteDownload(host, path);
    } catch {
      showToast('Remote download failed', false);
    }
  };

  const handleMkdir = async () => {
    const name = window.prompt('Folder name:');
    if (!name?.trim()) return;
    const newPath = currentRemotePath.replace(/\/$/, '') + '/' + name.trim();
    try {
      await remoteMkdir(host, newPath);
    } catch {
      showToast('Failed to create remote folder', false);
    }
  };

  const handleDelete = async (path: string) => {
    const fname = path.split('/').pop() ?? path;
    if (!window.confirm(`Delete "${fname}" on ~${host}?`)) return;
    try {
      await remoteRm(host, path);
    } catch {
      showToast('Remote delete failed', false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await remoteUploadFile(file, host, currentRemotePath, () => {});
      showToast(`Uploaded ${file.name} to ~${host}`);
      remoteLs(host, currentRemotePath).catch(() => {});
    } catch {
      showToast('Remote upload failed', false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Build breadcrumb segments from currentRemotePath relative to basePath
  const breadcrumbs = useMemo(() => {
    const segments: { label: string; path: string }[] = [
      { label: `~${host}:${basePath}`, path: basePath },
    ];
    if (currentRemotePath !== basePath) {
      const suffix = currentRemotePath.slice(basePath.length).replace(/^\//, '');
      const parts = suffix.split('/').filter(Boolean);
      let running = basePath;
      for (const p of parts) {
        running = running.replace(/\/$/, '') + '/' + p;
        segments.push({ label: p, path: running });
      }
    }
    return segments;
  }, [host, basePath, currentRemotePath]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#B31B1B]">Remote</span>
          <span className="text-xs text-gray-500">~{host}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            perm === 'read-write' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {perm}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">
          ✕ Close
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-1 flex-wrap border-b border-gray-50">
        {breadcrumbs.map((bc, i) => (
          <span key={bc.path}>
            {i > 0 && <span className="mx-1">/</span>}
            <button
              onClick={() => onNavigate(bc.path)}
              className="hover:text-[#B31B1B] hover:underline"
            >
              {bc.label}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-50">
        {perm === 'read-write' && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 bg-[#B31B1B] text-white rounded text-xs hover:bg-[#8a1515]"
            >
              Upload
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <button
              onClick={handleMkdir}
              className="px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded text-xs hover:border-gray-500"
            >
              New Folder
            </button>
          </>
        )}
        <div className="flex-1" />
        <span className="text-xs text-gray-400 mr-1">Sort:</span>
        {(['name', 'size', 'modified'] as SortField[]).map((f) => (
          <button
            key={f}
            onClick={() => handleSort(f)}
            className={`text-xs px-1.5 py-0.5 rounded border ${
              sortField === f
                ? 'border-[#B31B1B] text-[#B31B1B] bg-red-50'
                : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)} {sortField === f ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading remote files...</div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Empty folder</div>
        ) : (
          sortedEntries.map((entry) => (
            <div
              key={entry.fullPath || entry.name}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm group"
            >
              <span className="text-gray-400 w-4 text-center">
                {entry.isDir ? '/' : ' '}
              </span>
              {entry.isDir ? (
                <button
                  onClick={() => onNavigate(entry.fullPath)}
                  className="text-[#B31B1B] hover:underline font-mono text-xs truncate flex-1 text-left"
                >
                  {entry.name}
                </button>
              ) : (
                <span className="font-mono text-xs text-gray-700 truncate flex-1">{entry.name}</span>
              )}
              <span className="text-xs text-gray-400 w-20 text-right shrink-0">
                {entry.isDir ? '--' : formatBytes(entry.size)}
              </span>
              <span className="text-xs text-gray-400 w-28 text-right shrink-0">
                {formatDate(entry.modified)}
              </span>
              <div className="w-16 text-right shrink-0 opacity-0 group-hover:opacity-100">
                {!entry.isDir && (
                  <button
                    onClick={() => handleDownload(entry.fullPath)}
                    className="text-xs text-blue-600 hover:underline mr-2"
                  >
                    DL
                  </button>
                )}
                {perm === 'read-write' && (
                  <button
                    onClick={() => handleDelete(entry.fullPath)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Del
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
