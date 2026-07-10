import { useEffect, useRef } from 'react'
import { getOrderInfo } from './api/euroclub'

// Опитує order_info кожні 0.3с — лише коли active && додаток на передньому плані.
// Один запит одразу при відкритті та при поверненні у передній план.
export function useOrderPolling(hash: string, active: boolean, onUpdate: (order: any) => void) {
  const cb = useRef(onUpdate); cb.current = onUpdate
  useEffect(() => {
    if (!hash || !active) return
    let stopped = false
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const res: any = await getOrderInfo(hash)
        const o = res.orders?.[0] || res
        if (!stopped && o && (o.hash || o.status)) cb.current(o)
      } catch {}
    }
    tick()
    const timer = setInterval(tick, 300)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVis) }
  }, [hash, active])
}
