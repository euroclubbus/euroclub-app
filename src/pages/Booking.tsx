import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, X, Plus } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { useAuthStore } from '../authStore'
import { saveOrderLocally, getOrderInfo } from '../api/euroclub'
import { findTwoWayGroupPrice } from '../priceEngine'
import { convert, useDisplayPrice } from '../currency'
import { getSavedPassengers } from '../savedPassengers'
import { validatePromo, redeemPromo } from '../game/gameApi'
import { applyPromoCode, createOrderNew, NewOrderPassenger } from '../api/auth'
import { reportTrip } from '../reporting'
import BottomSheet from '../components/BottomSheet'
import CurrencyToggle from '../components/CurrencyToggle'
import { useT } from '../i18n'
import SeatMap from './SeatMap'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// Calculate duration from real API "DD.MM.YYYY HH:mm" departure/arrival strings
function calcDuration(depStr?: string, arrStr?: string): string {
  if (!depStr || !arrStr) return ''
  const parse = (s: string) => {
    const [datePart, timePart] = s.split(' ')
    const [d, m, y] = datePart.split('.').map(Number)
    const [h, min] = (timePart || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, min)
  }
  const dep = parse(depStr)
  const arr = parse(arrStr)
  const diffMin = Math.round((arr.getTime() - dep.getTime()) / 60000)
  if (diffMin <= 0) return ''
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m > 0 ? `${h}г ${m}хв` : `${h}г`
}

export default function Booking() {
  const nav = useNavigate()
  const t = useT()
  const { from, to, dateFrom, isOpenReturn, passengerCount, passengerCategories, addPassengerCategory, removePassengerCategoryAt } = useSearchStore()
  const {
    selectedTrip, selectedSeats, selectedTrip2, selectedSeats2,
    passengerNames, passengerDiscounts, contactEmail, contactPhone, payerName, setPayerName,
    setSeats, setSeats2, setPassengerName, setPassengerDiscount, removePassengerDataAt, setContact, setOrderResult
  } = useBookingStore()
  const [savedPassengers] = useState(() => getSavedPassengers())
  const [showSeats, setShowSeats] = useState(false)
  const [showSeats2, setShowSeats2] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trip = selectedTrip as any
  const trip2 = selectedTrip2 as any
  const isRoundTrip = !!trip2
  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const dep2 = trip2?.departure?.[0]
  const arr2 = trip2?.arrival?.[0]
  const totalPax = passengerCount
  // Real discounts come from the selected trip itself (trip.discounts), e.g. id 0 = full fare, 4 = senior, etc.
  const discountOptions: Array<{ id: number; default: number; name: string; discount: number; price: number }> = trip?.discounts || []
  // Повний тариф — першим у списку вибору категорії
  const isFull = (d: any) => d && (d.default === 1 || d.default === '1' || String(d.id) === '0')
  const fullFare: any = discountOptions.find(isFull) || { id: 0, default: 1, name: t('booking.fullFare'), discount: 0, price: Number(trip?.price ?? 0) }
  const orderedDiscounts = [ fullFare, ...discountOptions.filter(d => !isFull(d)) ]
  const catName = (d: any) => d.name && d.name.trim() ? d.name : t('booking.fullFare')
  const [showDiscountFor, setShowDiscountFor] = useState<number | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const { user } = useAuthStore()
  useEffect(() => { if (user?.email && !contactEmail) setContact('email', user.email) }, [user])
  useEffect(() => { if (user?.phone && !contactPhone) setContact('phone', user.phone) }, [user])
  useEffect(() => { if (user?.header && !payerName) setPayerName(user.header) }, [user])

  const removePassenger = (idx: number) => {
    if (totalPax <= 1) return
    removePassengerCategoryAt(idx)
    removePassengerDataAt(idx)
    if (showDiscountFor === idx) setShowDiscountFor(null)
  }
  const addPassenger = (catId: string) => { addPassengerCategory(catId); setShowAddPicker(false) }


  const defaultDiscount = discountOptions.find(d => d.default === 1) || discountOptions[0]
  const { format, displayCurrency } = useDisplayPrice()

  // Знижка пасажира: ручний вибір → категорія зі складу пошуку (якщо діє на рейсі) → повний тариф
  const effectiveDiscountId = (idx: number) => {
    if (passengerDiscounts[idx] != null) return String(passengerDiscounts[idx])
    const catId = passengerCategories[idx]
    if (catId && discountOptions.some(d => String(d.id) === String(catId))) return String(catId)
    return String(defaultDiscount?.id ?? 0)
  }

  const getPassengerPrice = (idx: number) => {
    const discountId = effectiveDiscountId(idx)
    const opt = discountOptions.find(d => String(d.id) === discountId)
    return opt?.price ?? Number(trip?.price ?? 0)
  }

  const subtotal = Array.from({ length: totalPax }, (_, i) => getPassengerPrice(i)).reduce((s, p) => s + p, 0)
  // Ціна другого напрямку (для фолбеку, якщо шаблон не знайдено) — рахуємо по його власних знижках
  const discountOptions2: any[] = trip2?.discounts || []
  const subtotal2 = trip2
    ? Array.from({ length: totalPax }, (_, i) => {
        const discountId = effectiveDiscountId(i)
        const opt = discountOptions2.find((d: any) => String(d.id) === discountId)
        return opt?.price ?? Number(trip2?.price ?? 0)
      }).reduce((s, p) => s + p, 0)
    : 0

  // Двобічна ціна: КОЖЕН пасажир отримує свій тариф в 2 боки окремо (за своєю one-way ціною/знижкою
  // рейсу 1), підсумок — сума цих тарифів. Показуємо юзеру лише один фінальний тариф, без розбивки.
  const direction: 'ua' | 'eu' = from?.i2 === 'ua' ? 'ua' : 'eu'
  const perPassengerOneWay = Array.from({ length: totalPax }, (_, i) => getPassengerPrice(i))
  const twoWayGroup = isRoundTrip && from && to ? findTwoWayGroupPrice(perPassengerOneWay, from.id, to.id, direction) : null
  const total = isRoundTrip ? (twoWayGroup?.total ?? subtotal) : subtotal

  // Промокод (наприклад, приз за гру EuroClub Racer) — знижка застосовується лише в застосунку,
  // на боці eclub.com.ua не існує (поки прогер не додасть офіційне поле для промокодів).
  const [promoInput, setPromoInput] = useState('')
  const [promoApplied, setPromoApplied] = useState<{ code: string; pct: number } | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoError, setPromoError] = useState('')
  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoChecking(true); setPromoError('')
    try {
      const res = await validatePromo(code)
      if (res.valid && res.pct) { setPromoApplied({ code, pct: res.pct }); setPromoError('') }
      else { setPromoApplied(null); setPromoError('Промокод недійсний або вже використаний') }
    } catch { setPromoError('Помилка перевірки промокоду') }
    finally { setPromoChecking(false) }
  }
  const finalTotal = promoApplied ? Math.round(total * (1 - promoApplied.pct / 100)) : total

  // Категорія "тварина" вже є в каталозі знижок з API (не вигадуємо нову) —
  // визначаємо чи вона обрана хоч у когось з пасажирів, щоб показати додатковий чекбокс.
  const hasAnimalPax = Array.from({ length: totalPax }, (_, i) => effectiveDiscountId(i)).some(discountId => {
    const opt = orderedDiscounts.find(d => String(d.id) === discountId) || discountOptions2.find((d: any) => String(d.id) === discountId)
    return opt && /тварин/i.test(catName(opt))
  })
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentAnimal, setConsentAnimal] = useState(false)

  const handleBook = async () => {
    if (!trip || !from || !to) return
    setAttempted(true)
    const missingName = Array.from({ length: totalPax }).some((_, i) => !passengerNames[i]?.trim())
    if (missingName) { setError(t('booking.errorNames')); return }
    if (Number(trip?.place_select) === 1 && selectedSeats.filter((x: any) => x != null).length < totalPax) { setError(t('booking.errorSeatOutbound')); return }
    if (isRoundTrip && Number(trip2?.place_select) === 1 && selectedSeats2.filter((x: any) => x != null).length < totalPax) { setError(t('booking.errorSeatReturn')); return }
    if (!payerName.trim()) { setError("Вкажіть ім'я та прізвище платника"); return }
    if (!contactPhone.trim()) { setError(t('booking.errorPhone')); return }
    if (!consentPrivacy || !consentTerms) { setError(t('booking.errorAgreements')); return }
    if (hasAnimalPax && !consentAnimal) { setError(t('booking.errorAnimal')); return }
    setError('')
    setLoading(true)
    try {
      const currency: 'uah' | 'eur' = /eur/i.test(trip?.currency || 'uah') ? 'eur' : 'uah'
      const passengers: NewOrderPassenger[] = Array.from({ length: totalPax }, (_, i) => ({
        name: (passengerNames[i] || '').trim().toUpperCase(),
        discount: effectiveDiscountId(i),
        place1: selectedSeats[i] != null ? String(selectedSeats[i]) : '',
        place2: isRoundTrip && selectedSeats2[i] != null ? String(selectedSeats2[i]) : undefined,
      }))
      const result: any = await createOrderNew({
        email: contactEmail.trim() || '',
        phone: contactPhone.trim(),
        header: (payerName || passengerNames[0] || '').trim().toUpperCase() || 'PASSENGER',
        price: String(total),
        crc: currency,
        from: String(from.id),
        to: String(to.id),
        route1: String(trip.id).split('-')[0],
        route2: isRoundTrip ? String(trip2.id).split('-')[0] : undefined,
      }, passengers)

      if (result?.err === 0 && result.oid) {
        // УВАГА: нова відповідь дає лише `oid`, не `hash` — ще не перевірено на реальних
        // даних, чи order_info/order_cancel/order_restore приймають oid замість hash.
        // Поки що використовуємо oid скрізь, де раніше був hash — тестуємо на практиці.
        const oid = String(result.oid)
        const bookingDate = new Date().toISOString()
        let order: any = { oid, hash: oid, from_city: from.name, to_city: to.name, bookingDate }
        saveOrderLocally(oid, order)
        setOrderResult(oid, order)

        // Пробуємо одразу підтягнути повні дані замовлення тим самим методом, що й скрізь
        const fresh: any = await getOrderInfo(oid).catch(() => null)
        if (fresh?.orders?.[0]) { order = { ...fresh.orders[0], bookingDate }; setOrderResult(oid, order) }

        if (promoApplied) {
          try {
            const promoRes: any = await applyPromoCode(promoApplied.code, oid)
            if (promoRes?.status === 'ok') {
              redeemPromo(promoApplied.code, oid).catch(() => {})
              const fresh2: any = await getOrderInfo(oid).catch(() => null)
              if (fresh2?.orders?.[0]) { order = { ...fresh2.orders[0], bookingDate }; setOrderResult(oid, order) }
            }
          } catch { /* не критично для успіху бронювання */ }
        }

        // Транзит агрегованих (не персональних) даних для звіту в панелі керування —
        // нічого з цього не зберігається в самому додатку.
        if (user?.id) {
          const ticketNumbers = (order.passangers || []).map((p: any) => String(p.ticket || '')).filter(Boolean)
          reportTrip({
            userId: user!.id,
            orderNo: oid,
            ticketNumbers,
            tripDate: String(order.ftime || '').split(' ')[0],
            direction: `${order.from_city || from?.name || ''} → ${order.to_city || to?.name || ''}`,
            bookingDate,
          })
        }
        nav('/order-success')
      } else {
        // Помилки конкретного відрізка (1 = туди, 2 = назад): зайняті місця / маршрут не
        // знайдено / нема вільних місць / міста недоступні — беремо перше повідомлення, що є.
        const legErr = result?.[1] || result?.[2]
        const msg = legErr
          ? (legErr.err === 21 ? `Місця вже зайняті: ${(legErr.places || []).join(', ')}`
            : legErr.err === 2 ? 'Нема вільних місць на цей рейс'
            : legErr.err === 3 ? 'Ці міста недоступні на цьому рейсі'
            : legErr.err === 1 ? 'Маршрут не знайдено'
            : `код помилки ${legErr.err}`)
          : `код помилки ${result?.err}`
        setError(t('booking.bookingError') + ': ' + msg)
      }
    } catch {
      setError(t('booking.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', paddingBottom: 20 }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 22px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, flex: 1 }}>{t('booking.title')}{isRoundTrip ? t('booking.titleRoundTrip') : ''}</span>
          <CurrencyToggle light />
        </div>
      </div>

      <div style={{ background: '#F5F5F5', minHeight: 'calc(100vh - 60px)', padding: '16px 16px 40px' }}>
        {/* Passengers */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Пасажири</div>
          {Array.from({ length: totalPax }, (_, idx) => {
            const currentDiscountId = effectiveDiscountId(idx)
            const currentDiscount = orderedDiscounts.find(d => String(d.id) === currentDiscountId)
            const isEditing = showDiscountFor === idx
            return (
              <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < totalPax - 1 ? '1px solid #F5F5F5' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Пасажир {idx + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setShowDiscountFor(isEditing ? null : idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isEditing ? ORange : Gray, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Pencil size={15} color={isEditing ? ORange : Gray} />
                      <span style={{ fontSize: 12, color: isEditing ? ORange : Gray }}>Знижка</span>
                    </button>
                    {totalPax > 1 && (
                      <button onClick={() => removePassenger(idx)} aria-label="Видалити пасажира" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={17} color="#C4C4C4" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  placeholder={t('booking.namePlaceholder')}
                  value={passengerNames[idx] || ''}
                  onChange={e => setPassengerName(idx, e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', border: attempted && !passengerNames[idx]?.trim() ? '1.5px solid #E53935' : '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none', marginBottom: 8 }}
                />
                {savedPassengers.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {savedPassengers.map(sp => (
                      <button key={sp.id} onClick={() => setPassengerName(idx, sp.name)} style={{
                        padding: '5px 10px', borderRadius: 14, border: '1px solid #EEE', background: '#FAFAFA',
                        color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>{sp.name}</button>
                    ))}
                  </div>
                )}
                {/* Поточна знижка */}
                {currentDiscount && !isEditing && (
                  <div style={{ fontSize: 13, color: Gray, marginBottom: 4 }}>
                    {currentDiscount.name} — <strong>{format(currentDiscount.price, trip?.currency)}</strong>
                  </div>
                )}
                {/* Редагування знижки */}
                {isEditing && orderedDiscounts.length > 0 && (
                  <div style={{ background: '#F9F9F9', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: Gray, marginBottom: 8, fontWeight: 600 }}>Оберіть категорію:</div>
                    {orderedDiscounts.map(d => (
                      <button key={d.id} onClick={() => { setPassengerDiscount(idx, String(d.id)); setShowDiscountFor(null) }} style={{
                        width: '100%', padding: '10px 14px', background: String(d.id) === currentDiscountId ? '#FFF3DC' : '#fff',
                        border: String(d.id) === currentDiscountId ? `1.5px solid ${ORange}` : '1.5px solid #EEE',
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left', marginBottom: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span style={{ fontSize: 13, fontWeight: String(d.id) === currentDiscountId ? 700 : 400 }}>{catName(d)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ORange }}>{format(d.price, trip?.currency)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Додати пасажира */}
          {!showAddPicker ? (
            <button onClick={() => setShowAddPicker(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', marginTop: 4, background: '#FFF7EC', border: `1.5px dashed ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              <Plus size={17} /> {t('booking.addPassenger')}
            </button>
          ) : (
            <div style={{ background: '#F9F9F9', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: Gray, fontWeight: 600 }}>Оберіть категорію пасажира:</span>
                <button onClick={() => setShowAddPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color={Gray} /></button>
              </div>
              {orderedDiscounts.length === 0 && <div style={{ fontSize: 13, color: Gray, padding: 8 }}>Немає доступних категорій для цього рейсу</div>}
              {orderedDiscounts.map(d => (
                <button key={d.id} onClick={() => addPassenger(String(d.id))} style={{
                  width: '100%', padding: '10px 14px', background: '#fff', border: '1.5px solid #EEE',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', marginBottom: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 13 }}>{catName(d)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ORange }}>{format(d.price, trip?.currency)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Seat selection — only show if place_select === 1 */}
        {Number(trip?.place_select) === 1 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{isRoundTrip ? t('booking.seatOutbound') : t('booking.seatBooking')}</div>
          <button onClick={() => setShowSeats(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1.5px solid #EEE', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>💺</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSeats.length > 0 ? `${t('booking.seatsLabel')}: ${selectedSeats.join(', ')}` : t('booking.chooseSeat')}</div>
              <div style={{ color: Gray, fontSize: 12 }}>{t('booking.goToSeatSelection')}</div>
            </div>
            <span style={{ color: Gray }}>›</span>
          </button>
        </div>
        )}

        {/* Seat selection для зворотного напрямку */}
        {isRoundTrip && Number(trip2?.place_select) === 1 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t('booking.seatReturn')}</div>
          <button onClick={() => setShowSeats2(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1.5px solid #EEE', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>💺</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSeats2.length > 0 ? `${t('booking.seatsLabel')}: ${selectedSeats2.join(', ')}` : t('booking.chooseSeat')}</div>
              <div style={{ color: Gray, fontSize: 12 }}>{t('booking.goToSeatSelection')}</div>
            </div>
            <span style={{ color: Gray }}>›</span>
          </button>
        </div>
        )}

        {/* Contacts */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Дані платника</div>
          {[
            { label: 'Платник (ПІБ)', val: payerName, set: (v: string) => setPayerName(v), placeholder: "Ім'я та прізвище", required: true },
            { label: t('booking.email'), val: contactEmail, set: (v: string) => setContact('email', v), placeholder: 'your@email.com', required: false },
            { label: t('booking.phone'), val: contactPhone, set: (v: string) => setContact('phone', v), placeholder: '+380...', required: true },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '13px 16px', border: attempted && f.required && !f.val.trim() ? '1.5px solid #E53935' : '1.5px solid #EEE', borderRadius: 12, fontSize: 15, outline: 'none' }} />
            </div>
          ))}
        </div>

        {/* Trip summary */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t('booking.yourBooking')}</div>
          {isRoundTrip && <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.outbound')}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 6 }}>
            <span>{dep?.time?.split(' ')[0]} → {arr?.time?.split(' ')[0]}</span>
            <span>⏱ {calcDuration(dep?.time, arr?.time)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{dep?.time?.split(' ')[1]}</div>
              <div style={{ fontSize: 13 }}>{dep?.city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{dep?.name}</div>
            </div>
            <span style={{ fontSize: 24 }}>🚌</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{arr?.time?.split(' ')[1]}</div>
              <div style={{ fontSize: 13 }}>{arr?.city}</div>
              <div style={{ fontSize: 11, color: Gray }}>{arr?.name}</div>
            </div>
          </div>

          {isRoundTrip && (
            <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 6 }}>{t('booking.return')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 6 }}>
                <span>{dep2?.time?.split(' ')[0]} → {arr2?.time?.split(' ')[0]}</span>
                <span>⏱ {calcDuration(dep2?.time, arr2?.time)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{dep2?.time?.split(' ')[1]}</div>
                  <div style={{ fontSize: 13 }}>{dep2?.city}</div>
                  <div style={{ fontSize: 11, color: Gray }}>{dep2?.name}</div>
                </div>
                <span style={{ fontSize: 24 }}>🚌</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{arr2?.time?.split(' ')[1]}</div>
                  <div style={{ fontSize: 13 }}>{arr2?.city}</div>
                  <div style={{ fontSize: 11, color: Gray }}>{arr2?.name}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              <span>{t('booking.total')}{isRoundTrip ? t('booking.totalRoundTrip') : ''}</span>
              <span>{format(total, trip?.currency)}</span>
            </div>
            {promoApplied && (
              <div style={{ textAlign: 'right', color: '#2E7D32', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                Промокод {promoApplied.code} (−{promoApplied.pct}%) буде застосовано одразу після оформлення — орієнтовно {format(finalTotal, trip?.currency)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}>
              <span>{totalPax} {totalPax === 1 ? 'пасажир' : 'пасажири'}</span>
            </div>
          </div>
        </div>

        {/* Промокод */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Промокод</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={promoInput} onChange={e => { setPromoInput(e.target.value); setPromoApplied(null); setPromoError('') }}
              placeholder="Наприклад, EC-XXXXXX" disabled={!!promoApplied}
              style={{ flex: 1, padding: '12px 14px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none' }} />
            {!promoApplied ? (
              <button onClick={applyPromo} disabled={promoChecking || !promoInput.trim()} style={{ padding: '0 20px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: promoChecking ? 0.7 : 1 }}>
                {promoChecking ? '...' : 'Застосувати'}
              </button>
            ) : (
              <button onClick={() => { setPromoApplied(null); setPromoInput('') }} style={{ padding: '0 20px', background: 'none', border: '1.5px solid #EEE', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Прибрати
              </button>
            )}
          </div>
          {promoError && <div style={{ color: '#E53935', fontSize: 12.5, marginTop: 8 }}>{promoError}</div>}
        </div>

        {/* Згоди */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={consentPrivacy} onChange={e => setConsentPrivacy(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: ORange }} />
            <span>
              {t('booking.consentPrivacy')} <span onClick={(e) => { e.preventDefault(); nav('/agreement-privacy') }} style={{ color: ORange, fontWeight: 600, textDecoration: 'underline' }}>{t('booking.consentPrivacyLink')}</span> {t('booking.consentPrivacyRest')}<span style={{ color: '#E53935' }}>*</span>
            </span>
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={consentTerms} onChange={e => setConsentTerms(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: ORange }} />
            <span>
              Я ознайомлений та згоден з умовами оплати, повернення квитків і надання послуг, а також з{' '}
              <span onClick={(e) => { e.preventDefault(); nav('/agreement-offer') }} style={{ color: ORange, fontWeight: 600, textDecoration: 'underline' }}>{t('booking.publicOffer')}</span>{' '}
              <span onClick={(e) => { e.preventDefault(); nav('/agreement-contract') }} style={{ color: ORange, fontWeight: 600, textDecoration: 'underline' }}>{t('booking.carriageContract')}</span> {t('booking.consentTermsRest')}<span style={{ color: '#E53935' }}>*</span>
              <div style={{ marginTop: 6, color: Gray, fontSize: 12, lineHeight: 1.5 }}>
                {t('booking.borderNote')}
              </div>
              <div style={{ marginTop: 6, color: '#C0392B', fontSize: 12, lineHeight: 1.5 }}>
                {t('booking.borderWarning')}
              </div>
              <div style={{ marginTop: 4, color: '#2E7D32', fontSize: 12, lineHeight: 1.5 }}>
                {t('booking.insuranceNote')}
              </div>
            </span>
          </label>

          {hasAnimalPax && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F0F0' }}>
              <input type="checkbox" checked={consentAnimal} onChange={e => setConsentAnimal(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: ORange }} />
              <span>{t('booking.consentAnimal')}<span style={{ color: '#E53935' }}>*</span></span>
            </label>
          )}
        </div>

        {error && (
          <div style={{ background: '#FDECEA', color: '#C62828', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 14 }}>{error}</div>
        )}

        <button onClick={handleBook} disabled={loading} style={{
          width: '100%', padding: 18, background: ORange, color: '#fff',
          border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17,
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1
        }}>{loading ? t('booking.booking') : t('booking.book')}</button>
      </div>

      {/* Seat Map — туди */}
      {showSeats && (
        <SeatMap trip={trip} totalPax={totalPax} totalPrice={convert(subtotal, trip?.currency, displayCurrency)} currencySign={displayCurrency === 'EUR' ? '€' : '₴'} onClose={() => setShowSeats(false)}
          onConfirm={(seats: number[]) => { setSeats(seats); setShowSeats(false) }} />
      )}
      {/* Seat Map — назад */}
      {showSeats2 && trip2 && (
        <SeatMap trip={trip2} totalPax={totalPax} totalPrice={convert(subtotal2, trip2?.currency, displayCurrency)} currencySign={displayCurrency === 'EUR' ? '€' : '₴'} onClose={() => setShowSeats2(false)}
          onConfirm={(seats: number[]) => { setSeats2(seats); setShowSeats2(false) }} />
      )}
    </div>
  )
}
