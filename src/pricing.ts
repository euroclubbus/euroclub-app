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

export interface LegPricing {
  базовийТариф: number
  знижкаПроц: number
  актуальнаЦіна: number
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
  const знижкаПроц = priceMobDsc > 0 ? priceMobDsc : (priceDsc > 0 ? priceDsc : 0)
  const актуальнаЦіна = базовийТариф * (1 - знижкаПроц / 100)

  return { базовийТариф, знижкаПроц, актуальнаЦіна }
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
    if (catId === '__default__') {
      const d = oneWayDisplay(trip)
      passengerPrice = d.price
      effectivePct = d.discountPct ?? 0
    } else {
      const opt = discountOptions.find(d => String(d.id) === catId)
      const pct = opt ? Number(opt.discount) : 0
      catName = opt?.name || 'Повний тариф'
      const r = legPriceWithFixedCategory(trip, pct)
      passengerPrice = r.price
      usedTrip = r.usedTripDiscount
      const tripPct = computeLegPricing(trip).знижкаПроц
      effectivePct = usedTrip ? Math.max(tripPct, pct) : pct
    }
    total += passengerPrice
    perPassenger.push(roundPrice(passengerPrice))
    usedTripDiscount.push(usedTrip)
    details.push({ catId, catName, price: roundPrice(passengerPrice), effectivePct, usedTripDiscount: usedTrip })
  }
  return { total: roundPrice(total), base: roundPrice(базовийТариф * list.length), perPassenger, usedTripDiscount, details }
}

export interface RoundTripCoefficients {
  fixedDates: number   // за замовч. 0.95
  openDate: number      // за замовч. 0.9
}

export const DEFAULT_COEFFICIENTS: RoundTripCoefficients = { fixedDates: 0.95, openDate: 0.9 }

// Розділ 5.2 — фіксовані дати в обидва боки.
export function roundTripFixedDisplay(leg1: any, leg2: any, coefficient: number = DEFAULT_COEFFICIENTS.fixedDates): PriceDisplay {
  const p1 = computeLegPricingUAH(leg1)
  const p2 = computeLegPricingUAH(leg2)
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
// Кеп (27.08): АСИМЕТРИЧНА логіка — знижка ЗВОРОТНЬОГО рейсу (той, що знайшли автоматично)
// ІГНОРУЄТЬСЯ, беремо тільки його базовийТариф. leg1 (обраний вручну) — з ЙОГО власною
// знижкою, як завжди. Це відрізняється від фіксованих дат, де знижки враховуються на
// ОБОХ ногах — тому НЕ можна перевикористати roundTripFixedDisplay напряму.
export function roundTripOpenDateDisplay(leg1: any, returnTrip: any, coefficient: number = DEFAULT_COEFFICIENTS.openDate): PriceDisplay {
  const p1 = computeLegPricingUAH(leg1)
  const p2 = computeLegPricingUAH(returnTrip)
  const базовийТарифРаундТріп = (p1.базовийТариф + p2.базовийТариф) * coefficient
  // Актуальна ціна: leg1 зі знижкою, зворотний рейс — БЕЗ знижки (тільки базовийТариф).
  const актуальнийТарифРаундТріп = (p1.актуальнаЦіна + p2.базовийТариф) * coefficient
  const effectivePct = базовийТарифРаундТріп > 0
    ? (1 - актуальнийТарифРаундТріп / базовийТарифРаундТріп) * 100
    : 0
  return buildDisplay(актуальнийТарифРаундТріп, базовийТарифРаундТріп, effectivePct)
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
export function legPriceWithFixedCategory(trip: any, categoryDiscountPct: number): { price: number; usedTripDiscount: boolean } {
  const { базовийТариф, знижкаПроц: tripDiscountPct } = computeLegPricing(trip)
  const usedTripDiscount = tripDiscountPct > categoryDiscountPct
  const effectivePct = usedTripDiscount ? tripDiscountPct : categoryDiscountPct
  return { price: базовийТариф * (1 - effectivePct / 100), usedTripDiscount }
}

export function roundTripWithFixedCategory(leg1: any, leg2: any, categoryDiscountPct: number, coefficient: number): { total: number; usedTripDiscountLeg1: boolean; usedTripDiscountLeg2: boolean } {
  const p1 = computeLegPricingUAH(leg1)
  const p2 = computeLegPricingUAH(leg2)
  const tripPct1 = computeLegPricing(leg1).знижкаПроц
  const tripPct2 = computeLegPricing(leg2).знижкаПроц
  const usedTripDiscountLeg1 = tripPct1 > categoryDiscountPct
  const usedTripDiscountLeg2 = tripPct2 > categoryDiscountPct
  const effectivePct1 = usedTripDiscountLeg1 ? tripPct1 : categoryDiscountPct
  const effectivePct2 = usedTripDiscountLeg2 ? tripPct2 : categoryDiscountPct
  const price1 = p1.базовийТариф * (1 - effectivePct1 / 100)
  const price2 = p2.базовийТариф * (1 - effectivePct2 / 100)
  return { total: roundPrice((price1 + price2) * coefficient), usedTripDiscountLeg1, usedTripDiscountLeg2 }
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
  effectivePct: number
  usedTripDiscount: boolean
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
  let total = 0
  let base = 0
  const perPassenger: number[] = []
  const usedTripDiscount: boolean[] = []
  const details: PassengerPriceDetail[] = []
  for (const catId of list) {
    // Базовий (0%, однаковий для всіх пасажирів незалежно від категорії) — для перекресленої суми.
    base += roundTripWithFixedCategory(leg1, leg2, 0, coefficient).total
    let passengerPrice: number
    let usedTrip = false
    let effectivePct = 0
    let catName = 'Sale online'
    if (catId === '__default__') {
      const p = mode === 'open' ? roundTripOpenDateDisplay(leg1, leg2, coefficient) : roundTripFixedDisplay(leg1, leg2, coefficient)
      passengerPrice = p.price
      effectivePct = p.discountPct ?? 0
    } else {
      const opt = discountOptions.find(d => String(d.id) === catId)
      const pct = opt ? Number(opt.discount) : 0
      catName = opt?.name || 'Повний тариф'
      const r = roundTripWithFixedCategory(leg1, leg2, pct, coefficient)
      passengerPrice = r.total
      usedTrip = r.usedTripDiscountLeg1 || r.usedTripDiscountLeg2
      // Ефективний % — те саме, що застосовується до leg1 (для гамбургера показуємо
      // єдине число, навіть якщо leg1/leg2 різняться — leg1 як репрезентативне).
      const tripPct1 = computeLegPricing(leg1).знижкаПроц
      effectivePct = usedTrip ? Math.max(tripPct1, pct) : pct
    }
    total += passengerPrice
    perPassenger.push(roundPrice(passengerPrice))
    usedTripDiscount.push(usedTrip)
    details.push({ catId, catName, price: roundPrice(passengerPrice), effectivePct, usedTripDiscount: usedTrip })
  }
  return { total: roundPrice(total), base: roundPrice(base), perPassenger, usedTripDiscount, details }
}
