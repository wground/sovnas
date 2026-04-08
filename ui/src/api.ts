import Urbit from '@urbit/http-api';
import { FileEntry, Config, DaemonConfig, Share, RemoteShare } from './types';

let api: Urbit | null = null;

export function getApi(): Urbit {
  if (!api) {
    api = new Urbit('', '', 'sovnas');
    api.ship = (window as any).ship ?? '';
    api.connect();
  }
  return api;
}

// ---------------------------------------------------------------------------
// Update event types
// ---------------------------------------------------------------------------

export type UpdateEvent =
  | { type: 'dir-list'; path: string; entries: FileEntry[] }
  | { type: 'file-data'; path: string; data: string; mime: string; size: number }
  | { type: 'op-result'; tag: string; success: boolean; msg: string }
  | { type: 'config-update'; config: Config }
  | { type: 'daemon-status'; connected: boolean }
  | { type: 'daemon-config'; config: DaemonConfig }
  | { type: 'shares-list'; shares: Share[] }
  | { type: 'remote-shares-list'; shares: RemoteShare[] }
  | { type: 'remote-dir-list'; host: string; path: string; entries: FileEntry[] }
  | { type: 'remote-file-data'; host: string; path: string; data: string; mime: string; size: number }
  | { type: 'remote-op-result'; host: string; tag: string; success: boolean; msg: string };

function parseUpdate(raw: any): UpdateEvent | null {
  if (raw['dir-list']) {
    const d = raw['dir-list'];
    return {
      type: 'dir-list',
      path: d.path,
      entries: (d.entries ?? []).map((e: any) => ({
        name: e.name,
        fullPath: e['full-path'] ?? '',
        size: e.size ?? 0,
        modified: e.modified ?? 0,
        isDir: e['is-dir'] ?? false,
        mime: e.mime ?? '',
      })),
    };
  }
  if (raw['file-data']) {
    const d = raw['file-data'];
    return { type: 'file-data', path: d.path, data: d.data, mime: d.mime, size: d.size };
  }
  if (raw['op-result']) {
    const d = raw['op-result'];
    return { type: 'op-result', tag: d.tag, success: d.success, msg: d.msg };
  }
  if (raw['config-update']) {
    const d = raw['config-update'];
    return {
      type: 'config-update',
      config: { root: d.root, maxFileSize: d['max-file-size'], connected: d.connected },
    };
  }
  if (raw['daemon-status']) {
    return { type: 'daemon-status', connected: raw['daemon-status'].connected };
  }
  if (raw['daemon-config']) {
    try {
      const cfg = JSON.parse(raw['daemon-config']);
      return { type: 'daemon-config', config: cfg };
    } catch {
      return null;
    }
  }
  if (raw['shares-list']) {
    const arr = raw['shares-list'];
    const shares: Share[] = (Array.isArray(arr) ? arr : []).map((s: any) => ({
      path: s.path ?? '',
      who: Array.isArray(s.who) ? s.who : [],
      perm: s.perm ?? 'read',
    }));
    return { type: 'shares-list', shares };
  }
  if (raw['remote-shares-list']) {
    const arr = raw['remote-shares-list'];
    const shares: RemoteShare[] = (Array.isArray(arr) ? arr : []).map((s: any) => ({
      host: s.host ?? '',
      path: s.path ?? '',
      perm: s.perm ?? 'read',
    }));
    return { type: 'remote-shares-list', shares };
  }
  if (raw['remote-dir-list']) {
    const d = raw['remote-dir-list'];
    return {
      type: 'remote-dir-list',
      host: d.host,
      path: d.path,
      entries: (d.entries ?? []).map((e: any) => ({
        name: e.name,
        fullPath: e['full-path'] ?? '',
        size: e.size ?? 0,
        modified: e.modified ?? 0,
        isDir: e['is-dir'] ?? false,
        mime: e.mime ?? '',
      })),
    };
  }
  if (raw['remote-file-data']) {
    const d = raw['remote-file-data'];
    return {
      type: 'remote-file-data',
      host: d.host,
      path: d.path,
      data: d.data,
      mime: d.mime,
      size: d.size,
    };
  }
  if (raw['remote-op-result']) {
    const d = raw['remote-op-result'];
    return {
      type: 'remote-op-result',
      host: d.host,
      tag: d.tag,
      success: d.success,
      msg: d.msg,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export function subscribe(
  onEvent: (e: UpdateEvent) => void,
  onQuit: () => void,
): () => void {
  const a = getApi();
  let subId: number | null = null;

  a.subscribe({
    app: 'sovnas',
    path: '/updates',
    event: (raw: any) => {
      const evt = parseUpdate(raw);
      if (evt) onEvent(evt);
    },
    err: (err: any) => console.error('sovnas sub error:', err),
    quit: onQuit,
  }).then((id) => {
    subId = id;
  });

  return () => {
    if (subId !== null) a.unsubscribe(subId);
  };
}

// ---------------------------------------------------------------------------
// Local Actions
// ---------------------------------------------------------------------------

export async function listDir(path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'list-dir': { path } },
  });
}

export async function downloadFile(path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { download: { path } },
  });
}

export async function deleteFile(path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { delete: { path } },
  });
}

export async function renameFile(src: string, dst: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { rename: { src, dst } },
  });
}

export async function mkdir(path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { mkdir: { path } },
  });
}

export async function readDaemonConfig(): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'read-daemon-config': null },
  });
}

export async function writeDaemonConfig(cfg: DaemonConfig): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'write-daemon-config': JSON.stringify(cfg) },
  });
}

// ---------------------------------------------------------------------------
// Share Management
// ---------------------------------------------------------------------------

export async function shareFolder(path: string, who: string, perm: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'share-folder': { path, who, perm } },
  });
}

export async function unshareFolder(path: string, who: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'unshare-folder': { path, who } },
  });
}

export async function listShares(): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'list-shares': null },
  });
}

export async function listRemoteShares(): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'list-remote-shares': null },
  });
}

// ---------------------------------------------------------------------------
// Remote Operations
// ---------------------------------------------------------------------------

export async function remoteLs(host: string, path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'remote-ls': { host, path } },
  });
}

export async function remoteDownload(host: string, path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'remote-download': { host, path } },
  });
}

export async function remoteUpload(host: string, name: string, dir: string, data: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'remote-upload': { host, name, dir, data } },
  });
}

export async function remoteMkdir(host: string, path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'remote-mkdir': { host, path } },
  });
}

export async function remoteRm(host: string, path: string): Promise<void> {
  await getApi().poke({
    app: 'sovnas',
    mark: 'sovnas-action',
    json: { 'remote-rm': { host, path } },
  });
}

// ---------------------------------------------------------------------------
// File upload (with chunking for large files)
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

export async function uploadFile(
  file: File,
  dirPath: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const a = getApi();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Helper: Uint8Array -> base64 without stack overflow for large buffers
  function toBase64(arr: Uint8Array): string {
    let binary = '';
    const len = arr.length;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
  }

  const total = Math.ceil(bytes.length / CHUNK_SIZE) || 1;

  if (total === 1) {
    await a.poke({
      app: 'sovnas',
      mark: 'sovnas-action',
      json: { upload: { name: file.name, dir: dirPath, data: toBase64(bytes) } },
    });
    onProgress(100);
    return;
  }

  for (let i = 0; i < total; i++) {
    const chunk = bytes.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await a.poke({
      app: 'sovnas',
      mark: 'sovnas-action',
      json: {
        'upload-chunk': {
          name: file.name,
          dir: dirPath,
          idx: i,
          total,
          data: toBase64(chunk),
        },
      },
    });
    onProgress(Math.round(((i + 1) / total) * 100));
  }
}

// ---------------------------------------------------------------------------
// Remote file upload (single-shot, no chunking for now)
// ---------------------------------------------------------------------------

export async function remoteUploadFile(
  file: File,
  host: string,
  dirPath: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const data = btoa(binary);

  await remoteUpload(host, file.name, dirPath, data);
  onProgress(100);
}
