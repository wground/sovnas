::  mar/sovnas/action: mark for sovnas frontend actions
::
/-  sovnas
/+  snv=sovnas
|_  act=action:sovnas
++  grab
  |%
  ++  noun  action:sovnas
  ++  json
    |=  j=^json
    ^-  action:sovnas
    (action-from-json:snv j)
  --
++  grow
  |%
  ++  noun  act
  --
++  grad  %noun
--
