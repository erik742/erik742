import { useEffect, useRef, useState } from 'react'
import type { AdviceItem, User } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'
import { speak } from '../lib/tts'

const HOLD_MS = 2500

export default function SafetyScreen({ me }: { me: User }) {
  const [advice, setAdvice] = useState<AdviceItem[]>([])
  const [progress, setProgress] = useState(0)
  const [sent, setSent] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.advice().then((r) => setAdvice(r.advice)).catch(() => {})
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current)
    }
  }, [])

  const fireSos = () => {
    const send = (lat?: number, lng?: number, acc?: number) => {
      sock.emit('sos', { lat, lng, acc })
      setSent(true)
      speak('Родители предупреждены. Оставайся на месте. Если страшно — дыши медленно, я с тобой.')
    }
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => send(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
        () => send(),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else send()
  }

  const startHold = () => {
    if (sent) return
    setProgress(0)
    const startedAt = Date.now()
    holdTimer.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - startedAt) / HOLD_MS) * 100)
      setProgress(p)
      if (p >= 100) {
        if (holdTimer.current) clearInterval(holdTimer.current)
        holdTimer.current = null
        fireSos()
      }
    }, 50)
  }

  const cancelHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current)
    holdTimer.current = null
    setProgress(0)
  }

  return (
    <div>
      <div className="card center" style={{ background: 'linear-gradient(160deg,#fff, #fff2f4)' }}>
        <h3>Если тебе страшно или нужна помощь</h3>
        <p className="muted">
          Нажми и держи кнопку {HOLD_MS / 1000} секунды. Родители сразу узнают, где ты, и придут на помощь.
        </p>
        <div className="mt16">
          <button
            className="sos-btn"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            disabled={sent}
          >
            <span>SOS</span>
            <span className="hold">{sent ? 'Отправлено ✓' : 'нажми и держи'}</span>
          </button>
          <div className="sos-progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
        {sent && (
          <div className="mt16">
            <div className="badge ok" style={{ fontSize: 16, padding: '8px 16px' }}>✅ Родители предупреждены!</div>
            <p className="muted mt8">Оставайся на месте. Дыши медленно: вдох — 3 секунды, выдох — 3 секунды.</p>
            <button className="btn ghost small mt8" onClick={() => setSent(false)}>Сбросить</button>
          </div>
        )}
        {me.parentIds.length === 0 && (
          <p className="badge warn mt8" style={{ display: 'inline-block' }}>
            ⚠️ Родители ещё не подключены — SOS никто не увидит. Подключи их в разделе «Я».
          </p>
        )}
      </div>

      <h3 style={{ marginLeft: 4 }}>🧭 Как действовать при опасности</h3>
      <p className="muted" style={{ marginLeft: 4, marginTop: 0 }}>
        Нажми на совет — он прочтётся вслух 🔊
      </p>
      {advice.map((a) => (
        <div key={a.id} className="card clickable" onClick={() => speak(`${a.title}. ${a.text}`)}>
          <div className="row">
            <div style={{ fontSize: 34 }}>{a.emoji}</div>
            <div className="grow">
              <b>{a.title}</b>
              <div className="muted mt8">{a.text}</div>
            </div>
            <span className="muted">🔊</span>
          </div>
        </div>
      ))}
    </div>
  )
}
