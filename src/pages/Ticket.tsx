import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Bus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const Gray = '#9E9E9E'

function splitDateTime(str?: string): { date: string; time: string } {
  if (!str) return { date: '', time: '--:--' }
  const [date, time] = str.split(' ')
  return { date: date || '', time: time || '--:--' }
}

function platformTag() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  return 'WEB'
}

export default function Ticket() {
  const nav = useNavigate()
  const { orderHash, orderData, selectedTrip, selectedSeats, passengerNames } = useBookingStore()
  const trip = selectedTrip as any
  const data = orderData as any

  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const depDT = splitDateTime(data?.ftime || dep?.time)
  const arrDT = splitDateTime(data?.ttime || arr?.time)
  const hasTransfer = Number(trip?.transfer) === 1

  const hash = orderHash || data?.hash || ''
  // Номер замовлення = 000 + системний id (996546) з URL відповіді
  const orderNo = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    if (m) return '000' + m[1]
    return hash ? '000' + hash.slice(-6).toUpperCase() : '000000000'
  })()
  const suffix = platformTag() === 'iOS' ? 'API' : 'PAG' // Android/веб → PAG, iOS → API
  const ticketNo = `Замовлення ${orderNo}`

  // Пасажири: з відповіді замовлення або зі стору
  const paxCount = Math.max(selectedSeats.length, Object.keys(passengerNames).length)
  const passengers = (data?.passangers && data.passangers.length)
    ? data.passangers.map((p: any) => ({ name: p.name, place: p.place, ticket: p.ticket }))
    : Array.from({ length: paxCount }).map((_, i) => ({ name: passengerNames[i] || '—', place: selectedSeats[i], ticket: undefined }))

  const ticketPdf: string = data?.ticket || ''

  const notch = { position: 'absolute' as const, width: 22, height: 22, borderRadius: '50%', background: '#0B2E5E', top: '50%', transform: 'translateY(-50%)' }

  return (
    <div style={{ minHeight: '100vh', background: Navy, padding: '0 0 40px' }}>
      {/* Top bar (не друкується) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 18px) 16px 12px' }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Ваш квиток</span>
      </div>

      {/* Квиток */}
      <div id="eticket" style={{ background: '#fff', margin: '8px 16px', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        {/* Шапка */}
        <div style={{ background: Navy, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>Euro<span style={{ color: ORange }}>Club</span></div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Електронний квиток</div>
        </div>

        {/* Маршрут */}
        <div style={{ padding: '22px 20px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#1A1A1A' }}>{depDT.time}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{dep?.city_ua || dep?.city || data?.from_city}</div>
              <div style={{ fontSize: 12, color: Gray, maxWidth: 130, lineHeight: 1.3 }}>{dep?.name || data?.fstation}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
              <Bus size={20} color={ORange} />
              <div style={{ fontSize: 11, color: Gray, marginTop: 2 }}>{hasTransfer ? 'Пересадка' : 'Прямий'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#1A1A1A' }}>{arrDT.time}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{arr?.city_ua || arr?.city || data?.to_city}</div>
              <div style={{ fontSize: 12, color: Gray, maxWidth: 130, marginLeft: 'auto', lineHeight: 1.3 }}>{arr?.name || data?.tstation}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: Gray }}>Дата відправлення: <strong style={{ color: '#1A1A1A' }}>{depDT.date}</strong></div>
        </div>

        {/* Перфорація */}
        <div style={{ position: 'relative', height: 24, margin: '10px 0' }}>
          <div style={{ ...notch, left: -11 }} />
          <div style={{ ...notch, right: -11 }} />
          <div style={{ position: 'absolute', top: '50%', left: 16, right: 16, borderTop: '2px dashed #E0E0E0' }} />
        </div>

        {/* Пасажири */}
        <div style={{ padding: '4px 20px 12px' }}>
          {passengers.map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < passengers.length - 1 ? '1px solid #F2F2F2' : 'none' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{p.name || '—'}</span>
                {p.ticket && <span style={{ fontSize: 11, color: Gray }}>Квиток № {p.ticket}{suffix}</span>}
              </span>
              <span style={{ fontSize: 13, color: Gray }}>Місце <strong style={{ color: ORange, fontSize: 15 }}>{p.place && p.place !== '0' ? p.place : '—'}</strong></span>
            </div>
          ))}
        </div>

        {/* QR + номер */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px 22px', borderTop: '1px solid #F2F2F2' }}>
          <div style={{ padding: 8, background: '#fff', border: '1px solid #EEE', borderRadius: 12 }}>
            {hash ? <QRCodeSVG value={hash} size={92} level="M" /> : <div style={{ width: 92, height: 92, background: '#F5F5F5' }} />}
          </div>
          <div>
            <div style={{ fontSize: 12, color: Gray }}>Номер квитка</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', letterSpacing: 0.5 }}>{orderNo}</div>
            <div style={{ fontSize: 11, color: Gray, marginTop: 4 }}>{ticketNo}</div>
            <div style={{ fontSize: 11, color: Gray, marginTop: 6, lineHeight: 1.4 }}>Покажіть QR-код водієві під час посадки.</div>
          </div>
        </div>
      </div>

      {/* Дії (не друкуються) */}
      <div className="no-print" style={{ padding: '8px 16px 0' }}>
        <button onClick={() => ticketPdf ? window.open(ticketPdf, '_blank') : window.print()} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Download size={18} /> {ticketPdf ? 'Завантажити квиток (PDF)' : 'Зберегти квиток'}
        </button>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          #eticket { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  )
}
