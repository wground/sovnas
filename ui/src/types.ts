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

export interface DaemonConfig {
  ship: { name: string; pier: string };
  daemon: {
    storage_root: string;
    max_upload_bytes: number;
    log_level: string;
    download_server_port: number;
    install_dir: string;
  };
  network: { peers: any[] };
}

export type SortField = 'name' | 'size' | 'modified';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';

export interface UploadProgress {
  name: string;
  progress: number; // 0–100
  total: number;
}
