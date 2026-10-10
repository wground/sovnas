#!/bin/bash
# test-xfer.sh: moving files and folders between the in-ship and host volumes
cd "$(dirname "$0")"
Z="python3 api.py zod"; T=testfiles
pass() { echo "PASS $*"; }; fail() { echo "FAIL $*"; }
st() { $Z state | python3 -c "import json,sys; s=json.load(sys.stdin); print($1)"; }
wait_job() {  # wait until job $1 finishes; print its step and msg
  for i in $(seq 1 120); do
    r=$(st "[(j['step'],j['msg']) for j in s['jobs'] if j['id']=='$1'][0]")
    case "$r" in *done*|*fail*) echo "$r"; return;; esac
    sleep 1
  done; echo "timeout"
}
xfer() { $Z op "{\"op\":\"xfer\",\"vol\":\"$1\",\"path\":\"$2\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['msg'] if d['ok'] else 'ERR '+d['msg'])"; }

# start from a clean slate on both volumes
$Z op '{"op":"rm","vol":"ship","path":"/Moves"}' >/dev/null
$Z op '{"op":"rm","vol":"host","path":"/Moves"}' >/dev/null
$Z op '{"op":"empty-trash"}' >/dev/null

echo "== in-ship file -> host disk (gzip-stored, must land decompressed)"
$Z op '{"op":"mkdir","vol":"ship","path":"/Moves"}' >/dev/null
# unique content, so dedup can't keep the blob alive elsewhere
( cat $T/notes.txt; date +%s%N; head -c 64 /dev/urandom | base64 ) > $T/unique.txt
$Z up $T/unique.txt ship /Moves --gz >/dev/null
U0=$(st "s['used']")
id=$(xfer ship /Moves/unique.txt); r=$(wait_job $id)
echo "  job: $r"
cmp -s hostdisk/zod/Moves/unique.txt $T/unique.txt && pass "file landed on the host disk, decompressed and byte-exact" || fail "host copy"
$Z ls ship /Moves | grep -q unique.txt && fail "original still in ship" || pass "original removed from the ship"
U1=$(st "s['used']"); [ "$U1" -lt "$U0" ] && pass "in-ship space freed ($U0 -> $U1)" || fail "space not freed"

echo "== in-ship folder tree -> host disk"
$Z op '{"op":"mkdir","vol":"ship","path":"/Moves/Album"}' >/dev/null
$Z op '{"op":"mkdir","vol":"ship","path":"/Moves/Album/Deep"}' >/dev/null
$Z up $T/random.bin ship /Moves/Album >/dev/null
$Z up "$T/Quarterly Report.pdf" ship /Moves/Album/Deep >/dev/null
$Z op '{"op":"mkdir","vol":"ship","path":"/Moves/Album/Empty"}' >/dev/null
$Z op '{"op":"share","vol":"ship","path":"/Moves/Album","with":"~nec","role":"viewer","dir":true}' >/dev/null
id=$(xfer ship /Moves/Album); r=$(wait_job $id); echo "  job: $r"
cmp -s hostdisk/zod/Moves/Album/random.bin $T/random.bin && cmp -s "hostdisk/zod/Moves/Album/Deep/Quarterly Report.pdf" "$T/Quarterly Report.pdf" && [ -d hostdisk/zod/Moves/Album/Empty ] \
  && pass "folder tree copied (nested files and empty folder)" || fail "tree copy"
st "[ (x['vol'],x['path']) for x in s['shares'] if 'Album' in x['path']]" | grep -q "('host', '/Moves/Album')" && pass "share followed the folder to the host disk" || fail "share did not follow"

echo "== host folder -> back into the ship"
id=$(xfer host /Moves/Album); r=$(wait_job $id); echo "  job: $r"
$Z get ship /Moves/Album/random.bin $T/x1.bin >/dev/null; $Z get ship "/Moves/Album/Deep/Quarterly Report.pdf" $T/x2.pdf >/dev/null
cmp -s $T/x1.bin $T/random.bin && cmp -s $T/x2.pdf "$T/Quarterly Report.pdf" && pass "folder came back into the ship intact" || fail "back copy"
[ ! -e hostdisk/zod/Moves/Album ] && ls hostdisk/zod/.sovnas-trash | grep -q Album && pass "host original moved to the host trash" || fail "host original"
st "[ (x['vol'],x['path']) for x in s['shares'] if 'Album' in x['path']]" | grep -q "('ship', '/Moves/Album')" && pass "share followed it back" || fail "share back"

echo "== name clash: moving onto an existing name renames"
mkdir -p hostdisk/zod/Moves && cp $T/notes.txt "hostdisk/zod/Moves/clash.txt"
$Z up $T/notes.txt ship /Moves --name clash.txt >/dev/null
id=$(xfer ship /Moves/clash.txt); r=$(wait_job $id); echo "  job: $r"
[ -f "hostdisk/zod/Moves/clash (1).txt" ] && pass "clashing name became 'clash (1).txt'" || fail "clash"

echo "== too big for in-ship storage is refused up front"
$Z op '{"op":"settings","maxFile":1048576}' >/dev/null
cp $T/random.bin hostdisk/zod/Moves/big.bin
id=$(xfer host /Moves/big.bin); r=$(wait_job $id); echo "  job: $r"
echo "$r" | grep -q "too large" && [ -f hostdisk/zod/Moves/big.bin ] && pass "refused, original untouched" || fail "big refusal"
$Z op '{"op":"settings","maxFile":67108864}' >/dev/null
