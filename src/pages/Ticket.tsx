import { useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'
import { ticketAvailable, payInfo, needsPolling, keepOurPrice, passengerDisplayPrices, ensureRoundTripSync } from '../orderStatus'
import { useDisplayPrice } from '../currency'
import { useOrderPolling } from '../useOrderPolling'
import { findUserOrder } from '../api/auth'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const Gray = '#8A8A8A'

function platformSuffix() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /iphone|ipad|ipod/i.test(ua) ? 'API' : 'PAG'
}

export default function Ticket() {
  const nav = useNavigate()
  const { orderHash, orderData: localOrderData, selectedTrip, selectedSeats, passengerNames, setOrderResult } = useBookingStore()
  const trip = selectedTrip as any
  const hash = orderHash || String(localOrderData?.hash || '')
  
  // Дані з бекенду (пріоритет над store для свіжості)
  const [backendData, setBackendData] = useState<any>(null)
  const [loadingBackend, setLoadingBackend] = useState(true)
  
  // Завантажуємо ПОВНІ дані з бекенду при вході на квиток
  useEffect(() => {
    if (!hash) {
      setLoadingBackend(false)
      return
    }
    const fetchData = async () => {
      try {
        const freshData = await findUserOrder(hash)
        if (freshData) {
          setBackendData(freshData)
          setOrderResult(hash, freshData)
        }
      } catch (e) {
        console.warn('[Ticket] Failed to fetch from backend, using local data')
      } finally {
        setLoadingBackend(false)
      }
    }
    fetchData()
  }, [hash, setOrderResult])

  // Використовуємо дані з бекенду, якщо є, інакше - з store
  const data = backendData || localOrderData || {}

  // Гарантуємо синхронізацію даних про рейс з бекенду
  useEffect(() => {
    if (data && hash) {
      ensureRoundTripSync(data)
    }
  }, [data, hash])

  const [priceReady, setPriceReady] = useState(() => !needsPolling(data))
  useEffect(() => {
    if (priceReady) return
    const timer = setTimeout(() => setPriceReady(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  // Чекаємо завантаження даних з бекенду
  if (loadingBackend) {
    return (
      <div style={{ minHeight: '100vh', background: Navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Чекаємо готовності ціни
  if (!priceReady) {
    return (
      <div style={{ minHeight: '100vh', background: Navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Polling ціни з бекенду
  useOrderPolling(hash, needsPolling(data), (o) => { 
    setBackendData((prev: any) => prev ? keepOurPrice(prev, o) : o)
    setOrderResult(hash, keepOurPrice(data, o))
    setPriceReady(true) 
  })

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
  const orderNo = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\\d+)/)
    const num = m ? m[1] : String(hash || data?.oid || '')
    return num ? num.padStart(9, '0') : '000000000'
  })()

  const fromCity = data?.from_city || trip?.departure?.[0]?.city_ua || trip?.departure?.[0]?.city || ''
  const toCity = data?.to_city || trip?.arrival?.[0]?.city_ua || trip?.arrival?.[0]?.city || ''
  const fTime = data?.ftime || trip?.departure?.[0]?.time || ''
  const tTime = data?.ttime || trip?.arrival?.[0]?.time || ''
  const tripDate = data?.date || ''
  const currency = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? 'EUR' : 'UAH'
  const { format } = useDisplayPrice()

  const rawPax = data?.passengers?.length ? data.passengers : data?.passangers
  const paxCount = Math.max(selectedSeats.length, Object.keys(passengerNames).length, 1)
  let passengers = (rawPax && rawPax.length)
    ? rawPax.map((p: any) => ({ name: p.name, place: p.plc ?? p.place, ticket: p.tck ?? p.ticket, price: p.prc ?? p.price, type: p.dsc }))
    : Array.from({ length: paxCount }).map((_, i) => ({ name: passengerNames[i] || '—', place: selectedSeats[i], ticket: undefined, price: data?.summ ?? data?.price, type: '—' }))
  
  {
    const liveSumm = Number(data?.summ ?? data?.price ?? 0)
    const split = passengerDisplayPrices(liveSumm, passengers)
    passengers = passengers.map((p: any, i: number) => ({ ...p, price: split[i] }))
  }

  const ticketPdf: string = data?.ticket_pdf || ''
  const isRoundTrip = data?.plc && (data.plc.includes('/') || data.plc.includes('47'))

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
    <div style={{ minHeight: '100vh', background: Navy, paddingBottom: 24 }}>
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

      <div ref={scrollerRef} onScroll={handleScroll} className="no-scrollbar" style={{ display: 'flex', overflowX: hasMultiple ? 'auto' : 'visible', scrollSnapType: hasMultiple ? 'x mandatory' : 'none', WebkitOverflowScrolling: 'touch' }}>
        {passengers.map((p: any, i: number) => {
          const qrValue = p.ticket ? `https://eclub.com.ua/ua/user/ticket/${p.ticket}/` : (hash || orderNo)
          const ticketNo = p.ticket ? `${p.ticket}${suffix}` : orderNo
          return (
            <div key={i} style={{ width: '100%', flexShrink: 0, scrollSnapAlign: 'center', padding: '0 16px' }}>
              <div id={`eticket-${i}`} style={{ background: '#fff', margin: '8px 0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
                
                {/* Шапка */}
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

                {/* Примітка */}
                <div style={{ padding: '12px 20px', background: '#FFF9EF', fontSize: 12, color: '#7A5A16', lineHeight: 1.5 }}>
                  Будь ласка, пред'явіть цей квиток водію під час посадки. Квиток поверненню не підлягає.
                </div>

                {/* Контент квитка */}
                <div style={{ padding: '20px' }}>
                  
                  {/* ПОЇЗДКА 1 */}
                  <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: isRoundTrip ? '1px solid #E0E0E0' : 'none' }}>
                    <div style={{ fontSize: 12, color: Gray, marginBottom: 8 }}>Поїздка 1</div>
                    
                    {/* Маршрут */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{fromCity} → {toCity}</div>
                      <div style={{ fontSize: 12, color: Gray }}>{tripDate}</div>
                    </div>

                    {/* Інформація про рейс */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: Gray, marginBottom: 4 }}>Інформація про поїздку</div>
                      <div style={{ fontSize: 13 }}>
                        Прямий рейс · Виїзд: {fTime} · Приїзд: {tTime}
                      </div>
                    </div>

                    {/* Місця пасажирів */}
                    <div>
                      <div style={{ fontSize: 12, color: Gray, marginBottom: 6 }}>Місця пасажирів</div>
                      {passengers.map((pp: any, pi: number) => (
                        <div key={pi} style={{ fontSize: 12, marginBottom: pi < passengers.length - 1 ? 4 : 0 }}>
                          🚪 {pp.name} — Місце {pp.place || '—'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ПОЇЗДКА 2 (Якщо round-trip) */}
                  {isRoundTrip && (
                    <div>
                      <div style={{ fontSize: 12, color: Gray, marginBottom: 8 }}>Поїздка 2 (Зворотня)</div>
                      
                      {/* Маршрут */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{toCity} → {fromCity}</div>
                        <div style={{ fontSize: 12, color: Gray }}>Відкрита дата</div>
                      </div>

                      {/* Інформація про рейс */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: Gray, marginBottom: 4 }}>Інформація про поїздку</div>
                        <div style={{ fontSize: 13 }}>
                          З пересадкою в Ліпську (A) · Виїзд: {data?.ftime2 || '—'} · Приїзд: {data?.ttime2 || '—'}
                        </div>
                      </div>

                      {/* Місця пасажирів */}
                      <div>
                        <div style={{ fontSize: 12, color: Gray, marginBottom: 6 }}>Місця пасажирів</div>
                        <div style={{ fontSize: 12, color: Gray }}>Не визначені</div>
                      </div>
                    </div>
                  )}

                  {/* Пасажир информация */}
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #E0E0E0' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Пасажир {i + 1}</div>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: Gray, marginBottom: 8 }}>{p.type || '—'}</div>
                    <div style={{ fontSize: 13 }}>Ціна: {format(p.price || 0)} {currency}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Сума і кнопки */}
      <div className="no-print" style={{ padding: '24px 16px 16px', background: Navy }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Всього</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{format(data?.summ ?? data?.price ?? 0)} {currency}</div>
        
        {ticketPdf && (
          <button onClick={() => window.open(ticketPdf)} style={{ width: '100%', padding: '12px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Download size={18} /> Завантажити PDF
          </button>
        )}
        
        <button onClick={() => { const html = document.getElementById(`eticket-${activeIdx}`); if (html) window.print() }} style={{ width: '100%', padding: '12px', background: '#fff', color: Navy, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Відкрити електронний квиток
        </button>
      </div>

      {/* Нижнє меню - фіксоване */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'center', gap: 24, padding: '12px 0', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 100 }}>
        <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Gray, fontSize: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🔍</div>Пошук
        </button>
        <button onClick={() => nav('/tickets')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ORange, fontSize: 12, fontWeight: 600 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎫</div>Квитки
        </button>
        <button onClick={() => nav('/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Gray, fontSize: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>👤</div>Профіль
        </button>
        <button onClick={() => nav('/notifications')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Gray, fontSize: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🔔</div>Сповіщення
        </button>
      </div>
    </div>
  )
}
