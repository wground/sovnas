#!/bin/bash
# bench.sh "<log2-chunk> <window>" ...: remote streaming throughput, ~zod -> ~nec
cd "$(dirname "$0")"
for cfg in "$@"; do
  read -r c w <<< "$cfg"
  sed -i '' -E "s|^\+\+  chunk    \^~\(\(bex [0-9 ]*\)\)|++  chunk    ^~((bex $c))|; s|^\+\+  window   [0-9 ]*|++  window   $w|" ../desk/app/sovnas.hoon
  grep -qE "^\+\+  chunk    \^~\(\(bex $c\)\)" ../desk/app/sovnas.hoon || { echo "sed failed"; exit 1; }
  n=$(grep -c "reloading %sovnas" ships/nec.log)
  ./sync.sh zod > /tmp/sovnas-sync.out || { cat /tmp/sovnas-sync.out; exit 1; }
  for i in $(seq 1 40); do sleep 2; [ "$(grep -c 'reloading %sovnas' ships/nec.log)" -gt "$n" ] && break; done
  r=$(python3 api.py nec get host /Media/big16.bin testfiles/b.bin --on '~zod' | cut -d' ' -f2-5)
  cmp -s testfiles/b.bin testfiles/big16.bin && ok=exact || ok=CORRUPT
  echo "chunk=2^$c window=$w -> $r $ok"
done
