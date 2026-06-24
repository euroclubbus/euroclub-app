import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Wifi, Zap, Bus, MessageCircle } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { getRoutes } from '../api/euroclub'
import BottomSheet from '../components/BottomSheet'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

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
  const days = ['нд','пн','вт','ср','чт','пт','сб']
  const months = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру']
  return `${days[dateObj.getDay()]} ${d} ${months[Number(m)-1]}`
}

function fmtCurrency(c?: string) {
  if (!c) return '₴'
  const v = c.toLowerCase()
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

// ─── Trip Card ─────────────────────────────────────────────────────────────
function TripCard({ trip, onInfo, onBook }: { trip: any; onInfo: () => void; onBook: () => void }) {
  const dep = trip.departure?.[0]
  const arr = trip.arrival?.[0]
  const depDT = splitDateTime(dep?.time)
  const arrDT = splitDateTime(arr?.time)
  const hasTransfer = Number(trip.transfer) === 1
  const transferStop = trip.stopping?.find((s: any) => Number(s.transfer) === 1)
  const currencySign = fmtCurrency(trip.currency)
  const freeSeats = Number(trip.free)
  const duration = calcDuration(dep?.time, arr?.time)
  // Використовуємо city_ua якщо є, інакше city
  const depCity = dep?.city_ua || dep?.city || ''
  const arrCity = arr?.city_ua || arr?.city || ''

  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>
          {fmtShortDate(depDT.date)} → {fmtShortDate(arrDT.date)}
        </span>
        {duration && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: Gray }}>
          <Clock size={13} />{duration}
        </span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{depDT.time}</div>
          <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{depCity}</div>
          <div style={{ fontSize: 11, color: ORange, lineHeight: 1.3, marginTop: 2 }}>{dep?.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 4, paddingTop: 4, minWidth: 50 }}>
          {hasTransfer && transferStop && <span style={{ fontSize: 9, color: Gray, whiteSpace: 'nowrap' }}>{transferStop.city_ua || transferStop.city}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 50 }}>
            <div style={{ flex: 1, height: 1, borderTop: '2px dashed #DDD' }} />
            <Bus size={16} color={hasTransfer ? ORange : Gray} />
            <div style={{ flex: 1, height: 1, borderTop: '2px dashed #DDD' }} />
          </div>
          {hasTransfer && <span style={{ fontSize: 9, color: ORange, fontWeight: 700, whiteSpace: 'nowrap' }}>Пересадка</span>}
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{arrDT.time}</div>
          <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{arrCity}</div>
          <div style={{ fontSize: 11, color: Gray, lineHeight: 1.3, marginTop: 2 }}>{arr?.name}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #F5F5F5', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {trip.option?.includes('WiFi') && <Wifi size={15} color={Gray} />}
          {trip.option?.includes('USB розетки') && <Zap size={15} color={Gray} />}
          <Bus size={15} color={Gray} />
          <span style={{ fontSize: 12, color: hasTransfer ? ORange : Gray, fontWeight: hasTransfer ? 700 : 400 }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</span>
          {freeSeats > 0 && freeSeats <= 5 && (
            <span style={{ fontSize: 11, color: '#E53935', fontWeight: 600 }}>Залишилось {freeSeats} місць</span>
          )}
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>{trip.price} {currencySign}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={onInfo} style={{ flex: 1, padding: '12px 0', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Інформація про рейс
        </button>
        <button onClick={onBook} style={{ flex: 1, padding: '12px 0', background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Бронювання
        </button>
      </div>
    </div>
  )
}

// ─── Trip Info Sheet ───────────────────────────────────────────────────────
function TripInfoSheet({ open, onClose, trip, onBook }: any) {
  const [expanded, setExpanded] = useState(false)
  if (!trip) return null
  const dep = trip.departure?.[0]
  const arr = trip.arrival?.[0]
  const depDT = splitDateTime(dep?.time)
  const arrDT = splitDateTime(arr?.time)
  const stops = trip.stopping || []
  const hasTransfer = Number(trip.transfer) === 1
  const duration = calcDuration(dep?.time, arr?.time)

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '16px 20px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtShortDate(depDT.date)} → {fmtShortDate(arrDT.date)}</div>
            {duration && <div style={{ fontSize: 13, color: Gray }}>⏱ {duration}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: Gray, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #DDD', background: '#fff' }} />
            <div style={{ width: 2, flex: 1, background: '#DDD', minHeight: 30 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{dep?.city_ua || dep?.city}</div>
            <div style={{ color: Gray, fontSize: 13 }}>{dep?.name}</div>
          </div>
          <div style={{ fontWeight: 700 }}>{depDT.time}</div>
        </div>

        {stops.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}>
            <Bus size={16} color={Gray} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{stops.length} зупинок</span>
            <span>{expanded ? '▲' : '▼'}</span>
          </button>
        )}

        {expanded && stops.map((s: any, i: number) => {
          const isTransfer = Number(s.transfer) === 1
          const stopDT = splitDateTime(s.time_out || s.time_in)
          return (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {isTransfer
                  ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🔄</div>
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DDD' }} />
                }
              </div>
              <div style={{ flex: 1 }}>
                {isTransfer && <div style={{ color: ORange, fontSize: 12, fontWeight: 700 }}>Пересадка</div>}
                <div style={{ fontWeight: isTransfer ? 400 : 500, fontSize: 14 }}>{s.city_ua || s.city}</div>
                <div style={{ color: Gray, fontSize: 12 }}>{s.name}</div>
              </div>
              <div style={{ color: Gray, fontSize: 13 }}>{stopDT.time}</div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #DDD', background: '#fff', marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{arr?.city_ua || arr?.city}</div>
            <div style={{ color: Gray, fontSize: 13 }}>{arr?.name}</div>
          </div>
          <div style={{ fontWeight: 700 }}>{arrDT.time}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #F5F5F5', alignItems: 'center' }}>
          {trip.option?.includes('WiFi') && <Wifi size={15} color={Gray} />}
          {trip.option?.includes('USB розетки') && <Zap size={15} color={Gray} />}
          <Bus size={15} color={Gray} />
          <span style={{ fontSize: 13, color: Gray }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</span>
        </div>

        <button onClick={onBook} style={{ width: '100%', padding: 18, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17, cursor: 'pointer', marginTop: 20 }}>
          Перейти до бронювання →
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── Date Strip — без скролу, стрілки ліво/право ─────────────────────────
function DateStrip({ dates, activeDate, onPick, onPrev, onNext }: {
  dates: string[]; activeDate: string; onPick: (d: string) => void; onPrev: () => void; onNext: () => void
}) {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    const mm = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру']
    return { day: d.getDate(), month: mm[d.getMonth()] }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <button onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, padding: '0 8px', flexShrink: 0 }}>‹</button>
      <div style={{ display: 'flex', flex: 1 }}>
        {dates.map(iso => {
          const { day, month } = fmt(iso)
          const isActive = iso === activeDate
          return (
            <button key={iso} onClick={() => onPick(iso)} style={{
              flex: 1, minWidth: 0, padding: '8px 2px', background: 'none', border: 'none',
              borderBottom: isActive ? `3px solid ${ORange}` : '3px solid transparent',
              cursor: 'pointer', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: isActive ? ORange : '#888', fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>
                {day} {month}
              </div>
            </button>
          )
        })}
      </div>
      <button onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, padding: '0 8px', flexShrink: 0 }}>›</button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function Results() {
  const nav = useNavigate()
  const { from, to, dateFrom } = useSearchStore()
  const { setTrip } = useBookingStore()
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noRoute, setNoRoute] = useState(false) // true = такого маршруту взагалі немає
  const [infoTrip, setInfoTrip] = useState<any>(null)
  const [stripStart, setStripStart] = useState(0) // індекс першого дня в стрічці

  // Масив з 14 днів починаючи від dateFrom
  const allDates = Array.from({length: 14}, (_, i) => {
    const d = new Date(dateFrom || new Date())
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const visibleDates = allDates.slice(stripStart, stripStart + 5)
  const [activeDate, setActiveDate] = useState(dateFrom || allDates[0])

  const handlePrev = () => {
    if (stripStart > 0) {
      setStripStart(s => s - 1)
      setActiveDate(allDates[Math.max(0, stripStart - 1)])
    }
  }
  const handleNext = () => {
    if (stripStart + 5 < allDates.length) {
      setStripStart(s => s + 1)
      setActiveDate(allDates[Math.min(allDates.length - 1, stripStart + 5)])
    }
  }

  useEffect(() => {
    if (!from || !to || !activeDate) return
    setLoading(true); setError(''); setNoRoute(false)
    const [y, m, d] = activeDate.split('-')
    const apiDate = `${d}-${m}-${y}`
    getRoutes(from.id, to.id, apiDate)
      .then(data => {
        const code = String(data.error ?? '0')
        if (code === '102' || code === '103') {
          // Маршруту взагалі не існує
          setNoRoute(true)
          setTrips([])
        } else {
          setTrips(data.routes || [])
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Не вдалося завантажити рейси. Перевірте з\'єднання.')
        setLoading(false)
      })
  }, [from, to, activeDate])

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Знайдені маршрути</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, color: '#fff' }}>
          <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{from?.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ flex: 1, borderTop: '1.5px dashed #666' }} />
            <Bus size={18} color="#888" />
            <div style={{ flex: 1, borderTop: '1.5px dashed #666' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{to?.name}</span>
        </div>
        <DateStrip
          dates={visibleDates}
          activeDate={activeDate}
          onPick={setActiveDate}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      {/* Results */}
      <div style={{ padding: '16px 16px 0', background: '#F5F5F5', minHeight: 'calc(100vh - 160px)' }}>
        {loading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Завантаження...</div>}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📡</div>
            <div style={{ color: '#ff6b6b', fontSize: 15, marginBottom: 16 }}>{error}</div>
            <button onClick={() => setActiveDate(d => d)} style={{ padding: '10px 24px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Спробувати ще раз
            </button>
          </div>
        )}

        {/* Такого маршруту взагалі немає */}
        {!loading && !error && noRoute && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚌</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              Цей маршрут наразі недоступний
            </div>
            <div style={{ fontSize: 14, color: Gray, marginBottom: 24, lineHeight: 1.5 }}>
              На жаль, рейси за маршрутом <strong>{from?.name} → {to?.name}</strong> наразі не виконуються. Спробуйте змінити міста відправлення або прибуття.
            </div>
            <div style={{ background: '#F9F9F9', borderRadius: 16, padding: 20, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Потрібна допомога?</div>
              <div style={{ fontSize: 13, color: Gray, marginBottom: 16, lineHeight: 1.5 }}>
                Наш менеджер допоможе підібрати оптимальний маршрут або повідомить коли рейс з'явиться.
              </div>
              <button style={{ width: '100%', padding: '14px 0', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <MessageCircle size={18} />
                Розпочати чат
              </button>
            </div>
            <button onClick={() => nav(-1)} style={{ marginTop: 16, padding: '12px 24px', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ← Змінити маршрут
            </button>
          </div>
        )}

        {/* Рейсів на цю дату немає */}
        {!loading && !error && !noRoute && trips.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗓</div>
            <div style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              На жаль, на обрану вами дату рейсів немає
            </div>
            <div style={{ color: Gray, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              Але ви можете обрати найближчі доступні дати:
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={handlePrev} style={{ padding: '10px 18px', background: '#2A2A2A', color: '#fff', border: '1px solid #444', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ‹ Попередній день
              </button>
              <button onClick={handleNext} style={{ padding: '10px 18px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Наступний день ›
              </button>
            </div>
          </div>
        )}

        {trips.map((trip, i) => (
          <TripCard key={trip.id || i} trip={trip}
            onInfo={() => setInfoTrip(trip)}
            onBook={() => { setTrip(trip); nav('/booking') }}
          />
        ))}
      </div>

      <TripInfoSheet open={!!infoTrip} onClose={() => setInfoTrip(null)} trip={infoTrip}
        onBook={() => { setTrip(infoTrip); setInfoTrip(null); nav('/booking') }} />
    </div>
  )
}
