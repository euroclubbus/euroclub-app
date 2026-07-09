import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalOrders, saveOrderLocally } from '../api/euroclub'
import { getUserOrders } from '../api/auth'
import { useBookingStore } from '../store'
import { ticketAvailable, statusLabel, payInfo } from '../orderStatus'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function MyTickets() {
  const nav = useNavigate()
  const { setOrderResult } = useBookingStore()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const local = getLocalOrders()

    getUserOrders()
      .then((res: any) => {
        const remote = res.orders || []
        // Дедуп по hash: серверні дані пріоритетні (свіжіші), локальні лишаються для того, чого сервер ще не бачить
        const byHash: Record<string, any> = {}
        for (const o of Object.values(local)) if ((o as any).hash) byHash[(o as any).hash] = o
        for (const o of remote) if (o.hash) byHash[o.hash] = o

        const merged = Object.values(byHash)
        merged.forEach((o: any) => saveOrderLocally(o.hash, o)) // кешуємо серверні дані локально
        merged.sort((a: any, b: any) => parseOrderDate(b.ftime) - parseOrderDate(a.ftime))
        setOrders(merged)
        setLoading(false)
      })
      .catch(() => {
        // API недоступне — показуємо хоч що є локально
        const list = Object.values(local)
        list.sort((a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0))
        setOrders(list)
        setLoading(false)
      })
  }, [])

  function parseOrderDate(str: any): number {
    const m = String(str || '').match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
    if (!m) return 0
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
  }

  const openTicket = (o: any) => { setOrderResult(o.hash, o); nav('/ticket') }
  const openOrder = (o: any) => { setOrderResult(o.hash, o); nav('/order-success') }

  const orderNo = (o: any) => {
    const src = String(o.ticket || o.link1 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    return m ? '000' + m[1] : (o.hash ? '000' + o.hash.slice(-6).toUpperCase() : '')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px' }}>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Мої квитки</span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: Gray, textAlign: 'center', paddingTop: 40 }}>Завантаження...</p>}
        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
            <p style={{ color: Gray, fontSize: 16 }}>Замовлень поки немає</p>
            <button onClick={() => nav('/')} style={{ marginTop: 20, padding: '12px 28px', background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }}>
              Знайти рейс
            </button>
          </div>
        )}
        {orders.map((o, i) => {
          const st = statusLabel(o)
          const paid = ticketAvailable(o, o.hash)
          const cur = (o.crc || 'uah').toLowerCase() === 'eur' ? '€' : '₴'
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{o.from_city} → {o.to_city}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.text}</span>
              </div>
              <div style={{ color: Gray, fontSize: 13, marginBottom: 10 }}>{o.ftime} → {o.ttime}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F5F5F5', paddingTop: 10 }}>
                <span style={{ color: Gray, fontSize: 12 }}>{orderNo(o)}</span>
                <span style={{ fontWeight: 800, fontSize: 17 }}>{o.summ ?? o.price} {cur}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => openOrder(o)} style={{ flex: 1, padding: '11px 0', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Замовлення
                </button>
                {paid && (
                  <button onClick={() => openTicket(o)} style={{ flex: 1, padding: '11px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Квиток
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
