import { useEffect, useRef, useState } from 'react'
import type { User, WatchType } from '../types'
import { sock } from '../lib/socket'
import { speak } from '../lib/tts'
import CallOverlay, { IncomingCallModal } from './CallOverlay'
import { WatchRequestModal, WatchLiveBanner, AdviceOverlay } from './TeenModals'
import FriendsScreen from './FriendsScreen'
import DiscoverScreen from './DiscoverScreen'
import SafetyScreen from './SafetyScreen'
import MeScreen from './MeScreen'
import ChatScreen from './ChatScreen'

export type { WatchType }
export type CallKind = 'audio' | 'video'

export type CallState =
  | { mode: 'idle' }
  | { mode: 'outgoing'; callId: string; peer: User; kind: CallKind; phase: 'ringing' | 'connecting' }
  | { mode: 'incoming'; callId: string; peer: User; kind: CallKind }
  | { mode: 'active'; callId: string; peer: User; kind: CallKind }

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

type Tab = 'friends' | 'discover' | 'safety' | 'me'

export default function TeenApp({ user, setUser, logout }: { user: User; setUser: (u: User) => void; logout: () => void }) {
  const [tab, setTab] = useState<Tab>('friends')
  const [chatWith, setChatWith] = useState<User | null>(null)

  // --- звонок ---
  const [call, setCall] = useState<CallState>({ mode: 'idle' })
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  // --- наблюдение родителя ---
  const [watchReq, setWatchReq] = useState<{ sessionId: string; type: WatchType; parent: User } | null>(null)
  const [watchLive, setWatchLive] = useState<WatchType | null>(null)

  // --- советы родителя ---
  const [advice, setAdvice] = useState<{ title: string; text: string; from: string } | null>(null)

  const callRef = useRef<CallState>({ mode: 'idle' })
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const [, setLocalVersion] = useState(0)
  const facingRef = useRef<'user' | 'environment'>('user')
  const ringTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const watchRef = useRef<{ sessionId: string; type: WatchType; parentId: string; chanN: number } | null>(null)
  const watchPcRef = useRef<RTCPeerConnection | null>(null)
  const watchStreamRef = useRef<MediaStream | null>(null)

  const locWatchId = useRef<number | null>(null)
  const lastLocAt = useRef(0)

  const setCallBoth = (c: CallState) => {
    callRef.current = c
    setCall(c)
  }

  /* ============ ЗВОНКИ ============ */

  const stopRing = () => {
    if (ringTimeout.current) {
      clearTimeout(ringTimeout.current)
      ringTimeout.current = null
    }
  }

  const cleanupCall = () => {
    stopRing()
    try { pcRef.current?.close() } catch { /* уже закрыт */ }
    pcRef.current = null
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setRemoteStream(null)
    setCallBoth({ mode: 'idle' })
  }

  const ensureCallPc = (channelId: string, remoteId: string) => {
    const pc = new RTCPeerConnection(ICE)
    pcRef.current = pc
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))
    pc.onicecandidate = (e) => {
      if (e.candidate) sock.emit('rtc:ice', { to: remoteId, channelId, candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => {
      if (e.streams[0]) setRemoteStream(e.streams[0])
    }
    return pc
  }

  const startCall = async (peer: User, kind: CallKind) => {
    if (callRef.current.mode !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user' } : false,
      })
      localRef.current = stream
      facingRef.current = 'user'
      setMicOn(true)
      setCamOn(kind === 'video')
      const callId = Math.random().toString(36).slice(2, 10)
      setCallBoth({ mode: 'outgoing', callId, peer, kind, phase: 'ringing' })
      sock.emit('call:invite', { to: peer.id, kind, callId })
      stopRing()
      ringTimeout.current = setTimeout(() => {
        if (callRef.current.mode === 'outgoing') {
          const c = callRef.current
          if (c.mode === 'outgoing') sock.emit('call:end', { callId: c.callId, to: c.peer.id })
          cleanupCall()
        }
      }, 45000)
    } catch {
      alert('Не удалось получить доступ к камере или микрофону. Разрешите доступ в браузере.')
    }
  }

  const acceptCall = async () => {
    const c = callRef.current
    if (c.mode !== 'incoming') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: c.kind === 'video' ? { facingMode: 'user' } : false,
      })
      localRef.current = stream
      facingRef.current = 'user'
      setMicOn(true)
      setCamOn(c.kind === 'video')
      sock.emit('call:accept', { callId: c.callId, to: c.peer.id })
      setCallBoth({ mode: 'active', callId: c.callId, peer: c.peer, kind: c.kind })
    } catch {
      alert('Нет доступа к камере или микрофону. Разрешите доступ и попробуйте ещё раз.')
      sock.emit('call:reject', { callId: c.callId, to: c.peer.id })
      cleanupCall()
    }
  }

  const rejectCall = () => {
    const c = callRef.current
    if (c.mode !== 'incoming') return
    sock.emit('call:reject', { callId: c.callId, to: c.peer.id })
    cleanupCall()
  }

  const endCall = () => {
    const c = callRef.current
    if (c.mode !== 'idle') sock.emit('call:end', { callId: c.callId, to: c.peer.id })
    cleanupCall()
  }

  const toggleMic = () => {
    const next = !micOn
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = next))
    setMicOn(next)
  }

  const toggleCam = () => {
    const next = !camOn
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = next))
    setCamOn(next)
  }

  const switchCam = async () => {
    const c = callRef.current
    if (c.mode !== 'active' || c.kind !== 'video') return
    try {
      const facing = facingRef.current === 'user' ? 'environment' : 'user'
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
      const track = s.getVideoTracks()[0]
      const sender = pcRef.current?.getSenders().find((sd) => sd.track?.kind === 'video')
      await sender?.replaceTrack(track)
      localRef.current?.getVideoTracks().forEach((t) => {
        t.stop()
        localRef.current?.removeTrack(t)
      })
      localRef.current?.addTrack(track)
      facingRef.current = facing
      setLocalVersion((v) => v + 1)
    } catch {
      /* у некоторых устройств нет второй камеры */
    }
  }

  /* ============ НАБЛЮДЕНИЕ РОДИТЕЛЯ ============ */

  const stopWatchTracks = () => {
    watchStreamRef.current?.getTracks().forEach((t) => t.stop())
    watchStreamRef.current = null
    try { watchPcRef.current?.close() } catch { /* уже закрыт */ }
    watchPcRef.current = null
  }

  const startWatchStream = async (parentId: string, sessionId: string, type: WatchType) => {
    try {
      stopWatchTracks()
      const constraints: MediaStreamConstraints =
        type === 'audio'
          ? { audio: true, video: false }
          : { audio: true, video: { facingMode: type === 'back' ? 'environment' : 'user' } }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      watchStreamRef.current = stream
      const prev = watchRef.current
      watchRef.current = { sessionId, type, parentId, chanN: (prev?.chanN || 0) + 1 }
      sock.emit('watch:accept', { sessionId, to: parentId })
      const chan = `${sessionId}#${watchRef.current.chanN}`
      const pc = new RTCPeerConnection(ICE)
      watchPcRef.current = pc
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      pc.onicecandidate = (e) => {
        if (e.candidate && watchRef.current) sock.emit('rtc:ice', { to: watchRef.current.parentId, channelId: chan, candidate: e.candidate.toJSON() })
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sock.emit('rtc:offer', { to: parentId, channelId: chan, sdp: offer })
      setWatchLive(type)
      setWatchReq(null)
    } catch {
      sock.emit('watch:decline', { sessionId, to: parentId })
      setWatchReq(null)
      setWatchLive(null)
      alert('Нет доступа к камере или микрофону. Проверьте разрешения браузера.')
    }
  }

  const stopWatchLocal = (notify: boolean) => {
    const w = watchRef.current
    if (notify && w) sock.emit('watch:stop', { to: w.parentId })
    watchRef.current = null
    stopWatchTracks()
    setWatchLive(null)
  }

  /* ============ СОКЕТЫ ============ */

  useEffect(() => {
    const onIncoming = (p: { callId: string; kind: CallKind; from: User }) => {
      if (callRef.current.mode !== 'idle') {
        sock.emit('call:reject', { callId: p.callId, to: p.from.id })
        return
      }
      setCallBoth({ mode: 'incoming', callId: p.callId, peer: p.from, kind: p.kind })
      speak(`Входящий ${p.kind === 'video' ? 'видео' : 'аудио'} звонок от ${p.from.name}`)
      stopRing()
      ringTimeout.current = setTimeout(() => {
        if (callRef.current.mode === 'incoming') {
          sock.emit('call:reject', { callId: p.callId, to: p.from.id })
          cleanupCall()
        }
      }, 45000)
    }

    const onAccepted = (p: { callId: string }) => {
      const c = callRef.current
      if (c.mode !== 'outgoing' || c.callId !== p.callId) return
      setCallBoth({ mode: 'active', callId: c.callId, peer: c.peer, kind: c.kind })
      ;(async () => {
        try {
          const pc = ensureCallPc(c.callId, c.peer.id)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          sock.emit('rtc:offer', { to: c.peer.id, channelId: c.callId, sdp: offer })
        } catch {
          cleanupCall()
        }
      })()
    }

    const onRejected = () => {
      if (callRef.current.mode !== 'idle') {
        alert('Звонок отклонён')
        cleanupCall()
      }
    }
    const onEnded = () => {
      if (callRef.current.mode !== 'idle') cleanupCall()
    }

    const onOffer = async (p: { channelId: string; sdp: RTCSessionDescriptionInit; from: string }) => {
      const c = callRef.current
      if (c.mode === 'idle' || c.callId !== p.channelId) return
      try {
        const pc = ensureCallPc(p.channelId, p.from)
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp))
        const ans = await pc.createAnswer()
        await pc.setLocalDescription(ans)
        sock.emit('rtc:answer', { to: p.from, channelId: p.channelId, sdp: ans })
      } catch {
        cleanupCall()
      }
    }

    const onAnswer = async (p: { channelId: string; sdp: RTCSessionDescriptionInit }) => {
      try {
        const w = watchRef.current
        if (w && p.channelId.startsWith(w.sessionId + '#') && watchPcRef.current) {
          await watchPcRef.current.setRemoteDescription(new RTCSessionDescription(p.sdp))
          return
        }
        const c = callRef.current
        if (c.mode !== 'idle' && c.callId === p.channelId && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(p.sdp))
        }
      } catch {
        /* повторный ответ — игнорируем */
      }
    }

    const onIce = async (p: { channelId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const w = watchRef.current
        if (w && p.channelId.startsWith(w.sessionId + '#') && watchPcRef.current) {
          await watchPcRef.current.addIceCandidate(p.candidate)
          return
        }
        const c = callRef.current
        if (c.mode !== 'idle' && c.callId === p.channelId && pcRef.current) {
          await pcRef.current.addIceCandidate(p.candidate)
        }
      } catch {
        /* кандидат пришёл раньше описания — браузер сам разберётся */
      }
    }

    const onWatchRequest = (p: { sessionId: string; type: WatchType; parent: User }) => {
      setWatchReq(p)
      const what = p.type === 'audio' ? 'послушать, что происходит рядом' : `посмотреть через ${p.type === 'back' ? 'заднюю' : 'переднюю'} камеру`
      speak(`${p.parent.name} просит ${what}. Открыть доступ?`)
    }
    const onWatchSwitch = (p: { type: WatchType }) => {
      const w = watchRef.current
      if (w) void startWatchStream(w.parentId, w.sessionId, p.type)
    }
    const onWatchStop = () => stopWatchLocal(false)

    const onAdvice = (a: { title: string; text: string; from: string }) => {
      setAdvice(a)
      speak(`${a.title}. ${a.text}`)
    }

    sock.on('call:incoming', onIncoming)
    sock.on('call:accepted', onAccepted)
    sock.on('call:rejected', onRejected)
    sock.on('call:ended', onEnded)
    sock.on('rtc:offer', onOffer)
    sock.on('rtc:answer', onAnswer)
    sock.on('rtc:ice', onIce)
    sock.on('watch:request', onWatchRequest)
    sock.on('watch:switch', onWatchSwitch)
    sock.on('watch:stop', onWatchStop)
    sock.on('advice:show', onAdvice)

    return () => {
      sock.off('call:incoming', onIncoming)
      sock.off('call:accepted', onAccepted)
      sock.off('call:rejected', onRejected)
      sock.off('call:ended', onEnded)
      sock.off('rtc:offer', onOffer)
      sock.off('rtc:answer', onAnswer)
      sock.off('rtc:ice', onIce)
      sock.off('watch:request', onWatchRequest)
      sock.off('watch:switch', onWatchSwitch)
      sock.off('watch:stop', onWatchStop)
      sock.off('advice:show', onAdvice)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ============ ГЕОЛОКАЦИЯ (для родителей) ============ */

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const sendPos = (p: GeolocationPosition, force = false) => {
      const t = Date.now()
      if (!force && t - lastLocAt.current < 12000) return
      lastLocAt.current = t
      sock.emit('loc:update', { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy })
    }
    if (user.shareLocation && user.parentIds.length > 0) {
      locWatchId.current = navigator.geolocation.watchPosition(
        (p) => sendPos(p),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      )
    } else if (locWatchId.current != null) {
      navigator.geolocation.clearWatch(locWatchId.current)
      locWatchId.current = null
    }
    const onLocReq = () =>
      navigator.geolocation.getCurrentPosition((p) => sendPos(p, true), () => {}, { enableHighAccuracy: true, timeout: 15000 })
    sock.on('loc:request', onLocReq)
    return () => {
      sock.off('loc:request', onLocReq)
      if (locWatchId.current != null) {
        navigator.geolocation.clearWatch(locWatchId.current)
        locWatchId.current = null
      }
    }
  }, [user.shareLocation, user.parentIds])

  /* ============ ЭКРАНЫ ============ */

  if (chatWith)
    return (
      <ChatScreen
        me={user}
        peer={chatWith}
        onBack={() => setChatWith(null)}
        startCall={(kind) => void startCall(chatWith, kind)}
        busyCall={call.mode !== 'idle'}
      />
    )

  const titles: Record<Tab, { t: string; s: string }> = {
    friends: { t: `Привет, ${user.name}! 👋`, s: 'Твои друзья и заявки' },
    discover: { t: 'Найти друзей 🔍', s: 'Ребята с похожими интересами' },
    safety: { t: 'Безопасность 🛡', s: 'Кнопка SOS и полезные советы' },
    me: { t: 'Профиль 🧒', s: 'Настройки, интересы, родители' },
  }

  return (
    <div className="app">
      <div className="header">
        <div className="row">
          <div className="avatar">{user.avatar}</div>
          <div className="grow">
            <div className="header-title">{titles[tab].t}</div>
            <div className="header-sub">{titles[tab].s}</div>
          </div>
        </div>
      </div>

      <div className="screen">
        {watchLive && <WatchLiveBanner type={watchLive} onStop={() => stopWatchLocal(true)} />}

        {tab === 'friends' && <FriendsScreen onOpenChat={setChatWith} />}
        {tab === 'discover' && <DiscoverScreen me={user} />}
        {tab === 'safety' && <SafetyScreen me={user} />}
        {tab === 'me' && <MeScreen me={user} setUser={setUser} logout={logout} />}
      </div>

      <div className="tabs-bottom">
        <button className={`tab-btn ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          <span className="ico">👥</span>Друзья
        </button>
        <button className={`tab-btn ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>
          <span className="ico">🔍</span>Найти
        </button>
        <button className={`tab-btn ${tab === 'safety' ? 'active' : ''}`} onClick={() => setTab('safety')}>
          <span className="ico">🛡</span>Безопасность
        </button>
        <button className={`tab-btn ${tab === 'me' ? 'active' : ''}`} onClick={() => setTab('me')}>
          <span className="ico">🧒</span>Я
        </button>
      </div>

      {call.mode === 'incoming' && <IncomingCallModal call={call} onAccept={() => void acceptCall()} onReject={rejectCall} />}
      {(call.mode === 'outgoing' || call.mode === 'active') && (
        <CallOverlay
          call={call}
          remoteStream={remoteStream}
          localStream={localRef.current}
          micOn={micOn}
          camOn={camOn}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onSwitchCam={() => void switchCam()}
          onEnd={endCall}
        />
      )}
      {watchReq && (
        <WatchRequestModal
          req={watchReq}
          onAccept={() => void startWatchStream(watchReq.parent.id, watchReq.sessionId, watchReq.type)}
          onDecline={() => {
            sock.emit('watch:decline', { sessionId: watchReq.sessionId, to: watchReq.parent.id })
            setWatchReq(null)
          }}
        />
      )}
      {advice && <AdviceOverlay advice={advice} onClose={() => setAdvice(null)} />}
    </div>
  )
}
