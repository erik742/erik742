import { io } from 'socket.io-client'

export const sock = io('/', { transports: ['websocket', 'polling'] })

export function authenticate(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    sock.emit('auth', token, (r: { ok?: boolean } | undefined) => resolve(!!r?.ok))
  })
}
