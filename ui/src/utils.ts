import { FileEntry } from './types';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(unixSec: number): string {
  if (!unixSec) return '—';
  const d = new Date(unixSec * 1000);
  return (
    d.toLocaleDateString() +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

export function fileIcon(entry: FileEntry): string {
  if (entry.isDir) return '📁';
  const mime = entry.mime || '';
  const name = entry.name.toLowerCase();
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return '📄';
  if (['.zip', '.tar', '.gz', '.7z', '.bz2', '.xz'].some((x) => name.endsWith(x))) return '🗜';
  if (['.txt', '.md', '.rst'].some((x) => name.endsWith(x))) return '📝';
  if (['.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.hoon', '.c', '.cpp', '.java'].some((x) => name.endsWith(x))) return '💻';
  return '📃';
}
