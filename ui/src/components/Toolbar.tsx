import React from 'react';
import { SortField, SortDir, ViewMode } from '../types';

interface Props {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onUpload: () => void;
  onNewFolder: () => void;
}

function SortBtn({
  field,
  label,
  current,
  dir,
  onSort,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`text-xs px-2 py-1 rounded border ${
        active
          ? 'border-[#B31B1B] text-[#B31B1B] bg-red-50'
          : 'border-gray-200 text-gray-500 hover:border-gray-400'
      }`}
    >
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </button>
  );
}

export default function Toolbar({
  viewMode,
  onViewMode,
  sortField,
  sortDir,
  onSort,
  onUpload,
  onNewFolder,
}: Props) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <button
        onClick={onUpload}
        className="px-3 py-1.5 bg-[#B31B1B] text-white rounded text-sm font-medium hover:bg-[#8a1515]"
      >
        Upload
      </button>
      <button
        onClick={onNewFolder}
        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:border-gray-500"
      >
        New Folder
      </button>

      <div className="flex-1" />

      <div className="flex gap-1 items-center">
        <span className="text-xs text-gray-400 mr-1">Sort:</span>
        <SortBtn field="name" label="Name" current={sortField} dir={sortDir} onSort={onSort} />
        <SortBtn field="size" label="Size" current={sortField} dir={sortDir} onSort={onSort} />
        <SortBtn field="modified" label="Date" current={sortField} dir={sortDir} onSort={onSort} />
      </div>

      <div className="flex border border-gray-200 rounded overflow-hidden">
        <button
          onClick={() => onViewMode('list')}
          title="List view"
          className={`px-2 py-1 text-sm ${
            viewMode === 'list' ? 'bg-[#B31B1B] text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          ☰
        </button>
        <button
          onClick={() => onViewMode('grid')}
          title="Grid view"
          className={`px-2 py-1 text-sm ${
            viewMode === 'grid' ? 'bg-[#B31B1B] text-white' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          ⊞
        </button>
      </div>
    </div>
  );
}
