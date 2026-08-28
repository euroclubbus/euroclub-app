import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Wifi, Zap, Bus, MessageCircle, AlertTriangle, Menu, ChevronDown, ChevronUp } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { getRoutes } from '../api/euroclub'
import { findTwoWayGroupPrice } from '../priceEngine'
import { perPassengerOneWayPrices, fullFareOneWayPrice } from '../passengerPricing'
import { USE_NEW_PRICING, computeLegPricing, roundPrice, roundTripFixedDisplay, roundTripOpenDateDisplay, legPriceWithFixedCategory, roundTripGroupPrice, oneWayGroupPrice, getCoefficient, PassengerPriceDetail } from '../pricing'
import { useDisplayPrice } from '../currency'
import CurrencyToggle from '../components/CurrencyToggle'
import SideMenu from '../components/SideMenu'
import BottomSheet from '../components/BottomSheet'
import SimpleCalendar from '../components/SimpleCalendar'
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
// Кеп (27.08): "повний тариф" (fullPrice) тепер сам обчислюється за новим
// ціноутворенням (price_old/price_alt/price_dsc/price_mob_dsc, розділ 3-4 специфікації)
// замість сирого trip.price — категорійні знижки (trip.discounts) застосовуються поверх
// цього як і раніше, логіка group-суми не змінилась.
function computeGroupPrice(trip: any, cats: string[]) {
  const opts: any[] = trip?.discounts || []
  const def = opts.find(d => d.default === 1 || d.default === '1') || opts[0]
  const legPricing = USE_NEW_PRICING ? computeLegPricing(trip) : null
  const fullPrice = legPricing ? legPricing.актуальнаЦіна : Number(def?.price ?? trip?.price ?? 0)
  const list = cats.length ? cats : ['__one__']
  let total = 0, original = 0, anyFallback = false
  for (const catId of list) {
    original += fullPrice
    const opt = opts.find(d => String(d.id) === String(catId))
    if (opt) {
      // ЗАДАЧА 3 (27.08, Кеп): категорійна знижка рахується ВІД базовийТариф (не від
      // opt.price напряму — те поле бекенд рахує сам, не завжди узгоджено з price_alt).
      total += legPricing ? legPriceWithFixedCategory(trip, Number(opt.discount ?? 0)).price : Number(opt.price ?? fullPrice)
    } else {
      total += fullPrice
      if (catId !== '__one__') anyFallback = true
    }
  }
  // "Знижка рейсу/додатку" (price_dsc/price_mob_dsc) показується окремою міткою лише
  // якщо немає ВЖЕ активної категорійної знижки (щоб не показувати два одночасно) —
  // на екрані результатів категорія ще не обрана вручну, тому в звичайному випадку це
  // не конфліктує.
  const legDiscountPct = legPricing && !(total < original) ? legPricing.знижкаПроц : 0
  const legStrikePrice = legPricing && legPricing.базовийТариф > roundPrice(fullPrice) ? roundPrice(legPricing.базовийТариф) * list.length : 0
  return { total, original: legStrikePrice > 0 ? legStrikePrice : original, discounted: total < original || legStrikePrice > 0, anyFallback, legDiscountPct }
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
  const { total, original, discounted, anyFallback, legDiscountPct } = computeGroupPrice(trip, cats)
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
                {/* Кеп (26.08): roundTripPrice — сума ДВОХ ніг, уже нормалізована в UAH
                    (leg2 з Європи часто в EUR, leg1 з України — в UAH; formatUAH() конвертує
                    з UAH у вибрану валюту показу, не бере валюту ЦЬОГО leg-у, яка тут може
                    бути будь-якою). */}
                <div style={{ fontSize: 21, fontWeight: 800 }}>{roundTripPrice != null ? format(displayTotal, 'uah') : format(displayTotal, trip.currency)}</div>
                {/* Кеп (28.08): на рівні картки/підсумку НІКОЛИ не показуємо номінал — тільки фіксований напис (для всіх типів однаково). */}
                {legDiscountPct > 0 && !roundTripPrice && <div style={{ fontSize: 11, color: '#E53935', fontWeight: 700 }}>Діє знижка, кількість акційних квитків — обмежена</div>}
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

// ЗАДАЧА 1 (27.08, Кеп): пошук зворотного рейсу для round-trip з ВІДКРИТОЮ датою
// повернення. Діапазон +30..+60 днів від дати виїзду (той самий маршрут навпаки),
// послідовно по днях, перший рейс з вільними місцями І ціною > 0 — саме він і є
// "найближчий наступний" за специфікацією (розділ 5.3 PRICING_SPEC_V2).
// Правило Кепа: якщо в діапазоні +30..+60 нічого підходящого — зворотного рейсу немає
// (і це показуємо юзеру явно, не 0 і не мовчки).
async function findOpenDateReturnTripInRange(fromId: string, toId: string, departureISO: string) {
  for (let i = 30; i <= 60; i++) {
    const d = new Date(departureISO); d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const [y, m, dd] = iso.split('-')
    try {
      const data: any = await getRoutes(fromId, toId, `${dd}-${m}-${y}`)
      const code = String(data.error ?? '0')
      if (code === '102' || code === '103') continue // немає рейсів на цей день — пробуємо далі
      const rts = data.routes || []
      const withSeats = rts.filter(hasSeat)
      for (const trip of withSeats) {
        const priceCheck = Number(trip?.price_old ?? trip?.price ?? 0)
        if (priceCheck > 0) return trip // перший придатний — і є "найближчий"
      }
    } catch { /* пропускаємо день, пробуємо наступний */ }
  }
  return null // нічого не знайдено за 30-60 днів — зворотного рейсу немає
}

// Хук: той самий стан-машина патерн, що useLegSearch, спеціально для відкритої дати.
function useOpenReturnSearch(fromId: string | undefined, toId: string | undefined, departureISO: string | undefined, active: boolean) {
  const [state, setState] = useState<{ loading: boolean; trip: any | null; searched: boolean }>({ loading: false, trip: null, searched: false })
  useEffect(() => {
    if (!active || !fromId || !toId || !departureISO) { setState({ loading: false, trip: null, searched: false }); return }
    let cancelled = false
    setState({ loading: true, trip: null, searched: false })
    findOpenDateReturnTripInRange(fromId, toId, departureISO).then(trip => {
      if (!cancelled) setState({ loading: false, trip, searched: true })
    })
    return () => { cancelled = true }
  }, [active, fromId, toId, departureISO])
  return state
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
  const [showCalendar, setShowCalendar] = useState(false)
  const todayISO = new Date().toISOString().split('T')[0]
  // Далекий, але скінченний горизонт вибору — тут це "інша дата в межах розумного",
  // не прив'язано до якогось конкретного дедлайну як у фіксації відкритої дати.
  const maxISO = (() => { const d = new Date(); d.setDate(d.getDate() + 365); return d.toISOString().split('T')[0] })()
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
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #EEE', borderRadius: 14, fontSize: 14, color: '#1A1A1A', background: '#fff', textAlign: 'left', cursor: 'pointer' }}
        >
          Обрати дату
        </button>
      </label>
      <BottomSheet open={showCalendar} onClose={() => setShowCalendar(false)} title="Оберіть дату">
        <div style={{ padding: '0 20px 12px' }}>
          <SimpleCalendar
            minDateISO={todayISO}
            maxDateISO={maxISO}
            onSelect={(iso) => { setShowCalendar(false); onPickDate(iso) }}
          />
        </div>
      </BottomSheet>
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
  const { setTrip, setTrip2, setOpenReturnPending, setPricingTrip2 } = useBookingStore()

  // "Відкрита дата повернення" (Кеп, 05.08): бекенд ВСЕ Ж підтримує такий тип замовлення —
  // передається route2=-1 (див. Booking.tsx), і рахується/оплачується як round-trip. Тому
  // ціна (twoWay) рахується для isOpenReturn так само, як для конкретної dateTo. Єдине, що
  // НЕ робимо для відкритої дати — не шукаємо/не показуємо/не бронюємо КОНКРЕТНИЙ зворотний
  // рейс (hasFixedReturn нижче, окремо від "хоче round-trip ціну/оплату").
  const hasFixedReturn = !!dateTo
  const wantsTwoWay = hasFixedReturn || isOpenReturn
  const returnDateISO = hasFixedReturn ? dateTo : undefined

  const outLeg = useLegSearch(from?.id, to?.id, dateFrom, true)
  const retLeg = useLegSearch(to?.id, from?.id, returnDateISO, hasFixedReturn)
  // ЗАДАЧА 1 (27.08): реальний пошук зворотного рейсу для ВІДКРИТОЇ дати — активний
  // тільки коли isOpenReturn і НЕ hasFixedReturn (взаємовиключні режими).
  const openReturnActive = isOpenReturn && !hasFixedReturn
  const openReturnSearch = useOpenReturnSearch(to?.id, from?.id, dateFrom, openReturnActive)

  const outTrip = legResolvedTrip(outLeg)
  const retTrip = hasFixedReturn ? legResolvedTrip(retLeg) : null

  const outBlocked = legBlocked(outLeg)
  const retBlocked = hasFixedReturn && legBlocked(retLeg)
  const outNeedsConfirm = legNeedsConfirm(outLeg)
  const retNeedsConfirm = hasFixedReturn && legNeedsConfirm(retLeg)

  const anyLoading = outLeg.loading || (hasFixedReturn && retLeg.loading) || (openReturnActive && openReturnSearch.loading)
  const anyError = outLeg.error || retLeg.error
  const ready = !!outTrip && (!hasFixedReturn || !!retTrip)

  // Напрямок для підбору шаблону ціни (стара таблиця, лише для USE_NEW_PRICING=false):
  // відправлення з України -> UAH, з Європи -> EUR
  const direction: 'ua' | 'eu' = from?.i2 === 'ua' ? 'ua' : 'eu'
  // Кеп (27.08): фіксовані дати в обидва боки — рахуємо КОЖНОГО пасажира окремо (за його
  // категорією, roundTripGroupPrice), не тільки одного. Стара таблиця лишається як
  // fallback, якщо USE_NEW_PRICING=false (миттєвий відкат).
  const twoWay = (wantsTwoWay && ready && from && to && hasFixedReturn && retTrip)
    ? (USE_NEW_PRICING
        ? (() => {
            const coefficient = getCoefficient(from.id, 'fixedDates')
            const g = roundTripGroupPrice(outTrip, retTrip, passengerCategories, 'fixed', coefficient)
            const discountPct = g.base > 0 ? Math.round((1 - g.total / g.base) * 100) : 0
            return { tariff: g.total, total: g.total, perPassenger: g.perPassenger, anyFallback: false, strikePrice: g.total < g.base ? g.base : undefined, discountPct, details: g.details }
          })()
        : findTwoWayGroupPrice(perPassengerOneWayPrices(outTrip, passengerCategories), fullFareOneWayPrice(outTrip), from.id, to.id, direction))
    : (openReturnActive && ready && from && to && USE_NEW_PRICING && openReturnSearch.searched && openReturnSearch.trip)
      ? (() => {
          const coefficient = getCoefficient(from.id, 'openDate')
          const g = roundTripGroupPrice(outTrip, openReturnSearch.trip, passengerCategories, 'open', coefficient)
          const discountPct = g.base > 0 ? Math.round((1 - g.total / g.base) * 100) : 0
          return { tariff: g.total, total: g.total, perPassenger: g.perPassenger, anyFallback: false, strikePrice: g.total < g.base ? g.base : undefined, discountPct, details: g.details }
        })()
      : (wantsTwoWay && ready && from && to && !hasFixedReturn && !USE_NEW_PRICING
          ? findTwoWayGroupPrice(perPassengerOneWayPrices(outTrip, passengerCategories), fullFareOneWayPrice(outTrip), from.id, to.id, direction)
          : null)
  // Кеп (27.08): якщо пошук зворотного рейсу завершився і НІЧОГО не знайдено (немає рейсу
  // в діапазоні +30..+60, чи знайдений рейс має ціну 0) — явно кажемо юзеру "немає",
  // а не мовчки показуємо 0.
  const openReturnNotFound = openReturnActive && USE_NEW_PRICING && openReturnSearch.searched && !openReturnSearch.trip

  const handleSelect = () => {
    if (!outTrip) return
    setTrip(outTrip)
    if (hasFixedReturn) {
      if (!retTrip) return
      setTrip2(retTrip)
      setPricingTrip2(retTrip, 'fixed')
    } else if (openReturnActive) {
      setTrip2(null) // прибираємо стару обрану дату назад, якщо юзер повернувся й переключився на відкриту
      // ЄДИНА АРХІТЕКТУРА: pricingTrip2 заповнюється завжди для round-trip — навіть коли
      // конкретного забронованого другого рейсу нема (відкрита дата). Booking.tsx читає
      // саме це поле для ціни, а не selectedTrip2 (яке лишається null тут навмисно).
      setPricingTrip2(openReturnSearch.trip ?? null, 'open')
    } else {
      setTrip2(null)
      setPricingTrip2(null, null)
    }
    setOpenReturnPending(isOpenReturn && !hasFixedReturn)
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
            <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <Menu size={24} color="#fff" />
            </button>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, flex: 1 }}>Результати пошуку</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff' }}>
            <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{from?.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid #fff', flexShrink: 0 }} />
              <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.6)' }} />
              <Bus size={18} color="#fff" />
              {wantsTwoWay && <span style={{ fontSize: 11, opacity: 0.85 }}>⇄</span>}
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
                {hasFixedReturn && retTrip && <TripCard trip={retTrip} cats={passengerCategories} hideBookButton />}

                {/* "Відкрита дата повернення" без обраної dateTo — бекенд ПІДТРИМУЄ такий
                    round-trip (route2=-1, ціна/оплата рахуються як за два боки), просто
                    конкретного зворотного рейсу поки нема — його фіксують пізніше на
                    екрані вже оплаченого квитка. */}
                {isOpenReturn && !hasFixedReturn && !openReturnNotFound && (
                  <div style={{ background: '#FFF3DC', border: `1px solid ${ORange}`, borderRadius: 16, padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} color={ORange} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13, color: '#7A5A00', lineHeight: 1.4 }}>
                      Ціна вже враховує поїздку в два боки. Конкретну дату зворотного
                      квитка ви зафіксуєте пізніше — на екрані свого квитка.
                    </div>
                  </div>
                )}

                {/* ЗАДАЧА 1 (27.08, Кеп): якщо в діапазоні +30..+60 днів немає жодного
                    придатного зворотного рейсу (чи знайдений має ціну 0) — прямо кажемо
                    про це, замість мовчазного 0 чи неправильної ціни. */}
                {openReturnNotFound && (
                  <div style={{ background: '#FDECEC', border: '1px solid #E53935', borderRadius: 16, padding: 14, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} color="#E53935" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 13, color: '#8C1D1D', lineHeight: 1.4 }}>
                      Зворотного рейсу немає — на цьому маршруті не знайдено рейсів у
                      найближчі 30–60 днів після виїзду. Спробуйте обрати конкретну дату
                      повернення замість відкритої.
                    </div>
                  </div>
                )}

                {!openReturnNotFound && (
                  <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 14, color: Gray }}>{wantsTwoWay ? 'Разом за поїздку в два боки' : 'Разом за поїздку'}</span>
                      <CurrencyToggle />
                    </div>
                    {openReturnActive && openReturnSearch.loading ? (
                      <div style={{ fontSize: 14, color: Gray }}>Шукаємо зворотний рейс…</div>
                    ) : (
                      <>
                        <TotalPrice trip={outTrip} twoWayTotal={twoWay?.total ?? null} twoWayStrike={(twoWay as any)?.strikePrice ?? null} twoWayDiscountPct={(twoWay as any)?.discountPct ?? null} twoWayMode={hasFixedReturn ? 'fixed' : (openReturnActive ? 'open' : null)} twoWayDetails={(twoWay as any)?.details ?? null} cats={passengerCategories} />
                        {twoWay?.anyFallback && (
                          <div style={{ marginTop: 8, fontSize: 11, color: ORange, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <AlertTriangle size={12} /> Точна ціна в два боки буде уточнена на кроці бронювання
                          </div>
                        )}
                        <button onClick={handleSelect} style={{ width: '100%', marginTop: 16, padding: '14px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                          Обрати
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

// Кеп (28.08): "гамбургер" — розгортна деталізація ціни по кожному пасажиру, для ВСІХ
// типів (one-way, round-trip, відкрита дата). У згорнутому вигляді — тільки сума й
// написи, без номіналу знижки. У розгорнутому — кожен пасажир: категорія, ціна, і якщо
// спрацювала знижка рейсу (замість категорійної) — "Використовується знижка рейсу X%".
function PassengerPriceHamburger({ details, currency }: { details: PassengerPriceDetail[]; currency: string }) {
  const [open, setOpen] = useState(false)
  const { format } = useDisplayPrice()
  if (details.length === 0) return null
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: Gray, fontSize: 11.5, cursor: 'pointer', padding: 0 }}>
        <Menu size={12} />
        Деталізація по пасажирах
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: '#F9F9F9', borderRadius: 12, padding: 10 }}>
          {details.map((d, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < details.length - 1 ? '1px solid #EEE' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Пасажир {i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{format(d.price, currency)}</span>
              </div>
              <div style={{ fontSize: 11, color: Gray }}>{d.catName}</div>
              {/* Кеп (28.08): номінал знижки завжди — навіть коли це звичайна категорійна
                  знижка (не підміна рейсовою) — для повної прозорості вигоди. */}
              {d.effectivePct > 0 && (
                <div style={{ fontSize: 10.5, color: ORange, marginTop: 1 }}>
                  {d.usedTripDiscount ? `Використовується знижка рейсу ${Math.round(d.effectivePct)}%` : `Знижка ${Math.round(d.effectivePct)}%`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TotalPrice({ trip, twoWayTotal, twoWayStrike, twoWayDiscountPct, twoWayMode, twoWayDetails, cats }: { trip: any; twoWayTotal: number | null; twoWayStrike?: number | null; twoWayDiscountPct?: number | null; twoWayMode?: 'fixed' | 'open' | null; twoWayDetails?: PassengerPriceDetail[] | null; cats: string[] }) {
  const { format } = useDisplayPrice()
  const { total, original, legDiscountPct } = computeGroupPrice(trip, cats)
  const shown = twoWayTotal ?? total
  // Кеп (26.08): twoWayTotal — сума двох ніг, уже нормалізована в UAH (див. computeLegPricingUAH
  // у pricing.ts) — не валюта trip (leg1), бо leg2 може бути в EUR.
  const currency = twoWayTotal != null ? 'uah' : trip.currency
  // Кеп (27.08): заголовок над ціною — окремий підпис, не пов'язаний із внутрішньою
  // термінологією специфікації (базовий/актуальний тариф) — просто розрізняє тип квитка.
  const headerLabel = twoWayMode === 'open' ? 'Актуальний тариф квитка з відкритою датою' : twoWayMode === 'fixed' ? 'Актуальний тариф квитка в 2 сторони' : null
  // Кеп (28.08): для one-way (twoWayTotal===null) — теж показуємо перекреслення+знижку,
  // з ЛОКАЛЬНО порахованих original/legDiscountPct (computeGroupPrice) — раніше ці
  // значення рахувались, але ніде не показувались для одностороннього рейсу.
  const strike = twoWayTotal != null ? twoWayStrike : (original > shown ? original : null)
  const discountPct = twoWayTotal != null ? twoWayDiscountPct : legDiscountPct
  // Кеп (28.08): на РІВНІ ПІДСУМКУ — НІКОЛИ не показуємо номінал знижки, для ЖОДНОГО типу
  // (one-way/round-trip/відкрита дата) — тільки сума й фіксований напис. Номінал — лише
  // в гамбургер-деталізації по кожному пасажиру.
  const details = twoWayTotal != null ? (twoWayDetails ?? []) : oneWayGroupPrice(trip, cats).details
  return (
    <>
      {headerLabel && <div style={{ fontSize: 12, color: Gray, marginBottom: 4 }}>{headerLabel}</div>}
      {strike != null && (
        <div style={{ fontSize: 14, color: Gray, textDecoration: 'line-through' }}>{format(strike, currency)}</div>
      )}
      <div style={{ fontSize: 26, fontWeight: 800 }}>{format(shown, currency)}</div>
      {discountPct != null && discountPct > 0 && (
        <div style={{ fontSize: 12, color: '#E53935', fontWeight: 700, marginTop: 2 }}>Діє знижка, кількість акційних квитків — обмежена</div>
      )}
      <PassengerPriceHamburger details={details} currency={currency} />
    </>
  )
}
