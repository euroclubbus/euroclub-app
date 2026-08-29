// Кеп (28.08): статичний каталог категорій знижок — id → {назва, %}. Зібраний з реальних
// trip.discounts, які бачили в цій сесії (той самий набір повторювався на кожному
// маршруті). Потрібен для "живого" режиму на Ticket.tsx/OrderSuccess.tsx, коли
// order_registry розходиться з живими даними бекенду (хтось змінив замовлення вручну) —
// selectedTrip у сторі часто недоступний у цей момент, тож перекласти dsc id в назву
// нема звідки, окрім цього списку. id=43 НЕ включений навмисно (ігнорується скрізь,
// та сама причина, що й в основному ціноутворенні).
export interface DiscountCatalogEntry {
  id: string
  name: string
  discount: number
}

export const DISCOUNT_CATALOG: DiscountCatalogEntry[] = [
  { id: '0', name: 'За повним тарифом', discount: 0 },
  { id: '55', name: 'За повним тарифом', discount: 0 },
  { id: '4', name: 'Особи, старші за 60', discount: 10 },
  { id: '5', name: 'Особи з інвалідністю (I-II група)', discount: 10 },
  { id: '7', name: 'Група від 6 осіб', discount: 5 },
  { id: '8', name: 'доп. место', discount: 20 },
  { id: '51', name: 'Тварина', discount: 20 },
  { id: '64', name: 'Військовослужбовці з УБД', discount: 20 },
  { id: '66', name: 'Діти до 1 року', discount: 50 },
  { id: '67', name: 'Діти 1 - 10 років', discount: 30 },
  { id: '68', name: 'Діти 10 - 15 років', discount: 10 },
]

// Кеп (28.08): для "sale-online"-подібного id, якого немає в списку взагалі (напр. якщо
// бекенд повернув живий dsc, що не збігається з жодною відомою категорією) — резервна
// назва, без конкретного %.
export function lookupDiscount(id: string | number | undefined | null): DiscountCatalogEntry | null {
  if (id == null) return null
  return DISCOUNT_CATALOG.find(d => d.id === String(id)) || null
}
