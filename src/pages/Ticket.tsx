import { useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, Download, ChevronRight } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'
import { ticketAvailable, payInfo, needsPolling, keepOurPrice, passengerDisplayPrices, ensureRoundTripSync } from '../orderStatus'
import { useDisplayPrice } from '../currency'
import { useOrderPolling } from '../useOrderPolling'
import { findUserOrder } from '../api/auth'
import { saveOrderLocally } from '../api/euroclub'
import { ensureCitiesLoaded, getCityNameSync } from '../cityNames'

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
          // Оновлюємо кеш списку "Мої замовлення" тими ж даними, що вже отримали —
          // без жодного додаткового мережевого запиту.
          saveOrderLocally(hash, freshData)
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

  // Завантажуємо мапу міст (id -> назва) для перекладу from1/to1/from2/to2
  const [, forceCityRerender] = useState(0)
  useEffect(() => {
    ensureCitiesLoaded().then(() => forceCityRerender(v => v + 1))
  }, [])

  const [priceReady, setPriceReady] = useState(() => !needsPolling(data))
  useEffect(() => {
    if (priceReady) return
    const timer = setTimeout(() => setPriceReady(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  // ВАЖЛИВО: усі хуки мають викликатись у незмінному порядку на кожному
  // рендері — тому useOrderPolling і useState(activeIdx) стоять тут, ДО
  // умовних `return` нижче. Раніше вони йшли після early return-ів (loading/
  // priceReady), через що React ламав рендер щоразу як умова змінювалась
  // між рендерами ("Показати квиток" відкривав чистий екран/креш).
  useOrderPolling(hash, needsPolling(data), (o) => {
    const merged = keepOurPrice(data, o)
    setBackendData((prev: any) => prev ? keepOurPrice(prev, o) : o)
    setOrderResult(hash, merged)
    saveOrderLocally(hash, merged)
    setPriceReady(true)
  })
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const { format } = useDisplayPrice()

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

  const fromCity = data?.from_city || trip?.departure?.[0]?.city_ua || trip?.departure?.[0]?.city || getCityNameSync(data?.from1) || ''
  const toCity = data?.to_city || trip?.arrival?.[0]?.city_ua || trip?.arrival?.[0]?.city || getCityNameSync(data?.to1) || ''
  // ВАЖЛИВО: реальні поля бекенду — departures1/arrivals1 (з "1"!) для поїздки туди,
  // departures2/arrivals2 для зворотної. Кожен запис несе свою дату — окремо комбінувати
  // з date1/date2 більше не треба.
  const fTime = data?.departures1?.[0]?.time || data?.ftime || trip?.departure?.[0]?.time || ''
  const tTime = data?.arrivals1?.[0]?.time || data?.ttime || trip?.arrival?.[0]?.time || ''
  const fDate = data?.departures1?.[0]?.date || data?.date || data?.date1 || ''
  const tDate = data?.arrivals1?.[0]?.date || data?.date || data?.date1 || ''
  const fStation = data?.departures1?.[0]?.station_name || ''
  const tStation = data?.arrivals1?.[0]?.station_name || ''
  const fTime2 = data?.departures2?.[0]?.time || ''
  const tTime2 = data?.arrivals2?.[0]?.time || ''
  const fDate2 = data?.departures2?.[0]?.date || data?.date2 || ''
  const tDate2 = data?.arrivals2?.[0]?.date || data?.date2 || ''
  const fStation2 = data?.departures2?.[0]?.station_name || ''
  const tStation2 = data?.arrivals2?.[0]?.station_name || ''
  const tripDate = data?.date || data?.date1 || ''
  const currency = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? 'EUR' : 'UAH'

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
  // Round-trip визначаємо НЕ по from2/to2 (вони заповнені навіть для одностороннього —
  // дзеркальні id міст) а по route2/date2/departures2: якщо їх нема — зворотної поїздки нема.
  const isRoundTrip = Boolean(data?.route2) || Boolean(data?.date2) || (Array.isArray(data?.departures2) && data.departures2.length > 0)
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
                  Будь ласка, пред'явіть цей квиток водію під час посадки.
                </div>

                {/* Контент квитка */}
                <div style={{ padding: '20px' }}>

                  {/* Пасажир цього конкретного квитка (не всі разом — кожен пасажир
                      має власний квиток зі своїм номером/QR/ціною) */}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: Gray }}>Пасажир</div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: Gray, marginTop: 2 }}>{p.type || '—'}</div>
                  </div>
                  
                  {/* ПОЇЗДКА 1 */}
                  <div style={{ background: '#F3F4F6', borderRadius: 14, padding: 16, marginBottom: isRoundTrip ? 12 : 20 }}>
                    <div style={{ fontSize: 11, color: '#8A8D93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Туди</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{fromCity || '—'}</div>
                        <div style={{ fontSize: 11.5, color: '#8A8D93', lineHeight: 1.5 }}>
                          {fStation && <div>{fStation}</div>}
                          <div>Виїзд: {fTime || '--:--'}{fDate ? ` · ${fDate}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ padding: '0 10px', alignSelf: 'center' }}>
                        <span style={{ fontSize: 15, color: '#B0B4BB' }}>→</span>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{toCity || '—'}</div>
                        <div style={{ fontSize: 11.5, color: '#8A8D93', lineHeight: 1.5 }}>
                          {tStation && <div>{tStation}</div>}
                          <div>Приїзд: {tTime || '--:--'}{tDate ? ` · ${tDate}` : ''}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 10.5, color: '#8A8D93' }}>Прямий</span>
                    </div>

                    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid #E5E7EB', marginTop: 10, fontSize: 11, color: '#8A8D93' }}>
                      <span>📶 Wi-Fi</span>
                      <span>🔌 Розетки</span>
                      <span>🚻 Туалет</span>
                    </div>

                    <div style={{ fontSize: 13, marginTop: 8 }}>
                      Місце <strong>{String(p.place || '').split('/')[0] || '—'}</strong>
                    </div>
                  </div>

                  {/* ПОЇЗДКА 2 (Якщо round-trip) */}
                  {isRoundTrip && (
                    <div style={{ background: '#F3F4F6', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: '#8A8D93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Назад</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{getCityNameSync(data?.from2) || '—'}</div>
                          <div style={{ fontSize: 11.5, color: '#8A8D93', lineHeight: 1.5 }}>
                            {fStation2 && <div>{fStation2}</div>}
                            <div>Виїзд: {fTime2 || '--:--'}{fDate2 ? ` · ${fDate2}` : ''}</div>
                          </div>
                        </div>
                        <div style={{ padding: '0 10px', alignSelf: 'center' }}>
                          <span style={{ fontSize: 15, color: '#B0B4BB' }}>→</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{getCityNameSync(data?.to2) || '—'}</div>
                          <div style={{ fontSize: 11.5, color: '#8A8D93', lineHeight: 1.5 }}>
                            {tStation2 && <div>{tStation2}</div>}
                            <div>Приїзд: {tTime2 || '--:--'}{tDate2 ? ` · ${tDate2}` : ''}</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 10.5, color: '#8A8D93' }}>Прямий</span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid #E5E7EB', marginTop: 10, fontSize: 11, color: '#8A8D93' }}>
                        <span>📶 Wi-Fi</span>
                        <span>🔌 Розетки</span>
                        <span>🚻 Туалет</span>
                      </div>

                      <div style={{ fontSize: 13, marginTop: 8 }}>
                        {(() => {
                          const parts = String(p.place || '').split('/')
                          const seat = parts.length > 1 ? parts[1] : parts[0]
                          return <>Місце <strong>{seat || '—'}</strong></>
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Ціна цього конкретного квитка */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, borderTop: '1px solid #E5E5E5' }}>
                    <span style={{ fontSize: 13, color: Gray }}>Ціна квитка</span>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>{format(p.price || 0)} {currency}</span>
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {/* Сума і кнопки */}
      <div className="no-print" style={{ padding: '24px 16px 16px', background: Navy }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Ціна квитка</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{format(passengers[activeIdx]?.price || 0)} {currency}</div>
        
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
