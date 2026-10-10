# SovNAS

**Your own drive on Urbit.** Store files inside your ship or on the computer that runs it, and share them with any other ship, wherever it's hosted. Think Google Drive, except the server is your ship and the network is Urbit.

```
|install ~topdys %sovnas
```

That's the whole setup. Open the **SovNAS** tile in Landscape, or go to `/apps/sovnas` on your ship.

## What it does

- **My Drive (in-ship storage).** Files live inside your ship, so this works on any ship (hosted, NativePlanet, laptop) with no setup. Compressible files are gzipped in your browser before upload and served back transparently. Identical files are stored once.
- **Host disk (optional).** Run the small `sovnasd` daemon next to your ship and get a second volume backed by a real folder on that machine. Use it for big files and large libraries.
- **You choose where files go.** In Settings, pick My Drive or Host disk as the default: SovNAS opens there, and the New button uploads there. Files bigger than a size you set (64 MB by default), or bigger than My Drive's per-file limit, go to the same folder on the host disk automatically when it's connected. Right-click anything and choose **Move to Host disk** or **Move to My Drive** to move files or whole folders between the two. The ship does the copying in the background, deletes the original only once everything has been copied, and shares move with the files.
- **Sharing.** Share any file or folder, on either volume, with any ship as a viewer or an editor. It shows up under *Shared with me* on their SovNAS, and they can browse, preview, stream, download, and (as editors) upload, rename, move and delete. Their ship fetches everything from yours over Urbit's network. Nothing needs to share a machine, a LAN, or a domain.
- **Public links.** Turn on "Anyone with the link" to give a plain web link to a file or folder to someone without Urbit.
- **Previews** for images, video and audio (seekable, even when streamed from another ship), PDFs, text and code.
- Folders, drag-and-drop uploads (including whole folders), move/rename, multi-select, search, trash with restore, and dark mode.

## How it works

```
 browser ──HTTP──▶ your ship (%sovnas agent) ◀──── ames (%sovnas-peer) ────▶ their ship (%sovnas)
                        │            │                                            │
                 in-ship storage   %lick                                    their storage
                 (agent state)       │
                                  sovnasd ──▶ folder on the host disk
```

Every file has a network address, `~ship/volume/path`, and the `%sovnas` agent on `~ship` serves it whether the bytes are in the ship's state or on its host disk. When you open a file on someone else's ship, your browser asks **your** ship, your ship asks theirs over ames, and theirs streams the file back in flow-controlled 4 MiB chunks that your ship relays straight to your browser. Range requests work end to end, so video seeks. Uploads to a ship you have edit rights on go the same way in reverse.

Access is checked on the host ship for every request, against the authenticated identity ames provides: viewers can only read inside what's shared with them, editors can change things inside it but can't delete or move the shared item itself, and anything deleted goes to the owner's trash.

Pieces:

| Path | What |
|---|---|
| `desk/app/sovnas.hoon` | The agent: HTTP API and UI server, in-ship storage, sharing, the peer protocol, the daemon link |
| `desk/sur/sovnas.hoon`, `desk/lib/sovnas.hoon` | Types and helpers |
| `desk/mar/sovnas/peer.hoon` | The `%sovnas-peer` mark for ship-to-ship messages |
| `desk/daemon/sovnasd.py` | The host-disk daemon. It ships inside the desk, so `|mount %sovnas` puts it on your host |
| `desk/web/` | The built UI, served from Clay |
| `ui/` | UI source (React, TypeScript, Tailwind) |
| `dev/` | Tools for developing against local fake ships |

## Host disk (optional)

In your ship's dojo:

```
|mount %sovnas
```

Then, on the machine that runs your ship:

```bash
python3 <your-pier>/sovnas/daemon/sovnasd.py --install
```

`--install` sets it up as a boot service (systemd on Linux, launchd on macOS; use `sudo` on Linux). Run it without `--install` to try it in the foreground first. You can also download it from your ship at `/apps/sovnas/daemon/sovnasd.py`.

The daemon needs no configuration:

- It finds ships by looking for the `%sovnas` socket: in the pier it was mounted from, under NativePlanet's docker volumes, and in the current and home directories. One daemon serves every ship on the machine, and it notices ships that start later.
- Each ship tells the daemon who it is, so files go to `~/sovnas/<ship>` by default. Pass `--root '/data/sovnas/{ship}'` to choose elsewhere. Upgrading from SovNAS 0.x? It reuses the storage folders from your old `/opt/sovnas/*.json` configs automatically.
- Deleting on the host disk moves things into a `.sovnas-trash` folder inside the storage folder. Moving something from the host disk into My Drive does the same with the original.
- Moving files between My Drive and the host disk needs sovnasd 1.1 or newer. Older daemons keep working for everything else, and SovNAS tells you to update when you try to move something.
- On a LAN, when you use SovNAS over plain http, big host-disk transfers go straight between your browser and the daemon (port 8090), gated by a secret only your logged-in session can see. Over https (e.g. StarTram) everything goes through the ship.

Requirements: Python 3.8+, standard library only, running as the same user as the ship.

## Publishing (for ~topdys)

1. Build the UI: `cd ui && npm install && npm run build` (writes into `desk/web/`).
2. In the publishing ship's dojo, the first time: `|new-desk %sovnas` and `|mount %sovnas`. (If an old `%sovnas` is already there, just `|mount %sovnas`.)
3. On the ship's host: `./install-desk.sh /path/to/pier`
4. In dojo: `|commit %sovnas`, then the first time `|install our %sovnas` and `:treaty|publish %sovnas`.

Afterwards, `|commit %sovnas` on ~topdys is all it takes to ship an update: every ship that installed from ~topdys picks it up automatically. `desk.ship` names the publisher (`~topdys`); change it if you publish from another ship, since the UI tells people what to `|install`.

Upgrading a ship that ran SovNAS 0.x: commit the new desk over the old one. Existing shares are carried over (they point at the host disk, where 0.x kept files) and re-announced to the ships they were shared with, and the old `%sovnas-fileserver` agent is retired automatically. Stop the old daemon (`sudo systemctl disable --now sovnas-daemon`) and install `sovnasd` as above.

## Good to know

- **Ship memory.** In-ship files live in your ship's loom (2 GB by default, shared with everything else your ship does). SovNAS keeps them under a quota you set in Settings (default 256 MB, 64 MB per file). For more, start your ship with `--loom 32` (4 GB), `33` or `34`, or use the host disk.
- **Event log.** Everything your ship receives (uploads, files fetched from other ships) is recorded in its event log. After moving lots of data, stop the ship and run `urbit roll <pier>` then `urbit chop <pier>` to reclaim disk space. Host-disk files sent over direct LAN transfers skip this entirely.
- **Speed between ships** depends on Urbit's networking and the link between the machines. Between two local test ships, SovNAS moved files at about 22 MB/s over directed messaging ("mesa") and 0.65 MB/s over the older ames protocol. Ships are being migrated to directed messaging network-wide; until a pair of ships has migrated, transfers between them use the older protocol.
- Requires `[%zuse 408]` (Vere 4.4+). Tested on Vere 4.6.

## Development

`dev/` drives local fake ships through their control socket. No terminal juggling needed.

```bash
cd dev                            # put an urbit binary here as ./urbit (gitignored)
./urbit -F zod -c ships/zod -t --http-port 8081      # once, in the background
./sync.sh zod --install          # push ../desk into ~zod's %sovnas and install it
./check.sh zod                    # compile the agent on a scratch desk, print errors
python3 shipctl.py ships/zod eval '(add 2 2)'        # run Hoon on the ship
python3 api.py zod ls ship /                         # talk to the HTTP API
./test-ship.sh; ./test-cross.sh; ./test-host.sh; ./test-misc.sh; ./test-xfer.sh   # end-to-end suites
```

For the UI, `cd ui && npm run dev` proxies the API to `localhost:8081`.

## License

MIT
