#!/bin/bash
# check.sh <ship> [file ...]: sync the desk (no install) and compile files,
# printing only the compiler errors produced by this run
DEV="$(cd "$(dirname "$0")" && pwd)"
SHIP="$1"; shift
LOG="$DEV/ships/$SHIP.log"
FILES="${@:-/app/sovnas/hoon}"
DESK=sovdev "$DEV/sync.sh" "$SHIP" >/dev/null || exit 1
for f in $FILES; do
  L0=$(wc -l < "$LOG")
  out=$(python3 "$DEV/shipctl.py" "$DEV/ships/$SHIP" eval "=/(v .^(vase %ca (weld /(scot %p our)/sovdev/(scot %da now) $f)) %ok)" 2>&1)
  if [ "$out" == "'ok'" ]; then echo "ok   $f"; continue; fi
  echo "FAIL $f"
  sleep 0.5
  tail -n +$((L0+1)) "$LOG" | sed -n '1,/^! \/ca/p' \
    | grep -vE '^\s*$|khan|spider|conn:|bail|kiln:|call: failed|thread' \
    | awk '!s[$0]++' | tail -${TAILN:-45}
done
