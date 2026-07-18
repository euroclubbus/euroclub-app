import { useState, useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import NotifPrompt from '../components/NotifPrompt'
import SideMenu from '../components/SideMenu'
import { useT, MONTHS, WEEKDAYS_MON, WEEKDAYS_SUN } from '../i18n'
import { useLangStore } from '../langStore'
import { Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, MapPin, Navigation, Calendar, Users } from 'lucide-react'
import { useSearchStore } from '../store'
import { getCities, getDiscounts } from '../api/euroclub'
import { getAllowedCities } from '../cityRules'
import BottomSheet from '../components/BottomSheet'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// ─── Calendar ────────────────────────────────────────────────────────────────
function Calendar_({ value, onChange, minDate, onConfirm, departureSel, isOpen, onToggleOpen, showOpenDate }: any) {
  const t = useT()
  const today = new Date(); today.setHours(0,0,0,0)
  const [cur, setCur] = useState(() => {
    if (value) { const d = new Date(value); return { y: d.getFullYear(), m: d.getMonth() } }
    // Календар зворотної дати (є departureSel, ще нема обраної value) — стартуємо не з
    // поточного місяця, а з місяця ПІСЛЯ дати першої поїздки: значно ближче до реального
    // вибору, ніж гортати від сьогодні, якщо подорож у далекому майбутньому.
    if (departureSel) { const d = new Date(departureSel); const next = new Date(d.getFullYear(), d.getMonth() + 1, 1); return { y: next.getFullYear(), m: next.getMonth() } }
    const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }
  })
  const lang = useLangStore(s => s.lang)
  const months = MONTHS[lang]
  const days = WEEKDAYS_MON[lang]
  const firstDay = new Date(cur.y, cur.m, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate()
  const cells = Array(offset).fill(null).concat(Array.from({length: daysInMonth}, (_,i) => i+1))
  const min = minDate ? new Date(minDate) : today; min.setHours(0,0,0,0)
  const selDate = value ? new Date(value) : null; selDate?.setHours(0,0,0,0)
  const depDate = departureSel ? new Date(departureSel) : null; depDate?.setHours(0,0,0,0)

  const [slideKey, setSlideKey] = useState(0)
  const [slideDir, setSlideDir] = useState<1 | -1>(1)
  const prevMonth = () => { setSlideDir(-1); setSlideKey(k => k + 1); setCur(c => { const d = new Date(c.y, c.m-1); return { y: d.getFullYear(), m: d.getMonth() } }) }
  const nextMonth = () => { setSlideDir(1); setSlideKey(k => k + 1); setCur(c => { const d = new Date(c.y, c.m+1); return { y: d.getFullYear(), m: d.getMonth() } }) }

  // Свайп/потягування по сітці календаря — вліво/вправо між місяцями, інтуітивно як стрічка.
  // useRef, а не звичайний об'єкт — щоб стан жесту не губився між touchstart і touchend
  // (звичайний об'єкт перестворювався б при кожному ре-рендері компонента).
  const swipeRef = useRef({ x: 0, active: false })
  const onTouchStart = (e: TouchEvent) => { swipeRef.current = { x: e.touches[0].clientX, active: true } }
  const onTouchEnd = (e: TouchEvent) => {
    if (!swipeRef.current.active) return
    const dx = e.changedTouches[0].clientX - swipeRef.current.x
    if (dx > 40) prevMonth()
    else if (dx < -40) nextMonth()
    swipeRef.current.active = false
  }
  // Мишею (десктоп/тестування) — той самий жест перетягування
  const onMouseDown = (e: React.MouseEvent) => { swipeRef.current = { x: e.clientX, active: true } }
  const onMouseUp = (e: React.MouseEvent) => {
    if (!swipeRef.current.active) return
    const dx = e.clientX - swipeRef.current.x
    if (dx > 40) prevMonth()
    else if (dx < -40) nextMonth()
    swipeRef.current.active = false
  }

  return (
    <div style={{ padding: '0 20px 20px' }}>
      {/* Видима анімація перемикання місяця (0.2с), в один бік для → і в інший для ← */}
      <style>{`
        @keyframes euroclubCalSlideR { from { transform: translateX(28px); opacity: 0.3; } to { transform: translateX(0); opacity: 1; } }
        @keyframes euroclubCalSlideL { from { transform: translateX(-28px); opacity: 0.3; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div style={{ opacity: isOpen ? 0.35 : 1, pointerEvents: isOpen ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{months[cur.m]} {cur.y}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Обидві стрілки однаково підсвічені (оранжевим) — раніше ← була сірою, ніби
                неактивна, хоча технічно так само гортала назад, і це збивало з пантелику. */}
            <button onClick={prevMonth} aria-label="Попередній місяць" style={{ background: 'none', border: 'none', cursor: 'pointer', color: ORange, fontSize: 26, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <button onClick={nextMonth} aria-label="Наступний місяць" style={{ background: 'none', border: 'none', cursor: 'pointer', color: ORange, fontSize: 26, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px 0', marginBottom: 8 }}>
          {days.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 12, color: Gray, paddingBottom: 8 }}>{d}</span>)}
        </div>
        <div key={slideKey} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onMouseDown={onMouseDown} onMouseUp={onMouseUp} style={{
          display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px 0', touchAction: 'pan-y',
          animation: `${slideDir === 1 ? 'euroclubCalSlideR' : 'euroclubCalSlideL'} 0.2s ease-out`,
        }}>
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
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('home.openReturn')}</div>
            <div style={{ color: Gray, fontSize: 12, marginTop: 3 }}>{t('home.openReturnNote')}</div>
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
  const t = useT()
  const { passengerCategories, setPassengerCategories } = useSearchStore()
  const [cats, setCats] = useState<any[]>([])
  // Чернетка — зміни (+/-) не йдуть напряму в стор, а лише в локальний стан.
  // Застосовуються (setPassengerCategories) тільки по натисканню "OK". "✕" — закриває
  // без збереження, чернетка просто скидається наступного відкриття.
  const [draft, setDraft] = useState<string[]>(passengerCategories)

  // Глобальний каталог категорій пасажира (id спільні з trip.discounts)
  useEffect(() => {
    if (!open) return
    setDraft(passengerCategories)
    getDiscounts().then((data: any) => {
      const raw = data.discount || data.discounts || data || {}
      const arr = Array.isArray(raw) ? raw : Object.values(raw)
      const clean = arr.filter((d: any) => d && d.id !== undefined && d.name)
      const isFull = (d: any) => d.default === 1 || d.default === '1' || String(d.id) === '0'
      const fullFare = clean.find(isFull) || { id: 0, default: 1, name: 'Повний тариф' }
      const rest = clean.filter((d: any) => !isFull(d))
      setCats([fullFare, ...rest])
    }).catch(() => setCats([{ id: 0, default: 1, name: 'Повний тариф' }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Насіння: якщо склад порожній (перше відкриття) — 1 пасажир категорії за замовчуванням
  useEffect(() => {
    if (!open || cats.length === 0 || draft.length > 0) return
    const def = cats.find((d: any) => d.default === 1 || d.default === '1') || cats[0]
    if (def) setDraft([String(def.id)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cats])

  const counts: Record<string, number> = {}
  draft.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
  const total = draft.length

  const change = (id: string, delta: number) => {
    const cur = counts[id] || 0
    const next = Math.max(0, cur + delta)
    const others = draft.filter(c => c !== id)
    const rebuilt = [...others, ...Array(next).fill(id)]
    if (rebuilt.length < 1) return // мінімум 1 пасажир
    setDraft(rebuilt)
  }

  const confirm = () => { setPassengerCategories(draft); onClose() }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('home.passengersSheetTitle')}>
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} aria-label="Закрити без збереження" style={{
            width: 52, flexShrink: 0, padding: 16, background: '#F5F5F5', color: '#555',
            border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 18, cursor: 'pointer'
          }}>✕</button>
          <button onClick={confirm} style={{
            flex: 1, padding: 16, background: ORange, color: '#fff',
            border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer'
          }}>OK</button>
        </div>
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

function CityPicker({ open, onClose, initialField }: { open: boolean; onClose: () => void; initialField?: 'from'|'to' }) {
  const t = useT()
  const { from, to, setFrom, setTo } = useSearchStore()
  const [activeField, setActiveField] = useState<'from'|'to'>('from')
  const [query, setQuery] = useState('')
  const [cities, setCities] = useState<any[]>([])

  useEffect(() => {
    if (!open) return
    // Відкриваємо саме те поле, на яке натиснув користувач (from/to) — а не завжди 'to'
    // тільки тому, що 'from' вже заповнене. Раніше клік по вже обраному "Львів" все одно
    // відкривав фокус на "to", і поміняти саме from можна було лише додатковим тапом.
    setActiveField(initialField || (from ? 'to' : 'from'))
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

  const otherCity = activeField === 'to' ? from : to
  const otherIsFrom = activeField === 'to'
  const ruleCities = cities.map((c: any) => ({ id: String(c.id), name: c.uk, i2: c.i2, _raw: c }))
  const allowedIds = otherCity
    ? new Set(getAllowedCities(ruleCities, { id: otherCity.id, name: otherCity.name, i2: otherCity.i2 }, otherIsFrom).map(c => c.id))
    : null
  // Пошук по синонімах — /cities/ віддає назву кожного міста кількома мовами (uk/en/de/pl/ru),
  // звіряємось з полями напряму (звірено на реальній відповіді API — не вигадано).
  // Українською лишається тільки ВІДОБРАЖЕННЯ (c.uk), пошук працює по всіх полях одразу.
  const matchesQuery = (c: any) => {
    const q = query.toLowerCase()
    if (!q) return true
    return [c.uk, c.en, c.de, c.pl, c.ru].some((n: any) => String(n || '').toLowerCase().startsWith(q))
  }
  const filtered = cities.filter((c: any) =>
    (!allowedIds || allowedIds.has(String(c.id))) && matchesQuery(c)
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
        <div style={{ fontSize: 12, color: Gray, marginBottom: 2 }}>{f === 'from' ? t('home.from') : t('home.to')}</div>
        {active ? (
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={city?.name || t('home.enterCity')}
            autoFocus
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 17, fontWeight: 600, color: '#1A1A1A', width: '100%', caretColor: ORange, padding: 0 }}
          />
        ) : (
          <div style={{ fontSize: 17, fontWeight: 600, color: city?.name ? '#1A1A1A' : '#BDBDBD' }}>{city?.name || t('home.chooseCity')}</div>
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
              const cityObj = { id: String(c.id), name: c.uk, country: COUNTRY_NAMES[c.i2] || c.i2, i2: c.i2 }
              if (activeField === 'from') {
                setFrom(cityObj)
                // "to" вже обране і список і так відфільтрований під сумісність з ним (allowedIds
                // рахується від otherCity) — тому повторно питати "to" не треба, просто закриваємо.
                if (to) { setQuery(''); onClose() } else { setActiveField('to'); setQuery('') }
              }
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
const TAGLINES: Record<string, string[]> = {
  uk: ['Euroclub — твій надійний перевізник!', 'Ми знайдемо маршрут до вашого серця'],
  en: ['Euroclub — your reliable carrier!', "We'll find the route to your heart"],
  de: ['Euroclub — Ihr zuverlässiger Beförderer!', 'Wir finden die Route zu Ihrem Herzen'],
  ru: ['Euroclub — твой надёжный перевозчик!', 'Мы найдём маршрут к твоему сердцу'],
}

function Typewriter() {
  const lang = useLangStore(s => s.lang)
  const taglines = TAGLINES[lang]
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  useEffect(() => {
    const full = taglines[idx % taglines.length]
    let i = 0
    const speed = Math.max(24, Math.floor(2000 / full.length)) // ~2с на друк
    const typer = setInterval(() => {
      i++
      setText(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(typer)
        setTimeout(() => setIdx(p => (p + 1) % taglines.length), 3000) // тримаємо ~3с → 5с на фразу
      }
    }, speed)
    return () => clearInterval(typer)
  }, [idx])
  return <span>{text}<span style={{ opacity: 0.4, fontWeight: 400 }}>|</span></span>
}

export default function Home() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const nav = useNavigate()
  const { from, to, dateFrom, dateTo, isOpenReturn, roundTripWanted, passengerCount, setDateFrom, setDateTo, setOpenReturn, setRoundTripWanted, swap } = useSearchStore()
  const [cityField, setCityField] = useState<'from'|'to'>('from')
  const [showCity, setShowCity] = useState(false)
  const [showDateFrom, setShowDateFrom] = useState(false)
  const [showDateTo, setShowDateTo] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const days = WEEKDAYS_SUN[useLangStore.getState().lang]
    return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
  }

  const canSearch = !!from && !!to && !!dateFrom && (!roundTripWanted || !!dateTo || isOpenReturn)

  // ── наскрізний патерн: підсвітка наступного кроку + підказка про незаповнене ──
  const [tried, setTried] = useState(false)
  const nextField: 'from' | 'to' | 'dateFrom' | 'dateTo' | null =
    !from ? 'from' : !to ? 'to' : !dateFrom ? 'dateFrom'
      : (roundTripWanted && !dateTo && !isOpenReturn) ? 'dateTo' : null
  const missingMsg =
    nextField === 'from' ? t('home.chooseCity') + ' (' + t('home.from') + ')' :
    nextField === 'to' ? t('home.chooseCity') + ' (' + t('home.to') + ')' :
    nextField === 'dateFrom' ? 'Оберіть дату відправлення' :
    nextField === 'dateTo' ? 'Оберіть дату повернення' : ''
  const ring = (f: 'from' | 'to' | 'dateFrom' | 'dateTo') =>
    nextField === f
      ? { border: `1.5px solid ${ORange}`, background: '#FFF7EC', boxShadow: '0 0 0 3px rgba(245,166,35,0.12)' }
      : {}

  return (
    <div style={{ minHeight: '100vh', background: '#F0F0F0', paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ width: '100%', position: 'relative', lineHeight: 0 }}>
        <img src="/bus-hero.png" alt="EuroClub — автобусні квитки Україна — Європа" style={{ width: '100%', height: 'auto', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.background = '#1B4F8A' }} />
      </div>

      {/* Search Card */}
      <div style={{ margin: '-30px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', position: 'relative', zIndex: 10 }}>
        {/* From */}
        <button onClick={() => { setCityField('from'); setShowCity(true) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10, ...ring('from') }}>
          <Navigation size={18} color={ORange} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {from?.name && <div style={{ fontSize: 11, color: Gray }}>{t('home.from')}</div>}
            <div style={{ fontSize: 16, color: from?.name ? '#1A1A1A' : Gray, fontWeight: from?.name ? 600 : 400 }}>{from?.name || t('home.from')}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); swap() }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ArrowUpDown size={20} color={ORange} />
          </button>
        </button>

        {/* To */}
        <button onClick={() => { setCityField('to'); setShowCity(true) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10, ...ring('to') }}>
          <MapPin size={18} color={Gray} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {to?.name && <div style={{ fontSize: 11, color: Gray }}>{t('home.to')}</div>}
            <div style={{ fontSize: 16, color: to?.name ? '#1A1A1A' : Gray, fontWeight: to?.name ? 600 : 400 }}>{to?.name || t('home.to')}</div>
          </div>
        </button>

        {/* Дата виїзду — окремим рядком */}
        <button onClick={() => setShowDateFrom(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 10, ...ring('dateFrom') }}>
          <Calendar size={16} color={Gray} />
          <div style={{ textAlign: 'left' }}>
            {dateFrom && <div style={{ fontSize: 11, color: Gray }}>{t('home.dateFrom')}</div>}
            <div style={{ fontSize: 14, color: dateFrom ? '#1A1A1A' : Gray, fontWeight: dateFrom ? 600 : 400 }}>{dateFrom ? fmtDate(dateFrom) : t('home.dateFrom')}</div>
          </div>
        </button>

        {/* Зворотній квиток — чекбокс і поле дати назад в один рядок.
            Якщо зняти галочку — обрана дата назад і "відкрита дата" скидаються (без напівстану). */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setRoundTripWanted(!roundTripWanted)} style={{
            flex: 1, padding: '12px 14px',
            background: roundTripWanted ? '#FFF3DC' : '#F9F9F9',
            border: roundTripWanted ? `1.5px solid ${ORange}` : '1px solid #EEE',
            borderRadius: 14, display: 'flex', gap: 10, alignItems: 'center',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${roundTripWanted ? ORange : '#DDD'}`,
              background: roundTripWanted ? ORange : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {roundTripWanted && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: roundTripWanted ? ORange : '#555' }}>Зворотній квиток</span>
          </button>

          {/* Date To — доступне лише коли увімкнено "Зворотній квиток"; якщо відкрита дата
              активна, клік не відкриває календар (нема що там гортати). */}
          <button onClick={() => roundTripWanted && !isOpenReturn && setShowDateTo(true)} disabled={!roundTripWanted} style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px',
            background: '#F9F9F9', borderRadius: 14,
            border: isOpenReturn ? `1.5px solid ${ORange}` : '1px solid #EEE',
            cursor: roundTripWanted ? 'pointer' : 'default',
            opacity: roundTripWanted ? 1 : 0.5,
            ...ring('dateTo'),
          }}>
            <Calendar size={16} color={isOpenReturn ? ORange : Gray} />
            <div style={{ textAlign: 'left' }}>
              {(dateTo || isOpenReturn) && <div style={{ fontSize: 11, color: isOpenReturn ? ORange : Gray }}>{t('home.dateTo')}</div>}
              <div style={{ fontSize: 14, color: isOpenReturn ? ORange : (dateTo ? '#1A1A1A' : Gray), fontWeight: (dateTo || isOpenReturn) ? 600 : 400 }}>
                {isOpenReturn ? t('results.openDate') : dateTo ? fmtDate(dateTo) : t('home.dateTo')}
              </div>
            </div>
          </button>
        </div>

        {/* Відкрита дата — окремий чекбокс під рядком вище, доступний лише коли "Зворотній
            квиток" увімкнено. Дублює toggle всередині календаря — тут для швидкого доступу
            без відкриття самого календаря. */}
        <button onClick={() => { if (!roundTripWanted) return; setOpenReturn(!isOpenReturn); if (!isOpenReturn) setDateTo('') }} disabled={!roundTripWanted} style={{
          width: '100%', marginBottom: 10, padding: '12px 16px',
          background: isOpenReturn ? '#FFF3DC' : '#F9F9F9',
          border: isOpenReturn ? `1.5px solid ${ORange}` : '1px solid #EEE',
          borderRadius: 14, display: 'flex', gap: 12, alignItems: 'center',
          cursor: roundTripWanted ? 'pointer' : 'default', textAlign: 'left',
          opacity: roundTripWanted ? 1 : 0.5,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            border: `2px solid ${isOpenReturn ? ORange : '#DDD'}`,
            background: isOpenReturn ? ORange : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isOpenReturn && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: isOpenReturn ? ORange : '#555' }}>{t('home.openReturn')}</span>
        </button>

        {/* Passengers */}
        <button onClick={() => setShowPass(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1px solid #EEE', cursor: 'pointer', marginBottom: 16 }}>
          <Users size={18} color={Gray} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            {passengerCount > 0 && <div style={{ fontSize: 11, color: Gray }}>{t('home.passengers')}</div>}
            <div style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 600 }}>{passengerCount}</div>
          </div>
        </button>

        {/* Search button */}
        <button onClick={() => { if (canSearch) nav('/results'); else setTried(true) }} style={{
          width: '100%', padding: 18, background: canSearch ? ORange : '#FFD89B',
          color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800,
          fontSize: 17, cursor: 'pointer', letterSpacing: 0.3
        }}>{t('home.find')}</button>
        {tried && nextField && (
          <div style={{ marginTop: 10, textAlign: 'center', color: '#E53935', fontSize: 13, fontWeight: 600 }}>
            {missingMsg}
          </div>
        )}
      </div>

      <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 12px)', left: 14, zIndex: 20, width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,0.35)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Menu size={22} color="#fff" /></button>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <NotifPrompt />

      {/* Tagline (друкований, чергується) */}
      <div style={{ textAlign: 'center', marginTop: 28, padding: '0 24px', fontSize: 15, fontWeight: 700, color: '#8A8A8A', minHeight: 22 }}>
        <Typewriter />
      </div>

      <CityPicker open={showCity} onClose={() => setShowCity(false)} initialField={cityField} />

      <BottomSheet open={showDateFrom} onClose={() => setShowDateFrom(false)} title={t('home.dateFrom')}>
        <Calendar_ value={dateFrom} onChange={setDateFrom} minDate={new Date().toISOString().split('T')[0]}
          onConfirm={() => setShowDateFrom(false)} />
      </BottomSheet>

      <BottomSheet open={showDateTo} onClose={() => setShowDateTo(false)} title={t('home.dateTo')}>
        <Calendar_ value={dateTo} onChange={setDateTo} minDate={dateFrom || new Date().toISOString().split('T')[0]}
          showOpenDate departureSel={dateFrom}
          isOpen={isOpenReturn} onToggleOpen={setOpenReturn}
          onConfirm={() => setShowDateTo(false)} />
      </BottomSheet>

      <PassengersSheet open={showPass} onClose={() => setShowPass(false)} />
    </div>
  )
}
