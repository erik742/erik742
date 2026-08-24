import { useCallback, useEffect, useState } from 'react'
import type { DiscoverUser, User } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'

export default function DiscoverScreen({ me }: { me: User }) {
  const [users, setUsers] = useState<DiscoverUser[]>([])
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    api
      .discover()
      .then((r) => setUsers(r.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const onUpdate = () => load()
    sock.on('friends:update', onUpdate)
    sock.on('friends:newRequest', onUpdate)
    return () => {
      sock.off('friends:update', onUpdate)
      sock.off('friends:newRequest', onUpdate)
    }
  }, [load])

  const invite = async (u: DiscoverUser) => {
    try {
      await api.requestFriend(u.id)
      setInvited((s) => new Set(s).add(u.id))
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (loading) return <div className="empty">Ищем ребят…</div>

  if (me.interests.length === 0)
    return (
      <div className="empty">
        <div className="big">🧩</div>
        Сначала выбери, что тебе нравится — в разделе <b>«Я»</b>.<br />
        Тогда мы найдём ребят с такими же интересами!
      </div>
    )

  return (
    <div>
      <div className="card" style={{ background: '#f4f0ff' }}>
        <b>Как это работает?</b>
        <div className="muted mt8">
          Мы показываем ребят, чьи интересы похожи на твои 🧩. Нажми «Дружить» — когда человек согласится, вы сможете общаться и звонить.
        </div>
      </div>

      {users.length === 0 && (
        <div className="empty">
          <div className="big">🔎</div>
          Мы уже пригласили всех похожих ребят. Загляни позже!
        </div>
      )}

      {users.map((u) => (
        <div key={u.id} className="card">
          <div className="row">
            <div className="avatar">{u.avatar}</div>
            <div className="grow">
              <div className="name-line">
                {u.name} <span className={`dot ${u.online ? 'online' : ''}`} />
              </div>
              <div className="muted">{u.age} лет {u.online ? '· в сети' : ''}</div>
            </div>
            {u.common.length > 0 && <span className="badge">совпадений: {u.common.length}</span>}
          </div>

          {u.common.length > 0 && (
            <div className="mt8 wrap">
              {u.common.map((c) => (
                <span key={c} className="chip active" style={{ margin: '0 6px 6px 0' }}>{c}</span>
              ))}
            </div>
          )}
          {u.interests.filter((i) => !u.common.includes(i)).length > 0 && (
            <div className="muted mt8">Ещё любит: {u.interests.filter((i) => !u.common.includes(i)).slice(0, 4).join(' · ')}</div>
          )}

          <button className="btn primary block mt8" disabled={invited.has(u.id)} onClick={() => void invite(u)}>
            {invited.has(u.id) ? '✅ Приглашение отправлено' : '🤝 Дружить'}
          </button>
        </div>
      ))}
    </div>
  )
}
