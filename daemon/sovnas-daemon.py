#!/usr/bin/env python3
"""
sovnas-daemon.py — Host daemon for %sovnas Urbit NAS application.

Connects to the %lick Unix domain socket at <pier>/.urb/dev/sovnas,
receives JSON-encoded filesystem commands jammed as Urbit nouns,
executes them sandboxed within the storage root, and sends back
JSON responses as jammed nouns.

Usage:
    python3 sovnas-daemon.py --pier /path/to/pier --root /home/nativeplanet/sovnas

Security:
    - ALL filesystem operations are sandboxed to the storage root.
    - Symlinks that escape the sandbox are rejected.
    - Path traversal (..) is blocked.
    - Uploaded files are never made executable.
    - Runs as an unprivileged user.
"""

import argparse
import base64
import json
import logging
import mimetypes
import os
import shutil
import socket
import struct
import sys
import threading
import time
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from noun import cord_to_atom, atom_to_cord, atom_to_bytes, bytes_to_atom, jam, cue, Cell

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
logger = logging.getLogger('sovnas-daemon')


# ---------------------------------------------------------------------------
# Path sandboxing
# ---------------------------------------------------------------------------

def safe_resolve(storage_root: str, requested_path: str) -> str:
    """
    Resolve a path relative to storage_root and verify it stays within the sandbox.
    Raises PermissionError if the path escapes.
    """
    # Reject obvious traversal
    for part in requested_path.replace('\\', '/').split('/'):
        if part == '..':
            raise PermissionError(f'Path traversal detected: {requested_path!r}')

    resolved = os.path.realpath(os.path.join(storage_root, requested_path.lstrip('/')))
    root = os.path.realpath(storage_root)

    if resolved != root and not resolved.startswith(root + os.sep):
        raise PermissionError(f'Path escapes storage root: {requested_path!r} -> {resolved!r}')

    return resolved


# ---------------------------------------------------------------------------
# Filesystem operations
# ---------------------------------------------------------------------------

def op_ls(storage_root: str, dir_path: str) -> dict:
    resolved = safe_resolve(storage_root, dir_path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f'Directory not found: {dir_path!r}')
    if not os.path.isdir(resolved):
        raise NotADirectoryError(f'Not a directory: {dir_path!r}')

    entries = []
    for name in sorted(os.listdir(resolved)):
        entry_path = os.path.join(resolved, name)
        try:
            stat = os.stat(entry_path)
            entries.append({
                'name': name,
                'size': stat.st_size,
                'modified': int(stat.st_mtime),
                'is_dir': os.path.isdir(entry_path),
            })
        except OSError as e:
            logger.warning('Could not stat %s: %s', entry_path, e)

    return {'dir': dir_path, 'entries': entries}


def op_put(storage_root: str, name: str, dir_path: str, data_b64: str, max_size: int) -> dict:
    # Sanitize filename
    if not name or '/' in name or name in ('.', '..'):
        raise ValueError(f'Invalid filename: {name!r}')

    resolved_dir = safe_resolve(storage_root, dir_path)
    resolved_file = os.path.join(resolved_dir, name)
    # Verify combined path is still in sandbox
    safe_resolve(storage_root, os.path.join(dir_path.lstrip('/'), name))

    data = base64.b64decode(data_b64)
    if len(data) > max_size:
        raise ValueError(f'File too large: {len(data)} bytes (max {max_size})')

    os.makedirs(resolved_dir, exist_ok=True)
    with open(resolved_file, 'wb') as f:
        f.write(data)

    # Strip execute bits
    mode = os.stat(resolved_file).st_mode
    os.chmod(resolved_file, mode & ~0o111)

    return {'path': (dir_path.rstrip('/') + '/' + name)}


def op_get(storage_root: str, file_path: str) -> dict:
    resolved = safe_resolve(storage_root, file_path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f'File not found: {file_path!r}')
    if os.path.isdir(resolved):
        raise IsADirectoryError(f'Is a directory: {file_path!r}')

    with open(resolved, 'rb') as f:
        data = f.read()

    mime, _ = mimetypes.guess_type(resolved)
    return {
        'path': file_path,
        'data': base64.b64encode(data).decode('ascii'),
        'mime': mime or 'application/octet-stream',
        'size': len(data),
    }


def op_rm(storage_root: str, path: str) -> dict:
    resolved = safe_resolve(storage_root, path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f'Not found: {path!r}')
    if os.path.isdir(resolved):
        if os.listdir(resolved):
            raise OSError(f'Directory not empty: {path!r}')
        os.rmdir(resolved)
    else:
        os.remove(resolved)
    return {}


def op_mv(storage_root: str, src: str, dst: str) -> dict:
    resolved_src = safe_resolve(storage_root, src)
    resolved_dst = safe_resolve(storage_root, dst)
    if not os.path.exists(resolved_src):
        raise FileNotFoundError(f'Source not found: {src!r}')
    os.makedirs(os.path.dirname(resolved_dst), exist_ok=True)
    shutil.move(resolved_src, resolved_dst)
    return {}


def op_mk(storage_root: str, dir_path: str) -> dict:
    resolved = safe_resolve(storage_root, dir_path)
    os.makedirs(resolved, exist_ok=True)
    return {}


def op_stat(storage_root: str, path: str) -> dict:
    resolved = safe_resolve(storage_root, path)
    if not os.path.exists(resolved):
        raise FileNotFoundError(f'Not found: {path!r}')
    stat = os.stat(resolved)
    is_dir = os.path.isdir(resolved)
    mime, _ = mimetypes.guess_type(resolved)
    return {
        'name': os.path.basename(resolved),
        'size': stat.st_size,
        'modified': int(stat.st_mtime),
        'is_dir': is_dir,
        'mime': mime or ('inode/directory' if is_dir else 'application/octet-stream'),
    }


# ---------------------------------------------------------------------------
# Command dispatcher
# ---------------------------------------------------------------------------

def dispatch(cmd: dict, storage_root: str, max_size: int) -> dict:
    req_id = cmd.get('id', 0)
    command = cmd.get('cmd', '')
    args = cmd.get('args', {})

    try:
        if command == 'ls':
            data = op_ls(storage_root, args.get('dir', '/'))
        elif command == 'put':
            data = op_put(storage_root, args.get('name', ''), args.get('dir', '/'),
                          args.get('data', ''), max_size)
        elif command == 'get':
            data = op_get(storage_root, args.get('path', '/'))
        elif command == 'rm':
            data = op_rm(storage_root, args.get('path', '/'))
        elif command == 'mv':
            data = op_mv(storage_root, args.get('src', ''), args.get('dst', ''))
        elif command == 'mk':
            data = op_mk(storage_root, args.get('dir', '/'))
        elif command == 'stat':
            data = op_stat(storage_root, args.get('path', '/'))
        else:
            return {'id': req_id, 'status': 'error', 'error': f'Unknown command: {command!r}'}

        return {'id': req_id, 'status': 'ok', 'data': data}

    except PermissionError as e:
        logger.warning('Permission denied: %s', e)
        return {'id': req_id, 'status': 'error', 'error': str(e)}
    except (FileNotFoundError, NotADirectoryError, IsADirectoryError, ValueError, OSError) as e:
        logger.info('Op error for %r: %s', command, e)
        return {'id': req_id, 'status': 'error', 'error': str(e)}
    except Exception as e:
        logger.exception('Unexpected error for command %r', command)
        return {'id': req_id, 'status': 'error', 'error': f'Internal error: {e}'}


# ---------------------------------------------------------------------------
# Socket I/O
# ---------------------------------------------------------------------------

def _recv_exactly(sock: socket.socket, n: int) -> 'bytes | None':
    """Read exactly n bytes from socket. Returns None on connection close."""
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def send_response(sock: socket.socket, response: dict) -> None:
    """Send a response using the newt protocol: [0x00][4-byte LE length][jam([%txt cord])]"""
    json_str = json.dumps(response)
    cord = cord_to_atom(json_str)
    mark = cord_to_atom('txt')
    jammed = jam(Cell(mark, cord))
    payload = atom_to_bytes(jammed)
    header = struct.pack('<BI', 0x00, len(payload))
    sock.sendall(header + payload)
    logger.debug('Sent id=%s (%d bytes)', response.get('id'), len(payload))


def recv_message(sock: socket.socket) -> 'tuple[str, str] | None':
    """Read one newt-framed message. Returns (mark, data) or None on close.

    Newt frame: [1 byte version=0x00] [4 byte LE length] [jammed [mark noun]]
    """
    header = _recv_exactly(sock, 5)
    if header is None:
        return None

    version = header[0]
    if version != 0x00:
        logger.error('Bad newt version byte: 0x%02x', version)
        return None

    length = struct.unpack('<I', header[1:5])[0]
    if length == 0:
        return None
    if length > 512 * 1024 * 1024:  # 512 MB safety cap
        logger.error('Incoming message too large: %d bytes', length)
        return None

    payload = _recv_exactly(sock, length)
    if payload is None:
        return None

    try:
        atom = bytes_to_atom(payload)
        noun = cue(atom)
        if isinstance(noun, Cell):
            mark = atom_to_cord(noun.head) if isinstance(noun.head, int) else ''
            return (mark, noun.tail)
        else:
            logger.error('Expected cell [mark noun], got atom: %r', noun)
            return None
    except Exception as e:
        logger.exception('Failed to decode noun: %s', e)
        return None


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run_daemon(socket_path: str, storage_root: str, max_size: int) -> None:
    os.makedirs(storage_root, exist_ok=True)
    logger.info('Storage root : %s', storage_root)
    logger.info('Socket path  : %s', socket_path)
    logger.info('Max file size: %d bytes', max_size)

    backoff = 1
    max_backoff = 60

    while True:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            logger.info('Connecting to %s ...', socket_path)
            sock.connect(socket_path)
            logger.info('Connected.')
            backoff = 1

            while True:
                result = recv_message(sock)
                if result is None:
                    logger.info('Connection closed by ship.')
                    break

                mark, noun_tail = result
                logger.debug('Received mark=%s', mark)

                # Skip non-txt marks (e.g. %connect, %disconnect, %error)
                if mark != 'txt':
                    logger.debug('Ignoring mark=%s', mark)
                    continue

                # noun_tail is a cord atom — decode to JSON string
                try:
                    json_str = atom_to_cord(noun_tail) if isinstance(noun_tail, int) else str(noun_tail)
                    logger.debug('JSON: %.200s', json_str)
                    cmd = json.loads(json_str)
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    logger.error('Invalid message: %s', e)
                    continue

                response = dispatch(cmd, storage_root, max_size)
                try:
                    send_response(sock, response)
                except OSError as e:
                    logger.error('Send failed: %s', e)
                    break

        except FileNotFoundError:
            logger.warning('Socket not found: %s — waiting for Urbit ship...', socket_path)
        except ConnectionRefusedError:
            logger.warning('Connection refused — ship may not be running %%sovnas yet.')
        except OSError as e:
            logger.error('Socket error: %s', e)
        except KeyboardInterrupt:
            logger.info('Stopping (keyboard interrupt).')
            return
        finally:
            try:
                sock.close()
            except Exception:
                pass

        logger.info('Reconnecting in %ds...', backoff)
        time.sleep(backoff)
        backoff = min(backoff * 2, max_backoff)


# ---------------------------------------------------------------------------
# HTTP file server for direct downloads (avoids Chromium insecure-context blocks)
# ---------------------------------------------------------------------------

def make_download_handler(storage_root: str):
    """Create a request handler class bound to the given storage root."""
    class DownloadHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            raw_path = urllib.parse.unquote(self.path.lstrip('/'))
            try:
                resolved = safe_resolve(storage_root, raw_path)
            except PermissionError:
                self.send_error(403, 'Forbidden')
                return
            if not os.path.isfile(resolved):
                self.send_error(404, 'Not found')
                return
            mime, _ = mimetypes.guess_type(resolved)
            fname = os.path.basename(resolved)
            size = os.path.getsize(resolved)
            self.send_response(200)
            self.send_header('Content-Type', mime or 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{fname}"')
            self.send_header('Content-Length', str(size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(resolved, 'rb') as f:
                shutil.copyfileobj(f, self.wfile)

        def log_message(self, fmt, *args):
            logger.debug('HTTP: ' + fmt, *args)

    return DownloadHandler


def start_download_server(storage_root: str, port: int) -> None:
    handler = make_download_handler(storage_root)
    server = HTTPServer(('0.0.0.0', port), handler)
    logger.info('Download server listening on port %d', port)
    server.serve_forever()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def load_config(config_path: str) -> dict:
    """Load and return the sovnas JSON config file."""
    with open(config_path, 'r') as f:
        return json.load(f)


def find_config() -> 'dict | None':
    """Search for sovnas.config.json in standard locations."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, '..', 'sovnas.config.json'),  # repo layout
        os.path.join(script_dir, 'sovnas.config.json'),         # installed alongside daemon
        '/opt/sovnas/sovnas.config.json',                       # standard install location
    ]
    for path in candidates:
        real = os.path.realpath(path)
        if os.path.isfile(real):
            logger.info('Found config at %s', real)
            return load_config(real)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description='sovnas-daemon: host filesystem daemon for %sovnas Urbit NAS',
    )
    parser.add_argument('--config',
                        help='Path to sovnas.config.json')
    parser.add_argument('--pier',
                        help='Path to Urbit pier directory (overrides config file)')
    parser.add_argument('--root',
                        help='Storage root directory (overrides config file)')
    parser.add_argument('--max-size', type=int,
                        help='Max upload size in bytes (overrides config file)')
    parser.add_argument('--log-level',
                        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                        help='Logging verbosity (overrides config file)')
    parser.add_argument('--dl-port', type=int,
                        help='Port for direct file download HTTP server (overrides config file)')
    args = parser.parse_args()

    # Load config: explicit --config path > auto-discovery > empty
    cfg = {}
    if args.config:
        cfg = load_config(args.config)
    else:
        cfg = find_config() or {}

    # Resolve values: CLI args override config, with sensible defaults
    ship_cfg = cfg.get('ship', {})
    daemon_cfg = cfg.get('daemon', {})

    pier = args.pier or ship_cfg.get('pier')
    storage_root = args.root or daemon_cfg.get('storage_root', '/home/nativeplanet/sovnas')
    max_size = args.max_size or daemon_cfg.get('max_upload_bytes', 524_288_000)
    log_level = args.log_level or daemon_cfg.get('log_level', 'INFO')
    dl_port = args.dl_port or daemon_cfg.get('download_server_port', 8090)

    if not pier:
        print('ERROR: No pier path configured. Either:', file=sys.stderr)
        print('  1. Create sovnas.config.json (copy from sovnas.config.template.json)', file=sys.stderr)
        print('  2. Pass --config /path/to/sovnas.config.json', file=sys.stderr)
        print('  3. Pass --pier /path/to/pier directly', file=sys.stderr)
        sys.exit(1)

    logging.getLogger().setLevel(getattr(logging, log_level))

    # Start download HTTP server in background thread
    dl_thread = threading.Thread(
        target=start_download_server,
        args=(storage_root, dl_port),
        daemon=True,
    )
    dl_thread.start()

    socket_path = os.path.join(pier, '.urb', 'dev', 'sovnas', 'sovnas')
    run_daemon(socket_path, storage_root, max_size)


if __name__ == '__main__':
    main()
