import { lookupDiscount } from './discountCatalog'

export interface FrozenPassengerRecord {
  discountName: string
  discountPercent: number
  tariff: number
  usedTripDiscount?: boolean
}

export interface ResolvedPassengerDisplay {
  isLive: boolean // true = бекенд змінив щось вручну для цього конкретного замовлення, показуємо живе
  discountName: string
  discountPercent: number | null // null у живому режимі, коли % невідомий (dsc не знайдено в каталозі)
  strikeBase: number | null // перекреслена база; null якщо взагалі нема з чого порахувати
  price: number
  usedTripDiscount: boolean
}

// Кеп (28.08), фінальне узгоджене правило "жива vs застигла" для ВСІХ трьох типів
// замовлень (one-way/round-trip/відкрита дата) — однаково, бо працює на рівні ОДНОГО
// пасажира, не залежить від типу поїздки:
//
// 1. Рахуємо, якою МАЛА Б бути ціна за нашими застиглими даними (order_registry):
//    очікувана = frozen.tariff × (1 − frozen.discountPercent / 100)
// 2. Якщо округлена(очікувана) === округлена(живий prc) — довіряємо ЗАСТИГЛИМ даним
//    (назва, %, база, напис "Знижка X%"/"Застосовано знижку рейсу") — саме те, що ми самі
//    зафіксували в момент бронювання.
// 3. Якщо НЕ збігається — хтось вручну змінив ЦЕ КОНКРЕТНЕ замовлення на бекенді
//    (не загальну ціну рейсу — та нас не цікавить, вона на вже куплений квиток не
//    впливає). У цьому разі:
//      - назву категорії шукаємо за ЖИВИМ dsc в статичному каталозі (discountCatalog.ts)
//      - живий_% беремо звідти ж
//      - справжню ЖИВУ базу виводимо назад із самого живого prc:
//        жива_база = живий_prc / (1 − живий_% / 100)
//        (саме так вирішується приклад "0.8 ₴ замість 4400 ₴, база тоді 1, не 5500/10450")
//      - якщо dsc взагалі не знайдено в каталозі — показуємо тільки ціну, без бази/%.
export function resolvePassengerDisplay(
  frozen: FrozenPassengerRecord | undefined,
  liveDsc: string | number | undefined,
  livePrc: number
): ResolvedPassengerDisplay {
  const price = Number(livePrc) || 0

  if (frozen) {
    const expected = frozen.tariff * (1 - frozen.discountPercent / 100)
    const matches = Math.round(expected * 100) === Math.round(price * 100)
    if (matches) {
      return {
        isLive: false,
        discountName: frozen.discountName,
        discountPercent: frozen.discountPercent,
        strikeBase: frozen.tariff > price ? frozen.tariff : null,
        price,
        usedTripDiscount: !!frozen.usedTripDiscount,
      }
    }
  }

  // Живий режим — хтось вручну змінив саме це замовлення.
  const liveCat = lookupDiscount(liveDsc)
  if (!liveCat) {
    return { isLive: true, discountName: '', discountPercent: null, strikeBase: null, price, usedTripDiscount: false }
  }
  const liveBase = liveCat.discount < 100 ? price / (1 - liveCat.discount / 100) : price
  return {
    isLive: true,
    discountName: liveCat.name,
    discountPercent: liveCat.discount,
    strikeBase: liveCat.discount > 0 && liveBase > price ? liveBase : null,
    price,
    usedTripDiscount: false, // у живому режимі не знаємо, чи це підміна — не стверджуємо
  }
}
