#!/usr/bin/env python3
"""
shipctl.py -- drive a running (fake) ship through its conn.sock control plane.

Development tool only. Talks to <pier>/.urb/conn.sock using newt framing and
runs Hoon threads via %khan-eval, so ships can be scripted without a TTY.

  shipctl.py <pier> run   '<hoon producing shed:khan>'
  shipctl.py <pier> eval  '<hoon expr>'        # our/now/eny/byk in scope
  shipctl.py <pier> poke  <agent> <mark> '<hoon value>'
  shipctl.py <pier> dojo  '<hood cmd>'        # commit/mount/install/... helpers
  shipctl.py <pier> code                      # print +code
"""

import os
import socket
import struct
import sys

# ---------------------------------------------------------------- nouns ----


class Cell:
    __slots__ = ('head', 'tail')

    def __init__(self, head, tail):
        self.head, self.tail = head, tail


def cord(s):
    return int.from_bytes(s.encode(), 'little') if isinstance(s, str) else s


def uncord(n):
    return n.to_bytes((n.bit_length() + 7) // 8, 'little').decode('utf-8', 'replace')


def tup(*xs):
    """Right-nested tuple -> noun cell."""
    if len(xs) == 1:
        return xs[0]
    return Cell(xs[0], tup(*xs[1:]))


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
        if isinstance(n, Cell):
            segs.append((1, 2))
            stack.append(n.tail)
            stack.append(n.head)
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
        e = ((pos + n) >> 3) + 1
        return (int.from_bytes(data[s:e], 'little') >> (pos & 7)) & ((1 << n) - 1)

    def rub(pos):
        c = 0
        while bits(pos + c, 1) == 0:
            c += 1
            if c > 64:
                raise ValueError('bad rub')
        if c == 0:
            return 0, 1
        b = (1 << (c - 1)) | bits(pos + c + 1, c - 1)
        return bits(pos + c + c, b), c + c + b

    cache = {}

    def go(pos):
        if bits(pos, 1) == 0:
            v, w = rub(pos + 1)
            cache[pos] = v
            return v, 1 + w
        if bits(pos + 1, 1) == 0:
            h, hw = go(pos + 2)
            t, tw = go(pos + 2 + hw)
            n = Cell(h, t)
            cache[pos] = n
            return n, 2 + hw + tw
        r, w = rub(pos + 2)
        return cache[r], 2 + w

    sys.setrecursionlimit(100000)
    return go(0)[0]


def show(n, depth=0):
    """Render a noun readably: cords as 'text', cells as [a b]."""
    if isinstance(n, Cell):
        items = []
        while isinstance(n, Cell):
            items.append(show(n.head, depth + 1))
            n = n.tail
        if n != 0:
            items.append(show(n, depth + 1))
            return '[' + ' '.join(items) + ']'
        return '~[' + ' '.join(items) + ']' if items else '~'
    if n < 256 and n > 0x7f:
        return str(n)
    try:
        s = uncord(n)
        if n > 0 and s.isprintable() and len(s) > 0 and '�' not in s:
            return repr(s) if len(s) > 1 or not s.isdigit() else str(n)
    except Exception:
        pass
    return str(n)


# ---------------------------------------------------------------- conn -----

def call(pier, noun, timeout=600):
    path = os.path.join(pier, '.urb', 'conn.sock')
    payload = jam(noun)
    raw = payload.to_bytes((payload.bit_length() + 7) // 8, 'little')
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout)
    s.connect(path)
    s.sendall(struct.pack('<BI', 0, len(raw)) + raw)
    hdr = b''
    while len(hdr) < 5:
        chunk = s.recv(5 - len(hdr))
        if not chunk:
            raise ConnectionError('conn.sock closed')
        hdr += chunk
    ln = struct.unpack('<I', hdr[1:5])[0]
    buf = bytearray()
    while len(buf) < ln:
        chunk = s.recv(min(1 << 20, ln - len(buf)))
        if not chunk:
            raise ConnectionError('short read')
        buf += chunk
    s.close()
    return cue(int.from_bytes(bytes(buf), 'little'))


def run_thread(pier, hoon):
    req = tup(1, cord('fyrd'), cord('base'), cord('khan-eval'), cord('noun'),
              cord('ted-eval'), cord(hoon))
    res = call(pier, req)
    # [rid %avow %.y [mark noun]] or [rid %avow %.n goof]
    body = res.tail
    if isinstance(body, Cell) and body.head == cord('avow'):
        ok = body.tail.head == 0
        out = body.tail.tail
        if ok:
            return True, out.tail if isinstance(out, Cell) else out
        return False, out
    return False, res


def render_goof(goof):
    """goof = [mote=term =tang]; print tank leaves best-effort."""
    lines = []

    def walk(n):
        if isinstance(n, Cell):
            if n.head == cord('leaf') and not isinstance(n.tail, Cell) is False:
                # leaf+tape
                t = []
                x = n.tail
                while isinstance(x, Cell):
                    t.append(chr(x.head) if x.head < 0x110000 else '?')
                    x = x.tail
                lines.append(''.join(t))
                return
            walk(n.head)
            walk(n.tail)
    walk(goof)
    return '\n'.join(lines) if lines else show(goof)


PRELUDE = (
    "=/  m  (strand ,vase)  "
    ";<  bol=bowl:spider  bind:m  get-bowl  "
    "=/  our  our.bol  =/  now  now.bol  =/  eny  eny.bol  "
)


def eval_expr(pier, expr):
    return run_thread(pier, PRELUDE + "(pure:m !>(" + expr + "))")


def poke(pier, agent, mark, value):
    return run_thread(
        pier,
        PRELUDE + ";<  ~  bind:m  (poke [our %" + agent + "] %" + mark +
        " !>(" + value + "))  (pure:m !>('ok'))")


DOJO = {
    # name: (agent, mark, value-template)
    'commit':    ('hood', 'kiln-commit', "[%{0} |]"),
    'mount':     ('hood', 'kiln-mount', "[/(scot %p our)/{0}/(scot %da now) %{0}]"),
    'unmount':   ('hood', 'kiln-unmount', "`@tas`%{0}"),
    'install':   ('hood', 'kiln-install', "[%{0} {1} %{2}]"),
    'uninstall': ('hood', 'kiln-uninstall', "%{0}"),
    'nuke':      ('hood', 'kiln-nuke', "[%{0} |]"),
    'revive':    ('hood', 'kiln-revive', "%{0}"),
    'public':    ('hood', 'kiln-permission', "[%{0} / &]"),
}


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    pier, cmd, args = sys.argv[1], sys.argv[2], sys.argv[3:]
    if cmd == 'run':
        ok, out = run_thread(pier, args[0])
    elif cmd == 'eval':
        ok, out = eval_expr(pier, args[0])
    elif cmd == 'poke':
        ok, out = poke(pier, args[0], args[1], args[2])
    elif cmd == 'code':
        ok, out = eval_expr(pier, "(crip (slag 1 (scow %p .^(@p %j /(scot %p our)/code/(scot %da now)/(scot %p our)))))")
    elif cmd == 'dojo':
        agent, mark, tmpl = DOJO[args[0]]
        ok, out = poke(pier, agent, mark, tmpl.format(*args[1:]))
    else:
        print('unknown command', cmd)
        sys.exit(1)
    if ok:
        print(show(out))
    else:
        print('FAILED:', render_goof(out), file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
