// Нове ціноутворення (PRICING_SPEC_V2.md, 27.08) — базується на полях price_old/
// price_alt/price_dsc/price_mob_dsc, які тепер повертає бекенд у методі routes.
//
// USE_NEW_PRICING — прапорець для миттєвого відкату (якщо щось не так у продакшені —
// достатньо змінити на false і задеплоїти, без git revert чи розбору коду):
// false = стара поведінка (просто trip.price, без урахування нових полів)
// true  = нова логіка за специфікацією
export const USE_NEW_PRICING = true

import { toUAH } from './currency'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

// Кеп (28.09): MOB-знижки від прогера — id = 100 + відсоток, доступні 1–40% (id 101–140).
// Зі старих SALE лишаємо ТІЛЬКИ 50% (id 45). Понад 50% не буває. 41–49% (теоретично) —
// обмежуємо MOB 40 (id 140). 0% → null (викликач підставляє "повний тариф").
export const MOB_MAX_PCT = 40
export const LEGACY_SALE_50_ID = 45
export function mobDiscountId(pct: number): number | null {
  const p = Math.round(Number(pct) || 0)
  if (p <= 0) return null
  if (p >= 50) return LEGACY_SALE_50_ID
  return 100 + Math.min(p, MOB_MAX_PCT)
}
// Відсоток, який реально отримає бекенд для цього id (для узгодженого показу ціни).
export function mobEffectivePct(pct: number): number {
  const p = Math.round(Number(pct) || 0)
  if (p <= 0) return 0
  if (p >= 50) return 50
  return Math.min(p, MOB_MAX_PCT)
}

export interface LegPricing {
  базовийТариф: number
  знижкаПроц: number
  актуальнаЦіна: number
  знижкаДжерело: 'price_dsc' | 'price_mob_dsc' | null
  знижкаId: number | null // Кеп (18.09): реальний id з discounts[] — price_mob_dsc_id/price_dsc_id, спарений з тим самим полем, що спрацювало (не пошук за %)
}

// Розділ 3 специфікації — розрахунок для ОДНІЄЇ поїздки (leg).
// price_alt (якщо не 0) завжди заміщує price_old як базовий тариф — незалежно від
// напрямку різниці. Знижка (price_mob_dsc пріоритетно, інакше price_dsc) застосовується
// ПОВЕРХ результату заміщення.
//
// ВАЖЛИВО: результат у ВЛАСНІЙ валюті рейсу (trip.currency) — не нормалізований. Це
// правильно для one-way (де далі йде format(x, trip.currency)). Для round-trip, де
// leg1 і leg2 МОЖУТЬ бути в різних валютах (виїзд з України — uah, виїзд з Німеччини —
// частіше eur), напряму сумувати результати НЕ можна — див. computeLegPricingUAH нижче.
export function computeLegPricing(trip: any): LegPricing {
  const priceOld = Number(trip?.price_old ?? trip?.price ?? 0)
  const priceAlt = Number(trip?.price_alt ?? 0)
  const priceDsc = Number(trip?.price_dsc ?? 0)
  const priceMobDsc = Number(trip?.price_mob_dsc ?? 0)

  const базовийТариф = priceAlt !== 0 ? priceAlt : priceOld
  // Кеп (28.09): % нормалізуємо до того, що реально прийме бекенд через MOB-id
  // (1–40, або 50) — щоб показана ціна == порахована бекендом.
  const знижкаПроц = mobEffectivePct(priceMobDsc > 0 ? priceMobDsc : (priceDsc > 0 ? priceDsc : 0))
  const актуальнаЦіна = базовийТариф * (1 - знижкаПроц / 100)
  // Кеп (28.08): яке саме поле спрацювало — для psgr_dscnt[] при відправці замовлення.
  const знижкаДжерело: 'price_dsc' | 'price_mob_dsc' | null = priceMobDsc > 0 ? 'price_mob_dsc' : (priceDsc > 0 ? 'price_dsc' : null)
  // Кеп (28.09): ВСІ онлайн-знижки відправляємо як MOB-id (id = 100 + %), див.
  // mobDiscountId нижче. Старі SALE-id (price_mob_dsc_id/price_dsc_id, у т.ч. id=43, який
  // насправді "SALE 15% online") більше не використовуються.
  const знижкаId: number | null = mobDiscountId(знижкаПроц)

  return { базовийТариф, знижкаПроц, актуальнаЦіна, знижкаДжерело, знижкаId }
}

// Кеп (26.08): знайдено реальний баг — round-trip формула сумувала базовийТариф/
// актуальнаЦіна двох ніг НАПРЯМУ, без урахування, що leg1 (з України) часто в UAH, а
// leg2 (з Європи) — в EUR. Booking.tsx вже й так конвертує subtotal2 окремо через
// trip2.currency (рядок 639) — round-trip формула мала робити те саме, але не робила.
// Ця функція нормалізує ОБИДВА значення в UAH ПЕРЕД поверненням — саме її мають
// використовувати всі round-trip формули (розділ 5), не computeLegPricing напряму.
export function computeLegPricingUAH(trip: any): LegPricing {
  const raw = computeLegPricing(trip)
  const currency = trip?.currency || 'uah'
  return {
    базовийТариф: toUAH(raw.базовийТариф, currency),
    знижкаПроц: raw.знижкаПроц,
    актуальнаЦіна: toUAH(raw.актуальнаЦіна, currency),
    знижкаДжерело: raw.знижкаДжерело,
    знижкаId: raw.знижкаId,
  }
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

// Кеп (28.08): те саме, що roundTripGroupPrice, але для одностороннього рейсу — кожен
// пасажир своя категорія (з тим самим правилом "знижка рейсу підміняє категорійну, якщо
// вигідніша"), для гамбургер-деталізації на екрані.
export function oneWayGroupPrice(trip: any, cats: string[]): { total: number; base: number; perPassenger: number[]; usedTripDiscount: boolean[]; details: PassengerPriceDetail[] } {
  const list = cats.length ? cats : ['__default__']
  const discountOptions: any[] = trip?.discounts || []
  const { базовийТариф } = computeLegPricing(trip)
  let total = 0
  const perPassenger: number[] = []
  const usedTripDiscount: boolean[] = []
  const details: PassengerPriceDetail[] = []
  for (const catId of list) {
    let passengerPrice: number
    let usedTrip = false
    let effectivePct = 0
    let catName = 'Sale online'
    let discountSource: 'price_dsc' | 'price_mob_dsc' | null = null
    let discountId: number | null = null
    if (catId === '__default__') {
      const d = oneWayDisplay(trip)
      passengerPrice = d.price
      effectivePct = d.discountPct ?? 0
      discountSource = computeLegPricing(trip).знижкаДжерело
      discountId = computeLegPricing(trip).знижкаId
    } else {
      const opt = discountOptions.find(d => String(d.id) === catId)
      const pct = opt ? Number(opt.discount) : 0
      catName = opt?.name || 'Повний тариф'
      const r = legPriceWithFixedCategory(trip, pct)
      passengerPrice = r.price
      usedTrip = r.usedTripDiscount
      discountSource = r.discountSource
      discountId = r.discountId
      const tripPct = computeLegPricing(trip).знижкаПроц
      effectivePct = usedTrip ? Math.max(tripPct, pct) : pct
    }
    total += passengerPrice
    perPassenger.push(roundPrice(passengerPrice))
    usedTripDiscount.push(usedTrip)
    details.push({ catId, catName, price: roundPrice(passengerPrice), basePrice: roundPrice(базовийТариф), effectivePct, usedTripDiscount: usedTrip, discountSource, discountId })
  }
  return { total: roundPrice(total), base: roundPrice(базовийТариф * list.length), perPassenger, usedTripDiscount, details }
}

export interface RoundTripCoefficients {
  fixedDates: number   // за замовч. 0.95
  openDate: number      // за замовч. 0.95 (Кеп 23.09: було 0.9)
}

export const DEFAULT_COEFFICIENTS: RoundTripCoefficients = { fixedDates: 0.95, openDate: 0.95 }

// ============================================================================
// Кеп (28.09) — НОВА логіка round-trip (погоджено з прогером), однакова для фіксованих
// дат і відкритої дати:
//   1. Тариф = (повна ціна "туди" + повна ціна "назад") × коефіцієнт.
//      Коефіцієнт НЕ застосовується, якщо на будь-якому плечі знижка > 15%.
//   2. Знижка = (знижка "туди" + знижка "назад") / 2, округлено до цілого.
//      Відкрита дата: знижка "назад" = 0 завжди.
//   3. Бекенду: price = тариф (UAH), crc='uah', dsc = MOB-id середньої знижки
//      (або категорія пасажира, якщо її % більший).
//   4. Round-trip НЕМОЖЛИВИЙ, якщо на будь-якому плечі знижка > 30%.
// Усе в UAH (плечі нормалізуються через computeLegPricingUAH).
// ============================================================================
export const ROUND_TRIP_MAX_LEG_PCT = 30
export const ROUND_TRIP_COEF_MAX_LEG_PCT = 15

export interface RoundTripQuote {
  tariff: number          // UAH, вже з коефіцієнтом (якщо застосовано)
  avgPct: number          // ціла середня знижка
  coefficientApplied: boolean
  leg1Pct: number
  leg2Pct: number         // для 'open' завжди 0
  allowed: boolean        // false — знижка на плечі > 30%
}

export function roundTripQuote(leg1: any, leg2: any, mode: 'fixed' | 'open', coefficient: number): RoundTripQuote {
  const p1 = computeLegPricingUAH(leg1)
  const p2 = computeLegPricingUAH(leg2)
  const leg1Pct = p1.знижкаПроц
  const leg2Pct = mode === 'open' ? 0 : p2.знижкаПроц
  const coefficientApplied = Math.max(leg1Pct, leg2Pct) <= ROUND_TRIP_COEF_MAX_LEG_PCT
  const tariff = roundPrice((p1.базовийТариф + p2.базовийТариф) * (coefficientApplied ? coefficient : 1))
  const avgPct = mobEffectivePct(Math.round((leg1Pct + leg2Pct) / 2))
  return { tariff, avgPct, coefficientApplied, leg1Pct, leg2Pct, allowed: isRoundTripAllowedLeg(leg1) && (mode === 'open' || isRoundTripAllowedLeg(leg2)) }
}

// Чи можна брати цей рейс як плече round-trip (знижка ≤ 30%).
export function isRoundTripAllowedLeg(trip: any): boolean {
  return computeLegPricing(trip).знижкаПроц <= ROUND_TRIP_MAX_LEG_PCT
}

// Ціна одного пасажира round-trip з категорією categoryPct (0 = без категорії).
// Бекенд рахує tariff × (1 − % обраного id) — тут те саме.
function roundTripPassenger(q: RoundTripQuote, categoryPct: number): { price: number; pct: number; usedTrip: boolean; discountId: number | null } {
  const usedTrip = q.avgPct > categoryPct
  const pct = usedTrip ? q.avgPct : categoryPct
  return { price: roundPrice(q.tariff * (1 - pct / 100)), pct, usedTrip, discountId: usedTrip ? mobDiscountId(q.avgPct) : null }
}

export function roundTripFixedDisplay(leg1: any, leg2: any, coefficient: number = DEFAULT_COEFFICIENTS.fixedDates): PriceDisplay {
  const q = roundTripQuote(leg1, leg2, 'fixed', coefficient)
  return buildDisplay(q.tariff * (1 - q.avgPct / 100), q.tariff, q.avgPct)
}

export function roundTripOpenDateDisplay(leg1: any, returnTrip: any, coefficient: number = DEFAULT_COEFFICIENTS.openDate): PriceDisplay {
  const q = roundTripQuote(leg1, returnTrip, 'open', coefficient)
  return buildDisplay(q.tariff * (1 - q.avgPct / 100), q.tariff, q.avgPct)
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
// legPriceWithFixedCategory — власна валюта рейсу (для one-way використання).
// roundTripWithFixedCategory — той самий баг, що й вище: нормалізує в UAH перед сумою.
// Кеп (27.08): якщо знижка рейсу/застосунку (price_mob_dsc/price_dsc) на цій нозі
// БІЛЬША за знижку обраної фіксованої категорії — застосовуємо знижку рейсу замість
// категорійної (клієнту вигідніше). Порівнюється й застосовується ОКРЕМО на кожній нозі
// (leg1/leg2 можуть мати різні price_dsc/price_mob_dsc) — не одне спільне значення.
export function legPriceWithFixedCategory(trip: any, categoryDiscountPct: number): { price: number; usedTripDiscount: boolean; discountSource: 'price_dsc' | 'price_mob_dsc' | null; discountId: number | null } {
  const { базовийТариф, знижкаПроц: tripDiscountPct, знижкаДжерело, знижкаId } = computeLegPricing(trip)
  const usedTripDiscount = tripDiscountPct > categoryDiscountPct
  const effectivePct = usedTripDiscount ? tripDiscountPct : categoryDiscountPct
  return { price: roundPrice(базовийТариф * (1 - effectivePct / 100)), usedTripDiscount, discountSource: usedTripDiscount ? знижкаДжерело : null, discountId: usedTripDiscount ? знижкаId : null }
}

export function roundTripWithFixedCategory(leg1: any, leg2: any, categoryDiscountPct: number, coefficient: number, mode: 'fixed' | 'open' = 'fixed'): { total: number; usedTripDiscountLeg1: boolean; usedTripDiscountLeg2: boolean; discountSource: 'price_dsc' | 'price_mob_dsc' | null; discountId: number | null } {
  const q = roundTripQuote(leg1, leg2, mode, coefficient)
  const r = roundTripPassenger(q, categoryDiscountPct)
  return { total: r.price, usedTripDiscountLeg1: r.usedTrip, usedTripDiscountLeg2: r.usedTrip, discountSource: r.usedTrip ? 'price_mob_dsc' : null, discountId: r.discountId }
}

// ЗАДАЧА 5 (27.08, Кеп): коефіцієнт read з Firestore settings/pricingCoefficients (адмінка
// редагує в PricingCoefficientSettings.tsx) — глобально + правила по містах відправлення.
// Живий підписник (onSnapshot), кешується в модулі — читається один раз при першому
// використанні, оновлюється автоматично, коли адмін щось міняє (без перезавантаження).
interface CityRule { cityId: string; cityName: string; fixedDates: number; openDate: number }
interface CoefficientsDoc { fixedDates: number; openDate: number; cityRules: CityRule[] }

let cachedCoefficients: CoefficientsDoc = { ...DEFAULT_COEFFICIENTS, cityRules: [] }
let subscribed = false

function subscribeCoefficientsOnce() {
  if (subscribed || !isFirebaseConfigured()) return
  subscribed = true
  Promise.all([import('firebase/app'), import('firebase/firestore')]).then(([{ initializeApp, getApps }, { getFirestore, doc, onSnapshot }]) => {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    onSnapshot(doc(db, 'settings', 'pricingCoefficients'), (snap) => {
      const d = snap.data()
      if (d) {
        cachedCoefficients = {
          fixedDates: Number(d.fixedDates) > 0 ? Number(d.fixedDates) : DEFAULT_COEFFICIENTS.fixedDates,
          openDate: Number(d.openDate) > 0 ? Number(d.openDate) : DEFAULT_COEFFICIENTS.openDate,
          cityRules: Array.isArray(d.cityRules) ? d.cityRules : [],
        }
      }
    })
  }).catch(() => {})
}

// Отримати актуальний коефіцієнт для конкретного міста відправлення (leg1) — правило по
// місту, якщо є, інакше глобальне значення.
export function getCoefficient(departureCityId: string | number | undefined, mode: 'fixedDates' | 'openDate'): number {
  subscribeCoefficientsOnce()
  if (departureCityId != null) {
    const rule = cachedCoefficients.cityRules.find(r => String(r.cityId) === String(departureCityId))
    if (rule) return rule[mode]
  }
  return cachedCoefficients[mode]
}

// Кеп (27.08): КРИТИЧНИЙ баг — round-trip формули (roundTripFixedDisplay/OpenDateDisplay)
// рахували ЦІНУ ОДНОГО пасажира, повністю ігноруючи, що на пошуку могло бути обрано
// кілька пасажирів РІЗНИХ категорій (напр. повний + інвалідність + УБД). Ця функція
// рахує суму по КОЖНОМУ пасажиру окремо, з ЙОГО власною категорією — так само, як уже
// давно робить one-way (computeGroupPrice в Results.tsx).
export interface PassengerPriceDetail {
  catId: string
  catName: string
  price: number
  basePrice: number
  effectivePct: number
  usedTripDiscount: boolean
  discountSource: 'price_dsc' | 'price_mob_dsc' | null // код для psgr_dscnt[] коли підмінено
  discountId: number | null // Кеп (18.09): РЕАЛЬНИЙ id (price_mob_dsc_id/price_dsc_id), для psgr_dscnt[]
}

// Кеп (28.08): "Чиста" базова ціна раунд-тріп — БЕЗ жодної логіки "бери більше" (на
// відміну від roundTripWithFixedCategory, яка завжди підставляє знижку рейсу, якщо вона
// вигідніша за передану категорійну, навіть коли передали 0%). Ця функція — для
// перекресленого числа в гамбургері/деталізації, де потрібна СПРАВЖНЯ база без жодної
// знижки, а не "найкраща можлива при 0% категорії".
export function pureRoundTripBase(leg1: any, leg2: any, coefficient: number, mode: 'fixed' | 'open' = 'fixed'): number {
  return roundTripQuote(leg1, leg2, mode, coefficient).tariff
}

export function roundTripGroupPrice(
  leg1: any,
  leg2: any,
  cats: string[],
  mode: 'fixed' | 'open',
  coefficient: number
): { total: number; base: number; perPassenger: number[]; usedTripDiscount: boolean[]; details: PassengerPriceDetail[] } {
  const list = cats.length ? cats : ['__default__']
  const discountOptions: any[] = leg1?.discounts || []
  const q = roundTripQuote(leg1, leg2, mode, coefficient)
  let total = 0
  let base = 0
  const perPassenger: number[] = []
  const usedTripDiscount: boolean[] = []
  const details: PassengerPriceDetail[] = []
  for (const catId of list) {
    base += q.tariff
    let catName = 'Sale online'
    let categoryPct = 0
    if (catId !== '__default__') {
      const opt = discountOptions.find(d => String(d.id) === catId)
      categoryPct = opt ? Number(opt.discount) : 0
      catName = opt?.name || 'Повний тариф'
    }
    const r = roundTripPassenger(q, categoryPct)
    const usedTrip = catId === '__default__' ? false : r.usedTrip
    total += r.price
    perPassenger.push(r.price)
    usedTripDiscount.push(usedTrip)
    details.push({ catId, catName, price: r.price, basePrice: q.tariff, effectivePct: r.pct, usedTripDiscount: usedTrip, discountSource: r.usedTrip ? 'price_mob_dsc' : null, discountId: r.discountId })
  }
  return { total: roundPrice(total), base: roundPrice(base), perPassenger, usedTripDiscount, details }
}
