import { useEffect, useRef, useState } from 'react'
import type { Message, User } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'
import { QUICK_PHRASES, fmtTime } from '../lib/constants'

export default function ChatScreen({
  me,
  peer,
  onBack,
  startCall,
  busyCall,
}: {
  me: User
  peer: User
  onBack: () => void
  startCall: (kind: 'audio' | 'video') => void
  busyCall: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    api
      .messages(peer.id)
      .then((r) => setMessages(r.messages))
      .catch(() => {})
    const onNew = (m: Message) => {
      if (m.from === peer.id || m.to === peer.id)
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    }
    sock.on('message:new', onNew)
    return () => {
      sock.off('message:new', onNew)
    }
  }, [peer.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  const send = async (t: string) => {
    const val = t.trim()
    if (!val || sending) return
    setSending(true)
    sock.emit('message:send', { to: peer.id, text: val })
    setText('')
    setTimeout(() => setSending(false), 300)
  }

  return (
    <div className="app">
      <div className="header" style={{ borderRadius: 0, position: 'sticky' }}>
        <div className="row">
          <button className="icon-btn" onClick={onBack}>←</button>
          <div className="avatar avatar-sm">{peer.avatar}</div>
          <div className="grow">
            <div style={{ fontSize: 19, fontWeight: 700 }}>{peer.name}</div>
            <div className="row" style={{ fontSize: 13, opacity: 0.85, gap: 6 }}>
              <span className={`dot ${peer.online ? 'online' : ''}`} /> {peer.online ? 'в сети' : 'не в сети'}
            </div>
          </div>
          <button className="icon-btn" disabled={busyCall} onClick={() => startCall('audio')} title="Аудиозвонок">📞</button>
          <button className="icon-btn" disabled={busyCall} onClick={() => startCall('video')} title="Видеозвонок">🎥</button>
        </div>
      </div>

      <div className="chat-wrap">
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty">
              <div className="big">💬</div>
              Скажи «привет» — можно просто выбрать готовую фразу ниже!
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.from === me.id ? 'mine' : ''}`}>
              {m.text}
              <span className="t">{fmtTime(m.at)}</span>
            </div>
          ))}
        </div>

        <div className="chat-input-bar">
          <div className="phrase-chips">
            {QUICK_PHRASES.map((p) => (
              <button key={p} className="chip" onClick={() => void send(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="input"
              placeholder="Написать сообщение…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send(text)
              }}
            />
            <button className="btn primary send-btn" onClick={() => void send(text)} disabled={!text.trim()}>
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
