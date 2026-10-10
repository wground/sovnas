::  lib/sovnas: helpers for %sovnas
::
/-  *sovnas
|%
::  +tr: operations on the in-ship file tree
::
++  tr
  |_  t=tree
  ++  dip
    |=  p=pax
    ^-  (unit tree)
    ?~  p  `t
    =/  kid  (~(get by dir.t) i.p)
    ?~  kid  ~
    $(t u.kid, p t.p)
  ::
  ++  get
    |=  p=pax
    ^-  (unit node)
    ?~  p  `[%dir *@da]
    =/  sub  (dip p)
    ?~(sub ~ fil.u.sub)
  ::
  ++  put
    |=  [p=pax n=node]
    ^-  tree
    ?~  p  t(fil `n)
    =/  kid  (~(gut by dir.t) i.p *tree)
    t(dir (~(put by dir.t) i.p $(t kid, p t.p)))
  ::  +graft: place a whole subtree at a path
  ::
  ++  graft
    |=  [p=pax sub=tree]
    ^-  tree
    ?~  p  sub
    =/  kid  (~(gut by dir.t) i.p *tree)
    t(dir (~(put by dir.t) i.p $(t kid, p t.p)))
  ::  +lop: remove a subtree, producing [removed remaining]
  ::
  ++  lop
    |=  p=pax
    ^-  [(unit tree) tree]
    ?~  p  [`t *tree]
    =/  kid  (~(get by dir.t) i.p)
    ?~  kid  [~ t]
    ?~  t.p
      [kid t(dir (~(del by dir.t) i.p))]
    =/  [gon=(unit tree) new=tree]  $(t u.kid, p t.p)
    [gon t(dir (~(put by dir.t) i.p new))]
  ::  +touch: set mod time on every directory along a path
  ::
  ++  touch
    |=  [p=pax now=@da]
    ^-  tree
    =/  fil=(unit node)  fil.t
    =?  fil  !?=([~ %file *] fil)  `[%dir now]
    =.  t  [fil dir.t]
    ?~  p  t
    =/  kid  (~(gut by dir.t) i.p *tree)
    t(dir (~(put by dir.t) i.p $(t kid, p t.p)))
  ::
  ++  ls
    ^-  (list entry)
    %+  turn  ~(tap by dir.t)
    |=  [name=@t sub=tree]
    ^-  entry
    ?~  fil.sub  [name & 0 *@da '']
    ?-  -.u.fil.sub
      %dir   [name & 0 mod.u.fil.sub '']
      %file  =*  m  meta.u.fil.sub
             [name | size.m mod.m mime.m]
    ==
  ::  +files: every file in the tree, with its path
  ::
  ++  files
    ^-  (list [pax meta])
    =|  acc=(list [pax meta])
    =/  stack=(list [pax tree])  ~[[~ t]]
    |-
    ?~  stack  acc
    =/  pre=pax  -.i.stack
    =/  sub=tree  +.i.stack
    =/  f=(unit node)  fil.sub
    =?  acc  ?=([~ %file *] f)  [[pre meta.u.f] acc]
    =/  kids=(list [pax tree])
      %+  turn  ~(tap by dir.sub)
      |=([n=@t k=tree] [(snoc pre n) k])
    $(stack (weld kids t.stack))
  --
::
::  paths
::
++  pax-to-cord
  |=  p=pax
  ^-  @t
  ?~  p  '/'
  (rap 3 (turn p |=(s=@t (cat 3 '/' s))))
::
++  cord-to-pax
  |=  c=@t
  ^-  pax
  %+  skip
    ^-  (list @t)
    %+  turn  (split (trip c) '/')
    crip
  |=(s=@t =('' s))
::
++  split
  |=  [t=tape c=@tD]
  ^-  (list tape)
  =|  cur=tape
  =|  out=(list tape)
  |-
  ?~  t  (flop [(flop cur) out])
  ?:  =(i.t c)  $(t t.t, out [(flop cur) out], cur ~)
  $(t t.t, cur [i.t cur])
::  +good-name: a legal file or folder name
::
++  good-name
  |=  n=@t
  ^-  ?
  ?&  !=('' n)
      !=('.' n)
      !=('..' n)
      (lte (met 3 n) 255)
      ?=(~ (find "/" (trip n)))
      ?=(~ (find [`@`0 ~] (trip n)))
  ==
::
++  good-pax
  |=  p=pax
  ^-  ?
  (levy p good-name)
::
++  is-prefix
  |=  [a=pax b=pax]
  ^-  ?
  =((scag (lent a) b) a)
::
++  last-name
  |=  p=pax
  ^-  @t
  ?~  p  ''
  (rear p)
::
++  parent
  |=  p=pax
  ^-  pax
  ?~  p  ~
  (snip `pax`p)
::  +bump-name: "a.txt" -> "a (1).txt"
::
++  bump-name
  |=  [n=@t i=@ud]
  ^-  @t
  =/  t=tape  (trip n)
  =/  dot=(unit @ud)
    =/  idx  (fand "." t)
    ?~  idx  ~
    =/  l  (rear idx)
    ?:(=(0 l) ~ `l)
  =/  num=tape  " ({(a-co:co i)})"
  ?~  dot  (crip (weld t num))
  (crip :(weld (scag u.dot t) num (slag u.dot t)))
::
::  mime types
::
++  ext-of
  |=  n=@t
  ^-  @t
  =/  t=tape  (cass (trip n))
  =/  idx  (fand "." t)
  ?~  idx  ''
  (crip (slag +((rear idx)) t))
::
++  guess-mime
  |=  n=@t
  ^-  @t
  =/  e  (ext-of n)
  =/  m=(map @t @t)
    %-  malt
    ^-  (list [@t @t])
    :~  ['txt' 'text/plain']  ['md' 'text/markdown']
        ['csv' 'text/csv']  ['tsv' 'text/tab-separated-values']
        ['log' 'text/plain']  ['hoon' 'text/plain']
        ['html' 'text/html']  ['htm' 'text/html']
        ['css' 'text/css']  ['js' 'text/javascript']
        ['mjs' 'text/javascript']  ['ts' 'text/plain']
        ['tsx' 'text/plain']  ['jsx' 'text/plain']
        ['py' 'text/x-python']  ['rs' 'text/plain']
        ['go' 'text/plain']  ['c' 'text/plain']  ['h' 'text/plain']
        ['cpp' 'text/plain']  ['java' 'text/plain']  ['sh' 'text/plain']
        ['json' 'application/json']  ['xml' 'application/xml']
        ['yaml' 'text/yaml']  ['yml' 'text/yaml']  ['toml' 'text/plain']
        ['pdf' 'application/pdf']  ['rtf' 'application/rtf']
        ['png' 'image/png']  ['jpg' 'image/jpeg']  ['jpeg' 'image/jpeg']
        ['gif' 'image/gif']  ['webp' 'image/webp']  ['svg' 'image/svg+xml']
        ['avif' 'image/avif']  ['bmp' 'image/bmp']  ['ico' 'image/x-icon']
        ['heic' 'image/heic']  ['tif' 'image/tiff']  ['tiff' 'image/tiff']
        ['mp3' 'audio/mpeg']  ['wav' 'audio/wav']  ['flac' 'audio/flac']
        ['ogg' 'audio/ogg']  ['m4a' 'audio/mp4']  ['opus' 'audio/opus']
        ['mp4' 'video/mp4']  ['m4v' 'video/mp4']  ['webm' 'video/webm']
        ['mov' 'video/quicktime']  ['mkv' 'video/x-matroska']
        ['zip' 'application/zip']  ['gz' 'application/gzip']
        ['tar' 'application/x-tar']  ['7z' 'application/x-7z-compressed']
        ['doc' 'application/msword']  ['xls' 'application/vnd.ms-excel']
        ['docx' 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        ['xlsx' 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        ['pptx' 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
        ['odt' 'application/vnd.oasis.opendocument.text']
        ['epub' 'application/epub+zip']  ['wasm' 'application/wasm']
    ==
  (~(gut by m) e 'application/octet-stream')
::  +risky-mime: types a browser could execute; never render inline
::
++  risky-mime
  |=  m=@t
  ^-  ?
  =/  t=tape  (cass (trip m))
  ?|  =(t "text/html")
      =(t "application/xhtml+xml")
      =(t "image/svg+xml")
      =(t "application/xml")
      =(t "text/xml")
      =(t "text/javascript")
      =(t "application/javascript")
  ==
::
::  urls
::
::  +parse-url: split a request url into decoded segments and query
::
++  parse-url
  |=  url=@t
  ^-  [segs=(list @t) args=(map @t @t)]
  =/  t=tape  (trip url)
  =/  q=(unit @ud)  (find "?" t)
  =/  pat=tape  ?~(q t (scag u.q t))
  =/  qry=tape  ?~(q ~ (slag +(u.q) t))
  :-  %+  turn
        %+  skip  (split pat '/')
        |=(s=tape =(~ s))
      |=(s=tape (decode s))
  %-  malt
  %+  turn
    %+  skip  (split qry '&')
    |=(s=tape =(~ s))
  |=  kv=tape
  ^-  [@t @t]
  =/  e=(unit @ud)  (find "=" kv)
  ?~  e  [(decode kv) '']
  [(decode (scag u.e kv)) (decode (slag +(u.e) kv))]
::
++  decode
  |=  t=tape
  ^-  @t
  =/  plus  (turn t |=(c=@tD ?:(=('+' c) ' ' c)))
  (crip (fall (de-urlt:html plus) plus))
::
++  encode
  |=  c=@t
  ^-  @t
  (crip (en-urlt:html (trip c)))
::
++  get-hed
  |=  [k=@t hs=header-list:http]
  ^-  (unit @t)
  =/  lk  (crip (cass (trip k)))
  |-
  ?~  hs  ~
  ?:  =(lk (crip (cass (trip key.i.hs))))  `value.i.hs
  $(hs t.hs)
::  +parse-range: "bytes=a-b" against a file size
::
++  parse-range
  |=  [h=(unit @t) size=@ud]
  ^-  (unit [off=@ud len=@ud])
  ?~  h  ~
  =/  r
    %+  rush  u.h
    ;~  pfix  (jest 'bytes=')
      ;~  plug
        (punt dem)
        ;~(pfix hep (punt dem))
      ==
    ==
  ?~  r  ~
  =/  a=(unit @ud)  -.u.r
  =/  b=(unit @ud)  +.u.r
  ?:  =(0 size)  ~
  ?~  a
    ::  suffix range: last b bytes
    ?~  b  ~
    =/  n  (min u.b size)
    `[(sub size n) n]
  ?:  (gte u.a size)  ~
  =/  last  ?~(b (dec size) (min u.b (dec size)))
  ?:  (lth last u.a)  ~
  `[u.a +((sub last u.a))]
::
++  num
  |=  t=@t
  ^-  (unit @ud)
  (rush t dem)
::
++  parse-ship
  |=  t=@t
  ^-  (unit ship)
  ?:  =('' t)  ~
  =/  s  (trip t)
  (slaw %p (crip ?:(=('~' -.s) s ['~' s])))
::
++  parse-vol
  |=  t=@t
  ^-  (unit vol)
  ?:  =('ship' t)  `%ship
  ?:  =('host' t)  `%host
  ~
::
::  json
::
++  unix-ms
  |=  d=@da
  ^-  json
  ?:  (lth d ~1970.1.1)  n+'0'
  (numb:enjs:format (div (mul (sub d ~1970.1.1) 1.000) ~s1))
::
++  from-unix
  |=  s=@ud
  ^-  @da
  (add ~1970.1.1 (mul s ~s1))
::
++  entry-json
  |=  e=entry
  ^-  json
  %-  pairs:enjs:format
  :~  name+s+name.e
      dir+b+dir.e
      size+(numb:enjs:format size.e)
      mod+(unix-ms mod.e)
      mime+s+mime.e
  ==
::
++  loc-json
  |=  l=loc
  ^-  (list [@t json])
  :~  vol+s+vol.l
      path+s+(pax-to-cord pax.l)
  ==
::
++  offer-json
  |=  [host=ship o=offer]
  ^-  json
  %-  pairs:enjs:format
  %+  weld  (loc-json loc.o)
  ^-  (list [@t json])
  :~  host+s+(scot %p host)
      role+s+role.o
      dir+b+dir.o
      name+s+name.o
  ==
::
++  share-json
  |=  [l=loc s=share]
  ^-  json
  %-  pairs:enjs:format
  %+  weld  (loc-json l)
  ^-  (list [@t json])
  :~  dir+b+dir.s
      :-  'who'
      :-  %a
      %+  turn  ~(tap by who.s)
      |=  [w=ship r=role]
      (pairs:enjs:format ~[ship+s+(scot %p w) role+s+r])
    ::
      link+?~(link.s ~ s+u.link.s)
  ==
::
++  role-json
  |=  r=$@(%owner role)
  ^-  json
  s+r
::
++  ok-json
  |=  [ok=? msg=@t]
  ^-  json
  (pairs:enjs:format ~[ok+b+ok msg+s+msg])
::
::  http
::
++  json-octs
  |=  j=json
  ^-  octs
  (as-octs:mimes:html (en:json:html j))
--
