::  app/sovnas: Sovereign NAS — local filesystem access via %lick
::  with cross-ship file sharing over %ames
::
/-  sovnas
/+  default-agent, dbug, snv=sovnas
|%
+$  versioned-state
  $%  state-0:sovnas
      state-1:sovnas
  ==
+$  card  card:agent:gall
--
::
%-  agent:dbug
=|  state-1:sovnas
=*  state  -
^-  agent:gall
::  helper core (not part of the agent door)
=>
|%
::  +check-share-access: verify that a ship has access to a path
::  Returns the share and whether write access is granted
::
++  check-share-access
  |=  [requester=@p pof=@t shares=(map @t share:sovnas)]
  ^-  (unit [=share:sovnas write=?])
  ::  iterate all shares, find one whose path is a prefix of pof
  =/  share-list  ~(tap by shares)
  |-
  ?~  share-list  ~
  =/  [key=@t shr=share:sovnas]  i.share-list
  ::  check if the requested path starts with this share's path
  =/  share-path=tape  (trip pof.shr)
  =/  req-path=tape    (trip pof)
  ::  exact match or prefix with /
  =/  is-match=?
    ?|  .=(share-path req-path)
        ?&  (lth (lent share-path) (lent req-path))
            .=((scag (lent share-path) req-path) share-path)
            ::  next char after prefix must be /
            .=((snag (lent share-path) req-path) '/')
        ==
    ==
  ?.  is-match
    $(share-list t.share-list)
  ?.  (~(has in who.shr) requester)
    $(share-list t.share-list)
  ::  found a matching share for this requester
  `[shr .=(%read-write perm.shr)]
::
++  handle-action
  |=  act=action:sovnas
  ^-  (quip card _state)
  ?-  -.act
  ::
      %list-dir
    =/  id  nonce.state
    =/  cmd  [%ls (path-to-cord:snv path.act)]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %upload
    =/  id  nonce.state
    =/  cmd  [%put name.act (path-to-cord:snv dir.act) data.act]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %upload-chunk
    ::  accumulate chunk, send put when all received
    =/  key=@t  name.act
    =/  dir-cord=@t  (path-to-cord:snv dir.act)
    =/  cs=chunk-state:sovnas
      %+  ~(gut by chunk-uploads.state)  key
      [key dir-cord total.act ~]
    =/  new-chunks  (~(put by chunks.cs) idx.act data.act)
    =/  new-cs  cs(chunks new-chunks)
    =/  st1  state(chunk-uploads (~(put by chunk-uploads.state) key new-cs))
    ::  all chunks received?
    ?.  .=(total.act ~(wyt by new-chunks))
      `st1
    ::  reassemble: sort by index and concatenate
    =/  sorted  (sort ~(tap in ~(key by new-chunks)) lth)
    =/  full-data=@t
      %-  crip
      %-  zing
      %+  turn  sorted
      |=  i=@ud
      (trip (~(got by new-chunks) i))
    =/  id  nonce.st1
    =/  cmd  [%put name.act dir.cs full-data]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  st2  st1(chunk-uploads (~(del by chunk-uploads.st1) key))
    :_  st2(pending (~(put by pending.st2) id [%upload name.act dir.act full-data]), nonce +(nonce.st2))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %download
    =/  id  nonce.state
    =/  cmd  [%get (path-to-cord:snv path.act)]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %delete
    =/  id  nonce.state
    =/  cmd  [%rm (path-to-cord:snv path.act)]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %rename
    =/  id  nonce.state
    =/  cmd  [%mv (path-to-cord:snv src.act) (path-to-cord:snv dst.act)]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %mkdir
    =/  id  nonce.state
    =/  cmd  [%mk (path-to-cord:snv path.act)]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %set-config
    =/  upd=update:sovnas  [%config-update config.act]
    :_  state(config config.act)
    [%give %fact ~[/updates /config] %sovnas-update !>(upd)]~
  ::
      %read-daemon-config
    =/  id  nonce.state
    =/  cmd  [%config-read ~]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %write-daemon-config
    =/  id  nonce.state
    =/  cmd  [%config-write cfg-json.act]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    :_  state(pending (~(put by pending.state) id act), nonce +(nonce.state))
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
  ::  -- share management --
  ::
      %share-folder
    ::  add or update a share
    =/  existing=share:sovnas
      %+  ~(gut by shares.state)  pof.act
      [pof.act ~ perm.act]
    =/  new-who  (~(put in who.existing) who.act)
    =/  new-share=share:sovnas  [pof.act new-who perm.act]
    =/  new-shares  (~(put by shares.state) pof.act new-share)
    ::  notify the recipient about the share via %ames poke
    =/  offer-json=json
      (remote-request-to-json:snv [%share-offer [pof.act perm.act]~])
    =/  offer-cage=cage  [%json !>(offer-json)]
    =/  upd=update:sovnas  [%shares-list ~(val by new-shares)]
    :_  state(shares new-shares)
    :~  [%give %fact ~[/updates] %sovnas-update !>(upd)]
        [%pass /share/out %agent [who.act %sovnas] %poke offer-cage]
    ==
  ::
      %unshare-folder
    =/  existing=(unit share:sovnas)  (~(get by shares.state) pof.act)
    ?~  existing
      =/  upd=update:sovnas  [%op-result 'unshare' %.n 'share not found']
      :_  state
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    =/  new-who  (~(del in who.u.existing) who.act)
    =/  new-shares
      ?:  .=(~ new-who)
        (~(del by shares.state) pof.act)
      (~(put by shares.state) pof.act u.existing(who new-who))
    ::  notify the removed ship
    =/  revoke-json=json
      (remote-request-to-json:snv [%share-revoke pof.act])
    =/  revoke-cage=cage  [%json !>(revoke-json)]
    =/  upd=update:sovnas  [%shares-list ~(val by new-shares)]
    :_  state(shares new-shares)
    :~  [%give %fact ~[/updates] %sovnas-update !>(upd)]
        [%pass /share/out %agent [who.act %sovnas] %poke revoke-cage]
    ==
  ::
      %list-shares
    =/  upd=update:sovnas  [%shares-list ~(val by shares.state)]
    :_  state
    [%give %fact ~[/updates] %sovnas-update !>(upd)]~
  ::
  ::  -- remote operations (requester side) --
  ::
      %remote-ls
    ::  poke the remote ship's %sovnas agent with a request-ls
    =/  req-json=json  (remote-request-to-json:snv [%request-ls pof.act])
    =/  req-cage=cage  [%json !>(req-json)]
    :_  state
    [%pass /remote/ls %agent [host.act %sovnas] %poke req-cage]~
  ::
      %remote-download
    =/  req-json=json  (remote-request-to-json:snv [%request-get pof.act])
    =/  req-cage=cage  [%json !>(req-json)]
    :_  state
    [%pass /remote/get %agent [host.act %sovnas] %poke req-cage]~
  ::
      %remote-upload
    =/  req-json=json  (remote-request-to-json:snv [%request-put name.act dir.act data.act])
    =/  req-cage=cage  [%json !>(req-json)]
    :_  state
    [%pass /remote/put %agent [host.act %sovnas] %poke req-cage]~
  ::
      %remote-mkdir
    =/  req-json=json  (remote-request-to-json:snv [%request-mkdir pof.act])
    =/  req-cage=cage  [%json !>(req-json)]
    :_  state
    [%pass /remote/mkdir %agent [host.act %sovnas] %poke req-cage]~
  ::
      %remote-rm
    =/  req-json=json  (remote-request-to-json:snv [%request-rm pof.act])
    =/  req-cage=cage  [%json !>(req-json)]
    :_  state
    [%pass /remote/rm %agent [host.act %sovnas] %poke req-cage]~
  ::
      %list-remote-shares
    =/  upd=update:sovnas  [%remote-shares-list remote-shares.state]
    :_  state
    [%give %fact ~[/updates] %sovnas-update !>(upd)]~
  ==
::
::  +handle-remote-request: process a request from a foreign ship
::  Checks permissions, then forwards to daemon via %lick
::
++  handle-remote-request
  |=  [requester=@p req=remote-request:sovnas]
  ^-  (quip card _state)
  ?-  -.req
  ::
      %share-offer
    ::  another ship is telling us what they share with us
    =/  new-shares=(list remote-share:sovnas)
      %+  turn  shares.req
      |=  [pof=@t perm=share-perm:sovnas]
      [requester pof perm]
    ::  merge: remove old shares from this host, add new ones
    =/  filtered=(list remote-share:sovnas)
      %+  skim  remote-shares.state
      |=  rs=remote-share:sovnas
      !.=(host.rs requester)
    =/  merged=(list remote-share:sovnas)
      (weld filtered new-shares)
    =/  upd=update:sovnas  [%remote-shares-list merged]
    :_  state(remote-shares merged)
    [%give %fact ~[/updates] %sovnas-update !>(upd)]~
  ::
      %share-revoke
    ::  another ship revoked a share
    =/  filtered=(list remote-share:sovnas)
      %+  skim  remote-shares.state
      |=  rs=remote-share:sovnas
      !&(.=(host.rs requester) .=(pof.rs pof.req))
    =/  upd=update:sovnas  [%remote-shares-list filtered]
    :_  state(remote-shares filtered)
    [%give %fact ~[/updates] %sovnas-update !>(upd)]~
  ::
      %request-ls
    ::  foreign ship wants to list a shared folder
    =/  access  (check-share-access requester pof.req shares.state)
    ?~  access
      ::  no access — send rejection back via poke
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'ls' %.n 'access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    ::  authorized — send to daemon
    =/  id  nonce.state
    =/  cmd  [%ls pof.req]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  pr=pending-remote:sovnas  [requester req]
    :_  %=  state
          pending-remote  (~(put by pending-remote.state) id pr)
          nonce  +(nonce.state)
        ==
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %request-get
    =/  access  (check-share-access requester pof.req shares.state)
    ?~  access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'get' %.n 'access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    =/  id  nonce.state
    =/  cmd  [%get pof.req]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  pr=pending-remote:sovnas  [requester req]
    :_  %=  state
          pending-remote  (~(put by pending-remote.state) id pr)
          nonce  +(nonce.state)
        ==
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %request-put
    =/  access  (check-share-access requester dir.req shares.state)
    ?~  access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'put' %.n 'access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    ?.  write.u.access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'put' %.n 'write access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    =/  id  nonce.state
    =/  cmd  [%put name.req dir.req data.req]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  pr=pending-remote:sovnas  [requester req]
    :_  %=  state
          pending-remote  (~(put by pending-remote.state) id pr)
          nonce  +(nonce.state)
        ==
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %request-mkdir
    =/  access  (check-share-access requester pof.req shares.state)
    ?~  access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'mkdir' %.n 'access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    ?.  write.u.access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'mkdir' %.n 'write access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    =/  id  nonce.state
    =/  cmd  [%mk pof.req]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  pr=pending-remote:sovnas  [requester req]
    :_  %=  state
          pending-remote  (~(put by pending-remote.state) id pr)
          nonce  +(nonce.state)
        ==
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ::
      %request-rm
    =/  access  (check-share-access requester pof.req shares.state)
    ?~  access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'rm' %.n 'access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    ?.  write.u.access
      =/  resp-json=json
        %-  remote-response-to-json:snv
        [%remote-op-result requester 'rm' %.n 'write access denied']
      :_  state
      [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
    =/  id  nonce.state
    =/  cmd  [%rm pof.req]
    =/  cord  (ipc-command-to-json-cord:snv id cmd)
    =/  pr=pending-remote:sovnas  [requester req]
    :_  %=  state
          pending-remote  (~(put by pending-remote.state) id pr)
          nonce  +(nonce.state)
        ==
    [%pass /lick/[(scot %ud id)] %arvo %l %spit /sovnas %txt cord]~
  ==
::
++  handle-lick
  |=  [=wire =sign-arvo]
  ^-  (quip card _state)
  ?>  ?=(%lick -.sign-arvo)
  =/  gift  +.sign-arvo
  ?>  ?=(%soak -.gift)
  ?+  mark.gift  `state
  ::
      %connect
    ~&  >  '%sovnas: daemon connected'
    =/  upd=update:sovnas  [%daemon-status %.y]
    :_  state(config config.state(connected %.y))
    [%give %fact ~[/updates /config] %sovnas-update !>(upd)]~
  ::
      %disconnect
    ~&  >>  '%sovnas: daemon disconnected'
    =/  upd=update:sovnas  [%daemon-status %.n]
    :_  state(config config.state(connected %.n))
    [%give %fact ~[/updates /config] %sovnas-update !>(upd)]~
  ::
      %txt
    ::  receive message from daemon
    =/  raw=@t  ;;(@t noun.gift)
    =/  parsed=(unit json)  (de:json:html raw)
    ?~  parsed
      ~&  >>>  '%sovnas: bad JSON from daemon'
      `state
    =/  [id=@ud resp=ipc-response:sovnas]
      (ipc-response-from-json:snv u.parsed)
    ::  check if this is a response for a remote request
    =/  pr=(unit pending-remote:sovnas)  (~(get by pending-remote.state) id)
    ?^  pr
      ::  this daemon response is for a foreign ship — relay it back
      =.  pending-remote.state  (~(del by pending-remote.state) id)
      (relay-remote-response u.pr resp)
    ::  normal local response
    =/  new-state  state(pending (~(del by pending.state) id))
    ?-  -.resp
    ::
        %ls-result
      =/  entries=dir-listing:sovnas
        %+  turn  entries.resp
        |=  fi=ipc-file-info:sovnas
        ^-  file-entry:sovnas
        ::  convert unix timestamp to @da
        =/  mod=@da  (add ~1970.1.1 (mul ~s1 modified.fi))
        =/  fp=@t
          %-  crip
          %+  weld  (trip dir.resp)
          (weld "/" (trip name.fi))
        [name.fi fp size.fi mod is-dir.fi '']
      =/  pth=path  (cord-to-path:snv dir.resp)
      =/  upd=update:sovnas  [%dir-list pth entries]
      :_  new-state(cache (~(put by cache.new-state) pth entries))
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ::
        %get-result
      =/  pth=path  (cord-to-path:snv path.resp)
      ::  data is base64 cord; frontend decodes it
      =/  upd=update:sovnas
        [%file-data pth data.resp mime.resp size.resp]
      :_  new-state
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ::
        %config-data
      =/  upd=update:sovnas  [%daemon-config cfg-json.resp]
      :_  new-state
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ::
        %ok
      =/  upd=update:sovnas  [%op-result tag.resp %.y msg.resp]
      :_  new-state
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ::
        %err
      =/  upd=update:sovnas  [%op-result tag.resp %.n msg.resp]
      :_  new-state
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ==
  ==
::
::  +relay-remote-response: send daemon result back to the requesting ship
::
++  relay-remote-response
  |=  [pr=pending-remote:sovnas resp=ipc-response:sovnas]
  ^-  (quip card _state)
  =/  requester  requester.pr
  =/  our-ship  requester  :: will be replaced by bowl.our in context
  ?-  -.resp
      %ls-result
    =/  entries=dir-listing:sovnas
      %+  turn  entries.resp
      |=  fi=ipc-file-info:sovnas
      ^-  file-entry:sovnas
      =/  mod=@da  (add ~1970.1.1 (mul ~s1 modified.fi))
      =/  fp=@t
        %-  crip
        %+  weld  (trip dir.resp)
        (weld "/" (trip name.fi))
      [name.fi fp size.fi mod is-dir.fi '']
    =/  resp-json=json
      %-  remote-response-to-json:snv
      [%remote-dir-list requester dir.resp entries]
    :_  state
    [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
  ::
      %get-result
    =/  resp-json=json
      %-  remote-response-to-json:snv
      [%remote-file-data requester path.resp data.resp mime.resp size.resp]
    :_  state
    [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
  ::
      %ok
    =/  resp-json=json
      %-  remote-response-to-json:snv
      [%remote-op-result requester tag.resp %.y msg.resp]
    :_  state
    [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
  ::
      %err
    =/  resp-json=json
      %-  remote-response-to-json:snv
      [%remote-op-result requester tag.resp %.n msg.resp]
    :_  state
    [%pass /remote/reply %agent [requester %sovnas] %poke %json !>(resp-json)]~
  ::
      %config-data
    ::  don't relay config data to foreign ships
    `state
  ==
--
::  agent door (exactly 10 arms)
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  =/  cfg=config:sovnas
    :*  root=/home/nativeplanet/sovnas
        max-file-size=524.288.000
        connected=%.n
    ==
  :_  this(state [%1 cfg ~ ~ ~ 0 ~ ~ ~])
  ::  open %lick IPC port named /sovnas
  [%pass /lick %arvo %l %spin /sovnas]~
::
++  on-save  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  old-state  !<(versioned-state old)
  ?-  -.old-state
      %1  `this(state old-state)
      %0
    ::  migrate state-0 to state-1
    `this(state [%1 config.old-state cache.old-state pending.old-state chunk-uploads.old-state nonce.old-state ~ ~ ~])
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
  ::
      %sovnas-action
    =/  act=action:sovnas  !<(action:sovnas vase)
    =^  cards  state  (handle-action act)
    [cards this]
  ::
      %json
    ::  cross-ship poke: could be a remote-request or a remote-response
    =/  j=json  !<(json vase)
    ?>  ?=(%o -.j)
    =/  m=(map @t json)  p.j
    ::  check if it's a response (coming back to us from a host ship)
    ?:  ?|  (~(has by m) 'remote-dir-list')
            (~(has by m) 'remote-file-data')
            (~(has by m) 'remote-op-result')
        ==
      ::  it's a remote response — parse and broadcast to our UI
      ::  use src.bowl as host (the ship that sent this response)
      =/  rr=remote-response:sovnas  (remote-response-from-json:snv j)
      =/  upd=update:sovnas
        ?-  -.rr
          %remote-dir-list   [%remote-dir-list src.bowl pof.rr entries.rr]
          %remote-file-data  [%remote-file-data src.bowl pof.rr data.rr mime.rr size.rr]
          %remote-op-result  [%remote-op-result src.bowl tag.rr success.rr msg.rr]
        ==
      :_  this
      [%give %fact ~[/updates] %sovnas-update !>(upd)]~
    ::  it's a remote request from a foreign ship
    =/  req=remote-request:sovnas  (remote-request-from-json:snv j)
    =^  cards  state  (handle-remote-request src.bowl req)
    [cards this]
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?.  ?=([%lick *] wire)
    (on-arvo:def wire sign-arvo)
  ?.  ?=(%lick -.sign-arvo)
    (on-arvo:def wire sign-arvo)
  =^  cards  state  (handle-lick wire sign-arvo)
  [cards this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%updates ~]
      ::  send current config and shares to new subscriber
      =/  upd=update:sovnas  [%config-update config.state]
      =/  shares-upd=update:sovnas  [%shares-list ~(val by shares.state)]
      =/  remote-upd=update:sovnas  [%remote-shares-list remote-shares.state]
      :_  this
      :~  [%give %fact ~ %sovnas-update !>(upd)]
          [%give %fact ~ %sovnas-update !>(shares-upd)]
          [%give %fact ~ %sovnas-update !>(remote-upd)]
      ==
    [%config ~]
      =/  upd=update:sovnas  [%config-update config.state]
      :_  this
      [%give %fact ~ %sovnas-update !>(upd)]~
    [%dir *]      `this
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
    [%x %config ~]
      =/  upd=update:sovnas  [%config-update config.state]
      ``[%sovnas-update !>(upd)]
  ==
::
++  on-leave  on-leave:def
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  (on-agent:def wire sign)
    [%share *]     `this
    [%remote *]    `this
  ==
::
++  on-fail   on-fail:def
--
