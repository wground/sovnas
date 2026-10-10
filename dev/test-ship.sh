#!/bin/bash
# test-ship.sh <ship>: exercise the %ship (in-ship) volume end to end
set -e
cd "$(dirname "$0")"
S=${1:-zod}
A="python3 api.py $S"
T=testfiles
$A op '{"op":"mkdir","vol":"ship","path":"/Documents"}'
$A up "$T/Quarterly Report.pdf" ship /Documents
$A up $T/random.bin ship /
$A up $T/notes.txt ship /Documents --gz
$A ls ship /Documents
$A get ship /random.bin $T/out.bin
[ "$(shasum -a 256 < $T/out.bin)" = "$(shasum -a 256 < $T/random.bin)" ] && echo "PASS random.bin round-trip is byte-exact"
$A get ship /random.bin $T/part.bin --range 1000-1999
cmp <(dd if=$T/random.bin bs=1 skip=1000 count=1000 2>/dev/null) $T/part.bin && echo "PASS range request bytes match"
$A get ship /Documents/notes.txt $T/notes.out
[ "$(shasum -a 256 < $T/notes.out)" = "$(shasum -a 256 < $T/notes.txt)" ] && echo "PASS gzip-stored text round-trips"
$A state | grep -E '"used"|"blobs"'
