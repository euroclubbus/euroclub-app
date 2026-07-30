import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { getLocalOrders, saveOrderLocally } from '../api/euroclub'
import { getUserOrders } from '../api/auth'
import { useBookingStore } from '../store'
import { ticketAvailable, statusLabel, payInfo, isCancelled, isCompleted, isPaidCancellation, keepOurPrice} from '../orderStatus'
import { syncOrderRegistryStatus } from '../orderRegistry'
import { getSyncedOids, addSyncedOids } from '../orderSync'
import SideMenu from '../components/SideMenu'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'
const Navy = '#0A4684'

export default function MyTickets() {
  console.log('[MyTickets] Component MOUNTED')
  const nav = useNavigate()
  const { setOrderResult } = useBookingStore()
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Синхронний виклик щоразу, коли пасажир реально бачить цю вкладку — не лише при першому
  // заході по роутеру (це й так спрацьовує), а й коли застосунок повертається з фону
  // (visibilitychange/focus) без повної навігації, або вручну кнопкою "Оновити". Саме так
  // замовлення, які вже скасовані на бекенді, але лишились локально як "очікує оплати",
  // підтягують актуальний статус.
  const loadOrders = useCallback(() => {
    console.log('[MyTickets] loadOrders called')
    if (typeof window !== 'undefined') {
      (window as any).__myTicketsDebug = { called: true, timestamp: Date.now() }
    }
    setLoading(true)
    const local = getLocalOrders()
    console.log('[MyTickets] Local orders:', Object.keys(local).length, 'items')

    function finish(merged: any[]) {
      console.log('[MyTickets] finish() called with', merged.length, 'orders')
      merged.forEach((o: any) => saveOrderLocally(o.hash, o)) // кешуємо серверні дані локально
      setOrders(merged)
      setLoading(false)
    }

    getUserOrders()
      .then((res: any) => {
        console.log('[MyTickets] getUserOrders succeeded, res:', res)
        // Формат підтверджено: { data: [...замовлення], cab: {...статистика кабінету} }
        const remote = Array.isArray(res?.data) ? res.data
          : Array.isArray(res) ? res
          : Array.isArray(res?.orders) ? res.orders
          : Array.isArray(res?.list) ? res.list
          : []
        console.log('[MyTickets] Remote array has', remote.length, 'items')
        
        // Синхронізуємо список всіх oidів з бекенду в localStorage
        const remoteOids = remote.map((o: any) => o.oid ?? o.hash).filter(Boolean)
        console.log('[MyTickets] Remote oids from backend:', remoteOids)
        addSyncedOids(remoteOids)
        // Дедуп за ідентифікатором замовлення. ВАЖЛИВО: бекенд віддає його як `oid`, не
        // `hash` (order_info з полем hash — застарілий метод, прогер підтвердив не
        // використовувати). Внутрішньо в застосунку ключ поля лишається `.hash` (так
        // історично склалось у решті коду), але значення — завжди `oid`. Раніше тут
        // перевірялось `if (!o.hash) continue`, і всі записи з user-orders (де є тільки
        // oid) відсіювались — замовлення, відомі лише з сервера, зникали зі списку.
        const byId: Record<string, any> = {}
        for (const o of Object.values(local)) {
          const id = (o as any).hash ?? (o as any).oid
          if (id) byId[String(id)] = { ...(o as any) }
        }
        for (const o of remote) {
          const id = o.oid ?? o.hash
          if (!id) continue
          const key = String(id)
          const normalized = { ...o, hash: key, oid: key }
          byId[key] = byId[key] ? keepOurPrice(byId[key], normalized) : normalized
          syncOrderRegistryStatus(key, o.status, Number(o.paid_uah) || 0, Number(o.paid_eur) || 0)
          // Перший раз бачимо це замовлення (нема локального запису з датою бронювання) —
          // фіксуємо дату зараз, назавжди. Без цього кроку сортування "останнє зверху"
          // непослідовне: одні замовлення сортуються за датою бронювання, інші (без неї) —
          // за датою поїздки, і порядок виглядає невірним.
          if (!byId[key].bookingDate) byId[key].bookingDate = new Date().toISOString()
        }

        finish(Object.values(byId))
      })
      .catch((e) => {
        console.error('[MyTickets] getUserOrders FAILED:', e)
        console.log('[MyTickets] Falling back to local cache only')
        finish(Object.values(local))
      })
  }, [])

  useEffect(() => {
    console.log('[MyTickets] useEffect triggered, calling loadOrders')
    loadOrders()

    // Застосунок повернувся на передній план, поки вкладка вже була відкрита — теж оновити.
    const onVisible = () => { 
      console.log('[MyTickets] onVisible triggered, calling loadOrders')
      if (document.visibilityState === 'visible') loadOrders() 
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', loadOrders)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', loadOrders)
    }
  }, [loadOrders])

  function parseOrderDate(str: any): number {
    const m = String(str || '').match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
    if (!m) return 0
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime()
  }

  // Ротація списку — за НОМЕРОМ ЗАМОВЛЕННЯ (oid) для режиму "за датою бронювання", а не за
  // локальною датою. Номер замовлення на бекенді присвоюється послідовно — більший номер
  // завжди означає пізніше бронювання, і це не залежить від локальних даних пристрою, які
  // можна ненавмисно загубити (саме це й ламало сортування раніше — bookingDate губилась
  // при кожному оновленні, і "останнє зверху" ставало довільним).
  const [sortMode, setSortMode] = useState<'booking' | 'trip'>('booking')
  function orderSortKey(o: any): number {
    if (sortMode === 'trip') {
      const td = parseOrderDate(o?.ftime)
      // Невідома дата рейсу — в кінець списку (не змішувати шкалу з oid, який на порядки менший)
      return td > 0 ? td : Number.MAX_SAFE_INTEGER
    }
    const oidNum = Number(o?.oid ?? o?.hash)
    return !isNaN(oidNum) ? oidNum : 0
  }

  const openTicket = (o: any) => { setOrderResult(o.hash, o); nav('/ticket') }
  const openOrder = (o: any) => { setOrderResult(o.hash, o); nav('/order-success') }

  const orderNo = (o: any) => {
    const src = String(o.ticket || o.link1 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    const num = m ? m[1] : String(o.hash || o.oid || '')
    return num ? num.padStart(9, '0') : ''
  }

  // Категорія замовлення для фільтра
  type Cat = 'active' | 'completed' | 'cancelled'
  const category = (o: any): Cat => {
    if (isCancelled(o)) return 'cancelled'
    if (isCompleted(o)) return payInfo(o).paid > 0 ? 'completed' : 'cancelled'
    return 'active'
  }
  // "Оплачені" — окремий, наскрізний фільтр (не категорія): оплачене замовлення може бути
  // одночасно і активним (поїздка ще попереду), і виконаним — тому рахуємо його окремо,
  // а не як ще один взаємовиключний стан поруч з active/completed/cancelled.
  const isPaid = (o: any) => payInfo(o).fullyPaid
  const [filter, setFilter] = useState<Cat | 'paid' | 'all'>('active')
  const sortedOrders = [...orders].sort((a, b) =>
    sortMode === 'trip' ? orderSortKey(a) - orderSortKey(b) : orderSortKey(b) - orderSortKey(a)
  )
  const filtered = filter === 'all' ? sortedOrders : filter === 'paid' ? sortedOrders.filter(isPaid) : sortedOrders.filter(o => category(o) === filter)
  const counts = {
    active: orders.filter(o => category(o) === 'active').length,
    completed: orders.filter(o => category(o) === 'completed').length,
    cancelled: orders.filter(o => category(o) === 'cancelled').length,
    paid: orders.filter(isPaid).length,
    all: orders.length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('orders.title')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', overflowX: 'auto', alignItems: 'center' }}>
        {([
          ['active', `${t('orders.active')}${counts.active ? ` (${counts.active})` : ''}`],
          ['completed', `${t('orders.completed')}${counts.completed ? ` (${counts.completed})` : ''}`],
          ['cancelled', `${t('orders.cancelled')}${counts.cancelled ? ` (${counts.cancelled})` : ''}`],
          ['paid', `Оплачені${counts.paid ? ` (${counts.paid})` : ''}`],
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
        <button onClick={loadOrders} disabled={loading} aria-label={t('common.refresh') || 'Оновити'} style={{
          marginLeft: 'auto', flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: 'none',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          opacity: loading ? 0.5 : 1,
        }}>{loading ? '…' : '⟳'}</button>
      </div>

      {/* Перемикач сортування: за датою бронювання (коли оформлено) чи за датою рейсу (коли поїздка) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 0' }}>
        <span style={{ fontSize: 12, color: Gray }}>Сортувати:</span>
        <div style={{ display: 'inline-flex', borderRadius: 20, background: '#fff', padding: 3, gap: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {([
            ['booking', 'За датою бронювання'],
            ['trip', 'За датою поїздки'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortMode(key)} style={{
              padding: '6px 12px', borderRadius: 17, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: sortMode === key ? ORange : 'transparent',
              color: sortMode === key ? '#fff' : '#999',
            }}>{label}</button>
          ))}
        </div>
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
          const alertPaidCancel = isPaidCancellation(o)
          const createdAt = o.bookingDate ? new Date(o.bookingDate) : null
          const createdAtStr = createdAt && !isNaN(createdAt.getTime())
            ? createdAt.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <div key={i} onClick={() => openOrder(o)} style={{
              background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)', cursor: 'pointer',
              border: alertPaidCancel ? '2px solid #E53935' : '1px solid transparent',
              borderLeft: `5px solid ${alertPaidCancel ? '#E53935' : st.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.from_city} → {o.to_city}</span>
                  {o.roundTrip && (
                    <span title="Туди-назад" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#EAF1FB', color: Navy }}>⇄ туди-назад</span>
                  )}
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.text}</span>
              </div>
              <div style={{ color: Gray, fontSize: 13, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span title="Дати рейсу туди">🚌</span>{o.ftime} → {o.ttime}</span>
                {o.roundTrip && o.ftime2 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span title="Дати рейсу назад">🔄</span>{o.ftime2} → {o.ttime2}</span>
                )}
              </div>
              {alertPaidCancel && (
                <div style={{ background: '#FDECEA', border: '1px solid #E53935', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ color: '#E53935', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    Замовлення оплачене, але скасоване — зверніться в службу підтримки
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <a href="tel:+380674875878" onClick={e => e.stopPropagation()} style={{ color: '#E53935', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>+380674875878</a>
                    <a href="tel:+491522503600" onClick={e => e.stopPropagation()} style={{ color: '#E53935', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>+491522503600</a>
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ color: Gray, fontSize: 12 }}>{orderNo(o)}</span>
                {createdAtStr && <span style={{ color: Gray, fontSize: 11.5 }}>створено {createdAtStr}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={e => { e.stopPropagation(); openOrder(o) }} style={{ flex: 1, padding: '11px 0', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  {t('orders.order')}
                </button>
                {paid && (
                  <button onClick={e => { e.stopPropagation(); openTicket(o) }} style={{ flex: 1, padding: '11px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {t('orders.ticket')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
