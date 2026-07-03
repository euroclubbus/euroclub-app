import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, MapPin, Navigation, Calendar, Users } from 'lucide-react'
import { useSearchStore } from '../store'
import { getCities, getDiscounts } from '../api/euroclub'
import BottomSheet from '../components/BottomSheet'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// ─── Calendar ────────────────────────────────────────────────────────────────
function Calendar_({ value, onChange, minDate, onConfirm, departureSel, isOpen, onToggleOpen, showOpenDate }: any) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [cur, setCur] = useState(() => { const d = value ? new Date(value) : new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const months = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
  const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд']
  const firstDay = new Date(cur.y, cur.m, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate()
  const cells = Array(offset).fill(null).concat(Array.from({length: daysInMonth}, (_,i) => i+1))
  const min = minDate ? new Date(minDate) : today; min.setHours(0,0,0,0)
  const selDate = value ? new Date(value) : null; selDate?.setHours(0,0,0,0)
  const depDate = departureSel ? new Date(departureSel) : null; depDate?.setHours(0,0,0,0)

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{ opacity: isOpen ? 0.35 : 1, pointerEvents: isOpen ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{months[cur.m]} {cur.y}</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => setCur(c => { const d = new Date(c.y, c.m-1); return { y: d.getFullYear(), m: d.getMonth() } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Gray, fontSize: 18 }}>←</button>
            <button onClick={() => setCur(c => { const d = new Date(c.y, c.m+1); return { y: d.getFullYear(), m: d.getMonth() } })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ORange, fontSize: 18 }}>→</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px 0', marginBottom: 8 }}>
          {days.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 12, color: Gray, paddingBottom: 8 }}>{d}</span>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px 0' }}>
          {cells.map((day, i) => {
            if (!day) return <span key={i} />
            const d = new Date(cur.y, cur.m, day); d.setHours(0,0,0,0)
            const isPast = d < min
            const isSel = selDate && d.getTime() === selDate.getTime()
            const isDep = depDate && d.getTime() === depDate.getTime()
            return (
              <button key={i} disabled={isPast} onClick={() => {
                const iso = `${cur.y}-${String(cur.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                onChange(iso)
                if (onToggleOpen) onToggleOpen(false)
              }} style={{
                background: isSel ? ORange : isDep ? '#FFF3DC' : 'none',
                border: 'none', borderRadius: '50%', width: 36, height: 36, margin: '0 auto', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: isPast ? 'default' : 'pointer',
                color: isSel ? '#fff' : isPast ? '#DDD' : '#1A1A1A',
                fontWeight: isSel || isDep ? 700 : 400, fontSize: 15
              }}>{day}</button>
            )
          })}
        </div>
      </div>
      {showOpenDate && (
        <button onClick={() => onToggleOpen && onToggleOpen(!isOpen)} style={{
          width: '100%', marginTop: 16, padding: 14,
          background: isOpen ? '#FFF3DC' : '#F9F9F9',
          border: isOpen ? `1.5px solid ${ORange}` : '1.5px solid transparent',
          borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start',
          cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
            border: `2px solid ${isOpen ? ORange : '#DDD'}`,
            background: isOpen ? ORange : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isOpen && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Відкрита дата повернення</div>
            <div style={{ color: Gray, fontSize: 12, marginTop: 3 }}>Ви зможете встановити дату пізніше. Квиток дійсний 6 місяців після першої поїздки.</div>
          </div>
        </button>
      )}
      <button onClick={onConfirm} disabled={!isOpen && !value} style={{
        width: '100%', marginTop: 20, padding: 16,
        background: (isOpen || value) ? ORange : '#FFD89B', color: '#fff',
        border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16,
        cursor: (isOpen || value) ? 'pointer' : 'default'
      }}>Підтвердити</button>
    </div>
  )
}

// ─── Passengers Sheet ─────────────────────────────────────────────────────────
function PassengersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { passengerCategories, setPassengerCategories } = useSearchStore()
  const [cats, setCats] = useState<any[]>([])

  // Глобальний каталог категорій пасажира (id спільні з trip.discounts)
  useEffect(() => {
    if (!open) return
    getDiscounts().then((data: any) => {
      const raw = data.discount || data.discounts || data || {}
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      const clean = arr.filter((d: any) => d && d.id !== undefined && d.name)
      setCats(clean)
    }).catch(() => setCats([]))
  }, [open])

  // Насіння: якщо склад порожній — 1 пасажир категорії за замовчуванням
  useEffect(() => {
    if (!open || cats.length === 0 || passengerCategories.length > 0) return
    const def = cats.find((d: any) => d.default === 1 || d.default === '1') || cats[0]
    if (def) setPassengerCategories([String(def.id)])
  }, [open, cats])

  const counts: Record<string, number> = {}
  passengerCategories.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
  const total = passengerCategories.length

  const change = (id: string, delta: number) => {
    const cur = counts[id] || 0
    const next = Math.max(0, cur + delta)
    const others = passengerCategories.filter(c => c !== id)
    const rebuilt = [...others, ...Array(next).fill(id)]
    if (rebuilt.length < 1) return // мінімум 1 пасажир
    setPassengerCategories(rebuilt)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Пасажири">
      <div style={{ padding: '4px 20px 24px' }}>
        {cats.length === 0 && <div style={{ textAlign: 'center', color: Gray, padding: 24 }}>Завантаження...</div>}
        {cats.map((d: any) => {
          const id = String(d.id)
          const n = counts[id] || 0
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F2F2F2' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{d.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => change(id, -1)} disabled={n === 0} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #DDD', background: 'none', cursor: n === 0 ? 'default' : 'pointer', fontSize: 20, color: n === 0 ? '#DDD' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ width: 20, textAlign: 'center', fontWeight: 700, fontSize: 18 }}>{n}</span>
                <button onClick={() => change(id, 1)} style={{ width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${ORange}`, background: 'none', cursor: 'pointer', fontSize: 20, color: ORange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
          )
        })}
        <div style={{ color: Gray, fontSize: 13, textAlign: 'center', margin: '16px 0', lineHeight: 1.5 }}>
          Всього пасажирів: <strong style={{ color: '#1A1A1A' }}>{total}</strong>. Вартість зі знижками з'явиться на результатах пошуку — по кожному рейсу окремо.
        </div>
        <button onClick={onClose} style={{
          width: '100%', padding: 16, background: ORange, color: '#fff',
          border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer'
        }}>Підтвердити</button>
      </div>
    </BottomSheet>
  )
}

// ─── City Picker ──────────────────────────────────────────────────────────────
const COUNTRY_NAMES: Record<string,string> = {
  ua: 'Україна', de: 'Німеччина', pl: 'Польща', at: 'Австрія', hu: 'Угорщина',
  sk: 'Словаччина', cz: 'Чехія', hr: 'Хорватія', si: 'Словенія', md: 'Молдова',
  it: 'Італія', fr: 'Франція', nl: 'Нідерланди', be: 'Бельгія', ch: 'Швейцарія',
  ro: 'Румунія', bg: 'Болгарія', rs: 'Сербія', lt: 'Литва', lv: 'Латвія', ee: 'Естонія',
}

function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { from, to, setFrom, setTo } = useSearchStore()
  const [activeField, setActiveField] = useState<'from'|'to'>('from')
  const [query, setQuery] = useState('')
  const [cities, setCities] = useState<any[]>([])

  useEffect(() => {
    if (!open) return
    setActiveField(from ? 'to' : 'from')
    setQuery('')
    getCities().then((data: any) => {
      const raw = data.cities || data || {}
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      const sorted = arr
        .filter((c: any) => c && c.uk)
        .sort((a: any, b: any) => a.uk.localeCompare(b.uk, 'uk'))
      setCities(sorted)
    }).catch(() => setCities([]))
  }, [open])

  // Субтитр: регіон + країна, якщо API віддає поле регіону; інакше — лише країна
  const subtitleOf = (c: any) => COUNTRY_NAMES[c.i2] || c.i2 || ''

  const filtered = cities.filter((c: any) =>
    (c.uk || '').toLowerCase().includes(query.toLowerCase())
  )

  if (!open) return null

  const renderField = (f: 'from'|'to') => {
    const active = activeField === f
    const city = f === 'from' ? from : to
    return (
      <div onClick={() => { setActiveField(f); setQuery('') }} style={{
        border: active ? `1.5px solid ${ORange}` : '1px solid #E6E6E6',
        background: active ? '#FFF7EC' : '#fff',
        borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
        boxShadow: active ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none',
      }}>
        <div style={{ fontSize: 12, color: Gray, marginBottom: 2 }}>{f === 'from' ? 'Відправлення' : 'Прибуття'}</div>
        {active ? (
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={city?.name || 'Введіть місто'}
            autoFocus
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 17, fontWeight: 600, color: '#1A1A1A', width: '100%', caretColor: ORange, padding: 0 }}
          />
        ) : (
          <div style={{ fontSize: 17, fontWeight: 600, color: city?.name ? '#1A1A1A' : '#BDBDBD' }}>{city?.name || 'Оберіть місто'}</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, height: '100%', zIndex: 300, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Розмита hero-шапка */}
      <div style={{ position: 'relative', height: 120, flexShrink: 0, overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px) brightness(0.8)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.25)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>Вибір міста</span>
          <button onClick={onClose} aria-label="Закрити" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 26, color: '#fff', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {/* Білий лист */}
      <div style={{ marginTop: -18, background: '#fff', borderRadius: '20px 20px 0 0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '18px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {renderField('from')}
          {renderField('to')}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 20px' }}>
          {cities.length === 0 && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Завантаження...</div>}
          {cities.length > 0 && filtered.length === 0 && <div style={{ textAlign: 'center', color: Gray, padding: 30 }}>Нічого не знайдено</div>}
          {filtered.map((c: any) => (
            <button key={c.id} onClick={() => {
              const cityObj = { id: String(c.id), name: c.uk, country: COUNTRY_NAMES[c.i2] || c.i2 }
              if (activeField === 'from') { setFrom(cityObj); setActiveField('to'); setQuery('') }
              else { setTo(cityObj); setQuery(''); onClose() }
            }} style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '12px 20px', background: 'none', border: 'none', borderBottom: '1px solid #F0F0F0', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>{c.uk}</span>
              <span style={{ fontSize: 12, color: Gray, marginTop: 2 }}>{subtitleOf(c)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const nav = useNavigate()
  const { from, to, dateFrom, dateTo, isOpenReturn, passengerCount, setDateFrom, setDateTo, setOpenReturn, swap } = useSearchStore()
  const [showCity, setShowCity] = useState(false)
  const [showDateFrom, setShowDateFrom] = useState(false)
  const [showDateTo, setShowDateTo] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const days = ['нд','пн','вт','ср','чт','пт','сб']
    return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
  }

  const canSearch = !!from && !!to && !!dateFrom

  // ── наскрізний патерн: підсвітка наступного кроку + підказка про незаповнене ──
  const [tried, setTried] = useState(false)
  const nextField: 'from' | 'to' | 'dateFrom' | null =
    !from ? 'from' : !to ? 'to' : !dateFrom ? 'dateFrom' : null
  const missingMsg =
    nextField === 'from' ? 'Оберіть місто відправлення' :
    nextField === 'to' ? 'Оберіть місто прибуття' :
    nextField === 'dateFrom' ? 'Оберіть дату відправлення' : ''
  const ring = (f: 'from' | 'to' | 'dateFrom') =>
    nextField === f
      ? { border: `1.5px solid ${ORange}`, background: '#FFF7EC', boxShadow: '0 0 0 3px rgba(245,166,35,0.12)' }
      : {}

  return (
    <div style={{ minHeight: '100vh', background: '#F0F0F0', paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ width: '100%', position: 'relative', lineHeight: 0 }}>
        <img src="/bus-hero.png" alt="EuroClub — автобусні квитки Україна — Європа" style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.background = '#1B4F8A' }} />
        {/* scrim для читабельності H1 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(180deg, rgba(8,28,58,0.55) 0%, rgba(8,28,58,0.18) 55%, rgba(8,28,58,0) 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', pointerEvents: 'none' }}>
          <h1 style={{ margin: 0, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: 800, lineHeight: 1.35, maxWidth: 260, WebkitTextStroke: '0.6px #000', textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}>
            Пошук квитків на автобус<br />по Україні та Європі
          </h1>
        </div>
      </div>

      {/* Search Card */}
      <div style={{ margin: '-30px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', position: 'relative', zIndex: 10 }}>
        {/* From */}
        <button onClick={() => setShowCity(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10, ...ring('from') }}>
          <Navigation size={18} color={ORange} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {from?.name && <div style={{ fontSize: 11, color: Gray }}>Відправлення</div>}
            <div style={{ fontSize: 16, color: from?.name ? '#1A1A1A' : Gray, fontWeight: from?.name ? 600 : 400 }}>{from?.name || 'Відправлення'}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); swap() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ArrowUpDown size={20} color={ORange} />
          </button>
        </button>

        {/* To */}
        <button onClick={() => setShowCity(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10, ...ring('to') }}>
          <MapPin size={18} color={Gray} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {to?.name && <div style={{ fontSize: 11, color: Gray }}>Прибуття</div>}
            <div style={{ fontSize: 16, color: to?.name ? '#1A1A1A' : Gray, fontWeight: to?.name ? 600 : 400 }}>{to?.name || 'Прибуття'}</div>
          </div>
        </button>

        {/* Date From */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setShowDateFrom(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', ...ring('dateFrom') }}>
            <Calendar size={16} color={Gray} />
            <div style={{ textAlign: 'left' }}>
              {dateFrom && <div style={{ fontSize: 11, color: Gray }}>Відправлення</div>}
              <div style={{ fontSize: 14, color: dateFrom ? '#1A1A1A' : Gray, fontWeight: dateFrom ? 600 : 400 }}>{dateFrom ? fmtDate(dateFrom) : 'Відправлення'}</div>
            </div>
          </button>

          {/* Date To — якщо відкрита дата активна, клік не відкриває календар */}
          <button onClick={() => !isOpenReturn && setShowDateTo(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px', background: '#F9F9F9', borderRadius: 14, border: isOpenReturn ? `1.5px solid ${ORange}` : '1px solid #EEE', cursor: 'pointer' }}>
            <Calendar size={16} color={isOpenReturn ? ORange : Gray} />
            <div style={{ textAlign: 'left' }}>
              {(dateTo || isOpenReturn) && <div style={{ fontSize: 11, color: isOpenReturn ? ORange : Gray }}>Повернення</div>}
              <div style={{ fontSize: 14, color: isOpenReturn ? ORange : (dateTo ? '#1A1A1A' : Gray), fontWeight: (dateTo || isOpenReturn) ? 600 : 400 }}>
                {isOpenReturn ? 'Відкрита дата' : dateTo ? fmtDate(dateTo) : 'Повернення'}
              </div>
            </div>
          </button>
        </div>

        {/* Відкрита дата — чекбокс на головній */}
        <button onClick={() => {
          setOpenReturn(!isOpenReturn)
          if (!isOpenReturn) setDateTo('')
        }} style={{
          width: '100%', marginBottom: 10, padding: '12px 16px',
          background: isOpenReturn ? '#FFF3DC' : '#F9F9F9',
          border: isOpenReturn ? `1.5px solid ${ORange}` : '1px solid #EEE',
          borderRadius: 14, display: 'flex', gap: 12, alignItems: 'center',
          cursor: 'pointer', textAlign: 'left',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${isOpenReturn ? ORange : '#DDD'}`,
            background: isOpenReturn ? ORange : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isOpenReturn && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: isOpenReturn ? ORange : '#555' }}>Відкрита дата повернення</span>
        </button>

        {/* Passengers */}
        <button onClick={() => setShowPass(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 16 }}>
          <Users size={18} color={Gray} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {passengerCount > 0 && <div style={{ fontSize: 11, color: Gray }}>Пасажири</div>}
            <div style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 600 }}>{passengerCount}</div>
          </div>
        </button>

        {/* Search button */}
        <button onClick={() => { if (canSearch) nav('/results'); else setTried(true) }} style={{
          width: '100%', padding: 18, background: canSearch ? ORange : '#FFD89B',
          color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800,
          fontSize: 17, cursor: 'pointer', letterSpacing: 0.3
        }}>Знайти</button>
        {tried && nextField && (
          <div style={{ marginTop: 10, textAlign: 'center', color: '#E53935', fontSize: 13, fontWeight: 600 }}>
            {missingMsg}
          </div>
        )}
      </div>

      {/* Tagline */}
      <div style={{ textAlign: 'center', marginTop: 28, padding: '0 24px', fontSize: 15, fontWeight: 600, color: '#8A8A8A' }}>
        <span style={{ color: ORange, fontWeight: 800 }}>Euroclub</span> — твій надійний перевізник!
      </div>

      <CityPicker open={showCity} onClose={() => setShowCity(false)} />

      <BottomSheet open={showDateFrom} onClose={() => setShowDateFrom(false)} title="Відправлення">
        <Calendar_ value={dateFrom} onChange={setDateFrom} minDate={new Date().toISOString().split('T')[0]}
          onConfirm={() => setShowDateFrom(false)} />
      </BottomSheet>

      <BottomSheet open={showDateTo} onClose={() => setShowDateTo(false)} title="Повернення">
        <Calendar_ value={dateTo} onChange={setDateTo} minDate={dateFrom || new Date().toISOString().split('T')[0]}
          showOpenDate departureSel={dateFrom}
          isOpen={isOpenReturn} onToggleOpen={setOpenReturn}
          onConfirm={() => setShowDateTo(false)} />
      </BottomSheet>

      <PassengersSheet open={showPass} onClose={() => setShowPass(false)} />
    </div>
  )
}
