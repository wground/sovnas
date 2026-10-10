#!/bin/bash
# errs.sh <ship> [lines]
#   Show the Hoon-relevant part of a ship's recent log: compile errors
#   with source positions, gall/kiln messages, and %sovnas printfs.
DEV="$(cd "$(dirname "$0")" && pwd)"
N="${2:-400}"
tail -n "$N" "$DEV/ships/$1.log" \
  | grep -E '^/(app|lib|sur|mar)/|nest-fail|mint-|find\.|-find|-need|-have|syntax error|^\{|gall:|kiln:|sovnas|bail|crud|%bad|%nest|lost|failed' \
  | grep -v 'khan-' | awk '!seen[$0]++' | tail -40
