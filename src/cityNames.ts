import { getCities } from './api/euroclub'

// Кешуємо список міст у пам'яті на всю сесію застосунку — вантажимо з бекенду один раз.
let cityMap: Record<string, string> | null = null
let loadingPromise: Promise<Record<string, string>> | null = null

async function loadCities(): Promise<Record<string, string>> {
  if (cityMap) return cityMap
  if (loadingPromise) return loadingPromise

  loadingPromise = getCities().then((data: any) => {
    const raw = data?.cities || data || {}
    const arr = Array.isArray(raw) ? raw : Object.values(raw)
    const map: Record<string, string> = {}
    arr.forEach((c: any) => {
      if (c && c.id !== undefined && c.uk) {
        map[String(c.id)] = c.uk
      }
    })
    cityMap = map
    return map
  }).catch(() => {
    cityMap = {}
    return cityMap
  })

  return loadingPromise
}

/**
 * Синхронно повертає назву міста за id, якщо мапа вже завантажена.
 * Повертає порожній рядок, якщо мапа ще не готова або id невідомий.
 */
export function getCityNameSync(id: string | number | undefined | null): string {
  if (id === undefined || id === null || id === '') return ''
  return cityMap?.[String(id)] || ''
}

/**
 * Гарантує, що мапа міст завантажена (викликати один раз при старті сторінки).
 */
export async function ensureCitiesLoaded(): Promise<void> {
  await loadCities()
}
