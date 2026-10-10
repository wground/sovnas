#!/bin/bash
# sync.sh <ship> [--install]
#   Push ../desk into the ship's %sovnas desk and commit it.
#   Creates and mounts the desk the first time.  Dev tool only.
set -e
DEV="$(cd "$(dirname "$0")" && pwd)"
SHIP="$1"; shift || true
DESK="${DESK:-sovnas}"
PIER="$DEV/ships/$SHIP"
CTL="python3 $DEV/shipctl.py $PIER"
[ -S "$PIER/.urb/conn.sock" ] || { echo "~$SHIP is not running"; exit 1; }

has_desk=$($CTL eval '(~(has in .^((set desk) %cd /(scot %p our)/base/(scot %da now))) %'"$DESK"')')
if [ "$has_desk" != "0" ]; then
  echo "creating %$DESK on ~$SHIP"
  $CTL run '=/  m  (strand ,vase)
;<  bol=bowl:spider  bind:m  get-bowl
=/  bek  /(scot %p our.bol)/base/(scot %da now.bol)
=/  fs=(list path)
  :~  /mar/noun/hoon  /mar/hoon/hoon  /mar/txt/hoon  /mar/kelvin/hoon
      /sys/kelvin  /mar/bill/hoon  /mar/mime/hoon  /mar/json/hoon
  ==
=/  files=(map path page:clay)
  (malt (turn fs |=(p=path [p [(rear p) .^(* %cx (weld bek p))]])))
;<  ~  bind:m  (send-raw-card [%pass /new-desk %arvo (new-desk:cloy %'"$DESK"' ~ files)])
(pure:m !>(%created))' >/dev/null
  sleep 1
fi
if [ ! -d "$PIER/$DESK" ]; then
  $CTL dojo mount $DESK >/dev/null
  sleep 1
fi
rsync -a --delete --exclude '.DS_Store' --exclude '__pycache__' --exclude '*.pyc' \
  "${SRC:-$DEV/../desk}/" "$PIER/$DESK/"
$CTL dojo commit $DESK >/dev/null
# make sure clay actually took the commit (it rejects files with no mark)
want=$(wc -c < "${SRC:-$DEV/../desk}/app/sovnas.hoon" | tr -d ' ')
for i in 1 2 3 4 5 6 7 8 9 10; do
  got=$($CTL eval '(met 3 .^(@t %cx /(scot %p our)/'"$DESK"'/(scot %da now)/app/sovnas/hoon))' 2>/dev/null)
  [ "$got" = "$want" ] && break
  sleep 1
done
if [ "$got" != "$want" ]; then
  echo "COMMIT FAILED for %$DESK on ~$SHIP (clay has $got bytes of app/sovnas.hoon, want $want)"; exit 1
fi
echo "committed %$DESK on ~$SHIP"
if [ "$1" == "--install" ]; then
  $CTL dojo install sovnas "~$SHIP" sovnas >/dev/null
  echo "installed %sovnas on ~$SHIP"
fi
