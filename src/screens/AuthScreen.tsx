import { useState } from 'react'
import type { User } from '../types'
import { api } from '../lib/api'
import { authenticate } from '../lib/socket'
import { speak } from '../lib/tts'

type Mode = 'start' | 'login' | 'register'

export default function AuthScreen({ onAuth }: { onAuth: (user: User, token: string) => void }) {
  const [mode, setMode] = useState<Mode>('start')
  const [role, setRole] = useState<'teen' | 'parent'>('teen')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // шаг подтверждения кодом из SMS / письма
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [pendingContact, setPendingContact] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [code, setCode] = useState('')

  const goStart = () => {
    setMode('start')
    setStep('form')
    setError(null)
  }

  const register = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await api.register({ role, name, contact, password, age: age ? Number(age) : undefined })
      setPendingContact(r.contact)
      setDemoCode(r.demoCode)
      setCode('')
      setStep('verify')
      speak('Мы отправили код подтверждения. Введите пять цифр.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await api.verify({ contact: pendingContact, code })
      await authenticate(r.token)
      onAuth(r.user, r.token)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const login = async () => {
    setError(null)
    setBusy(true)
    try {
      const r = await api.login({ contact, password })
      await authenticate(r.token)
      onAuth(r.user, r.token)
    } catch (e) {
      const err = e as Error & { data?: { needVerify?: boolean; demoCode?: string; contact?: string } }
      if (err.data?.needVerify) {
        setPendingContact(contact)
        setDemoCode(String(err.data.demoCode || ''))
        setCode('')
        setStep('verify')
      } else {
        setError(err.message)
      }
      setBusy(false)
    }
  }

  if (mode === 'start')
    return (
      <div className="auth-wrap">
        <div className="brand">
          <div className="logo">🧩</div>
          <h1>Вместе</h1>
          <div className="tag">Друзья рядом — приложение для особенных подростков</div>
        </div>

        <div className="card mt16">
          <h3>Что умеет «Вместе»</h3>
          <p>👥 Находи друзей по общим интересам</p>
          <p>📞 Звонки — аудио и видео</p>
          <p>💬 Простой чат с готовыми фразами</p>
          <p>👨‍👩‍👧 Родители рядом: видят, где ты, и всегда помогут</p>
        </div>

        <button className="btn primary block" onClick={() => setMode('register')}>
          Создать аккаунт
        </button>
        <div className="mt8" />
        <button className="btn ghost block" onClick={() => setMode('login')}>
          У меня уже есть аккаунт
        </button>

        <p className="muted center mt16">
          Демо-подросток для входа: <b>+79000000001</b>, пароль <b>demo1234</b>
        </p>
      </div>
    )

  if (step === 'verify')
    return (
      <div className="auth-wrap">
        <div className="brand">
          <div className="logo">✉️</div>
          <h1>Подтверждение</h1>
          <div className="tag">Мы отправили код на {pendingContact}</div>
        </div>

        <div className="demo-code">
          <div className="muted">Демо-режим: код здесь (в реальном приложении придёт по SMS или почте)</div>
          <div className="code">{demoCode}</div>
        </div>

        <div className="field">
          <label className="label">Введите 5 цифр из сообщения</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="•••••"
            value={code}
            maxLength={5}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ fontSize: 28, textAlign: 'center', letterSpacing: 12 }}
          />
        </div>

        {error && <p className="badge warn" style={{ display: 'block', padding: '10px 14px' }}>{error}</p>}

        <button className="btn primary block" disabled={busy || code.length !== 5} onClick={verify}>
          {busy ? 'Проверяем…' : 'Подтвердить'}
        </button>
        <div className="mt8" />
        <button className="btn ghost block" onClick={goStart}>
          Назад
        </button>
      </div>
    )

  if (mode === 'register')
    return (
      <div className="auth-wrap">
        <div className="brand">
          <div className="logo">🧩</div>
          <h1>Регистрация</h1>
          <div className="tag">Кто будет пользоваться приложением?</div>
        </div>

        <button className={`role-card ${role === 'teen' ? 'active' : ''}`} onClick={() => setRole('teen')}>
          <span className="ico">🧒</span>
          <span>
            <span className="t">Подросток</span>
            <div className="d">Искать друзей, общаться и звонить</div>
          </span>
        </button>
        <button className={`role-card ${role === 'parent' ? 'active' : ''}`} onClick={() => setRole('parent')}>
          <span className="ico">👩</span>
          <span>
            <span className="t">Родитель</span>
            <div className="d">Быть рядом и помогать: местоположение, связь, советы</div>
          </span>
        </button>

        <div className="field mt8">
          <label className="label">Имя</label>
          <input className="input" placeholder={role === 'teen' ? 'Например, Миша' : 'Например, Елена'} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {role === 'teen' && (
          <div className="field">
            <label className="label">Сколько лет</label>
            <input className="input" inputMode="numeric" placeholder="от 10 до 25" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </div>
        )}

        <div className="field">
          <label className="label">Телефон или почта</label>
          <input className="input" placeholder="+7 900 123-45-67 или mama@mail.ru" value={contact} onChange={(e) => setContact(e.target.value)} />
          <div className="muted mt8">На этот адрес придёт код подтверждения</div>
        </div>

        <div className="field">
          <label className="label">Пароль (не короче 4 символов)</label>
          <input className="input" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="badge warn" style={{ display: 'block', padding: '10px 14px' }}>{error}</p>}

        <button className="btn primary block" disabled={busy} onClick={register}>
          {busy ? 'Отправляем код…' : 'Зарегистрироваться'}
        </button>
        <div className="mt8" />
        <button className="btn ghost block" onClick={goStart}>
          Назад
        </button>
      </div>
    )

  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="logo">👋</div>
        <h1>Вход</h1>
        <div className="tag">Рады видеть снова!</div>
      </div>

      <div className="field">
        <label className="label">Телефон или почта</label>
        <input className="input" placeholder="+7 900 123-45-67 или mama@mail.ru" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Пароль</label>
        <input className="input" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <p className="badge warn" style={{ display: 'block', padding: '10px 14px' }}>{error}</p>}

      <button className="btn primary block" disabled={busy} onClick={login}>
        {busy ? 'Входим…' : 'Войти'}
      </button>
      <div className="mt8" />
      <button className="btn ghost block" onClick={goStart}>
        Назад
      </button>
      <p className="muted center mt16">Демо-подросток: +79000000001 / demo1234</p>
    </div>
  )
}
