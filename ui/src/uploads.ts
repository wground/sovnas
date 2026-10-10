import { checkDirect, directBase, locParams, mkdirs, op, our } from './api';
import { DriveState, Loc } from './types';
import { formatBytes, guessMime, gzip, joinPath, randomId, worthCompressing } from './util';

const CHUNK = 4 * 1024 * 1024;
const CONCURRENCY = 2;

export type UploadStatus = 'queued' | 'compressing' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface Upload {
  key: string;
  name: string;
  dest: Loc; // folder
  size: number;
  sent: number;
  status: UploadStatus;
  msg?: string;
  rate: number; // bytes/s
  note?: string; // e.g. "gzip 31%"
  rerouted?: boolean; // sent to the host disk because it's big
  file: File;
  abort?: AbortController;
}

type Listener = (ups: Upload[]) => void;

class Uploader {
  items: Upload[] = [];
  listeners = new Set<Listener>();
  getState: () => DriveState | null = () => null;
  onFinished: (dest: Loc) => void = () => {};
  onRerouted: (u: Upload) => void = () => {};
  running = 0;

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.items);
    return () => this.listeners.delete(l);
  }

  emit() {
    const snap = this.items.map((u) => ({ ...u }));
    this.listeners.forEach((l) => l(snap));
  }

  add(files: { file: File; dest: Loc }[]) {
    for (const { file, dest } of files) {
      this.items.push({
        key: randomId(), name: file.name, dest, size: file.size, sent: 0,
        status: 'queued', rate: 0, file,
      });
    }
    this.emit();
    this.pump();
  }

  /** Upload a dropped folder tree: create folders first, then files. */
  async addTree(dest: Loc, entries: { path: string; file: File }[], dirs: string[]) {
    const sorted = [...new Set(dirs)].sort((a, b) => a.split('/').length - b.split('/').length);
    for (const d of sorted) {
      const r = await op({ op: 'mkdir', ship: dest.ship, vol: dest.vol, path: joinPath(dest.path, d) });
      if (!r.ok && !/exists/.test(r.msg)) throw new Error(`could not create ${d}: ${r.msg}`);
    }
    this.add(entries.map(({ path, file }) => {
      const i = path.lastIndexOf('/');
      const sub = i < 0 ? '' : path.slice(0, i);
      return { file, dest: { ...dest, path: sub ? joinPath(dest.path, sub) : dest.path } };
    }));
  }

  cancel(key: string) {
    const u = this.items.find((x) => x.key === key);
    if (!u) return;
    if (u.status === 'queued' || u.status === 'uploading' || u.status === 'compressing') {
      u.abort?.abort();
      u.status = 'cancelled';
      if (u.dest.ship === our) op({ op: 'cancel-upload', id: u.key }).catch(() => {});
      this.emit();
    }
  }

  clearFinished() {
    this.items = this.items.filter((u) => !['done', 'error', 'cancelled'].includes(u.status));
    this.emit();
  }

  pump() {
    while (this.running < CONCURRENCY) {
      const next = this.items.find((u) => u.status === 'queued');
      if (!next) return;
      // claim it now; run() awaits before it sets its own status
      next.status = 'uploading';
      this.running++;
      this.run(next).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  async run(u: Upload) {
    u.abort = new AbortController();
    const state = this.getState();
    try {
      let body: Blob = u.file;
      let enc: string | undefined;
      const local = u.dest.ship === our;
      // big files bound for My Drive go to the same folder on the host disk
      if (local && u.dest.vol === 'ship' && state) {
        const { maxFile, big } = state.settings;
        const limit = Math.min(maxFile, big || Infinity);
        if (u.file.size > limit) {
          if (state.host.live) {
            const to: Loc = { ...u.dest, vol: 'host' };
            await mkdirs(to);
            u.dest = to;
            u.rerouted = true;
            u.note = 'sent to Host disk';
            this.emit();
            this.onRerouted(u);
          } else if (u.file.size > maxFile) {
            throw new Error(`Too big for My Drive (limit ${formatBytes(maxFile)}). Connect a host disk to store large files.`);
          }
        }
      }
      if (local && u.dest.vol === 'host' && state && (await checkDirect(state))) {
        await this.direct(u, state);
      } else {
        // in-ship storage: gzip in the browser when it pays off
        const compress = state?.settings.compress ?? true;
        if (u.dest.vol === 'ship' && compress && worthCompressing(u.file)) {
          u.status = 'compressing';
          this.emit();
          const z = await gzip(u.file);
          if (z.size < u.file.size * 0.9) {
            body = z;
            enc = 'gz';
            u.note = `compressed to ${Math.round((100 * z.size) / u.file.size)}%`;
          }
        }
        await this.chunked(u, body, enc);
      }
      if ((u.status as UploadStatus) !== 'cancelled') {
        u.status = 'done';
        this.onFinished(u.dest);
      }
    } catch (e: any) {
      if ((u.status as UploadStatus) !== 'cancelled') {
        u.status = 'error';
        u.msg = e?.message || String(e);
      }
    }
    this.emit();
  }

  async chunked(u: Upload, body: Blob, enc?: string) {
    u.status = 'uploading';
    u.size = body.size;
    this.emit();
    const start = performance.now();
    const mime = u.file.type || guessMime(u.name);
    let off = 0;
    do {
      const piece = body.slice(off, off + CHUNK);
      const params = new URLSearchParams();
      const lp = locParams(u.dest);
      if (lp.s) params.set('s', lp.s);
      params.set('v', lp.v);
      params.set('p', lp.p);
      params.set('name', u.name);
      params.set('id', u.key);
      params.set('off', String(off));
      params.set('size', String(body.size));
      params.set('real', String(u.file.size));
      if (mime) params.set('mime', mime);
      if (enc) params.set('enc', enc);
      const r = await fetch(`/apps/sovnas/api/upload?${params}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-sovnas': '1', 'content-type': 'application/octet-stream' },
        body: piece,
        signal: u.abort!.signal,
      });
      let res: any;
      try { res = await r.json(); } catch { res = { ok: false, msg: r.statusText } }
      if (!res.ok) throw new Error(res.msg || `upload failed (${r.status})`);
      off += piece.size;
      u.sent = off;
      u.rate = off / ((performance.now() - start) / 1000);
      if (res.msg && off >= body.size) u.name = res.msg;
      this.emit();
    } while (off < body.size);
  }

  direct(u: Upload, state: DriveState): Promise<void> {
    u.status = 'uploading';
    u.note = u.rerouted ? 'sent to Host disk · direct' : 'direct';
    this.emit();
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      const start = performance.now();
      const p = new URLSearchParams({ p: u.dest.path, name: u.name });
      x.open('PUT', `${directBase(state)}/f?${p}`);
      x.setRequestHeader('x-sovnas-token', state.host.token);
      x.upload.onprogress = (e) => {
        u.sent = e.loaded;
        u.rate = e.loaded / ((performance.now() - start) / 1000);
        this.emit();
      };
      x.onload = () => {
        try {
          const res = JSON.parse(x.responseText);
          if (x.status === 200 && res.ok) {
            u.sent = u.size;
            u.name = res.msg || u.name;
            resolve();
          } else reject(new Error(res.msg || x.statusText));
        } catch {
          reject(new Error(x.responseText || x.statusText));
        }
      };
      x.onerror = () => reject(new Error('network error'));
      u.abort!.signal.addEventListener('abort', () => x.abort());
      x.send(u.file);
    });
  }
}

export const uploader = new Uploader();

/** Walk a drop event into files with relative paths (folders included). */
export async function filesFromDrop(dt: DataTransfer): Promise<{ files: { path: string; file: File }[]; dirs: string[] }> {
  const files: { path: string; file: File }[] = [];
  const dirs: string[] = [];
  const items = Array.from(dt.items || []);
  const entries = items.map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) {
    return { files: Array.from(dt.files).map((f) => ({ path: f.name, file: f })), dirs };
  }
  const walk = async (entry: any, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file: File = await new Promise((res, rej) => entry.file(res, rej));
      files.push({ path: prefix + file.name, file });
    } else if (entry.isDirectory) {
      dirs.push(prefix + entry.name);
      const reader = entry.createReader();
      let batch: any[];
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, '');
  return { files, dirs };
}
