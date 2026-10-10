import React from 'react';
import { Kind } from './util';

type P = { className?: string };
const S = (d: React.ReactNode, vb = '0 0 24 24') =>
  ({ className = 'w-5 h-5' }: P) => (
    <svg viewBox={vb} className={className} fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );

export const IconPlus = S(<path d="M12 5v14M5 12h14" />);
export const IconUpload = S(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>);
export const IconDownload = S(<><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>);
export const IconFolderPlus = S(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" /></>);
export const IconShare = S(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /><path d="M17 8v6M14 11h6" /></>);
export const IconTrash = S(<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>);
export const IconPencil = S(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>);
export const IconMove = S(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 13h6M13 10.5l2.5 2.5-2.5 2.5" /></>);
export const IconMore = S(<><circle cx="12" cy="5" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="19" r="1.3" fill="currentColor" /></>);
export const IconGrid = S(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
export const IconList = S(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />);
export const IconSearch = S(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const IconSettings = S(<><path d="M10.3 3.6a1.8 1.8 0 0 1 3.4 0l.3.9a1.8 1.8 0 0 0 2.4 1l.8-.4a1.8 1.8 0 0 1 2.4 2.4l-.4.8a1.8 1.8 0 0 0 1 2.4l.9.3a1.8 1.8 0 0 1 0 3.4l-.9.3a1.8 1.8 0 0 0-1 2.4l.4.8a1.8 1.8 0 0 1-2.4 2.4l-.8-.4a1.8 1.8 0 0 0-2.4 1l-.3.9a1.8 1.8 0 0 1-3.4 0l-.3-.9a1.8 1.8 0 0 0-2.4-1l-.8.4a1.8 1.8 0 0 1-2.4-2.4l.4-.8a1.8 1.8 0 0 0-1-2.4l-.9-.3a1.8 1.8 0 0 1 0-3.4l.9-.3a1.8 1.8 0 0 0 1-2.4l-.4-.8a1.8 1.8 0 0 1 2.4-2.4l.8.4a1.8 1.8 0 0 0 2.4-1z" /><circle cx="12" cy="12" r="3" /></>);
export const IconShip = S(<><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /><path d="M9 12l2 2 4-4" /></>);
export const IconDisk = S(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 14h18M7 16.5h.01M10 16.5h.01" /></>);
export const IconPeople = S(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9.5" r="2.4" /><path d="M3.5 19c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5M15.5 14.6c2.3 0 4.3 1.3 5 4.4" /></>);
export const IconOutbox = S(<><path d="M4 13l2-8h12l2 8" /><path d="M4 13v6h16v-6h-5a3 3 0 0 1-6 0z" /><path d="M12 3v7M9.5 5.5L12 3l2.5 2.5" /></>);
export const IconLink = S(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconX = S(<path d="M6 6l12 12M18 6L6 18" />);
export const IconChevron = S(<path d="M9 6l6 6-6 6" />);
export const IconChevronDown = S(<path d="M6 9l6 6 6-6" />);
export const IconRefresh = S(<><path d="M20 11a8 8 0 0 0-14.5-4.6L4 8" /><path d="M4 4v4h4M4 13a8 8 0 0 0 14.5 4.6L20 16" /><path d="M20 20v-4h-4" /></>);
export const IconRestore = S(<><path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.5" /><path d="M4 4v4.5h4.5" /></>);
export const IconCheck = S(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconInfo = S(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const IconOpen = S(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const IconGlobe = S(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>);
export const IconLock = S(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const IconCopy = S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>);

const KIND_COLOR: Record<Kind, string> = {
  folder: 'text-amber-500',
  image: 'text-rose-500',
  video: 'text-fuchsia-500',
  audio: 'text-violet-500',
  pdf: 'text-red-600',
  text: 'text-slate-500',
  code: 'text-sky-600',
  archive: 'text-yellow-700',
  doc: 'text-blue-600',
  sheet: 'text-emerald-600',
  slides: 'text-orange-500',
  file: 'text-slate-400',
};

const KIND_LABEL: Partial<Record<Kind, string>> = {
  pdf: 'PDF', archive: 'ZIP', doc: 'DOC', sheet: 'XLS', slides: 'PPT', code: '</>', text: 'TXT',
};

export function KindIcon({ kind, className = 'w-6 h-6' }: { kind: Kind; className?: string }) {
  const color = KIND_COLOR[kind];
  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} ${color}`} aria-hidden="true">
        <path fill="currentColor" d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      </svg>
    );
  }
  if (kind === 'image') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.7" /><path d="M20 16l-5-5-8.5 8.5" />
      </svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'audio') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" />
      </svg>
    );
  }
  const label = KIND_LABEL[kind];
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${color}`} aria-hidden="true">
      <path fill="currentColor" opacity="0.14" d="M6 2.5h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-16A2 2 0 0 1 6 2.5z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M6 2.5h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-16A2 2 0 0 1 6 2.5zM14 2.5v5h5" />
      {label && (
        <text x="12" y="17.5" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="currentColor"
          fontFamily="ui-sans-serif, system-ui">{label}</text>
      )}
    </svg>
  );
}
