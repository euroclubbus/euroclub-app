// Нове ціноутворення (PRICING_SPEC_V2.md, 27.08) — базується на полях price_old/
// price_alt/price_dsc/price_mob_dsc, які тепер повертає бекенд у методі routes.
//
// USE_NEW_PRICING — прапорець для миттєвого відкату (якщо щось не так у продакшені —
// достатньо змінити на false і задеплоїти, без git revert чи розбору коду):
// false = стара поведінка (просто trip.price, без урахування нових полів)
// true  = нова логіка за специфікацією
export const USE_NEW_PRICING = true

export interface LegPricing {
  базовийТариф: number
  знижкаПроц: number
  актуальнаЦіна: number
}

// Розділ 3 специфікації — розрахунок для ОДНІЄЇ поїздки (leg).
// price_alt (якщо не 0) завжди заміщує price_old як базовий тариф — незалежно від
// напрямку різниці. Знижка (price_mob_dsc пріоритетно, інакше price_dsc) застосовується
// ПОВЕРХ результату заміщення.
export function computeLegPricing(trip: any): LegPricing {
  const priceOld = Number(trip?.price_old ?? trip?.price ?? 0)
  const priceAlt = Number(trip?.price_alt ?? 0)
  const priceDsc = Number(trip?.price_dsc ?? 0)
  const priceMobDsc = Number(trip?.price_mob_dsc ?? 0)

  const базовийТариф = priceAlt !== 0 ? priceAlt : priceOld
  const знижкаПроц = priceMobDsc > 0 ? priceMobDsc : (priceDsc > 0 ? priceDsc : 0)
  const актуальнаЦіна = базовийТариф * (1 - знижкаПроц / 100)

  return { базовийТариф, знижкаПроц, актуальнаЦіна }
}

export interface PriceDisplay {
  showSingle: boolean
  price: number          // ціна, яку показуємо як "актуальну"/єдину
  strikePrice?: number    // перекреслена, тільки якщо showSingle === false
  discountPct?: number    // текстова мітка "Знижка на рейсі X%", тільки якщо > 0
}

// Розділ 4 специфікації — єдине правило відображення: якщо актуальна ціна >= "було"
// (price_old для one-way, базовийТарифРаундТріп для round-trip) — одна ціна.
// Якщо менша — перекреслена стара + нова, і за наявності знижкаПроц>0 — текст відсотка.
function buildDisplay(actual: number, wasPrice: number, discountPct: number): PriceDisplay {
  const actualRounded = roundPrice(actual)
  const wasRounded = roundPrice(wasPrice)
  if (actualRounded >= wasRounded) {
    return { showSingle: true, price: actualRounded }
  }
  return {
    showSingle: false,
    price: actualRounded,
    strikePrice: wasRounded,
    ...(discountPct > 0 ? { discountPct: roundPrice(discountPct) } : {}),
  }
}

// Розділ 7 специфікації — округлення до цілого, стандартне арифметичне (0.5 і вище — вгору).
export function roundPrice(n: number): number {
  return Math.round(n)
}

// Розділ 4 — односторонні поїздки.
export function oneWayDisplay(trip: any): PriceDisplay {
  const { базовийТариф, знижкаПроц, актуальнаЦіна } = computeLegPricing(trip)
  const priceOld = Number(trip?.price_old ?? trip?.price ?? 0)
  return buildDisplay(актуальнаЦіна, priceOld, знижкаПроц)
}

export interface RoundTripCoefficients {
  fixedDates: number   // за замовч. 0.95
  openDate: number      // за замовч. 0.9
}

export const DEFAULT_COEFFICIENTS: RoundTripCoefficients = { fixedDates: 0.95, openDate: 0.9 }

// Розділ 5.2 — фіксовані дати в обидва боки.
export function roundTripFixedDisplay(leg1: any, leg2: any, coefficient: number = DEFAULT_COEFFICIENTS.fixedDates): PriceDisplay {
  const p1 = computeLegPricing(leg1)
  const p2 = computeLegPricing(leg2)
  const базовийТарифРаундТріп = (p1.базовийТариф + p2.базовийТариф) * coefficient
  const актуальнийТарифРаундТріп = (p1.актуальнаЦіна + p2.актуальнаЦіна) * coefficient
  // Для тексту "знижка на рейсі X%" при round-trip показуємо ефективний % від різниці
  // сум (а не % окремого leg — вони можуть відрізнятись між собою).
  const effectivePct = базовийТарифРаундТріп > 0
    ? (1 - актуальнийТарифРаундТріп / базовийТарифРаундТріп) * 100
    : 0
  return buildDisplay(актуальнийТарифРаундТріп, базовийТарифРаундТріп, effectivePct)
}

// Розділ 5.3 — відкрита дата повернення. returnTrip — рейс, знайдений на 30+ днів
// вперед від дати виїзду leg1 (пошук цього рейсу — відповідальність викликаючого коду,
// див. findOpenDateReturnTrip нижче).
export function roundTripOpenDateDisplay(leg1: any, returnTrip: any, coefficient: number = DEFAULT_COEFFICIENTS.openDate): PriceDisplay {
  return roundTripFixedDisplay(leg1, returnTrip, coefficient)
}

// Розділ 5.3 — знайти зворотний рейс: 30+ днів вперед від дати виїзду leg1, той самий
// маршрут у зворотному напрямку. Якщо точного дня 30 нема серед candidates — найближчий
// НАСТУПНИЙ (не раніше). candidates — масив рейсів зворотного напрямку (з окремого
// запиту getRoutes на диапазон дат), кожен з полем departure[0].time у форматі
// "DD.MM.YYYY HH:MM".
export function findOpenDateReturnTrip(departureDateStr: string, candidates: any[]): any | null {
  const [d, m, y] = departureDateStr.split('.').map(Number)
  if (!d || !m || !y) return null
  const departureDate = new Date(y, m - 1, d)
  const threshold = new Date(departureDate)
  threshold.setDate(threshold.getDate() + 30)

  let best: any = null
  let bestDiff = Infinity
  for (const trip of candidates) {
    const depStr: string = trip?.departure?.[0]?.time?.split(' ')?.[0]
    if (!depStr) continue
    const [td, tm, ty] = depStr.split('.').map(Number)
    if (!td || !tm || !ty) continue
    const tripDate = new Date(ty, tm - 1, td)
    if (tripDate.getTime() < threshold.getTime()) continue // тільки 30+ днів вперед
    const diff = tripDate.getTime() - threshold.getTime()
    if (diff < bestDiff) {
      bestDiff = diff
      best = trip
    }
  }
  return best
}

// Розділ 5.4 — фіксована категорія знижки пасажира (не сумується з price_dsc/price_mob_dsc).
// Замінює знижкаПроц на відсоток обраної категорії, застосований до базовийТариф (leg).
export function legPriceWithFixedCategory(trip: any, categoryDiscountPct: number): number {
  const { базовийТариф } = computeLegPricing(trip)
  return базовийТариф * (1 - categoryDiscountPct / 100)
}

export function roundTripWithFixedCategory(leg1: any, leg2: any, categoryDiscountPct: number, coefficient: number): number {
  const price1 = legPriceWithFixedCategory(leg1, categoryDiscountPct)
  const price2 = legPriceWithFixedCategory(leg2, categoryDiscountPct)
  return roundPrice((price1 + price2) * coefficient)
}
