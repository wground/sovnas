import React, { useState, useEffect } from 'react';
import { FileEntry, ViewMode } from '../types';
import { formatBytes, formatDate, fileIcon } from '../utils';

interface Props {
  entries: FileEntry[];
  viewMode: ViewMode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onDownload: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
}

interface ContextMenu {
  entry: FileEntry;
  x: number;
  y: number;
}

function entryPath(entry: FileEntry, currentPath: string): string {
  return entry.fullPath || (currentPath.replace(/\/$/, '') + '/' + entry.name);
}

export default function FileBrowser({
  entries,
  viewMode,
  currentPath,
  onNavigate,
  onDownload,
  onDelete,
  onRename,
}: Props) {
  const [menu, setMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const openMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ entry, x: e.clientX, y: e.clientY });
  };

  const handleClick = (entry: FileEntry) => {
    if (entry.isDir) {
      onNavigate(currentPath.replace(/\/$/, '') + '/' + entry.name);
    } else {
      onDownload(entryPath(entry, currentPath));
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-4">📁</div>
        <p className="text-lg">This folder is empty</p>
        <p className="text-sm mt-1">Upload files to get started</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {entries.map((entry) => (
            <div
              key={entry.name}
              onDoubleClick={() => handleClick(entry)}
              onContextMenu={(e) => openMenu(e, entry)}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-white hover:shadow cursor-pointer select-none border border-transparent hover:border-gray-200"
            >
              <span className="text-3xl">{fileIcon(entry)}</span>
              <span
                className="text-xs text-gray-700 truncate w-full text-center"
                title={entry.name}
              >
                {entry.name}
              </span>
              {!entry.isDir && (
                <span className="text-xs text-gray-400">{formatBytes(entry.size)}</span>
              )}
            </div>
          ))}
        </div>
        {menu && (
          <EntryContextMenu
            entry={menu.entry}
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
            onDownload={() => { onDownload(entryPath(menu.entry, currentPath)); setMenu(null); }}
            onDelete={() => { onDelete(entryPath(menu.entry, currentPath)); setMenu(null); }}
            onRename={() => { onRename(entryPath(menu.entry, currentPath)); setMenu(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">Size</th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">Modified</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.name}
              onContextMenu={(e) => openMenu(e, entry)}
              className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-4 py-2" onClick={() => handleClick(entry)}>
                <span className="mr-2">{fileIcon(entry)}</span>
                <span className={entry.isDir ? 'font-medium text-gray-800' : 'text-gray-700'}>
                  {entry.name}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-gray-500">
                {entry.isDir ? '—' : formatBytes(entry.size)}
              </td>
              <td className="px-4 py-2 text-right text-gray-500">
                {formatDate(entry.modified)}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={(e) => openMenu(e, entry)}
                  className="text-gray-400 hover:text-gray-700 px-1 text-lg leading-none"
                >
                  ⋮
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {menu && (
        <EntryContextMenu
          entry={menu.entry}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onDownload={() => { onDownload(entryPath(menu.entry, currentPath)); setMenu(null); }}
          onDelete={() => { onDelete(entryPath(menu.entry, currentPath)); setMenu(null); }}
          onRename={() => { onRename(entryPath(menu.entry, currentPath)); setMenu(null); }}
        />
      )}
    </div>
  );
}

function EntryContextMenu({
  entry,
  x,
  y,
  onClose,
  onDownload,
  onDelete,
  onRename,
}: {
  entry: FileEntry;
  x: number;
  y: number;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[150px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {!entry.isDir && (
        <button
          onClick={onDownload}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
        >
          ⬇ Download
        </button>
      )}
      <button
        onClick={onRename}
        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
      >
        ✏ Rename
      </button>
      <hr className="my-1 border-gray-100" />
      <button
        onClick={onDelete}
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        🗑 Delete
      </button>
    </div>
  );
}
