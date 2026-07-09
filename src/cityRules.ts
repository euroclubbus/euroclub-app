// ─── Статичні правила сполучень (зафіксовано Кепом, до появи бекенд-ендпоінту) ───

export interface RuleCity { id: string; name: string; i2: string }

// Тільки відправлення з України в Європу, ніколи не пункт прибуття
export const ORIGIN_ONLY_UA = [
  'Кривий Ріг', 'Кропивницький', 'Гайсин', 'Вінниця',
  'Немирів', 'Летичів', 'Хмельницький', 'Тернопіль',
  'Чернігів',
]

// В Європу — тільки ці 3 країни (в обидва боки)
export const ZAKARPATTIA = ['Стрий', 'Ужгород', 'Мукачево']
export const ZAKARPATTIA_COUNTRIES = ['sk', 'hu', 'at', 'hr', 'si']

// Можуть з'єднуватись одне з одним всередині України
export const INTERNAL_UA = [
  'Київ', 'Житомир', 'Звягель', 'Рівне', 'Львів', 'Луцьк',
  'Стрий', 'Мукачево', 'Ужгород',
]

// Кишинів — лише ці напрямки, в обидва боки
export const CHISINAU = 'Кишинів'
export const CHISINAU_LINKED = ['Одеса', 'Біла Церква', 'Умань', 'Київ']

function isValidPair(origin: RuleCity, dest: RuleCity): boolean {
  if (origin.name === CHISINAU) return CHISINAU_LINKED.includes(dest.name)
  if (dest.name === CHISINAU) return CHISINAU_LINKED.includes(origin.name)

  const originUa = origin.i2 === 'ua'
  const destUa = dest.i2 === 'ua'

  // Обидва в Україні — тільки якщо обидва у списку внутрішніх
  if (originUa && destUa) {
    return INTERNAL_UA.includes(origin.name) && INTERNAL_UA.includes(dest.name)
  }

  // Обидва в Європі — таких рейсів немає
  if (!originUa && !destUa) return false

  const uaCity = originUa ? origin : dest
  const euCity = originUa ? dest : origin

  // Місто-транзит ніколи не буває пунктом прибуття
  if (uaCity === dest && ORIGIN_ONLY_UA.includes(uaCity.name)) return false

  // Закарпаття — тільки визначені країни
  if (ZAKARPATTIA.includes(uaCity.name)) {
    return ZAKARPATTIA_COUNTRIES.includes(euCity.i2)
  }

  return true
}

// Повертає допустимі варіанти для поля, що заповнюється,
// враховуючи вже обране місто в іншому полі.
// otherIsFrom = true  → otherCity вже стоїть у "Відправлення", рахуємо "Прибуття"
// otherIsFrom = false → otherCity вже стоїть у "Прибуття", рахуємо "Відправлення"
export function getAllowedCities<T extends RuleCity>(
  allCities: T[],
  otherCity: RuleCity | null,
  otherIsFrom: boolean
): T[] {
  if (!otherCity) return allCities
  return allCities.filter(c => {
    if (c.id === otherCity.id) return false
    return otherIsFrom ? isValidPair(otherCity, c) : isValidPair(c, otherCity)
  })
}
