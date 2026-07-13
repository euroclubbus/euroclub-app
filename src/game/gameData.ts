// ─── Маршрути гри ───────────────────────────────────────────────────────────
// km — приблизна реальна відстань автошляхом (для масштабування тривалості поїздки).
// duration — тривалість заїзду в секундах, лінійно між 7 і 12 хв залежно від км
// в межах діапазону цих 6 маршрутів (мін ~1050 км → 7хв, макс ~2150 км → 12хв).

export interface GameRoute { id: string; from: string; to: string; km: number }

export const GAME_ROUTES: GameRoute[] = [
  { id: 'kyiv-vienna', from: 'Київ', to: 'Відень', km: 1080 },
  { id: 'kyiv-koln', from: 'Київ', to: 'Кельн', km: 1580 },
  { id: 'munich-lviv', from: 'Мюнхен', to: 'Львів', km: 1050 },
  { id: 'stuttgart-kharkiv', from: 'Штутгарт', to: 'Харків', km: 2150 },
  { id: 'odesa-dortmund', from: 'Одеса', to: 'Дортмунд', km: 2000 },
  { id: 'frankfurt-dnipro', from: 'Франкфурт-на-Майні', to: 'Дніпро', km: 2000 },
]

const KM_MIN = Math.min(...GAME_ROUTES.map(r => r.km))
const KM_MAX = Math.max(...GAME_ROUTES.map(r => r.km))

// Тривалість заїзду в секундах (7-12 хв)
export function routeDurationSec(route: GameRoute): number {
  const t = KM_MAX > KM_MIN ? (route.km - KM_MIN) / (KM_MAX - KM_MIN) : 0.5
  const minutes = 7 + t * 5
  return Math.round(minutes * 60)
}

// ─── Автобуси ───────────────────────────────────────────────────────────────
// accelPerTap — приріст швидкості (км/год) за один тап на порожньому автобусі.
// decay — природне гальмування швидкості за секунду (км/год/с).
// Більша місткість = менший accelPerTap і трохи більший decay (важче розганяти й тримати).

export interface GameBus { id: string; name: string; capacity: number; accelPerTap: number; decay: number; color: string }

export const GAME_BUSES: GameBus[] = [
  { id: 'setra-yellow', name: 'Жовта Сетра', capacity: 57, accelPerTap: 6.0, decay: 5.5, color: '#F5C518' },
  { id: 'setra-white', name: 'Біла Сетра', capacity: 61, accelPerTap: 5.7, decay: 5.6, color: '#F2F2F2' },
  { id: 'vanhool-yellow', name: 'Жовтий Van Hool', capacity: 59, accelPerTap: 5.9, decay: 5.5, color: '#F5C518' },
  { id: 'vdl-white', name: 'Білий VDL (двоповерховий)', capacity: 85, accelPerTap: 4.5, decay: 6.2, color: '#F2F2F2' },
  { id: 'mercedes-white', name: 'Білий Mercedes', capacity: 65, accelPerTap: 5.5, decay: 5.8, color: '#F2F2F2' },
]

// Ефективний приріст за тап з урахуванням завантаження (повний автобус — важче розганяти)
export function effectiveAccel(bus: GameBus, passengers: number): number {
  const loadRatio = Math.min(1, passengers / bus.capacity)
  return bus.accelPerTap * (1 - 0.5 * loadRatio)
}

// ─── Дорожні знаки (сегменти обмеження швидкості) ──────────────────────────
export type SignType = 'city' | 'highway' | 'autobahn'
export const SIGN_LIMITS: Record<SignType, number> = { city: 50, highway: 90, autobahn: 100 }

// Генерує послідовність сегментів на весь заїзд (кожен 12-22с), що покривають durationSec
export function generateSegments(durationSec: number, seed = Date.now()): { type: SignType; limit: number; len: number }[] {
  const types: SignType[] = ['city', 'highway', 'autobahn']
  let rnd = seed % 2147483647
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 }
  const segments: { type: SignType; limit: number; len: number }[] = []
  let total = 0
  while (total < durationSec) {
    const type = types[Math.floor(rand() * types.length)]
    const len = Math.min(12 + Math.floor(rand() * 10), durationSec - total)
    segments.push({ type, limit: SIGN_LIMITS[type], len })
    total += len
  }
  return segments
}

// Бали за один тап залежно від різниці "ліміт - швидкість" (див. правила гри)
export function scoreForTap(limit: number, speed: number): number {
  if (speed > limit) return -1 // перевищення - штраф
  const diff = limit - speed
  if (diff <= 10) return 10
  if (diff <= 29) return 3
  return 1
}
