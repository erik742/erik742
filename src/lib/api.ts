import type { User } from '../types'

const TOKEN_KEY = 'vmeste_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

interface ApiError extends Error { data?: Record<string, unknown> }

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) {
    const err: ApiError = Object.assign(new Error(String(data.error || 'Ошибка сети')), { data })
    throw err
  }
  return data as T
}

export const api = {
  register: (b: { role: string; name: string; contact: string; password: string; age?: number }) =>
    req<{ userId: string; contact: string; contactType: string; demoCode: string }>('/auth/register', { method: 'POST', body: b }),
  verify: (b: { contact: string; code: string }) =>
    req<{ token: string; user: User }>('/auth/verify', { method: 'POST', body: b }),
  login: (b: { contact: string; password: string }) =>
    req<{ token: string; user: User }>('/auth/login', { method: 'POST', body: b }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => req<{ user: User; parents: User[] }>('/me'),
  profile: (b: Partial<{ name: string; avatar: string; age: number; interests: string[]; shareLocation: boolean }>) =>
    req<{ user: User; parents: User[] }>('/profile', { method: 'POST', body: b }),
  discover: () => req<{ users: import('../types').DiscoverUser[] }>('/discover'),
  friends: () => req<{
    friends: User[]
    incoming: import('../types').IncomingRequest[]
    outgoing: import('../types').OutgoingRequest[]
  }>('/friends'),
  requestFriend: (to: string) => req<{ ok: boolean }>('/friends/request', { method: 'POST', body: { to } }),
  respondFriend: (requestId: string, accept: boolean) => req<{ ok: boolean }>('/friends/respond', { method: 'POST', body: { requestId, accept } }),
  messages: (peer: string) => req<{ messages: import('../types').Message[]; peer: User | null }>(`/messages/${peer}`),
  linkCode: () => req<{ code: string; expiresIn: number }>('/link/code', { method: 'POST' }),
  attachChild: (code: string) => req<{ child: User }>('/link/attach', { method: 'POST', body: { code } }),
  children: () => req<{ children: import('../types').ChildInfo[] }>('/parent/children'),
  childOverview: (cid: string) => req<{
    child: User
    friends: User[]
    chats: { friend: User; messages: import('../types').Message[] }[]
    sosEvents: import('../types').SosEvent[]
    lastLocation: import('../types').LocationFix | null
  }>(`/parent/child/${cid}`),
  advice: () => req<{ advice: import('../types').AdviceItem[] }>('/advice'),
}
