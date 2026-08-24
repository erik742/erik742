import { useEffect, useRef, useState } from 'react'
import type { CallState } from './TeenApp'

export function IncomingCallModal({
  call,
  onAccept,
  onReject,
}: {
  call: Extract<CallState, { mode: 'incoming' }>
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="modal-back">
      <div className="modal center">
        <div className="avatar avatar-lg" style={{ margin: '0 auto' }}>
          {call.peer.avatar}
        </div>
        <h2 className="modal-title mt8">{call.peer.name}</h2>
        <p className="muted">Входящий {call.kind === 'video' ? 'видеозвонок' : 'аудиозвонок'}…</p>
        <p className="muted" style={{ fontSize: 15 }}>
          🎧 Совет: наденьте наушники, если вокруг шумно
        </p>
        <div className="btn-row mt16">
          <button className="btn danger" onClick={onReject}>
            ✖ Отклонить
          </button>
          <button className="btn green" onClick={onAccept}>
            ✔ Принять
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CallOverlay({
  call,
  remoteStream,
  localStream,
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onSwitchCam,
  onEnd,
}: {
  call: Extract<CallState, { mode: 'outgoing' | 'active' }>
  remoteStream: MediaStream | null
  localStream: MediaStream | null
  micOn: boolean
  camOn: boolean
  onToggleMic: () => void
  onToggleCam: () => void
  onSwitchCam: () => void
  onEnd: () => void
}) {
  const remoteRef = useRef<HTMLVideoElement | null>(null)
  const localRef = useRef<HTMLVideoElement | null>(null)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    if (localRef.current && localStream && call.kind === 'video') localRef.current.srcObject = localStream
  }, [localStream, call.kind])

  useEffect(() => {
    if (call.mode !== 'active') return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [call.mode])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const status =
    call.mode === 'outgoing'
      ? call.phase === 'ringing'
        ? '📞 Звоним… ждём ответа'
        : '⏳ Соединяемся…'
      : `✅ Идёт разговор · ${mm}:${ss}`

  return (
    <div className="call-overlay">
      <div className="call-top">
        <div className="call-name">
          {call.peer.avatar} {call.peer.name}
        </div>
        <div className="call-status">{status}</div>
      </div>

      {call.kind === 'video' ? (
        <>
          <video className="call-video" autoPlay playsInline ref={remoteRef} />
          <video
            className="call-pip"
            autoPlay
            playsInline
            muted
            ref={localRef}
            style={{ display: camOn ? 'block' : 'none' }}
          />
        </>
      ) : (
        <div className="call-avatar-wrap">
          <div className="avatar">{call.peer.avatar}</div>
          <div style={{ color: '#cfc9f2' }}>Аудиозвонок</div>
        </div>
      )}

      <div className="call-controls">
        <button className={`call-btn ${micOn ? '' : 'off'}`} onClick={onToggleMic} title="Микрофон">
          {micOn ? '🎙' : '🔇'}
        </button>
        <button className="call-end" onClick={onEnd} title="Завершить">
          📞
        </button>
        {call.kind === 'video' && (
          <>
            <button className={`call-btn ${camOn ? '' : 'off'}`} onClick={onToggleCam} title="Камера">
              {camOn ? '📹' : '🚫'}
            </button>
            <button className="call-btn" onClick={onSwitchCam} title="Переключить камеру">
              🔄
            </button>
          </>
        )}
      </div>
    </div>
  )
}
