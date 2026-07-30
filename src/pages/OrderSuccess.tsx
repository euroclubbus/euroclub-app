import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookingStore, useSearchStore } from '../store'
import { getCities, getRoutes } from '../api/euroclub'
import { ticketAvailable, statusLabel, payInfo, needsPolling, keepOurPrice, restoreEligibility, passengerDisplayPrices, formatSeat } from '../orderStatus'
import { useOrderRegistry } from '../orderRegistryRead'
import { useOrderPolling } from '../useOrderPolling'
import { useDisplayPrice } from '../currency'
import SeatMap from './SeatMap'
import { addBonusPayment, getUserOrders, findUserOrder, cancelOrderApi, restoreOrderApi } from '../api/auth'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// Місце для конкретного відрізка — бекенд дає "34/35" (туди/назад через слеш) для round-trip.
function legSeat(place: any, leg: 1 | 2): string {
  const s = String(place ?? '').trim()
  if (!s) return '—'
  if (s.includes('/')) return s.split('/')[leg - 1] || '—'
  return leg === 1 ? s : '—'
}

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
  const data = orderData as any
  const isRoundTrip = !!(data?.roundTrip || trip2)
  const dep2 = trip2?.departure?.[0]
  const arr2 = trip2?.arrival?.[0]
  // Дані зворотного рейсу для показу — надійні (data.ftime2/ttime2, захищені в keepOurPrice),
  // а не з trip2 (тимчасовий стан пошуку — губиться при перезаході/оновленні). Міста
  // зворотного рейсу — дзеркальні до основного (звідки прибули туди — звідти й назад).
  const ftime2Display = data?.ftime2 || dep2?.time
  const ttime2Display = data?.ttime2 || arr2?.time
  const fromCity2 = data?.to_city || dep2?.city_ua || dep2?.city
  const toCity2 = data?.from_city || arr2?.city_ua || arr2?.city
  // Prefer order data from order_new response (real, confirmed), fall back to selected trip for display before booking completes
  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const ftimeRaw = data?.departures?.[0]?.time || data?.ftime || dep?.time
  const ttimeRaw = data?.arrivals?.[0]?.time || data?.ttime || arr?.time
  const depDT = splitDateTime(ftimeRaw)
  const arrDT = splitDateTime(ttimeRaw)
  const duration = calcDuration(ftimeRaw, ttimeRaw)
  const hasTransfer = Number(trip?.transfer) === 1
  const transferStop = trip?.stopping?.find((s: any) => Number(s.transfer) === 1)

  const hash = orderHash || data?.hash || ''

  // Списання бонусів (Cashback Club) — тільки перегляд і дія тут, на сторінці замовлення
  const [cabBonus, setCabBonus] = useState<number | null>(null)
  const [bonusInput, setBonusInput] = useState('')
  const [bonusApplying, setBonusApplying] = useState(false)
  const [bonusError, setBonusError] = useState('')
  const [bonusApplied, setBonusApplied] = useState(false)
  const [wantsBonus, setWantsBonus] = useState(false)
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
  // Реєстр тут лишається ЛИШЕ для опису типу квитка (напр. "Діти 1-10 років") в списку
  // пасажирів — не для ціни й не для перевірки оплати, щоб не конфліктувати зі схемою нижче.
  const registry = useOrderRegistry(hash || data?.oid)

  // Узгоджена схема для round-trip (one-way завжди довіряє бекенду одразу, без умов):
  // 1) Перший показ цього екрана — наша повна сума, яку ми самі порахували при бронюванні
  //    (те, що вже лежить у data.summ одразу після створення — Booking.tsx кладе туди
  //    finalTotal). Фіксуємо це ОДНОРАЗОВО, стабільно — щоб наступні опитування, які вже
  //    можуть змінити data.summ, не "зсунули" цю початкову цифру заднім числом.
  // 2) Довіряти needpay_uah/needpay_eur з бекенду починаємо тільки коли ОБИДВІ умови
  //    виконались: минуло щонайменше 5с з моменту показу, І відбулось хоча б одне реальне
  //    опитування (не рахуючи початкового миттєвого).
  const [ourInitialTotal] = useState(() => price)
  const [mountedAt] = useState(() => Date.now())
  const [pollCount, setPollCount] = useState(0)
  const needpayValue = currencyCode === 'eur' ? data?.needpay_eur : data?.needpay_uah
  const trustBackend = !isRoundTrip || (pollCount >= 1 && Date.now() - mountedAt >= 5000)
  const summ = isRoundTrip
    ? (trustBackend && needpayValue != null ? Number(needpayValue) : ourInitialTotal)
    : price
  // Бекенд (справжня відповідь) віддає passengers[] (без "а") з полями name/dsc/prc/tck/plc —
  // а не passangers[]/place/price, як ми самі називаємо в локально побудованих об'єктах при
  // створенні (Booking.tsx). Раніше тут читалось лише data?.passangers (з друкарською
  // помилкою) — тому після фонового оновлення реальними даними пасажири зникали з екрану.
  const rawPax = data?.passengers?.length ? data.passengers : data?.passangers
  let passengers: any[] = (rawPax || []).map((p: any) => ({ name: p.name, place: p.plc ?? p.place, price: p.prc ?? p.price }))
  const split = passengerDisplayPrices(Number(summ) || 0, passengers)
  passengers = passengers.map((p, i) => ({ ...p, price: split[i] }))

  const [priceReady, setPriceReady] = useState(() => !needsPolling({ ...data, summ }))
  useEffect(() => {
    if (priceReady) return
    // Запобіжник: order_info може зависнути/не спрацювати (ще не перевірено з новим oid) —
    // якщо за 4с відповіді нема, все одно показуємо те, що вже маємо, а не крутимо спінер вічно.
    const timer = setTimeout(() => setPriceReady(true), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useOrderPolling(hash, needsPolling({ ...data, summ }), (o) => {
    setOrderResult(hash, keepOurPrice(data, o))
    setPriceReady(true)
    setPollCount(c => c + 1)
  })

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
      const res = await cancelOrderApi(hash)
      if (res.ok) setStatus('cancelled')
      else alert(res.error || 'Помилка')
    } catch { alert('Помилка') }
    finally { setLoading(false) }
  }

  const handleRestore = async () => {
    if (!hash) return
    setLoading(true)
    try {
      const res = await restoreOrderApi(hash)
      if (res.ok) setStatus('active')
      else alert(res.error || 'Помилка')
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
      const res = await restoreOrderApi(hash)
      if (res.ok) { setStatus('active'); setRestorePhase('idle') }
      else alert(res.error || 'Помилка')
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
          const st = statusLabel(data)
          // payInfo рахуємо з нашої (реєстрової для round-trip, живої для one-way) суми —
          // не з сирого data.summ, інакше доплата на двобічних порахується неправильно.
          const pi = payInfo({ ...data, summ })
          const latestSurcharge = registry?.surcharges?.length ? registry.surcharges[registry.surcharges.length - 1] : null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '5px 14px', borderRadius: 20, background: st.bg, color: st.color }}>{st.text}</span>
              {pi.ticketReady && pi.remainder > 0 && (
                <span style={{ fontSize: 13, color: '#E07B00', fontWeight: 600, textAlign: 'center' }}>
                  Доплата: {format(pi.remainder, currencyCode)}
                  {latestSurcharge && <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: Gray }}>Причина: {latestSurcharge.reason}</span>}
                </span>
              )}
            </div>
          )
        })()}

        {/* Пасажири: ім'я (тип) — ціна, стовпчиком, першими на екрані */}
        {passengers.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {passengers.map((p: any, i: number) => {
              const typeName = registry?.passengers?.find(rp => rp.index === i + 1)?.discountName || ''
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}{typeName && <span style={{ fontWeight: 400, color: Gray }}> ({typeName})</span>}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{format(p.price, currencyCode)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Trip card */}
        {isRoundTrip && <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.outbound')}</div>}
        <div style={{ border: '1.5px solid #EEE', borderRadius: 16, padding: 16, marginBottom: 8 }}>
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
            {!isRoundTrip && <span style={{ fontWeight: 800, fontSize: 17 }}>{format(summ, currencyCode)}</span>}
          </div>
        </div>
        {passengers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {passengers.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 3 }}>
                <span>{p.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>💺</span>{legSeat(p.place, 1)}</span>
              </div>
            ))}
          </div>
        )}

        {isRoundTrip && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.return')}</div>
            <div style={{ border: '1.5px solid #EEE', borderRadius: 16, padding: 16, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 10 }}>
                <span>{splitDateTime(ftime2Display).date} → {splitDateTime(ttime2Display).date}</span>
                <span>⏱ {calcDuration(ftime2Display, ttime2Display)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{splitDateTime(ftime2Display).time}</div>
                  <div style={{ fontSize: 13 }}>{fromCity2}</div>
                </div>
                <span style={{ fontSize: 16 }}>🚌</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{splitDateTime(ttime2Display).time}</div>
                  <div style={{ fontSize: 13 }}>{toCity2}</div>
                </div>
              </div>
            </div>
            {passengers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {passengers.map((p: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 3 }}>
                    <span>{p.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>💺</span>{legSeat(p.place, 2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Total */}
        <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t('os.toPay')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18 }}>
            <span>{t('os.total')}</span>
            <span>{format(summ, currencyCode)}</span>
          </div>
        </div>

        {status === 'active' ? (
          <>
            {ticketAvailable({ ...data, summ }, hash) ? (
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
        ) : payInfo({ ...data, summ }).paid > 0 ? (
          // Скасовано, але була часткова/повна оплата — простий флоу без перевірки місць
          <button onClick={handleRestore} disabled={loading} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            {loading ? '...' : t('os.restore')}
          </button>
        ) : restoreEligibility(data) === 'too_close' ? (
          // Неоплачене, скасоване, підтверджено <24 год до рейсу — відновлення закрите
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
          totalPax={Math.max(((data?.passengers?.length || data?.passangers?.length) as number) || 1, 1)}
          onClose={() => setShowSeatMap(false)}
          onConfirm={(seats: number[]) => { setChosenSeats(seats); setShowSeatMap(false) }}
        />
      )}
    </div>
  )
}
