#!/bin/bash
# install-desk.sh — Run this on NativePlanet after scp'ing desk files to /tmp/sovnas-desk/
#
# Usage:
#   sudo -i
#   bash /tmp/install-desk.sh

set -e

# ── Resolve pier path ────────────────────────────────────────────────
# Priority: SOVNAS_PIER env var > sovnas.config.json > error
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIER="${SOVNAS_PIER:-}"

if [ -z "$PIER" ]; then
  # Try to read from config file
  for cfg in "$SCRIPT_DIR/sovnas.config.json" /opt/sovnas/sovnas.config.json; do
    if [ -f "$cfg" ]; then
      PIER="$(python3 -c "import json; print(json.load(open('$cfg'))['ship']['pier'])" 2>/dev/null)"
      if [ -n "$PIER" ]; then
        echo "Using pier from $cfg"
        break
      fi
    fi
  done
fi

if [ -z "$PIER" ]; then
  echo "ERROR: No pier path found. Either:"
  echo "  1. Create sovnas.config.json (copy from sovnas.config.template.json)"
  echo "  2. export SOVNAS_PIER=/media/data/docker/volumes/YOUR-SHIP/_data/YOUR-SHIP"
  exit 1
fi
DESK=$PIER/sovnas

echo "=== SovNAS desk installer ==="

# Verify pier exists
if [ ! -d "$PIER/base" ]; then
  echo "ERROR: $PIER/base not found. Is the pier path correct?"
  exit 1
fi

# Verify desk is mounted
if [ ! -d "$DESK" ]; then
  echo "ERROR: $DESK not found. Run |mount %sovnas in dojo first."
  exit 1
fi

echo "1. Cleaning desk directory..."
rm -rf "$DESK"/*

echo "2. Copying sovnas desk files..."
cp -r /tmp/sovnas-desk/* "$DESK"/

echo "3. Copying minimal base dependencies..."

# libs needed: default-agent, dbug, skeleton
for f in default-agent.hoon dbug.hoon skeleton.hoon server.hoon; do
  if [ -f "$PIER/base/lib/$f" ]; then
    cp "$PIER/base/lib/$f" "$DESK/lib/"
  else
    echo "  WARNING: $PIER/base/lib/$f not found"
  fi
done

# marks needed: core marks + web file type marks
mkdir -p "$DESK/mar/json"
for f in mime.hoon hoon.hoon noun.hoon json.hoon txt.hoon bill.hoon \
         html.hoon htm.hoon js.hoon css.hoon svg.hoon png.hoon woff2.hoon \
         ico.hoon kelvin.hoon; do
  if [ -f "$PIER/base/mar/$f" ]; then
    cp "$PIER/base/mar/$f" "$DESK/mar/"
  fi
done
# json subdirectory marks (if any)
if [ -d "$PIER/base/mar/json" ]; then
  cp -r "$PIER/base/mar/json/" "$DESK/mar/json/"
fi

echo "4. Verifying..."
echo "   sys.kelvin: $(cat $DESK/sys.kelvin)"
echo "   desk.bill:  $(cat $DESK/desk.bill | head -3)"
echo "   agents:     $(ls $DESK/app/)"
echo "   web files:  $(ls $DESK/web/)"

echo ""
echo "=== Done! Now in dojo run: ==="
echo "  |commit %sovnas"
echo "  |install our %sovnas"
echo ""
echo "Then start the daemon:"
echo "  python3 /opt/sovnas/sovnas-daemon.py --pier $PIER --root /home/nativeplanet/sovnas --log-level DEBUG"
