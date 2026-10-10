import React, { useState } from 'react';
import { daemonScriptUrl, op } from '../api';
import { IconCopy } from '../icons';
import { DriveState, Vol } from '../types';
import { formatBytes } from '../util';
import { Btn, Modal, useToast } from './primitives';

const MB = 1024 * 1024;

export function HostSetup({ state }: { state: DriveState }) {
  const toast = useToast();
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copied'), () => {});
  const steps = [
    { label: 'In your ship’s dojo, put the app’s files on the host:', cmd: `|mount %${state.desk}` },
    { label: 'On the machine that runs your ship, start the daemon (it finds your ship by itself):', cmd: `python3 <your-pier>/${state.desk}/daemon/sovnasd.py` },
    { label: 'To keep it running across reboots:', cmd: `sudo python3 <your-pier>/${state.desk}/daemon/sovnasd.py --install` },
  ];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-neutral-600 dark:text-neutral-300">
        The host disk is optional. It stores files in a folder on the computer that runs your ship
        (default <code>~/sovnas/{state.our.slice(1)}</code>) instead of inside the ship, which is better for large files.
        Files there are still shareable with any ship.
      </p>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i}>
            <div className="text-neutral-600 dark:text-neutral-300">{i + 1}. {s.label}</div>
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-100">
              <span className="flex-1 overflow-x-auto whitespace-nowrap">{s.cmd}</span>
              <button onClick={() => copy(s.cmd)} className="text-neutral-400 hover:text-white" aria-label="Copy command"><IconCopy className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-neutral-500">
        No dojo access to the host? Download the daemon directly: <a className="text-brand hover:underline" href={daemonScriptUrl()}>sovnasd.py</a> (Python 3.8+, no dependencies).
        Use <code>--root /path/{'{ship}'}</code> to choose where files are kept.
      </p>
    </div>
  );
}

export default function SettingsDialog({ state, onClose }: { state: DriveState; onClose: () => void }) {
  const toast = useToast();
  const [quota, setQuota] = useState(Math.round(state.settings.quota / MB));
  const [maxFile, setMaxFile] = useState(Math.round(state.settings.maxFile / MB));
  const [compress, setCompress] = useState(state.settings.compress);
  const [dflt, setDflt] = useState<Vol>(state.settings.default);
  const [big, setBig] = useState(Math.max(1, Math.round(state.settings.big / MB)));
  const save = async () => {
    const r = await op({
      op: 'settings', quota: quota * MB, maxFile: maxFile * MB, compress,
      default: dflt, big: big * MB,
    });
    if (r.ok) { toast('Settings saved'); onClose(); } else toast(r.msg, false);
  };
  const h = state.host;
  return (
    <Modal wide title="Settings" onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={save}>Save</Btn></>}>
      <section>
        <h3 className="mb-2 text-sm font-medium">Where new files go</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['ship', 'My Drive', 'Inside your ship. Works everywhere, best for documents.'],
            ['host', 'Host disk', 'A folder on the machine that runs your ship. Best for big files.'],
          ] as [Vol, string, string][]).map(([v, label, desc]) => (
            <label key={v} className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${dflt === v ? 'border-brand bg-brand/5' : 'border-neutral-200 dark:border-neutral-700'}`}>
              <input type="radio" name="default" checked={dflt === v} onChange={() => setDflt(v)} className="mt-0.5" />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-neutral-500">{desc}</span>
                {v === 'host' && !h.live && <span className="block text-xs text-amber-700 dark:text-amber-300">Not connected yet; My Drive is used until it is.</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">SovNAS opens here, and the New button uploads here when you aren’t inside a folder.</p>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Send files bigger than
          <input type="number" min={1} value={big} onChange={(e) => setBig(Math.max(1, +e.target.value))}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800" />
          MB to the host disk automatically
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          When the host disk is connected, uploads to My Drive above this size, or above My Drive’s file limit, go to the same folder on the host disk instead.
          You can also right-click anything and choose “Move to Host disk” or “Move to My Drive”.
        </p>
      </section>

      <section className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800">
        <h3 className="mb-2 text-sm font-medium">In-ship storage</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Files stored in-ship live in your ship’s memory (its loom), so they work anywhere your ship runs, with no setup.
          Using {formatBytes(state.used)} across {state.blobs} unique file{state.blobs === 1 ? '' : 's'}.
          Ships default to a 2 GB loom; start your ship with <code>--loom 32</code> (4 GB) or more before raising the limit much.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Storage limit (MB)
            <input type="number" min={1} value={quota} onChange={(e) => setQuota(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
          <label className="text-sm">Largest file (MB)
            <input type="number" min={1} value={maxFile} onChange={(e) => setMaxFile(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="mt-0.5" />
          <span>Compress files in the browser before storing them in-ship (text, documents, and other compressible types; served back transparently)</span>
        </label>
      </section>

      <section className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
          Host disk
          <span className={`rounded-full px-2 py-0.5 text-xs ${h.live ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
            {h.live ? 'Connected' : 'Not connected'}
          </span>
        </h3>
        {h.live ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Folder</dt><dd className="break-all font-mono text-xs">{h.root}</dd>
            <dt className="text-neutral-500">Free space</dt><dd>{formatBytes(h.free)} of {formatBytes(h.total)}</dd>
            <dt className="text-neutral-500">Daemon</dt><dd>sovnasd {h.ver}</dd>
            <dt className="text-neutral-500">LAN transfers</dt><dd>{h.port ? `port ${h.port} (used automatically on http)` : 'off'}</dd>
          </dl>
        ) : <HostSetup state={state} />}
      </section>

      <section className="mt-6 border-t border-neutral-100 pt-5 text-xs text-neutral-500 dark:border-neutral-800">
        SovNAS {state.version} on {state.our}{state.publisher ? `, published by ${state.publisher}` : ''}.
        Everything your ship receives is kept in its event log; after moving lots of data, stop your ship and run <code>urbit roll</code> then <code>urbit chop</code> to reclaim disk space.
      </section>
    </Modal>
  );
}
