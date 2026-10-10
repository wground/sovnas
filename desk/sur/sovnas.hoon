::  sur/sovnas: types for %sovnas, an urbit-native drive
::
::  Every file has a network address [ship vol pax].  The %ship
::  volume keeps bytes inside the ship itself (content-addressed
::  blobs in agent state), so it works on any ship with zero setup.
::  The %host volume is a directory on the host disk, reached through
::  the optional sovnasd daemon over %lick.  Both are served to other
::  ships identically, over ames.
::
|%
+$  vol   ?(%ship %host)
+$  pax   (list @t)                         ::  path segments, any utf-8
+$  loc   [=vol =pax]
+$  role  ?(%viewer %editor)
+$  enc   ?(%id %gz)                        ::  stored-byte encoding
::
::  in-ship storage
::
+$  meta
  $:  size=@ud                              ::  decoded size
      mime=@t
      mod=@da
      =enc
      hash=@uvH                             ::  blob key
      stored=@ud                            ::  stored size
  ==
+$  node
  $%  [%dir mod=@da]
      [%file =meta]
  ==
+$  tree  $~([~ ~] [fil=(unit node) dir=(map @t tree)])
+$  blob  [refs=@ud dat=octs]
::
::  a directory listing row, for any volume on any ship
::
+$  entry  [name=@t dir=? size=@ud mod=@da mime=@t]
::
::  sharing
::
+$  share  [dir=? who=(map ship role) link=(unit @t)]
+$  offer  [=loc =role dir=? name=@t]       ::  shared with us
::
+$  trashed  [=loc =tree when=@da]          ::  %ship volume trash
::
+$  settings
  $:  quota=@ud                             ::  in-ship byte budget
      max-file=@ud                          ::  in-ship max file size
      compress=?                            ::  gzip in the browser
  ==
::
::  where uploads go: .default when nothing says otherwise, and the
::  host disk for anything bigger than .big (when it's connected)
::
+$  prefs  [default=vol big=@ud]
::
::  moving things between volumes, in the background
::
+$  item  [rel=pax dir=? size=@ud]          ::  relative to the moved item
+$  jstep  ?(%walk %mkdirs %mkdu %mkdir %write %read %rm %done %fail)
+$  job
  $:  from=loc                              ::  what is moving
      to=loc                                ::  destination folder
      name=@t
      dir=?
      root=pax                              ::  where it lands, once known
      todo=(list item)
      cur=(unit [=item off=@ud mime=@t parts=(map @ud octs)])
      done=@ud                              ::  bytes moved
      total=@ud                             ::  bytes to move
      step=jstep                            ::  what we're waiting on
      msg=@t
      when=@da
  ==
::
::  status of the host daemon
::
+$  hostd
  $:  live=?
      root=@t
      free=@ud
      total=@ud
      ver=@t
      port=@ud                              ::  direct http, 0 if none
      token=@t                              ::  direct http secret
  ==
::
::  an upload being assembled; chunks may arrive out of order
::
+$  upload
  $:  =loc                                  ::  destination directory
      name=@t
      size=@ud                              ::  bytes being sent
      real=@ud                              ::  decoded size
      mime=@t
      =enc
      got=@ud
      parts=(map @ud octs)                  ::  %ship volume only
      tmp=@t                                ::  %host volume temp name
  ==
::
::  cross-ship protocol, mark %sovnas-peer
::
+$  peer
  $%  ::  requests, to the host of a file
      ::
      [%hello ~]
      [%ls id=@uv =loc]
      [%read id=@uv =loc off=@ud len=(unit @ud)]
      [%halt id=@uv]
      [%write id=@uv =loc name=@t off=@ud size=@ud real=@ud mime=@t =enc data=octs]
      [%mkdir id=@uv =loc]
      [%rm id=@uv =loc]
      [%mv id=@uv from=loc to=loc]
      ::  responses and notices, to the requester
      ::
      [%offers offers=(list offer)]
      [%listing id=@uv =role ents=(list entry)]
      [%head id=@uv size=@ud mime=@t =enc mod=@da off=@ud len=@ud]
      [%data id=@uv off=@ud data=octs]
      [%result id=@uv ok=? msg=@t]
  ==
::
::  who gets the result of an operation
::
+$  dest  $%([%http rid=@ta] [%peer =ship id=@uv])
::
::  a browser request waiting on another ship
::
+$  wait
  $%  [%ls rid=@ta]                         ::  json listing
      [%op rid=@ta]                         ::  json result
      [%dl rid=@ta name=@t dl=? partial=? at=@ud left=@ud started=?]
      [%up rid=@ta]                         ::  upload chunk
  ==
::
::  a file being streamed to another ship, or to our browser
::
+$  serve
  $:  to=dest
      =loc
      off=@ud                               ::  next byte to fetch
      lim=(unit @ud)                        ::  requested end
      end=@ud                               ::  real end, once known
      out=@ud                               ::  chunks in flight
      started=?                             ::  header sent
      name=@t
      dl=?                                  ::  as attachment
      partial=?                             ::  range request
  ==
::
::  daemon request continuations
::
+$  dpend
  $%  [%ls rid=@ta]
      [%html rid=@ta token=@t sub=pax]
      [%op to=dest op=?(%mkdir %rm %mv) =loc nu=(unit loc)]
      [%peer-ls =ship id=@uv =role]
      [%read key=[ship @uv]]
      [%write key=[ship @uv] to=dest last=?]
      [%find rid=@ta]
      [%df ~]
      [%job id=@uv]
  ==
::
::  what a poke-ack to a peer means; acks arrive in send order
::
+$  atag  $@(~ $%([%serve id=@uv] [%up id=@uv]))
::
::  daemon wire protocol (lick mark %sovnas)
::
+$  dreq
  $%  [%ls p=@t]
      [%stat p=@t]
      [%read p=@t off=@ud len=@ud]
      [%write p=@t tmp=@t off=@ud data=octs total=@ud]
      [%mkdir p=@t]
      [%rm p=@t]
      [%mv from=@t to=@t]
      [%find p=@t q=@t]
      [%df ~]
      ::  sovnasd 1.1+
      [%walk p=@t]                          ::  everything under a path
      [%mkdirs p=@t]                        ::  mkdir -p
      [%mkdu p=@t]                          ::  mkdir, renaming if taken
      [%wgz p=@t tmp=@t off=@ud data=octs total=@ud]  ::  %write, gunzip
  ==
+$  dres
  $%  [%info root=@t free=@ud total=@ud ver=@t port=@ud]
      [%res id=@ud ok=? body=*]
      [%changed p=@t]
  ==
::
+$  state-2
  $:  %2
      files=tree                            ::  %ship volume
      blobs=(map @uvH blob)
      used=@ud                              ::  bytes stored in-ship
      trash=(map @uv trashed)
      =settings
      host=hostd
      shares=(map loc share)
      links=(map @t loc)                    ::  public link tokens
      offers=(map ship (list offer))        ::  shared with us
      peers=(map ship ?)                    ::  has %sovnas? (last ack)
      ups=(map [ship @uv] upload)           ::  uploads in progress
      waits=(map @uv [host=ship =wait])     ::  requests to other ships
      serves=(map [ship @uv] serve)         ::  outgoing streams
      dpends=(map @ud dpend)                ::  pending daemon requests
      acks=(map ship (qeu atag))            ::  expected poke-acks
      nonce=@ud
  ==
::
+$  state-3
  $:  %3
      files=tree                            ::  %ship volume
      blobs=(map @uvH blob)
      used=@ud                              ::  bytes stored in-ship
      trash=(map @uv trashed)
      =settings
      host=hostd
      shares=(map loc share)
      links=(map @t loc)                    ::  public link tokens
      offers=(map ship (list offer))        ::  shared with us
      peers=(map ship ?)                    ::  has %sovnas? (last ack)
      ups=(map [ship @uv] upload)           ::  uploads in progress
      waits=(map @uv [host=ship =wait])     ::  requests to other ships
      serves=(map [ship @uv] serve)         ::  outgoing streams
      dpends=(map @ud dpend)                ::  pending daemon requests
      acks=(map ship (qeu atag))            ::  expected poke-acks
      nonce=@ud
      =prefs
      jobs=(map @uv job)                    ::  moves between volumes
  ==
--
