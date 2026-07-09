import { useState } from 'react'
import { X } from 'lucide-react'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

interface Seat {
  nmr: number
  free: boolean  // true = вільне (free:1 в API), false = зайняте (free:0)
  isWC?: boolean
}

interface Props {
  trip: any
  totalPax: number
  onClose: () => void
  onConfirm: (seats: number[]) => void
}

// Parse real EuroClub places_map: {"floor": {"row": {"col": {nmr, free} | {type:"wc"} | []}}}
function parsePlacesMap(placesMap: any): Array<Array<Seat | null>> {
  if (!placesMap || typeof placesMap !== 'object' || Array.isArray(placesMap)) return []

  // floors = {"1": {...rows...}}
  const floors = Object.values(placesMap)
  if (floors.length === 0) return []

  // Use first floor only (single-deck buses)
  const floor = floors[0] as Record<string, Record<string, any>>
  const rows: Array<Array<Seat | null>> = []

  // rows sorted numerically
  const rowKeys = Object.keys(floor).sort((a, b) => Number(a) - Number(b))

  for (const rk of rowKeys) {
    const rowObj = floor[rk] as Record<string, any>
    // cols: "1"=left-window, "2"=left-aisle, "3"=aisle(empty), "4"=right-aisle, "5"=right-window
    const cols = Object.keys(rowObj).sort((a, b) => Number(a) - Number(b))
    const rowSeats: Array<Seat | null> = []

    for (const ck of cols) {
      const cell = rowObj[ck]
      if (!cell || Array.isArray(cell)) {
        rowSeats.push(null) // empty / aisle
      } else if (cell.type === 'wc') {
        rowSeats.push({ nmr: -1, free: false, isWC: true })
      } else if (typeof cell.nmr === 'number') {
        rowSeats.push({ nmr: cell.nmr, free: cell.free === 1 })
      } else {
        rowSeats.push(null)
      }
    }
    rows.push(rowSeats)
  }
  return rows
}

// Build default layout by total seat count
// Layout: col0=left-window, col1=left-aisle, [aisle], col2=right-aisle, col3=right-window
// Numbering: 2,1 | 3,4 | 6,5 | 7,8 ... last row: if odd total → 5 seats across, center last
function buildDefaultLayout(totalSeats: number): Array<Array<Seat | null>> {
  const rows: Array<Array<Seat | null>> = []
  const isOdd = totalSeats % 2 !== 0
  // regular rows: 4 seats each
  const regularRows = Math.floor(totalSeats / 4)
  const remainder = totalSeats % 4

  let n = 1
  for (let r = 0; r < regularRows; r++) {
    // left: nmr 2r+2 (window), 2r+1 (aisle) — right: 2r+3 (aisle), 2r+4 (window)
    const leftAisle = n++
    const leftWin = n++
    const rightAisle = n++
    const rightWin = n++
    rows.push([
      { nmr: leftWin, free: true },
      { nmr: leftAisle, free: true },
      null, // aisle
      { nmr: rightAisle, free: true },
      { nmr: rightWin, free: true },
    ])
  }

  // last row
  if (isOdd) {
    // 5 seats across: left2, left1, center, right1, right2 + last seat in center
    const lastRow: Array<Seat | null> = []
    for (let i = 0; i < 4; i++) lastRow.push({ nmr: n++, free: true })
    lastRow.push({ nmr: n++, free: true }) // center
    rows.push(lastRow)
  } else if (remainder > 0) {
    // even, remainder 2 → last normal row
    const lastRow: Array<Seat | null> = [
      { nmr: n++, free: true },
      { nmr: n++, free: true },
      null,
      null,
      null,
    ]
    rows.push(lastRow)
  }

  return rows
}

// Місце №3 завжди недоступне — резерв водія (незалежно від того, що каже API)
function blockDriverSeat(rows: Array<Array<Seat | null>>): Array<Array<Seat | null>> {
  return rows.map(row => row.map(seat => (seat && !seat.isWC && seat.nmr === 3) ? { ...seat, free: false } : seat))
}

function seatWord(n: number) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'обране місце'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'обрані місця'
  return 'обраних місць'
}

interface Props2 extends Props { totalPrice?: number; currencySign?: string }

export default function SeatMap({ trip, totalPax, onClose, onConfirm, totalPrice, currencySign = '₴' }: Props2) {
  const [selected, setSelected] = useState<number[]>([])

  const placesMap = trip?.places_map
  const totalSeats = Number(trip?.places || 0)

  let rows = parsePlacesMap(placesMap)
  if (rows.length === 0 && totalSeats > 0) rows = buildDefaultLayout(totalSeats)
  else if (rows.length === 0) rows = buildDefaultLayout(50)
  rows = blockDriverSeat(rows)

  const displayPrice = totalPrice != null ? totalPrice : totalPax * Number(trip?.price || 0)
  const priceStr = Number(displayPrice).toFixed(2).replace('.', ',')
  const enough = selected.length === totalPax

  const toggleSeat = (nmr: number, free: boolean) => {
    if (!free) return
    setSelected(prev =>
      prev.includes(nmr)
        ? prev.filter(n => n !== nmr)
        : prev.length < totalPax ? [...prev, nmr] : prev
    )
  }

  const renderCell = (seat: Seat | null, key: string) => {
    if (!seat) return <div key={key} style={{ width: 48, height: 48 }} />
    if (seat.isWC) return (
      <div key={key} style={{ width: 48, height: 48, borderRadius: 12, background: '#F1F1F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#B5B5B5' }}>🚻</div>
    )
    const isSel = selected.includes(seat.nmr)
    const isFree = seat.free
    return (
      <button key={key} onClick={() => toggleSeat(seat.nmr, isFree)} disabled={!isFree} style={{
        width: 48, height: 48, borderRadius: 12,
        border: isSel ? 'none' : isFree ? `2px solid ${ORange}` : '2px solid #F1F1F1',
        background: isSel ? ORange : isFree ? '#fff' : '#F1F1F1',
        cursor: isFree ? 'pointer' : 'default',
        fontWeight: 700, fontSize: 14,
        color: isSel ? '#fff' : isFree ? '#1A1A1A' : '#C4C4C4',
        flexShrink: 0,
      }}>{seat.nmr}</button>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, height: '100%', zIndex: 400, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Розмита hero-шапка */}
      <div style={{ position: 'relative', height: 120, flexShrink: 0, overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px) brightness(0.8)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.35)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>Виберіть місця</span>
          <button onClick={onClose} aria-label="Закрити" style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        </div>
        <div style={{ position: 'absolute', left: 20, bottom: 26, color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 500 }}>
          Оберіть {totalPax} {(() => { const m10 = totalPax % 10, m100 = totalPax % 100; if (m10 === 1 && m100 !== 11) return 'місце'; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'місця'; return 'місць' })()}
        </div>
      </div>

      {/* Білий лист */}
      <div style={{ marginTop: -18, background: '#fff', borderRadius: '20px 20px 0 0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 16px' }}>
          {/* Кермо (водій) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EDEDED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="2.4" />
                <line x1="12" y1="3.2" x2="12" y2="9.6" />
                <line x1="4.3" y1="16.6" x2="9.9" y2="13.3" />
                <line x1="19.7" y1="16.6" x2="14.1" y2="13.3" />
              </svg>
            </div>
          </div>

          {/* Попередження: перший ряд (місця 1-4) заборонений дітям і тваринам */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FFF9EF', borderRadius: 10, padding: '8px 10px', marginBottom: 14, fontSize: 11, lineHeight: 1.4, color: '#7A5A16' }}>
            <span style={{ fontSize: 13 }}>⚠️</span>
            <span>Місця 1–4 (перший ряд) — згідно з законодавством заборонено дітям до 16 років та пасажирам з тваринами.</span>
          </div>

          {/* Сітка місць */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row, ri) => {
              const isWideRow = row.length === 5 && row[2] !== null
              if (isWideRow) {
                return (
                  <div key={ri} style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {row.map((seat, ci) => renderCell(seat, `${ri}-${ci}`))}
                  </div>
                )
              }
              const left = [row[0], row[1]]
              const right = [row[3], row[4]]
              return (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {left.map((seat, ci) => renderCell(seat, `${ri}-L${ci}`))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {right.map((seat, ci) => renderCell(seat, `${ri}-R${ci}`))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Футер */}
        <div style={{ borderTop: '1px solid #EEE', padding: '12px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: Gray }}>
              {selected.length > 0 ? `${selected.length} ${seatWord(selected.length)}` : `Оберіть місце (0/${totalPax})`}
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>{priceStr} {currencySign}</span>
          </div>
          <button onClick={() => enough && onConfirm(selected)} disabled={!enough} style={{
            width: '100%', padding: 16, background: enough ? ORange : '#FFD89B', color: '#fff',
            border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: enough ? 'pointer' : 'default',
          }}>Обрати{!enough ? ` (${selected.length}/${totalPax})` : ''}</button>
        </div>
      </div>
    </div>
  )
}
