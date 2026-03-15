import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../api';
import { formatBytes } from '../utils';

interface Props {
  currentPath: string;
  maxFileSize: number;
  onClose: () => void;
  onProgress: (name: string, pct: number, total: number) => void;
  onDone: (name: string) => void;
  onError: (msg: string) => void;
}

export default function UploadZone({
  currentPath,
  maxFileSize,
  onClose,
  onProgress,
  onDone,
  onError,
}: Props) {
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const SAFE_LIMIT = 2 * 1024 * 1024; // 2MB — Hoon can't handle large base64 in memory
        const limit = Math.min(maxFileSize, SAFE_LIMIT);
        if (file.size > limit) {
          onError(`${file.name} is too large (max ${formatBytes(limit)} to avoid ship crash)`);
          continue;
        }
        try {
          await uploadFile(file, currentPath, (pct) =>
            onProgress(file.name, pct, file.size),
          );
          onDone(file.name);
        } catch (e: any) {
          onError(`Failed to upload ${file.name}: ${e?.message ?? String(e)}`);
        }
      }
      onClose();
    },
    [currentPath, maxFileSize, onClose, onProgress, onDone, onError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      className="fixed inset-0 z-40 bg-black bg-opacity-40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors min-w-[320px] ${
          isDragActive
            ? 'border-[#B31B1B] bg-red-50'
            : 'border-gray-300 hover:border-[#B31B1B]'
        }`}
        onClick={(e) => e.stopPropagation()}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <div className="text-5xl mb-4">☁</div>
        <p className="text-lg font-medium text-gray-700">
          {isDragActive ? 'Drop files here...' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 mt-1">or click to select files</p>
        <p className="text-xs text-gray-400 mt-2">
          Max file size: {formatBytes(maxFileSize)}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
