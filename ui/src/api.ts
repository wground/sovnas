import Urbit from '@urbit/http-api';
import { DriveState, Job, Listing, Loc, SearchHit, Vol } from './types';

const BASE = '/apps/sovnas/api';

export const our: string = '~' + ((window as any).ship ?? 'zod');

function q(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  }
  return u.toString();
}

/** Query params addressing a location; omits `s` for our own ship. */
export function locParams(loc: Loc) {
  return { s: loc.ship === our ? undefined : loc.ship, v: loc.vol, p: loc.path };
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, msg: text || res.statusText } as unknown as T;
  }
}

export async function getState(): Promise<DriveState> {
  const r = await fetch(`${BASE}/state`, { credentials: 'include' });
  if (r.status === 403) {
    location.href = '/~/login?redirect=' + encodeURIComponent('/apps/sovnas/');
  }
  return json<DriveState>(r);
}

export async function list(loc: Loc): Promise<Listing> {
  const r = await fetch(`${BASE}/ls?${q(locParams(loc))}`, { credentials: 'include' });
  return json<Listing>(r);
}

export async function search(vol: Vol, query: string): Promise<{ ok: boolean; results?: SearchHit[]; msg?: string }> {
  const r = await fetch(`${BASE}/search?${q({ v: vol, q: query })}`, { credentials: 'include' });
  return json(r);
}

export interface OpResult {
  ok: boolean;
  msg: string;
}

export async function op(body: Record<string, unknown>): Promise<OpResult> {
  const r = await fetch(`${BASE}/op`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-sovnas': '1' },
    body: JSON.stringify(body),
  });
  return json<OpResult>(r);
}

/** Every file, local or remote, is served by our own ship at this URL. */
export function fileUrl(loc: Loc, download = false): string {
  return `${BASE}/file?${q({ ...locParams(loc), dl: download ? 1 : undefined })}`;
}

export function publicUrl(token: string): string {
  return `${location.origin}/apps/sovnas/pub/${token}`;
}

export function daemonScriptUrl(): string {
  return `${location.origin}/apps/sovnas/daemon/sovnasd.py`;
}

// ---------------------------------------------------------------- direct ---
// On a LAN, host-disk files can move straight between the browser and the
// sovnasd daemon, skipping the ship (and its event log).  Only possible from
// a plain-http page, since browsers block http requests from https pages.

let directOk: Promise<boolean> | null = null;
let directKey = '';

export function directBase(state: DriveState): string {
  return `http://${location.hostname}:${state.host.port}/${state.our}`;
}

export function checkDirect(state: DriveState): Promise<boolean> {
  const key = `${state.host.live}:${state.host.port}:${state.host.token}`;
  if (directOk && key === directKey) return directOk;
  directKey = key;
  if (!state.host.live || !state.host.port || location.protocol !== 'http:') {
    directOk = Promise.resolve(false);
    return directOk;
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 1500);
  directOk = fetch(`${directBase(state)}/ping?t=${encodeURIComponent(state.host.token)}`, { signal: ctl.signal })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => clearTimeout(t));
  return directOk;
}

export function directFileUrl(state: DriveState, path: string, download = false): string {
  return `${directBase(state)}/f?${q({ p: path, t: state.host.token, dl: download ? 1 : undefined })}`;
}

// ----------------------------------------------------------------- live ---

let api: Urbit | null = null;

export type Update =
  | { type: 'state'; state: DriveState }
  | { type: 'changed'; ship: string; vol: Vol; path: string }
  | { type: 'job'; job: Job };

/** Make a folder path exist (each missing level), on any volume. */
export async function mkdirs(loc: Loc): Promise<void> {
  let p = '';
  for (const seg of loc.path.split('/').filter(Boolean)) {
    p += '/' + seg;
    const r = await op({ op: 'mkdir', ship: loc.ship, vol: loc.vol, path: p });
    if (!r.ok && !/exists/.test(r.msg)) throw new Error(`couldn't create ${p}: ${r.msg}`);
  }
}

/** Start moving something to the other volume; resolves to the job id. */
export async function moveAcross(vol: Vol, path: string): Promise<OpResult> {
  return op({ op: 'xfer', vol, path });
}

export function subscribe(onUpdate: (u: Update) => void, onReconnect: () => void): () => void {
  if (!api) {
    api = new Urbit('', '', 'sovnas');
    api.ship = (window as any).ship ?? '';
  }
  let id: number | null = null;
  let closed = false;
  const start = () => {
    api!
      .subscribe({
        app: 'sovnas',
        path: '/updates',
        event: (e: any) => onUpdate(e as Update),
        err: () => {},
        quit: () => {
          if (!closed) {
            onReconnect();
            setTimeout(start, 1000);
          }
        },
      })
      .then((i) => (id = i))
      .catch(() => setTimeout(start, 3000));
  };
  start();
  return () => {
    closed = true;
    if (id !== null) api!.unsubscribe(id);
  };
}
