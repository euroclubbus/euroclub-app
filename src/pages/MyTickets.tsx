import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocalOrders, getOrderInfo } from '../api/euroclub'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function MyTickets() {
  const nav = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const local = getLocalOrders()
    const list = Object.values(local)
    if (list.length === 0) { setLoading(false); return }
    // Fetch fresh status for each
    Promise.all(list.map(o => getOrderInfo(o.hash as string).catch(() => o)))
      .then(results => { setOrders(results); setLoading(false) })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 80 }}>
      <div style={{ background: '#1A1A1A', padding: '20px 16px 16px' }}>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Мої квитки</span>
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
        {orders.map((o, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{o.from_city} → {o.to_city}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: o.status === 'active' ? '#E8F5E9' : '#F5F5F5',
                color: o.status === 'active' ? '#2E7D32' : Gray }}>
                {o.status === 'active' ? 'Активний' : 'Скасовано'}
              </span>
            </div>
            <div style={{ color: Gray, fontSize: 13, marginBottom: 10 }}>
              {o.ftime} → {o.ttime}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F5F5F5', paddingTop: 10 }}>
              <span style={{ color: Gray, fontSize: 12 }}>#{o.hash?.slice(-6).toUpperCase()}</span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{o.summ} {(o.crc || 'uah').toLowerCase() === 'eur' ? '€' : '₴'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
