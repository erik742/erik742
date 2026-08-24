// Озвучка — важная функция доступности для подростков,
// которым проще воспринимать информацию на слух.

export function speak(text: string) {
  try {
    const s = window.speechSynthesis
    if (!s) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    u.rate = 0.95
    u.pitch = 1
    s.speak(u)
  } catch {
    /* игнорируем */
  }
}

export function stopSpeak() {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* игнорируем */
  }
}

// Тревожный сигнал для родителя при SOS
export function beep(times = 4) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = 880
      const t0 = ctx.currentTime + i * 0.4
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
      o.start(t0)
      o.stop(t0 + 0.35)
    }
  } catch {
    /* игнорируем */
  }
}
