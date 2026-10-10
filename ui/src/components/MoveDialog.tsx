import React, { useEffect, useState } from 'react';
import { list } from '../api';
import { IconChevron, KindIcon } from '../icons';
import { Entry, Loc } from '../types';
import { baseName, isInside, joinPath, parentPath } from '../util';
import { Btn, Modal, Spinner } from './primitives';

export default function MoveDialog({ start, root, names, onMove, onClose }: {
  start: Loc;
  root: Loc;
  names: string[];
  onMove: (destPath: string) => void;
  onClose: () => void;
}) {
  const [at, setAt] = useState(start.path);
  const [dirs, setDirs] = useState<Entry[] | null>(null);
  const moving = names.map((n) => joinPath(start.path, n));

  useEffect(() => {
    setDirs(null);
    list({ ...start, path: at }).then((r) => setDirs((r.entries || []).filter((e) => e.dir)));
  }, [at]);

  const blocked = (p: string) => moving.some((m) => isInside(p, m));
  const atRoot = at === root.path;
  const label = names.length === 1 ? `“${names[0]}”` : `${names.length} items`;

  return (
    <Modal
      title={`Move ${label}`}
      onClose={onClose}
      footer={<>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind="primary" disabled={at === start.path || blocked(at)} onClick={() => onMove(at)}>Move here</Btn>
      </>}
    >
      <div className="mb-2 flex items-center gap-2 text-sm">
        {!atRoot && (
          <button onClick={() => setAt(parentPath(at))} className="rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">← Back</button>
        )}
        <span className="truncate font-medium">{atRoot ? 'Top level' : baseName(at)}</span>
      </div>
      <div className="h-72 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
        {dirs === null ? (
          <div className="flex h-full items-center justify-center"><Spinner /></div>
        ) : dirs.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No folders here.</p>
        ) : (
          dirs.map((d) => {
            const p = joinPath(at, d.name);
            const no = blocked(p);
            return (
              <button key={d.name} disabled={no} onClick={() => setAt(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-40 dark:hover:bg-neutral-800">
                <KindIcon kind="folder" className="w-5 h-5" />
                <span className="flex-1 truncate">{d.name}</span>
                <IconChevron className="w-4 h-4 text-neutral-400" />
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
