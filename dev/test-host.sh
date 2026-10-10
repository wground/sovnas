#!/bin/bash
# test-host.sh: the %host volume via sovnasd, locally and across ships
cd "$(dirname "$0")"
Z="python3 api.py zod"; N="python3 api.py nec"; T=testfiles
pass() { echo "PASS $*"; }; fail() { echo "FAIL $*"; }
same() { [ "$(shasum -a 256 < "$1")" = "$(shasum -a 256 < "$2")" ]; }
$Z op '{"op":"mkdir","vol":"host","path":"/Media"}'
$Z up $T/random.bin host /Media
$Z up "$T/Quarterly Report.pdf" host /Media
[ -f hostdisk/zod/Media/random.bin ] && same hostdisk/zod/Media/random.bin $T/random.bin && pass "upload landed on the host disk byte-exact"
$Z ls host /Media | python3 -c "import json,sys; print('listing', [(e['name'],e['size']) for e in json.load(sys.stdin)['entries']])"
$Z get host /Media/random.bin $T/h.bin
same $T/h.bin $T/random.bin && pass "host-disk download streamed through the ship" || fail "host download"
$Z get host /Media/random.bin $T/hr.bin --range 524000-1600000
cmp <(dd if=$T/random.bin bs=1 skip=524000 count=1076001 2>/dev/null) $T/hr.bin && pass "host range request (spans chunks)" || fail "host range"
$Z op '{"op":"mv","vol":"host","path":"/Media/random.bin","to":"/Media/renamed.bin"}'
[ -f hostdisk/zod/Media/renamed.bin ] && pass "rename on host disk"
$Z search host renamed | grep -q renamed.bin && pass "search on host disk" || fail "search"
$Z op '{"op":"rm","vol":"host","path":"/Media/renamed.bin"}' >/dev/null
ls hostdisk/zod/.sovnas-trash/ | grep -q renamed.bin && pass "delete moves to host trash" || fail "host trash"
echo "== direct LAN transfer (token-gated, bypasses the ship)"
TOK=$($Z state | python3 -c "import json,sys; print(json.load(sys.stdin)['host']['token'])")
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8090/~zod/f?p=/Media/Quarterly%20Report.pdf")
[ "$code" = "403" ] && pass "direct transfer without token refused" || fail "no-token got $code"
curl -s -H "x-sovnas-token: $TOK" "http://localhost:8090/~zod/f?p=/Media/Quarterly%20Report.pdf" -o $T/d.pdf
same $T/d.pdf "$T/Quarterly Report.pdf" && pass "direct download with token"
curl -s -X PUT -H "x-sovnas-token: $TOK" --data-binary @$T/notes.txt "http://localhost:8090/~zod/f?p=/Media&name=direct.txt" >/dev/null
same hostdisk/zod/Media/direct.txt $T/notes.txt && pass "direct upload with token"
echo "== share a host-disk folder with ~nec (no daemon there)"
$Z op '{"op":"share","vol":"host","path":"/Media","with":"~nec","role":"editor","dir":true}' >/dev/null; sleep 1
$N ls host /Media --on '~zod' | python3 -c "import json,sys; d=json.load(sys.stdin); print('nec sees', d.get('role'), [e['name'] for e in d.get('entries',[])])"
$N get host "/Media/Quarterly Report.pdf" $T/n.pdf --on '~zod'
same $T/n.pdf "$T/Quarterly Report.pdf" && pass "~nec read a file off ~zod's host disk over ames" || fail "cross host read"
$N get host /Media/direct.txt $T/n.txt --on '~zod'
same $T/n.txt $T/notes.txt && pass "~nec streamed a 3MB host-disk file" || fail "cross host stream"
$N up $T/random.bin host /Media --on '~zod' --name from-nec.bin
same hostdisk/zod/Media/from-nec.bin $T/random.bin && pass "~nec uploaded onto ~zod's host disk" || fail "cross host upload"
