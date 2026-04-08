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
::  -- Sharing & Permissions --
::
+$  share-perm  ?(%read %read-write)
::
::  A folder we share with other ships (host side)
::
+$  share
  $:  pof=@t                           ::  shared folder path (relative to storage root)
      who=(set @p)                     ::  ships granted access
      perm=share-perm                  ::  permission level
  ==
::
::  Info about a share someone offers us (requester side)
::
+$  remote-share
  $:  host=@p                          ::  which ship is sharing
      pof=@t                           ::  remote folder path
      perm=share-perm                  ::  what we're allowed to do
  ==
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
      ::  share management (host side)
      [%share-folder pof=@t who=@p perm=share-perm]
      [%unshare-folder pof=@t who=@p]
      [%list-shares ~]
      ::  remote operations (requester side)
      [%remote-ls host=@p pof=@t]
      [%remote-download host=@p pof=@t]
      [%remote-upload host=@p name=@t dir=@t data=@t]
      [%remote-mkdir host=@p pof=@t]
      [%remote-rm host=@p pof=@t]
      [%list-remote-shares ~]
  ==
::
::  -- Cross-ship requests (received via poke from foreign ship) --
::
+$  remote-request
  $%  [%request-ls pof=@t]
      [%request-get pof=@t]
      [%request-put name=@t dir=@t data=@t]
      [%request-mkdir pof=@t]
      [%request-rm pof=@t]
      [%share-offer shares=(list [pof=@t perm=share-perm])]
      [%share-revoke pof=@t]
  ==
::
::  -- Cross-ship responses (received via poke from foreign ship) --
::
+$  remote-response
  $%  [%remote-dir-list host=@p pof=@t entries=dir-listing]
      [%remote-file-data host=@p pof=@t data=@t mime=@t size=@ud]
      [%remote-op-result host=@p tag=@t success=? msg=@t]
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
      ::  share updates
      [%shares-list shares=(list share)]
      [%remote-shares-list shares=(list remote-share)]
      ::  remote file data relayed to our UI
      [%remote-dir-list host=@p pof=@t entries=dir-listing]
      [%remote-file-data host=@p pof=@t data=@t mime=@t size=@ud]
      [%remote-op-result host=@p tag=@t success=? msg=@t]
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
::  -- Pending remote request (waiting for daemon response on behalf of foreign ship) --
::
+$  pending-remote
  $:  requester=@p                     ::  ship that asked
      request=remote-request           ::  what they asked for
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
::
+$  state-1
  $:  %1
      =config
      cache=(map path dir-listing)
      pending=(map @ud action)
      chunk-uploads=(map @t chunk-state)
      nonce=@ud
      shares=(map @t share)            ::  folders we share (keyed by path)
      remote-shares=(list remote-share) ::  shares others offer us
      pending-remote=(map @ud pending-remote)  ::  daemon requests on behalf of foreign ships
  ==
--
