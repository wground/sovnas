import React, { useEffect, useState } from 'react';
import { IconDownload, IconX, KindIcon } from '../icons';
import { Entry } from '../types';
import { formatBytes, kindOf } from '../util';
import { Spinner } from './primitives';

const TEXT_LIMIT = 2 * 1024 * 1024;

export default function Preview({ entry, url, downloadUrl, remote, onClose }: {
  entry: Entry;
  url: string;
  downloadUrl: string;
  remote: boolean;
  onClose: () => void;
}) {
  const kind = kindOf(entry);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  useEffect(() => {
    if (kind !== 'text' && kind !== 'code') return;
    if (entry.size && entry.size > TEXT_LIMIT) { setErr('This file is too large to preview. Download it instead.'); return; }
    const ctl = new AbortController();
    fetch(url, { credentials: 'include', signal: ctl.signal })
      .then(async (r) => (r.ok ? setText(await r.text()) : setErr(await r.text())))
      .catch((e) => e.name !== 'AbortError' && setErr(String(e)));
    return () => ctl.abort();
  }, [url, kind, entry.size]);

  let body: React.ReactNode;
  if (err) body = <p className="text-neutral-300">{err}</p>;
  else if (kind === 'image') body = <img src={url} alt={entry.name} className="max-h-full max-w-full object-contain shadow-2xl" />;
  else if (kind === 'video') body = <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg bg-black shadow-2xl" />;
  else if (kind === 'audio') body = (
    <div className="flex flex-col items-center gap-6">
      <KindIcon kind="audio" className="w-24 h-24 text-violet-300" />
      <audio src={url} controls autoPlay className="w-96 max-w-full" />
    </div>
  );
  else if (kind === 'pdf') body = <iframe src={url} title={entry.name} className="h-full w-full max-w-5xl rounded-lg bg-white shadow-2xl" />;
  else if (text === null) body = <Spinner className="w-8 h-8" />;
  else body = (
    <pre className="h-full w-full max-w-5xl overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-6 font-mono text-[13px] leading-relaxed text-neutral-800 shadow-2xl dark:bg-neutral-900 dark:text-neutral-100">{text}</pre>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/90" onMouseDown={onClose}>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close preview"><IconX /></button>
        <KindIcon kind={kind} className="w-6 h-6" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{entry.name}</div>
          <div className="text-xs text-neutral-400">{entry.size ? formatBytes(entry.size) : ''}{entry.size && remote ? ' · ' : ''}{remote ? 'streamed over Urbit' : ''}</div>
        </div>
        <a href={downloadUrl} download={entry.name} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-white/10">
          <IconDownload /> Download
        </a>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="flex h-full w-full items-center justify-center" onMouseDown={(e) => e.stopPropagation()}>{body}</div>
      </div>
    </div>
  );
}
