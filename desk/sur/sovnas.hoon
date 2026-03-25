::  sur/sovnas: type definitions for %sovnas
::
|%
::  -- Configuration --
::
+$  config
  $:  root=path                        ::  host filesystem root
      max-file-size=@ud                ::  max upload size in bytes (default 500MB)
      connected=?                      ::  whether daemon is connected
  ==
::
::  -- File Metadata --
::
+$  file-entry
  $:  name=@t                          ::  filename
      full-path=@t                     ::  absolute path on host
      size=@ud                         ::  size in bytes
      modified=@da                     ::  last modified timestamp
      is-dir=?                         ::  directory flag
      mime=@t                          ::  MIME type (for files)
  ==
::
+$  dir-listing  (list file-entry)
::
::  -- Actions (frontend -> agent pokes) --
::
+$  action
  $%  [%list-dir =path]
      [%upload name=@t dir=path data=@t]
      [%upload-chunk name=@t dir=path idx=@ud total=@ud data=@t]
      [%download =path]
      [%delete =path]
      [%rename src=path dst=path]
      [%mkdir =path]
      [%set-config =config]
      [%read-daemon-config ~]
      [%write-daemon-config cfg-json=@t]
  ==
::
::  -- Updates (agent -> frontend) --
::
+$  update
  $%  [%dir-list =path entries=dir-listing]
      [%file-data =path data=@t mime=@t size=@ud]
      [%op-result tag=@t success=? msg=@t]
      [%config-update =config]
      [%daemon-status connected=?]
      [%daemon-config cfg-json=@t]
  ==
::
::  -- IPC Commands (agent -> daemon via %lick) --
::
+$  ipc-command
  $%  [%ls dir=@t]
      [%put name=@t dir=@t data=@t]
      [%get path=@t]
      [%rm path=@t]
      [%mv src=@t dst=@t]
      [%mk dir=@t]
      [%stat path=@t]
      [%config-read ~]
      [%config-write cfg-json=@t]
  ==
::
::  -- IPC Responses (daemon -> agent via %lick) --
::
+$  ipc-response
  $%  [%ls-result dir=@t entries=(list ipc-file-info)]
      [%get-result path=@t data=@t mime=@t size=@ud]
      [%config-data cfg-json=@t]
      [%ok tag=@t msg=@t]
      [%err tag=@t msg=@t]
  ==
::
+$  ipc-file-info
  $:  name=@t
      size=@ud
      modified=@ud                     ::  unix timestamp
      is-dir=?
  ==
::
::  -- Chunked upload accumulation --
::
+$  chunk-state
  $:  name=@t
      dir=@t
      total=@ud
      chunks=(map @ud @t)              ::  chunk-idx -> base64 data
  ==
::
::  -- Agent State --
::
+$  state-0
  $:  %0
      =config
      cache=(map path dir-listing)
      pending=(map @ud action)
      chunk-uploads=(map @t chunk-state)
      nonce=@ud
  ==
--
