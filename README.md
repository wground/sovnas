# SovNAS

Sovereign NAS for Urbit. A self-hosted file manager that runs as an Urbit app, giving you a web-based UI to browse, upload, download, rename, and delete files on your ship's host filesystem.

## Architecture

```
Frontend (React)  <-->  Gall Agent (%sovnas)  <-->  Python Daemon  <-->  Host Filesystem
     (Eyre HTTP)             (%lick IPC)            (Unix socket)
```

- **Hoon desk** (`desk/`) -- Gall agent that handles frontend subscriptions and communicates with the host daemon via the `%lick` IPC vane. Includes a static fileserver to serve the compiled React UI from Clay. Ships with a Landscape tile via `desk.docket-0`.
- **Python daemon** (`daemon/`) -- Runs on the host machine, connects to the `%lick` Unix domain socket, and executes sandboxed filesystem operations within a configurable storage root. Also runs an HTTP file server for direct downloads.
- **React frontend** (`ui/`) -- Single-page app built with React 18, TypeScript, and Tailwind CSS. Communicates with the Gall agent via `@urbit/http-api` (pokes + SSE subscriptions).

## Features

- Browse directories with breadcrumb navigation
- Upload files (chunked for files >4MB, configurable size limit)
- Download files (direct HTTP or blob-based for HTTPS/StarTram access)
- Create, rename, and delete files and directories
- List and grid view modes
- Right-click context menus
- Settings panel to view and edit daemon configuration from the UI
- Landscape home screen tile
- Path traversal protection and sandboxed filesystem access

## Deployment

### Prerequisites

- An Urbit ship (tested on NativePlanet devices)
- Python 3.8+ on the host
- Node.js 18+ (for building the UI)

### 1. Configure

Copy the config template and fill in your ship's details:

```bash
cp sovnas.config.template.json sovnas.config.json
```

Edit `sovnas.config.json`:

```json
{
  "ship": {
    "name": "your-ship",
    "pier": "/media/data/docker/volumes/your-ship/_data/your-ship"
  },
  "daemon": {
    "storage_root": "/home/nativeplanet/sovnas",
    "max_upload_bytes": 524288000,
    "log_level": "INFO",
    "download_server_port": 8090,
    "install_dir": "/opt/sovnas"
  },
  "network": { "peers": [] }
}
```

### 2. Build the UI

```bash
cd ui
npm install
npm run build
```

The build output in `dist/` is automatically referenced by `desk/web/`.

### 3. Install the desk

Copy `desk/` contents into your ship's `%sovnas` desk, or use the install script:

```bash
bash install-desk.sh
```

Then in dojo:

```
|commit %sovnas
|install our %sovnas
```

**Note:** The Landscape tile requires `lib/docket.hoon`, `sur/docket.hoon`, and `mar/docket-0.hoon` from your ship's `%landscape` desk. Copy them into the sovnas desk if they aren't already present.

### 4. Install and run the daemon

```bash
cd daemon
bash install.sh
sudo systemctl start sovnas-daemon
sudo systemctl enable sovnas-daemon
```

Or run manually:

```bash
python3 daemon/sovnas-daemon.py --config /path/to/sovnas.config.json
```

### 5. Access the UI

Navigate to `http://<your-ship>:8080/apps/sovnas/` (adjust port for your Eyre configuration). The app also appears as a tile on your Landscape home screen.

For remote access via StarTram, use your StarTram URL (e.g. `https://your-ship.startram.io/apps/sovnas/`). Downloads automatically use a blob-based method over HTTPS.

## Configuration

All deployment-specific settings live in `sovnas.config.json` (gitignored). A template is provided at `sovnas.config.template.json`.

You can also edit configuration from the Settings panel within the SovNAS UI.

| Setting | Description |
|---------|-------------|
| `ship.name` | Your ship name (without `~`) |
| `ship.pier` | Absolute path to your ship's pier |
| `daemon.storage_root` | Root directory for file storage |
| `daemon.max_upload_bytes` | Max upload size in bytes (default 500MB) |
| `daemon.log_level` | Logging level: DEBUG, INFO, WARNING, ERROR |
| `daemon.download_server_port` | HTTP download server port (default 8090) |

## Known Limitations

- **Chromium download restrictions**: Chromium-based browsers may block file downloads from HTTP origins. Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your ship's HTTP origins (e.g. `http://nativeplanet.local:8081,http://nativeplanet.local:8090`), enable the flag, and relaunch. Firefox does not have this issue.
- **No authentication on download server**: The HTTP download server (port 8090) serves files without authentication. Intended for trusted local networks only.
- **Directory deletion**: Only empty directories can be deleted.

## License

MIT
