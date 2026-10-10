import React, { useEffect, useState } from 'react';
import { op } from '../api';
import { IconCheck, IconChevronDown, IconX, KindIcon } from '../icons';
import { Job } from '../types';
import { Upload, uploader } from '../uploads';
import { baseName, formatBytes, kindOf } from '../util';

const volName = (v: string) => (v === 'host' ? 'Host disk' : 'My Drive');

export default function UploadPanel({ jobs }: { jobs: Job[] }) {
  const [ups, setUps] = useState<Upload[]>([]);
  const [open, setOpen] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => { uploader.subscribe(setUps); }, []);

  const shownJobs = jobs.filter((j) => !hidden.has(j.id));
  if (!ups.length && !shownJobs.length) return null;

  const activeUps = ups.filter((u) => ['queued', 'uploading', 'compressing'].includes(u.status));
  const activeJobs = shownJobs.filter((j) => j.step !== 'done' && j.step !== 'fail');
  const failed = ups.filter((u) => u.status === 'error').length + shownJobs.filter((j) => j.step === 'fail').length;
  const parts: string[] = [];
  if (activeUps.length) parts.push(`Uploading ${activeUps.length} item${activeUps.length === 1 ? '' : 's'}`);
  if (activeJobs.length) parts.push(`Moving ${activeJobs.length} item${activeJobs.length === 1 ? '' : 's'}`);
  const busy = parts.length > 0;
  const title = busy ? parts.join(' · ') : failed ? `${failed} item${failed === 1 ? '' : 's'} failed` : 'All done';

  const close = () => {
    uploader.clearFinished();
    for (const j of shownJobs) if (j.step === 'done' || j.step === 'fail') op({ op: 'dismiss-job', id: j.id });
    setHidden(new Set([...hidden, ...shownJobs.filter((j) => j.step === 'done' || j.step === 'fail').map((j) => j.id)]));
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
      <div className="flex items-center gap-2 bg-neutral-800 px-4 py-3 text-sm text-white dark:bg-neutral-950">
        <span className="flex-1 font-medium">{title}</span>
        <button onClick={() => setOpen(!open)} className="rounded-full p-1 hover:bg-white/10" aria-label="Toggle activity">
          <IconChevronDown className={`w-4 h-4 transition-transform ${open ? '' : 'rotate-180'}`} />
        </button>
        {!busy && (
          <button onClick={close} className="rounded-full p-1 hover:bg-white/10" aria-label="Close"><IconX className="w-4 h-4" /></button>
        )}
      </div>
      {open && (
        <ul className="max-h-72 overflow-auto">
          {shownJobs.map((j) => {
            const pct = j.total ? Math.min(100, Math.round((100 * j.done) / j.total)) : j.step === 'done' ? 100 : 0;
            const running = j.step !== 'done' && j.step !== 'fail';
            return (
              <li key={j.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-0 dark:border-neutral-800">
                <KindIcon kind={kindOf({ name: j.name, dir: j.dir, mime: '' })} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate" title={j.name}>{j.name}</div>
                  <div className="text-xs text-neutral-500">
                    {running && `Moving to ${volName(j.to.vol)} · ${formatBytes(j.done)} of ${formatBytes(j.total)}`}
                    {j.step === 'done' && `Moved to ${volName(j.to.vol)}${j.to.path.lastIndexOf('/') > 0 ? ' › ' + baseName(j.to.path.slice(0, j.to.path.lastIndexOf('/'))) : ''}`}
                    {j.step === 'fail' && <span className="text-red-600">{j.msg || 'Move failed'}. Nothing was removed.</span>}
                  </div>
                  {running && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                {j.step === 'done' && <IconCheck className="w-5 h-5 text-emerald-600" />}
              </li>
            );
          })}
          {ups.map((u) => {
            const pct = u.size ? Math.min(100, Math.round((100 * u.sent) / u.size)) : 0;
            return (
              <li key={u.key} className="group flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-0 dark:border-neutral-800">
                <KindIcon kind={kindOf({ name: u.name, dir: false, mime: u.file.type })} className="w-5 h-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate" title={u.name}>{u.name}</div>
                  <div className="text-xs text-neutral-500">
                    {u.status === 'uploading' && `${formatBytes(u.sent)} of ${formatBytes(u.size)} · ${formatBytes(u.rate)}/s${u.rerouted ? ' · to Host disk' : ''}`}
                    {u.status === 'compressing' && 'Compressing…'}
                    {u.status === 'queued' && 'Waiting…'}
                    {u.status === 'done' && `${formatBytes(u.file.size)}${u.note ? ' · ' + u.note : ''}`}
                    {u.status === 'error' && <span className="text-red-600">{u.msg}</span>}
                    {u.status === 'cancelled' && 'Cancelled'}
                  </div>
                  {u.status === 'uploading' && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                {u.status === 'done' ? (
                  <IconCheck className="w-5 h-5 text-emerald-600" />
                ) : ['queued', 'uploading', 'compressing'].includes(u.status) ? (
                  <button onClick={() => uploader.cancel(u.key)} className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label={`Cancel ${u.name}`}>
                    <IconX className="w-4 h-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
