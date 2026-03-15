export interface FileEntry {
  name: string;
  fullPath: string;
  size: number;
  modified: number; // unix timestamp seconds
  isDir: boolean;
  mime: string;
}

export interface Config {
  root: string;
  maxFileSize: number;
  connected: boolean;
}

export type SortField = 'name' | 'size' | 'modified';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';

export interface UploadProgress {
  name: string;
  progress: number; // 0–100
  total: number;
}
