#!/bin/bash
# install-desk.sh -- copy this repo's desk into a ship, for publishing.
#
# Only the publishing ship (e.g. ~topdys) needs this.  Everyone else just
# runs `|install ~topdys %sovnas` in their dojo.
#
# Usage:
#   ./install-desk.sh /path/to/pier          # e.g. /media/data/docker/volumes/topdys/_data/topdys
#   SOVNAS_PIER=/path/to/pier ./install-desk.sh
#
# Before running it the first time, in the ship's dojo:
#   |new-desk %sovnas
#   |mount %sovnas
# (If %sovnas already exists from an older install, just |mount %sovnas.)

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PIER="${1:-${SOVNAS_PIER:-}}"

if [ -z "$PIER" ]; then
  echo "usage: $0 /path/to/pier" >&2
  exit 1
fi
PIER="${PIER%/}"
DESK="$PIER/sovnas"

if [ ! -d "$PIER/.urb" ]; then
  echo "error: $PIER doesn't look like a pier (no .urb directory)" >&2
  exit 1
fi
if [ ! -d "$DESK" ]; then
  echo "error: $DESK not found. In dojo run:  |new-desk %sovnas  then  |mount %sovnas" >&2
  exit 1
fi
if [ ! -f "$HERE/desk/web/index.html" ]; then
  echo "error: the UI isn't built. Run:  (cd ui && npm install && npm run build)" >&2
  exit 1
fi

echo "copying desk into $DESK"
# replace the desk's contents exactly; clay rejects files it has no mark for
find "$DESK" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
( cd "$HERE/desk" && tar --exclude '__pycache__' --exclude '*.pyc' --exclude '.DS_Store' --exclude '._*' -cf - . ) \
  | ( cd "$DESK" && tar -xf - )
# match ownership of the rest of the pier (NativePlanet runs ships as root in docker)
if [ "$(id -u)" = "0" ]; then
  chown -R --reference="$PIER/.urb" "$DESK" 2>/dev/null || true
fi

cat <<EOF

done. Now in the ship's dojo:

  |commit %sovnas
  |install our %sovnas          (first time only)
  :treaty|publish %sovnas       (first time only; makes it installable)

Others can then install it with:

  |install ~$(basename "$PIER") %sovnas

To add host-disk storage on this machine (optional):

  python3 $DESK/daemon/sovnasd.py --install
EOF
