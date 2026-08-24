export const INTERESTS = [
  '🎮 Игры',
  '🎨 Рисование',
  '🎵 Музыка',
  '📚 Книги',
  '🎬 Кино и мультики',
  '⚽ Спорт',
  '🐶 Животные',
  '🚆 Транспорт',
  '🌌 Космос',
  '🧩 Головоломки',
  '💻 Компьютеры',
  '🍕 Готовка',
  '🌿 Природа',
  '🏊 Плавание',
  '🤖 Роботы',
  '✂️ Поделки',
]

export const AVATARS = ['🦊', '🐼', '🐨', '🐯', '🦄', '🐙', '🐢', '🦋', '🐝', '🐬', '🦉', '🌟', '🚀', '🌈', '🎧', '⚽']

// Готовые фразы: подростку проще выбрать, чем придумать
export const QUICK_PHRASES = [
  'Привет! Давай дружить 😊',
  'Как твои дела?',
  'Чем любишь заниматься?',
  'Мне тоже это нравится!',
  'Давай созвонимся!',
  'Извини, мне пора. До связи!',
  'Хорошего дня! 👋',
]

// Быстрые советы родителя во время наблюдения
export const QUICK_ADVICE: { title: string; text: string }[] = [
  { title: 'Я рядом 💜', text: 'Не волнуйся, я рядом и слежу за тобой. Всё будет хорошо.' },
  { title: 'Уходи и позвони мне', text: 'Пожалуйста, уйди оттуда и сразу позвони мне. Я жду твоего звонка.' },
  { title: 'Не отвечай ему', text: 'Не отвечай этому человеку. Закрой чат, я сейчас всё посмотрю.' },
  { title: 'Найди взрослого', text: 'Найди поблизости взрослого — продавца, охранника или полицейского — и попроси помочь.' },
  { title: 'Дыши медленно', text: 'Медленно вдохни и выдохни пять раз. Ты не один, я уже разбираюсь.' },
]

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function fmtAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'только что'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`
  if (diff < 86_400_000) return fmtTime(ts)
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + fmtTime(ts)
}

export const WATCH_TYPE_LABEL: Record<string, string> = {
  front: 'передняя камера',
  back: 'задняя камера',
  audio: 'микрофон',
}
