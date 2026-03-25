import React, { useEffect, useState } from 'react';
import { Config, DaemonConfig } from '../types';
import { readDaemonConfig, writeDaemonConfig } from '../api';
import { formatBytes } from '../utils';

interface Props {
  config: Config;
  daemonConfig: DaemonConfig | null;
  onClose: () => void;
}

export default function SettingsPanel({ config, daemonConfig, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DaemonConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    readDaemonConfig().catch(() => {});
  }, []);

  const startEdit = () => {
    if (daemonConfig) {
      setDraft(JSON.parse(JSON.stringify(daemonConfig)));
      setEditing(true);
      setMsg('');
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setMsg('');
    try {
      await writeDaemonConfig(draft);
      setMsg('Saved. Some changes require a daemon restart to take effect.');
      setEditing(false);
    } catch {
      setMsg('Failed to save config.');
    }
    setSaving(false);
  };

  const updateShip = (field: string, val: string) => {
    if (!draft) return;
    setDraft({ ...draft, ship: { ...draft.ship, [field]: val } });
  };

  const updateDaemon = (field: string, val: string | number) => {
    if (!draft) return;
    setDraft({ ...draft, daemon: { ...draft.daemon, [field]: val } });
  };

  const dc = editing ? draft : daemonConfig;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">
            ✕
          </button>
        </div>

        {/* Agent status (always read-only) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Storage Root</label>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 font-mono text-xs break-all">
              {config.root || '(not configured)'}
            </div>
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

        {/* Daemon config */}
        {!dc ? (
          <div className="text-sm text-gray-400 py-2">
            {config.connected ? 'Loading daemon config...' : 'Connect daemon to view config'}
          </div>
        ) : (
          <>
            <div className="border-t border-gray-100 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Daemon Configuration</h3>
                {!editing ? (
                  <button
                    onClick={startEdit}
                    className="text-xs px-3 py-1 rounded border border-gray-300 hover:border-[#B31B1B] hover:text-[#B31B1B]"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditing(false); setMsg(''); }}
                      className="text-xs px-3 py-1 rounded border border-gray-300 hover:border-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="text-xs px-3 py-1 rounded bg-[#B31B1B] text-white hover:bg-[#8a1515] disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Field label="Ship Name" value={dc.ship.name} editing={editing}
                  onChange={(v) => updateShip('name', v)} />
                <Field label="Pier Path" value={dc.ship.pier} editing={editing}
                  onChange={(v) => updateShip('pier', v)} mono />
                <Field label="Storage Root" value={dc.daemon.storage_root} editing={editing}
                  onChange={(v) => updateDaemon('storage_root', v)} mono />
                <Field label="Max Upload (bytes)" value={String(dc.daemon.max_upload_bytes)} editing={editing}
                  onChange={(v) => updateDaemon('max_upload_bytes', parseInt(v) || 0)} />
                <Field label="Download Port" value={String(dc.daemon.download_server_port)} editing={editing}
                  onChange={(v) => updateDaemon('download_server_port', parseInt(v) || 8090)} />
                <Field label="Log Level" value={dc.daemon.log_level} editing={editing}
                  onChange={(v) => updateDaemon('log_level', v)} />
              </div>
            </div>

            {msg && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {msg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, editing, onChange, mono,
}: {
  label: string; value: string; editing: boolean;
  onChange: (v: string) => void; mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#B31B1B] ${
            mono ? 'font-mono text-xs' : ''
          }`}
        />
      ) : (
        <div className={`bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 break-all ${
          mono ? 'font-mono text-xs' : ''
        }`}>
          {value || '—'}
        </div>
      )}
    </div>
  );
}
