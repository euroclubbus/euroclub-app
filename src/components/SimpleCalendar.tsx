import { useState } from 'react'
import { useLangStore } from '../langStore'
import { MONTHS, WEEKDAYS_MON } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// Легкий календар-сітка з обмеженням мін/макс дати — використовується там, де вибір
// дати обмежений конкретним діапазоном (напр. фіксація зворотної дати: сьогодні →
// дедлайн 180 днів). Свідомо окремий від Calendar_ у Home.tsx (там своя логіка під
// пошук рейсів, з departureSel/isOpenReturn) — щоб не ризикувати зламати робочий
// флоу пошуку заради підтримки maxDate.
export default function SimpleCalendar({ minDateISO, maxDateISO, valueISO, onSelect }: {
  minDateISO: string
  maxDateISO: string
  valueISO?: string
  onSelect: (iso: string) => void
}) {
  const min = new Date(minDateISO); min.setHours(0, 0, 0, 0)
  const max = new Date(maxDateISO); max.setHours(0, 0, 0, 0)
  const [cur, setCur] = useState(() => {
    const d = valueISO ? new Date(valueISO) : new Date(min)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const lang = useLangStore(s => s.lang)
  const months = MONTHS[lang]
  const days = WEEKDAYS_MON[lang]
  const firstDay = new Date(cur.y, cur.m, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate()
  const cells = Array(offset).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  const selDate = valueISO ? new Date(valueISO) : null; selDate?.setHours(0, 0, 0, 0)

  const atMinMonth = cur.y === min.getFullYear() && cur.m === min.getMonth()
  const atMaxMonth = cur.y === max.getFullYear() && cur.m === max.getMonth()
  const prevMonth = () => { if (!atMinMonth) setCur(c => { const d = new Date(c.y, c.m - 1); return { y: d.getFullYear(), m: d.getMonth() } }) }
  const nextMonth = () => { if (!atMaxMonth) setCur(c => { const d = new Date(c.y, c.m + 1); return { y: d.getFullYear(), m: d.getMonth() } }) }

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{months[cur.m]} {cur.y}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={prevMonth} disabled={atMinMonth} aria-label="Попередній місяць" style={{ background: 'none', border: 'none', cursor: atMinMonth ? 'default' : 'pointer', color: atMinMonth ? '#DDD' : ORange, fontSize: 22, width: 36, height: 36 }}>←</button>
          <button onClick={nextMonth} disabled={atMaxMonth} aria-label="Наступний місяць" style={{ background: 'none', border: 'none', cursor: atMaxMonth ? 'default' : 'pointer', color: atMaxMonth ? '#DDD' : ORange, fontSize: 22, width: 36, height: 36 }}>→</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px 0', marginBottom: 6 }}>
        {days.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 11, color: Gray, paddingBottom: 6 }}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '8px 0' }}>
        {cells.map((day, i) => {
          if (!day) return <span key={i} />
          const d = new Date(cur.y, cur.m, day); d.setHours(0, 0, 0, 0)
          const disabled = d < min || d > max
          const isSel = selDate && d.getTime() === selDate.getTime()
          const iso = `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return (
            <button key={i} disabled={disabled} onClick={() => onSelect(iso)} style={{
              width: 34, height: 34, margin: '0 auto', borderRadius: '50%', border: 'none',
              background: isSel ? ORange : 'transparent',
              color: disabled ? '#DDD' : isSel ? '#fff' : '#1A1A1A',
              fontSize: 14, fontWeight: isSel ? 700 : 500,
              cursor: disabled ? 'default' : 'pointer',
            }}>{day}</button>
          )
        })}
      </div>
    </div>
  )
}
