// Єдина логіка "яка знижка/ціна діє для пасажира N на цьому рейсі".
// РАНІШЕ ця логіка існувала окремими копіями в Results.tsx, RoundTripSummary.tsx і Booking.tsx —
// вони могли непомітно розійтись (навіть невелика відмінність у ціні "в один бік" зрушує
// findTwoWayPrice() на інший рядок шаблону — звідси стрибки ціни прев'ю vs факт).
// Тепер обидва екрани викликають рівно ці самі функції — доки нема ручного вибору знижки
// пасажиром на екрані бронювання (passengerDiscounts), результат гарантовано однаковий.

export interface DiscountOpt { id: string | number; default?: number | string; price?: number; name?: string }

// Бекенд віддає назву категорії двомовно через " / " (напр. "Особи, старші за 60 / Senior ab
// 60") — в інтерфейсі показуємо лише українську/російську частину до роздільника, англо-
///німецькомовний хвіст прибираємо. Якщо роздільника нема — повертаємо назву як є.
export function localizedDiscountName(name: string | undefined | null): string {
  if (!name) return ''
  return name.split(' / ')[0].trim()
}

// Знижка пасажира: ручний вибір (якщо є) → категорія зі складу пошуку (якщо діє на рейсі) → дефолтна/повна
export function resolveDiscountId(
  catId: string | undefined,
  discountOptions: DiscountOpt[],
  manualOverride?: string | number | null
): string {
  if (manualOverride != null) return String(manualOverride)
  if (catId && discountOptions.some(d => String(d.id) === String(catId))) return String(catId)
  const def = discountOptions.find(d => d.default === 1 || d.default === '1') || discountOptions[0]
  return String(def?.id ?? 0)
}

export function resolvePassengerPrice(
  catId: string | undefined,
  discountOptions: DiscountOpt[],
  fallbackPrice: number | string | undefined,
  manualOverride?: string | number | null
): number {
  const discountId = resolveDiscountId(catId, discountOptions, manualOverride)
  const opt = discountOptions.find(d => String(d.id) === discountId)
  return Number(opt?.price ?? fallbackPrice ?? 0)
}

// Ціна ПОВНОГО (без знижки) квитка "в один бік" для рейсу — база для пошуку тарифу в два боки
export function fullFareOneWayPrice(trip: any): number {
  return resolvePassengerPrice(undefined, trip?.discounts || [], trip?.price)
}

export function perPassengerOneWayPrices(
  trip: any,
  cats: string[],
  manualOverrides?: (string | number | null | undefined)[]
): number[] {
  const discountOptions: DiscountOpt[] = trip?.discounts || []
  const list = cats.length ? cats : ['__one__']
  return list.map((catId, i) => resolvePassengerPrice(catId, discountOptions, trip?.price, manualOverrides?.[i]))
}
