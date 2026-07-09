// Розрахунок ціни "в два боки" для замовлень з route2 (незадокументоване поле "price").
// Бекенд/API повертає лише ціну "в один бік" (актуальну, живу).
// Ціни "в два боки" беремо зі статичних шаблонів (Alt_1..4), знаходячи шаблон,
// де ціна "в один бік" (EUR1/UAH1) для цього ж route id найближча до живої ціни з API,
// і з нього беремо EUR2/UAH2.
//
// TODO: тимчасове рішення. Коли прогер додасть офіційний метод розрахунку 2-way ціни
// в API — цей файл прибрати, брати ціну напряму з відповіді.

import templatesJson from './data/priceTemplates.json'

interface TemplateRow { eur1: number | null; eur2: number | null; uah1: number | null; uah2: number | null }
type Templates = Record<string, Record<string, TemplateRow>> // назва шаблону -> route id -> рядок

const templates = templatesJson as unknown as Templates

export type Direction = 'ua' | 'eu' // 'ua' = з України (UAH), 'eu' = з Європи (EUR)

export interface TwoWayResult {
  price: number
  templateUsed: string
  exactMatch: boolean
}

/**
 * Знайти ціну "в два боки" для конкретного рейсу.
 * @param routeId   id рейсу (те саме, що приходить з API/route1)
 * @param direction напрямок першого відрізка: 'ua' (з України, ціна в UAH) або 'eu' (з Європи, ціна в EUR)
 * @param liveOneWayPrice жива ціна "в один бік" з API (order_new/order_info) для цього рейсу
 */
export function findTwoWayPrice(
  routeId: string | number,
  direction: Direction,
  liveOneWayPrice: number
): TwoWayResult | null {
  const id = String(routeId)
  const field1 = direction === 'ua' ? 'uah1' : 'eur1'
  const field2 = direction === 'ua' ? 'uah2' : 'eur2'

  let best: TwoWayResult | null = null
  let bestDiff = Infinity

  for (const tplName of Object.keys(templates)) {
    const row = templates[tplName][id]
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
