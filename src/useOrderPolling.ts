import { useEffect, useRef } from 'react'
import { findUserOrder } from './api/auth'

// Опитує user-orders кожні 0.5с (за прямою вимогою прогера) — лише коли active &&
// додаток на передньому плані, і лише поки відкритий конкретний екран замовлення/оплати
// (Payment/Ticket/TicketDetails/OrderSuccess). "Мої замовлення" (список) сюди не належить —
// там окремий одноразовий запит при вході/поверненні, без цього циклу.
//
// ВАЖЛИВО (пояснено прогеру): order_info (перевірка ОДНОГО замовлення) — застарілий метод,
// підтверджено самим прогером. Єдиний доступний зараз — user-orders, який завжди повертає
// ПОВНИЙ список замовлень користувача; фільтрація на потрібне oid відбувається вже на
// клієнті. Це не наш вибір архітектури — так влаштований бекенд зараз. Якщо навантаження
// критичне, потрібен легкий метод "статус одного замовлення за oid" з боку бекенду.
export function useOrderPolling(oid: string, active: boolean, onUpdate: (order: any) => void) {
  const cb = useRef(onUpdate); cb.current = onUpdate
  useEffect(() => {
    if (!oid || !active) return
    let stopped = false
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const o = await findUserOrder(oid)
        if (!stopped && o) cb.current(o)
      } catch {}
    }
    // Перший запит — не миттєво, а з паузою: бекенду треба встигнути "сформувати" ціну
    // (round-trip) після neworder, інакше перший тік ловить нестабільне проміжне значення.
    let timer: ReturnType<typeof setInterval> | null = null
    const first = setTimeout(() => { tick(); timer = setInterval(tick, 500) }, 5000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearTimeout(first); if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [oid, active])
}
