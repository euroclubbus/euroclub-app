import { useEffect, useRef } from 'react'
import { getUserOrders } from './api/auth'
import { syncAllOrdersInList } from './orderRegistry'

// Опитує user-orders кожні 15с (було 0.5с — за домовленістю з Кепом зменшуємо навантаження
// на бекенд) — лише коли active && додаток на передньому плані, і лише поки відкритий
// конкретний екран замовлення/оплати (Payment/Ticket/TicketDetails/OrderSuccess).
// "Мої замовлення" (список) сюди не належить — там окремий одноразовий запит при
// першому вході, з кешем у localStorage, без цього циклу.
//
// ВАЖЛИВО (пояснено прогеру): order_info (перевірка ОДНОГО замовлення) — застарілий метод,
// підтверджено самим прогером. Єдиний доступний зараз — user-orders, який завжди повертає
// ПОВНИЙ список замовлень користувача; фільтрація на потрібне oid відбувається вже на
// клієнті. Це не наш вибір архітектури — так влаштований бекенд зараз.
//
// Кеп (19.08): раніше тут викликався findUserOrder(oid), який діставав ПОВНИЙ масив і одразу
// викидав усе, крім одного замовлення — хоча кожен елемент масиву вже містить
// status/paid_uah/paid_eur/app/user_id для СВОГО замовлення. Тепер синхронізуємо ВЕСЬ масив
// (syncAllOrdersInList) за кожен тік — це "прогріває" реєстр для ВСІХ замовлень юзера, не
// лише того, що зараз на екрані, і не коштує жодного додаткового запиту до бекенду.
//
// Кеп (25.08): sessionKey/user_sessions ПРИБРАНО — прогер дав справжній адмін-метод
// (oid2user-orders), адмінка більше не залежить від живої сесії юзера взагалі.
export function useOrderPolling(oid: string, active: boolean, onUpdate: (order: any) => void) {
  const cb = useRef(onUpdate); cb.current = onUpdate
  useEffect(() => {
    if (!oid || !active) return
    let stopped = false
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const res: any = await getUserOrders()
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        if (stopped) return
        const o = list.find((x: any) => String(x.oid ?? x.hash) === String(oid))
        if (o) cb.current(o)
        // Синхронізуємо ВЕСЬ список одразу, не тільки поточне замовлення.
        syncAllOrdersInList(list)
      } catch {}
    }
    tick()
    const timer = setInterval(tick, 15000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [oid, active])
}
