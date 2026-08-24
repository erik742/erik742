import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data.json')

const empty = () => ({
  users: [],
  sessions: {},
  friendRequests: [],
  friendships: [],
  messages: [],
  linkCodes: {},
  locations: {},
  sosEvents: [],
})

let data = empty()
try {
  if (fs.existsSync(DATA_FILE)) {
    data = { ...empty(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  }
} catch (e) {
  console.warn('[store] не удалось прочитать data.json, начинаем с чистой базы', e.message)
}

let saveTimer = null
export function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 300)
}
export function saveNow() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 1))
  } catch (e) {
    console.warn('[store] ошибка записи', e.message)
  }
}
export const db = data
