import type { User, WatchType } from '../types'
import { WATCH_TYPE_LABEL } from '../lib/constants'
import { speak, stopSpeak } from '../lib/tts'

export function WatchRequestModal({
  req,
  onAccept,
  onDecline,
}: {
  req: { sessionId: string; type: WatchType; parent: User }
  onAccept: () => void
  onDecline: () => void
}) {
  const what =
    req.type === 'audio'
      ? '🎤 послушать, что происходит рядом с тобой'
      : req.type === 'back'
        ? '📷 посмотреть вокруг через заднюю камеру'
        : '🤳 посмотреть на тебя через переднюю камеру'

  return (
    <div className="modal-back">
      <div className="modal center">
        <div className="avatar avatar-lg" style={{ margin: '0 auto' }}>
          {req.parent.avatar}
        </div>
        <h2 className="modal-title mt8">{req.parent.name} просит разрешения</h2>
        <p>{what}</p>
        <p className="muted" style={{ fontSize: 15 }}>
          Ты можешь согласиться или отказаться. Остановить показ можно в любой момент кнопкой «Стоп».
        </p>
        <div className="btn-row mt16">
          <button className="btn ghost" onClick={onDecline}>
            ✖ Нет
          </button>
          <button className="btn green" onClick={onAccept}>
            ✔ Да, показать
          </button>
        </div>
      </div>
    </div>
  )
}

export function WatchLiveBanner({ type, onStop }: { type: WatchType; onStop: () => void }) {
  const label = type === 'audio' ? 'Родитель слушает 🎧' : `Родитель смотрит (${WATCH_TYPE_LABEL[type]}) 📹`
  return (
    <div className="banner-watch">
      <span style={{ fontSize: 22 }}>{type === 'audio' ? '🎧' : '🔴'}</span>
      <span className="grow" style={{ fontWeight: 700 }}>
        {label}
      </span>
      <button className="btn small danger" onClick={onStop}>
        Стоп
      </button>
    </div>
  )
}

export function AdviceOverlay({ advice, onClose }: { advice: { title: string; text: string; from: string }; onClose: () => void }) {
  return (
    <div className="modal-back">
      <div className="advice-card">
        <div className="emoji">💜</div>
        <h2>{advice.title}</h2>
        <p>{advice.text}</p>
        <p style={{ opacity: 0.85, fontSize: 15 }}>— совет от {advice.from}</p>
        <div className="btn-row mt16">
          <button
            className="btn ghost"
            onClick={() => speak(`${advice.title}. ${advice.text}`)}
          >
            🔊 Ещё раз вслух
          </button>
          <button
            className="btn primary"
            onClick={() => {
              stopSpeak()
              onClose()
            }}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
