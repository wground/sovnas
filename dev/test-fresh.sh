#!/bin/bash
# test-fresh.sh: a fresh agent (nuke + revive) must find an already-attached daemon
cd "$(dirname "$0")"
C="python3 shipctl.py ships/zod"
live() { python3 api.py zod state | python3 -c "import json,sys; print(json.load(sys.stdin)['host']['live'])"; }
echo "before: host live = $(live)"
$C dojo nuke sovnas >/dev/null; sleep 2
$C dojo revive sovnas >/dev/null; sleep 4
echo "after nuke + revive (fresh on-init, daemon still connected): host live = $(live)"
