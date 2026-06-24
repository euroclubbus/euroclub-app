import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { createOrder, saveOrderLocally } from '../api/euroclub'
import BottomSheet from '../components/BottomSheet'
import SeatMap from './SeatMap'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// Baggage Sheet
function BaggageSheet({ open, onClose, extra, oversize, setExtra, setOversize }: any) {
  const totalExtra = extra * 79
  const totalOversize = oversize * 119
  return (
    <BottomSheet open={open} onClose={onClose} title="Додати багаж">
      <div style={{ padding: '8px 20px 24px' }}>
        {[
          { label: 'Додатковий багаж', sub: '20 кг (80×50×30 см)', price: '+ 79,00₴', val: extra, set: setExtra },
          { label: 'Наднормовий багаж', sub: '30 кг  240 см (x + y +z)', price: '+ 119,00₴', val: oversize, set: setOversize },
        ].map((item, i) => (
          <div key={i} style={{ border: '1.5px solid #EEE', borderRadius: 14, padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🧳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
              <div style={{ color: Gray, fontSize: 13 }}>{item.sub}</div>
              <div style={{ color: ORange, fontWeight: 700, marginTop: 4 }}>{item.price}</div>
            </div>
            <button onClick={() => item.set(Math.max(0, item.val-1))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #DDD', background: 'none', cursor: 'pointer', fontSize: 18 }}>−</button>
            <span style={{ width: 24, textAlign: 'center', fontWeight: 700 }}>{item.val}</span>
            <button onClick={() => item.set(item.val+1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #DDD', background: 'none', cursor: 'pointer', fontSize: 18 }}>+</button>
          </div>
        ))}
        {(extra > 0 || oversize > 0) && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              <span>Усього</span><span>{totalExtra + totalOversize},00₴</span>
            </div>
            {extra > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}><span>{extra} Додатковий багаж</span><span>{totalExtra},00₴</span></div>}
            {oversize > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}><span>{oversize} Наднормовий багаж</span><span>{totalOversize},00₴</span></div>}
          </div>
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 20, padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Підтвердити</button>
      </div>
    </BottomSheet>
  )
}

// Insurance Sheet (заглушка)
function InsuranceSheet({ open, onClose, passengerCount }: any) {
  const [active, setActive] = useState(0)
  return (
    <BottomSheet open={open} onClose={onClose} title="Страхування пасажирів">
      <div style={{ padding: '8px 20px 32px' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          {Array.from({length: passengerCount}, (_,i) => (
            <button key={i} onClick={() => setActive(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: active===i ? ORange : Gray, borderBottom: active===i ? `2px solid ${ORange}` : 'none', paddingBottom: 4 }}>
              Пасажир {i+1}
            </button>
          ))}
        </div>
        {[
          { label: "Прізвище та ім'я", placeholder: 'Олександр Олійник' },
          { label: 'Контактний телефон', placeholder: '+380 63 281 65 71' },
          { label: 'Серія закордонного паспорту', placeholder: 'WH' },
          { label: 'Номер закордонного паспорту', placeholder: 'WH765864' },
          { label: 'Адреса місця прописки', placeholder: 'Україна м.Київ вул. Симона Петлюри 32' },
          { label: 'Дата народження', placeholder: '22.11.1999' },
          { label: 'Індифікаційний код', placeholder: '1234567891' },
          { label: 'Вид страхового поліса', placeholder: 'Туристичний' },
        ].map((f, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 6 }}>{f.label}</label>
            <input placeholder={f.placeholder} style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 15, outline: 'none' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 6 }}>Старт страховки</label>
            <input type="date" style={{ width: '100%', padding: '13px 12px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 6 }}>Кінець страховки</label>
            <input type="date" style={{ width: '100%', padding: '13px 12px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none' }} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14 }}>Я даю згоду на обробку персональних даних.</span>
        </label>
        <button onClick={() => { alert('Заявку прийнято! Ми зв\'яжемося з вами найближчим часом.'); onClose() }} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          Подати заявку на страхування
        </button>
      </div>
    </BottomSheet>
  )
}

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
  const { from, to, dateFrom, passengerCount } = useSearchStore()
  const { selectedTrip, selectedSeats, passengerNames, passengerDiscounts, contactEmail, contactPhone, contactPhone2, promoCode, setSeats, setPassengerName, setPassengerDiscount, setContact, setPromo, setOrderResult } = useBookingStore()
  const [showSeats, setShowSeats] = useState(false)
  const [showBaggage, setShowBaggage] = useState(false)
  const [showInsurance, setShowInsurance] = useState(false)
  const [extraBag, setExtraBag] = useState(0)
  const [oversizeBag, setOversizeBag] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trip = selectedTrip as any
  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const totalPax = passengerCount
  // Real discounts come from the selected trip itself (trip.discounts), e.g. id 0 = full fare, 4 = senior, etc.
  const discountOptions: Array<{ id: number; default: number; name: string; discount: number; price: number }> = trip?.discounts || []
  const [showDiscountFor, setShowDiscountFor] = useState<number | null>(null)
  const [promoTab, setPromoTab] = useState<'promo'|'cashback'>('promo')
  const [promoMsg, setPromoMsg] = useState('')

  const handleActivatePromo = () => {
    if (!promoCode.trim()) return
    // Заглушка — реальна перевірка буде через API
    setPromoMsg('Промокод не активний або термін його дії закінчився')
  }

  const defaultDiscount = discountOptions.find(d => d.default === 1) || discountOptions[0]
  const currencySign = (trip?.currency || 'uah').toLowerCase() === 'eur' ? '€' : '₴'

  const getPassengerPrice = (idx: number) => {
    const discountId = passengerDiscounts[idx] ?? String(defaultDiscount?.id ?? 0)
    const opt = discountOptions.find(d => String(d.id) === discountId)
    return opt?.price ?? Number(trip?.price ?? 0)
  }

  const subtotal = Array.from({ length: totalPax }, (_, i) => getPassengerPrice(i)).reduce((s, p) => s + p, 0)
  const total = subtotal + extraBag * 79 + oversizeBag * 119

  const handleBook = async () => {
    if (!trip || !from || !to) return
    const missingName = Array.from({ length: totalPax }).some((_, i) => !passengerNames[i]?.trim())
    if (missingName) { setError("Заповніть прізвище та ім'я для всіх пасажирів (латиницею)"); return }
    if (!contactPhone.trim()) { setError('Вкажіть номер телефону'); return }
    setError('')
    setLoading(true)
    try {
      const params: Record<string,string> = {
        routes: String(trip.id),
        from: String(from.id),
        to: String(to.id),
        crc: 'auto',
        mainname: (passengerNames[0] || '').trim().toUpperCase() || 'PASSENGER',
        phone: contactPhone.trim(),
        email: contactEmail.trim() || '',
      }
      for (let i = 0; i < totalPax; i++) {
        params[`name[${i}]`] = (passengerNames[i] || '').trim().toUpperCase()
        params[`discount[${i}]`] = String(passengerDiscounts[i] ?? defaultDiscount?.id ?? 0)
        if (selectedSeats[i] != null) params[`place[${i}]`] = String(selectedSeats[i])
      }
      const result = await createOrder(params)
      // API повертає або result.hash або result.orders[0].hash
      const hash = result.hash || result.orders?.[0]?.hash
      if (hash) {
        saveOrderLocally(hash, result)
        setOrderResult(hash, result)
        nav('/order-success')
      } else {
        setError('Помилка бронювання: ' + (result.error_message || `код помилки ${result.error}`))
      }
    } catch {
      setError('Помилка мережі. Перевірте з\'єднання і спробуйте ще раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', paddingBottom: 20 }}>
      <div style={{ background: '#1A1A1A', padding: '16px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Бронювання</span>
      </div>

      <div style={{ background: '#F5F5F5', minHeight: 'calc(100vh - 60px)', padding: '16px 16px 40px' }}>
        {/* Passengers */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Пасажири</div>
          {Array.from({ length: totalPax }, (_, idx) => {
            const currentDiscountId = passengerDiscounts[idx] ?? String(defaultDiscount?.id ?? 0)
            const currentDiscount = discountOptions.find(d => String(d.id) === currentDiscountId)
            const isEditing = showDiscountFor === idx
            return (
              <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < totalPax - 1 ? '1px solid #F5F5F5' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Пасажир {idx + 1}</span>
                  <button onClick={() => setShowDiscountFor(isEditing ? null : idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isEditing ? ORange : Gray, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Pencil size={15} color={isEditing ? ORange : Gray} />
                    <span style={{ fontSize: 12, color: isEditing ? ORange : Gray }}>Знижка</span>
                  </button>
                </div>
                <input
                  placeholder="Прізвище та ім'я латиницею (IVANOV IVAN)"
                  value={passengerNames[idx] || ''}
                  onChange={e => setPassengerName(idx, e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none', marginBottom: 8 }}
                />
                {/* Поточна знижка */}
                {currentDiscount && !isEditing && (
                  <div style={{ fontSize: 13, color: Gray, marginBottom: 4 }}>
                    {currentDiscount.name} — <strong>{currentDiscount.price} {currencySign}</strong>
                  </div>
                )}
                {/* Редагування знижки */}
                {isEditing && discountOptions.length > 0 && (
                  <div style={{ background: '#F9F9F9', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: Gray, marginBottom: 8, fontWeight: 600 }}>Оберіть категорію:</div>
                    {discountOptions.map(d => (
                      <button key={d.id} onClick={() => { setPassengerDiscount(idx, String(d.id)); setShowDiscountFor(null) }} style={{
                        width: '100%', padding: '10px 14px', background: String(d.id) === currentDiscountId ? '#FFF3DC' : '#fff',
                        border: String(d.id) === currentDiscountId ? `1.5px solid ${ORange}` : '1.5px solid #EEE',
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left', marginBottom: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span style={{ fontSize: 13, fontWeight: String(d.id) === currentDiscountId ? 700 : 400 }}>{d.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ORange }}>{d.price} {currencySign}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Seat selection — only show if place_select === 1 */}
        {Number(trip?.place_select) === 1 && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Бронювання місця</div>
          <button onClick={() => setShowSeats(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F9F9F9', borderRadius: 14, border: '1.5px solid #EEE', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>💺</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSeats.length > 0 ? `Місця: ${selectedSeats.join(', ')}` : 'Виберіть місце'}</div>
              <div style={{ color: Gray, fontSize: 12 }}>Перейти до вибору місця</div>
            </div>
            <span style={{ color: Gray }}>›</span>
          </button>
        </div>
        )}

        {/* Extra services */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Додаткові послуги</div>
          {[
            { icon: '🧳', label: 'Додатковий багаж', sub: 'Багаж — 20 кг (80×50×30 см)', action: () => setShowBaggage(true) },
            { icon: '🛡', label: 'Страхування пасажирів', sub: 'Ведуться технічні роботи', action: () => setShowInsurance(true) },
          ].map((s,i) => (
            <button key={i} onClick={s.action} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', background: 'none', border: 'none', borderBottom: i<1 ? '1px solid #F5F5F5' : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                {s.sub && <div style={{ color: Gray, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{s.sub}</div>}
              </div>
            </button>
          ))}
        </div>

        {/* Contacts */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Контакти</div>
          {[
            { label: 'Адреса ел. пошти', val: contactEmail, set: (v: string) => setContact('email', v), placeholder: 'your@email.com' },
            { label: 'Номер телефону', val: contactPhone, set: (v: string) => setContact('phone', v), placeholder: '+380...' },
            { label: 'Додатковий номер телефону', val: contactPhone2, set: (v: string) => setContact('phone2', v), placeholder: '+380...' },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 6 }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 15, outline: 'none' }} />
            </div>
          ))}
        </div>

        {/* Promo */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #F5F5F5' }}>
            {(['promo', 'cashback'] as const).map(tab => (
              <button key={tab} onClick={() => { setPromoTab(tab); setPromoMsg('') }} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: promoTab === tab ? `2px solid ${ORange}` : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer',
                fontWeight: 700, fontSize: 15, color: promoTab === tab ? ORange : Gray,
              }}>{tab === 'promo' ? 'Промокод' : 'Cash back'}</button>
            ))}
          </div>
          {promoTab === 'promo' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={promoCode} onChange={e => { setPromo(e.target.value); setPromoMsg('') }} placeholder="🎟 Введіть промокод"
                  style={{ flex: 1, padding: '13px 16px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 15, outline: 'none' }} />
                <button onClick={handleActivatePromo} style={{ padding: '13px 20px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Активувати</button>
              </div>
              {promoMsg && <div style={{ marginTop: 10, fontSize: 13, color: '#E53935', padding: '10px 14px', background: '#FDECEA', borderRadius: 10 }}>{promoMsg}</div>}
            </>
          )}
          {promoTab === 'cashback' && (
            <div style={{ textAlign: 'center', color: Gray, fontSize: 14, padding: '12px 0' }}>
              Cash back програма буде доступна найближчим часом
            </div>
          )}
        </div>

        {/* Trip summary */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Ваше бронювання</div>
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
          <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              <span>Усього</span>
              <span>{total} {currencySign}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}>
              <span>{totalPax} {totalPax === 1 ? 'пасажир' : 'пасажири'}</span>
              <span>{subtotal} {currencySign}</span>
            </div>
            {extraBag > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}>
                <span>{extraBag} Додатковий багаж</span><span>{extraBag * 79} ₴</span>
              </div>
            )}
            {oversizeBag > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: Gray, fontSize: 14 }}>
                <span>{oversizeBag} Наднормовий багаж</span><span>{oversizeBag * 119} ₴</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: '#FDECEA', color: '#C62828', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 14 }}>{error}</div>
        )}

        <button onClick={handleBook} disabled={loading} style={{
          width: '100%', padding: 18, background: ORange, color: '#fff',
          border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17,
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1
        }}>{loading ? 'Бронюємо...' : 'Забронювати'}</button>
      </div>

      {/* Seat Map */}
      {showSeats && (
        <SeatMap trip={trip} totalPax={totalPax} onClose={() => setShowSeats(false)}
          onConfirm={(seats: number[]) => { setSeats(seats); setShowSeats(false) }} />
      )}
      <BaggageSheet open={showBaggage} onClose={() => setShowBaggage(false)}
        extra={extraBag} oversize={oversizeBag}
        setExtra={setExtraBag} setOversize={setOversizeBag} />
      <InsuranceSheet open={showInsurance} onClose={() => setShowInsurance(false)} passengerCount={totalPax} />
    </div>
  )
}
