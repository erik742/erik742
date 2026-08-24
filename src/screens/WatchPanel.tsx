import { useEffect, useRef, useState } from 'react'
import type { WatchType } from '../types'
import { QUICK_ADVICE } from '../lib/constants'

export interface WatchState {
  status: 'idle' | 'pending' | 'active'
  type: WatchType
  sessionId: string
  stream: MediaStream | null
}

export default function WatchPanel({
  childName,
  watch,
  onRequest,
  onSwitch,
  onStop,
  onSendAdvice,
}: {
  childName: string
  watch: WatchState
  onRequest: (t: WatchType) => void
  onSwitch: (t: WatchType) => void
  onStop: () => void
  onSendAdvice: (title: string, text: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (videoRef.current && watch.stream && watch.type !== 'audio') videoRef.current.srcObject = watch.stream
    if (audioRef.current && watch.stream && watch.type === 'audio') audioRef.current.srcObject = watch.stream
  }, [watch.stream, watch.type])

  return (
    <div>
      <div className="card">
        <h3>👀 Посмотреть, что происходит</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Отправьте запрос — {childName} увидит уведомление и решит, показать ли камеру или микрофон.
          Ребёнок всегда знает, что вы смотрите, и может остановить показ.
        </p>

        {watch.status === 'idle' && (
          <div className="btn-row wrap">
            <button className="btn teal" onClick={() => onRequest('front')}>🤳 Передняя камера</button>
            <button className="btn teal" onClick={() => onRequest('back')}>📷 Задняя камера</button>
            <button className="btn primary" onClick={() => onRequest('audio')}>🎧 Микрофон</button>
          </div>
        )}

        {watch.status === 'pending' && (
          <div className="center" style={{ padding: '20px 0' }}>
            <div style={{ fontSize: 40 }} className="spin">⏳</div>
            <p style={{ fontWeight: 600 }}>Отправили запрос {childName}…</p>
            <p className="muted">Ждём согласия. Если ребёнок не отвечает — попробуйте позвонить ему.</p>
          </div>
        )}

        {watch.status === 'active' && (
          <>
            {watch.type === 'audio' ? (
              <div className="audio-live">
                <div className="wave">🎧</div>
                <div>Слушаем, что рядом с {childName}</div>
              </div>
            ) : (
              <video className="watch-video" autoPlay playsInline ref={videoRef} />
            )}
            <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

            <div className="btn-row mt8 wrap">
              <button className="btn ghost small" onClick={() => onSwitch('front')}>🤳 Передняя</button>
              <button className="btn ghost small" onClick={() => onSwitch('back')}>📷 Задняя</button>
              <button className="btn ghost small" onClick={() => onSwitch('audio')}>🎧 Микрофон</button>
              <button className="btn danger small" onClick={onStop}>⏹ Остановить</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>💬 Совет ребёнку прямо сейчас</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Совет появится на экране {childName} крупным текстом и будет озвучен голосом.
        </p>
        {QUICK_ADVICE.map((a) => (
          <button key={a.title} className="btn ghost block" style={{ marginBottom: 8 }} onClick={() => onSendAdvice(a.title, a.text)}>
            {a.title}
          </button>
        ))}
        <div className="chat-input-row">
          <input
            className="input"
            placeholder="Свой совет…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn primary send-btn"
            disabled={!custom.trim()}
            onClick={() => {
              onSendAdvice('Совет родителя', custom.trim())
              setCustom('')
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
