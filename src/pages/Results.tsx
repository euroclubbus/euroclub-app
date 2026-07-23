import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Wifi, Zap, Bus, MessageCircle, AlertTriangle, Menu } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { getRoutes } from '../api/euroclub'
import { findTwoWayGroupPrice } from '../priceEngine'
import { perPassengerOneWayPrices, fullFareOneWayPrice } from '../passengerPricing'
import { useDisplayPrice } from '../currency'
import CurrencyToggle from '../components/CurrencyToggle'
import SideMenu from '../components/SideMenu'
import { useT } from '../i18n'

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

// ─── Trip Card (превью рейсу — кнопка бронювання опційна, для комбінованого
// підсумку в два боки кнопки на окремих картках нема, тільки одна спільна нижче) ───
function TripCard({ trip, cats, onBook, roundTripPrice, hidePrice, bookLabel, hideBookButton }: {
  trip: any; cats: string[]; onBook?: () => void; roundTripPrice?: number | null; hidePrice?: boolean; bookLabel?: string; hideBookButton?: boolean
}) {
  const t = useT()
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
        <span style={{ fontSize: 12, color: hasTransfer ? ORange : Gray, fontWeight: hasTransfer ? 700 : 400 }}>{hasTransfer ? t('results.transfer') : t('results.direct')}</span>
        {freeSeats > 0 && freeSeats <= 5 && (
          <span style={{ fontSize: 11, color: '#E53935', fontWeight: 600 }}>{t('results.seatsLeft', { n: freeSeats })}</span>
        )}
      </div>

      {!hideBookButton && (
        <>
          {/* Ціна — окремий блок знизу, тумблер валют поруч з ціною */}
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#FAFAFA', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {hidePrice ? (
              <div style={{ fontSize: 12, color: Gray }}>{t('results.priceIncluded')}</div>
            ) : (
              <div>
                {discounted && !roundTripPrice && <div style={{ fontSize: 12, color: Gray, textDecoration: 'line-through' }}>{format(original, trip.currency)}</div>}
                <div style={{ fontSize: 21, fontWeight: 800 }}>{format(displayTotal, trip.currency)}</div>
                {roundTripPrice != null && <div style={{ fontSize: 11, color: ORange, fontWeight: 700 }}>{t('results.roundTripLabel')}</div>}
              </div>
            )}
            <CurrencyToggle />
          </div>

          {anyFallback && (
            <div style={{ marginTop: 8, fontSize: 11, color: ORange, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={12} /> {t('results.fallbackWarning')}
            </div>
          )}

          {onBook && (
            <div style={{ marginTop: 14 }}>
              <button onClick={onBook} style={{ width: '100%', padding: '12px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {bookLabel}
              </button>
            </div>
          )}
        </>
      )}
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

// ─── Пошук на один відрізок (туди АБО назад) ────────────────────────────────
// Автоматично шукає рейси на обрану дату; якщо на неї нема — шукає найближчу
// доступну і чекає explicit-погодження (agreed) перед тим, як вважати відрізок
// "готовим до бронювання".
interface LegState {
  loading: boolean
  error: string
  noRoute: boolean
  trips: any[]
  nearest: { date: string; trips: any[] } | null
  searchingNearest: boolean
  agreed: boolean
}
const LEG_INITIAL: LegState = { loading: true, error: '', noRoute: false, trips: [], nearest: null, searchingNearest: false, agreed: false }

function useLegSearch(fromId: string | undefined, toId: string | undefined, dateISO: string | undefined, active: boolean) {
  const [state, setState] = useState<LegState>(LEG_INITIAL)
  useEffect(() => {
    if (!active || !fromId || !toId || !dateISO) { setState(s => ({ ...s, loading: false })); return }
    let cancelled = false
    setState({ ...LEG_INITIAL })
    const [y, m, d] = dateISO.split('-')
    getRoutes(fromId, toId, `${d}-${m}-${y}`)
      .then(async (data: any) => {
        if (cancelled) return
        const code = String(data.error ?? '0')
        if (code === '102' || code === '103') { setState(s => ({ ...s, noRoute: true, loading: false })); return }
        const rts = data.routes || []
        setState(s => ({ ...s, trips: rts, loading: false }))
        if (rts.filter(hasSeat).length === 0) {
          setState(s => ({ ...s, searchingNearest: true }))
          const res = await findNearestAvailable(fromId, toId, dateISO)
          if (!cancelled) setState(s => ({ ...s, nearest: res, searchingNearest: false }))
        }
      })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, error: 'Не вдалося завантажити рейси. Перевірте з\'єднання.', loading: false })) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fromId, toId, dateISO])
  const setAgreed = (v: boolean) => setState(s => ({ ...s, agreed: v }))
  return { ...state, setAgreed }
}

function legResolvedTrip(leg: LegState): any | null {
  const onRequested = leg.trips.filter(hasSeat)
  if (onRequested.length > 0) return onRequested[0]
  if (leg.agreed && leg.nearest) return leg.nearest.trips.filter(hasSeat)[0] || null
  return null
}
function legBlocked(leg: LegState): boolean {
  return !leg.loading && (leg.noRoute || (leg.trips.filter(hasSeat).length === 0 && !leg.searchingNearest && !leg.nearest))
}
function legNeedsConfirm(leg: LegState): boolean {
  return !leg.loading && leg.trips.filter(hasSeat).length === 0 && !leg.noRoute && !!leg.nearest && !leg.agreed
}

type LegSearchResult = LegState & { setAgreed: (v: boolean) => void }

// Блок "на цю дату немає рейсу, пропонуємо найближчу" — чекбокс явного погодження.
function DateFallbackCard({ label, requestedISO, leg, onPickDate }: { label: string; requestedISO: string; leg: LegSearchResult; onPickDate: (iso: string) => void }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
        На дату {label.toLowerCase()} — <strong>{fmtLongISO(requestedISO)}</strong> — рейсу немає
      </div>
      <div style={{ fontSize: 14, color: Gray, marginBottom: 14, lineHeight: 1.5 }}>
        Пропонуємо найближчу доступну дату — <strong style={{ color: '#1A1A1A' }}>{fmtLongISO(leg.nearest!.date)}</strong>
      </div>
      <button onClick={() => leg.setAgreed(!leg.agreed)} style={{
        width: '100%', padding: '12px 16px',
        background: leg.agreed ? '#FFF3DC' : '#F9F9F9',
        border: leg.agreed ? `1.5px solid ${ORange}` : '1px solid #EEE',
        borderRadius: 14, display: 'flex', gap: 12, alignItems: 'center',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `2px solid ${leg.agreed ? ORange : '#DDD'}`,
          background: leg.agreed ? ORange : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {leg.agreed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: leg.agreed ? ORange : '#555' }}>
          Погодитись з іншою датою ({fmtLongISO(leg.nearest!.date)})
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, borderTop: '1px solid #EEE' }} />
        <span style={{ fontSize: 12, color: Gray }}>або</span>
        <div style={{ flex: 1, borderTop: '1px solid #EEE' }} />
      </div>
      <label style={{ display: 'block', marginTop: 12, position: 'relative' }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Обрати іншу дату в календарі</span>
        <input
          type="date"
          defaultValue=""
          min={new Date().toISOString().split('T')[0]}
          onChange={e => e.target.value && onPickDate(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #EEE', borderRadius: 14, fontSize: 14, color: '#1A1A1A' }}
        />
      </label>
    </div>
  )
}

// Блок повної відсутності маршруту/рейсів найближчим часом — заблоковано, продовжити не можна.
function BlockedLegCard({ label, cities, leg, requestedISO, onBack }: { label: string; cities: string; leg: LegState; requestedISO: string; onBack: () => void }) {
  const t = useT()
  if (leg.noRoute) {
    return (
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚌</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>Цей маршрут наразі недоступний</div>
        <div style={{ fontSize: 14, color: Gray, marginBottom: 24, lineHeight: 1.5 }}>
          {t('results.noRoute')} <strong>{cities}</strong> {t('results.noRouteEnd')} ({label.toLowerCase()})
        </div>
        <div style={{ background: '#F9F9F9', borderRadius: 16, padding: 20, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Потрібна допомога?</div>
          <div style={{ fontSize: 13, color: Gray, marginBottom: 16, lineHeight: 1.5 }}>Менеджер підбере оптимальний маршрут або повідомить, коли рейс з'явиться.</div>
          <button style={{ width: '100%', padding: '14px 0', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MessageCircle size={18} /> Розпочати чат
          </button>
        </div>
        <button onClick={onBack} style={{ marginTop: 16, padding: '12px 24px', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          ← Змінити маршрут
        </button>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginBottom: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🗓</div>
      <div style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
        На {fmtLongISO(requestedISO)} {label.toLowerCase()} — рейсів немає
      </div>
      {leg.searchingNearest && (
        <div style={{ color: Gray, fontSize: 14, padding: '12px 0' }}>Шукаємо найближчий доступний рейс…</div>
      )}
      {!leg.searchingNearest && (
        <div style={{ color: Gray, fontSize: 14, lineHeight: 1.5 }}>
          Найближчими днями рейсів із вільними місцями теж немає. Спробуйте інші дати або зверніться до менеджера.
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
// Компактна стрічка дат над результатами — 7 днів навколо обраної, тап міняє дату
// виїзду й автоматично перезапускає пошук (через залежність useLegSearch від dateFrom).
const DOW_SHORT = ['нд','пн','вт','ср','чт','пт','сб']
function DateStrip({ dateISO, onChange }: { dateISO: string; onChange: (iso: string) => void }) {
  if (!dateISO) return null
  const center = new Date(dateISO)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(center); d.setDate(d.getDate() + i - 3); return d })
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px', background: '#fff' }}>
      {days.map(d => {
        const iso = d.toISOString().split('T')[0]
        const isPast = d < new Date(new Date().toDateString())
        const isSel = iso === dateISO
        return (
          <button key={iso} onClick={() => !isPast && onChange(iso)} disabled={isPast} style={{
            flexShrink: 0, minWidth: 46, padding: '6px 4px', borderRadius: 12, border: 'none',
            background: isSel ? ORange : '#F5F5F5', color: isSel ? '#fff' : isPast ? '#CCC' : '#333',
            cursor: isPast ? 'default' : 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, opacity: 0.85 }}>{DOW_SHORT[d.getDay()]}</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{d.getDate()}</div>
          </button>
        )
      })}
    </div>
  )
}

export default function Results() {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { from, to, dateFrom, dateTo, isOpenReturn, passengerCategories, setDateFrom, setDateTo, setOpenReturn } = useSearchStore()
  const { setTrip, setTrip2 } = useBookingStore()

  const isRoundTrip = !!dateTo || isOpenReturn
  // Для відкритої дати повернення точної дати нема — беремо +7 днів від виїзду як орієнтир,
  // далі так само підбираємо найближчу доступну, якщо на цю дату нічого нема.
  const returnDateISO = isRoundTrip
    ? (dateTo || (() => { const d = new Date(dateFrom || new Date()); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })())
    : undefined

  const outLeg = useLegSearch(from?.id, to?.id, dateFrom, true)
  const retLeg = useLegSearch(to?.id, from?.id, returnDateISO, isRoundTrip)

  const outTrip = legResolvedTrip(outLeg)
  const retTrip = isRoundTrip ? legResolvedTrip(retLeg) : null

  const outBlocked = legBlocked(outLeg)
  const retBlocked = isRoundTrip && legBlocked(retLeg)
  const outNeedsConfirm = legNeedsConfirm(outLeg)
  const retNeedsConfirm = isRoundTrip && legNeedsConfirm(retLeg)

  const anyLoading = outLeg.loading || (isRoundTrip && retLeg.loading)
  const anyError = outLeg.error || retLeg.error
  const ready = !!outTrip && (!isRoundTrip || !!retTrip)

  // Напрямок для підбору шаблону ціни: відправлення з України -> UAH, з Європи -> EUR
  const direction: 'ua' | 'eu' = from?.i2 === 'ua' ? 'ua' : 'eu'
  const twoWay = (isRoundTrip && ready && from && to)
    ? findTwoWayGroupPrice(perPassengerOneWayPrices(outTrip, passengerCategories), fullFareOneWayPrice(outTrip), from.id, to.id, direction)
    : null

  const handleSelect = () => {
    if (!outTrip) return
    setTrip(outTrip)
    if (isRoundTrip) {
      if (!retTrip) return
      setTrip2(retTrip)
    }
    nav('/booking')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 20 }}>
      {/* Header — розмита hero */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <ArrowLeft size={24} color="#fff" />
            </button>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, flex: 1 }}>Результати пошуку</span>
            <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <Menu size={24} color="#fff" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff' }}>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{from?.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #fff', flexShrink: 0 }} />
              <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.6)' }} />
              <Bus size={18} color="#fff" />
              {isRoundTrip && <span style={{ fontSize: 11, opacity: 0.85 }}>⇄</span>}
              <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.6)' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #fff', flexShrink: 0 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{to?.name}</span>
          </div>
        </div>
      </div>

      <DateStrip dateISO={dateFrom} onChange={setDateFrom} />

      {/* Results */}
      <div style={{ padding: '16px 16px 0', minHeight: 'calc(100vh - 200px)' }}>
        {anyLoading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Підбираємо рейси…</div>}

        {!anyLoading && anyError && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
            <div style={{ color: '#E53935', fontSize: 15, marginBottom: 16 }}>{anyError}</div>
          </div>
        )}

        {!anyLoading && !anyError && (
          <>
            {outBlocked && (
              <BlockedLegCard label="Поїздка туди" cities={`${from?.name} → ${to?.name}`} leg={outLeg} requestedISO={dateFrom} onBack={() => nav(-1)} />
            )}
            {retBlocked && (
              <BlockedLegCard label="Зворотна поїздка" cities={`${to?.name} → ${from?.name}`} leg={retLeg} requestedISO={returnDateISO!} onBack={() => nav(-1)} />
            )}

            {!outBlocked && outNeedsConfirm && (
              <DateFallbackCard label="Поїздки туди" requestedISO={dateFrom} leg={outLeg} onPickDate={iso => setDateFrom(iso)} />
            )}
            {!retBlocked && retNeedsConfirm && (
              <DateFallbackCard label="Зворотної поїздки" requestedISO={returnDateISO!} leg={retLeg} onPickDate={iso => { setOpenReturn(false); setDateTo(iso) }} />
            )}

            {ready && outTrip && (
              <>
                <TripCard trip={outTrip} cats={passengerCategories} hideBookButton />
                {isRoundTrip && retTrip && <TripCard trip={retTrip} cats={passengerCategories} hideBookButton />}

                <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 14, color: Gray }}>{isRoundTrip ? 'Разом за поїздку в два боки' : 'Разом за поїздку'}</span>
                    <CurrencyToggle />
                  </div>
                  <TotalPrice trip={outTrip} twoWayTotal={twoWay?.total ?? null} cats={passengerCategories} />
                  {twoWay?.anyFallback && (
                    <div style={{ marginTop: 8, fontSize: 11, color: ORange, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={12} /> Точна ціна в два боки буде уточнена на кроці бронювання
                    </div>
                  )}
                  <button onClick={handleSelect} style={{ width: '100%', marginTop: 16, padding: '14px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    Обрати
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

function TotalPrice({ trip, twoWayTotal, cats }: { trip: any; twoWayTotal: number | null; cats: string[] }) {
  const { format } = useDisplayPrice()
  const { total } = computeGroupPrice(trip, cats)
  const shown = twoWayTotal ?? total
  return <div style={{ fontSize: 26, fontWeight: 800 }}>{format(shown, trip.currency)}</div>
}
