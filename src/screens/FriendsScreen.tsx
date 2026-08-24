import { useCallback, useEffect, useState } from 'react'
import type { User } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'
import { speak } from '../lib/tts'

export default function FriendsScreen({ onOpenChat }: { onOpenChat: (u: User) => void }) {
  const [friends, setFriends] = useState<User[]>([])
  const [incoming, setIncoming] = useState<{ request: { id: string }; from: User | null }[]>([])
  const [outgoing, setOutgoing] = useState<{ request: { id: string }; to: User | null }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    api
      .friends()
      .then((r) => {
        setFriends(r.friends)
        setIncoming(r.incoming)
        setOutgoing(r.outgoing)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const onNew = (p: { from: User }) => {
      load()
      speak(`${p.from?.name || 'Кто-то'} хочет с тобой дружить!`)
    }
    const onUpdate = () => load()
    const onPresence = () => load()
    sock.on('friends:newRequest', onNew)
    sock.on('friends:update', onUpdate)
    sock.on('presence', onPresence)
    return () => {
      sock.off('friends:newRequest', onNew)
      sock.off('friends:update', onUpdate)
      sock.off('presence', onPresence)
    }
  }, [load])

  const respond = async (requestId: string, accept: boolean) => {
    try {
      await api.respondFriend(requestId, accept)
      if (accept) speak('Теперь вы друзья! Ура!')
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (loading) return <div className="empty">Загружаем друзей…</div>

  return (
    <div>
      {incoming.length > 0 && (
        <>
          <h3 style={{ marginLeft: 4 }}>Хотят дружить 📨</h3>
          {incoming.map(({ request, from }) => (
            <div key={request.id} className="card">
              <div className="row">
                <div className="avatar">{from?.avatar || '🙂'}</div>
                <div className="grow">
                  <div className="name-line">{from?.name}</div>
                  <div className="muted">{from?.age} лет · {from?.interests.slice(0, 2).join(', ')}</div>
                </div>
              </div>
              <div className="btn-row mt8">
                <button className="btn ghost" onClick={() => void respond(request.id, false)}>Позже</button>
                <button className="btn green" onClick={() => void respond(request.id, true)}>✔ Дружить</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h3 style={{ marginLeft: 4 }}>Мои друзья ({friends.length})</h3>
      {friends.length === 0 && (
        <div className="empty">
          <div className="big">👋</div>
          Пока нет друзей. Открой раздел <b>«Найти»</b> — там ребята с похожими интересами!
        </div>
      )}
      {friends.map((f) => (
        <button key={f.id} className="list-item clickable" onClick={() => onOpenChat(f)}>
          <div className="avatar">{f.avatar}</div>
          <div className="grow">
            <div className="name-line">
              {f.name} <span className={`dot ${f.online ? 'online' : ''}`} />
            </div>
            <div className="muted">{f.age} лет · {f.interests.slice(0, 3).join(' · ')}</div>
          </div>
          <span style={{ fontSize: 24 }}>💬</span>
        </button>
      ))}

      {outgoing.length > 0 && (
        <>
          <h3 style={{ marginLeft: 4, marginTop: 18 }}>Мы уже пригласили ⏳</h3>
          {outgoing.map(({ request, to }) => (
            <div key={request.id} className="list-item" style={{ opacity: 0.7 }}>
              <div className="avatar">{to?.avatar || '🙂'}</div>
              <div className="grow">
                <div className="name-line">{to?.name}</div>
                <div className="muted">Ждём ответа…</div>
              </div>
              <span>⏳</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
