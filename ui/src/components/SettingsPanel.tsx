import React from 'react';
import { Config } from '../types';
import { formatBytes } from '../utils';

interface Props {
  config: Config;
  onClose: () => void;
}

export default function SettingsPanel({ config, onClose }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Storage Root</label>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 font-mono text-xs break-all">
              {config.root || '(not configured)'}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Set via dojo:{' '}
              <code className="bg-gray-100 px-1 rounded">+sovnas!configure</code>
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max File Size</label>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700">
              {formatBytes(config.maxFileSize)}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Daemon Status</label>
            <div
              className={`flex items-center gap-2 border rounded px-3 py-2 ${
                config.connected
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  config.connected ? 'bg-green-500' : 'bg-red-400'
                }`}
              />
              {config.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
