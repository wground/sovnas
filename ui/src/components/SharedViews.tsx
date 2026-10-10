import React, { useMemo, useState } from 'react';
import { fileUrl, op } from '../api';
import Preview from './Preview';
import { IconGlobe, IconPeople, IconRefresh, IconRestore, IconTrash, KindIcon } from '../icons';
import { DriveState, Loc, Offer, SearchHit, Share, Trashed } from '../types';
import { baseName, formatBytes, formatDate, kindOf, validShip } from '../util';
import { Btn, ConfirmDialog, Spinner, useToast } from './primitives';
import ShareDialog, { Sigil } from './ShareDialog';

function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pt-5 pb-3">
      <h1 className="flex-1 text-lg font-medium">{title}</h1>
      {children}
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md px-6 text-center text-neutral-500">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800">{icon}</div>
      <p className="text-base font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
      <div className="mt-1 text-sm">{body}</div>
    </div>
  );
}

// ------------------------------------------------------- shared with me ---

export function SharedWithMe({ state, onOpen }: { state: DriveState; onOpen: (root: Loc, label: string) => void }) {
  const toast = useToast();
  const [who, setWho] = useState('');
  const [preview, setPreview] = useState<Offer | null>(null);
  const byHost = useMemo(() => {
    const m = new Map<string, Offer[]>();
    for (const o of state.offers) m.set(o.host, [...(m.get(o.host) || []), o]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.offers]);

  const ask = async (ship: string) => {
    const r = await op({ op: 'hello', ship });
    toast(r.ok ? `Asked ${ship} what they share with you` : r.msg, r.ok);
  };

  const ship = validShip(who);
  return (
    <div className="flex-1 overflow-auto pb-24">
      <Header title="Shared with me">
        <div className="flex items-center gap-2">
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="~ship"
            onKeyDown={(e) => e.key === 'Enter' && ship && (ask(ship), setWho(''))}
            className="w-40 rounded-full border border-neutral-300 px-3 py-1.5 font-mono text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900" />
          <Btn kind="plain" disabled={!ship} onClick={() => { if (ship) { ask(ship); setWho(''); } }}><IconRefresh className="w-4 h-4" />Check ship</Btn>
        </div>
      </Header>
      {byHost.length === 0 ? (
        <Empty icon={<IconPeople />} title="Nothing shared with you yet"
          body={<>When another ship shares a file or folder with you, it shows up here. Already expecting something? Enter their @p above to check.</>} />
      ) : (
        <div className="space-y-6 px-6">
          {byHost.map(([host, offers]) => (
            <section key={host}>
              <div className="mb-2 flex items-center gap-2">
                <Sigil ship={host} />
                <h2 className="font-mono text-sm font-medium">{host}</h2>
                <button onClick={() => ask(host)} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Refresh"><IconRefresh className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {offers.map((o) => (
                  <button key={o.vol + o.path}
                    onClick={() => o.dir
                      ? onOpen({ ship: host, vol: o.vol, path: o.path }, o.name || (o.vol === 'host' ? 'Host disk' : 'Drive'))
                      : setPreview(o)}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
                    <KindIcon kind={kindOf({ name: o.name, dir: o.dir, mime: '' })} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{o.name || '(whole drive)'}</div>
                      <div className="text-xs text-neutral-500">{o.role === 'editor' ? 'Can edit' : 'Can view'} · {o.vol === 'host' ? 'host disk' : 'in-ship'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {preview && (() => {
        // a file shared on its own: we can't list its folder, so open it directly
        const loc = { ship: preview.host, vol: preview.vol, path: preview.path };
        const entry = { name: preview.name, dir: false, size: 0, mod: 0, mime: '' };
        return <Preview entry={entry} url={fileUrl(loc)} downloadUrl={fileUrl(loc, true)} remote onClose={() => setPreview(null)} />;
      })()}
    </div>
  );
}

// ------------------------------------------------------- shared by me ---

export function SharedByMe({ state, onOpen }: { state: DriveState; onOpen: (loc: Loc) => void }) {
  const [editing, setEditing] = useState<Share | null>(null);
  return (
    <div className="flex-1 overflow-auto pb-24">
      <Header title="Shared by me" />
      {state.shares.length === 0 ? (
        <Empty icon={<IconGlobe />} title="You haven’t shared anything"
          body="Right-click a file or folder and choose Share to give another ship access." />
      ) : (
        <table className="mx-4 w-[calc(100%-2rem)] table-fixed text-sm">
          <thead className="text-left text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2 pl-3 font-medium">Item</th>
              <th className="hidden py-2 font-medium md:table-cell">Shared with</th>
              <th className="w-32 py-2 font-medium">Link</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {state.shares.map((s) => (
              <tr key={s.vol + s.path} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-2 pl-3">
                  <button className="flex min-w-0 items-center gap-3 hover:underline"
                    onClick={() => onOpen({ ship: state.our, vol: s.vol, path: s.dir ? s.path : s.path.slice(0, s.path.lastIndexOf('/')) || '/' })}>
                    <KindIcon kind={kindOf({ name: baseName(s.path), dir: s.dir, mime: '' })} className="w-6 h-6 shrink-0" />
                    <span className="truncate">{baseName(s.path) || 'Everything'}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{s.vol === 'host' ? 'host disk' : 'in-ship'}</span>
                  </button>
                </td>
                <td className="hidden truncate py-2 font-mono text-xs text-neutral-600 md:table-cell dark:text-neutral-300">
                  {s.who.map((w) => `${w.ship}${w.role === 'editor' ? ' (edit)' : ''}`).join(', ') || '—'}
                </td>
                <td className="py-2 text-xs">{s.link ? <span className="text-emerald-700 dark:text-emerald-300">Anyone with link</span> : <span className="text-neutral-400">Off</span>}</td>
                <td className="py-2 pr-3 text-right"><Btn kind="ghost" onClick={() => setEditing(s)}>Manage</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <ShareDialog state={state} vol={editing.vol} path={editing.path} dir={editing.dir}
          name={baseName(editing.path) || 'Everything'} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- trash ---

export function TrashView({ state }: { state: DriveState }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<React.ReactNode>(null);
  const items = [...state.trash].sort((a, b) => b.when - a.when);
  const restore = async (t: Trashed) => {
    const r = await op({ op: 'restore', id: t.id });
    toast(r.ok ? `Restored “${r.msg}”` : r.msg, r.ok);
  };
  const purge = (t: Trashed) => setConfirm(
    <ConfirmDialog title="Delete forever?" body={`“${t.name}” will be permanently deleted. This can’t be undone.`}
      confirm="Delete forever" onClose={() => setConfirm(null)}
      onConfirm={async () => { setConfirm(null); await op({ op: 'purge', id: t.id }); }} />,
  );
  const empty = () => setConfirm(
    <ConfirmDialog title="Empty trash?" body="All items in the trash will be permanently deleted and their space freed. This can’t be undone."
      confirm="Empty trash" onClose={() => setConfirm(null)}
      onConfirm={async () => { setConfirm(null); const r = await op({ op: 'empty-trash' }); toast(r.ok ? 'Trash emptied' : r.msg, r.ok); }} />,
  );
  return (
    <div className="flex-1 overflow-auto pb-24">
      <Header title="Trash">{items.length > 0 && <Btn kind="plain" onClick={empty}>Empty trash</Btn>}</Header>
      <p className="px-6 pb-3 text-xs text-neutral-500">
        In-ship items stay here until you delete them forever. Host-disk deletions are kept in the <code>.sovnas-trash</code> folder on the host.
      </p>
      {items.length === 0 ? (
        <Empty icon={<IconTrash />} title="Trash is empty" body="Deleted in-ship files land here." />
      ) : (
        <ul className="px-4">
          {items.map((t) => (
            <li key={t.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <KindIcon kind={kindOf({ name: t.name, dir: t.dir, mime: '' })} className="w-6 h-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{t.name}</div>
                <div className="truncate text-xs text-neutral-500">from {t.path.slice(0, t.path.lastIndexOf('/')) || '/'} · deleted {formatDate(t.when)}</div>
              </div>
              <Btn kind="ghost" onClick={() => restore(t)}><IconRestore className="w-4 h-4" />Restore</Btn>
              <Btn kind="ghost" className="text-red-600" onClick={() => purge(t)}>Delete forever</Btn>
            </li>
          ))}
        </ul>
      )}
      {confirm}
    </div>
  );
}

// --------------------------------------------------------------- search ---

export function SearchResults({ q, hits, loading, onOpen }: {
  q: string;
  hits: SearchHit[] | null;
  loading: boolean;
  onOpen: (h: SearchHit) => void;
}) {
  return (
    <div className="flex-1 overflow-auto pb-24">
      <Header title={`Results for “${q}”`} />
      {loading || !hits ? (
        <div className="mt-16 flex justify-center"><Spinner className="w-7 h-7" /></div>
      ) : hits.length === 0 ? (
        <Empty icon={<KindIcon kind="file" />} title="No matches" body="Search looks at file and folder names." />
      ) : (
        <ul className="px-4">
          {hits.map((h) => (
            <li key={h.vol + h.path}>
              <button onClick={() => onOpen(h)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <KindIcon kind={kindOf(h)} className="w-6 h-6 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{h.name}</div>
                  <div className="truncate text-xs text-neutral-500">{h.vol === 'host' ? 'Host disk' : 'My Drive'}{h.path}</div>
                </div>
                <span className="text-xs text-neutral-500">{h.dir ? '' : formatBytes(h.size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
