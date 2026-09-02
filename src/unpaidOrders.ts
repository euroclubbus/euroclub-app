import { create } from 'zustand'
import { getUserOrders } from './api/auth'
import { isCancelled, payInfo } from './orderStatus'
import { useAuthStore } from './authStore'

// Одне спільне джерело для трьох речей одразу (Кеп, 12.08):
// 1. Бейдж-цифра на іконці "Мої замовлення" в нижній навігації
// 2. Оранжева плашка на Головній ("У вас є неоплачене бронювання")
// 3. Перевірка "чи вже є неоплачене замовлення на цей самий маршрут+дату" при новому пошуку
//
// Рахуємо тільки неоплачені й НЕ скасовані замовлення з датою поїздки сьогодні або пізніше
// (за тим самим правилом, що вже діє для опитування — минулі замовлення нікого не цікавлять
// в контексті "треба оплатити").
//
// Кеп (01.09), знайдено живим тестом: якщо ftime не вдавалось розпізнати — замовлення
// МОВЧКИ виключалось (return false), хоча за тим самим принципом, що вже застосований в
// restoreEligibility() нижче в цьому файлі, "дату не визначено" — це "не можемо
// перевірити", а НЕ "не підходить". Раніше через це РЕАЛЬНО неоплачені замовлення з
// відсутнім ftime (задокументована, відома проблема — не завжди повертається в
// user-orders) взагалі не з'являлись у бейджі/плашці, хоча коректно показувались в
// "Мої квитки" (там дата лише впливає на сортування, не на видимість).
function isUnpaidFuture(o: any): boolean {
  if (isCancelled(o)) return false
  if (payInfo(o).fullyPaid) return false
  const m = String(o?.ftime || '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (!m) return true // дату не визначено — не виключаємо, показуємо як є
  const tripDate = new Date(+m[3], +m[2] - 1, +m[1]).getTime()
  const todayStart = new Date(new Date().toDateString()).getTime()
  return tripDate >= todayStart
}

interface UnpaidOrdersState {
  orders: any[]
  loading: boolean
  refresh: () => Promise<void>
}

export const useUnpaidOrdersStore = create<UnpaidOrdersState>((set) => ({
  orders: [],
  loading: false,
  refresh: async () => {
    const user = useAuthStore.getState().user
    if (!user) { set({ orders: [] }); return }
    set({ loading: true })
    try {
      const res: any = await getUserOrders()
      const list = Array.isArray(res?.data) ? res.data
        : Array.isArray(res) ? res
        : Array.isArray(res?.orders) ? res.orders
        : Array.isArray(res?.list) ? res.list
        : []
      set({ orders: list.filter(isUnpaidFuture), loading: false })
    } catch (e) {
      console.error('[UnpaidOrders] refresh failed', e)
      set({ loading: false })
    }
  },
}))

// Знаходить неоплачені замовлення юзера на ТОЙ САМИЙ маршрут (за id міст) і ТУ САМУ дату
// поїздки туди (dateISO — формат YYYY-MM-DD, як у пошуковому сторі). Використовується перед
// новим пошуком, щоб попередити про можливий дубль.
export function findMatchingUnpaidOrders(orders: any[], fromId: string | number | undefined, toId: string | number | undefined, dateISO: string): any[] {
  if (!fromId || !toId || !dateISO) return []
  return orders.filter((o) => {
    const okRoute = String(o.from1 ?? '') === String(fromId) && String(o.to1 ?? '') === String(toId)
    if (!okRoute) return false
    const m = String(o?.ftime || '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
    if (!m) return false
    const orderDateISO = `${m[3]}-${m[2]}-${m[1]}`
    return orderDateISO === dateISO
  })
}
