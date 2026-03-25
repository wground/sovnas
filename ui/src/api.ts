import Urbit from '@urbit/http-api';
import { FileEntry, Config, DaemonConfig } from './types';

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
  | { type: 'daemon-config'; config: DaemonConfig };

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
// Actions
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
