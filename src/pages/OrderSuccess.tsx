import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookingStore } from '../store'
import { cancelOrder, restoreOrder } from '../api/euroclub'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

function splitDateTime(str?: string): { date: string; time: string } {
  if (!str) return { date: '', time: '--:--' }
  const [date, time] = str.split(' ')
  return { date: date || '', time: time || '--:--' }
}

function calcDuration(depStr?: string, arrStr?: string): string {
  if (!depStr || !arrStr) return ''
  const parse = (s: string) => {
    const [datePart, timePart] = s.split(' ')
    const [d, m, y] = datePart.split('.').map(Number)
    const [h, min] = (timePart || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }
  const diffMin = Math.round((parse(arrStr).getTime() - parse(depStr).getTime()) / 60000)
  if (diffMin <= 0) return ''
  const h = Math.floor(diffMin / 60), m = diffMin % 60
  return m > 0 ? `${h}г ${m}хв` : `${h}г`
}

export default function OrderSuccess() {
  const nav = useNavigate()
  const { orderHash, orderData, selectedTrip, selectedSeats } = useBookingStore()
  const [status, setStatus] = useState<'active'|'cancelled'>('active')
  const [loading, setLoading] = useState(false)

  const trip = selectedTrip as any
  const data = orderData as any
  // Prefer order data from order_new response (real, confirmed), fall back to selected trip for display before booking completes
  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const depDT = splitDateTime(data?.ftime || dep?.time)
  const arrDT = splitDateTime(data?.ttime || arr?.time)
  const duration = calcDuration(data?.ftime || dep?.time, data?.ttime || arr?.time)
  const hasTransfer = Number(trip?.transfer) === 1
  const transferStop = trip?.stopping?.find((s: any) => Number(s.transfer) === 1)

  const hash = orderHash || data?.hash || ''
  const displayOrder = hash ? hash.slice(-6).toUpperCase() : '------'
  const currencySign = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? '€' : '₴'
  const price = data?.price ?? trip?.price ?? 0
  const summ = data?.summ ?? price
  const passengers = data?.passangers || []

  const handleCancel = async () => {
    if (!hash || !window.confirm('Скасувати замовлення?')) return
    setLoading(true)
    try {
      await cancelOrder(hash)
      setStatus('cancelled')
    } catch { alert('Помилка') }
    finally { setLoading(false) }
  }

  const handleRestore = async () => {
    if (!hash) return
    setLoading(true)
    try {
      await restoreOrder(hash)
      setStatus('active')
    } catch { alert('Помилка') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
        {/* Status icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: status === 'active' ? '#E8F5E9' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {status === 'active' ? '✅' : '✔️'}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Ваше замовлення оформлене!</div>
          <div style={{ color: ORange, fontWeight: 800, fontSize: 20, marginBottom: status === 'cancelled' ? 6 : 0 }}>order #{displayOrder}</div>
          {status === 'cancelled' && <div style={{ color: '#E53935', fontWeight: 700, fontSize: 15 }}>Скасовано</div>}
        </div>

        {/* Trip card */}
        <div style={{ border: '1.5px solid #EEE', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 10 }}>
            <span>{depDT.date} → {arrDT.date}</span>
            {duration && <span>⏱ {duration}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{depDT.time}</div>
              <div style={{ fontSize: 13 }}>{dep?.city || data?.from_city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{dep?.name || data?.fstation}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16 }}>{hasTransfer ? '🚌→🔄' : '🚌'}</span>
              {hasTransfer && transferStop && <span style={{ fontSize: 10, color: Gray }}>{transferStop.city_ua || transferStop.city}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{arrDT.time}</div>
              <div style={{ fontSize: 13 }}>{arr?.city || data?.to_city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{arr?.name || data?.tstation}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px dashed #EEE', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: Gray }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{price} {currencySign}</span>
          </div>
        </div>

        {/* Passengers */}
        {passengers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 12, color: Gray, marginBottom: 8 }}>
              <span>Пасажир</span><span style={{ textAlign: 'center' }}>Місце</span><span style={{ textAlign: 'right' }}>Ціна</span>
            </div>
            {passengers.map((p: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 4, fontSize: 14 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <span>💺</span><span>{p.place}</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{price} {currencySign}</div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>До сплати</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18 }}>
            <span>Усього</span>
            <span>{summ} {currencySign}</span>
          </div>
        </div>

        {status === 'active' ? (
          <>
            <button onClick={() => nav('/payment')} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
              Перейти до оплати
            </button>
            <button onClick={handleCancel} disabled={loading} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: Gray, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              {loading ? '...' : 'Скасувати замовлення'}
            </button>
          </>
        ) : (
          <button onClick={handleRestore} disabled={loading} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            {loading ? '...' : 'Відновити замовлення'}
          </button>
        )}
      </div>
    </div>
  )
}
