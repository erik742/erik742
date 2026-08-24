import express from 'express'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { db, save, saveNow } from './store.mjs'
import { ADVICE } from './advice.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.use(express.json({ limit: '1mb' }))
const server = http.createServer(app)
const io = new Server(server)

const id = () => crypto.randomBytes(8).toString('hex')
const now = () => Date.now()
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex')

/* ---------------- helpers ---------------- */

function parseContact(raw) {
  const s = String(raw || '').trim()
  if (!s) return { err: 'Введите телефон или почту' }
  if (s.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { err: 'Похоже, в адресе почты ошибка' }
    return { type: 'email', value: s.toLowerCase() }
  }
  let digits = s.replace(/\D/g, '')
  if (!digits) return { err: 'Введите телефон или почту' }
  if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) digits = '7' + digits.slice(1)
  if (digits.length < 8 || digits.length > 15) return { err: 'Проверьте номер телефона' }
  return { type: 'phone', value: '+' + digits }
}

const online = new Map() // uid -> количество сокетов
function isOnline(uid) {
  return (online.get(uid) || 0) > 0
}
function pubUser(u) {
  return u && {
    id: u.id,
    role: u.role,
    name: u.name,
    avatar: u.avatar || '🙂',
    age: u.age || null,
    interests: u.interests || [],
    contactType: u.contactType,
    contact: u.contact,
    shareLocation: !!u.shareLocation,
    parentIds: u.parentIds || [],
    childIds: u.childIds || [],
    online: isOnline(u.id),
  }
}
const findUser = (pred) => db.users.find(pred)

function requireAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '')
  const uid = t && db.sessions[t]
  const u = uid && db.users.find((x) => x.id === uid)
  if (!u) return res.status(401).json({ error: 'Нужно войти в аккаунт' })
  req.user = u
  req.token = t
  next()
}

function friendIdsOf(uid) {
  const set = new Set()
  for (const [a, b] of db.friendships) {
    if (a === uid) set.add(b)
    if (b === uid) set.add(a)
  }
  return [...set]
}

function emitTo(uid, ev, payload) {
  io.to('u_' + uid).emit(ev, payload)
}

function pushMsg(from, to, text, kind = 'text') {
  const m = { id: id(), from, to, text, at: now(), kind }
  db.messages.push(m)
  save()
  emitTo(to, 'message:new', m)
  emitTo(from, 'message:new', m)
  return m
}

/* ---------------- демо-ребята ---------------- */

function seedDemo() {
  if (db.users.some((u) => u.demo)) return
  const seed = [
    { name: 'Лена', age: 13, avatar: '🦄', interests: ['🎵 Музыка', '🎨 Рисование', '🎬 Кино и мультики'] },
    { name: 'Максим', age: 14, avatar: '🦊', interests: ['🎮 Игры', '💻 Компьютеры', '🤖 Роботы'] },
    { name: 'Аня', age: 12, avatar: '🐨', interests: ['🐶 Животные', '🌿 Природа', '📚 Книги'] },
    { name: 'Дима', age: 15, avatar: '🚀', interests: ['🌌 Космос', '🚆 Транспорт', '🧩 Головоломки'] },
    { name: 'Соня', age: 13, avatar: '🦋', interests: ['🎨 Рисование', '✂️ Поделки', '🍕 Готовка'] },
    { name: 'Кирилл', age: 16, avatar: '🐬', interests: ['🏊 Плавание', '⚽ Спорт', '🎮 Игры'] },
    { name: 'Настя', age: 14, avatar: '🌟', interests: ['🎵 Музыка', '📚 Книги', '🌿 Природа'] },
    { name: 'Тимур', age: 15, avatar: '🐯', interests: ['⚽ Спорт', '🎮 Игры', '💻 Компьютеры'] },
  ]
  seed.forEach((s, i) => {
    const salt = crypto.randomBytes(8).toString('hex')
    db.users.push({
      id: id(),
      role: 'teen',
      demo: true,
      name: s.name,
      contactType: 'phone',
      contact: '+7900000000' + (i + 1),
      salt,
      passHash: hashPw('demo1234', salt),
      verifyCode: '00000',
      verified: true,
      avatar: s.avatar,
      interests: s.interests,
      age: s.age,
      shareLocation: false,
      parentIds: [],
      childIds: [],
      createdAt: now(),
    })
  })
  saveNow()
  console.log(`[seed] создано демо-подростков: ${seed.length} (пароль demo1234)`)
}

const DEMO_REPLIES = [
  'Привет! Спасибо, что написал 😊',
  'Классно! Мне тоже это нравится!',
  'Как проходит твой день?',
  'Давай дружить! 🎉',
  'Супер! Расскажи ещё 🙌',
  'Мне нравится с тобой общаться!',
  'Давай как-нибудь созвонимся 📞',
]

/* ---------------- auth API ---------------- */

app.post('/api/auth/register', (req, res) => {
  const { role, name, contact, password, age } = req.body || {}
  if (!['teen', 'parent'].includes(role)) return res.status(400).json({ error: 'Выберите, кто вы: подросток или родитель' })
  const nm = String(name || '').trim()
  if (nm.length < 2 || nm.length > 40) return res.status(400).json({ error: 'Введите имя (от 2 до 40 символов)' })
  if (String(password || '').length < 4) return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' })
  const c = parseContact(contact)
  if (c.err) return res.status(400).json({ error: c.err })
  if (db.users.some((u) => u.contact === c.value))
    return res.status(409).json({ error: 'Такой ' + (c.type === 'phone' ? 'номер' : 'адрес') + ' уже зарегистрирован. Попробуйте войти.' })
  let ageN = null
  if (role === 'teen') {
    ageN = parseInt(age, 10)
    if (!(ageN >= 10 && ageN <= 25)) return res.status(400).json({ error: 'Возраст подростка — от 10 до 25 лет' })
  }
  const salt = crypto.randomBytes(8).toString('hex')
  const code = String(10000 + Math.floor(Math.random() * 90000))
  const user = {
    id: id(), role, name: nm, contactType: c.type, contact: c.value,
    salt, passHash: hashPw(password, salt), verifyCode: code, verified: false,
    avatar: '🙂', interests: [], age: ageN, shareLocation: false,
    parentIds: [], childIds: [], createdAt: now(),
  }
  db.users.push(user)
  save()
  console.log(`[auth] код подтверждения для ${c.value}: ${code}`)
  // Демо-режим: код возвращается в ответе (в продакшене его отправляет SMS/почтовый сервис)
  res.json({ userId: user.id, contact: c.value, contactType: c.type, demoCode: code })
})

app.post('/api/auth/verify', (req, res) => {
  const { contact, code } = req.body || {}
  const c = parseContact(contact)
  if (c.err) return res.status(400).json({ error: c.err })
  const u = findUser((x) => x.contact === c.value)
  if (!u) return res.status(404).json({ error: 'Аккаунт не найден. Сначала зарегистрируйтесь.' })
  if (String(code || '').trim() !== u.verifyCode) return res.status(400).json({ error: 'Неверный код. Проверьте цифры.' })
  u.verified = true
  const token = crypto.randomBytes(24).toString('hex')
  db.sessions[token] = u.id
  save()
  res.json({ token, user: pubUser(u) })
})

app.post('/api/auth/login', (req, res) => {
  const { contact, password } = req.body || {}
  const c = parseContact(contact)
  if (c.err) return res.status(400).json({ error: c.err })
  const u = findUser((x) => x.contact === c.value)
  if (!u || u.passHash !== hashPw(password || '', u.salt))
    return res.status(401).json({ error: 'Неверный телефон/почта или пароль' })
  if (!u.verified)
    return res.status(403).json({ error: 'Аккаунт не подтверждён — введите код', needVerify: true, contact: u.contact, demoCode: u.verifyCode })
  const token = crypto.randomBytes(24).toString('hex')
  db.sessions[token] = u.id
  save()
  res.json({ token, user: pubUser(u) })
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  delete db.sessions[req.token]
  save()
  res.json({ ok: true })
})

app.get('/api/me', requireAuth, (req, res) => {
  const parents = (req.user.parentIds || []).map((p) => pubUser(findUser((u) => u.id === p))).filter(Boolean)
  res.json({ user: pubUser(req.user), parents })
})

app.post('/api/profile', requireAuth, (req, res) => {
  const u = req.user
  const b = req.body || {}
  if (b.name !== undefined) {
    const nm = String(b.name).trim()
    if (nm.length >= 2 && nm.length <= 40) u.name = nm
  }
  if (b.avatar !== undefined && typeof b.avatar === 'string') u.avatar = b.avatar.slice(0, 4) || '🙂'
  if (b.age !== undefined && u.role === 'teen') {
    const a = parseInt(b.age, 10)
    if (a >= 10 && a <= 25) u.age = a
  }
  if (Array.isArray(b.interests)) u.interests = b.interests.filter((x) => typeof x === 'string').slice(0, 12)
  if (b.shareLocation !== undefined) u.shareLocation = !!b.shareLocation
  save()
  const parents = (u.parentIds || []).map((p) => pubUser(findUser((x) => x.id === p))).filter(Boolean)
  res.json({ user: pubUser(u), parents })
})

/* ---------------- друзья ---------------- */

app.get('/api/discover', requireAuth, (req, res) => {
  const me = req.user
  if (me.role !== 'teen') return res.status(403).json({ error: 'Этот раздел только для подростков' })
  const known = new Set(friendIdsOf(me.id))
  for (const r of db.friendRequests) {
    if (r.status === 'pending') {
      known.add(r.from)
      known.add(r.to)
    }
  }
  const list = db.users
    .filter((u) => u.role === 'teen' && u.id !== me.id && u.verified && !known.has(u.id))
    .map((u) => ({ ...pubUser(u), common: (u.interests || []).filter((i) => (me.interests || []).includes(i)) }))
    .sort((a, b) => b.common.length - a.common.length || Number(b.online) - Number(a.online))
    .slice(0, 40)
  res.json({ users: list })
})

app.post('/api/friends/request', requireAuth, (req, res) => {
  const to = String(req.body?.to || '')
  const target = findUser((u) => u.id === to)
  if (!target || target.id === req.user.id || target.role !== 'teen') return res.status(400).json({ error: 'Пользователь не найден' })
  if (friendIdsOf(req.user.id).includes(to)) return res.status(400).json({ error: 'Вы уже друзья' })
  const dup = db.friendRequests.find(
    (r) => r.status === 'pending' && ((r.from === req.user.id && r.to === to) || (r.from === to && r.to === req.user.id))
  )
  if (dup) return res.status(400).json({ error: 'Заявка уже отправлена' })
  const r = { id: id(), from: req.user.id, to, status: 'pending', at: now() }
  db.friendRequests.push(r)
  save()
  emitTo(to, 'friends:newRequest', { request: r, from: pubUser(req.user) })

  // демо-подростки принимают заявку сами, чтобы приложение было живым
  if (target.demo) {
    setTimeout(() => {
      if (r.status !== 'pending') return
      r.status = 'accepted'
      db.friendships.push([r.from, r.to])
      save()
      emitTo(r.from, 'friends:update', { request: r, by: pubUser(target) })
      pushMsg(r.to, r.from, `Привет! Я ${target.name}, давай дружить 🎉`)
    }, 3000 + Math.random() * 3000)
  }
  res.json({ ok: true })
})

app.post('/api/friends/respond', requireAuth, (req, res) => {
  const { requestId, accept } = req.body || {}
  const r = db.friendRequests.find((x) => x.id === requestId && x.to === req.user.id && x.status === 'pending')
  if (!r) return res.status(400).json({ error: 'Заявка не найдена' })
  r.status = accept ? 'accepted' : 'declined'
  r.at = now()
  if (accept) db.friendships.push([r.from, r.to])
  save()
  emitTo(r.from, 'friends:update', { request: r, by: pubUser(req.user) })
  res.json({ ok: true })
})

app.get('/api/friends', requireAuth, (req, res) => {
  const friends = friendIdsOf(req.user.id)
    .map((uid) => pubUser(findUser((u) => u.id === uid)))
    .filter(Boolean)
  const incoming = db.friendRequests
    .filter((r) => r.to === req.user.id && r.status === 'pending')
    .map((r) => ({ request: r, from: pubUser(findUser((u) => u.id === r.from)) }))
  const outgoing = db.friendRequests
    .filter((r) => r.from === req.user.id && r.status === 'pending')
    .map((r) => ({ request: r, to: pubUser(findUser((u) => u.id === r.to)) }))
  res.json({ friends, incoming, outgoing })
})

/* ---------------- сообщения ---------------- */

app.get('/api/messages/:peerId', requireAuth, (req, res) => {
  const peer = req.params.peerId
  const msgs = db.messages
    .filter((m) => (m.from === req.user.id && m.to === peer) || (m.from === peer && m.to === req.user.id))
    .sort((a, b) => a.at - b.at)
    .slice(-300)
  res.json({ messages: msgs, peer: pubUser(findUser((u) => u.id === peer)) })
})

/* ---------------- связь родитель–ребёнок ---------------- */

app.post('/api/link/code', requireAuth, (req, res) => {
  if (req.user.role !== 'teen') return res.status(403).json({ error: 'Код создаёт подросток в своём приложении' })
  const code = crypto.randomBytes(3).toString('hex').toUpperCase()
  db.linkCodes[code] = { childId: req.user.id, at: now() }
  save()
  res.json({ code, expiresIn: 15 * 60 * 1000 })
})

app.post('/api/link/attach', requireAuth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: 'Подключить ребёнка может только родитель' })
  const code = String(req.body?.code || '').trim().toUpperCase()
  const rec = db.linkCodes[code]
  if (!rec) return res.status(400).json({ error: 'Код не найден. Попросите ребёнка открыть «Профиль» → «Родители».' })
  if (now() - rec.at > 15 * 60 * 1000) return res.status(400).json({ error: 'Код истёк. Попросите ребёнка создать новый.' })
  const child = findUser((u) => u.id === rec.childId)
  if (!child) return res.status(400).json({ error: 'Код не найден' })
  if (!req.user.childIds.includes(child.id)) req.user.childIds.push(child.id)
  if (!child.parentIds.includes(req.user.id)) child.parentIds.push(req.user.id)
  delete db.linkCodes[code]
  save()
  emitTo(child.id, 'family:linked', { parent: pubUser(req.user) })
  res.json({ child: pubUser(child) })
})

app.get('/api/parent/children', requireAuth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: 'Только для родителей' })
  const children = req.user.childIds
    .map((cid) => {
      const c = findUser((u) => u.id === cid)
      return c ? { ...pubUser(c), lastLocation: db.locations[cid] || null } : null
    })
    .filter(Boolean)
  res.json({ children })
})

app.get('/api/parent/child/:cid', requireAuth, (req, res) => {
  const cid = req.params.cid
  if (req.user.role !== 'parent' || !req.user.childIds.includes(cid)) return res.status(403).json({ error: 'Нет доступа' })
  const c = findUser((u) => u.id === cid)
  if (!c) return res.status(404).json({ error: 'Ребёнок не найден' })
  const friends = friendIdsOf(c.id).map((uid) => pubUser(findUser((u) => u.id === uid))).filter(Boolean)
  const chats = friends.map((f) => ({
    friend: f,
    messages: db.messages
      .filter((m) => (m.from === c.id && m.to === f.id) || (m.from === f.id && m.to === c.id))
      .sort((a, b) => a.at - b.at)
      .slice(-50),
  }))
  const sosEvents = db.sosEvents.filter((e) => e.childId === c.id).sort((a, b) => b.at - a.at).slice(20)
  res.json({ child: pubUser(c), friends, chats, sosEvents, lastLocation: db.locations[cid] || null })
})

app.get('/api/advice', (_req, res) => res.json({ advice: ADVICE }))
app.get('/api/health', (_req, res) => res.json({ ok: true }))

/* ---------------- сокеты: чат, звонки, родительский контроль ---------------- */

io.on('connection', (socket) => {
  let uid = null
  const GU = () => (uid ? db.users.find((u) => u.id === uid) : null)

  socket.on('auth', (token, cb) => {
    const u = token && db.users.find((x) => x.id === db.sessions[token])
    if (!u) {
      if (typeof cb === 'function') cb({ ok: false })
      return
    }
    uid = u.id
    socket.join('u_' + uid)
    const n = (online.get(uid) || 0) + 1
    online.set(uid, n)
    if (n === 1) io.emit('presence', { userId: uid, online: true })
    if (typeof cb === 'function') cb({ ok: true })
  })

  socket.on('disconnect', () => {
    if (!uid) return
    const n = (online.get(uid) || 1) - 1
    if (n <= 0) {
      online.delete(uid)
      io.emit('presence', { userId: uid, online: false })
    } else online.set(uid, n)
  })

  /* --- чат --- */
  socket.on('message:send', ({ to, text }) => {
    const u = GU()
    if (!u || !to) return
    const t = String(text || '').trim().slice(0, 1000)
    if (!t) return
    pushMsg(u.id, to, t)
    const target = findUser((x) => x.id === to)
    if (target && target.demo) {
      setTimeout(() => {
        if (!db.friendships.some(([a, b]) => (a === u.id && b === to) || (b === u.id && a === to))) return
        pushMsg(to, u.id, DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)])
      }, 1500 + Math.random() * 2500)
    }
  })

  /* --- звонки подростков (аудио/видео, WebRTC) --- */
  socket.on('call:invite', ({ to, kind, callId }) => {
    const u = GU()
    if (!u || !to) return
    emitTo(to, 'call:incoming', { callId: String(callId || id()), kind: kind === 'video' ? 'video' : 'audio', from: pubUser(u) })
  })
  socket.on('call:accept', ({ callId, to }) => {
    const u = GU()
    if (!u) return
    emitTo(to, 'call:accepted', { callId, by: pubUser(u) })
  })
  socket.on('call:reject', ({ callId, to }) => {
    const u = GU()
    if (!u) return
    emitTo(to, 'call:rejected', { callId, by: pubUser(u) })
  })
  socket.on('call:end', ({ callId, to }) => {
    const u = GU()
    if (!u) return
    emitTo(to, 'call:ended', { callId })
  })

  /* --- прозрачная пересылка WebRTC (SDP/ICE) --- */
  const pass = (ev) => (payload) => {
    const u = GU()
    if (!u || !payload || !payload.to) return
    const { to, ...rest } = payload
    emitTo(to, ev, { ...rest, from: u.id })
  }
  socket.on('rtc:offer', pass('rtc:offer'))
  socket.on('rtc:answer', pass('rtc:answer'))
  socket.on('rtc:ice', pass('rtc:ice'))

  /* --- родительский контроль: наблюдение по запросу --- */
  // type: 'front' | 'back' | 'audio'
  socket.on('watch:request', ({ childId, type }) => {
    const p = GU()
    if (!p || p.role !== 'parent' || !(p.childIds || []).includes(childId)) return
    const t = ['front', 'back', 'audio'].includes(type) ? type : 'front'
    emitTo(childId, 'watch:request', { sessionId: id(), type: t, parent: pubUser(p) })
  })
  socket.on('watch:accept', ({ sessionId, to }) => {
    const u = GU()
    if (!u) return
    emitTo(to, 'watch:accepted', { sessionId, by: pubUser(u) })
  })
  socket.on('watch:decline', ({ sessionId, to }) => {
    const u = GU()
    if (!u) return
    emitTo(to, 'watch:declined', { sessionId })
  })
  socket.on('watch:switch', ({ childId, type }) => {
    const u = GU()
    if (!u || !(u.childIds || []).includes(childId)) return
    emitTo(childId, 'watch:switch', { type })
  })
  socket.on('watch:stop', ({ to }) => {
    const u = GU()
    if (!u || !to) return
    emitTo(to, 'watch:stop', {})
  })

  /* --- местоположение --- */
  socket.on('loc:update', ({ lat, lng, acc }) => {
    const u = GU()
    if (!u || u.role !== 'teen' || !isFinite(lat) || !isFinite(lng)) return
    db.locations[u.id] = { lat, lng, acc: acc || null, at: now() }
    save()
    for (const pid of u.parentIds || []) emitTo(pid, 'loc:update', { childId: u.id, ...db.locations[u.id] })
  })
  socket.on('loc:request', ({ childId }) => {
    const u = GU()
    if (!u || !(u.childIds || []).includes(childId)) return
    emitTo(childId, 'loc:request', {})
  })

  /* --- SOS --- */
  socket.on('sos', ({ lat, lng, acc }) => {
    const u = GU()
    if (!u || u.role !== 'teen') return
    const ev = {
      id: id(), childId: u.id, at: now(),
      lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null, acc: acc || null,
    }
    db.sosEvents.push(ev)
    save()
    for (const pid of u.parentIds || []) emitTo(pid, 'sos', { ...ev, child: pubUser(u) })
  })

  /* --- советы от родителя --- */
  socket.on('advice:send', ({ childId, title, text }) => {
    const p = GU()
    if (!p || p.role !== 'parent' || !(p.childIds || []).includes(childId)) return
    emitTo(childId, 'advice:show', {
      title: String(title || 'Совет родителя').slice(0, 80),
      text: String(text || '').slice(0, 600),
      from: p.name,
    })
  })
})

/* ---------------- статика (собранный фронтенд) ---------------- */

app.use(express.static(DIST))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return res.status(404).json({ error: 'Not found' })
  const index = path.join(DIST, 'index.html')
  res.sendFile(index, (err) => {
    if (err) res.status(503).send('Фронтенд ещё не собран. Запустите: npm run build')
  })
})

seedDemo()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`«Вместе» сервер запущен: http://0.0.0.0:${PORT}`)
})
