// Кеп (28.08): статичний каталог категорій знижок — id → {назва, %}. Зібраний з реальних
// trip.discounts, які бачили в цій сесії (той самий набір повторювався на кожному
// маршруті). Потрібен для "живого" режиму на Ticket.tsx/OrderSuccess.tsx, коли
// order_registry розходиться з живими даними бекенду (хтось змінив замовлення вручну) —
// selectedTrip у сторі часто недоступний у цей момент, тож перекласти dsc id в назву
// нема звідки, окрім цього списку.
export interface DiscountCatalogEntry {
  id: string
  name: string
  discount: number
  recognized: boolean // Кеп (18.09): false = нерозпізнаний id, підставлена загальна назва — для reportIssue()
}

export const DISCOUNT_CATALOG: Omit<DiscountCatalogEntry, 'recognized'>[] = [
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
  // Кеп (28.09): офіційний список eclub.com.ua/api/mobile/json/discounts — старі SALE
  // (id 43 = "SALE 15% online", НЕ "знижка при передоплаті", як вважали з 27.08).
  { id: '46', name: 'SALE 5% online', discount: 5 },
  { id: '36', name: 'SALE 10% online', discount: 10 },
  { id: '43', name: 'SALE 15% online', discount: 15 },
  { id: '34', name: 'SALE 20% online', discount: 20 },
  { id: '44', name: 'SALE 25% online', discount: 25 },
  { id: '33', name: 'SALE 30% online', discount: 30 },
  { id: '53', name: 'SALE 35% online', discount: 35 },
  { id: '54', name: 'SALE 40% online', discount: 40 },
  { id: '70', name: 'SALE 45% online', discount: 45 },
  { id: '45', name: 'SALE 50% online', discount: 50 },
  { id: '61', name: 'SALE 60% online', discount: 60 },
  // MOB 1–40: id = 100 + %. Усі онлайн-знижки застосунку тепер ідуть саме так.
  ...Array.from({ length: 40 }, (_, i) => ({ id: String(101 + i), name: `MOB ${i + 1}`, discount: i + 1 })),
]

// Кеп (18.09): для SALE-категорій (id тепер РІЗНИЙ по кожному маршруту — 36, 46, ...) —
// принципово НЕМОЖЛИВО заздалегідь знати всі id у статичному списку. Якщо id
// нерозпізнаний — показуємо загальну назву "Знижка" (не порожньо), БЕЗ вигаданого %
// (бо реального % ми тут не знаємо — тільки id, без доступу до trip.discounts).
// recognized:false сигналізує викликачу, що варто повідомити через reportIssue().
export function lookupDiscount(id: string | number | undefined | null): DiscountCatalogEntry | null {
  if (id == null) return null
  const found = DISCOUNT_CATALOG.find(d => d.id === String(id))
  if (found) return { ...found, recognized: true }
  return { id: String(id), name: 'Знижка', discount: 0, recognized: false }
}
