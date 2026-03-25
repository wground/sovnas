::  app/sovnas: Sovereign NAS — local filesystem access via %lick
::
/-  sovnas
/+  default-agent, dbug, snv=sovnas
|%
+$  versioned-state
  $%  state-0:sovnas
  ==
+$  card  card:agent:gall
--
::
%-  agent:dbug
=|  state-0:sovnas
=*  state  -
^-  agent:gall
::  helper core (not part of the agent door)
=>
|%
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
  :_  this(state [%0 cfg ~ ~ ~ 0])
  ::  open %lick IPC port named /sovnas
  [%pass /lick %arvo %l %spin /sovnas]~
::
++  on-save  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  old-state  !<(versioned-state old)
  `this(state old-state)
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %sovnas-action
    =/  act=action:sovnas  !<(action:sovnas vase)
    =^  cards  state  (handle-action act)
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
      ::  send current config to new subscriber
      =/  upd=update:sovnas  [%config-update config.state]
      :_  this
      [%give %fact ~ %sovnas-update !>(upd)]~
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
++  on-agent  on-agent:def
++  on-fail   on-fail:def
--
