#!/usr/bin/env python3
"""
api.py -- command-line client for the %sovnas HTTP API (dev/testing).

  api.py <ship> state
  api.py <ship> ls      <vol> <path> [--on ~host]
  api.py <ship> up      <file> <vol> <dir> [--on ~host] [--gz] [--name N]
  api.py <ship> get     <vol> <path> <outfile> [--on ~host] [--range a-b]
  api.py <ship> op      '<json>'
  api.py <ship> search  <vol> <query>

<ship> is a dev ship name (zod, nec, ...); its port and +code are looked up
from dev/ships.  --on targets a file on another ship through ours.
"""

import gzip
import http.cookiejar
import json
import os
import random
import subprocess
import sys
import time
import urllib.parse
import urllib.request

DEV = os.path.dirname(os.path.abspath(__file__))
PORTS = {'zod': 8081, 'nec': 8082, 'bud': 8083, 'wes': 8084}
CHUNK = 1 << 20


class Client:
    def __init__(self, ship):
        self.ship = ship
        self.base = f'http://localhost:{PORTS[ship]}'
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        code = subprocess.check_output(
            ['python3', os.path.join(DEV, 'shipctl.py'), os.path.join(DEV, 'ships', ship), 'code'],
            text=True).strip().strip("'")
        self.req('POST', '/~/login', urllib.parse.urlencode({'password': code}).encode(), raw=True)

    def req(self, method, path, body=None, headers=None, raw=False):
        h = {'x-sovnas': '1'}
        h.update(headers or {})
        r = urllib.request.Request(self.base + path, data=body, method=method, headers=h)
        try:
            with self.op.open(r, timeout=300) as resp:
                data = resp.read()
                if raw:
                    return resp.status, dict(resp.headers), data
                return json.loads(data or b'null')
        except urllib.error.HTTPError as e:
            data = e.read()
            if raw:
                return e.code, dict(e.headers), data
            try:
                return json.loads(data)
            except Exception:
                return {'ok': False, 'status': e.code, 'body': data[:200].decode('utf-8', 'replace')}

    @staticmethod
    def q(**kw):
        return urllib.parse.urlencode({k: v for k, v in kw.items() if v is not None})

    def state(self):
        return self.req('GET', '/apps/sovnas/api/state')

    def ls(self, vol, path, on=None):
        return self.req('GET', '/apps/sovnas/api/ls?' + self.q(s=on, v=vol, p=path))

    def opj(self, obj):
        return self.req('POST', '/apps/sovnas/api/op', json.dumps(obj).encode(),
                        {'content-type': 'application/json'})

    def upload(self, data, name, vol, dir, on=None, gz=False, chunk=CHUNK):
        real = len(data)
        enc = None
        if gz:
            data = gzip.compress(data)
            enc = 'gz'
        uid = str(random.getrandbits(52))
        off = 0
        res = None
        while True:
            piece = data[off:off + chunk]
            res = self.req('POST', '/apps/sovnas/api/upload?' + self.q(
                s=on, v=vol, p=dir, name=name, id=uid, off=off, size=len(data),
                real=real, enc=enc), piece, {'content-type': 'application/octet-stream'})
            if not res or not res.get('ok'):
                return res
            off += len(piece)
            if off >= len(data):
                return res

    def get(self, vol, path, on=None, rng=None, dl=False):
        h = {'Accept-Encoding': 'gzip'}
        if rng:
            h['Range'] = 'bytes=' + rng
        st, hed, body = self.req('GET', '/apps/sovnas/api/file?' + self.q(
            s=on, v=vol, p=path, dl='1' if dl else None), headers=h, raw=True)
        if hed.get('Content-Encoding') == 'gzip' or hed.get('content-encoding') == 'gzip':
            body = gzip.decompress(body)
        return st, hed, body


def main():
    a = sys.argv[1:]
    on = None
    if '--on' in a:
        i = a.index('--on'); on = a[i + 1]; del a[i:i + 2]
    gz = '--gz' in a
    if gz:
        a.remove('--gz')
    rng = None
    if '--range' in a:
        i = a.index('--range'); rng = a[i + 1]; del a[i:i + 2]
    name = None
    if '--name' in a:
        i = a.index('--name'); name = a[i + 1]; del a[i:i + 2]
    c = Client(a[0])
    cmd = a[1]
    if cmd == 'state':
        print(json.dumps(c.state(), indent=2))
    elif cmd == 'ls':
        print(json.dumps(c.ls(a[2], a[3], on), indent=2))
    elif cmd == 'up':
        data = open(a[2], 'rb').read()
        t = time.time()
        r = c.upload(data, name or os.path.basename(a[2]), a[3], a[4], on, gz)
        dt = time.time() - t
        print(json.dumps(r), f'{len(data)/dt/1e6:.2f} MB/s' if dt > 0 else '')
    elif cmd == 'get':
        t = time.time()
        st, hed, body = c.get(a[2], a[3], on, rng)
        dt = time.time() - t
        open(a[4], 'wb').write(body)
        print(st, len(body), 'bytes', f'{len(body)/dt/1e6:.2f} MB/s' if dt > 0 else '',
              {k: v for k, v in hed.items() if k.lower() in
               ('content-type', 'content-range', 'content-encoding', 'content-disposition')})
    elif cmd == 'op':
        print(json.dumps(c.opj(json.loads(a[2]))))
    elif cmd == 'search':
        print(json.dumps(c.req('GET', '/apps/sovnas/api/search?' + c.q(v=a[2], q=a[3])), indent=2))


if __name__ == '__main__':
    main()
