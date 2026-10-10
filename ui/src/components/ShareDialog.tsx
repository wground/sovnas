import React, { useState } from 'react';
import { op, publicUrl } from '../api';
import { IconCopy, IconGlobe, IconLock, KindIcon } from '../icons';
import { DriveState, Role, Vol } from '../types';
import { kindOf, validShip } from '../util';
import { Btn, Modal, useToast } from './primitives';

export default function ShareDialog({ state, vol, path, dir, name, onClose }: {
  state: DriveState;
  vol: Vol;
  path: string;
  dir: boolean;
  name: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const share = state.shares.find((s) => s.vol === vol && s.path === path);
  const [who, setWho] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const ship = validShip(who);
  const install = state.publisher ? `|install ${state.publisher} %${state.desk}` : `|install ${state.our} %${state.desk}`;

  const add = async () => {
    if (!ship) return;
    if (ship === state.our) return toast("That's you", false);
    setBusy(true);
    const r = await op({ op: 'share', vol, path, dir, with: ship, role });
    setBusy(false);
    if (r.ok) { setWho(''); toast(`Shared with ${ship}`); } else toast(r.msg, false);
  };

  const setRoleFor = async (s: string, r: Role) => {
    const res = await op({ op: 'share', vol, path, dir, with: s, role: r });
    if (!res.ok) toast(res.msg, false);
  };

  const removeShip = async (s: string) => {
    const r = await op({ op: 'unshare', vol, path, with: s });
    if (r.ok) toast(`Stopped sharing with ${s}`); else toast(r.msg, false);
  };

  const toggleLink = async (on: boolean) => {
    const r = await op({ op: 'link', vol, path, dir, on });
    if (!r.ok) toast(r.msg, false);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast('Link copied'), () => toast(text));
  };

  return (
    <Modal
      wide
      title={<span className="flex items-center gap-2"><KindIcon kind={kindOf({ name, dir, mime: '' })} className="w-6 h-6" />Share “{name}”</span>}
      onClose={onClose}
      footer={<Btn kind="primary" onClick={onClose}>Done</Btn>}
    >
      <div className="flex gap-2">
        <input
          autoFocus
          value={who}
          onChange={(e) => setWho(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a ship, e.g. ~sampel-palnet"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-800"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-800">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <Btn kind="primary" disabled={!ship || busy} onClick={add}>Share</Btn>
      </div>
      {who && !ship && <p className="mt-1 text-xs text-neutral-500">Enter a valid @p like ~sampel-palnet</p>}

      <h3 className="mt-6 mb-2 text-sm font-medium">People with access</h3>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        <li className="flex items-center gap-3 py-2">
          <Sigil ship={state.our} />
          <span className="flex-1 font-mono text-sm">{state.our} <span className="font-sans text-neutral-500">(you)</span></span>
          <span className="text-sm text-neutral-500">Owner</span>
        </li>
        {(share?.who || []).map((w) => {
          const missing = state.peers[w.ship] === false;
          return (
            <li key={w.ship} className="py-2">
              <div className="flex items-center gap-3">
                <Sigil ship={w.ship} />
                <span className="flex-1 font-mono text-sm">{w.ship}</span>
                <select value={w.role} onChange={(e) => setRoleFor(w.ship, e.target.value as Role)}
                  className="rounded-md border-0 bg-transparent text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button onClick={() => removeShip(w.ship)} className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800">Remove</button>
              </div>
              {missing && (
                <p className="ml-11 mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  {w.ship} hasn’t installed SovNAS yet. They can run <code className="font-mono">{install}</code> in their dojo, then it will appear under “Shared with me”.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 mb-2 text-sm font-medium">General access</h3>
      <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
        <div className={`rounded-full p-2 ${share?.link ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'}`}>
          {share?.link ? <IconGlobe /> : <IconLock />}
        </div>
        <div className="flex-1">
          <select value={share?.link ? 'link' : 'restricted'} onChange={(e) => toggleLink(e.target.value === 'link')}
            className="-ml-1 rounded-md border-0 bg-transparent p-1 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700">
            <option value="restricted">Restricted</option>
            <option value="link">Anyone with the link</option>
          </select>
          <p className="text-xs text-neutral-500">
            {share?.link ? 'Anyone on the web with the link can view. No Urbit needed.' : 'Only ships you add can open this.'}
          </p>
        </div>
        {share?.link && (
          <Btn kind="plain" onClick={() => copy(publicUrl(share.link!))}><IconCopy className="w-4 h-4" />Copy link</Btn>
        )}
      </div>
      {share?.link && location.hostname.match(/^(localhost|127\.|192\.168\.|10\.|[^.]+\.local$)/) && (
        <p className="mt-2 text-xs text-neutral-500">This link uses the address you’re browsing from; open SovNAS through your public URL (e.g. StarTram) to get a link others can reach.</p>
      )}
    </Modal>
  );
}

export function Sigil({ ship }: { ship: string }) {
  // a small, deterministic avatar; real sigils would need a dependency
  let h = 0;
  for (const c of ship) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-white"
      style={{ background: `hsl(${hue} 45% 42%)` }}>{ship.replace('~', '').slice(0, 3)}</span>
  );
}
