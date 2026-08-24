import { useEffect, useState } from 'react'
import type { User } from './types'
import { api, getToken, setToken } from './lib/api'
import { authenticate } from './lib/socket'
import AuthScreen from './screens/AuthScreen'
import TeenApp from './screens/TeenApp'
import ParentApp from './screens/ParentApp'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = getToken()
    if (!t) {
      setReady(true)
      return
    }
    api
      .me()
      .then((r) => {
        setUser(r.user)
        void authenticate(t)
      })
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  const logout = async () => {
    try {
      await api.logout()
    } catch {
      /* уже вышли */
    }
    setToken(null)
    location.reload()
  }

  if (!ready)
    return (
      <div className="splash">
        <div className="splash-logo">🧩</div>
        <div>Вместе</div>
      </div>
    )

  if (!user) return <AuthScreen onAuth={(u, t) => { setToken(t); setUser(u) }} />

  return user.role === 'teen' ? (
    <TeenApp user={user} setUser={setUser} logout={logout} />
  ) : (
    <ParentApp user={user} logout={logout} />
  )
}
