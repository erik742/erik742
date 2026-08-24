import { useEffect, useState } from 'react'
import type { User } from '../types'
import { api } from '../lib/api'
import { sock } from '../lib/socket'
import { INTERESTS, AVATARS } from '../lib/constants'

export default function MeScreen({ me, setUser, logout }: { me: User; setUser: (u: User) => void; logout: () => void }) {
  const [name, setName] = useState(me.name)
  const [age, setAge] = useState(String(me.age ?? ''))
  const [avatar, setAvatar] = useState(me.avatar)
  const [interests, setInterests] = useState<string[]>(me.interests)
  const [shareLocation, setShareLocation] = useState(me.shareLocation)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [parents, setParents] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.me().then((r) => setParents(r.parents)).catch(() => {})
    const onLinked = (p: { parent: User }) => {
      setParents((prev) => (prev.some((x) => x.id === p.parent.id) ? prev : [...prev, p.parent]))
      setLinkCode(null)
    }
    sock.on('family:linked', onLinked)
    return () => {
      sock.off('family:linked', onLinked)
    }
  }, [])

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 12 ? [...prev, i] : prev))

  const saveProfile = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const r = await api.profile({
        name,
        avatar,
        age: me.role === 'teen' && age ? Number(age) : undefined,
        interests,
        shareLocation,
      })
      setUser(r.user)
      setParents(r.parents)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const genCode = async () => {
    try {
      const r = await api.linkCode()
      setLinkCode(r.code)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div>
      <div className="card center">
        <div className="avatar avatar-lg" style={{ margin: '0 auto' }}>{avatar}</div>
        <h3 className="mt8">{me.name}, {me.age} лет</h3>
        <div className="muted">{me.contactType === 'phone' ? '📱 ' + me.contact : '✉️ ' + me.contact}</div>
      </div>

      <div className="card">
        <h3>Выбери себя 🎭</h3>
        <div className="wrap">
          {AVATARS.map((a) => (
            <button
              key={a}
              className="chip"
              style={{ fontSize: 24, width: 62, height: 62, padding: 0, margin: '0 8px 8px 0' }}
              onClick={() => setAvatar(a)}
            >
              <span style={{ opacity: avatar === a ? 1 : 0.45 }}>{a}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Мои интересы 🧩</h3>
        <p className="muted" style={{ marginTop: 0 }}>Чем больше выберешь, тем проще найти друзей!</p>
        <div className="wrap">
          {INTERESTS.map((i) => (
            <button key={i} className={`chip ${interests.includes(i) ? 'active' : ''}`} onClick={() => toggleInterest(i)}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Обо мне</h3>
        <div className="field">
          <label className="label">Имя</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Возраст</label>
          <input className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </div>

      <div className="card">
        <h3>Родители 👨‍👩‍👧</h3>
        {parents.length === 0 && <p className="muted">Родители ещё не подключены.</p>}
        {parents.map((p) => (
          <div key={p.id} className="row" style={{ marginBottom: 8 }}>
            <div className="avatar avatar-sm">{p.avatar}</div>
            <div className="grow">
              <b>{p.name}</b>
              <div className="muted">родитель · на связи</div>
            </div>
            <span className="badge ok">подключён</span>
          </div>
        ))}

        {linkCode ? (
          <div className="mt8 center">
            <p className="muted">Покажи этот код родителю — он введёт его в своём приложении:</p>
            <div className="link-code">{linkCode}</div>
            <p className="muted">Код действует 15 минут</p>
          </div>
        ) : (
          <button className="btn teal block mt8" onClick={() => void genCode()}>
            🔗 Подключить родителя
          </button>
        )}

        <div className="row between mt16">
          <div className="grow">
            <b>📍 Показывать, где я</b>
            <div className="muted">Родители будут видеть твоё местоположение на карте</div>
          </div>
          <button className={`switch ${shareLocation ? 'on' : ''}`} onClick={() => setShareLocation(!shareLocation)} />
        </div>
      </div>

      <button className="btn primary block" disabled={saving} onClick={() => void saveProfile()}>
        {saving ? 'Сохраняем…' : saved ? '✅ Сохранено!' : '💾 Сохранить'}
      </button>
      <div className="mt8" />
      <button className="btn ghost block" onClick={logout}>Выйти из аккаунта</button>
    </div>
  )
}
