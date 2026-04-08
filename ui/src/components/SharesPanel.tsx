import React, { useState } from 'react';
import { Share, RemoteShare } from '../types';
import { shareFolder, unshareFolder } from '../api';

interface Props {
  shares: Share[];
  remoteShares: RemoteShare[];
  onClose: () => void;
  onBrowseRemote: (host: string, path: string) => void;
}

export default function SharesPanel({ shares, remoteShares, onClose, onBrowseRemote }: Props) {
  const [newPath, setNewPath] = useState('');
  const [newWho, setNewWho] = useState('');
  const [newPerm, setNewPerm] = useState<'read' | 'read-write'>('read');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newPath.trim() || !newWho.trim()) return;
    setAdding(true);
    try {
      await shareFolder(newPath.trim(), newWho.trim().replace(/^~/, ''), newPerm);
      setNewPath('');
      setNewWho('');
    } catch {
      // toast handled by parent
    }
    setAdding(false);
  };

  const handleRevoke = async (path: string, who: string) => {
    if (!window.confirm(`Revoke ${who}'s access to ${path}?`)) return;
    try {
      await unshareFolder(path, who);
    } catch {
      // handled
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">File Sharing</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">
            ✕
          </button>
        </div>

        {/* My Shares (host side) */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Folders I Share</h3>
          {shares.length === 0 ? (
            <p className="text-sm text-gray-400">No folders shared yet.</p>
          ) : (
            <div className="space-y-2">
              {shares.map((s) => (
                <div key={s.path} className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-gray-700">{s.path}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        s.perm === 'read-write'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.perm}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.who.map((w) => (
                      <span key={w} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded px-2 py-0.5">
                        ~{w}
                        <button
                          onClick={() => handleRevoke(s.path, w)}
                          className="text-red-400 hover:text-red-600 ml-0.5"
                          title="Revoke access"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new share */}
          <div className="mt-3 border border-gray-200 rounded px-3 py-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-2">Share a folder</div>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Folder path (e.g. /shared)"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                className="flex-1 min-w-[150px] border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[#B31B1B]"
              />
              <input
                type="text"
                placeholder="Ship (e.g. ~zod)"
                value={newWho}
                onChange={(e) => setNewWho(e.target.value)}
                className="w-40 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[#B31B1B]"
              />
              <select
                value={newPerm}
                onChange={(e) => setNewPerm(e.target.value as 'read' | 'read-write')}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#B31B1B]"
              >
                <option value="read">Read only</option>
                <option value="read-write">Read + Write</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || !newPath.trim() || !newWho.trim()}
                className="px-3 py-1.5 bg-[#B31B1B] text-white rounded text-sm hover:bg-[#8a1515] disabled:opacity-50"
              >
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Remote Shares (shares others give us) */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Shared With Me</h3>
          {remoteShares.length === 0 ? (
            <p className="text-sm text-gray-400">No remote shares available.</p>
          ) : (
            <div className="space-y-2">
              {remoteShares.map((rs, i) => (
                <div
                  key={`${rs.host}-${rs.path}-${i}`}
                  className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs text-gray-500">~{rs.host}</span>
                    <span className="font-mono text-xs text-gray-700 ml-1">{rs.path}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      rs.perm === 'read-write'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {rs.perm}
                    </span>
                  </div>
                  <button
                    onClick={() => onBrowseRemote(rs.host, rs.path)}
                    className="text-xs px-3 py-1 rounded border border-[#B31B1B] text-[#B31B1B] hover:bg-red-50"
                  >
                    Browse
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
