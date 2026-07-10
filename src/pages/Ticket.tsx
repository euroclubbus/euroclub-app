import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'
import { ticketAvailable, payInfo, needsPolling } from '../orderStatus'
import { useDisplayPrice } from '../currency'
import { useOrderPolling } from '../useOrderPolling'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const Gray = '#8A8A8A'

function platformSuffix() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /iphone|ipad|ipod/i.test(ua) ? 'API' : 'PAG' // iOS → API, Android/веб → PAG
}

export default function Ticket() {
  const nav = useNavigate()
  const { orderHash, orderData, selectedTrip, selectedSeats, passengerNames, setOrderResult } = useBookingStore()
  const trip = selectedTrip as any
  const data = orderData as any
  const hash = orderHash || data?.hash || ''
  // Ціну на замовлення менеджер може змінити вручну — поки не оплачено повністю,
  // звіряємо з сервером кожні 1.5с, щоб цифри на екрані завжди були актуальні.
  useOrderPolling(hash, needsPolling(data), (o) => setOrderResult(hash, o))

  // Квиток доступний лише після оплати
  if (data && !ticketAvailable(data, hash)) {
    return (
      <div style={{ minHeight: '100vh', background: Navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Квиток ще недоступний</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5, marginBottom: 24, maxWidth: 300 }}>Квиток з'явиться одразу після оплати замовлення.</div>
        <button onClick={() => nav('/payment')} style={{ padding: '14px 28px', background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Перейти до оплати</button>
      </div>
    )
  }

  const suffix = platformSuffix()

  // Номер замовлення = 000 + системний id з URL
  const orderNo = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    if (m) return '000' + m[1]
    return hash ? '000' + hash.slice(-6).toUpperCase() : '000000000'
  })()

  // Рейс
  const fromCity = data?.from_city || trip?.departure?.[0]?.city_ua || trip?.departure?.[0]?.city || ''
  const toCity = data?.to_city || trip?.arrival?.[0]?.city_ua || trip?.arrival?.[0]?.city || ''
  const fStation = data?.fstation || trip?.departure?.[0]?.name || ''
  const tStation = data?.tstation || trip?.arrival?.[0]?.name || ''
  const fTime = data?.ftime || trip?.departure?.[0]?.time || ''
  const tTime = data?.ttime || trip?.arrival?.[0]?.time || ''
  const currency = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? 'EUR' : 'UAH'
  const { format } = useDisplayPrice()

  // Пасажири
  const paxCount = Math.max(selectedSeats.length, Object.keys(passengerNames).length, 1)
  const passengers = (data?.passangers && data.passangers.length)
    ? data.passangers.map((p: any) => ({ name: p.name, place: p.place, ticket: p.ticket, price: p.price }))
    : Array.from({ length: paxCount }).map((_, i) => ({ name: passengerNames[i] || '—', place: selectedSeats[i], ticket: undefined, price: data?.summ ?? data?.price }))

  const ticketPdf: string = data?.ticket || ''
  const notch = { position: 'absolute' as const, width: 22, height: 22, borderRadius: '50%', background: Navy, top: '50%', transform: 'translateY(-50%)' }

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const hasMultiple = passengers.length > 1

  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIdx(Math.max(0, Math.min(passengers.length - 1, idx)))
  }

  return (
    <div style={{ minHeight: '100vh', background: Navy, padding: '0 0 40px' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 18px) 16px 12px' }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{hasMultiple ? `Ваші квитки (${passengers.length})` : 'Ваш квиток'}</span>
      </div>

      {hasMultiple && (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginBottom: 6 }}>
          Проведіть, щоб побачити інший квиток <ChevronRight size={14} />
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="no-scrollbar"
        style={{
          display: 'flex', overflowX: hasMultiple ? 'auto' : 'visible', scrollSnapType: hasMultiple ? 'x mandatory' : 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {passengers.map((p: any, i: number) => {
          const qrValue = p.ticket ? `https://eclub.com.ua/ua/user/ticket/${p.ticket}/` : (hash || orderNo)
          const ticketNo = p.ticket ? `${p.ticket}${suffix}` : orderNo
          return (
            <div key={i} style={{ width: '100%', flexShrink: 0, scrollSnapAlign: 'center', padding: '0 16px' }}>
              <div id={`eticket-${i}`} style={{ background: '#fff', margin: '8px 0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
                {/* Шапка: Ticket № / Order # + QR */}
                <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid #F0F0F0' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A' }}>Ticket {ticketNo}</div>
                    <div style={{ fontSize: 13, color: Gray, marginTop: 2 }}>Order #{orderNo}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginTop: 10 }}>Euro<span style={{ color: ORange }}>Club</span></div>
                  </div>
                  <div style={{ padding: 6, background: '#fff', border: '1px solid #EEE', borderRadius: 10 }}>
                    <QRCodeSVG value={qrValue} size={78} level="M" />
                  </div>
                </div>

                {/* Примітка водію */}
                <div style={{ padding: '12px 20px', background: '#FFF9EF', fontSize: 12, color: '#7A5A16', lineHeight: 1.5 }}>
                  Будь ласка, пред'явіть цей квиток водію під час посадки. Квиток поверненню не підлягає.
                </div>

                {/* Перфорація */}
                <div style={{ position: 'relative', height: 24, margin: '4px 0' }}>
                  <div style={{ ...notch, left: -11 }} />
                  <div style={{ ...notch, right: -11 }} />
                  <div style={{ position: 'absolute', top: '50%', left: 16, right: 16, borderTop: '2px dashed #E0E0E0' }} />
                </div>

                {/* Рейс */}
                <div style={{ padding: '4px 20px 8px' }}>
                  <div style={{ fontSize: 13, color: Gray, marginBottom: 10 }}>Дата відправлення: <strong style={{ color: '#1A1A1A' }}>{(fTime || '').split(' ')[0]}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{(fTime || '').split(' ')[1] || ''}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{fromCity}</div>
                      <div style={{ fontSize: 11, color: Gray, lineHeight: 1.3 }}>{fStation}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{(tTime || '').split(' ')[1] || ''}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{toCity}</div>
                      <div style={{ fontSize: 11, color: Gray, lineHeight: 1.3 }}>{tStation}</div>
                    </div>
                  </div>
                </div>

                {/* Пасажир цього квитка + тариф */}
                <div style={{ padding: '10px 20px 18px', borderTop: '1px solid #F2F2F2', marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name || '—'}</div>
                      {p.ticket && <div style={{ fontSize: 11, color: Gray }}>Квиток № {p.ticket}{suffix} · Місце {p.place && p.place !== '0' ? p.place : '—'}</div>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{format(passengers.length === 1 ? (data?.summ ?? data?.price) : (p.price ?? data?.summ ?? data?.price), currency)}</div>
                  </div>
                  {!hasMultiple && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTop: '1px solid #EEE' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>Разом</span>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>{format(data?.summ ?? data?.price ?? trip?.price, currency)}</span>
                      </div>
                      {(() => { const pi = payInfo(data); return pi.remainder > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#E07B00' }}>Доплата</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#E07B00' }}>{format(pi.remainder, currency)}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>Оплачено повністю</span>
                        </div>
                      ) })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Індикатор слайдів */}
      {hasMultiple && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4, marginBottom: 4 }}>
          {passengers.map((_: any, i: number) => (
            <div key={i} style={{ width: activeIdx === i ? 18 : 6, height: 6, borderRadius: 3, background: activeIdx === i ? ORange : 'rgba(255,255,255,0.35)', transition: 'all 0.2s' }} />
          ))}
        </div>
      )}

      {/* Загальна сума замовлення (коли квитків декілька) */}
      {hasMultiple && (
        <div className="no-print" style={{ margin: '8px 16px 0', background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>Разом за замовлення</span>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>{format(data?.summ ?? data?.price ?? trip?.price, currency)}</span>
          </div>
          {(() => { const pi = payInfo(data); return pi.remainder > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: '#FFB870', fontSize: 12, fontWeight: 600 }}>Доплата</span>
              <span style={{ color: '#FFB870', fontSize: 13, fontWeight: 700 }}>{format(pi.remainder, currency)}</span>
            </div>
          ) })()}
        </div>
      )}

      <div className="no-print" style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => ticketPdf ? window.open(ticketPdf, '_blank') : window.print()} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Download size={18} /> {ticketPdf ? 'Завантажити PDF' : 'Зберегти квиток'}
        </button>
        <button onClick={() => nav('/ticket-details')} style={{ width: '100%', padding: 16, background: '#fff', color: Navy, border: '1.5px solid #E0E0E0', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          Відкрити електронний квиток
        </button>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
