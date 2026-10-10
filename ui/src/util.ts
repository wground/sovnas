import { Entry, Loc } from './types';

export function formatBytes(n: number): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

export function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function joinPath(dir: string, name: string): string {
  return (dir === '/' ? '' : dir.replace(/\/$/, '')) + '/' + name;
}

export function parentPath(p: string): string {
  const i = p.replace(/\/$/, '').lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

export function baseName(p: string): string {
  return p.replace(/\/$/, '').split('/').pop() || '';
}

export function sameLoc(a: Loc, b: Loc): boolean {
  return a.ship === b.ship && a.vol === b.vol && a.path === b.path;
}

export function isInside(inner: string, outer: string): boolean {
  if (outer === '/') return true;
  return inner === outer || inner.startsWith(outer + '/');
}

export type Kind = 'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'archive' | 'doc' | 'sheet' | 'slides' | 'file';

const CODE = ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'c', 'h', 'cpp', 'java', 'hoon', 'sh', 'rb', 'swift', 'kt', 'css', 'html', 'json', 'toml', 'yaml', 'yml', 'xml', 'sql'];
const TEXT = ['txt', 'md', 'csv', 'tsv', 'log', 'rst', 'ini', 'conf', 'env'];
const ARCHIVE = ['zip', 'gz', 'tgz', 'tar', '7z', 'rar', 'xz', 'bz2', 'zst'];

export function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function kindOf(e: Pick<Entry, 'name' | 'dir' | 'mime'>): Kind {
  if (e.dir) return 'folder';
  const m = e.mime || '';
  const x = ext(e.name);
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || x === 'pdf') return 'pdf';
  if (ARCHIVE.includes(x)) return 'archive';
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(x)) return 'doc';
  if (['xls', 'xlsx', 'ods', 'numbers'].includes(x)) return 'sheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(x)) return 'slides';
  if (CODE.includes(x)) return 'code';
  if (TEXT.includes(x) || m.startsWith('text/')) return 'text';
  return 'file';
}

export function canPreview(e: Entry): boolean {
  const k = kindOf(e);
  return ['image', 'video', 'audio', 'pdf', 'text', 'code'].includes(k);
}

/** Types that are already compressed; gzipping them wastes time. */
const INCOMPRESSIBLE = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'mp3', 'mp4', 'm4a', 'm4v', 'mov',
  'webm', 'mkv', 'ogg', 'opus', 'flac', 'aac', 'zip', 'gz', 'tgz', '7z', 'rar', 'xz', 'bz2', 'zst',
  'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub', 'jar', 'apk', 'dmg', 'iso', 'woff', 'woff2',
]);

export function worthCompressing(f: File): boolean {
  if (typeof (window as any).CompressionStream === 'undefined') return false;
  if (f.size < 1024 || f.size > 256 * 1024 * 1024) return false;
  return !INCOMPRESSIBLE.has(ext(f.name));
}

export async function gzip(f: Blob): Promise<Blob> {
  const cs = new (window as any).CompressionStream('gzip');
  return await new Response(f.stream().pipeThrough(cs)).blob();
}

export function guessMime(name: string): string {
  const x = ext(name);
  const m: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html',
    zip: 'application/zip',
  };
  return m[x] || '';
}

export function validShip(s: string): string | null {
  const t = s.trim().replace(/^~?/, '~').toLowerCase();
  return /^~[a-z]{3}(?:[a-z]{3})?(?:-[a-z]{6})*(?:--[a-z]{6}(?:-[a-z]{6})*)?$/.test(t) ? t : null;
}

export function randomId(): string {
  // 52 random bits as a decimal string (the api parses plain decimal)
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return String((a[0] & 0xfffff) * 2 ** 32 + a[1]);
}
