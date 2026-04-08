# SovNAS

Sovereign NAS for Urbit. A self-hosted file manager that runs as an Urbit app, giving you a web-based UI to browse, upload, download, rename, and delete files on your ship's host filesystem — and share folders with other ships over %ames.

## Architecture

```
                          %ames (cross-ship pokes)
~ship-a  %sovnas  <------------------------------------->  ~ship-b  %sovnas
     |                                                          |
     v                                                          v
Frontend (React)  <-->  Gall Agent  <-->  Python Daemon  <-->  Host Filesystem
     (Eyre HTTP)         (%lick IPC)       (Unix socket)
```

- **Hoon desk** (`desk/`) -- Gall agent that handles frontend subscriptions, communicates with the host daemon via the `%lick` IPC vane, and manages cross-ship file sharing over `%ames`. Includes a static fileserver to serve the compiled React UI from Clay. Ships with a Landscape tile via `desk.docket-0`.
- **Python daemon** (`daemon/`) -- Runs on the host machine, connects to the `%lick` Unix domain socket, and executes sandboxed filesystem operations within a configurable storage root. Also runs an HTTP file server for direct downloads.
- **React frontend** (`ui/`) -- Single-page app built with React 18, TypeScript, and Tailwind CSS. Communicates with the Gall agent via `@urbit/http-api` (pokes + SSE subscriptions). Includes a share management panel and remote file browser.

## Features

### Local File Management
- Browse directories with breadcrumb navigation
- Upload files (chunked for files >4MB, configurable size limit)
- Download files (direct HTTP or blob-based for HTTPS/StarTram access)
- Create, rename, and delete files and directories
- List and grid view modes
- Right-click context menus

### Cross-Ship File Sharing
- Share folders with other ships, granting read-only or read+write access
- Browse remote shared folders from other ships directly in the UI
- Download files from remote ships over %ames
- Upload files and create folders on remote ships (with write permission)
- Revoke access at any time — the remote ship is notified immediately
- Permission enforcement on the host side (path prefix matching + ship identity via %ames)

### Administration
- Settings panel to view and edit daemon configuration from the UI
- Landscape home screen tile
- Path traversal protection and sandboxed filesystem access

## Deployment

### Prerequisites

- An Urbit ship (tested on NativePlanet devices, zuse 409)
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

**Note:** The desk requires standard mark and library files from your ship's `%base` or `%landscape` desk. If you create the desk with `|new-desk`, you'll need to copy these manually. Creating the desk with `|merge %sovnas our %base` avoids this issue. The Landscape tile additionally requires `lib/docket.hoon`, `sur/docket.hoon`, and `mar/docket-0.hoon` from your ship's `%landscape` desk.

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

## Multi-Ship Setup

To enable file sharing between ships, each ship needs its own daemon instance with a separate config, storage root, and download server port.

Example for a second ship on the same host:

```json
{
  "ship": {
    "name": "other-ship",
    "pier": "/media/data/docker/volumes/other-ship/_data/other-ship"
  },
  "daemon": {
    "storage_root": "/home/nativeplanet/sovnas-other",
    "max_upload_bytes": 524288000,
    "log_level": "INFO",
    "download_server_port": 8091,
    "install_dir": "/opt/sovnas"
  },
  "network": { "peers": [] }
}
```

Start each daemon with its own config:

```bash
python3 sovnas-daemon.py --config /opt/sovnas/sovnas-other.config.json
```

### Sharing a Folder

1. On the host ship's SovNAS UI, click **Shares**
2. Enter the folder path (relative to the storage root, e.g. `/shared`), the recipient ship name (e.g. `~sampel-palnet`), and the permission level
3. The recipient ship's SovNAS will show the share under "Shared With Me"
4. The recipient can browse, download, and (with write permission) upload files

All cross-ship communication uses %ames — no additional ports or network configuration required. File transfers over %ames are slower than local operations.

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

- **Ames transfer speed**: Cross-ship file transfers go through Urbit's %ames protocol, which is significantly slower than direct HTTP. Large files may take a while.
- **Chromium download restrictions**: Chromium-based browsers may block file downloads from HTTP origins. Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your ship's HTTP origins (e.g. `http://nativeplanet.local:8081,http://nativeplanet.local:8090`), enable the flag, and relaunch. Firefox does not have this issue.
- **No authentication on download server**: The HTTP download server (port 8090) serves files without authentication. Intended for trusted local networks only.
- **Directory deletion**: Only empty directories can be deleted.
- **Remote uploads**: Currently single-shot only (no chunking over %ames). Keep remote uploads under a few MB.

## License

MIT
