import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkDirect, directFileUrl, fileUrl, list, moveAcross, op, our } from '../api';
import {
  IconChevron, IconDisk, IconDownload, IconFolderPlus, IconGrid, IconList, IconMore, IconMove, IconOpen,
  IconPencil, IconRefresh, IconShare, IconShip, IconTrash, IconUpload, KindIcon,
} from '../icons';
import { DriveState, Entry, Loc, Perm } from '../types';
import { filesFromDrop, uploader } from '../uploads';
import { baseName, canPreview, formatBytes, formatDate, joinPath, kindOf, parentPath } from '../util';
import MoveDialog from './MoveDialog';
import Preview from './Preview';
import { ConfirmDialog, ContextMenu, MenuItem, PromptDialog, Spinner, useToast } from './primitives';
import ShareDialog from './ShareDialog';

type Sort = 'name' | 'mod' | 'size';

interface Props {
  loc: Loc;
  root: Loc;            // can't navigate above this (a share's root for remote)
  rootLabel: string;
  state: DriveState;
  refreshKey: number;
  onNavigate: (loc: Loc) => void;
}

export default function Browser({ loc, root, rootLabel, state, refreshKey, onNavigate }: Props) {
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [role, setRole] = useState<Perm>('viewer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>(() => (localStorage.getItem('sovnas:view') as any) || 'list');
  const [sort, setSort] = useState<{ by: Sort; asc: boolean }>({ by: 'name', asc: true });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null);
  const [dialog, setDialog] = useState<React.ReactNode>(null);
  const [dragOver, setDragOver] = useState(false);
  const [direct, setDirect] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const local = loc.ship === our;
  const canEdit = role === 'owner' || role === 'editor';

  useEffect(() => { localStorage.setItem('sovnas:view', view); }, [view]);
  useEffect(() => { checkDirect(state).then(setDirect); }, [state.host.live, state.host.port, state.host.token]);

  const load = useCallback(async (quiet = false) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    try {
      const r = await list(loc);
      if (id !== reqId.current) return;
      if (r.ok) {
        setEntries(r.entries || []);
        setRole(r.role || 'viewer');
        setError(null);
      } else {
        setEntries(null);
        setError(r.msg || 'Could not open this folder');
      }
    } catch (e: any) {
      if (id === reqId.current) setError(e?.message || 'network error');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [loc.ship, loc.vol, loc.path]);

  useEffect(() => {
    setEntries(null);
    setSelected(new Set());
    load();
  }, [load]);
  useEffect(() => { if (refreshKey) load(true); }, [refreshKey]);
  // remote folders don't push changes; poll gently while open
  useEffect(() => {
    if (local) return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [local, load]);

  const sorted = useMemo(() => {
    const es = [...(entries || [])];
    es.sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      let c = 0;
      if (sort.by === 'name') c = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      else if (sort.by === 'size') c = a.size - b.size;
      else c = a.mod - b.mod;
      return sort.asc ? c : -c;
    });
    return es;
  }, [entries, sort]);

  const at = (e: Entry): Loc => ({ ...loc, path: joinPath(loc.path, e.name) });

  const urlFor = (e: Entry, dl = false) =>
    local && loc.vol === 'host' && direct ? directFileUrl(state, at(e).path, dl) : fileUrl(at(e), dl);

  const open = (e: Entry) => {
    if (e.dir) return onNavigate(at(e));
    if (canPreview(e)) {
      setDialog(<Preview entry={e} url={urlFor(e)} downloadUrl={urlFor(e, true)} remote={!local}
        onClose={() => setDialog(null)} />);
    } else download(e);
  };

  const download = (e: Entry) => {
    const a = document.createElement('a');
    a.href = urlFor(e, true);
    a.download = e.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const run = async (body: Record<string, unknown>, ok?: string) => {
    const r = await op({ ship: loc.ship, vol: loc.vol, ...body });
    if (r.ok) { if (ok) toast(ok); } else toast(r.msg || 'Something went wrong', false);
    load(true);
    return r.ok;
  };

  const newFolder = () => setDialog(
    <PromptDialog title="New folder" initial="Untitled folder" confirm="Create" onClose={() => setDialog(null)}
      onSubmit={async (name) => { setDialog(null); await run({ op: 'mkdir', path: joinPath(loc.path, name) }); }} />,
  );

  const rename = (e: Entry) => setDialog(
    <PromptDialog title="Rename" initial={e.name} confirm="Rename" selectStem={!e.dir} onClose={() => setDialog(null)}
      onSubmit={async (name) => {
        setDialog(null);
        if (name !== e.name) await run({ op: 'mv', path: at(e).path, to: joinPath(loc.path, name) });
      }} />,
  );

  const remove = (es: Entry[]) => setDialog(
    <ConfirmDialog
      title={es.length === 1 ? `Delete “${es[0].name}”?` : `Delete ${es.length} items?`}
      body={local
        ? (loc.vol === 'ship' ? 'Items go to the trash, where you can restore them.' : 'Items move to the host disk trash folder (.sovnas-trash).')
        : `Items move to ~${loc.ship.slice(1)}'s trash.`}
      confirm="Delete"
      onClose={() => setDialog(null)}
      onConfirm={async () => {
        setDialog(null);
        let n = 0;
        for (const e of es) if ((await op({ op: 'rm', ship: loc.ship, vol: loc.vol, path: at(e).path })).ok) n++;
        toast(n === es.length ? `Deleted ${n} item${n === 1 ? '' : 's'}` : `Deleted ${n} of ${es.length}`, n === es.length);
        setSelected(new Set());
        load(true);
      }}
    />,
  );

  const move = (es: Entry[]) => setDialog(
    <MoveDialog
      start={loc}
      root={root}
      names={es.map((e) => e.name)}
      onClose={() => setDialog(null)}
      onMove={async (dest) => {
        setDialog(null);
        let n = 0;
        for (const e of es) {
          if ((await op({ op: 'mv', ship: loc.ship, vol: loc.vol, path: at(e).path, to: joinPath(dest, e.name) })).ok) n++;
        }
        toast(n === es.length ? `Moved ${n} item${n === 1 ? '' : 's'}` : `Moved ${n} of ${es.length}`, n === es.length);
        setSelected(new Set());
        load(true);
      }}
    />,
  );

  // in-ship <-> host disk; the ship does the copying in the background
  const otherVol = loc.vol === 'ship' ? 'Host disk' : 'My Drive';
  const canCross = local && state.host.live;
  const cross = async (es: Entry[]) => {
    let started = 0;
    for (const e of es) {
      const r = await moveAcross(loc.vol, at(e).path);
      if (r.ok) started++; else toast(r.msg || `Couldn't move ${e.name}`, false);
    }
    if (started) toast(`Moving ${started === 1 ? `“${es[0].name}”` : `${started} items`} to ${otherVol}…`);
    setSelected(new Set());
  };

  const share = (e: Entry) => setDialog(
    <ShareDialog state={state} vol={loc.vol} path={at(e).path} dir={e.dir} name={e.name} onClose={() => setDialog(null)} />,
  );

  const menuItems = (e: Entry): MenuItem[] => {
    const many = selected.size > 1 && selected.has(e.name);
    const targets = many ? sorted.filter((x) => selected.has(x.name)) : [e];
    return [
      { label: e.dir ? 'Open' : canPreview(e) ? 'Preview' : 'Open', icon: <IconOpen className="w-4 h-4" />, onClick: () => open(e), hidden: many },
      { label: 'Download', icon: <IconDownload className="w-4 h-4" />, onClick: () => targets.filter((t) => !t.dir).forEach(download), hidden: targets.every((t) => t.dir) },
      { label: 'Share', icon: <IconShare className="w-4 h-4" />, onClick: () => share(e), hidden: !local || many },
      { label: 'Rename', icon: <IconPencil className="w-4 h-4" />, onClick: () => rename(e), hidden: !canEdit || many },
      { label: 'Move to…', icon: <IconMove className="w-4 h-4" />, onClick: () => move(targets), hidden: !canEdit },
      {
        label: `Move to ${otherVol}`,
        icon: loc.vol === 'ship' ? <IconDisk className="w-4 h-4" /> : <IconShip className="w-4 h-4" />,
        onClick: () => cross(targets),
        hidden: !canCross,
      },
      { label: many ? `Delete ${targets.length} items` : 'Delete', icon: <IconTrash className="w-4 h-4" />, onClick: () => remove(targets), danger: true, hidden: !canEdit },
    ];
  };

  const clickRow = (e: Entry, ev: React.MouseEvent) => {
    if (ev.metaKey || ev.ctrlKey) {
      const s = new Set(selected);
      s.has(e.name) ? s.delete(e.name) : s.add(e.name);
      setSelected(s);
      setAnchor(e.name);
    } else if (ev.shiftKey && anchor) {
      const names = sorted.map((x) => x.name);
      const [a, b] = [names.indexOf(anchor), names.indexOf(e.name)].sort((x, y) => x - y);
      setSelected(new Set(names.slice(a, b + 1)));
    } else {
      setSelected(new Set([e.name]));
      setAnchor(e.name);
    }
  };

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (dialog || (ev.target as HTMLElement).closest('input, textarea')) return;
      const sel = sorted.filter((x) => selected.has(x.name));
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel.length && canEdit) { ev.preventDefault(); remove(sel); }
      else if (ev.key === 'Enter' && sel.length === 1) open(sel[0]);
      else if (ev.key === 'Escape') setSelected(new Set());
      else if ((ev.metaKey || ev.ctrlKey) && ev.key === 'a') { ev.preventDefault(); setSelected(new Set(sorted.map((x) => x.name))); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // ------------------------------------------------------------- uploads --

  const uploadFiles = (fs: FileList | File[]) => {
    const arr = Array.from(fs);
    if (!arr.length) return;
    uploader.add(arr.map((file) => ({ file, dest: loc })));
  };

  const uploadDir = async (fs: FileList) => {
    const arr = Array.from(fs);
    const entries = arr.map((f) => ({ path: (f as any).webkitRelativePath || f.name, file: f }));
    const dirs = new Set<string>();
    for (const { path } of entries) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    }
    try { await uploader.addTree(loc, entries, [...dirs]); } catch (e: any) { toast(e.message, false); }
    load(true);
  };

  const onDrop = async (ev: React.DragEvent) => {
    ev.preventDefault();
    setDragOver(false);
    const moving = ev.dataTransfer.getData('application/x-sovnas');
    if (moving) return;
    if (!canEdit) return toast('You can only view this folder', false);
    const { files, dirs } = await filesFromDrop(ev.dataTransfer);
    if (dirs.length) {
      try { await uploader.addTree(loc, files, dirs); } catch (e: any) { toast(e.message, false); }
      load(true);
    } else uploadFiles(files.map((f) => f.file));
  };

  /** Move dragged rows into a folder (a row or a breadcrumb). */
  const dropOnPath = async (ev: React.DragEvent, dest: string, label: string) => {
    const moving = ev.dataTransfer.getData('application/x-sovnas');
    if (!moving || !canEdit) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (dest === loc.path) return;
    const names: string[] = JSON.parse(moving).filter((n: string) => joinPath(loc.path, n) !== dest);
    let n = 0;
    for (const name of names) {
      if ((await op({ op: 'mv', ship: loc.ship, vol: loc.vol, path: joinPath(loc.path, name), to: joinPath(dest, name) })).ok) n++;
    }
    if (n) toast(`Moved ${n} item${n === 1 ? '' : 's'} to ${label}`);
    load(true);
  };

  const dropOnFolder = (ev: React.DragEvent, target: Entry) => {
    if (target.dir) dropOnPath(ev, at(target).path, target.name);
  };

  const dragStart = (ev: React.DragEvent, e: Entry) => {
    const names = selected.has(e.name) ? [...selected] : [e.name];
    ev.dataTransfer.setData('application/x-sovnas', JSON.stringify(names));
    ev.dataTransfer.effectAllowed = 'move';
  };

  // --------------------------------------------------------- breadcrumbs --

  const crumbs = useMemo(() => {
    const out: { label: string; loc: Loc }[] = [{ label: rootLabel, loc: root }];
    const rel = loc.path.slice(root.path === '/' ? 0 : root.path.length).split('/').filter(Boolean);
    let p = root.path;
    for (const seg of rel) {
      p = joinPath(p, seg);
      out.push({ label: seg, loc: { ...loc, path: p } });
    }
    return out;
  }, [loc, root, rootLabel]);

  const sortBtn = (by: Sort, label: string, cls = '') => (
    <button onClick={() => setSort((s) => ({ by, asc: s.by === by ? !s.asc : true }))}
      className={`flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white ${cls}`}>
      {label}{sort.by === by && <span className="text-xs">{sort.asc ? '↑' : '↓'}</span>}
    </button>
  );

  const thumb = (e: Entry) =>
    kindOf(e) === 'image' && local && e.size < 8 * 1024 * 1024 && !/svg/.test(e.mime);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(ev) => { if (canEdit && ev.dataTransfer.types.includes('Files')) { ev.preventDefault(); setDragOver(true); } }}
      onDragLeave={(ev) => { if (ev.currentTarget === ev.target) setDragOver(false); }}
      onDrop={onDrop}
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setSelected(new Set()); }}
    >
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4 pb-2">
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-lg" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.loc.path}>
              {i > 0 && <IconChevron className="w-4 h-4 shrink-0 text-neutral-400" />}
              <button
                onClick={() => onNavigate(c.loc)}
                onDragOver={(ev) => ev.dataTransfer.types.includes('application/x-sovnas') && ev.preventDefault()}
                onDrop={(ev) => dropOnPath(ev, c.loc.path, c.label)}
                className={`truncate rounded-lg px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${i === crumbs.length - 1 ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-500'}`}
              >{c.label}</button>
            </React.Fragment>
          ))}
          {!local && (
            <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs ${role === 'editor' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'}`}>
              {role === 'editor' ? 'Can edit' : 'View only'}
            </span>
          )}
        </nav>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <button onClick={newFolder} className="toolbar-btn" title="New folder"><IconFolderPlus /><span className="hidden sm:inline">New folder</span></button>
              <button onClick={() => fileInput.current?.click()} className="toolbar-btn" title="Upload files"><IconUpload /><span className="hidden sm:inline">Upload</span></button>
              <button onClick={() => dirInput.current?.click()} className="toolbar-btn hidden md:flex" title="Upload a folder"><IconUpload /><span>Folder</span></button>
            </>
          )}
          <button onClick={() => load()} className="toolbar-btn" title="Refresh"><IconRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setView(view === 'list' ? 'grid' : 'list')} className="toolbar-btn" title={view === 'list' ? 'Grid view' : 'List view'}>
            {view === 'list' ? <IconGrid /> : <IconList />}
          </button>
        </div>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { uploadFiles(e.target.files || []); e.target.value = ''; }} />
        <input ref={dirInput} type="file" hidden {...({ webkitdirectory: '', directory: '' } as any)}
          onChange={(e) => { if (e.target.files) uploadDir(e.target.files); e.target.value = ''; }} />
      </div>

      {selected.size > 1 && (
        <div className="mx-6 mb-2 flex items-center gap-2 rounded-full bg-brand/10 px-4 py-1.5 text-sm text-brand-dark dark:text-red-200">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          {sorted.some((x) => selected.has(x.name) && !x.dir) && (
            <button className="rounded-full p-1.5 hover:bg-brand/10" title="Download" onClick={() => sorted.filter((x) => selected.has(x.name) && !x.dir).forEach(download)}><IconDownload className="w-4 h-4" /></button>
          )}
          {canEdit && <button className="rounded-full p-1.5 hover:bg-brand/10" title="Move" onClick={() => move(sorted.filter((x) => selected.has(x.name)))}><IconMove className="w-4 h-4" /></button>}
          {canCross && (
            <button className="rounded-full p-1.5 hover:bg-brand/10" title={`Move to ${otherVol}`} onClick={() => cross(sorted.filter((x) => selected.has(x.name)))}>
              {loc.vol === 'ship' ? <IconDisk className="w-4 h-4" /> : <IconShip className="w-4 h-4" />}
            </button>
          )}
          {canEdit && <button className="rounded-full p-1.5 hover:bg-brand/10" title="Delete" onClick={() => remove(sorted.filter((x) => selected.has(x.name)))}><IconTrash className="w-4 h-4" /></button>}
          <button className="rounded-full px-2 hover:bg-brand/10" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* body */}
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-24" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setSelected(new Set()); }}>
        {error ? (
          <div className="mx-auto mt-20 max-w-md text-center text-neutral-500">
            <p className="text-base font-medium text-neutral-700 dark:text-neutral-200">Couldn’t open this folder</p>
            <p className="mt-1 text-sm">{error}</p>
            <button onClick={() => load()} className="mt-4 text-sm text-brand hover:underline">Try again</button>
          </div>
        ) : entries === null ? (
          <div className="mt-20 flex flex-col items-center gap-3 text-sm text-neutral-500">
            <Spinner className="w-7 h-7" />
            {!local && <span>Asking ~{loc.ship.slice(1)}…</span>}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mx-auto mt-20 max-w-sm text-center text-neutral-500">
            <KindIcon kind="folder" className="mx-auto w-16 h-16 opacity-60" />
            <p className="mt-3 text-base font-medium text-neutral-700 dark:text-neutral-200">This folder is empty</p>
            {canEdit && <p className="mt-1 text-sm">Drop files here, or use Upload.</p>}
          </div>
        ) : view === 'list' ? (
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-neutral-500 dark:bg-neutral-950">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-2 pl-3 font-medium">{sortBtn('name', 'Name')}</th>
                <th className="hidden w-40 py-2 font-medium md:table-cell">{sortBtn('mod', 'Modified')}</th>
                <th className="hidden w-28 py-2 pr-3 text-right font-medium sm:table-cell">{sortBtn('size', 'Size', 'ml-auto')}</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const sel = selected.has(e.name);
                return (
                  <tr key={e.name}
                    draggable={canEdit}
                    onDragStart={(ev) => dragStart(ev, e)}
                    onDragOver={(ev) => e.dir && ev.dataTransfer.types.includes('application/x-sovnas') && ev.preventDefault()}
                    onDrop={(ev) => dropOnFolder(ev, e)}
                    onClick={(ev) => clickRow(e, ev)}
                    onDoubleClick={() => open(e)}
                    onContextMenu={(ev) => { ev.preventDefault(); if (!selected.has(e.name)) setSelected(new Set([e.name])); setMenu({ x: ev.clientX, y: ev.clientY, entry: e }); }}
                    className={`group cursor-default border-b border-neutral-100 select-none dark:border-neutral-900 ${sel ? 'bg-brand/10 dark:bg-brand/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'}`}
                  >
                    <td className="py-2 pl-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <KindIcon kind={kindOf(e)} className="w-6 h-6 shrink-0" />
                        <span className="truncate" title={e.name}>{e.name}</span>
                      </div>
                    </td>
                    <td className="hidden py-2 text-neutral-500 md:table-cell">{formatDate(e.mod)}</td>
                    <td className="hidden py-2 pr-3 text-right text-neutral-500 tabular-nums sm:table-cell">{e.dir ? '—' : formatBytes(e.size)}</td>
                    <td className="py-1 pr-2 text-right">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setSelected(new Set([e.name])); const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left - 160, y: r.bottom, entry: e }); }}
                        className="rounded-full p-1.5 text-neutral-500 opacity-0 hover:bg-neutral-200 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-neutral-700"
                        aria-label={`Actions for ${e.name}`}
                      ><IconMore className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-2 pt-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sorted.map((e) => {
              const sel = selected.has(e.name);
              return (
                <div key={e.name}
                  draggable={canEdit}
                  onDragStart={(ev) => dragStart(ev, e)}
                  onDragOver={(ev) => e.dir && ev.dataTransfer.types.includes('application/x-sovnas') && ev.preventDefault()}
                  onDrop={(ev) => dropOnFolder(ev, e)}
                  onClick={(ev) => clickRow(e, ev)}
                  onDoubleClick={() => open(e)}
                  onContextMenu={(ev) => { ev.preventDefault(); if (!selected.has(e.name)) setSelected(new Set([e.name])); setMenu({ x: ev.clientX, y: ev.clientY, entry: e }); }}
                  className={`flex cursor-default flex-col overflow-hidden rounded-xl border select-none ${sel ? 'border-brand bg-brand/10' : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800'}`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
                    {thumb(e)
                      ? <img src={urlFor(e)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <KindIcon kind={kindOf(e)} className="w-14 h-14" />}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <KindIcon kind={kindOf(e)} className="w-4 h-4 shrink-0" />
                    <span className="truncate text-sm" title={e.name}>{e.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand/5">
          <div className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-lg">
            Drop to upload to {loc.path === root.path ? rootLabel : baseName(loc.path)}
          </div>
        </div>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.entry)} onClose={() => setMenu(null)} />}
      {dialog}
    </div>
  );
}

export function parentLoc(loc: Loc): Loc {
  return { ...loc, path: parentPath(loc.path) };
}
