// Розрахунок ціни "в два боки" для замовлень з route2 (незадокументоване поле "price").
// Бекенд/API повертає лише ціну "в один бік" (актуальну, живу).
// Ціни "в два боки" беремо зі статичних шаблонів (Alt_1..4), знаходячи шаблон,
// де ціна "в один бік" (EUR1/UAH1) для цієї ж пари міст найближча до живої ціни з API,
// і з нього беремо EUR2/UAH2.
//
// Зіставлення робимо по id міст відправлення/прибуття (cMin/cMax у шаблоні == from.id/to.id
// з нашого пошуку — підтверджено звіркою з довідником /cities/: cMin=1 (Київ), cMax=3 (Ульм) і т.д.)
// РАНІШЕ помилково зіставляли по колонці "Id" з xlsx — це виявився просто номер рядка
// в таблиці, а не id рейсу з бекенду, тому збігів не було ніколи. Виправлено.
//
// TODO: тимчасове рішення. Коли прогер додасть офіційний метод розрахунку 2-way ціни
// в API — цей файл прибрати, брати ціну напряму з відповіді.

import templatesJson from './data/priceTemplates.json'

interface TemplateRow { eur1: number | null; eur2: number | null; uah1: number | null; uah2: number | null }
type Templates = Record<string, Record<string, TemplateRow>> // назва шаблону -> "fromId-toId" -> рядок

const templates = templatesJson as unknown as Templates

export type Direction = 'ua' | 'eu' // 'ua' = з України (UAH), 'eu' = з Європи (EUR)

export interface TwoWayResult {
  price: number
  templateUsed: string
  exactMatch: boolean
  oneWayOnly?: boolean
}

/**
 * Знайти ціну "в два боки" для конкретного рейсу.
 * @param fromCityId   id міста відправлення (from.id з нашого пошуку)
 * @param toCityId     id міста призначення (to.id з нашого пошуку)
 * @param direction    напрямок першого відрізка: 'ua' (з України, ціна в UAH) або 'eu' (з Європи, ціна в EUR)
 * @param liveOneWayPrice жива ціна "в один бік" з API (order_new/order_info) для цього рейсу
 */
/**
 * Чи існує ціна "в один бік" саме в цьому напрямку для пари міст Україна↔Європа.
 * Використовується для фільтрації списку міст у пошуку — щоб не пропонувати напрямок,
 * на який реально немає тарифу в таблиці.
 * @param uaCityId  id міста в Україні
 * @param euCityId  id міста в Європі
 * @param originIsUa true — відправлення з України (перевіряємо uah1), false — з Європи (eur1)
 */
export function hasOneWayPriceForDirection(uaCityId: string | number, euCityId: string | number, originIsUa: boolean): boolean {
  const key = `${uaCityId}-${euCityId}`
  const field = originIsUa ? 'uah1' : 'eur1'
  for (const tplName of Object.keys(templates)) {
    const row = templates[tplName][key]
    const v = row?.[field as keyof TemplateRow]
    if (v != null && v !== 0) return true
  }
  return false
}

export function findTwoWayPrice(
  fromCityId: string | number,
  toCityId: string | number,
  direction: Direction,
  liveOneWayPrice: number
): TwoWayResult | null {
  const key = `${fromCityId}-${toCityId}`
  const field1 = direction === 'ua' ? 'uah1' : 'eur1'
  const field2 = direction === 'ua' ? 'uah2' : 'eur2'

  let best: TwoWayResult | null = null
  let bestDiff = Infinity
  let sawRow = false
  let sawUsableRoundTrip = false

  for (const tplName of Object.keys(templates)) {
    const row = templates[tplName][key]
    if (!row) continue
    const val1 = row[field1 as keyof TemplateRow]
    if (val1 == null) continue
    sawRow = true

    const val2 = row[field2 as keyof TemplateRow]
    if (val2 == null || val2 === 0) continue // цей шаблон не дає round-trip для цієї пари

    sawUsableRoundTrip = true
    const diff = Math.abs(val1 - liveOneWayPrice)

    if (diff === 0) {
      return { price: val2, templateUsed: tplName, exactMatch: true }
    }
    if (diff < bestDiff) {
      bestDiff = diff
      best = { price: val2, templateUsed: tplName, exactMatch: false }
    }
  }

  if (sawRow && !sawUsableRoundTrip) {
    // Є дані по цій парі міст, але round-trip поле скрізь 0/порожнє — маршрут тільки в один бік
    return { price: 0, templateUsed: '', exactMatch: false, oneWayOnly: true }
  }

  return best
}

/**
 * Тариф + ціна "в два боки" для групи пасажирів.
 *
 * ВАЖЛИВО (узгоджено з Кепом): є ДВА окремих поняття.
 * - "Тариф" — базова ціна за ОДИН повний (без знижок) квиток в два боки. Визначається ОДИН раз —
 *   нейближчим шаблоном до ПОВНОЇ (без знижки) one-way ціни рейсу 1. Це і є те число, яке йде
 *   в бронювання (`price` в neworder) — система бронювання сама рахує суму по пасажирах зі своїх знижок.
 * - "Ціна" — те, що бачить і платить юзер: тариф, помножений на індивідуальне співвідношення
 *   знижки кожного пасажира (їхня one-way ціна / повна one-way ціна), підсумовано по всіх.
 *
 * Раніше кожен пасажир окремо шукав найближчий рядок шаблону по СВОЇЙ (вже дисконтованій)
 * one-way ціні — це могло зачепити зовсім інший рядок шаблону з іншим тарифом для кожного
 * пасажира. Тепер шаблон шукається один раз (по повній ціні), а знижки застосовуються
 * пропорційно до вже знайденого тарифу.
 *
 * @param perPassengerOneWayPrices one-way ціна кожного пасажира окремо (з їхньою знижкою)
 * @param fullOneWayPrice          one-way ціна ПОВНОГО (без знижки) квитка на рейс 1 — саме вона
 *                                 йде в пошук найближчого шаблону, а не ціна конкретного пасажира
 */
export function findTwoWayGroupPrice(
  perPassengerOneWayPrices: number[],
  fullOneWayPrice: number,
  fromCityId: string | number,
  toCityId: string | number,
  direction: Direction
): { tariff: number; total: number; perPassenger: number[]; anyFallback: boolean; oneWayOnly: boolean } {
  const res = findTwoWayPrice(fromCityId, toCityId, direction, fullOneWayPrice)

  if (res?.oneWayOnly) {
    // Маршрут існує тільки в один бік — нічого не вигадуємо, round-trip недоступний
    return { tariff: 0, total: 0, perPassenger: perPassengerOneWayPrices.map(() => 0), anyFallback: false, oneWayOnly: true }
  }

  const tariff = res ? res.price : fullOneWayPrice * 2 // нема рядка шаблону взагалі — оцінка х2 від one-way
  const anyFallback = !res
  const perPassenger = perPassengerOneWayPrices.map(p => {
    const ratio = fullOneWayPrice > 0 ? p / fullOneWayPrice : 1
    return Math.round(tariff * ratio)
  })
  const total = perPassenger.reduce((s, p) => s + p, 0)
  return { tariff, total, perPassenger, anyFallback, oneWayOnly: false }
}
