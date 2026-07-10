import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Wifi, Zap, Bus, MessageCircle, AlertTriangle } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { getRoutes } from '../api/euroclub'
import { findTwoWayPrice } from '../priceEngine'
import { useDisplayPrice } from '../currency'
import BottomSheet from '../components/BottomSheet'
import CurrencyToggle from '../components/CurrencyToggle'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

const MONTHS_SHORT = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру']
const MONTHS_FULL  = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня']
const DOW = ['нд','пн','вт','ср','чт','пт','сб']

function splitDateTime(str?: string): { date: string; time: string } {
  if (!str) return { date: '', time: '--:--' }
  const parts = str.trim().split(' ')
  return { date: parts[0] || '', time: parts[1] || '--:--' }
}

function fmtShortDate(ddmmyyyy: string) {
  if (!ddmmyyyy) return ''
  const [d, m, y] = ddmmyyyy.split('.')
  if (!d || !m || !y) return ddmmyyyy
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
  return `${DOW[dateObj.getDay()]} ${d} ${MONTHS_SHORT[Number(m)-1]}`
}

// ISO (YYYY-MM-DD) → "21 липня"
function fmtLongISO(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`
}

function fmtCurrency(c?: string) {
  if (!c) return '₴'
  const v = String(c).toLowerCase()
  if (v === 'uah') return '₴'
  if (v === 'eur') return '€'
  return c
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

// Чи є вільні місця (якщо API не віддав free — вважаємо, що є)
function hasSeat(trip: any): boolean {
  const f = Number(trip?.free)
  return isNaN(f) ? true : f > 0
}

// Сума за весь склад пасажирів зі знижками конкретного рейсу.
// Якщо категорії немає в trip.discounts — відкат на повний тариф (default).
function computeGroupPrice(trip: any, cats: string[]) {
  const opts: any[] = trip?.discounts || []
  const def = opts.find(d => d.default === 1 || d.default === '1') || opts[0]
  const fullPrice = Number(def?.price ?? trip?.price ?? 0)
  const list = cats.length ? cats : ['__one__']
  let total = 0, original = 0, anyFallback = false
  for (const catId of list) {
    original += fullPrice
    const opt = opts.find(d => String(d.id) === String(catId))
    if (opt) {
      total += Number(opt.price ?? fullPrice)
    } else {
      total += fullPrice
      if (catId !== '__one__') anyFallback = true
    }
  }
  return { total, original, anyFallback, discounted: total < original }
}

// ─── Trip Card ─────────────────────────────────────────────────────────────
function TripCard({ trip, cats, onBook, roundTripPrice, hidePrice, bookLabel }: { trip: any; cats: string[]; onBook: () => void; roundTripPrice?: number | null; hidePrice?: boolean; bookLabel: string }) {
  const dep = trip.departure?.[0]
  const arr = trip.arrival?.[0]
  const depDT = splitDateTime(dep?.time)
  const arrDT = splitDateTime(arr?.time)
  const hasTransfer = Number(trip.transfer) === 1
  const transferStop = trip.stopping?.find((s: any) => Number(s.transfer) === 1)
  const { format } = useDisplayPrice()
  const freeSeats = Number(trip.free)
  const duration = calcDuration(dep?.time, arr?.time)
  const depCity = dep?.city_ua || dep?.city || ''
  const arrCity = arr?.city_ua || arr?.city || ''
  const { total, original, discounted, anyFallback } = computeGroupPrice(trip, cats)
  const displayTotal = roundTripPrice ?? total

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
          {fmtShortDate(depDT.date)} → {fmtShortDate(arrDT.date)}
        </span>
        {duration && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: Gray }}>
          <Clock size={13} />В дорозі {duration}
        </span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{depDT.time}</div>
          <div style={{ fontSize: 13, color: '#333', fontWeight: 600, marginTop: 2 }}>{depCity}</div>
          <div style={{ fontSize: 11, color: ORange, lineHeight: 1.3, marginTop: 2, textDecoration: 'underline' }}>{dep?.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 4, paddingTop: 4, minWidth: 56 }}>
          {hasTransfer && transferStop && <span style={{ fontSize: 10, color: Gray, whiteSpace: 'nowrap' }}>{transferStop.city_ua || transferStop.city}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 56 }}>
            <div style={{ flex: 1, height: 1, borderTop: '2px dashed #DDD' }} />
            {hasTransfer
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}><Bus size={14} color={Gray} /><AlertTriangle size={11} color={ORange} /></span>
              : <Bus size={16} color={Gray} />}
            <div style={{ flex: 1, height: 1, borderTop: '2px dashed #DDD' }} />
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{arrDT.time}</div>
          <div style={{ fontSize: 13, color: '#333', fontWeight: 600, marginTop: 2 }}>{arrCity}</div>
          <div style={{ fontSize: 11, color: Gray, lineHeight: 1.3, marginTop: 2 }}>{arr?.name}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #F5F5F5', gap: 8, flexWrap: 'wrap' }}>
        {trip.option?.includes('WiFi') && <Wifi size={15} color={Gray} />}
        {trip.option?.includes('USB розетки') && <Zap size={15} color={Gray} />}
        <Bus size={15} color={hasTransfer ? ORange : Gray} />
        <span style={{ fontSize: 12, color: hasTransfer ? ORange : Gray, fontWeight: hasTransfer ? 700 : 400 }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</span>
        {freeSeats > 0 && freeSeats <= 5 && (
          <span style={{ fontSize: 11, color: '#E53935', fontWeight: 600 }}>Залишилось {freeSeats} місць</span>
        )}
      </div>

      {/* Ціна — окремий блок знизу, тумблер валют поруч з ціною */}
      <div style={{ marginTop: 12, padding: '12px 14px', background: '#FAFAFA', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {hidePrice ? (
          <div style={{ fontSize: 12, color: Gray }}>Ціна вже врахована у загальній вартості</div>
        ) : (
          <div>
            {discounted && !roundTripPrice && <div style={{ fontSize: 12, color: Gray, textDecoration: 'line-through' }}>{format(original, trip.currency)}</div>}
            <div style={{ fontSize: 21, fontWeight: 800 }}>{format(displayTotal, trip.currency)}</div>
            {roundTripPrice != null && <div style={{ fontSize: 11, color: ORange, fontWeight: 700 }}>за квиток у два боки</div>}
          </div>
        )}
        <CurrencyToggle />
      </div>

      {anyFallback && (
        <div style={{ marginTop: 8, fontSize: 11, color: ORange, display: 'flex', alignItems: 'center', gap: 5 }}>
          <AlertTriangle size={12} /> На цьому рейсі частина знижок не діє — тариф повний
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button onClick={onBook} style={{ width: '100%', padding: '12px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {bookLabel}
        </button>
      </div>
    </div>
  )
}

function DateStrip({ dates, activeDate, onPick, onPrev, onNext }: {
  dates: string[]; activeDate: string; onPick: (d: string) => void; onPrev: () => void; onNext: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <button onClick={onPrev} aria-label="Раніше" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 20, padding: '0 6px', flexShrink: 0 }}>‹</button>
      <div style={{ display: 'flex', flex: 1 }}>
        {dates.map(iso => {
          const d = new Date(iso)
          const isActive = iso === activeDate
          const label = isActive ? `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}` : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
          return (
            <button key={iso} onClick={() => onPick(iso)} style={{
              flex: 1, minWidth: 0, padding: '8px 2px', background: 'none', border: 'none',
              borderBottom: isActive ? `3px solid ${ORange}` : '3px solid transparent',
              cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, color: isActive ? ORange : 'rgba(255,255,255,0.8)', fontWeight: isActive ? 800 : 500, whiteSpace: 'nowrap' }}>
                {label}
              </div>
            </button>
          )
        })}
      </div>
      <button onClick={onNext} aria-label="Пізніше" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 20, padding: '0 6px', flexShrink: 0 }}>›</button>
    </div>
  )
}

// Пошук найближчої дати з вільними місцями (вперед до 14 днів)
async function findNearestAvailable(fromId: string, toId: string, startISO: string) {
  for (let i = 1; i <= 14; i++) {
    const d = new Date(startISO); d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const [y, m, dd] = iso.split('-')
    try {
      const data: any = await getRoutes(fromId, toId, `${dd}-${m}-${y}`)
      const code = String(data.error ?? '0')
      if (code === '102' || code === '103') return null // маршруту немає взагалі
      const rts = data.routes || []
      if (rts.filter(hasSeat).length > 0) return { date: iso, trips: rts }
    } catch { /* пропускаємо день */ }
  }
  return null
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function Results() {
  const nav = useNavigate()
  const { from, to, dateFrom, dateTo, isOpenReturn, passengerCategories } = useSearchStore()
  const { setTrip, setTrip2, selectedTrip } = useBookingStore()
  const { format } = useDisplayPrice()
  // Двобічне замовлення: 'out' — рейс туди, 'return' — рейс назад (route2).
  // Вмикається якщо на Home обрана дата повернення або відмічена "Відкрита дата".
  const isRoundTrip = !!dateTo || isOpenReturn
  const [leg, setLeg] = useState<'out' | 'return'>('out')
  const legFrom = leg === 'out' ? from : to
  const legTo = leg === 'out' ? to : from
  // Для відкритої дати повернення точної дати нема — стартуємо з +7 днів від виїзду як орієнтир,
  // користувач все одно може гортати стрічку дат (route2 підбирається так само з реального пошуку).
  const legDefaultDate = leg === 'out'
    ? (dateFrom || new Date().toISOString().split('T')[0])
    : (dateTo || (() => { const d = new Date(dateFrom || new Date()); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })())
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noRoute, setNoRoute] = useState(false)
  const [stripStart, setStripStart] = useState(0)
  const [nearest, setNearest] = useState<{ date: string; trips: any[] } | null>(null)
  const [searchingNearest, setSearchingNearest] = useState(false)

  const allDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(legDefaultDate)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const visibleDates = allDates.slice(stripStart, stripStart + 5)
  const [activeDate, setActiveDate] = useState(legDefaultDate)

  // Перемикання на етап "назад" — скидаємо стрічку дат на новий діапазон
  useEffect(() => {
    setActiveDate(legDefaultDate)
    setStripStart(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leg])

  // Напрямок для підбору шаблону ціни: відправлення з України -> UAH, з Європи -> EUR
  const direction: 'ua' | 'eu' = from?.i2 === 'ua' ? 'ua' : 'eu'
  // На кроці "назад" ціна вже зафіксована рейсом "туди" — рахуємо один раз і показуємо як банер
  const lockedTwoWay = (leg === 'return' && selectedTrip && from && to)
    ? findTwoWayPrice(from.id, to.id, direction, computeGroupPrice(selectedTrip, passengerCategories).total)
    : null

  const handlePrev = () => { if (stripStart > 0) setStripStart(s => s - 1) }
  const handleNext = () => { if (stripStart + 5 < allDates.length) setStripStart(s => s + 1) }

  useEffect(() => {
    if (!legFrom || !legTo || !activeDate) return
    let cancelled = false
    setLoading(true); setError(''); setNoRoute(false); setNearest(null); setSearchingNearest(false)
    const [y, m, d] = activeDate.split('-')
    getRoutes(legFrom.id, legTo.id, `${d}-${m}-${y}`)
      .then(async (data: any) => {
        if (cancelled) return
        const code = String(data.error ?? '0')
        if (code === '102' || code === '103') { setNoRoute(true); setTrips([]); setLoading(false); return }
        const rts = data.routes || []
        setTrips(rts); setLoading(false)
        if (rts.filter(hasSeat).length === 0) {
          setSearchingNearest(true)
          const res = await findNearestAvailable(legFrom.id, legTo.id, activeDate)
          if (!cancelled) { setNearest(res); setSearchingNearest(false) }
        }
      })
      .catch(() => { if (!cancelled) { setError('Не вдалося завантажити рейси. Перевірте з\'єднання.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [legFrom, legTo, activeDate])

  const availableTrips = trips.filter(hasSeat)
  const noneAvailable = !loading && !error && !noRoute && availableTrips.length === 0

  const goToNearest = () => {
    if (!nearest) return
    // якщо дата поза видимим вікном — зсуваємо стрічку до неї
    const idx = allDates.indexOf(nearest.date)
    if (idx >= 0) setStripStart(Math.min(idx, Math.max(0, allDates.length - 5)))
    setActiveDate(nearest.date)
  }

  // Вибір рейсу: якщо замовлення в два боки і ми ще на етапі "туди" — переходимо до пошуку "назад".
  // Коли обрано і "назад" — на сторінку підсумку з обома рейсами (звідти вже в бронювання).
  // Один напрямок (без round trip) — одразу в бронювання.
  const selectTrip = (trip: any) => {
    if (leg === 'out') {
      setTrip(trip)
      if (isRoundTrip) { setLeg('return'); return }
      nav('/booking')
    } else {
      setTrip2(trip)
      nav('/round-trip-summary')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 20 }}>
      {/* Header — розмита hero */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button onClick={() => leg === 'return' ? setLeg('out') : nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <ArrowLeft size={24} color="#fff" />
            </button>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, flex: 1 }}>
              Знайдені маршрути{isRoundTrip && (leg === 'out' ? ' · Туди' : ' · Назад')}
            </span>
          </div>
          {isRoundTrip && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: leg === 'out' ? ORange : 'rgba(255,255,255,0.15)', color: '#fff' }}>1. Туди</span>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: leg === 'return' ? ORange : 'rgba(255,255,255,0.15)', color: '#fff' }}>2. Назад</span>
              </div>
              <div style={{ textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: lockedTwoWay ? 4 : 10 }}>
                {leg === 'out' ? 'Оберіть першу поїздку' : 'Оберіть другу поїздку'}
              </div>
              {leg === 'return' && lockedTwoWay && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 10 }}>
                  Загальна ціна за квиток у два боки: <strong style={{ color: '#fff' }}>{format(lockedTwoWay.price, (selectedTrip as any)?.currency)}</strong>
                </div>
              )}
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, color: '#fff' }}>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{legFrom?.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #fff', flexShrink: 0 }} />
              <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.6)' }} />
              <Bus size={18} color="#fff" />
              <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.6)' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #fff', flexShrink: 0 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{legTo?.name}</span>
          </div>
          <DateStrip
            dates={visibleDates}
            activeDate={activeDate}
            onPick={setActiveDate}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '16px 16px 0', minHeight: 'calc(100vh - 200px)' }}>
        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Завантаження...</div>}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
            <div style={{ color: '#E53935', fontSize: 15, marginBottom: 16 }}>{error}</div>
            <button onClick={() => setActiveDate(d => d)} style={{ padding: '10px 24px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Спробувати ще раз
            </button>
          </div>
        )}

        {/* Маршруту взагалі немає */}
        {!loading && !error && noRoute && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚌</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Цей маршрут наразі недоступний</div>
            <div style={{ fontSize: 14, color: Gray, marginBottom: 24, lineHeight: 1.5 }}>
              На жаль, рейси за маршрутом <strong>{legFrom?.name} → {legTo?.name}</strong> наразі не виконуються. Спробуйте змінити міста.
            </div>
            <div style={{ background: '#F9F9F9', borderRadius: 16, padding: 20, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Потрібна допомога?</div>
              <div style={{ fontSize: 13, color: Gray, marginBottom: 16, lineHeight: 1.5 }}>Менеджер підбере оптимальний маршрут або повідомить, коли рейс з'явиться.</div>
              <button style={{ width: '100%', padding: '14px 0', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <MessageCircle size={18} /> Розпочати чат
              </button>
            </div>
            <button onClick={() => nav(-1)} style={{ marginTop: 16, padding: '12px 24px', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ← Змінити маршрут
            </button>
          </div>
        )}

        {/* Немає вільних місць/рейсів на дату → пропонуємо найближчий доступний */}
        {noneAvailable && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗓</div>
            <div style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              На {fmtLongISO(activeDate)} {trips.length > 0 ? 'вільних місць немає' : 'рейсів немає'}
            </div>
            {searchingNearest && (
              <div style={{ color: Gray, fontSize: 14, padding: '12px 0' }}>Шукаємо найближчий доступний рейс…</div>
            )}
            {!searchingNearest && nearest && (
              <>
                <div style={{ color: Gray, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                  Найближчий доступний рейс — <strong style={{ color: '#1A1A1A' }}>{fmtLongISO(nearest.date)}</strong>
                </div>
                <button onClick={goToNearest} style={{ width: '100%', padding: '14px 0', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Показати рейси на {fmtLongISO(nearest.date)} →
                </button>
              </>
            )}
            {!searchingNearest && !nearest && (
              <div style={{ color: Gray, fontSize: 14, lineHeight: 1.5 }}>
                Найближчими днями рейсів із вільними місцями теж немає. Спробуйте інші дати або зверніться до менеджера.
              </div>
            )}
          </div>
        )}

        {availableTrips.map((trip, i) => {
          const cardTwoWay = (isRoundTrip && leg === 'out' && from && to)
            ? findTwoWayPrice(from.id, to.id, direction, computeGroupPrice(trip, passengerCategories).total)?.price ?? null
            : null
          const bookLabel = isRoundTrip ? (leg === 'out' ? 'Обрати рейс 1' : 'Обрати рейс 2') : 'Бронювання'
          return (
            <TripCard key={trip.id || i} trip={trip} cats={passengerCategories}
              onBook={() => selectTrip(trip)}
              roundTripPrice={leg === 'out' ? cardTwoWay : null}
              hidePrice={leg === 'return'}
              bookLabel={bookLabel}
            />
          )
        })}
      </div>
    </div>
  )
}
