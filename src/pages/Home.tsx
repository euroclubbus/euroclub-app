import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, MapPin, Navigation, Calendar, Users } from 'lucide-react'
import { useSearchStore } from '../store'
import { getCities } from '../api/euroclub'
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
  const { passengerCount, setPassengerCount } = useSearchStore()
  return (
    <BottomSheet open={open} onClose={onClose} title="Пасажири">
      <div style={{ padding: '8px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 0' }}>
          <button onClick={() => setPassengerCount(passengerCount - 1)} style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid #DDD', background: 'none', cursor: 'pointer', fontSize: 24, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span style={{ width: 56, textAlign: 'center', fontWeight: 800, fontSize: 32 }}>{passengerCount}</span>
          <button onClick={() => setPassengerCount(passengerCount + 1)} style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid #DDD', background: 'none', cursor: 'pointer', fontSize: 24, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
        <div style={{ color: Gray, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>Знижки вибираються для кожного пасажира окремо на кроці бронювання</div>
        <button onClick={onClose} style={{
          width: '100%', marginTop: 12, padding: 16, background: ORange, color: '#fff',
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
    getCities().then((data: any) => {
      const raw = data.cities || data || {}
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      // фільтруємо тільки міста з українською назвою, сортуємо за алфавітом
      const sorted = arr
        .filter((c: any) => c && c.uk)
        .sort((a: any, b: any) => a.uk.localeCompare(b.uk, 'uk'))
      setCities(sorted)
    }).catch(() => setCities([]))
  }, [open])

  const filtered = cities.filter((c: any) =>
    (c.uk || '').toLowerCase().includes(query.toLowerCase())
  )

  if (!open) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, height: '100%', zIndex: 300, background: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Вибір міста</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        {/* From/To fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {(['from', 'to'] as const).map(f => (
            <button key={f} onClick={() => { setActiveField(f); setQuery('') }} style={{
              background: activeField === f ? '#fff' : 'rgba(255,255,255,0.08)',
              border: activeField === f ? 'none' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '12px 16px', textAlign: 'left', cursor: 'pointer'
            }}>
              <div style={{ fontSize: 11, color: activeField === f ? Gray : 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                {f === 'from' ? 'Відправлення' : 'Прибуття'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: activeField === f ? '#1A1A1A' : (f === 'from' ? (from?.name ? '#fff' : 'rgba(255,255,255,0.4)') : (to?.name ? '#fff' : 'rgba(255,255,255,0.4)')) }}>
                {f === 'from' ? (from?.name || 'Введіть місто') : (to?.name || 'Введіть місто')}
              </div>
            </button>
          ))}
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
          <span style={{ color: ORange }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук міста..."
            autoFocus
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 15, flex: 1, color: '#fff' }}
          />
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {cities.length === 0 && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Завантаження...</div>}
        {filtered.map((c: any) => (
          <button key={c.id} onClick={() => {
            const cityObj = { id: String(c.id), name: c.uk, country: COUNTRY_NAMES[c.i2] || c.i2 }
            if (activeField === 'from') { setFrom(cityObj); setActiveField('to'); setQuery('') }
            else { setTo(cityObj); setQuery(''); onClose() }
          }} style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '8px 20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{c.uk}</span>
            <span style={{ fontSize: 11, color: Gray, marginTop: 1 }}>{COUNTRY_NAMES[c.i2] || c.i2}</span>
          </button>
        ))}
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

  return (
    <div style={{ minHeight: '100vh', background: '#F0F0F0', paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ width: '100%', height: 220, overflow: 'hidden', position: 'relative' }}>
        <img src="/bus-hero.png" alt="EuroClub" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.background = '#1B4F8A' }} />
      </div>

      {/* Search Card */}
      <div style={{ margin: '-30px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', position: 'relative', zIndex: 10 }}>
        {/* From */}
        <button onClick={() => setShowCity(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10 }}>
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
        <button onClick={() => setShowCity(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10 }}>
          <MapPin size={18} color={Gray} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {to?.name && <div style={{ fontSize: 11, color: Gray }}>Прибуття</div>}
            <div style={{ fontSize: 16, color: to?.name ? '#1A1A1A' : Gray, fontWeight: to?.name ? 600 : 400 }}>{to?.name || 'Прибуття'}</div>
          </div>
        </button>

        {/* Date From */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setShowDateFrom(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer' }}>
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
        <button onClick={() => canSearch && nav('/results')} disabled={!canSearch} style={{
          width: '100%', padding: 18, background: canSearch ? ORange : '#FFD89B',
          color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800,
          fontSize: 17, cursor: canSearch ? 'pointer' : 'default', letterSpacing: 0.3
        }}>Знайти</button>
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
