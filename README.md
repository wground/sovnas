# SovNAS

Sovereign NAS for Urbit. A self-hosted file manager that runs as an Urbit app, giving you a web-based UI to browse, upload, download, rename, and delete files on your ship's host filesystem.

## Architecture

- **Hoon desk** (`desk/`) -- Gall agent (`%sovnas`) that handles frontend subscriptions and communicates with the host daemon via the `%lick` IPC vane. Includes a static fileserver (`%sovnas-fileserver`) to serve the UI from Clay.
- **Python daemon** (`daemon/`) -- Runs on the host machine, connects to the `%lick` Unix domain socket, and executes sandboxed filesystem operations (ls, get, put, rm, mv, mk) within a configurable storage root.
- **React frontend** (`ui/`) -- Single-page app served by the Hoon fileserver. Communicates with the Gall agent via `@urbit/http-api` (pokes + SSE subscriptions).

## Deployment

### Prerequisites

- An Urbit ship (tested on NativePlanet devices)
- Python 3.8+ on the host
- Node.js 18+ (for building the UI)

### Install the desk

1. Copy `desk/` contents into your ship's `%sovnas` desk
2. In dojo: `|commit %sovnas`

### Build the UI

```bash
cd ui
npm install
npm run build
```

Copy `dist/` contents into `desk/web/` and `|commit %sovnas` again.

### Run the daemon

```bash
python3 daemon/sovnas-daemon.py \
  --pier /path/to/your/pier \
  --root /path/to/storage/directory
```

The daemon also starts an HTTP file server on port 8090 for direct downloads. To run as a systemd service, see `daemon/sovnas-daemon.service` for a template.

### Access the UI

Navigate to `http://<your-ship>:8080/apps/sovnas/` (adjust port for your Eyre configuration).

## Known Limitations

- **Chromium download restrictions**: Chromium-based browsers (Chrome, Arc, Edge, Brave) block or mark as "unconfirmed" file downloads from HTTP origins. To fix this, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your ship's HTTP origins (e.g. `http://nativeplanet.local:8081,http://nativeplanet.local:8090`), enable the flag, and relaunch. Firefox does not have this issue.
- **Upload size limit**: Uploads are capped at 2MB per file to avoid out-of-memory crashes in Hoon's base64 handling. Chunked upload support exists but the reassembly is memory-intensive.
- **No authentication on download server**: The daemon's HTTP download server (port 8090) serves files without authentication. It is intended for use on trusted local networks only.
- **No HTTPS**: The app runs over HTTP. If your ship is exposed to the internet, consider placing it behind a reverse proxy with TLS.

## License

MIT
