import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalOrders, saveOrderLocally, getOrderInfo } from '../api/euroclub'
import { getUserOrders } from '../api/auth'
import { useBookingStore } from '../store'
import { ticketAvailable, statusLabel, payInfo, isCancelled, isCompleted } from '../orderStatus'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function MyTickets() {
  const nav = useNavigate()
  const { setOrderResult } = useBookingStore()
  const t = useT()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const local = getLocalOrders()

    // Довантажити свіжий order_info для всіх активних (ще не завершених/скасованих) замовлень.
    // Ціна/оплата — змінні поля (менеджер може відредагувати вручну будь-коли), тож кешу
    // чи короткому списку user-orders не довіряємо, завжди звіряємо з сервером напряму.
    async function refreshFresh(byHash: Record<string, any>) {
      const list = Object.values(byHash)
      const needsFresh = list.filter((o: any) => !isCancelled(o) && !isCompleted(o) && o?.hash)
      if (needsFresh.length > 0) {
        const fresh = await Promise.all(
          needsFresh.map((o: any) => getOrderInfo(o.hash).then((r: any) => r.orders?.[0] || r).catch(() => null))
        )
        fresh.forEach((f: any, i: number) => {
          if (f) byHash[needsFresh[i].hash] = { ...byHash[needsFresh[i].hash], ...f }
        })
      }
      return Object.values(byHash)
    }

    function finish(merged: any[]) {
      merged.forEach((o: any) => saveOrderLocally(o.hash, o)) // кешуємо серверні дані локально
      merged.sort((a: any, b: any) => parseOrderDate(b.ftime) - parseOrderDate(a.ftime))
      setOrders(merged)
      setLoading(false)
    }

    getUserOrders()
      .then(async (res: any) => {
        // Формат відповіді user-orders ще не підтверджений на реальних даних —
        // пробуємо кілька варіантів обгортки, щоб не впасти в порожній список даремно.
        const remote = Array.isArray(res) ? res
          : Array.isArray(res?.orders) ? res.orders
          : Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.list) ? res.list
          : []
        // Дедуп по hash: зливаємо поля, а не замінюємо повністю — user-orders (список)
        // може не містити pay_uah/pay_eur (це віддає лише order_info по конкретному hash),
        // тож локально закешовані повні дані (звідки summ/pay_* вже відомі) не мають загубитись.
        const byHash: Record<string, any> = {}
        for (const o of Object.values(local)) if ((o as any).hash) byHash[(o as any).hash] = { ...(o as any) }
        for (const o of remote) if (o.hash) byHash[o.hash] = { ...(byHash[o.hash] || {}), ...o }

        finish(await refreshFresh(byHash))
      })
      .catch(async () => {
        // user-orders недоступний (падає) — все одно звіряємо кожне локально відоме
        // замовлення напряму через order_info, щоб статус/ціна не лишались застарілими.
        const byHash: Record<string, any> = {}
        for (const o of Object.values(local)) if ((o as any).hash) byHash[(o as any).hash] = { ...(o as any) }
        finish(await refreshFresh(byHash))
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

  // Категорія замовлення для фільтра
  type Cat = 'active' | 'completed' | 'cancelled'
  const category = (o: any): Cat => {
    if (isCancelled(o)) return 'cancelled'
    if (isCompleted(o)) return payInfo(o).paid > 0 ? 'completed' : 'cancelled'
    return 'active'
  }
  const [filter, setFilter] = useState<Cat | 'all'>('active')
  const filtered = filter === 'all' ? orders : orders.filter(o => category(o) === filter)
  const counts = {
    active: orders.filter(o => category(o) === 'active').length,
    completed: orders.filter(o => category(o) === 'completed').length,
    cancelled: orders.filter(o => category(o) === 'cancelled').length,
    all: orders.length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px' }}>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('orders.title')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', overflowX: 'auto' }}>
        {([
          ['active', `${t('orders.active')}${counts.active ? ` (${counts.active})` : ''}`],
          ['completed', `${t('orders.completed')}${counts.completed ? ` (${counts.completed})` : ''}`],
          ['cancelled', `${t('orders.cancelled')}${counts.cancelled ? ` (${counts.cancelled})` : ''}`],
          ['all', t('orders.all')],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            background: filter === key ? ORange : '#fff',
            color: filter === key ? '#fff' : '#555',
            boxShadow: filter === key ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {loading && <p style={{ color: Gray, textAlign: 'center', paddingTop: 40 }}>{t('orders.loading')}</p>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
            <p style={{ color: Gray, fontSize: 16 }}>{orders.length === 0 ? t('orders.empty') : t('orders.emptyFiltered')}</p>
            {orders.length === 0 && (
              <button onClick={() => nav('/')} style={{ marginTop: 20, padding: '12px 28px', background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t('orders.findTrip')}
              </button>
            )}
          </div>
        )}
        {filtered.map((o, i) => {
          const st = statusLabel(o)
          const paid = ticketAvailable(o, o.hash)
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{o.from_city} → {o.to_city}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.text}</span>
              </div>
              <div style={{ color: Gray, fontSize: 13, marginBottom: 10 }}>{o.ftime} → {o.ttime}</div>
              <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 10 }}>
                <span style={{ color: Gray, fontSize: 12 }}>{orderNo(o)}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => openOrder(o)} style={{ flex: 1, padding: '11px 0', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  {t('orders.order')}
                </button>
                {paid && (
                  <button onClick={() => openTicket(o)} style={{ flex: 1, padding: '11px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {t('orders.ticket')}
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
