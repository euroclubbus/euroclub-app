import { useEffect, useRef } from 'react'
import { findUserOrder } from './api/auth'

// Опитує user-orders кожні 2с (замінили застарілий order_info за вказівкою прогера —
// user-orders повертає весь список, тож не варто смикати його так само часто, як
// раніше смикали легкий одиничний order_info) — лише коли active && додаток на передньому
// плані. Один запит одразу при відкритті та при поверненні у передній план.
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
    tick()
    const timer = setInterval(tick, 2000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [oid, active])
}
