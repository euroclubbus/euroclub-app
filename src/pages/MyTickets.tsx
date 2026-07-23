import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { getLocalOrders, saveOrderLocally } from '../api/euroclub'
import { getUserOrders } from '../api/auth'
import { useBookingStore } from '../store'
import { ticketAvailable, statusLabel, payInfo, isCancelled, isCompleted, isPaidCancellation, keepOurPrice } from '../orderStatus'
import SideMenu from '../components/SideMenu'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'
const Navy = '#0A4684'

export default function MyTickets() {
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
    setLoading(true)
    const local = getLocalOrders()

    function finish(merged: any[]) {
      merged.forEach((o: any) => saveOrderLocally(o.hash, o)) // кешуємо серверні дані локально
      setOrders(merged)
      setLoading(false)
    }

    getUserOrders()
      .then((res: any) => {
        // Формат підтверджено: { data: [...замовлення], cab: {...статистика кабінету} }
        const remote = Array.isArray(res?.data) ? res.data
          : Array.isArray(res) ? res
          : Array.isArray(res?.orders) ? res.orders
          : Array.isArray(res?.list) ? res.list
          : []
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
          // Перший раз бачимо це замовлення (нема локального запису з датою бронювання) —
          // фіксуємо дату зараз, назавжди. Без цього кроку сортування "останнє зверху"
          // непослідовне: одні замовлення сортуються за датою бронювання, інші (без неї) —
          // за датою поїздки, і порядок виглядає невірним.
          if (!byId[key].bookingDate) byId[key].bookingDate = new Date().toISOString()
        }

        finish(Object.values(byId))
      })
      .catch((e) => {
        console.error('[MyTickets] user-orders failed — показуємо тільки локальний кеш', e)
        finish(Object.values(local))
      })
  }, [])

  useEffect(() => {
    loadOrders()

    // Застосунок повернувся на передній план, поки вкладка вже була відкрита — теж оновити.
    const onVisible = () => { if (document.visibilityState === 'visible') loadOrders() }
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

  // Ротація списку — за датою БРОНЮВАННЯ (коли замовлення зроблено) або за датою РЕЙСУ
  // (коли сама поїздка) — перемикається кнопкою; в обох випадках найновіше/найближче вгорі.
  // Фолбек на іншу дату, якщо основна для цього режиму відсутня (наприклад, старі замовлення
  // без локальної bookingDate, синхронізовані з іншого пристрою через user-orders).
  const [sortMode, setSortMode] = useState<'booking' | 'trip'>('booking')
  function orderSortKey(o: any): number {
    const bd = o?.bookingDate ? new Date(o.bookingDate).getTime() : NaN
    const td = parseOrderDate(o?.ftime)
    if (sortMode === 'trip') return td || bd || 0
    return !isNaN(bd) ? bd : td
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
  const [filter, setFilter] = useState<Cat | 'all'>('active')
  const sortedOrders = [...orders].sort((a, b) => orderSortKey(b) - orderSortKey(a))
  const filtered = filter === 'all' ? sortedOrders : sortedOrders.filter(o => category(o) === filter)
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
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('orders.title')}</span>
          <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={24} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 0', overflowX: 'auto', alignItems: 'center' }}>
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
          return (
            <div key={i} style={{
              background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              border: alertPaidCancel ? '2px solid #E53935' : 'none',
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
                    <a href="tel:+380674875878" style={{ color: '#E53935', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>+380674875878</a>
                    <a href="tel:+491522503600" style={{ color: '#E53935', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>+491522503600</a>
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: Gray, fontSize: 12 }}>{orderNo(o)}</span>
                {o.bookingDate && (
                  <span style={{ color: Gray, fontSize: 11.5 }}>заброньовано {new Date(o.bookingDate).toLocaleDateString('uk-UA')}</span>
                )}
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
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
