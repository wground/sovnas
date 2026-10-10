import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getState, our, search, subscribe } from './api';
import {
  IconDisk, IconFolderPlus, IconOutbox, IconPeople, IconPlus, IconSearch, IconSettings, IconShip,
  IconTrash, IconUpload, IconX,
} from './icons';
import { DriveState, Loc, SearchHit, View, Vol } from './types';
import { uploader } from './uploads';
import { formatBytes, isInside, joinPath, parentPath } from './util';
import Browser from './components/Browser';
import { ContextMenu, Modal, Spinner, ToastProvider, useToast } from './components/primitives';
import SettingsDialog, { HostSetup } from './components/SettingsDialog';
import { SearchResults, SharedByMe, SharedWithMe, TrashView } from './components/SharedViews';
import UploadPanel from './components/UploadPanel';

// ---------------------------------------------------------------- routes ---
//   #/ship/a/b           in-ship drive        #/shared   shared with me
//   #/host/a/b           host disk            #/sharing  shared by me
//   #/~nec/ship/a/b      a remote share       #/trash
//   #/search/ship/query

function enc(path: string) {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function toHash(v: View): string {
  switch (v.kind) {
    case 'drive': {
      const p = enc(v.loc.path);
      const head = v.loc.ship === our ? v.loc.vol : `${v.loc.ship}/${v.loc.vol}`;
      return `#/${head}${p ? '/' + p : ''}`;
    }
    case 'search': return `#/search/${v.vol}/${encodeURIComponent(v.q)}`;
    default: return `#/${v.kind}`;
  }
}

function fromHash(h: string): View {
  const segs = h.replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  if (segs[0] === 'shared') return { kind: 'shared' };
  if (segs[0] === 'sharing') return { kind: 'sharing' };
  if (segs[0] === 'trash') return { kind: 'trash' };
  if (segs[0] === 'search') return { kind: 'search', vol: (segs[1] as Vol) || 'ship', q: segs.slice(2).join('/') };
  let ship = our;
  if (segs[0]?.startsWith('~')) ship = segs.shift()!;
  const vol: Vol = segs[0] === 'host' ? 'host' : 'ship';
  if (segs[0] === 'ship' || segs[0] === 'host') segs.shift();
  return { kind: 'drive', loc: { ship, vol, path: '/' + segs.join('/') } };
}

// remote shares remember their root so breadcrumbs stop there
const REMOTE_ROOTS = 'sovnas:roots';
function rememberRoot(root: Loc, label: string) {
  try {
    const m = JSON.parse(localStorage.getItem(REMOTE_ROOTS) || '{}');
    m[`${root.ship}/${root.vol}${root.path}`] = label;
    localStorage.setItem(REMOTE_ROOTS, JSON.stringify(m));
  } catch {}
}

function App() {
  const toast = useToast();
  const [state, setState] = useState<DriveState | null>(null);
  const [view, setView] = useState<View>(() => fromHash(location.hash));
  const [refresh, setRefresh] = useState(0);
  const [settings, setSettings] = useState(false);
  const [hostHelp, setHostHelp] = useState(false);
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const stateRef = useRef<DriveState | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  stateRef.current = state;

  const go = useCallback((v: View) => {
    const h = toHash(v);
    if (location.hash !== h) location.hash = h;
    else setView(v);
    setNavOpen(false);
  }, []);

  useEffect(() => {
    const on = () => setView(fromHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    getState().then((st) => {
      setState(st);
      // open on the preferred volume when nothing else was asked for
      const h = location.hash.replace(/^#\/?/, '');
      if (!h && st.settings.default === 'host' && st.host.live) {
        go({ kind: 'drive', loc: { ship: our, vol: 'host', path: '/' } });
      }
    }).catch(() => toast('Could not reach your ship', false));
    uploader.getState = () => stateRef.current;
    uploader.onRerouted = (u) => {
      toast(`“${u.name}” is large, so it's going to Host disk${u.dest.path === '/' ? '' : ' › ' + u.dest.path.split('/').pop()}`);
    };
    uploader.onFinished = (dest) => {
      const v = viewRef.current;
      if (v.kind === 'drive' && v.loc.ship === dest.ship && v.loc.vol === dest.vol && v.loc.path === dest.path) {
        setRefresh((n) => n + 1);
      }
    };
    return subscribe(
      (u) => {
        if (u.type === 'state') setState(u.state);
        else if (u.type === 'job') {
          setState((st) => st && {
            ...st,
            jobs: st.jobs.some((j) => j.id === u.job.id)
              ? st.jobs.map((j) => (j.id === u.job.id ? u.job : j))
              : [u.job, ...st.jobs],
          });
        }
        else if (u.type === 'changed') {
          const v = viewRef.current;
          if (v.kind === 'drive' && v.loc.ship === u.ship && v.loc.vol === u.vol && v.loc.path === u.path) {
            setRefresh((n) => n + 1);
          }
        }
      },
      () => getState().then(setState).catch(() => {}),
    );
  }, []);

  useEffect(() => {
    if (view.kind !== 'search') return;
    setQuery(view.q);
    setSearching(true);
    setHits(null);
    search(view.vol, view.q).then((r) => setHits(r.results || [])).finally(() => setSearching(false));
  }, [view.kind === 'search' ? `${view.vol}/${view.q}` : '']);

  const roots = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(REMOTE_ROOTS) || '{}') as Record<string, string>; } catch { return {}; }
  }, [view]);

  if (!state) {
    return <div className="flex h-screen items-center justify-center"><Spinner className="w-8 h-8" /></div>;
  }

  const drive = view.kind === 'drive' ? view.loc : null;
  const currentVol: Vol = drive && drive.ship === our ? drive.vol : 'ship';

  // where breadcrumbs start, and what they're called
  let root: Loc = { ship: our, vol: currentVol, path: '/' };
  let rootLabel = currentVol === 'host' ? 'Host disk' : 'My Drive';
  if (drive && drive.ship !== our) {
    const offers = state.offers.filter((o) => o.host === drive.ship && o.vol === drive.vol && isInside(drive.path, o.path));
    const best = offers.sort((a, b) => b.path.length - a.path.length)[0];
    const known = Object.entries(roots)
      .map(([k, label]) => ({ k, label }))
      .filter(({ k }) => k.startsWith(`${drive.ship}/${drive.vol}`) && isInside(drive.path, k.slice(`${drive.ship}/${drive.vol}`.length) || '/'))
      .sort((a, b) => b.k.length - a.k.length)[0];
    const rootPath = best ? (best.dir ? best.path : parentPath(best.path)) : known ? known.k.slice(`${drive.ship}/${drive.vol}`.length) || '/' : drive.path;
    root = { ship: drive.ship, vol: drive.vol, path: rootPath };
    rootLabel = `${drive.ship} · ${best?.dir === false ? 'Shared' : best?.name || known?.label || 'Shared'}`;
  }

  const openRemote = (r: Loc, label: string) => {
    const offer = state.offers.find((o) => o.host === r.ship && o.vol === r.vol && o.path === r.path);
    const folder = offer && !offer.dir ? { ...r, path: parentPath(r.path) } : r;
    rememberRoot(folder, label);
    go({ kind: 'drive', loc: folder });
  };

  // reuse the browser's own toolbar controls for New
  const clickToolbar = (kind: 'folder' | 'files') => {
    const label = kind === 'folder' ? 'New folder' : 'Upload files';
    const btn = document.querySelector<HTMLButtonElement>(`button[title="${label}"]`);
    if (btn) btn.click(); else toast("You can't add files here", false);
  };

  const newItem = (kind: 'folder' | 'files') => {
    if (drive) return clickToolbar(kind);
    // not inside a folder: open the preferred volume first
    const vol: Vol = state.settings.default === 'host' && state.host.live ? 'host' : 'ship';
    go({ kind: 'drive', loc: { ship: our, vol, path: '/' } });
    setTimeout(() => clickToolbar(kind), 400);
  };

  const quotaPct = Math.min(100, (100 * state.used) / Math.max(1, state.settings.quota));
  const hostPct = state.host.total ? Math.min(100, (100 * (state.host.total - state.host.free)) / state.host.total) : 0;
  const nav = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-full py-2 pl-4 pr-3 text-sm ${active ? 'bg-brand/10 font-medium text-brand-dark dark:bg-brand/25 dark:text-red-100' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'}`;
  const newOffers = state.offers.length;

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* top bar */}
      <header className="flex items-center gap-3 px-3 py-2 sm:px-4">
        <button className="rounded-full p-2 hover:bg-neutral-100 lg:hidden dark:hover:bg-neutral-800" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <a href={state.settings.default === 'host' && state.host.live ? '#/host' : '#/ship'} className="flex items-center gap-2 pr-2 lg:w-56">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm"><IconShip className="w-5 h-5" /></span>
          <span className="hidden text-xl font-medium tracking-tight sm:inline">SovNAS</span>
        </a>
        <form className="relative max-w-2xl flex-1" onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) go({ kind: 'search', vol: currentVol, q: query.trim() });
        }}>
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 w-5 h-5 -translate-y-1/2 text-neutral-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${currentVol === 'host' ? 'host disk' : 'My Drive'}`}
            className="w-full rounded-full bg-neutral-100 py-2.5 pl-12 pr-10 text-sm outline-none focus:bg-white focus:shadow-md focus:ring-1 focus:ring-neutral-200 dark:bg-neutral-900 dark:focus:bg-neutral-900 dark:focus:ring-neutral-700" />
          {query && (
            <button type="button" onClick={() => { setQuery(''); if (view.kind === 'search') history.back(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800" aria-label="Clear search">
              <IconX className="w-4 h-4" />
            </button>
          )}
        </form>
        <div className="flex-1" />
        <button onClick={() => setSettings(true)} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" aria-label="Settings">
          <IconSettings />
        </button>
        <span className="hidden rounded-full bg-neutral-100 px-3 py-1.5 font-mono text-xs text-neutral-700 sm:inline dark:bg-neutral-900 dark:text-neutral-300">{state.our}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className={`${navOpen ? 'fixed inset-y-0 left-0 z-40 w-64 bg-white pt-16 shadow-xl dark:bg-neutral-950' : 'hidden'} flex-col gap-1 px-3 pb-4 lg:static lg:flex lg:w-60 lg:pt-1 lg:shadow-none`}>
          <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setNewMenu({ x: r.left, y: r.bottom + 4 }); }}
            className="mb-3 flex w-fit items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-medium shadow-md ring-1 ring-black/5 hover:bg-neutral-50 hover:shadow-lg dark:bg-neutral-900 dark:ring-white/10 dark:hover:bg-neutral-800">
            <IconPlus /> New
          </button>
          <button className={nav(drive?.ship === our && drive.vol === 'ship')} onClick={() => go({ kind: 'drive', loc: { ship: our, vol: 'ship', path: '/' } })}>
            <IconShip /> My Drive
          </button>
          <button className={nav(drive?.ship === our && drive.vol === 'host')}
            onClick={() => state.host.live ? go({ kind: 'drive', loc: { ship: our, vol: 'host', path: '/' } }) : setHostHelp(true)}>
            <IconDisk /> <span className="flex-1 text-left">Host disk</span>
            <span className={`h-2 w-2 rounded-full ${state.host.live ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} title={state.host.live ? 'Connected' : 'Not connected'} />
          </button>
          <button className={nav(view.kind === 'shared' || (!!drive && drive.ship !== our))} onClick={() => go({ kind: 'shared' })}>
            <IconPeople /> <span className="flex-1 text-left">Shared with me</span>
            {newOffers > 0 && <span className="rounded-full bg-neutral-200 px-2 text-xs dark:bg-neutral-800">{newOffers}</span>}
          </button>
          <button className={nav(view.kind === 'sharing')} onClick={() => go({ kind: 'sharing' })}><IconOutbox /> Shared by me</button>
          <button className={nav(view.kind === 'trash')} onClick={() => go({ kind: 'trash' })}>
            <IconTrash /> <span className="flex-1 text-left">Trash</span>
            {state.trash.length > 0 && <span className="text-xs text-neutral-500">{state.trash.length}</span>}
          </button>

          <div className="mt-4 space-y-4 border-t border-neutral-100 px-4 pt-4 text-xs text-neutral-500 dark:border-neutral-900">
            <div>
              <div className="mb-1 flex justify-between"><span>In-ship</span><span>{formatBytes(state.used)} of {formatBytes(state.settings.quota)}</span></div>
              <div className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full rounded-full ${quotaPct > 90 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${quotaPct}%` }} />
              </div>
            </div>
            {state.host.live && (
              <div>
                <div className="mb-1 flex justify-between"><span>Host disk</span><span>{formatBytes(state.host.free)} free</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-neutral-500" style={{ width: `${hostPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </aside>
        {navOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}

        {/* main */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl bg-white lg:mr-3 lg:mb-3 lg:rounded-2xl lg:ring-1 lg:ring-neutral-200 dark:bg-neutral-950 dark:lg:ring-neutral-800">
          {view.kind === 'drive' && view.loc.vol === 'host' && view.loc.ship === our && !state.host.live ? (
            <div className="mx-auto mt-12 max-w-xl px-6">
              <h1 className="mb-3 text-lg font-medium">Connect your host disk</h1>
              <HostSetup state={state} />
            </div>
          ) : view.kind === 'drive' ? (
            <Browser key={`${view.loc.ship}/${view.loc.vol}`} loc={view.loc} root={root} rootLabel={rootLabel}
              state={state} refreshKey={refresh} onNavigate={(loc) => go({ kind: 'drive', loc })} />
          ) : view.kind === 'shared' ? (
            <SharedWithMe state={state} onOpen={openRemote} />
          ) : view.kind === 'sharing' ? (
            <SharedByMe state={state} onOpen={(loc) => go({ kind: 'drive', loc })} />
          ) : view.kind === 'trash' ? (
            <TrashView state={state} />
          ) : (
            <SearchResults q={view.q} hits={hits} loading={searching}
              onOpen={(h) => go({ kind: 'drive', loc: { ship: our, vol: h.vol, path: h.dir ? h.path : parentPath(h.path) } })} />
          )}
        </main>
      </div>

      {newMenu && (
        <ContextMenu x={newMenu.x} y={newMenu.y} onClose={() => setNewMenu(null)} items={[
          { label: 'New folder', icon: <IconFolderPlus className="w-4 h-4" />, onClick: () => newItem('folder') },
          { label: 'Upload files', icon: <IconUpload className="w-4 h-4" />, onClick: () => newItem('files') },
        ]} />
      )}
      {settings && <SettingsDialog state={state} onClose={() => setSettings(false)} />}
      {hostHelp && (
        <Modal wide title="Connect your host disk" onClose={() => setHostHelp(false)}><HostSetup state={state} /></Modal>
      )}
      <UploadPanel jobs={state.jobs} />
    </div>
  );
}

export default function Root() {
  return <ToastProvider><App /></ToastProvider>;
}

export { joinPath };
