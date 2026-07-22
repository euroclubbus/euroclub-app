import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookingStore, useSearchStore } from '../store'
import { cancelOrder, restoreOrder, getCities, getRoutes } from '../api/euroclub'
import { ticketAvailable, statusLabel, payInfo, needsPolling, canRestore, keepOurPrice } from '../orderStatus'
import { useOrderPolling } from '../useOrderPolling'
import { useDisplayPrice } from '../currency'
import SeatMap from './SeatMap'
import { addBonusPayment, getUserOrders, findUserOrder } from '../api/auth'
import { useT } from '../i18n'

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
  const t = useT()
  const { orderHash, orderData, selectedTrip, selectedTrip2, selectedSeats, setOrderResult } = useBookingStore()
  const { setFrom, setTo } = useSearchStore()
  const [status, setStatus] = useState<'active'|'cancelled'>('active')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState('')
  // Флоу відновлення неоплаченого скасованого замовлення
  const [restorePhase, setRestorePhase] = useState<'idle'|'checking'|'available'|'unavailable'>('idle')
  const [matchedTrip, setMatchedTrip] = useState<any>(null)
  const [showSeatMap, setShowSeatMap] = useState(false)
  const [chosenSeats, setChosenSeats] = useState<number[]>([])

  const trip = selectedTrip as any
  const trip2 = selectedTrip2 as any
  const isRoundTrip = !!trip2
  const dep2 = trip2?.departure?.[0]
  const arr2 = trip2?.arrival?.[0]
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

  // Списання бонусів (Cashback Club) — тільки перегляд і дія тут, на сторінці замовлення
  const [cabBonus, setCabBonus] = useState<number | null>(null)
  const [bonusInput, setBonusInput] = useState('')
  const [bonusApplying, setBonusApplying] = useState(false)
  const [bonusError, setBonusError] = useState('')
  const [bonusApplied, setBonusApplied] = useState(false)
  useEffect(() => {
    getUserOrders().then((res: any) => setCabBonus(Number(res?.cab?.['b='] ?? 0))).catch(() => {})
  }, [])
  const applyBonus = async () => {
    const amount = Number(bonusInput)
    if (!amount || amount <= 0 || !hash) return
    setBonusApplying(true); setBonusError('')
    try {
      const res: any = await addBonusPayment(String(amount), currencyCode === 'eur' ? 'eur' : 'uah', hash)
      if (res?.status === 'ok') {
        setBonusApplied(true)
        setBonusInput('')
        const fresh: any = await findUserOrder(hash).catch(() => null)
        if (fresh) setOrderResult(hash, keepOurPrice(data, fresh))
      } else {
        setBonusError(res?.error || 'Не вдалось списати бонуси')
      }
    } catch { setBonusError('Помилка мережі. Спробуйте ще раз.') }
    finally { setBonusApplying(false) }
  }
  const displayOrder = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    const num = m ? m[1] : String(hash || data?.oid || '')
    return num ? num.padStart(9, '0') : '000000000'
  })()
  const currencyCode = data?.crc || trip?.currency || 'uah'
  const { format } = useDisplayPrice()
  const price = data?.summ ?? data?.price ?? trip?.price ?? 0
  const summ = data?.summ ?? price
  const passengers = data?.passangers || []

  const [priceReady, setPriceReady] = useState(() => !needsPolling(data))
  useEffect(() => {
    if (priceReady) return
    // Запобіжник: order_info може зависнути/не спрацювати (ще не перевірено з новим oid) —
    // якщо за 4с відповіді нема, все одно показуємо те, що вже маємо, а не крутимо спінер вічно.
    const timer = setTimeout(() => setPriceReady(true), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useOrderPolling(hash, needsPolling(data), (o) => { setOrderResult(hash, keepOurPrice(data, o)); setPriceReady(true) })

  useEffect(() => {
    if (data?.status) {
      setStatus(String(data.status).toLowerCase().includes('cancel') ? 'cancelled' : 'active')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  const handleRefresh = async () => {
    if (!hash) return
    setRefreshing(true)
    try {
      const fresh: any = await findUserOrder(hash)
      if (fresh) {
        const merged = keepOurPrice(data, fresh)
        setOrderResult(hash, merged)
        if (merged.status && String(merged.status).toLowerCase().includes('cancel')) setStatus('cancelled')
        else if (merged.status) setStatus('active')
        const d = new Date()
        setRefreshedAt(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
      }
    } catch {
      alert('Не вдалося оновити дані. Спробуйте ще раз.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleCancel = async () => {
    if (!hash || !window.confirm(t('os.cancel') + '?')) return
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

  // Перевірка вільних місць на тому самому рейсі перед відновленням неоплаченого замовлення
  const checkSeatsAndRestore = async () => {
    setRestorePhase('checking')
    try {
      const citiesRes: any = await getCities()
      const raw = citiesRes.cities || citiesRes || {}
      const list = Array.isArray(raw) ? raw : Object.values(raw)
      const fromCity: any = list.find((c: any) => c.uk === data?.from_city)
      const toCity: any = list.find((c: any) => c.uk === data?.to_city)
      const dep = String(data?.ftime || '').split(' ')[0] // dd.mm.yyyy
      const [dd, mm, yyyy] = dep.split('.')
      if (!fromCity || !toCity || !dd) { setRestorePhase('unavailable'); return }

      const res: any = await getRoutes(String(fromCity.id), String(toCity.id), `${dd}-${mm}-${yyyy}`)
      const routes = res.routes || []
      const match = routes.find((t: any) => t?.departure?.[0]?.time === data?.ftime) || routes[0]

      if (match && Number(match.free) > 0) {
        setMatchedTrip(match)
        setRestorePhase('available')
      } else {
        setRestorePhase('unavailable')
      }
    } catch {
      setRestorePhase('unavailable')
    }
  }

  const finalizeRestore = async () => {
    if (!hash) return
    setLoading(true)
    try {
      await restoreOrder(hash)
      setStatus('active')
      setRestorePhase('idle')
    } catch { alert('Помилка') }
    finally { setLoading(false) }
  }

  // "Обрати інший день" — на головну з уже заповненими містами маршруту
  const pickAnotherDay = async () => {
    try {
      const citiesRes: any = await getCities()
      const raw = citiesRes.cities || citiesRes || {}
      const list = Array.isArray(raw) ? raw : Object.values(raw)
      const fromCity: any = list.find((c: any) => c.uk === data?.from_city)
      const toCity: any = list.find((c: any) => c.uk === data?.to_city)
      if (fromCity) setFrom({ id: String(fromCity.id), name: fromCity.uk, country: fromCity.i2, i2: fromCity.i2 })
      if (toCity) setTo({ id: String(toCity.id), name: toCity.uk, country: toCity.i2, i2: toCity.i2 })
    } catch { /* якщо не вдалось підтягнути - просто відкриється порожній пошук */ }
    nav('/')
  }

  if (!priceReady) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #EEE', borderTopColor: ORange, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
        {/* Status icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: status === 'active' ? '#E8F5E9' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {status === 'active' ? '✅' : '✔️'}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{t('os.done')}</div>
          <div style={{ color: ORange, fontWeight: 800, fontSize: 20, marginBottom: status === 'cancelled' ? 6 : 0 }}>order #{displayOrder}</div>
          {status === 'cancelled' && <div style={{ color: '#E53935', fontWeight: 700, fontSize: 15 }}>Скасовано</div>}
        </div>

        <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 auto 16px', padding: '8px 16px', background: '#F5F5F5', border: 'none', borderRadius: 20, color: '#555', fontWeight: 600, fontSize: 13, cursor: refreshing ? 'default' : 'pointer' }}>
          <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s' }}>↻</span>
          {refreshing ? t('os.refresh') + '…' : t('os.refresh')}
          {refreshedAt && !refreshing && <span style={{ color: Gray, fontWeight: 400 }}>· {refreshedAt}</span>}
        </button>

        {(() => {
          const st = statusLabel(data); const pi = payInfo(data)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '5px 14px', borderRadius: 20, background: st.bg, color: st.color }}>{st.text}</span>
              {pi.ticketReady && pi.remainder > 0 && <span style={{ fontSize: 13, color: '#E07B00', fontWeight: 600 }}>Доплата: {format(pi.remainder, currencyCode)}</span>}
            </div>
          )
        })()}

        {/* Trip card */}
        {isRoundTrip && <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.outbound')}</div>}
        <div style={{ border: '1.5px solid #EEE', borderRadius: 16, padding: 16, marginBottom: isRoundTrip ? 12 : 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 10 }}>
            <span>{depDT.date} → {arrDT.date}</span>
            {duration && <span>⏱ {duration}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{depDT.time}</div>
              <div style={{ fontSize: 13 }}>{data?.from_city || dep?.city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{data?.fstation || dep?.name}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16 }}>{hasTransfer ? '🚌→🔄' : '🚌'}</span>
              {hasTransfer && transferStop && <span style={{ fontSize: 10, color: Gray }}>{transferStop.city_ua || transferStop.city}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{arrDT.time}</div>
              <div style={{ fontSize: 13 }}>{data?.to_city || arr?.city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{data?.tstation || arr?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px dashed #EEE', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: Gray }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{format(price, currencyCode)}</span>
          </div>
        </div>

        {isRoundTrip && trip2 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.return')}</div>
            <div style={{ border: '1.5px solid #EEE', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 10 }}>
                <span>{splitDateTime(dep2?.time).date} → {splitDateTime(arr2?.time).date}</span>
                <span>⏱ {calcDuration(dep2?.time, arr2?.time)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{splitDateTime(dep2?.time).time}</div>
                  <div style={{ fontSize: 13 }}>{dep2?.city_ua || dep2?.city}</div>
                  <div style={{ fontSize: 11, color: Gray }}>{dep2?.name}</div>
                </div>
                <span style={{ fontSize: 16 }}>🚌</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{splitDateTime(arr2?.time).time}</div>
                  <div style={{ fontSize: 13 }}>{arr2?.city_ua || arr2?.city}</div>
                  <div style={{ fontSize: 11, color: Gray }}>{arr2?.name}</div>
                </div>
              </div>
            </div>
          </>
        )}
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
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{format(passengers.length === 1 ? price : (p.price ?? price), currencyCode)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('os.toPay')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18 }}>
            <span>{t('os.total')}</span>
            <span>{format(summ, currencyCode)}</span>
          </div>
        </div>

        {/* Бонуси Cashback Club — списати на це замовлення (до 10% від вартості, перевіряє бекенд) */}
        {status === 'active' && !payInfo(data).fullyPaid && cabBonus != null && cabBonus > 0 && (
          <div style={{ background: '#FFF9EF', borderRadius: 14, padding: 14, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Списати бонуси</div>
            <div style={{ fontSize: 12, color: Gray, marginBottom: 10 }}>Доступно: {format(cabBonus, currencyCode)} (максимум 10% від вартості замовлення)</div>
            {bonusApplied ? (
              <div style={{ color: '#2E7D32', fontWeight: 700, fontSize: 13 }}>Бонуси списано ✓</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={bonusInput} onChange={e => setBonusInput(e.target.value)} type="number" min={0} max={cabBonus}
                    placeholder="Сума" style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #EEE', borderRadius: 10, fontSize: 14 }} />
                  <button onClick={applyBonus} disabled={bonusApplying || !bonusInput} style={{ padding: '0 18px', background: ORange, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: bonusApplying ? 0.7 : 1 }}>
                    {bonusApplying ? '...' : 'Списати'}
                  </button>
                </div>
                {bonusError && <div style={{ color: '#E53935', fontSize: 12, marginTop: 8 }}>{bonusError}</div>}
              </>
            )}
          </div>
        )}

        {status === 'active' ? (
          <>
            {ticketAvailable(data, hash) ? (
              <button onClick={() => nav('/ticket')} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                {t('os.showTicket')}
              </button>
            ) : (
              <button onClick={() => nav('/payment')} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                {t('os.goToPayment')}
              </button>
            )}
            <button onClick={handleCancel} disabled={loading} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: Gray, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              {loading ? '...' : t('os.cancel')}
            </button>
          </>
        ) : payInfo(data).paid > 0 ? (
          // Скасовано, але була часткова/повна оплата — простий флоу без перевірки місць
          <button onClick={handleRestore} disabled={loading} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            {loading ? '...' : t('os.restore')}
          </button>
        ) : !canRestore(data) ? (
          // Неоплачене, скасоване, до рейсу лишилось <=24 год — відновлення закрите
          <div style={{ textAlign: 'center', color: Gray, fontSize: 14, padding: '10px 4px', lineHeight: 1.5 }}>
            {t('os.restoreUnavailable')}
          </div>
        ) : restorePhase === 'idle' ? (
          <button onClick={checkSeatsAndRestore} disabled={loading} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            {t('os.restore')}
          </button>
        ) : restorePhase === 'checking' ? (
          <div style={{ textAlign: 'center', color: Gray, fontSize: 14, padding: '16px 0' }}>{t('os.checkingSeats')}</div>
        ) : restorePhase === 'available' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, lineHeight: 1.4 }}>
              {t('os.seatsAvailable')}
            </div>
            <button onClick={() => setShowSeatMap(true)} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: chosenSeats.length ? 12 : 0 }}>
              {chosenSeats.length ? `${t('os.seatChosen')}: ${chosenSeats.join(', ')}` : t('os.chooseSeat')}
            </button>
            {chosenSeats.length > 0 && (
              <button onClick={finalizeRestore} disabled={loading} style={{ width: '100%', padding: 16, background: '#0B2E5E', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                {loading ? '...' : t('os.restore')}
              </button>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
              {t('os.noSeatsLeft')}
            </div>
            <div style={{ color: Gray, fontSize: 14, marginBottom: 10 }}>{t('os.chooseAnotherDay')}</div>
            <button onClick={pickAnotherDay} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              {t('os.choose')}
            </button>
          </div>
        )}
      </div>

      {showSeatMap && matchedTrip && (
        <SeatMap
          trip={matchedTrip}
          totalPax={Math.max((data?.passangers?.length as number) || 1, 1)}
          onClose={() => setShowSeatMap(false)}
          onConfirm={(seats: number[]) => { setChosenSeats(seats); setShowSeatMap(false) }}
        />
      )}
    </div>
  )
}
