::  lib/sovnas: helpers for %sovnas
::
/-  sovnas
=,  format
|%
::
::  +parse-json-num: parse a plain decimal cord like '4096' to @ud
::  JSON numbers don't use Hoon's dot-separated format, so we
::  can't use slav %ud or dem:ag.  Manual base-10 accumulator.
::
++  parse-json-num
  |=  t=@t
  ^-  @ud
  =/  tap=tape  (trip t)
  =/  acc=@ud  0
  |-
  ?~  tap  acc
  ?.  &((gte i.tap '0') (lte i.tap '9'))
    acc
  $(tap t.tap, acc (add (mul acc 10) (sub i.tap '0')))
::
::  +num-to-cord: render @ud as a plain decimal cord (no Hoon dots)
::  e.g. 524288000 -> '524288000', not '524.288.000'
::  Required for JSON %n values which must be valid JSON numbers.
::
++  num-to-cord
  |=  n=@ud
  ^-  @t
  ?:  =(0 n)  '0'
  =/  digits=tape  ~
  |-
  ?:  =(0 n)  (crip digits)
  $(n (div n 10), digits [(add '0' (mod n 10)) digits])
::
::  +path-to-cord: convert a hoon path to a cord like '/foo/bar/baz'
::
++  path-to-cord
  |=  p=path
  ^-  @t
  ?~  p  '/'
  =/  segs=(list tape)
    (turn p |=(s=@ta (trip s)))
  %-  crip
  %-  zing
  (turn segs |=(s=tape (weld "/" s)))
::
::  +cord-to-path: parse '/foo/bar/baz' into a hoon path
::
++  cord-to-path
  |=  c=@t
  ^-  path
  =/  t=tape  (trip c)
  ::  strip leading slash
  =/  s=tape  ?~(t ~ ?:(.=(i.t '/') +.t t))
  =/  acc=(list @ta)  ~
  |-
  ?~  s  (flop acc)
  ::  find next '/'
  =/  seg=tape  ~
  =/  rest=tape  s
  |-
  ?~  rest
    ^$(s ~, acc [(crip (flop seg)) acc])
  ?:  .=(i.rest '/')
    ^$(s +.rest, acc [(crip (flop seg)) acc])
  $(rest +.rest, seg [i.rest seg])
::
::  +update-to-json: serialize an update for the frontend
::
++  update-to-json
  |=  u=update:sovnas
  ^-  json
  ?-  -.u
    %dir-list
      %-  pairs:enjs
      :~  :-  'dir-list'
          %-  pairs:enjs
          :~  ['path' s+(path-to-cord path.u)]
              ['entries' [%a (turn entries.u file-entry-to-json)]]
          ==
      ==
    %file-data
      %-  pairs:enjs
      :~  :-  'file-data'
          %-  pairs:enjs
          :~  ['path' s+(path-to-cord path.u)]
              ['data' s+data.u]
              ['mime' s+mime.u]
              ['size' n+(num-to-cord size.u)]
          ==
      ==
    %op-result
      %-  pairs:enjs
      :~  :-  'op-result'
          %-  pairs:enjs
          :~  ['tag' s+tag.u]
              ['success' b+success.u]
              ['msg' s+msg.u]
          ==
      ==
    %config-update
      (frond:enjs 'config-update' (config-to-json config.u))
    %daemon-status
      %-  pairs:enjs
      :~  ['daemon-status' (frond:enjs 'connected' b+connected.u)]
      ==
  ==
::
++  config-to-json
  |=  c=config:sovnas
  ^-  json
  %-  pairs:enjs
  :~  ['root' s+(path-to-cord root.c)]
      ['max-file-size' n+(num-to-cord max-file-size.c)]
      ['connected' b+connected.c]
  ==
::
++  file-entry-to-json
  |=  fe=file-entry:sovnas
  ^-  json
  %-  pairs:enjs
  :~  ['name' s+name.fe]
      ['full-path' s+full-path.fe]
      ['size' n+(num-to-cord size.fe)]
      ::  modified: convert @da to unix seconds
      ['modified' n+(num-to-cord (div (sub modified.fe ~1970.1.1) ~s1))]
      ['is-dir' b+is-dir.fe]
      ['mime' s+mime.fe]
  ==
::
::  +action-from-json: parse incoming JSON poke into action
::
++  action-from-json
  |=  j=json
  ^-  action:sovnas
  ?>  ?=(%o -.j)
  =/  m=(map @t json)  p.j
  ::
  ?:  (~(has by m) 'list-dir')
    =/  inner=json  (~(got by m) 'list-dir')
    ?>  ?=(%o -.inner)
    =/  pth=json  (~(got by p.inner) 'path')
    ?>  ?=(%s -.pth)
    [%list-dir (cord-to-path p.pth)]
  ::
  ?:  (~(has by m) 'upload')
    =/  inner=json  (~(got by m) 'upload')
    ?>  ?=(%o -.inner)
    =/  nm=json   (~(got by p.inner) 'name')
    ?>  ?=(%s -.nm)
    =/  dr=json   (~(got by p.inner) 'dir')
    ?>  ?=(%s -.dr)
    =/  dt=json   (~(got by p.inner) 'data')
    ?>  ?=(%s -.dt)
    [%upload p.nm (cord-to-path p.dr) p.dt]
  ::
  ?:  (~(has by m) 'upload-chunk')
    =/  inner=json  (~(got by m) 'upload-chunk')
    ?>  ?=(%o -.inner)
    =/  nm=json   (~(got by p.inner) 'name')
    ?>  ?=(%s -.nm)
    =/  dr=json   (~(got by p.inner) 'dir')
    ?>  ?=(%s -.dr)
    =/  idx=json  (~(got by p.inner) 'idx')
    ?>  ?=(%n -.idx)
    =/  tot=json  (~(got by p.inner) 'total')
    ?>  ?=(%n -.tot)
    =/  dt=json   (~(got by p.inner) 'data')
    ?>  ?=(%s -.dt)
    [%upload-chunk p.nm (cord-to-path p.dr) (parse-json-num p.idx) (parse-json-num p.tot) p.dt]
  ::
  ?:  (~(has by m) 'download')
    =/  inner=json  (~(got by m) 'download')
    ?>  ?=(%o -.inner)
    =/  pth=json  (~(got by p.inner) 'path')
    ?>  ?=(%s -.pth)
    [%download (cord-to-path p.pth)]
  ::
  ?:  (~(has by m) 'delete')
    =/  inner=json  (~(got by m) 'delete')
    ?>  ?=(%o -.inner)
    =/  pth=json  (~(got by p.inner) 'path')
    ?>  ?=(%s -.pth)
    [%delete (cord-to-path p.pth)]
  ::
  ?:  (~(has by m) 'rename')
    =/  inner=json  (~(got by m) 'rename')
    ?>  ?=(%o -.inner)
    =/  sr=json   (~(got by p.inner) 'src')
    ?>  ?=(%s -.sr)
    =/  ds=json   (~(got by p.inner) 'dst')
    ?>  ?=(%s -.ds)
    [%rename (cord-to-path p.sr) (cord-to-path p.ds)]
  ::
  ?:  (~(has by m) 'mkdir')
    =/  inner=json  (~(got by m) 'mkdir')
    ?>  ?=(%o -.inner)
    =/  pth=json  (~(got by p.inner) 'path')
    ?>  ?=(%s -.pth)
    [%mkdir (cord-to-path p.pth)]
  ::
  ?:  (~(has by m) 'set-config')
    =/  inner=json  (~(got by m) 'set-config')
    ?>  ?=(%o -.inner)
    =/  rt=json   (~(got by p.inner) 'root')
    ?>  ?=(%s -.rt)
    =/  ms=json   (~(gut by p.inner) 'max-file-size' n+'524288000')
    ?>  ?=(%n -.ms)
    [%set-config (cord-to-path p.rt) (parse-json-num p.ms) %.n]
  ::
  !!
::
::  +ipc-command-to-json-cord: serialize IPC command as JSON cord
::
++  ipc-command-to-json-cord
  |=  [id=@ud cmd=ipc-command:sovnas]
  ^-  @t
  =/  cmd-name=@t
    ?-  -.cmd
      %ls    'ls'
      %put   'put'
      %get   'get'
      %rm    'rm'
      %mv    'mv'
      %mk    'mk'
      %stat  'stat'
    ==
  =/  args=json
    ?-  -.cmd
      %ls    (frond:enjs 'dir' s+dir.cmd)
      %put
        %-  pairs:enjs
        :~  ['name' s+name.cmd]
            ['dir' s+dir.cmd]
            ['data' s+data.cmd]
        ==
      %get   (frond:enjs 'path' s+path.cmd)
      %rm    (frond:enjs 'path' s+path.cmd)
      %mv
        %-  pairs:enjs
        :~  ['src' s+src.cmd]
            ['dst' s+dst.cmd]
        ==
      %mk    (frond:enjs 'dir' s+dir.cmd)
      %stat  (frond:enjs 'path' s+path.cmd)
    ==
  %-  en:json:html
  %-  pairs:enjs
  :~  ['id' n+(num-to-cord id)]
      ['cmd' s+cmd-name]
      ['args' args]
  ==
::
::  +ipc-response-from-json: parse daemon JSON response
::
++  ipc-response-from-json
  |=  j=json
  ^-  [id=@ud =ipc-response:sovnas]
  ?>  ?=(%o -.j)
  =/  m=(map @t json)  p.j
  ::
  =/  id-j=json  (~(got by m) 'id')
  ?>  ?=(%n -.id-j)
  =/  id=@ud  (parse-json-num p.id-j)
  ::
  =/  status-j=json  (~(got by m) 'status')
  ?>  ?=(%s -.status-j)
  ::
  ?:  .=('error' p.status-j)
    =/  err-j=json  (~(gut by m) 'error' s+'unknown error')
    ?:  ?=(%s -.err-j)
      [id %err 'op' p.err-j]
    [id %err 'op' 'unknown error']
  ::
  ::  status is 'ok'
  =/  data-j=json  (~(gut by m) 'data' o+~)
  ?.  ?=(%o -.data-j)
    [id %ok 'op' 'ok']
  =/  dm=(map @t json)  p.data-j
  ::
  ?:  (~(has by dm) 'entries')
    =/  dir-j=json  (~(gut by dm) 'dir' s+'/')
    =/  dir-cord=@t  ?:(?=(%s -.dir-j) p.dir-j '/')
    =/  entries-j=json  (~(got by dm) 'entries')
    ?.  ?=(%a -.entries-j)
      [id %ls-result dir-cord ~]
    =/  entries=(list ipc-file-info:sovnas)
      %+  turn  p.entries-j
      |=  e=json
      ^-  ipc-file-info:sovnas
      ?.  ?=(%o -.e)  ['?' 0 0 %.n]
      =/  em=(map @t json)  p.e
      =/  nm-j=json   (~(gut by em) 'name' s+'?')
      =/  sz-j=json   (~(gut by em) 'size' n+'0')
      =/  mod-j=json  (~(gut by em) 'modified' n+'0')
      =/  dir-j=json  (~(gut by em) 'is_dir' b+%.n)
      :^  ?:(?=(%s -.nm-j) p.nm-j '?')
          ?:(?=(%n -.sz-j) (parse-json-num p.sz-j) 0)
          ?:(?=(%n -.mod-j) (parse-json-num p.mod-j) 0)
          ?:(?=(%b -.dir-j) p.dir-j %.n)
    [id %ls-result dir-cord entries]
  ::
  ?:  (~(has by dm) 'data')
    =/  path-j=json  (~(gut by dm) 'path' s+'/')
    =/  path-cord=@t  ?:(?=(%s -.path-j) p.path-j '/')
    =/  data-b64-j=json  (~(got by dm) 'data')
    ?.  ?=(%s -.data-b64-j)
      [id %err 'get' 'bad data in response']
    =/  mime-j=json  (~(gut by dm) 'mime' s+'application/octet-stream')
    =/  size-j=json  (~(gut by dm) 'size' n+'0')
    =/  mime-cord=@t
      ?:(?=(%s -.mime-j) p.mime-j 'application/octet-stream')
    =/  size-val=@ud
      ?:(?=(%n -.size-j) (parse-json-num p.size-j) 0)
    [id %get-result path-cord p.data-b64-j mime-cord size-val]
  ::
  [id %ok 'op' 'ok']
--
