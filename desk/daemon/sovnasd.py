#!/usr/bin/env python3
"""
sovnasd -- host-disk daemon for the %sovnas Urbit drive.

%sovnas works without this daemon: files can live inside the ship itself.
Run sovnasd on the machine that hosts your ship to add a "Host disk"
volume backed by a real directory, so large files don't have to live in
the ship's memory.  Files on the host disk are still addressable over the
Urbit network and can be shared with other ships like any other file.

Zero configuration:
  * Piers are found automatically by looking for the %sovnas lick socket
    (<pier>/.urb/dev/sovnas/sovnas) in the usual places, including the
    pier this file lives in when the desk is |mount'ed, NativePlanet's
    docker volumes, and the current directory.  New ships are picked up
    as they appear.  One daemon serves every ship on the machine.
  * The ship tells the daemon who it is when it connects, so each ship
    gets its own storage directory: ~/sovnas/<ship> by default.

Usage:
  python3 sovnasd.py                       # find ships and serve them
  python3 sovnasd.py --pier /path/to/pier  # serve a specific pier
  python3 sovnasd.py --root '/data/sovnas/{ship}'
  python3 sovnasd.py --install             # run at boot (systemd/launchd)

Only Python 3.8+ standard library is required.
"""

import argparse
import glob
import gzip
import hashlib
import json
import logging
import mimetypes
import os
import shutil
import socket
import struct
import sys
import tempfile
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = '1.1.0'
log = logging.getLogger('sovnasd')

# ------------------------------------------------------------------ nouns ---
#
# Lick speaks newt: [0x00][u32 little-endian length][jam([mark noun])].
# Atoms are python ints, cells are tuples (head, tail).  Hoon lists are
# null-terminated right-nested cells; loobeans are 0 (yes) and 1 (no).

YES, NO = 0, 1


def cord(s):
    if isinstance(s, int):
        return s
    return int.from_bytes(s.encode('utf-8'), 'little')


def uncord(n):
    return n.to_bytes((n.bit_length() + 7) // 8, 'little').decode('utf-8', 'replace')


def octs(b):
    return (len(b), int.from_bytes(b, 'little'))


def unocts(o):
    ln, at = o
    return at.to_bytes(ln, 'little') if ln else b''


def T(*xs):
    """Right-nested tuple noun from arguments."""
    n = xs[-1]
    for x in reversed(xs[:-1]):
        n = (x, n)
    return n


def L(items):
    """Hoon list."""
    n = 0
    for x in reversed(list(items)):
        n = (x, n)
    return n


def jam(noun):
    segs = []

    def mat(a):
        if a == 0:
            segs.append((1, 1))
            return
        b = a.bit_length()
        c = b.bit_length()
        segs.append((1 << c, c + 1))
        segs.append((b & ((1 << (c - 1)) - 1), c - 1))
        segs.append((a, b))

    stack = [noun]
    while stack:
        n = stack.pop()
        if isinstance(n, tuple):
            segs.append((1, 2))
            stack.append(n[1])
            stack.append(n[0])
        else:
            segs.append((0, 1))
            mat(n)

    def combine(lo, hi):
        if hi - lo == 1:
            return segs[lo]
        mid = (lo + hi) // 2
        av, al = combine(lo, mid)
        bv, bl = combine(mid, hi)
        return (av | (bv << al), al + bl)

    return combine(0, len(segs))[0]


def cue(atom):
    data = atom.to_bytes((atom.bit_length() + 7) // 8, 'little')

    def bits(pos, n):
        if n == 0:
            return 0
        s = pos >> 3
        return (int.from_bytes(data[s:((pos + n) >> 3) + 1], 'little') >> (pos & 7)) & ((1 << n) - 1)

    def rub(pos):
        c = 0
        while bits(pos + c, 1) == 0:
            c += 1
            if c > 128:
                raise ValueError('bad jam')
        if c == 0:
            return 0, 1
        b = (1 << (c - 1)) | bits(pos + c + 1, c - 1)
        return bits(pos + c + c, b), c + c + b

    cache = {}
    # iterative decoder: (pos, state) frames
    out = []
    stack = [('noun', 0)]
    while stack:
        kind, pos = stack.pop()
        if kind == 'noun':
            if bits(pos, 1) == 0:
                v, w = rub(pos + 1)
                cache[pos] = v
                out.append((v, 1 + w))
            elif bits(pos + 1, 1) == 0:
                stack.append(('cell', pos))
                stack.append(('head', pos))
                stack.append(('noun', pos + 2))
            else:
                r, w = rub(pos + 2)
                out.append((cache[r], 2 + w))
        elif kind == 'head':
            h, hw = out[-1]
            stack.append(('noun', pos + 2 + hw))
        else:  # cell
            t, tw = out.pop()
            h, hw = out.pop()
            n = (h, t)
            cache[pos] = n
            out.append((n, 2 + hw + tw))
    return out[0][0]


def lst(n):
    out = []
    while isinstance(n, tuple):
        out.append(n[0])
        n = n[1]
    return out


# --------------------------------------------------------------- sandbox ---

TRASH = '.sovnas-trash'


def resolve(root, rel):
    """Map a drive path like '/a/b' into the storage root, refusing escapes."""
    parts = [p for p in rel.split('/') if p]
    for p in parts:
        if p in ('.', '..') or '\x00' in p or '\\' in p:
            raise PermissionError('bad path')
    full = os.path.realpath(os.path.join(root, *parts)) if parts else os.path.realpath(root)
    real_root = os.path.realpath(root)
    if full != real_root and not full.startswith(real_root + os.sep):
        raise PermissionError('path escapes the drive')
    return full


def hidden(name):
    return name.startswith('.sovnas')


def mime_of(path):
    m, _ = mimetypes.guess_type(path)
    return m or 'application/octet-stream'


def unique(path):
    if not os.path.exists(path):
        return path
    d, base = os.path.split(path)
    stem, ext = os.path.splitext(base)
    if stem.startswith('.') and not ext:
        stem, ext = base, ''
    i = 1
    while True:
        p = os.path.join(d, f'{stem} ({i}){ext}')
        if not os.path.exists(p):
            return p
        i += 1


def rel_of(root, full):
    r = os.path.relpath(full, os.path.realpath(root))
    return '/' + ('' if r == '.' else r.replace(os.sep, '/'))


def entry(name, full):
    st = os.stat(full)
    d = os.path.isdir(full)
    return T(cord(name), YES if d else NO, 0 if d else st.st_size, int(st.st_mtime),
             cord('' if d else mime_of(full)))


class Drive:
    """Filesystem operations for one ship's storage root."""

    def __init__(self, root):
        self.root = root
        os.makedirs(root, exist_ok=True)

    def ls(self, p):
        full = resolve(self.root, p)
        if not os.path.isdir(full):
            raise NotADirectoryError('not a folder')
        ents = []
        for name in sorted(os.listdir(full)):
            if hidden(name):
                continue
            try:
                ents.append(entry(name, os.path.join(full, name)))
            except OSError:
                pass
        return L(ents)

    def stat(self, p):
        full = resolve(self.root, p)
        return entry(os.path.basename(full), full)

    def read(self, p, off, ln):
        full = resolve(self.root, p)
        if os.path.isdir(full):
            raise IsADirectoryError('is a folder')
        st = os.stat(full)
        with open(full, 'rb') as f:
            f.seek(off)
            data = f.read(max(0, ln))
        return T(st.st_size, cord(mime_of(full)), int(st.st_mtime), off, octs(data))

    def write(self, p, tmp, off, data, total, gunzip=False):
        full = resolve(self.root, p)
        d = os.path.dirname(full)
        if not os.path.isdir(d):
            raise FileNotFoundError('folder not found')
        if '/' in tmp or not tmp.startswith('.sovnas-up-'):
            raise PermissionError('bad temp name')
        tpath = os.path.join(d, tmp)
        mode = 'r+b' if (off > 0 and os.path.exists(tpath)) else 'wb'
        if off > 0 and mode == 'wb':
            raise ValueError('upload not started')
        with open(tpath, mode) as f:
            f.seek(off)
            f.write(data)
            size = f.seek(0, 2)
        if off + len(data) < total:
            return T(NO, cord(''))
        if size != total:
            os.remove(tpath)
            raise ValueError('upload incomplete')
        final = unique(full)
        if gunzip:
            # in-ship files may be stored gzipped; land the real thing
            with gzip.open(tpath, 'rb') as src, open(final, 'xb') as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            os.remove(tpath)
        else:
            os.replace(tpath, final)
        os.chmod(final, 0o644)
        return T(YES, cord(rel_of(self.root, final)))

    def walk(self, p):
        """Everything under a path, parents first; a file yields itself as ''."""
        full = resolve(self.root, p)
        if not os.path.lexists(full):
            raise FileNotFoundError('not found')
        if not os.path.isdir(full):
            st = os.stat(full)
            return L([T(cord(''), NO, st.st_size, int(st.st_mtime), cord(mime_of(full)))])
        out = []
        for dirpath, dirs, files in os.walk(full):
            dirs[:] = sorted(d for d in dirs if not hidden(d))
            rel = os.path.relpath(dirpath, full)
            pre = '' if rel == '.' else rel.replace(os.sep, '/') + '/'
            for d in dirs:
                st = os.stat(os.path.join(dirpath, d))
                out.append(T(cord(pre + d), YES, 0, int(st.st_mtime), cord('')))
            for f in sorted(files):
                if hidden(f):
                    continue
                fp = os.path.join(dirpath, f)
                try:
                    st = os.stat(fp)
                except OSError:
                    continue
                out.append(T(cord(pre + f), NO, st.st_size, int(st.st_mtime), cord(mime_of(fp))))
        return L(out)

    def mkdirs(self, p):
        full = resolve(self.root, p)
        if os.path.exists(full) and not os.path.isdir(full):
            raise FileExistsError(f'{os.path.basename(full)} is a file')
        os.makedirs(full, exist_ok=True)
        return cord(os.path.basename(full))

    def mkdu(self, p):
        """Make a folder, picking 'name (1)' etc. if the name is taken."""
        full = resolve(self.root, p)
        if full == os.path.realpath(self.root):
            raise PermissionError('cannot create the root')
        if not os.path.isdir(os.path.dirname(full)):
            raise FileNotFoundError('parent folder not found')
        final = unique(full)
        os.mkdir(final)
        return cord(os.path.basename(final))

    def mkdir(self, p):
        full = resolve(self.root, p)
        if full == os.path.realpath(self.root):
            raise PermissionError('cannot create the root')
        if os.path.exists(full):
            raise FileExistsError('already exists')
        if not os.path.isdir(os.path.dirname(full)):
            raise FileNotFoundError('parent folder not found')
        os.mkdir(full)
        return cord(os.path.basename(full))

    def rm(self, p):
        full = resolve(self.root, p)
        if full == os.path.realpath(self.root):
            raise PermissionError('cannot delete the root')
        if not os.path.lexists(full):
            raise FileNotFoundError('not found')
        trash = os.path.join(self.root, TRASH)
        os.makedirs(trash, exist_ok=True)
        dest = unique(os.path.join(trash, f'{int(time.time())}-{os.path.basename(full)}'))
        os.replace(full, dest)
        return cord(os.path.basename(full))

    def mv(self, a, b):
        fa, fb = resolve(self.root, a), resolve(self.root, b)
        if fa == os.path.realpath(self.root):
            raise PermissionError('cannot move the root')
        if not os.path.lexists(fa):
            raise FileNotFoundError('not found')
        if os.path.lexists(fb):
            raise FileExistsError('destination already exists')
        if (fb + os.sep).startswith(fa + os.sep):
            raise PermissionError('cannot move a folder into itself')
        if not os.path.isdir(os.path.dirname(fb)):
            raise FileNotFoundError('destination folder not found')
        os.replace(fa, fb)
        return cord(os.path.basename(fb))

    def find(self, p, q):
        base = resolve(self.root, p)
        q = q.lower()
        hits = []
        for dirpath, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not hidden(d)]
            for name in dirs + files:
                if hidden(name) or q not in name.lower():
                    continue
                full = os.path.join(dirpath, name)
                try:
                    e = entry(name, full)
                except OSError:
                    continue
                hits.append(T(cord(rel_of(self.root, full)), *self._tail(e)))
                if len(hits) >= 200:
                    return L(hits)
        return L(hits)

    @staticmethod
    def _tail(e):
        # entry is [name dir size mod mime]; drop the name
        _, rest = e
        out = []
        while isinstance(rest, tuple):
            out.append(rest[0])
            rest = rest[1]
        out.append(rest)
        return out

    def df(self):
        u = shutil.disk_usage(self.root)
        return T(u.free, u.total)


# ------------------------------------------------------------ ship link ---

class ShipLink(threading.Thread):
    """One connection to one ship's %sovnas lick socket."""

    def __init__(self, pier, opts, registry):
        super().__init__(daemon=True, name=f'ship:{os.path.basename(pier)}')
        self.pier = pier
        self.opts = opts
        self.registry = registry
        self.sock = None
        self.ship = None
        self.token = None
        self.drive = None
        self.lock = threading.Lock()
        self.alive = True

    # -- framing --

    def socket_path(self):
        return os.path.join(self.pier, '.urb', 'dev', 'sovnas', 'sovnas')

    def connect(self):
        path = self.socket_path()
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        if len(path.encode()) < 100:
            s.connect(path)
        else:
            # unix socket paths are short; go through a symlink
            link = os.path.join(tempfile.gettempdir(),
                                'sovnasd-' + hashlib.sha1(path.encode()).hexdigest()[:12])
            try:
                if os.path.islink(link) and os.readlink(link) != os.path.dirname(path):
                    os.remove(link)
                if not os.path.islink(link):
                    os.symlink(os.path.dirname(path), link)
            except OSError:
                pass
            s.connect(os.path.join(link, 'sovnas'))
        return s

    def send(self, mark, noun):
        payload = jam(T(cord(mark), noun))
        raw = payload.to_bytes((payload.bit_length() + 7) // 8, 'little')
        with self.lock:
            self.sock.sendall(struct.pack('<BI', 0, len(raw)) + raw)

    def recv_exact(self, n):
        buf = bytearray()
        while len(buf) < n:
            chunk = self.sock.recv(min(1 << 20, n - len(buf)))
            if not chunk:
                raise ConnectionError('ship closed the connection')
            buf += chunk
        return bytes(buf)

    def recv(self):
        hdr = self.recv_exact(5)
        if hdr[0] != 0:
            raise ConnectionError('bad newt frame')
        n = struct.unpack('<I', hdr[1:])[0]
        noun = cue(int.from_bytes(self.recv_exact(n), 'little'))
        if not isinstance(noun, tuple):
            raise ConnectionError('expected [mark noun]')
        return uncord(noun[0]), noun[1]

    # -- protocol --

    def hello(self, noun):
        # [%hello our=@t token=@t version=@t], our rendered like '~zod'
        _, rest = noun
        our, rest = rest
        token, ver = rest
        self.ship = uncord(our).lstrip('~')
        if not self.ship or '/' in self.ship or '.' in self.ship:
            raise ConnectionError('bad ship name in hello')
        self.token = uncord(token)
        root = self.opts.root_for(self.ship, self.pier)
        self.drive = Drive(root)
        self.registry.register(self)
        u = shutil.disk_usage(root)
        log.info('~%s connected (agent %s), drive at %s', self.ship, uncord(ver), root)
        self.send('sovnas', T(cord('info'), cord(root), u.free, u.total, cord(VERSION),
                              self.opts.http_port or 0))

    def handle(self, noun):
        # [%req id=@ud dreq]
        _, rest = noun
        rid, req = rest
        tag = uncord(req[0]) if isinstance(req, tuple) else uncord(req)
        args = req[1] if isinstance(req, tuple) else 0
        d = self.drive
        try:
            if d is None:
                raise RuntimeError('daemon not initialized')
            if tag == 'ls':
                body = d.ls(uncord(args))
            elif tag == 'stat':
                body = d.stat(uncord(args))
            elif tag == 'read':
                p, (off, ln) = args
                body = d.read(uncord(p), off, ln)
            elif tag in ('write', 'wgz'):
                p, (tmp, (off, (data, total))) = args
                body = d.write(uncord(p), uncord(tmp), off, unocts(data), total, gunzip=(tag == 'wgz'))
            elif tag == 'walk':
                body = d.walk(uncord(args))
            elif tag == 'mkdirs':
                body = d.mkdirs(uncord(args))
            elif tag == 'mkdu':
                body = d.mkdu(uncord(args))
            elif tag == 'mkdir':
                body = d.mkdir(uncord(args))
            elif tag == 'rm':
                body = d.rm(uncord(args))
            elif tag == 'mv':
                a, b = args
                body = d.mv(uncord(a), uncord(b))
            elif tag == 'find':
                p, q = args
                body = d.find(uncord(p), uncord(q))
            elif tag == 'df':
                body = d.df()
            else:
                raise ValueError(f'unknown request {tag}')
            self.send('sovnas', T(cord('res'), rid, YES, body))
        except Exception as e:  # report every failure back to the ship
            msg = getattr(e, 'strerror', None) or str(e) or e.__class__.__name__
            if not isinstance(e, (OSError, ValueError, PermissionError)):
                log.exception('error handling %s', tag)
            self.send('sovnas', T(cord('res'), rid, NO, cord(msg)))

    def changed(self, rel_dir):
        try:
            self.send('sovnas', T(cord('changed'), cord(rel_dir)))
        except OSError:
            pass

    def run(self):
        backoff = 1
        while self.alive:
            try:
                self.sock = self.connect()
                log.info('connected to %s', self.socket_path())
                backoff = 1
                while True:
                    mark, noun = self.recv()
                    if mark == 'sovnas' and isinstance(noun, tuple):
                        head = uncord(noun[0])
                        if head == 'hello':
                            self.hello(noun)
                        elif head == 'req':
                            self.handle(noun)
            except (OSError, ConnectionError, ValueError) as e:
                if self.ship:
                    log.info('~%s disconnected: %s', self.ship, e)
                else:
                    log.debug('connection to %s ended: %r', self.pier, e)
                self.registry.unregister(self)
            finally:
                try:
                    if self.sock:
                        self.sock.close()
                except OSError:
                    pass
                self.sock = None
            if not os.path.exists(self.socket_path()):
                self.alive = False
                self.registry.forget(self.pier)
                return
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)


# ------------------------------------------------------------ discovery ---

def candidate_piers(opts):
    here = os.path.dirname(os.path.abspath(__file__))
    found = []
    for p in opts.piers:
        found.append(os.path.abspath(os.path.expanduser(p)))
    # running from a |mount'ed desk: <pier>/<desk>/daemon/sovnasd.py
    found.append(os.path.dirname(os.path.dirname(here)))
    home = os.path.expanduser('~')
    patterns = [os.path.join(os.getcwd(), '*'), os.getcwd(),
                os.path.join(home, '*'), os.path.join(home, 'urbit', '*'),
                os.path.join(home, 'piers', '*'), os.path.join(home, 'ships', '*'),
                '/media/data/docker/volumes/*/_data/*',       # NativePlanet
                '/var/lib/docker/volumes/*/_data/*',
                '/opt/urbit/*', '/urbit/*', '/data/*']
    patterns += [p for p in os.environ.get('SOVNAS_PIERS', '').split(':') if p]
    for pat in patterns:
        found.extend(glob.glob(pat))
    out = []
    for p in found:
        if os.path.exists(os.path.join(p, '.urb', 'dev', 'sovnas', 'sovnas')) and p not in out:
            out.append(os.path.realpath(p))
    return list(dict.fromkeys(out))


class Registry:
    def __init__(self):
        self.lock = threading.Lock()
        self.links = {}        # pier -> ShipLink
        self.by_ship = {}      # ship -> ShipLink

    def register(self, link):
        with self.lock:
            self.by_ship[link.ship] = link

    def unregister(self, link):
        with self.lock:
            if link.ship and self.by_ship.get(link.ship) is link:
                del self.by_ship[link.ship]

    def forget(self, pier):
        with self.lock:
            self.links.pop(pier, None)

    def ship(self, name):
        with self.lock:
            return self.by_ship.get(name)


class Options:
    def __init__(self, a):
        self.piers = a.pier or []
        self.root = a.root
        self.http_port = 0 if a.no_http else a.http_port
        self.legacy = load_legacy_configs()

    def root_for(self, ship, pier):
        if self.root:
            return os.path.abspath(os.path.expanduser(self.root.replace('{ship}', ship)))
        # keep using a 0.x install's storage directory if there is one
        old = self.legacy.get(ship)
        if old:
            return old
        return os.path.join(os.path.expanduser('~'), 'sovnas', ship)


def load_legacy_configs():
    """sovnas 0.x kept per-ship JSON configs; reuse their storage roots."""
    out = {}
    here = os.path.dirname(os.path.abspath(__file__))
    for pat in ['/opt/sovnas/*.json', os.path.join(here, '*.json'), os.path.join(here, '..', '*.json')]:
        for f in glob.glob(pat):
            try:
                cfg = json.load(open(f))
                name = cfg['ship']['name'].lstrip('~')
                out[name] = cfg['daemon']['storage_root']
            except Exception:
                pass
    return out


# --------------------------------------------------------- direct http ---
#
# On a LAN, the browser can move host-disk files straight to and from the
# daemon instead of through the ship, which keeps big transfers out of the
# ship's event log.  Every request carries the ship's per-session token,
# which only the ship's owner can see.

def make_handler(registry):
    class H(BaseHTTPRequestHandler):
        server_version = 'sovnasd/' + VERSION

        def cors(self):
            self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin') or '*')
            self.send_header('Access-Control-Allow-Headers', 'x-sovnas-token, content-type, range')
            self.send_header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
            self.send_header('Access-Control-Expose-Headers', 'content-range, content-length')
            self.send_header('Access-Control-Allow-Private-Network', 'true')

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        def link(self):
            u = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(u.query)
            parts = u.path.split('/', 2)          # ['', '~ship', 'f']
            if len(parts) < 3 or not parts[1].startswith('~'):
                return None, None, q
            ln = registry.ship(parts[1][1:])
            tok = self.headers.get('x-sovnas-token') or (q.get('t') or [''])[0]
            if ln is None or not ln.token or not hmac_eq(tok, ln.token):
                return None, parts[2], q
            return ln, parts[2], q

        def deny(self, code=403, msg='forbidden'):
            self.send_response(code)
            self.cors()
            self.send_header('content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(msg.encode())

        def do_GET(self):
            ln, kind, q = self.link()
            if kind == 'ping' and ln:
                self.send_response(200)
                self.cors()
                self.end_headers()
                self.wfile.write(b'ok')
                return
            if not ln or kind != 'f':
                return self.deny()
            try:
                full = resolve(ln.drive.root, (q.get('p') or ['/'])[0])
            except PermissionError:
                return self.deny()
            if not os.path.isfile(full):
                return self.deny(404, 'not found')
            size = os.path.getsize(full)
            start, end = 0, size - 1
            rng = self.headers.get('Range')
            status = 200
            if rng and rng.startswith('bytes=') and size:
                a, _, b = rng[6:].partition('-')
                try:
                    if a:
                        start = int(a)
                        end = min(int(b), size - 1) if b else size - 1
                    else:
                        start = max(0, size - int(b))
                    status = 206
                except ValueError:
                    pass
                if start > end:
                    return self.deny(416, 'bad range')
            name = os.path.basename(full)
            disp = 'attachment' if (q.get('dl') or [''])[0] == '1' else 'inline'
            self.send_response(status)
            self.cors()
            self.send_header('content-type', mime_of(full))
            self.send_header('content-length', str(end - start + 1 if size else 0))
            self.send_header('accept-ranges', 'bytes')
            self.send_header('content-security-policy', 'sandbox')
            self.send_header('x-content-type-options', 'nosniff')
            self.send_header('content-disposition',
                             f"{disp}; filename*=UTF-8''{urllib.parse.quote(name)}")
            if status == 206:
                self.send_header('content-range', f'bytes {start}-{end}/{size}')
            self.end_headers()
            with open(full, 'rb') as f:
                f.seek(start)
                left = end - start + 1 if size else 0
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)

        def do_PUT(self):
            ln, kind, q = self.link()
            if not ln or kind != 'f':
                return self.deny()
            dirp = (q.get('p') or ['/'])[0]
            name = (q.get('name') or [''])[0]
            if not name or '/' in name or name in ('.', '..'):
                return self.deny(400, 'bad name')
            try:
                d = resolve(ln.drive.root, dirp)
            except PermissionError:
                return self.deny()
            if not os.path.isdir(d):
                return self.deny(404, 'folder not found')
            n = int(self.headers.get('content-length') or 0)
            tmp = os.path.join(d, f'.sovnas-up-{os.getpid()}-{threading.get_ident()}')
            with open(tmp, 'wb') as f:
                left = n
                while left > 0:
                    chunk = self.rfile.read(min(1 << 20, left))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
            if left:
                os.remove(tmp)
                return self.deny(400, 'upload cut short')
            final = unique(os.path.join(d, name))
            os.replace(tmp, final)
            os.chmod(final, 0o644)
            ln.changed(rel_of(ln.drive.root, d))
            self.send_response(200)
            self.cors()
            self.send_header('content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'msg': os.path.basename(final)}).encode())

        def log_message(self, fmt, *args):
            log.debug('http: ' + fmt, *args)

    return H


def hmac_eq(a, b):
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


# --------------------------------------------------------------- install ---

def install_service(argv):
    py = sys.executable
    script = os.path.abspath(__file__)
    args = [a for a in argv if a != '--install']
    if sys.platform == 'darwin':
        label = 'org.urbit.sovnasd'
        plist = os.path.expanduser(f'~/Library/LaunchAgents/{label}.plist')
        os.makedirs(os.path.dirname(plist), exist_ok=True)
        items = ''.join(f'<string>{x}</string>' for x in [py, script] + args)
        open(plist, 'w').write(f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{label}</string>
<key>ProgramArguments</key><array>{items}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>WorkingDirectory</key><string>{os.getcwd()}</string>
</dict></plist>
''')
        os.system(f'launchctl unload {plist} 2>/dev/null; launchctl load {plist}')
        print(f'installed launchd agent {plist}')
        return
    unit = f'''[Unit]
Description=SovNAS host-disk daemon (sovnasd)
After=network.target docker.service

[Service]
ExecStart={py} {script} {' '.join(args)}
WorkingDirectory={os.getcwd()}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
'''
    path = '/etc/systemd/system/sovnasd.service'
    try:
        open(path, 'w').write(unit)
    except PermissionError:
        print('run with sudo to install the systemd service, or create it yourself:\n')
        print(unit)
        return
    os.system('systemctl daemon-reload && systemctl enable --now sovnasd')
    print('installed and started sovnasd.service')


# ------------------------------------------------------------------ main ---

def main():
    ap = argparse.ArgumentParser(description='host-disk daemon for the %sovnas Urbit drive')
    ap.add_argument('--pier', action='append', help='pier to serve (repeatable); default: find them')
    ap.add_argument('--root', help="storage directory; '{ship}' is replaced (default ~/sovnas/{ship})")
    ap.add_argument('--http-port', type=int, default=8090, help='direct LAN transfer port (default 8090)')
    ap.add_argument('--no-http', action='store_true', help='disable direct LAN transfers')
    ap.add_argument('--log-level', default='INFO', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'])
    ap.add_argument('--once', action='store_true', help='scan for piers once instead of watching')
    ap.add_argument('--install', action='store_true', help='install as a boot service and exit')
    a = ap.parse_args()
    logging.basicConfig(level=getattr(logging, a.log_level),
                        format='%(asctime)s sovnasd %(levelname)s %(message)s',
                        datefmt='%Y-%m-%dT%H:%M:%S')
    if a.install:
        return install_service(sys.argv[1:])

    opts = Options(a)
    reg = Registry()
    if opts.http_port:
        try:
            srv = ThreadingHTTPServer(('0.0.0.0', opts.http_port), make_handler(reg))
            threading.Thread(target=srv.serve_forever, daemon=True, name='http').start()
            log.info('direct LAN transfers on port %d', opts.http_port)
        except OSError as e:
            log.warning('direct transfers disabled (port %d: %s)', opts.http_port, e)
            opts.http_port = 0

    log.info('sovnasd %s looking for ships running %%sovnas...', VERSION)
    announced = False
    while True:
        for pier in candidate_piers(opts):
            with reg.lock:
                known = pier in reg.links
            if not known:
                link = ShipLink(pier, opts, reg)
                with reg.lock:
                    reg.links[pier] = link
                link.start()
        if not reg.links and not announced:
            log.info('no ships found yet; start your ship and install %%sovnas '
                     '(or pass --pier). still watching...')
            announced = True
        if a.once:
            while any(l.is_alive() for l in list(reg.links.values())):
                time.sleep(1)
            return
        time.sleep(10)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
