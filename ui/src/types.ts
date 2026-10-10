export type Vol = 'ship' | 'host';
export type Role = 'viewer' | 'editor';
export type Perm = 'owner' | Role;

/** A place in some ship's drive. `ship` is always ~-prefixed. */
export interface Loc {
  ship: string;
  vol: Vol;
  path: string; // '/a/b'
}

export interface Entry {
  name: string;
  dir: boolean;
  size: number;
  mod: number; // unix ms
  mime: string;
}

export interface Share {
  vol: Vol;
  path: string;
  dir: boolean;
  who: { ship: string; role: Role }[];
  link: string | null;
}

export interface Offer {
  host: string;
  vol: Vol;
  path: string;
  role: Role;
  dir: boolean;
  name: string;
}

export interface Trashed {
  id: string;
  vol: Vol;
  path: string;
  name: string;
  dir: boolean;
  when: number;
}

export interface HostInfo {
  live: boolean;
  root: string;
  free: number;
  total: number;
  ver: string;
  port: number;
  token: string;
}

export interface DriveState {
  our: string;
  version: string;
  desk: string;
  publisher: string | null;
  used: number;
  blobs: number;
  settings: { quota: number; maxFile: number; compress: boolean; default: Vol; big: number };
  host: HostInfo;
  shares: Share[];
  offers: Offer[];
  peers: Record<string, boolean>;
  trash: Trashed[];
  jobs: Job[];
}

/** A background move between My Drive and the host disk. */
export interface Job {
  id: string;
  from: { vol: Vol; path: string };
  to: { vol: Vol; path: string };
  name: string;
  dir: boolean;
  done: number;
  total: number;
  step: string; // 'done' | 'fail' | in progress
  msg: string;
  when: number;
}

export interface Listing {
  ok: boolean;
  role?: Perm;
  entries?: Entry[];
  msg?: string;
}

export interface SearchHit extends Entry {
  vol: Vol;
  path: string;
}

export type View =
  | { kind: 'drive'; loc: Loc }
  | { kind: 'shared' }
  | { kind: 'sharing' }
  | { kind: 'trash' }
  | { kind: 'search'; vol: Vol; q: string };
