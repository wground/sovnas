#!/bin/bash
# test-cross.sh: sharing between ~zod (host) and ~nec (guest) over ames
cd "$(dirname "$0")"
Z="python3 api.py zod"; N="python3 api.py nec"; T=testfiles
pass() { echo "PASS $*"; }; fail() { echo "FAIL $*"; }
echo "== unshared file is refused"
$N get ship /random.bin $T/x.bin --on '~zod' | grep -q '^404' && pass "unshared file denied" || fail "unshared file served"
echo "== viewer cannot write"
r=$($N up $T/notes.txt ship /Documents --on '~zod'); echo "$r" | grep -q '"ok": false' && pass "viewer upload denied ($r)" || fail "viewer upload allowed: $r"
echo "== share a folder as editor"
$Z op '{"op":"mkdir","vol":"ship","path":"/Shared"}' >/dev/null
$Z op '{"op":"mv","vol":"ship","path":"/random.bin","to":"/Shared/random.bin"}'
$Z op '{"op":"share","vol":"ship","path":"/Shared","with":"~nec","role":"editor","dir":true}'
sleep 1
$N ls ship /Shared --on '~zod' | python3 -c "import json,sys; d=json.load(sys.stdin); print('listing role', d.get('role'), [e['name'] for e in d.get('entries',[])])"
echo "== 3 MB multi-chunk stream ~zod -> ~nec"
$N get ship /Shared/random.bin $T/x.bin --on '~zod'
[ "$(shasum -a 256 < $T/x.bin)" = "$(shasum -a 256 < $T/random.bin)" ] && pass "3MB remote stream byte-exact" || fail "remote stream corrupt"
$N get ship /Shared/random.bin $T/xr.bin --on '~zod' --range 600000-1700000
cmp <(dd if=$T/random.bin bs=1 skip=600000 count=1100001 2>/dev/null) $T/xr.bin && pass "remote range request" || fail "remote range"
echo "== editor writes into the share"
$N op '{"op":"mkdir","ship":"~zod","vol":"ship","path":"/Shared/From nec"}'
$N up $T/notes.txt ship "/Shared/From nec" --on '~zod' --gz
$Z get ship "/Shared/From nec/notes.txt" $T/y.txt >/dev/null
[ "$(shasum -a 256 < $T/y.txt)" = "$(shasum -a 256 < $T/notes.txt)" ] && pass "remote upload landed on ~zod intact" || fail "remote upload"
$N op '{"op":"rm","ship":"~zod","vol":"ship","path":"/Shared"}' | grep -q '"ok": false' && pass "editor cannot delete the share root" || fail "share root deletable"
$N op '{"op":"rm","ship":"~zod","vol":"ship","path":"/Shared/From nec/notes.txt"}' | grep -q '"ok": true' && pass "editor deletes inside share (goes to ~zod trash)" || fail "editor delete"
$N op '{"op":"mv","ship":"~zod","vol":"ship","path":"/Shared/random.bin","to":"/stolen.bin"}' | grep -q '"ok": false' && pass "cannot move files out of the share" || fail "moved out of share"
echo "== revoke"
$Z op '{"op":"unshare","vol":"ship","path":"/Shared","with":"~nec"}' >/dev/null; sleep 1
$N get ship /Shared/random.bin $T/x.bin --on '~zod' | grep -q '^404' && pass "revoked share denied" || fail "revoked share still served"
$N state | python3 -c "import json,sys; print('nec offers now:', [o['name'] for o in json.load(sys.stdin)['offers']])"
