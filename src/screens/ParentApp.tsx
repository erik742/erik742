import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdviceItem, ChildInfo, LocationFix, Message, SosEvent, User, WatchType } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'
import { beep } from '../lib/tts'
import { fmtAgo, fmtTime } from '../lib/constants'
import WatchPanel, { type WatchState } from './WatchPanel'

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

const IDLE_WATCH: WatchState = { status: 'idle', type: 'front', sessionId: '', stream: null }

type Section = 'place' | 'watch' | 'friends' | 'sos' | 'advice'

export default function ParentApp({ user, logout }: { user: User; logout: () => void }) {
  const [children, setChildren] = useState<ChildInfo[]>([])
  const [openChild, setOpenChild] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [attachError, setAttachError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sosAlert, setSosAlert] = useState<{ child: User; at: number; lat: number | null; lng: number | null } | null>(null)
  const [watch, setWatch] = useState<WatchState>(IDLE_WATCH)
  const watchRef = useRef<{ sessionId: string } | null>(null)
  const watchPcRef = useRef<RTCPeerConnection | null>(null)

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3500)
  }

  const loadChildren = useCallback(() => {
    api.children().then((r) => setChildren(r.children)).catch(() => {})
  }, [])

  useEffect(() => {
    loadChildren()
  }, [loadChildren])

  const cleanupWatch = () => {
    try {
      watchPcRef.current?.close()
    } catch {
      /* уже закрыт */
    }
    watchPcRef.current = null
    watchRef.current = null
    setWatch(IDLE_WATCH)
  }

  useEffect(() => {
    const onSos = (p: { child: User; at: number; lat: number | null; lng: number | null }) => {
      setSosAlert(p)
      beep(5)
      loadChildren()
    }
    const onLoc = (p: { childId: string; lat: number; lng: number; acc: number | null; at: number }) => {
      setChildren((prev) =>
        prev.map((c) => (c.id === p.childId ? { ...c, lastLocation: { lat: p.lat, lng: p.lng, acc: p.acc, at: p.at } } : c))
      )
    }
    const onAccepted = (p: { sessionId: string }) => {
      watchRef.current = { sessionId: p.sessionId }
      setWatch((w) => ({ ...w, status: 'active', sessionId: p.sessionId, stream: null }))
    }
    const onDeclined = () => {
      cleanupWatch()
      showToast('Ребёнок отклонил запрос наблюдения')
    }
    const onStop = () => {
      cleanupWatch()
      showToast('Ребёнок остановил трансляцию')
    }
    const onOffer = async (p: { channelId: string; sdp: RTCSessionDescriptionInit; from: string }) => {
      const w = watchRef.current
      if (!w || !p.channelId.startsWith(w.sessionId + '#')) return
      try {
        try {
          watchPcRef.current?.close()
        } catch {
          /* уже закрыт */
        }
        const pc = new RTCPeerConnection(ICE)
        watchPcRef.current = pc
        pc.onicecandidate = (e) => {
          if (e.candidate) sock.emit('rtc:ice', { to: p.from, channelId: p.channelId, candidate: e.candidate.toJSON() })
        }
        pc.ontrack = (e) => {
          if (e.streams[0]) setWatch((wst) => ({ ...wst, status: 'active', stream: e.streams[0] }))
        }
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp))
        const ans = await pc.createAnswer()
        await pc.setLocalDescription(ans)
        sock.emit('rtc:answer', { to: p.from, channelId: p.channelId, sdp: ans })
      } catch {
        cleanupWatch()
      }
    }
    const onIce = async (p: { channelId: string; candidate: RTCIceCandidateInit }) => {
      const w = watchRef.current
      if (w && p.channelId.startsWith(w.sessionId + '#') && watchPcRef.current) {
        try {
          await watchPcRef.current.addIceCandidate(p.candidate)
        } catch {
          /* раньше времени */
        }
      }
    }
    sock.on('sos', onSos)
    sock.on('loc:update', onLoc)
    sock.on('watch:accepted', onAccepted)
    sock.on('watch:declined', onDeclined)
    sock.on('watch:stop', onStop)
    sock.on('rtc:offer', onOffer)
    sock.on('rtc:ice', onIce)
    return () => {
      sock.off('sos', onSos)
      sock.off('loc:update', onLoc)
      sock.off('watch:accepted', onAccepted)
      sock.off('watch:declined', onDeclined)
      sock.off('watch:stop', onStop)
      sock.off('rtc:offer', onOffer)
      sock.off('rtc:ice', onIce)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const attach = async () => {
    setAttachError(null)
    try {
      const r = await api.attachChild(code)
      setCode('')
      loadChildren()
      showToast(`${r.child.name} подключён(а) — теперь вы рядом 💜`)
    } catch (e) {
      setAttachError((e as Error).message)
    }
  }

  const openChildObj = children.find((c) => c.id === openChild)

  const requestWatch = (childId: string, type: WatchType) => {
    sock.emit('watch:request', { childId, type })
    setWatch({ status: 'pending', type, sessionId: '', stream: null })
  }
  const switchWatch = (childId: string, type: WatchType) => {
    sock.emit('watch:switch', { childId, type })
    setWatch((w) => ({ ...w, type, stream: null }))
  }
  const stopWatch = (childId: string) => {
    sock.emit('watch:stop', { to: childId })
    cleanupWatch()
  }
  const sendAdvice = (childId: string, title: string, text: string) => {
    sock.emit('advice:send', { childId, title, text })
    showToast('Совет отправлен ребёнку 💬')
  }

  return (
    <div className="app">
      <div className="header">
        <div className="row">
          {openChildObj && (
            <button
              className="icon-btn"
              onClick={() => {
                if (watch.status !== 'idle') stopWatch(openChildObj.id)
                setOpenChild(null)
              }}
            >
              ←
            </button>
          )}
          <div className="grow">
            <div className="header-title">{openChildObj ? `${openChildObj.avatar} ${openChildObj.name}` : 'Родительский центр'}</div>
            <div className="header-sub">{openChildObj ? 'Вы рядом — и всегда поможете' : `${user.name}, ваши дети под присмотром`}</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Выйти">⏻</button>
        </div>
      </div>

      <div className="screen">
        {!openChildObj && (
          <>
            {children.map((c) => (
              <button key={c.id} className="card clickable" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpenChild(c.id)}>
                <div className="row">
                  <div className="avatar">{c.avatar}</div>
                  <div className="grow">
                    <div className="name-line">
                      {c.name} <span className={`dot ${c.online ? 'online' : ''}`} />
                    </div>
                    <div className="muted">
                      {c.online ? 'в сети' : 'не в сети'}
                      {c.lastLocation ? ` · был(а) там: ${fmtAgo(c.lastLocation.at)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 24 }}>➡️</span>
                </div>
              </button>
            ))}

            <div className="card">
              <h3>➕ Подключить ребёнка</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Ребёнок открывает приложение → раздел <b>«Я»</b> → <b>«Подключить родителя»</b> и показывает код. Введите его здесь:
              </p>
              <div className="chat-input-row">
                <input
                  className="input"
                  placeholder="Например: A3F9C2"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ letterSpacing: 4, textAlign: 'center' }}
                />
                <button className="btn primary send-btn" disabled={code.length < 4} onClick={() => void attach()}>
                  ✔
                </button>
              </div>
              {attachError && <p className="badge warn mt8" style={{ display: 'block', padding: '8px 12px' }}>{attachError}</p>}
            </div>

            <div className="card">
              <h3>Что даёт родительский контроль</h3>
              <p>📍 <b>Мгновенное местоположение</b> — где ребёнок прямо сейчас</p>
              <p>👀 <b>Камера и микрофон по запросу</b> — увидеть, что происходит, и услышать</p>
              <p>💬 <b>Советы</b> — отправить подсказку, как действовать при опасности</p>
              <p>🆘 <b>SOS-сигнал</b> — если ребёнку страшно, вы узнаете первыми</p>
            </div>
          </>
        )}

        {openChildObj && (
          <ChildDashboard
            key={openChildObj.id}
            child={openChildObj}
            watch={watch}
            onRequestWatch={(t) => requestWatch(openChildObj.id, t)}
            onSwitchWatch={(t) => switchWatch(openChildObj.id, t)}
            onStopWatch={() => stopWatch(openChildObj.id)}
            onSendAdvice={(title, text) => sendAdvice(openChildObj.id, title, text)}
            onLocFix={(fix) =>
              setChildren((prev) => prev.map((c) => (c.id === openChildObj.id ? { ...c, lastLocation: fix } : c)))
            }
          />
        )}
      </div>

      {sosAlert && (
        <div className="modal-back">
          <div className="modal sos-alert center">
            <div style={{ fontSize: 50 }}>🆘</div>
            <h2 className="modal-title">SOS от {sosAlert.child?.name}!</h2>
            <p className="muted">{fmtTime(sosAlert.at)} · {fmtAgo(sosAlert.at)}</p>
            {sosAlert.lat != null && sosAlert.lng != null ? (
              <a className="btn teal block" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${sosAlert.lat}&mlon=${sosAlert.lng}#map=16/${sosAlert.lat}/${sosAlert.lng}`}>
                📍 Показать на карте
              </a>
            ) : (
              <p className="muted">Местоположение неизвестно</p>
            )}
            {sosAlert.child?.contactType === 'phone' && (
              <a className="btn green block mt8" href={`tel:${sosAlert.child.contact}`}>📞 Позвонить {sosAlert.child.contact}</a>
            )}
            <div className="mt8" />
            <button className="btn ghost block" onClick={() => setSosAlert(null)}>Я в курсе</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ================= Дашборд ребёнка ================= */

function ChildDashboard({
  child,
  watch,
  onRequestWatch,
  onSwitchWatch,
  onStopWatch,
  onSendAdvice,
  onLocFix,
}: {
  child: ChildInfo
  watch: WatchState
  onRequestWatch: (t: WatchType) => void
  onSwitchWatch: (t: WatchType) => void
  onStopWatch: () => void
  onSendAdvice: (title: string, text: string) => void
  onLocFix: (fix: LocationFix) => void
}) {
  const [section, setSection] = useState<Section>('place')
  const [overview, setOverview] = useState<{
    friends: User[]
    chats: { friend: User; messages: Message[] }[]
    sosEvents: SosEvent[]
  } | null>(null)
  const [openFriend, setOpenFriend] = useState<string | null>(null)
  const [adviceLib, setAdviceLib] = useState<AdviceItem[]>([])

  const loadOverview = useCallback(() => {
    api.childOverview(child.id).then((r) => setOverview({ friends: r.friends, chats: r.chats, sosEvents: r.sosEvents })).catch(() => {})
  }, [child.id])

  useEffect(() => {
    loadOverview()
    api.advice().then((r) => setAdviceLib(r.advice)).catch(() => {})
    const onLoc = (p: { childId: string; lat: number; lng: number; acc: number | null; at: number }) => {
      if (p.childId === child.id) onLocFix({ lat: p.lat, lng: p.lng, acc: p.acc, at: p.at })
    }
    const onSosChild = (p: { childId: string }) => {
      if (p.childId === child.id) loadOverview()
    }
    sock.on('loc:update', onLoc)
    sock.on('sos', onSosChild)
    return () => {
      sock.off('loc:update', onLoc)
      sock.off('sos', onSosChild)
    }
  }, [child.id, loadOverview, onLocFix])

  const loc = child.lastLocation
  const secs: { id: Section; icon: string; label: string }[] = [
    { id: 'place', icon: '📍', label: 'Место' },
    { id: 'watch', icon: '👀', label: 'Смотреть' },
    { id: 'friends', icon: '👥', label: 'Друзья' },
    { id: 'sos', icon: '🆘', label: 'SOS' },
    { id: 'advice', icon: '🧭', label: 'Советы' },
  ]

  const chat = overview?.chats.find((c) => c.friend.id === openFriend)

  return (
    <div>
      <div className="card row between">
        <div>
          <div className="name-line">
            {child.name} <span className={`dot ${child.online ? 'online' : ''}`} />
          </div>
          <div className="muted">
            {child.online ? 'в сети' : 'не в сети'} · {child.shareLocation ? 'местоположение включено' : 'местоположение выключено'}
          </div>
        </div>
        <button className="btn small teal" onClick={() => sock.emit('loc:request', { childId: child.id })}>
          📍 Где сейчас
        </button>
      </div>

      <div className="seg mb0" style={{ marginBottom: 14 }}>
        {secs.map((s) => (
          <button key={s.id} className={section === s.id ? 'active' : ''} onClick={() => { setSection(s.id); if (s.id !== 'friends') setOpenFriend(null) }}>
            <span> {s.icon} </span>
            <div>{s.label}</div>
          </button>
        ))}
      </div>

      {section === 'place' && <PlaceSection loc={loc} child={child} />}
      {section === 'watch' && (
        <WatchPanel
          childName={child.name}
          watch={watch}
          onRequest={onRequestWatch}
          onSwitch={onSwitchWatch}
          onStop={onStopWatch}
          onSendAdvice={onSendAdvice}
        />
      )}

      {section === 'friends' && (
        <div className="card">
          <h3>👥 Друзья {child.name} ({overview?.friends.length ?? 0})</h3>
          {overview && overview.friends.length === 0 && <p className="muted">Пока нет друзей — помогите ребёнку заполнить интересы.</p>}
          {openFriend && chat ? (
            <>
              <button className="btn small ghost mb0" onClick={() => setOpenFriend(null)} style={{ marginBottom: 10 }}>← Ко всем друзьям</button>
              <div className="muted" style={{ marginBottom: 6 }}>Переписка с {chat.friend.avatar} {chat.friend.name}</div>
              <div className="chat-scroll" style={{ maxHeight: 320, background: '#f7f5ff', borderRadius: 14, padding: 10 }}>
                {chat.messages.length === 0 && <p className="muted center">Сообщений пока нет</p>}
                {chat.messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.from === child.id ? 'mine' : ''}`}>
                    {m.text}
                    <span className="t">{fmtTime(m.at)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            overview?.friends.map((f) => (
              <button key={f.id} className="list-item clickable" onClick={() => setOpenFriend(f.id)}>
                <div className="avatar avatar-sm">{f.avatar}</div>
                <div className="grow">
                  <div className="name-line">{f.name}</div>
                  <div className="muted">{f.age} лет · {f.interests.slice(0, 3).join(' · ')}</div>
                </div>
                <span>💬</span>
              </button>
            ))
          )}
        </div>
      )}

      {section === 'sos' && (
        <div className="card">
          <h3>🆘 История сигналов SOS</h3>
          {!overview || overview.sosEvents.length === 0 ? (
            <p className="muted">Сигналов не было — всё спокойно 💚</p>
          ) : (
            overview.sosEvents.map((ev) => (
              <div key={ev.id} className="row" style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>🆘</span>
                <div className="grow">
                  <b>{fmtTime(ev.at)}</b> · {fmtAgo(ev.at)}
                  {ev.lat != null && (
                    <div>
                      <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${ev.lat}&mlon=${ev.lng}#map=16/${ev.lat}/${ev.lng}`}>
                        показать на карте ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'advice' && (
        <div>
          <div className="card">
            <h3>🧭 Библиотека советов при опасности</h3>
            <p className="muted" style={{ marginTop: 0 }}>Нажмите «Отправить» — совет появится у ребёнка и будет озвучен вслух.</p>
          </div>
          {adviceLib.map((a) => (
            <div key={a.id} className="card">
              <div className="row">
                <div style={{ fontSize: 30 }}>{a.emoji}</div>
                <div className="grow">
                  <b>{a.title}</b>
                  <div className="muted mt8">{a.text}</div>
                  <div className="muted mt8" style={{ fontStyle: 'italic' }}>💡 {a.parentHint}</div>
                </div>
              </div>
              <button className="btn primary block mt8" onClick={() => onSendAdvice(a.title, a.text)}>
                📩 Отправить ребёнку
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlaceSection({ loc, child }: { loc: LocationFix | null; child: ChildInfo }) {
  if (!loc)
    return (
      <div className="card center">
        <div style={{ fontSize: 40 }}>📡</div>
        <h3>Местоположение неизвестно</h3>
        <p className="muted">
          {child.shareLocation
            ? 'Ждём первые координаты… Нажмите «Где сейчас» ещё раз через пару секунд.'
            : `Ребёнок выключил показ местоположения. Попросите ${child.name} включить его в разделе «Я».`}
        </p>
      </div>
    )

  const d = 0.006
  const bbox = `${loc.lng - d},${loc.lat - d / 1.6},${loc.lng + d},${loc.lat + d / 1.6}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.lat},${loc.lng}`

  return (
    <div>
      <div className="card">
        <h3>📍 {child.name} сейчас здесь</h3>
        <iframe className="map-frame" src={src} title="Карта" loading="lazy" />
        <div className="stat-grid mt8">
          <div className="stat">
            <div className="v">{loc.lat.toFixed(5)}</div>
            <div className="k">широта</div>
          </div>
          <div className="stat">
            <div className="v">{loc.lng.toFixed(5)}</div>
            <div className="k">долгота</div>
          </div>
          <div className="stat">
            <div className="v">±{Math.round(loc.acc || 0)} м</div>
            <div className="k">точность</div>
          </div>
          <div className="stat">
            <div className="v">{fmtAgo(loc.at)}</div>
            <div className="k">обновлено</div>
          </div>
        </div>
        <a className="btn teal block mt8" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`}>
          🗺 Открыть большую карту
        </a>
      </div>
      {child.contactType === 'phone' && (
        <a className="btn green block" href={`tel:${child.contact}`}>📞 Позвонить {child.name}</a>
      )}
    </div>
  )
}
