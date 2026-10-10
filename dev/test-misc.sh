#!/bin/bash
# test-misc.sh: public links, trash, search on the in-ship volume
cd "$(dirname "$0")"
Z="python3 api.py zod"; T=testfiles
pass() { echo "PASS $*"; }; fail() { echo "FAIL $*"; }
$Z op '{"op":"link","vol":"ship","path":"/Documents","dir":true,"on":true}' >/dev/null
TOK=$($Z state | python3 -c "import json,sys; print([s['link'] for s in json.load(sys.stdin)['shares'] if s['path']=='/Documents'][0])")
code=$(curl -s -o $T/pub.html -w "%{http_code}" "http://localhost:8081/apps/sovnas/pub/$TOK")
[ "$code" = 200 ] && grep -q "Quarterly Report.pdf" $T/pub.html && pass "public folder page lists files (no login)" || fail "pub page $code"
curl -s -o $T/pub.pdf "http://localhost:8081/apps/sovnas/pub/$TOK?p=/Quarterly%20Report.pdf&f=1"
cmp -s $T/pub.pdf "$T/Quarterly Report.pdf" && pass "public link serves the file without login" || fail "pub file"
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/apps/sovnas/pub/$TOK?p=/../random.bin")
[ "$code" != 200 ] && pass "public link cannot escape its folder ($code)" || fail "pub escape"
$Z op '{"op":"link","vol":"ship","path":"/Documents","on":false}' >/dev/null
code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/apps/sovnas/pub/$TOK")
[ "$code" = 404 ] && pass "turned-off link stops working" || fail "dead link $code"
echo "== trash"
$Z up $T/notes.txt ship /Documents --name trashme.txt >/dev/null
$Z op '{"op":"rm","vol":"ship","path":"/Documents/trashme.txt"}' >/dev/null
ID=$($Z state | python3 -c "import json,sys; print([t['id'] for t in json.load(sys.stdin)['trash'] if t['name']=='trashme.txt'][0])")
$Z op "{\"op\":\"restore\",\"id\":\"$ID\"}" | grep -q '"ok": true' && $Z get ship /Documents/trashme.txt $T/r.txt >/dev/null && cmp -s $T/r.txt $T/notes.txt && pass "restore from trash" || fail "restore"
U0=$($Z state | python3 -c "import json,sys; print(json.load(sys.stdin)['used'])")
$Z up $T/random.bin ship /Documents --name unique-blob.bin >/dev/null
head -c 1048576 /dev/urandom > $T/u.bin; $Z up $T/u.bin ship /Documents --name only-copy.bin >/dev/null
U1=$($Z state | python3 -c "import json,sys; print(json.load(sys.stdin)['used'])")
[ $((U1-U0)) = 1048576 ] && pass "identical upload is deduplicated (only new bytes counted)" || fail "dedup used delta $((U1-U0))"
$Z op '{"op":"rm","vol":"ship","path":"/Documents/only-copy.bin"}' >/dev/null
$Z op '{"op":"empty-trash"}' >/dev/null
U2=$($Z state | python3 -c "import json,sys; print(json.load(sys.stdin)['used'])")
[ $((U1-U2)) -ge 1048576 ] && pass "emptying trash frees space" || fail "purge freed $((U1-U2))"
$Z search ship quarterly | grep -q "Quarterly Report.pdf" && pass "in-ship search" || fail "search"
