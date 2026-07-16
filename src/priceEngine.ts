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
}

/**
 * Знайти ціну "в два боки" для конкретного рейсу.
 * @param fromCityId   id міста відправлення (from.id з нашого пошуку)
 * @param toCityId     id міста призначення (to.id з нашого пошуку)
 * @param direction    напрямок першого відрізка: 'ua' (з України, ціна в UAH) або 'eu' (з Європи, ціна в EUR)
 * @param liveOneWayPrice жива ціна "в один бік" з API (order_new/order_info) для цього рейсу
 */
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

  for (const tplName of Object.keys(templates)) {
    const row = templates[tplName][key]
    if (!row) continue
    const val1 = row[field1 as keyof TemplateRow]
    const val2 = row[field2 as keyof TemplateRow]
    if (val1 == null || val2 == null) continue

    const diff = Math.abs(val1 - liveOneWayPrice)

    if (diff === 0) {
      return { price: val2, templateUsed: tplName, exactMatch: true }
    }
    if (diff < bestDiff) {
      bestDiff = diff
      best = { price: val2, templateUsed: tplName, exactMatch: false }
    }
  }

  return best
}

/**
 * Ціна "в два боки" для всієї групи пасажирів: КОЖЕН пасажир отримує свій тариф
 * в два боки окремо (за своєю знижкою/one-way ціною), підсумок — це сума цих тарифів.
 * Це навмисно НЕ "групова сума туди" зіставлена одним рядком шаблону — так було
 * неправильно для 2+ пасажирів з різними знижками.
 * @param perPassengerOneWayPrices one-way ціна кожного пасажира окремо (з їхньою знижкою)
 */
export function findTwoWayGroupPrice(
  perPassengerOneWayPrices: number[],
  fromCityId: string | number,
  toCityId: string | number,
  direction: Direction
): { total: number; anyFallback: boolean } {
  let total = 0
  let anyFallback = false
  for (const p of perPassengerOneWayPrices) {
    const res = findTwoWayPrice(fromCityId, toCityId, direction, p)
    if (res) {
      total += res.price
    } else {
      total += p * 2 // нема жодного рядка шаблону для цієї пари міст — оцінка х2 від one-way
      anyFallback = true
    }
  }
  return { total, anyFallback }
}
