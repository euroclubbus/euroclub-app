import { useEffect, useRef } from 'react'
import { findUserOrder } from './api/auth'
import { syncOrderRegistryStatus } from './orderRegistry'

// Опитує user-orders кожні 3с (тимчасово для тесту — раніше було 0.5с за прямою вимогою
// прогера) — лише коли active &&
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
  const lastSynced = useRef<string>('')
  useEffect(() => {
    if (!oid || !active) return
    let stopped = false
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const o = await findUserOrder(oid)
        if (!stopped && o) {
          // ТЕСТ (тимчасовий, для перевірки): друкуємо сирі summ/needpay з КОЖНОГО тіку —
          // це те, що ми РЕАЛЬНО отримуємо з мережі, незалежно від того, що потім вирішуємо
          // показати на екрані.
          console.log('[POLL RAW]', oid, 'summ=', o.summ, 'needpay_uah=', o.needpay_uah, 'needpay_eur=', o.needpay_eur)
          cb.current(o)
          // Реальний статус/оплата з бекенду — в реєстр панелі керування, але тільки коли
          // значення дійсно змінилось, щоб не смітити зайвими записами щопів'ятсот мс.
          const key = `${o.status}|${o.paid_uah}|${o.paid_eur}`
          if (key !== lastSynced.current) {
            lastSynced.current = key
            syncOrderRegistryStatus(oid, o.status, Number(o.paid_uah) || 0, Number(o.paid_eur) || 0)
          }
        }
      } catch {}
    }
    tick()
    const timer = setInterval(tick, 3000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [oid, active])
}
