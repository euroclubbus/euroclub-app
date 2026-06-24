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

export default function SeatMap({ trip, totalPax, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<number[]>([])

  const placesMap = trip?.places_map
  const totalSeats = Number(trip?.places || 0)

  // Use real map if available, fallback to generated layout
  let rows = parsePlacesMap(placesMap)
  if (rows.length === 0 && totalSeats > 0) {
    rows = buildDefaultLayout(totalSeats)
  } else if (rows.length === 0) {
    rows = buildDefaultLayout(50)
  }

  const toggleSeat = (nmr: number, free: boolean) => {
    if (!free) return
    setSelected(prev =>
      prev.includes(nmr)
        ? prev.filter(n => n !== nmr)
        : prev.length < totalPax ? [...prev, nmr] : prev
    )
  }

  const renderCell = (seat: Seat | null, key: string) => {
    if (!seat) return <div key={key} style={{ width: 44, height: 44 }} />
    if (seat.isWC) return (
      <div key={key} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚻</div>
    )
    const isSel = selected.includes(seat.nmr)
    const isFree = seat.free
    return (
      <button key={key} onClick={() => toggleSeat(seat.nmr, isFree)} style={{
        width: 44, height: 44, borderRadius: 10,
        border: isSel ? 'none' : isFree ? `2px solid ${ORange}` : '2px solid #EEE',
        background: isSel ? ORange : '#fff',
        cursor: isFree ? 'pointer' : 'default',
        fontWeight: 700, fontSize: 13,
        color: isSel ? '#fff' : isFree ? '#1A1A1A' : '#CCC',
        flexShrink: 0,
      }}>{seat.nmr}</button>
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, height: '100%', zIndex: 400, background: 'rgba(0,0,0,0.9)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', color: '#fff' }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Виберіть місця</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
      </div>

      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', height: 'calc(100vh - 68px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 4px', color: Gray, fontSize: 14 }}>
          Оберіть {totalPax} {totalPax === 1 ? 'місце' : 'місця'}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, padding: '0 20px 12px' }}>
          {[
            { color: 'transparent', border: `2px solid ${ORange}`, label: 'Вільне' },
            { color: ORange, border: 'none', label: 'Вибране' },
            { color: '#EEE', border: 'none', label: 'Зайняте' },
          ].map((l,i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: l.color, border: l.border }} />
              <span style={{ fontSize: 11, color: Gray }}>{l.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          {/* Steering wheel */}
          <div style={{ marginBottom: 12, fontSize: 26 }}>🎡</div>

          {/* Seat grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, ri) => {
              // row has 4 or 5 cols: [left-win, left-aisle, null(aisle), right-aisle, right-win]
              // or 5-seat last row
              const isWideRow = row.length === 5 && row[2] !== null // last row with center seat
              if (isWideRow) {
                return (
                  <div key={ri} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {row.map((seat, ci) => renderCell(seat, `${ri}-${ci}`))}
                  </div>
                )
              }
              // Normal row: [win, aisle | aisle, win] with gap in middle
              const left = [row[0], row[1]]
              const right = [row[3], row[4]]
              return (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {left.map((seat, ci) => renderCell(seat, `${ri}-L${ci}`))}
                  </div>
                  <div style={{ width: 16 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {right.map((seat, ci) => renderCell(seat, `${ri}-R${ci}`))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Confirm button */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #EEE' }}>
          {selected.length > 0 ? (
            <button onClick={() => onConfirm(selected)} style={{
              width: '100%', padding: 16, background: ORange, color: '#fff',
              border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer'
            }}>
              Підтвердити місця: {selected.join(', ')} ({selected.length}/{totalPax})
            </button>
          ) : (
            <div style={{ textAlign: 'center', color: Gray, fontSize: 14, padding: '8px 0' }}>
              Торкніться вільного місця щоб вибрати
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
