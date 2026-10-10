::  app/sovnas: an urbit-native drive
::
::    Files live in one of two volumes: %ship, inside this ship's own
::    state, or %host, a directory on the host disk reached through the
::    sovnasd daemon over %lick.  Every file on every volume has a
::    network address [ship vol path] and is served to other ships over
::    ames with the %sovnas-peer protocol.  The browser talks to this
::    agent over plain HTTP under /apps/sovnas.
::
/-  *sovnas
/+  default-agent, dbug, server, *sovnas
|%
+$  card  card:agent:gall
+$  perm  ?(%owner role)
+$  op    ?(%mkdir %rm %mv)
::  pre-1.0 state, kept only to carry host-disk shares forward
::
+$  old-share  [pof=@t who=(set @p) perm=?(%read %read-write)]
+$  state-1    [%1 * * * * * shares=(map @t old-share) * *]
::  the parts of state-2 that must survive any upgrade
::
+$  durable-2
  $:  %2
      files=tree
      blobs=(map @uvH blob)
      used=@ud
      trash=(map @uv trashed)
      =settings
      host=hostd
      shares=(map loc share)
      links=(map @t loc)
      offers=(map ship (list offer))
      peers=(map ship ?)
      *  *  *  *  *
      nonce=@ud
  ==
+$  durable-3
  $:  %3
      files=tree
      blobs=(map @uvH blob)
      used=@ud
      trash=(map @uv trashed)
      =settings
      host=hostd
      shares=(map loc share)
      links=(map @t loc)
      offers=(map ship (list offer))
      peers=(map ship ?)
      *  *  *  *  *
      nonce=@ud
      =prefs
      *
  ==
::
++  version  '1.1.0'
++  chunk    ^~((bex 22))                         ::  4MiB per message
++  window   3                                    ::  chunks in flight
++  base     `path`/apps/sovnas
--
::
%-  agent:dbug
=|  state-3
=*  state  -
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state  abet:init:cor
    [cards this]
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =^  cards  state  abet:(load:cor old)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ::
  ++  on-leave
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(leave:cor path)
    [cards this]
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state  abet:(arvo:cor wire sign-arvo)
    [cards this]
  ::
  ++  on-peek  peek:cor
  ++  on-fail  on-fail:def
  --
::
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
::
::  +|  lifecycle
::
++  init
  ^+  cor
  =.  settings  [(bex 28) (bex 26) &]
  =.  prefs  [%ship (bex 26)]
  =.  host  [| '' 0 0 '' 0 (new-token %daemon)]
  ::  a daemon may already be attached to the port (a reinstall, or an
  ::  upgrade from 0.x); re-spinning won't tell us, so say hello now
  (emil connect spin hello ~)
::
++  connect  ^-  card  [%pass /eyre/connect %arvo %e %connect [~ base] dap.bowl]
++  spin     ^-  card  [%pass /lick %arvo %l %spin /sovnas]
++  hello
  ^-  card
  [%pass /lick %arvo %l %spit /sovnas %sovnas [%hello (scot %p our.bowl) token.host version]]
::
++  load
  |=  old=vase
  ^+  cor
  =/  ver  -.q.old
  ?:  |(=(%2 ver) =(%3 ver))
    ::  clam the noun rather than trusting the old type; if the shape
    ::  of in-flight bookkeeping changed, keep only durable state
    =.  state
      ^-  state-3
      ?:  =(%3 ver)
        =/  full  (mole |.(;;(state-3 q.old)))
        ?^  full  u.full
        =/  o  ;;(durable-3 q.old)
        %*  .  *state-3
          files  files.o  blobs  blobs.o  used  used.o  trash  trash.o
          settings  settings.o  host  host.o  shares  shares.o
          links  links.o  offers  offers.o  peers  peers.o
          nonce  nonce.o  prefs  prefs.o
        ==
      ::  2 -> 3 adds upload preferences and moves between volumes
      =/  full  (mole |.(;;(state-2 q.old)))
      ?^  full
        =*  o  u.full
        :*  %3  files.o  blobs.o  used.o  trash.o  settings.o  host.o
            shares.o  links.o  offers.o  peers.o  ups.o  waits.o
            serves.o  dpends.o  acks.o  nonce.o  [%ship (bex 26)]  ~
        ==
      =/  o  ;;(durable-2 q.old)
      %*  .  *state-3
        files  files.o  blobs  blobs.o  used  used.o  trash  trash.o
        settings  settings.o  host  host.o  shares  shares.o
        links  links.o  offers  offers.o  peers  peers.o
        nonce  nonce.o  prefs  [%ship (bex 26)]
      ==
    ::  re-probe the daemon; it answers %info if it's still attached
    =.  live.host  |
    (emil connect hello ~)
  ::  migrating from 0.x: start fresh, keep host-disk shares
  ::
  =.  cor  init
  ?.  =(%1 ver)  cor
  =/  o  ;;(state-1 q.old)
  =.  shares
    %-  malt
    %+  turn  ~(tap by shares.o)
    |=  [* s=old-share]
    ^-  [loc share]
    :-  [%host (cord-to-pax pof.s)]
    :+  &
      %-  malt
      %+  turn  ~(tap in who.s)
      |=(w=@p [w ?:(=(%read-write perm.s) %editor %viewer)])
    ~
  ::  tell everyone we share with, so their new agents list it
  =/  ws=(list ship)
    %~  tap  in
    %-  ~(gas in *(set ship))
    (zing (turn ~(val by shares) |=(s=share ~(tap in ~(key by who.s)))))
  |-
  ?~  ws  cor
  $(ws t.ws, cor (send i.ws [%offers (offers-for i.ws)] ~))
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %state ~]  ``json+!>(state-json)
  ==
::
::  +|  dispatch
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark+mark !!)
      %handle-http-request
    =+  !<([rid=@ta req=inbound-request:eyre] vase)
    (handle-http rid req)
  ::
      %sovnas-peer
    (on-peer src.bowl !<(peer vase))
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+    path  ~|(bad-watch+path !!)
      [%http-response @ ~]  cor
      [%updates ~]
    ?>  =(our src):bowl
    (emit %give %fact ~ %json !>(state-update))
  ==
::
++  leave
  |=  =path
  ^+  cor
  ?.  ?=([%http-response @ ~] path)  cor
  =*  rid  i.t.path
  ::  the browser went away; stop anything streaming to it
  ::
  =/  ws  ~(tap by waits)
  =.  cor
    |-
    ?~  ws  cor
    =/  [id=@uv who=ship w=wait]  i.ws
    ?.  &(?=(%dl -.w) =(rid rid.w))  $(ws t.ws)
    =.  waits  (~(del by waits) id)
    $(ws t.ws, cor (send who [%halt id] ~))
  =/  ss  ~(tap by serves)
  |-
  ?~  ss  cor
  ?.  &(?=(%http -.to.q.i.ss) =(rid rid.to.q.i.ss))  $(ss t.ss)
  $(ss t.ss, serves (~(del by serves) p.i.ss))
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+    wire  cor
      [%peer @ ~]
    ?.  ?=(%poke-ack -.sign)  cor
    (on-ack (slav %p i.t.wire) p.sign)
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+    wire  cor
      [%eyre %connect ~]  cor
  ::
      [%lick ~]
    ?.  ?=([%lick %soak *] sign)  cor
    =/  gift  +.sign
    (on-lick mark.gift noun.gift)
  ::
      [%timeout @ @ ~]
    (on-timeout (slav %uv i.t.wire) i.t.t.wire)
  ==
::
::  +|  updates for our own browser
::
++  state-update
  ^-  json
  (pairs:enjs:format ~[type+s+'state' state+state-json])
::
++  give-state
  ^+  cor
  (emit %give %fact ~[/updates] %json !>(state-update))
::
++  give-changed
  |=  [who=ship l=loc]
  ^+  cor
  %-  emit
  :^  %give  %fact  ~[/updates]
  :-  %json
  !>  %-  pairs:enjs:format
      :~  type+s+'changed'
          ship+s+(scot %p who)
          vol+s+vol.l
          path+s+(pax-to-cord pax.l)
      ==
::
++  state-json
  ^-  json
  =/  pub=(unit @p)  publisher
  =,  enjs:format
  %-  pairs
  :~  our+s+(scot %p our.bowl)
      version+s+version
      desk+s+q.byk.bowl
      publisher+?~(pub ~ s+(scot %p u.pub))
      used+(numb used)
      blobs+(numb ~(wyt by blobs))
    ::
      :-  'settings'
      %-  pairs
      :~  quota+(numb quota.settings)
          'maxFile'^(numb max-file.settings)
          compress+b+compress.settings
          default+s+default.prefs
          big+(numb big.prefs)
      ==
    ::
      jobs+a+(turn (sort ~(tap by jobs) |=([a=[@ j=job] b=[@ k=job]] (gth when.j.a when.k.b))) job-json)
    ::
      :-  'host'
      %-  pairs
      :~  live+b+live.host
          root+s+root.host
          free+(numb free.host)
          total+(numb total.host)
          ver+s+ver.host
          port+(numb port.host)
          token+s+token.host
      ==
    ::
      shares+a+(turn ~(tap by shares) share-json)
    ::
      :-  'offers'
      :-  %a
      %-  zing
      %+  turn  ~(tap by offers)
      |=  [h=@p os=(list offer)]
      (turn os |=(o=offer (offer-json h o)))
    ::
      :-  'peers'
      :-  %o
      %-  malt
      %+  turn  ~(tap by peers)
      |=([p=@p k=?] [(scot %p p) b+k])
    ::
      :-  'trash'
      :-  %a
      %+  turn  ~(tap by trash)
      |=  [id=@uv t=trashed]
      %-  pairs
      :~  id+s+(scot %uv id)
          vol+s+vol.loc.t
          path+s+(pax-to-cord pax.loc.t)
          name+s+(last-name pax.loc.t)
          dir+b+?=([~ %dir *] fil.tree.t)
          when+(unix-ms when.t)
      ==
  ==
::  +publisher: the ship this desk is distributed from, per desk.ship
::
++  publisher
  ^-  (unit ship)
  =/  pax=path  /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)/desk/ship
  ?.  .^(? %cu pax)  ~
  `.^(@p %cx pax)
::
::  +|  http
::
++  handle-http
  |=  [rid=@ta req=inbound-request:eyre]
  ^+  cor
  =*  r  request.req
  =/  [segs=(list @t) args=(map @t @t)]  (parse-url url.r)
  ?.  =(base (scag 2 segs))  (respond-text rid 404 'not found')
  =/  rest  (slag 2 segs)
  ?+    rest  (static rid req rest)
      [%api *]
    ::  only the owner's session may use the api
    ?.  authenticated.req
      (respond-json rid 403 (ok-json | 'login required'))
    ?:  ?&  =(%'POST' method.r)
            ?=(~ (get-hed 'x-sovnas' header-list.r))
        ==
      (respond-json rid 403 (ok-json | 'missing x-sovnas header'))
    (api rid r t.rest args)
  ::
      [%pub @ ~]
    (pub rid r i.t.rest args)
  ::
      [%daemon %'sovnasd.py' ~]
    (daemon-script rid)
  ==
::
++  api
  |=  [rid=@ta r=request:http rest=(list @t) args=(map @t @t)]
  ^+  cor
  ?+  rest  (respond-json rid 404 (ok-json | 'no such endpoint'))
    [%state ~]   (respond-json rid 200 state-json)
    [%ls ~]      (api-ls rid args)
    [%file ~]    (api-file rid r args)
    [%upload ~]  (api-upload rid r args)
    [%op ~]      (api-op rid r)
    [%search ~]  (api-search rid args)
  ==
::
++  arg-loc
  |=  args=(map @t @t)
  ^-  (unit [who=ship =loc])
  =/  s  (~(get by args) 's')
  =/  who=(unit ship)  ?~(s `our.bowl (parse-ship u.s))
  ?~  who  ~
  =/  v  (parse-vol (~(gut by args) 'v' 'ship'))
  ?~  v  ~
  =/  p  (cord-to-pax (~(gut by args) 'p' '/'))
  ?.  (good-pax p)  ~
  `[u.who u.v p]
::
++  api-ls
  |=  [rid=@ta args=(map @t @t)]
  ^+  cor
  =/  t  (arg-loc args)
  ?~  t  (respond-json rid 400 (ok-json | 'bad location'))
  =*  l  loc.u.t
  ?.  =(our.bowl who.u.t)
    %^  ask  who.u.t  [%ls rid]
    |=(id=@uv `peer`[%ls id l])
  ?-    vol.l
      %ship
    =/  sub  (~(dip tr files) pax.l)
    ?~  sub  (respond-json rid 404 (ok-json | 'not found'))
    ?:  ?=([~ %file *] fil.u.sub)
      (respond-json rid 400 (ok-json | 'not a folder'))
    (respond-json rid 200 (listing-json %owner ~(ls tr u.sub)))
  ::
      %host
    ?.  live.host  (respond-json rid 503 (ok-json | 'host disk is offline'))
    (dsend [%ls rid] [%ls (pax-to-cord pax.l)])
  ==
::
++  listing-json
  |=  [p=perm ents=(list entry)]
  ^-  json
  %-  pairs:enjs:format
  :~  ok+b+&
      role+s+p
      entries+a+(turn ents entry-json)
  ==
::
++  api-file
  |=  [rid=@ta r=request:http args=(map @t @t)]
  ^+  cor
  =/  t  (arg-loc args)
  ?~  t  (respond-text rid 400 'bad location')
  =*  l  loc.u.t
  =/  dl  =('1' (~(gut by args) 'dl' ''))
  =/  rng  (get-hed 'range' header-list.r)
  =/  name  (last-name pax.l)
  ?:  =(our.bowl who.u.t)
    (serve-local rid l name dl rng)
  =/  [off=@ud lim=(unit @ud)]  (open-range rng)
  %^  ask  who.u.t  [%dl rid name dl ?=(^ rng) 0 0 |]
  |=(id=@uv `peer`[%read id l off (bind lim |=(e=@ud (sub e off)))])
::  +open-range: a range header before we know the file size
::
++  open-range
  |=  h=(unit @t)
  ^-  [@ud (unit @ud)]
  =/  r  (parse-range h (bex 64))
  ?~  r  [0 ~]
  ?:  (gte (add off.u.r len.u.r) (bex 64))  [off.u.r ~]
  [off.u.r `(add off.u.r len.u.r)]
::
++  serve-local
  |=  [rid=@ta l=loc name=@t dl=? rng=(unit @t)]
  ^+  cor
  ?-    vol.l
      %ship
    =/  n  (~(get tr files) pax.l)
    ?.  ?=([~ %file *] n)  (respond-text rid 404 'not found')
    =*  m  meta.u.n
    =/  b  (~(get by blobs) hash.m)
    ?~  b  (respond-text rid 500 'missing blob')
    =/  hed  (file-headers name mime.m dl enc.m)
    =/  r  ?:(?=(%gz enc.m) ~ (parse-range rng stored.m))
    ?~  r
      (give-http rid [200 hed] `dat.u.b)
    =/  piece=octs  [len.u.r (cut 3 [off.u.r len.u.r] q.dat.u.b)]
    %^  give-http  rid
      [206 (snoc hed ['content-range' (content-range off.u.r len.u.r stored.m)])]
    `piece
  ::
      %host
    ?.  live.host  (respond-text rid 503 'host disk is offline')
    =/  [off=@ud lim=(unit @ud)]  (open-range rng)
    =^  id  cor  new-id
    =/  s=serve  [[%http rid] l off lim 0 0 | name dl ?=(^ rng)]
    =.  serves  (~(put by serves) [our.bowl id] s)
    (pump [our.bowl id])
  ==
::
++  content-range
  |=  [off=@ud len=@ud size=@ud]
  ^-  @t
  %:  rap  3
    'bytes '  (crip (a-co:co off))  '-'
    (crip (a-co:co (dec (add off len))))  '/'
    (crip (a-co:co size))  ~
  ==
::
++  file-headers
  |=  [name=@t mime=@t dl=? =enc]
  ^-  header-list:http
  =/  mim  ?:(=('' mime) 'application/octet-stream' mime)
  =/  disp  ?:(|(dl (risky-mime mim)) 'attachment' 'inline')
  =/  hs=header-list:http
    :~  ['content-type' mim]
        ['content-disposition' (rap 3 disp '; filename*=UTF-8\'\'' (encode name) ~)]
        ['x-content-type-options' 'nosniff']
        ['cache-control' 'private, no-cache']
    ==
  ::  user content must never run script on our origin
  =?  hs  !=('application/pdf' mim)
    (snoc hs ['content-security-policy' 'sandbox'])
  ?-  enc
    %gz  (snoc hs ['content-encoding' 'gzip'])
    %id  (snoc hs ['accept-ranges' 'bytes'])
  ==
::
++  api-upload
  |=  [rid=@ta r=request:http args=(map @t @t)]
  ^+  cor
  =/  t  (arg-loc args)
  ?~  t  (respond-json rid 400 (ok-json | 'bad location'))
  =/  name  (~(gut by args) 'name' '')
  =/  id=(unit @uv)  (bind (num (~(gut by args) 'id' '')) |=(n=@ `@uv`n))
  =/  off   (num (~(gut by args) 'off' ''))
  =/  size  (num (~(gut by args) 'size' ''))
  ?.  &(?=(^ id) ?=(^ off) ?=(^ size))
    (respond-json rid 400 (ok-json | 'bad upload parameters'))
  =/  real  (fall (num (~(gut by args) 'real' '')) u.size)
  =/  mime  (~(gut by args) 'mime' '')
  =?  mime  =('' mime)  (guess-mime name)
  =/  =enc  ?:(=('gz' (~(gut by args) 'enc' '')) %gz %id)
  =/  data=octs  (fall body.r [0 0])
  ?:  =(our.bowl who.u.t)
    %:  up-chunk
      [our.bowl u.id]  [%http rid]  loc.u.t  name
      u.off  u.size  real  mime  enc  data
    ==
  ::  relay the chunk to the host ship
  =.  waits  (~(put by waits) u.id [who.u.t [%up rid]])
  =.  cor  (timer u.id rid ~m2)
  %^  send  who.u.t
    [%write u.id loc.u.t name u.off u.size real mime enc data]
  [%up u.id]
::
++  api-search
  |=  [rid=@ta args=(map @t @t)]
  ^+  cor
  =/  q  (crip (cass (trip (~(gut by args) 'q' ''))))
  ?:  =('' q)  (respond-json rid 400 (ok-json | 'empty query'))
  =/  v  (fall (parse-vol (~(gut by args) 'v' 'ship')) %ship)
  ?-    v
      %ship
    (respond-json rid 200 (search-json %ship (ship-search q)))
  ::
      %host
    ?.  live.host  (respond-json rid 503 (ok-json | 'host disk is offline'))
    (dsend [%find rid] [%find '/' q])
  ==
::
++  search-json
  |=  [v=vol hits=(list [pax entry])]
  ^-  json
  %-  pairs:enjs:format
  :~  ok+b+&
      :-  'results'
      :-  %a
      %+  turn  hits
      |=  [p=pax e=entry]
      =/  j  (entry-json e)
      ?>  ?=(%o -.j)
      o+(~(gas by p.j) ~[vol+s+v path+s+(pax-to-cord p)])
  ==
::
++  ship-search
  |=  q=@t
  ^-  (list [pax entry])
  =/  qt  (trip q)
  =/  all=(list [pax entry])
    =|  pre=pax
    =/  t=tree  files
    |-  ^-  (list [pax entry])
    %-  zing
    %+  turn  ~(tap by dir.t)
    |=  [n=@t sub=tree]
    =/  here  (snoc pre n)
    :-  [here (to-entry n fil.sub)]
    ^$(t sub, pre here)
  %+  scag  200
  %+  skim  all
  |=  [p=pax e=entry]
  ?=(^ (find qt (cass (trip name.e))))
::
++  to-entry
  |=  [name=@t fil=(unit node)]
  ^-  entry
  ?~  fil  [name & 0 *@da '']
  ?-  -.u.fil
    %dir   [name & 0 mod.u.fil '']
    %file  [name | size.meta.u.fil mod.meta.u.fil mime.meta.u.fil]
  ==
::
::  +api-op: everything that changes state, as a json post
::
++  api-op
  |=  [rid=@ta r=request:http]
  ^+  cor
  =/  j=(unit json)  ?~(body.r ~ (de:json:html q.u.body.r))
  ?.  ?=([~ %o *] j)  (respond-json rid 400 (ok-json | '(bad-req rid) json'))
  =/  o  p.u.j
  =/  who=ship  (fall (parse-ship (jstr o 'ship')) our.bowl)
  =/  v=vol     (fall (parse-vol (jstr o 'vol')) %ship)
  =/  p=pax     (cord-to-pax (jstr o 'path'))
  =/  l=loc     [v p]
  ?.  (good-pax p)  (respond-json rid 400 (ok-json | '(bad-req rid) path'))
  =/  kind  (jstr o 'op')
  ?:  =('mkdir' kind)  (op-fs rid who %mkdir l ~)
  ?:  =('rm' kind)     (op-fs rid who %rm l ~)
  ?:  =('mv' kind)
    =/  to=pax  (cord-to-pax (jstr o 'to'))
    ?.  (good-pax to)  (bad-req rid)
    (op-fs rid who %mv l `[v to])
  ?:  =('share' kind)
    =/  with  (parse-ship (jstr o 'with'))
    ?:  |(?=(~ with) =(our.bowl u.with))  (bad-req rid)
    =/  =role  ?:(=('editor' (jstr o 'role')) %editor %viewer)
    =/  sh=share  (~(gut by shares) l [(jbool o 'dir') ~ ~])
    =.  shares
      (~(put by shares) l sh(who (~(put by who.sh) u.with role)))
    =.  cor  (send u.with [%offers (offers-for u.with)] ~)
    =.  cor  give-state
    (ok-req rid)
  ?:  =('unshare' kind)
    =/  with  (parse-ship (jstr o 'with'))
    =/  sh  (~(get by shares) l)
    ?:  |(?=(~ with) ?=(~ sh))  (bad-req rid)
    =/  nu  u.sh(who (~(del by who.u.sh) u.with))
    =.  shares
      ?:  &(=(~ who.nu) =(~ link.nu))
        (~(del by shares) l)
      (~(put by shares) l nu)
    =.  cor  (send u.with [%offers (offers-for u.with)] ~)
    =.  cor  give-state
    (ok-req rid)
  ?:  =('link' kind)
    =/  sh=share  (~(gut by shares) l [(jbool o 'dir') ~ ~])
    ?.  (jbool o 'on')
      ?~  link.sh  (ok-req rid)
      =.  links  (~(del by links) u.link.sh)
      =/  nu  sh(link ~)
      =.  shares
        ?:(=(~ who.nu) (~(del by shares) l) (~(put by shares) l nu))
      =.  cor  give-state
      (ok-req rid)
    ?^  link.sh  (ok-req rid)
    =/  tok  (new-token (jam l))
    =.  links  (~(put by links) tok l)
    =.  shares  (~(put by shares) l sh(link `tok))
    =.  cor  give-state
    (ok-req rid)
  ?:  =('settings' kind)
    =/  q  (jnum o 'quota')
    =/  m  (jnum o 'maxFile')
    =?  quota.settings  ?=(^ q)  u.q
    =?  max-file.settings  ?=(^ m)  u.m
    =?  compress.settings  (~(has by o) 'compress')  (jbool o 'compress')
    =/  d  (parse-vol (jstr o 'default'))
    =?  default.prefs  ?=(^ d)  u.d
    =/  b  (jnum o 'big')
    =?  big.prefs  ?=(^ b)  u.b
    =.  cor  give-state
    (ok-req rid)
  ?:  =('hello' kind)
    =.  cor  (send who [%hello ~] ~)
    (ok-req rid)
  ?:  =('xfer' kind)
    ?.  =(our.bowl who)  (bad-req rid)
    (xfer-start rid l)
  ?:  =('dismiss-job' kind)
    =/  id  (slaw %uv (jstr o 'id'))
    ?~  id  (bad-req rid)
    =/  j  (~(get by jobs) u.id)
    ?:  &(?=(^ j) !?=(?(%done %fail) step.u.j))
      (respond-json rid 400 (ok-json | 'still running'))
    =.  jobs  (~(del by jobs) u.id)
    =.  cor  give-state
    (ok-req rid)
  ?:  =('cancel-upload' kind)
    =/  id  (rush (jstr o 'id') dem)
    ?~  id  (bad-req rid)
    =.  ups  (~(del by ups) [our.bowl `@uv`u.id])
    (ok-req rid)
  ?:  =('forget' kind)
    =.  offers  (~(del by offers) who)
    =.  cor  give-state
    (ok-req rid)
  ?:  =('restore' kind)
    =/  id  (slaw %uv (jstr o 'id'))
    ?~  id  (bad-req rid)
    (restore rid u.id)
  ?:  =('purge' kind)
    =/  id  (slaw %uv (jstr o 'id'))
    ?~  id  (bad-req rid)
    =.  cor  (purge u.id)
    =.  cor  give-state
    (ok-req rid)
  ?:  =('empty-trash' kind)
    =/  ids  ~(tap in ~(key by trash))
    |-
    ?~  ids
      =.  cor  give-state
      (ok-req rid)
    $(ids t.ids, cor (purge i.ids))
  (bad-req rid)
::
++  ok-req   |=(rid=@ta (respond-json rid 200 (ok-json & '')))
++  bad-req  |=(rid=@ta (respond-json rid 400 (ok-json | 'bad request')))
::
++  jstr
  |=  [o=(map @t json) k=@t]
  ^-  @t
  =/  v  (~(get by o) k)
  ?.  ?=([~ %s *] v)  ''
  p.u.v
::
++  jbool
  |=  [o=(map @t json) k=@t]
  ^-  ?
  =(`b+& (~(get by o) k))
::
++  jnum
  |=  [o=(map @t json) k=@t]
  ^-  (unit @ud)
  =/  v  (~(get by o) k)
  ?.  ?=([~ %n *] v)  ~
  (rush p.u.v dem)
::
++  op-fs
  |=  [rid=@ta who=ship =op l=loc nu=(unit loc)]
  ^+  cor
  ?:  =(our.bowl who)  (do-op [%http rid] op l nu)
  %^  ask  who  [%op rid]
  |=  id=@uv
  ^-  peer
  ?-  op
    %mkdir  [%mkdir id l]
    %rm     [%rm id l]
    %mv     [%mv id l (need nu)]
  ==
::
::  +|  filesystem operations
::
++  do-op
  |=  [to=dest =op l=loc nu=(unit loc)]
  ^+  cor
  ?:  ?&  ?=(%mv op)
          |(?=(~ nu) !=(vol.l vol.u.nu))
      ==
    (finish to | 'cannot move between volumes')
  ?-    vol.l
      %host
    ?.  live.host  (finish to | 'host disk is offline')
    %+  dsend  [%op to op l nu]
    ?-  op
      %mkdir  [%mkdir (pax-to-cord pax.l)]
      %rm     [%rm (pax-to-cord pax.l)]
      %mv     [%mv (pax-to-cord pax.l) (pax-to-cord pax:(need nu))]
    ==
  ::
      %ship
    ?-    op
        %mkdir
      =/  r  (ship-mkdir pax.l)
      ?:  ?=(%| -.r)  (finish to | p.r)
      =.  files  p.r
      =.  cor  (finish to & (last-name pax.l))
      (give-changed our.bowl [%ship (parent pax.l)])
    ::
        %rm
      ?~  pax.l  (finish to | 'cannot delete the root')
      =/  [gon=(unit tree) rest=tree]  (~(lop tr files) pax.l)
      ?~  gon  (finish to | 'not found')
      =^  tid  cor  new-id
      =.  files  (~(touch tr rest) (parent pax.l) now.bowl)
      =.  trash  (~(put by trash) tid [l u.gon now.bowl])
      =.  cor  (fix-shares op l ~)
      =.  cor  (finish to & (last-name pax.l))
      =.  cor  (give-changed our.bowl [%ship (parent pax.l)])
      give-state
    ::
        %mv
      =/  b  pax:(need nu)
      =/  r  (ship-mv pax.l b)
      ?:  ?=(%| -.r)  (finish to | p.r)
      =.  files  p.r
      =.  cor  (fix-shares op l nu)
      =.  cor  (finish to & (last-name b))
      =.  cor  (give-changed our.bowl [%ship (parent pax.l)])
      (give-changed our.bowl [%ship (parent b)])
    ==
  ==
::
++  ship-mkdir
  |=  p=pax
  ^-  (each tree @t)
  ?~  p  |+'cannot create the root'
  =/  par  (~(get tr files) (parent p))
  ?.  ?=([~ %dir *] par)  |+'parent folder not found'
  ?^  (~(get tr files) p)  |+'already exists'
  &+(~(touch tr (~(put tr files) p [%dir now.bowl])) (parent p) now.bowl)
::
++  ship-mv
  |=  [a=pax b=pax]
  ^-  (each tree @t)
  ?~  a  |+'cannot move the root'
  ?~  b  |+'bad destination'
  ?:  (is-prefix a b)  |+'cannot move a folder into itself'
  ?^  (~(get tr files) b)  |+'destination already exists'
  =/  par  (~(get tr files) (parent b))
  ?.  ?=([~ %dir *] par)  |+'destination folder not found'
  =/  [gon=(unit tree) rest=tree]  (~(lop tr files) a)
  ?~  gon  |+'not found'
  =/  moved  (~(graft tr rest) b u.gon)
  =.  moved  (~(touch tr moved) (parent a) now.bowl)
  &+(~(touch tr moved) (parent b) now.bowl)
::
++  unique-name
  |=  [dir=pax n=@t]
  ^-  @t
  =/  i  1
  =/  c  n
  |-
  ?~  (~(get tr files) (snoc dir c))  c
  $(i +(i), c (bump-name n i))
::  +fix-shares: keep shares attached to things that moved or vanished
::
++  fix-shares
  |=  [=op l=loc nu=(unit loc)]
  ^+  cor
  ?:  ?=(%mkdir op)  cor
  =/  hit=(list [loc share])
    %+  skim  ~(tap by shares)
    |=([k=loc *] &(=(vol.k vol.l) (is-prefix pax.l pax.k)))
  ?:  =(~ hit)  cor
  =|  who=(set ship)
  |-
  ?~  hit
    =/  ws  ~(tap in who)
    =.  cor  give-state
    |-
    ?~  ws  cor
    $(ws t.ws, cor (send i.ws [%offers (offers-for i.ws)] ~))
  =/  [k=loc s=share]  i.hit
  =.  shares  (~(del by shares) k)
  =?  links  ?=(^ link.s)  (~(del by links) u.link.s)
  =.  who  (~(gas in who) ~(tap in ~(key by who.s)))
  ?.  &(?=(%mv op) ?=(^ nu))
    $(hit t.hit)
  =/  k2=loc  [vol.u.nu (weld pax.u.nu (slag (lent pax.l) pax.k))]
  =.  shares  (~(put by shares) k2 s)
  =?  links  ?=(^ link.s)  (~(put by links) u.link.s k2)
  $(hit t.hit)
::
++  restore
  |=  [rid=@ta id=@uv]
  ^+  cor
  =/  t  (~(get by trash) id)
  ?~  t  (respond-json rid 404 (ok-json | 'not in trash'))
  =/  dir=pax  (parent pax.loc.u.t)
  =?  dir  !?=([~ %dir *] (~(get tr files) dir))  ~
  =/  name  (unique-name dir (last-name pax.loc.u.t))
  =.  files  (~(touch tr (~(graft tr files) (snoc dir name) tree.u.t)) dir now.bowl)
  =.  trash  (~(del by trash) id)
  =.  cor  (give-changed our.bowl [%ship dir])
  =.  cor  give-state
  (respond-json rid 200 (ok-json & name))
::
++  purge
  |=  id=@uv
  ^+  cor
  =/  t  (~(get by trash) id)
  ?~  t  cor
  =.  trash  (~(del by trash) id)
  (release tree.u.t)
::  +release: drop a tree's claim on its blobs, freeing unshared ones
::
++  release
  |=  t=tree
  ^+  cor
  =/  fs  ~(files tr t)
  |-
  ?~  fs  cor
  =/  h  hash.+.i.fs
  =/  b  (~(get by blobs) h)
  ?~  b  $(fs t.fs)
  ?:  (lte refs.u.b 1)
    $(fs t.fs, blobs (~(del by blobs) h), used (sub used (min used p.dat.u.b)))
  $(fs t.fs, blobs (~(put by blobs) h u.b(refs (dec refs.u.b))))
::
::
::  +|  moving between volumes
::
::    A job moves a file or folder to the same place on the other
::    volume: it plans the work, makes the destination folders, copies
::    one file at a time (4MiB per daemon request), and only deletes
::    the original once everything has been copied.  Shares follow.
::
++  other  |=(v=vol ^-(vol ?:(?=(%ship v) %host %ship)))
::  +jobs-ok: sovnasd 1.1 added the requests that moves need
::
++  jobs-ok
  ^-  ?
  =/  v  (rush ver.host ;~(plug dem ;~(pfix dot dem) ;~(pfix dot dem)))
  ?~  v  |
  |((gth -.u.v 1) &(=(1 -.u.v) (gte +<.u.v 1)))
::
++  job-json
  |=  [id=@uv j=job]
  ^-  json
  =,  enjs:format
  =/  prog  ?~(cur.j done.j (min total.j (add done.j off.u.cur.j)))
  %-  pairs
  :~  id+s+(scot %uv id)
      from+(pairs (loc-json from.j))
      to+(pairs (loc-json [vol.to.j ?~(root.j pax.to.j root.j)]))
      name+s+name.j
      dir+b+dir.j
      done+(numb prog)
      total+(numb total.j)
      step+s+step.j
      msg+s+msg.j
      when+(unix-ms when.j)
  ==
::
++  give-job
  |=  id=@uv
  ^+  cor
  =/  j  (~(get by jobs) id)
  ?~  j  cor
  %-  emit
  [%give %fact ~[/updates] %json !>((pairs:enjs:format ~[type+s+'job' job+(job-json id u.j)]))]
::  +tree-items: everything in a folder, parents before children
::
++  tree-items
  |=  t=tree
  ^-  (list item)
  =|  out=(list item)
  =/  stack=(list [pax tree])
    (turn ~(tap by dir.t) |=([n=@t k=tree] [~[n] k]))
  |-
  ?~  stack  (flop out)
  =/  p=pax  -.i.stack
  =/  sub=tree  +.i.stack
  =/  f=(unit node)  fil.sub
  =/  it=item
    ?:  ?=([~ %file *] f)  [p | stored.meta.u.f]
    [p & 0]
  =/  kids=(list [pax tree])
    ?.  dir.it  ~
    (turn ~(tap by dir.sub) |=([n=@t k=tree] [(snoc p n) k]))
  $(stack (weld kids t.stack), out [it out])
::  +ship-mkdirs: make every missing folder along a path
::
++  ship-mkdirs
  |=  p=pax
  ^-  (each tree @t)
  =/  t  files
  =|  pre=pax
  |-
  ?~  p  &+t
  =/  here  (snoc pre i.p)
  =/  n  (~(get tr t) here)
  ?:  ?=([~ %file *] n)  |+(rap 3 (pax-to-cord here) ' is a file' ~)
  =?  t  ?=(~ n)  (~(touch tr (~(put tr t) here [%dir now.bowl])) pre now.bowl)
  $(p t.p, pre here)
::
++  xfer-start
  |=  [rid=@ta l=loc]
  ^+  cor
  ?~  pax.l  (respond-json rid 400 (ok-json | 'cannot move the whole drive'))
  ?.  live.host  (respond-json rid 503 (ok-json | 'host disk is offline'))
  ?.  jobs-ok
    (respond-json rid 400 (ok-json | 'update sovnasd on your host to 1.1 or newer to move files between volumes'))
  =^  id  cor  new-id
  =/  j=job
    :*  l  [(other vol.l) (parent pax.l)]  (last-name pax.l)  |  ~  ~  ~
        0  0  %walk  ''  now.bowl
    ==
  ?-    vol.l
      %host
    =.  jobs  (~(put by jobs) id j)
    =.  cor  (respond-json rid 200 (ok-json & (scot %uv id)))
    =.  cor  give-state
    (job-ask id %walk [%walk (pax-to-cord pax.l)])
  ::
      %ship
    =/  sub  (~(dip tr files) pax.l)
    ?~  sub  (respond-json rid 404 (ok-json | 'not found'))
    =/  n=(unit node)  fil.u.sub
    ?~  n  (respond-json rid 404 (ok-json | 'not found'))
    =/  dir=?  ?=(%dir -.u.n)
    =/  todo=(list item)
      ?.  ?=(%file -.u.n)  (tree-items u.sub)
      ~[[~ | stored.meta.u.n]]
    =/  total  (roll (turn todo |=(i=item size.i)) add)
    =.  jobs  (~(put by jobs) id j(dir dir, todo todo, total total))
    =.  cor  (respond-json rid 200 (ok-json & (scot %uv id)))
    =.  cor  give-state
    (job-prepare id)
  ==
::
++  job-ask
  |=  [id=@uv =jstep r=dreq]
  ^+  cor
  =.  jobs  (~(jab by jobs) id |=(j=job j(step jstep)))
  (dsend [%job id] r)
::
++  job-fail
  |=  [id=@uv msg=@t]
  ^+  cor
  ?.  (~(has by jobs) id)  cor
  =.  jobs  (~(jab by jobs) id |=(j=job j(step %fail, msg msg, cur ~)))
  give-state
::  +job-prepare: make sure the destination folder exists
::
++  job-prepare
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  ?-    vol.to.j
      %host  (job-ask id %mkdirs [%mkdirs (pax-to-cord pax.to.j)])
      %ship
    =/  r  (ship-mkdirs pax.to.j)
    ?:  ?=(%| -.r)  (job-fail id p.r)
    =.  files  p.r
    (job-root id)
  ==
::  +job-root: decide where the item lands, renaming if the name's taken
::
++  job-root
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  ?-    vol.to.j
      %ship
    =/  root  (snoc pax.to.j (unique-name pax.to.j name.j))
    =?  files  dir.j
      (~(touch tr (~(put tr files) root [%dir now.bowl])) pax.to.j now.bowl)
    =.  jobs  (~(put by jobs) id j(root root))
    (job-next id)
  ::
      %host
    ?.  dir.j
      ::  a lone file is renamed, if need be, as its write completes
      =.  jobs  (~(put by jobs) id j(root (snoc pax.to.j name.j)))
      (job-next id)
    (job-ask id %mkdu [%mkdu (pax-to-cord (snoc pax.to.j name.j))])
  ==
::
++  job-next
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  ?~  todo.j  (job-clean id)
  =/  it  i.todo.j
  =/  j=job  j(todo t.todo.j)
  =/  dst=pax  (weld root.j rel.it)
  ?.  dir.it
    =.  jobs  (~(put by jobs) id j(cur `[it 0 '' ~]))
    ?-  vol.to.j
      %host  (job-send id)
      %ship  (job-fetch id)
    ==
  ?-    vol.to.j
      %host
    =.  jobs  (~(put by jobs) id j)
    (job-ask id %mkdir [%mkdir (pax-to-cord dst)])
  ::
      %ship
    =/  r  (ship-mkdirs dst)
    ?:  ?=(%| -.r)  (job-fail id p.r)
    =.  files  p.r
    =.  jobs  (~(put by jobs) id j)
    $
  ==
::  +job-send: write the next chunk of an in-ship file to the host disk
::
++  job-send
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  ?~  cur.j  cor
  =/  c  u.cur.j
  =/  src=pax  (weld pax.from.j rel.item.c)
  =/  n  (~(get tr files) src)
  ?.  ?=([~ %file *] n)
    (job-fail id (rap 3 (pax-to-cord src) ' changed during the move' ~))
  =/  m  meta.u.n
  =/  b  (~(get by blobs) hash.m)
  ?~  b  (job-fail id 'missing blob')
  =/  len  (min chunk (sub stored.m (min stored.m off.c)))
  =/  piece=octs  [len (cut 3 [off.c len] q.dat.u.b)]
  =/  dst=@t  (pax-to-cord (weld root.j rel.item.c))
  =/  tmp  (rap 3 '.sovnas-up-' (scot %uv (end [3 6] (sham id rel.item.c))) ~)
  =.  jobs  (~(put by jobs) id j(cur `c(off (add off.c len))))
  =.  cor  (give-job id)
  %^  job-ask  id  %write
  ::  gzipped in-ship files land on disk as the real thing
  ?:  ?=(%gz enc.m)
    [%wgz dst tmp off.c piece stored.m]
  [%write dst tmp off.c piece stored.m]
::  +job-fetch: read the next chunk of a host-disk file into the ship
::
++  job-fetch
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  ?~  cur.j  cor
  =/  c  u.cur.j
  =.  cor  (give-job id)
  %^  job-ask  id  %read
  [%read (pax-to-cord (weld pax.from.j rel.item.c)) off.c chunk]
::  +job-res: the daemon finished what the job asked for
::
++  job-res
  |=  [id=@uv body=*]
  ^+  cor
  =/  jo  (~(get by jobs) id)
  ?~  jo  cor
  =/  j  u.jo
  ?+    step.j  cor
      %walk
    ::  [rel dir size mod mime]; a lone file comes back with rel ''
    =/  ents  ;;((list [@t ? @ud @ud @t]) body)
    =/  dir=?  !(lien ents |=([r=@t *] =('' r)))
    =/  todo=(list item)
      %+  turn  ents
      |=([r=@t d=? z=@ud *] `item`[(cord-to-pax r) d z])
    =/  total  (roll (turn todo |=(i=item size.i)) add)
    =/  big  (skim todo |=(i=item &(!dir.i (gth size.i max-file.settings))))
    ?^  big
      %+  job-fail  id
      (rap 3 (last-name (weld pax.from.j rel.i.big)) ' is too large for in-ship storage' ~)
    ?:  (gth (add used total) quota.settings)
      (job-fail id 'not enough in-ship storage left; raise the limit in Settings')
    =.  jobs  (~(put by jobs) id j(dir dir, todo todo, total total))
    =.  cor  give-state
    (job-prepare id)
  ::
      %mkdirs  (job-root id)
      %mkdir   (job-next id)
      %rm      (job-done id)
  ::
      %mkdu
    =.  jobs  (~(put by jobs) id j(root (snoc pax.to.j ;;(@t body))))
    (job-next id)
  ::
      %write
    =/  res  ;;([done=? fp=@t] body)
    ?~  cur.j  cor
    ?.  done.res  (job-send id)
    =?  root.j  =(~ rel.item.u.cur.j)  (cord-to-pax fp.res)
    =.  jobs  (~(put by jobs) id j(cur ~, done (add done.j size.item.u.cur.j)))
    (job-next id)
  ::
      %read
    =/  res  ;;([size=@ud mime=@t mod=@ud off=@ud data=octs] body)
    ?~  cur.j  cor
    =/  c  u.cur.j
    ?:  (gth size.res max-file.settings)
      (job-fail id (rap 3 (last-name pax.from.j) ' is too large for in-ship storage' ~))
    =/  got  (add off.c p.data.res)
    =.  c  c(off got, mime mime.res, parts (~(put by parts.c) off.c data.res))
    =.  item.c  item.c(size size.res)
    ?:  &((lth got size.res) !=(0 p.data.res))
      =.  jobs  (~(put by jobs) id j(cur `c))
      (job-fetch id)
    ?:  (gth (add used size.res) quota.settings)
      (job-fail id 'not enough in-ship storage left; raise the limit in Settings')
    ::  the whole file is here; store it
    =/  ps  (sort ~(tap by parts.c) |=([a=[@ud *] b=[@ud *]] (lth -.a -.b)))
    =/  dat=octs  [size.res (can 3 (turn ps tail))]
    =/  hash=@uvH  (shay p.dat q.dat)
    =/  old  (~(get by blobs) hash)
    =.  blobs  (~(put by blobs) hash ?~(old [1 dat] u.old(refs +(refs.u.old))))
    =?  used  ?=(~ old)  (add used p.dat)
    =/  dst=pax  (weld root.j rel.item.c)
    =/  mim  ?:(=('' mime.c) (guess-mime (last-name dst)) mime.c)
    =/  m=meta  [size.res mim now.bowl %id hash size.res]
    =.  files  (~(touch tr (~(put tr files) dst [%file m])) (parent dst) now.bowl)
    =.  jobs  (~(put by jobs) id j(cur ~, done (add done.j size.res)))
    (job-next id)
  ==
::  +job-clean: everything is copied; now remove the original
::
++  job-clean
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  =.  cor  (fix-shares %mv from.j `[vol.to.j root.j])
  ?-    vol.from.j
      %host  (job-ask id %rm [%rm (pax-to-cord pax.from.j)])
      %ship
    =/  [gon=(unit tree) rest=tree]  (~(lop tr files) pax.from.j)
    =.  files  (~(touch tr rest) (parent pax.from.j) now.bowl)
    =?  cor  ?=(^ gon)  (release u.gon)
    (job-done id)
  ==
::
++  job-done
  |=  id=@uv
  ^+  cor
  =/  j  (~(got by jobs) id)
  =.  jobs  (~(put by jobs) id j(step %done, cur ~, done total.j))
  =.  cor  (give-changed our.bowl [vol.from.j (parent pax.from.j)])
  =.  cor  (give-changed our.bowl [vol.to.j (parent root.j)])
  give-state
::
::  +|  uploads
::
++  up-chunk
  |=  $:  key=[ship @uv]  to=dest  l=loc  name=@t
          off=@ud  size=@ud  real=@ud  mime=@t  =enc  data=octs
      ==
  ^+  cor
  ?.  (good-name name)  (finish to | 'bad file name')
  ?:  (gth (add off p.data) size)  (finish to | 'chunk past end of file')
  ?-    vol.l
      %host
    ?.  live.host  (finish to | 'host disk is offline')
    =/  tmp  (rap 3 '.sovnas-up-' (scot %uv (end [3 6] (sham key))) ~)
    %+  dsend  [%write key to =(size (add off p.data))]
    [%write (pax-to-cord (snoc pax.l name)) tmp off data size]
  ::
      %ship
    =/  u=(unit upload)  (~(get by ups) key)
    ?~  u
      ?.  =(0 off)  (finish to | 'upload not started')
      ?:  (gth size max-file.settings)
        (finish to | 'file too large for in-ship storage')
      ?:  (gth (add used size) quota.settings)
        (finish to | 'in-ship storage is full')
      ?.  ?=([~ %dir *] (~(get tr files) pax.l))
        (finish to | 'folder not found')
      $(ups (~(put by ups) key [l name size real mime enc 0 ~ '']))
    =/  up  u.u
    ?.  =(off got.up)
      =.  ups  (~(del by ups) key)
      (finish to | 'chunk out of order')
    =.  up  up(got (add got.up p.data), parts (~(put by parts.up) off data))
    ?.  =(got.up size.up)
      =.  ups  (~(put by ups) key up)
      (finish to & '')
    =.  ups  (~(del by ups) key)
    (commit-ship to up)
  ==
::
++  commit-ship
  |=  [to=dest up=upload]
  ^+  cor
  =/  ps  (sort ~(tap by parts.up) |=([a=[@ud *] b=[@ud *]] (lth -.a -.b)))
  =/  dat=octs  [size.up (can 3 (turn ps tail))]
  =/  hash=@uvH  (shay p.dat q.dat)
  =/  old  (~(get by blobs) hash)
  =.  blobs
    %+  ~(put by blobs)  hash
    ?~(old [1 dat] u.old(refs +(refs.u.old)))
  =?  used  ?=(~ old)  (add used p.dat)
  =/  dir  pax.loc.up
  =/  name  (unique-name dir name.up)
  =/  m=meta  [real.up mime.up now.bowl enc.up hash size.up]
  =.  files  (~(touch tr (~(put tr files) (snoc dir name) [%file m])) dir now.bowl)
  =.  cor  (finish to & name)
  =.  cor  (give-changed our.bowl loc.up)
  give-state
::
::  +|  streaming files out
::
::  +pump: keep a stream's window full.  For the %host volume the
::  first read also tells us the file size, so we wait for it.
::
++  pump
  |=  key=[ship @uv]
  ^+  cor
  =/  s  (~(get by serves) key)
  ?~  s  cor
  =/  s  u.s
  ?:  &(!started.s (gth out.s 0))  cor
  ?:  &(started.s (gte off.s end.s))
    ?:  (gth out.s 0)  cor
    (stream-done key s)
  ?:  (gte out.s window)  cor
  =/  cap  ?.(started.s ?~(lim.s off.s u.lim.s) end.s)
  =/  len  ?:(&(!started.s ?=(~ lim.s)) chunk (min chunk (sub (max cap off.s) off.s)))
  ?-    vol.loc.s
      %host
    =.  serves  (~(put by serves) key s(off (add off.s len), out +(out.s)))
    =.  cor  (dsend [%read key] [%read (pax-to-cord pax.loc.s) off.s len])
    ?.  started.s  cor
    $
  ::
      %ship
    =/  n  (~(get tr files) pax.loc.s)
    ?.  ?=([~ %file *] n)  (abort-stream key s 'file is gone')
    =/  b  (~(get by blobs) hash.meta.u.n)
    ?~  b  (abort-stream key s 'missing blob')
    =/  piece=octs  [len (cut 3 [off.s len] q.dat.u.b)]
    =.  serves  (~(put by serves) key s(off (add off.s len), out +(out.s)))
    =.  cor  (send-piece s off.s piece)
    $
  ==
::
++  send-piece
  |=  [s=serve off=@ud piece=octs]
  ^+  cor
  ?-  -.to.s
    %peer  (send ship.to.s [%data id.to.s off piece] [%serve id.to.s])
    %http  (emit %give %fact ~[/http-response/[rid.to.s]] %http-response-data !>(`piece))
  ==
::
++  stream-done
  |=  [key=[ship @uv] s=serve]
  ^+  cor
  =.  serves  (~(del by serves) key)
  ?-  -.to.s
    %peer  cor
    %http  (kick-http rid.to.s)
  ==
::
++  abort-stream
  |=  [key=[ship @uv] s=serve msg=@t]
  ^+  cor
  =.  serves  (~(del by serves) key)
  ?-    -.to.s
      %peer  (send ship.to.s [%result id.to.s | msg] ~)
      %http
    ?:  started.s  (kick-http rid.to.s)
    (respond-text rid.to.s 404 msg)
  ==
::
++  serve-ack
  |=  [key=[ship @uv] err=(unit tang)]
  ^+  cor
  =/  s  (~(get by serves) key)
  ?~  s  cor
  ?^  err  cor(serves (~(del by serves) key))
  =.  serves  (~(put by serves) key u.s(out ?:(=(0 out.u.s) 0 (dec out.u.s))))
  (pump key)
::  +got-read: the daemon produced a chunk of a %host file.  The first
::  chunk also carries the file size, which lets us send headers.
::
++  got-read
  |=  [key=[ship @uv] body=*]
  ^+  cor
  =/  s  (~(get by serves) key)
  ?~  s  cor
  =/  s  u.s
  =+  ;;([size=@ud mime=@t mod=@ud off=@ud data=octs] body)
  =?  mime  =('' mime)  (guess-mime name.s)
  ?:  started.s  (deliver key s off data)
  =/  end  ?~(lim.s size (min size u.lim.s))
  ?:  &((gte off end) !=(0 size))
    (abort-stream key s 'range not satisfiable')
  =.  s  s(end end, started &)
  =.  serves  (~(put by serves) key s)
  =.  cor  (start-stream s off size mime (from-unix mod))
  (deliver key s off data)
::
++  deliver
  |=  [key=[ship @uv] s=serve off=@ud data=octs]
  ^+  cor
  =/  n  (min p.data (sub end.s (min end.s off)))
  =/  piece=octs  [n (end [3 n] q.data)]
  ::  a peer stream's slot frees up when the peer acks the data
  ?:  &(?=(%peer -.to.s) !=(0 n))
    (send-piece s off piece)
  =?  cor  !=(0 n)  (send-piece s off piece)
  =.  serves  (~(put by serves) key s(out ?:(=(0 out.s) 0 (dec out.s))))
  (pump key)
::
::  +start-stream: headers for a stream.  No content-length: vere
::  replaces it with the size of the (empty) first frame.
::
++  start-stream
  |=  [s=serve off=@ud size=@ud mime=@t mod=@da]
  ^+  cor
  =/  len  (sub end.s (min end.s off))
  ?-    -.to.s
      %peer
    (send ship.to.s [%head id.to.s size mime %id mod off len] ~)
  ::
      %http
    =/  hed  (file-headers name.s mime dl.s %id)
    =/  code  ?:(partial.s 206 200)
    =?  hed  &(partial.s !=(0 len))
      (snoc hed ['content-range' (content-range off len size)])
    (emit %give %fact ~[/http-response/[rid.to.s]] %http-response-header !>([code hed]))
  ==
::
::
::  +|  peers
::
++  send
  |=  [who=ship msg=peer tag=atag]
  ^+  cor
  =.  acks  (~(put by acks) who (~(put to (~(gut by acks) who ~)) tag))
  %-  emit
  [%pass /peer/(scot %p who) %agent [who dap.bowl] %poke %sovnas-peer !>(msg)]
::
++  on-ack
  |=  [who=ship err=(unit tang)]
  ^+  cor
  =/  had  (~(get by peers) who)
  =.  peers  (~(put by peers) who =(~ err))
  =?  cor  !=(had `=(~ err))  give-state
  =/  q  (~(gut by acks) who ~)
  ?:  =(~ q)  cor
  =/  nx  ~(get to q)
  =/  tag=atag  p.nx
  =.  acks  (~(put by acks) who q.nx)
  ?~  tag  cor
  ?-  -.tag
    %serve  (serve-ack [who id.tag] err)
    %up     (up-ack id.tag err)
  ==
::
++  up-ack
  |=  [id=@uv err=(unit tang)]
  ^+  cor
  ?~  err  cor
  =/  w  (~(get by waits) id)
  ?~  w  cor
  ?.  ?=(%up -.wait.u.w)  cor
  =.  waits  (~(del by waits) id)
  (respond-json rid.wait.u.w 502 (ok-json | 'the remote ship rejected the upload'))
::
::  +ask: send a request to another ship and remember who's waiting
::
++  ask
  |=  [who=ship w=wait mk=$-(@uv peer)]
  ^+  cor
  =^  id  cor  new-id
  =.  waits  (~(put by waits) id [who w])
  =.  cor  (timer id (wait-rid w) ?:(?=(%dl -.w) ~m2 ~s45))
  (send who (mk id) ~)
::
++  wait-rid
  |=  w=wait
  ^-  @ta
  ?-  -.w
    %ls  rid.w
    %op  rid.w
    %dl  rid.w
    %up  rid.w
  ==
::
++  timer
  |=  [id=@uv rid=@ta d=@dr]
  ^+  cor
  (emit %pass /timeout/(scot %uv id)/[rid] %arvo %b %wait (add now.bowl d))
::
++  on-timeout
  |=  [id=@uv rid=@ta]
  ^+  cor
  =/  w  (~(get by waits) id)
  ?~  w  cor
  ?.  =(rid (wait-rid wait.u.w))  cor
  ?:  &(?=(%dl -.wait.u.w) started.wait.u.w)  cor
  =.  waits  (~(del by waits) id)
  =.  cor  (send host.u.w [%halt id] ~)
  (fail-wait wait.u.w 504 (rap 3 (scot %p host.u.w) ' did not respond' ~))
::
++  fail-wait
  |=  [w=wait code=@ud msg=@t]
  ^+  cor
  ?-  -.w
    %ls  (respond-json rid.w code (ok-json | msg))
    %op  (respond-json rid.w code (ok-json | msg))
    %up  (respond-json rid.w code (ok-json | msg))
    %dl  ?:(started.w (kick-http rid.w) (respond-text rid.w code msg))
  ==
::
++  finish
  |=  [to=dest ok=? msg=@t]
  ^+  cor
  ?-  -.to
    %http  (respond-json rid.to ?:(ok 200 400) (ok-json ok msg))
    %peer  (send ship.to [%result id.to ok msg] ~)
  ==
::
++  on-peer
  |=  [who=ship msg=peer]
  ^+  cor
  ?-  -.msg
    %hello    (send who [%offers (offers-for who)] ~)
    %ls       (peer-ls who id.msg loc.msg)
    %read     (peer-read who +.msg)
    %halt     cor(serves (~(del by serves) [who id.msg]))
    %mkdir    (peer-op who id.msg %mkdir loc.msg ~)
    %rm       (peer-op who id.msg %rm loc.msg ~)
    %mv       (peer-op who id.msg %mv from.msg `to.msg)
  ::
      %write
    =,  msg
    ?.  (can-edit who loc |)
      (send who [%result id | 'permission denied'] ~)
    (up-chunk [who id] [%peer who id] loc name off size real mime enc data)
  ::
      %offers
    =.  offers  (~(put by offers) who offers.msg)
    =.  peers  (~(put by peers) who &)
    give-state
  ::
    %listing  (got-listing who +.msg)
    %head     (got-head who +.msg)
    %data     (got-data who +.msg)
    %result   (got-result who +.msg)
  ==
::  +access: the best role a ship holds over a location
::
++  access
  |=  [who=ship l=loc]
  ^-  (unit perm)
  ?:  =(our.bowl who)  `%owner
  ?.  (good-pax pax.l)  ~
  =/  best=(unit perm)  ~
  =/  ss  ~(tap by shares)
  |-
  ?~  ss  best
  =/  [sl=loc s=share]  i.ss
  =/  r  (~(get by who.s) who)
  ?.  &(?=(^ r) =(vol.sl vol.l) (is-prefix pax.sl pax.l))
    $(ss t.ss)
  $(ss t.ss, best ?:(|(=(`%editor best) =(`%editor r)) `%editor `%viewer))
::  +can-edit: editors may change things inside a share; with .strict,
::  not the shared item itself
::
++  can-edit
  |=  [who=ship l=loc strict=?]
  ^-  ?
  ?:  =(our.bowl who)  &
  ?.  (good-pax pax.l)  |
  %+  lien  ~(tap by shares)
  |=  [sl=loc s=share]
  ?&  =(vol.sl vol.l)
      =(`%editor (~(get by who.s) who))
      (is-prefix pax.sl pax.l)
      |(!strict (lth (lent pax.sl) (lent pax.l)))
  ==
::
++  offers-for
  |=  who=ship
  ^-  (list offer)
  %+  murn  ~(tap by shares)
  |=  [l=loc s=share]
  ^-  (unit offer)
  =/  r  (~(get by who.s) who)
  ?~  r  ~
  `[l u.r dir.s (last-name pax.l)]
::
++  peer-ls
  |=  [who=ship id=@uv l=loc]
  ^+  cor
  =/  a  (access who l)
  ?~  a  (send who [%result id | 'access denied'] ~)
  =/  r=role  ?:(?=(%viewer u.a) %viewer %editor)
  ?-    vol.l
      %ship
    =/  sub  (~(dip tr files) pax.l)
    ?~  sub  (send who [%result id | 'not found'] ~)
    (send who [%listing id r ~(ls tr u.sub)] ~)
  ::
      %host
    ?.  live.host  (send who [%result id | 'host disk is offline'] ~)
    (dsend [%peer-ls who id r] [%ls (pax-to-cord pax.l)])
  ==
::
++  peer-read
  |=  [who=ship id=@uv l=loc off=@ud len=(unit @ud)]
  ^+  cor
  ?~  (access who l)  (send who [%result id | 'access denied'] ~)
  =/  key  [who id]
  =/  lim  (bind len |=(n=@ud (add off n)))
  ?-    vol.l
      %host
    ?.  live.host  (send who [%result id | 'host disk is offline'] ~)
    =.  serves  (~(put by serves) key [[%peer who id] l off lim 0 0 | '' | |])
    (pump key)
  ::
      %ship
    =/  n  (~(get tr files) pax.l)
    ?.  ?=([~ %file *] n)  (send who [%result id | 'not found'] ~)
    =*  m  meta.u.n
    ::  gzipped files always go whole
    =/  o  ?:(?=(%gz enc.m) 0 (min off stored.m))
    =/  e  ?:(|(?=(%gz enc.m) ?=(~ lim)) stored.m (min stored.m u.lim))
    =/  e  (max o e)
    =.  serves  (~(put by serves) key [[%peer who id] l o `e e 0 & '' | |])
    =.  cor  (send who [%head id stored.m mime.m enc.m mod.m o (sub e o)] ~)
    (pump key)
  ==
::
++  peer-op
  |=  [who=ship id=@uv =op l=loc nu=(unit loc)]
  ^+  cor
  =/  ok=?
    ?-  op
      %mkdir  (can-edit who [vol.l (parent pax.l)] |)
      %rm     (can-edit who l &)
      %mv     ?&  ?=(^ nu)
                  (can-edit who l &)
                  (can-edit who [vol.u.nu (parent pax.u.nu)] |)
              ==
    ==
  ?.  ok  (send who [%result id | 'permission denied'] ~)
  (do-op [%peer who id] op l nu)
::
++  got-listing
  |=  [who=ship id=@uv =role ents=(list entry)]
  ^+  cor
  =/  w  (~(get by waits) id)
  ?~  w  cor
  ?.  &(=(who host.u.w) ?=(%ls -.wait.u.w))  cor
  =.  waits  (~(del by waits) id)
  (respond-json rid.wait.u.w 200 (listing-json role ents))
::
++  got-head
  |=  [who=ship id=@uv size=@ud mime=@t =enc mod=@da off=@ud len=@ud]
  ^+  cor
  =/  w  (~(get by waits) id)
  ?~  w  (send who [%halt id] ~)
  ?.  &(=(who host.u.w) ?=(%dl -.wait.u.w))  cor
  =/  d  wait.u.w
  ?>  ?=(%dl -.d)
  =/  part  &(partial.d ?=(%id enc) !=(0 len))
  =/  hed  (file-headers name.d mime dl.d enc)
  =?  hed  part  (snoc hed ['content-range' (content-range off len size)])
  =.  cor
    %-  emit
    [%give %fact ~[/http-response/[rid.d]] %http-response-header !>([?:(part 206 200) hed])]
  ?:  =(0 len)
    =.  waits  (~(del by waits) id)
    (kick-http rid.d)
  =.  waits  (~(put by waits) id [who d(at off, left len, started &)])
  cor
::
++  got-data
  |=  [who=ship id=@uv off=@ud data=octs]
  ^+  cor
  =/  w  (~(get by waits) id)
  ?~  w  cor
  ?.  =(who host.u.w)  cor
  =/  d  wait.u.w
  ?.  &(?=(%dl -.d) started.d)  cor
  ?.  =(off at.d)
    ::  never pass along a gap; the stream is broken
    ~&  [%sovnas %stream-gap host=who want=at.d got=off]
    =.  waits  (~(del by waits) id)
    =.  cor  (send who [%halt id] ~)
    (kick-http rid.d)
  =.  cor
    (emit %give %fact ~[/http-response/[rid.d]] %http-response-data !>(`data))
  =/  left  (sub left.d (min left.d p.data))
  ?.  =(0 left)
    =.  waits  (~(put by waits) id [who d(at (add at.d p.data), left left)])
    cor
  =.  waits  (~(del by waits) id)
  (kick-http rid.d)
::
++  got-result
  |=  [who=ship id=@uv ok=? msg=@t]
  ^+  cor
  =/  w  (~(get by waits) id)
  ?~  w  cor
  ?.  =(who host.u.w)  cor
  =.  waits  (~(del by waits) id)
  =/  d  wait.u.w
  ?-  -.d
    %ls  (respond-json rid.d 400 (ok-json | msg))
    %op  (respond-json rid.d ?:(ok 200 400) (ok-json ok msg))
    %up  (respond-json rid.d ?:(ok 200 400) (ok-json ok msg))
    %dl  ?:(started.d (kick-http rid.d) (respond-text rid.d 404 msg))
  ==
::
::  +|  daemon
::
++  dsend
  |=  [p=dpend r=dreq]
  ^+  cor
  =/  id  nonce
  =.  dpends  (~(put by dpends) id p)
  =.  nonce  +(nonce)
  (emit %pass /lick %arvo %l %spit /sovnas %sovnas [%req id r])
::
++  on-lick
  |=  [=mark noun=*]
  ^+  cor
  ?+    mark  ~&(sovnas+lick-mark+mark cor)
      %connect
    =.  token.host  (new-token %daemon)
    (emit hello)
  ::
      %disconnect  daemon-down
      %error       cor                   ::  no daemon attached
  ::
      %sovnas
    =/  m  ((soft dres) noun)
    ?~  m  ~&(%sovnas-bad-daemon-message cor)
    ?-    -.u.m
        %info
      =,  u.m
      =.  host  [& root free total ver port token.host]
      give-state
    ::
      %changed  (give-changed our.bowl [%host (cord-to-pax p.u.m)])
      %res      (on-dres id.u.m ok.u.m body.u.m)
    ==
  ==
::
++  daemon-down
  ^+  cor
  =.  live.host  |
  =/  ds  ~(tap by dpends)
  =.  dpends  ~
  =.  cor  give-state
  |-
  ?~  ds  cor
  $(ds t.ds, cor (dpend-fail q.i.ds 'host disk disconnected'))
::
++  dpend-fail
  |=  [p=dpend msg=@t]
  ^+  cor
  ?-  -.p
    %ls       (respond-json rid.p 502 (ok-json | msg))
    %html     (respond-text rid.p 502 msg)
    %op       (finish to.p | msg)
    %peer-ls  (send ship.p [%result id.p | msg] ~)
    %find     (respond-json rid.p 502 (ok-json | msg))
    %df       cor
    %job      (job-fail id.p msg)
  ::
      %read
    =/  s  (~(get by serves) key.p)
    ?~  s  cor
    (abort-stream key.p u.s msg)
  ::
    %write    (finish to.p | msg)
  ==
::
++  on-dres
  |=  [id=@ud ok=? body=*]
  ^+  cor
  =/  p  (~(get by dpends) id)
  ?~  p  cor
  =.  dpends  (~(del by dpends) id)
  ?.  ok
    (dpend-fail u.p ?@(body ;;(@t body) 'daemon error'))
  ?-    -.u.p
    %ls       (respond-json rid.u.p 200 (listing-json %owner (dents body)))
    %html     (pub-page rid.u.p token.u.p sub.u.p (dents body))
    %peer-ls  (send ship.u.p [%listing id.u.p role.u.p (dents body)] ~)
    %read     (got-read key.u.p body)
    %df       cor
    %job      (job-res id.u.p body)
  ::
      %op
    =/  name  ?@(body ;;(@t body) '')
    =.  cor  (fix-shares [op loc nu]:u.p)
    =.  cor  (finish to.u.p & name)
    =.  cor  (give-changed our.bowl [%host (parent pax.loc.u.p)])
    ?.  ?=([~ *] nu.u.p)  cor
    (give-changed our.bowl [%host (parent pax.u.nu.u.p)])
  ::
      %write
    =/  res  ;;([done=? fp=@t] body)
    ?.  done.res  (finish to.u.p & '')
    =/  pp  (cord-to-pax fp.res)
    =.  cor  (finish to.u.p & (last-name pp))
    (give-changed our.bowl [%host (parent pp)])
  ::
      %find
    =/  hits
      %+  turn  ;;((list [@t ? @ud @ud @t]) body)
      |=  [p=@t d=? s=@ud m=@ud t=@t]
      ^-  [pax entry]
      =/  pp  (cord-to-pax p)
      [pp (last-name pp) d s (from-unix m) t]
    (respond-json rid.u.p 200 (search-json %host hits))
  ==
::
++  dents
  |=  body=*
  ^-  (list entry)
  %+  turn  ;;((list [@t ? @ud @ud @t]) body)
  |=  [name=@t dir=? size=@ud mod=@ud mime=@t]
  [name dir size (from-unix mod) mime]
::
::  +|  public links
::
++  pub
  |=  [rid=@ta r=request:http tok=@t args=(map @t @t)]
  ^+  cor
  =/  l  (~(get by links) tok)
  ?~  l  (respond-text rid 404 'This link is invalid or has been turned off.')
  =/  sh  (~(get by shares) u.l)
  =/  sub=pax  (cord-to-pax (~(gut by args) 'p' '/'))
  ?.  (good-pax sub)  (respond-text rid 400 'bad path')
  =/  target=loc  [vol.u.l (weld pax.u.l sub)]
  =/  dl  =('1' (~(gut by args) 'dl' ''))
  =/  rng  (get-hed 'range' header-list.r)
  ?-    vol.target
      %ship
    =/  n  (~(get tr files) pax.target)
    ?~  n  (respond-text rid 404 'not found')
    ?:  ?=(%file -.u.n)
      (serve-local rid target (last-name pax.target) dl rng)
    (pub-page rid tok sub ~(ls tr (need (~(dip tr files) pax.target))))
  ::
      %host
    ?.  live.host  (respond-text rid 503 'This drive is offline right now.')
    =/  is-file
      ?~  sub  ?~(sh | !dir.u.sh)
      =('1' (~(gut by args) 'f' ''))
    ?:  is-file
      (serve-local rid target (last-name pax.target) dl rng)
    (dsend [%html rid tok sub] [%ls (pax-to-cord pax.target)])
  ==
::
++  pub-page
  |=  [rid=@ta tok=@t sub=pax ents=(list entry)]
  ^+  cor
  =/  ents
    %+  sort  ents
    |=  [a=entry b=entry]
    ?:  !=(dir.a dir.b)  dir.a
    (aor (cass (trip name.a)) (cass (trip name.b)))
  =/  here  (pax-to-cord sub)
  =/  link
    |=  [p=pax file=? dl=?]
    ^-  tape
    %-  trip
    %:  rap  3
      '/apps/sovnas/pub/'  tok  '?p='  (encode (pax-to-cord p))
      ?:(file '&f=1' '')  ?:(dl '&dl=1' '')  ~
    ==
  =/  rows=marl
    %+  turn  ents
    |=  e=entry
    =/  p  (snoc sub name.e)
    ;tr
      ;td
        ;a(href (link p !dir.e |)): {(trip name.e)}{?:(dir.e "/" "")}
      ==
      ;td: {?:(dir.e "" (a-co:co size.e))}
      ;td
        ;+  ?:  dir.e  ;span;
            ;a(href (link p & &)): download
      ==
    ==
  =/  page=manx
    ;html
      ;head
        ;meta(charset "utf-8");
        ;meta(name "viewport", content "width=device-width, initial-scale=1");
        ;title: {(trip ?~(sub 'Shared folder' (last-name sub)))}
        ;style
          ;-  %+  weld  "body\{font-family:system-ui,sans-serif;max-width:52rem;"
              "margin:2rem auto;padding:0 1rem}td\{padding:.35rem .8rem}a\{color:#b31b1b}"
        ==
      ==
      ;body
        ;h2: {(trip ?~(sub 'Shared folder' (last-name sub)))}
        ;p: {(trip here)}
        ;+  ?~  sub  ;span;
            ;a(href (link (parent sub) | |)): ← up
        ;table
          ;*  rows
        ==
      ==
    ==
  %^  give-http  rid
    [200 ~[['content-type' 'text/html; charset=utf-8'] ['cache-control' 'no-store']]]
  `(manx-to-octs:server page)
::
::  +|  static files
::
++  static
  |=  [rid=@ta req=inbound-request:eyre rest=(list @t)]
  ^+  cor
  =/  file=(list @t)  ?~(rest ~['index.html'] rest)
  =/  nm  (rear file)
  =/  ext  (ext-of nm)
  ::  unknown paths fall back to the single-page app
  =?  file  =('' ext)  ~['index.html']
  =?  ext   =('' ext)  'html'
  ?:  &(=(~['index.html'] file) !authenticated.req)
    =/  to  (cat 3 '/~/login?redirect=' (encode '/apps/sovnas/'))
    (give-http rid [302 ~[['location' to]]] ~)
  =/  nm  (rear file)
  =/  stem  (end [3 (sub (met 3 nm) +((met 3 ext)))] nm)
  =/  pth=path
    %+  weld  /web
    (turn (snoc (snip file) stem) |=(t=@t ;;(@ta t)))
  =/  bek=path  /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)
  =/  full=path  (weld bek (snoc pth ;;(@ta ext)))
  ?.  .^(? %cu full)  (respond-text rid 404 'not found')
  =/  tub  .^(tube:clay %cc (weld bek /[;;(@ta ext)]/mime))
  =/  mim  !<(mime (tub .^(vase %cr full)))
  =/  cache
    ?:(=('html' ext) 'no-cache' 'public, max-age=31536000, immutable')
  %^  give-http  rid
    [200 ~[['content-type' (rsh [3 1] (spat p.mim))] ['cache-control' cache]]]
  `q.mim
::
++  daemon-script
  |=  rid=@ta
  ^+  cor
  =/  pax=path  /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)/daemon/sovnasd/py
  ?.  .^(? %cu pax)  (respond-text rid 404 'not found')
  =/  txt  .^(@t %cx pax)
  %^  give-http  rid
    :-  200
    :~  ['content-type' 'text/x-python; charset=utf-8']
        ['content-disposition' 'attachment; filename="sovnasd.py"']
    ==
  `(as-octs:mimes:html txt)
::
::  +|  http responses
::
++  give-http
  |=  [rid=@ta hed=response-header:http dat=(unit octs)]
  ^+  cor
  (emil (give-simple-payload:app:server rid [hed dat]))
::
++  respond-json
  |=  [rid=@ta code=@ud j=json]
  ^+  cor
  %^  give-http  rid
    [code ~[['content-type' 'application/json'] ['cache-control' 'no-store']]]
  `(json-octs j)
::
++  respond-text
  |=  [rid=@ta code=@ud t=@t]
  ^+  cor
  %^  give-http  rid
    [code ~[['content-type' 'text/plain; charset=utf-8']]]
  `(as-octs:mimes:html t)
::
++  kick-http
  |=  rid=@ta
  ^+  cor
  (emit %give %kick ~[/http-response/[rid]] ~)
::
::  +|  misc
::
++  new-id
  ^-  [@uv _cor]
  :-  `@uv`(end [3 16] (shas %sovnas-id (mix eny.bowl nonce)))
  cor(nonce +(nonce))
::
++  new-token
  |=  salt=@
  ^-  @t
  =/  raw  (scot %uw (end [3 18] (shas %sovnas-token (mix salt (mix eny.bowl nonce)))))
  (crip (skip (trip raw) |=(c=@t |(=(c '.') =(c '~')))))
--
