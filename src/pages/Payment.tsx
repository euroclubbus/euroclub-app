import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Loader2, X, CreditCard } from 'lucide-react'
import { useBookingStore } from '../store'
import { Browser } from '@capacitor/browser'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// iOS → link2 (Apple Pay), інакше (Android/веб) → link1 (Google Pay)
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const WALLET = isIOS ? 'Apple Pay' : 'Google Pay'

export default function Payment() {
  const nav = useNavigate()
  const { orderData, selectedTrip, orderHash } = useBookingStore()
  const [paying, setPaying] = useState(false)

  const trip = selectedTrip as any
  const data = orderData as any
  const total = data?.summ ?? data?.price ?? trip?.price ?? 0
  const currencySign = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? '€' : '₴'

  // Посилання на оплату з відповіді order_new. Порожні = замовлення скасоване.
  const payUrl = (isIOS ? data?.link2 : data?.link1) || ''
  const canPay = !!payUrl
  const orderNo = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    if (m) return '000' + m[1]
    return orderHash ? '000' + String(orderHash).slice(-6).toUpperCase() : ''
  })()

  const handlePay = async () => {
    if (!payUrl) return
    setPaying(true)
    // APK: Custom Tab (Android) / Safari View (iOS). PWA: нова вкладка.
    try { await Browser.open({ url: payUrl }) } catch { window.open(payUrl, '_blank') }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 22px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Оплата</span>
        </div>
      </div>

      {/* Підсумок */}
      <div style={{ background: '#fff', margin: '16px 16px 0', borderRadius: 20, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: Gray }}>До сплати</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A' }}>{total} {currencySign}</span>
        </div>
        {orderNo && <div style={{ fontSize: 12, color: Gray, marginTop: 4 }}>Замовлення {orderNo}</div>}
      </div>

      {/* Оплата */}
      <div style={{ background: '#fff', margin: '16px', borderRadius: 20, padding: 20 }}>
        {!canPay ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E53935', marginBottom: 6 }}>Оплата недоступна</div>
            <div style={{ fontSize: 13, color: Gray, lineHeight: 1.5 }}>Замовлення скасоване або посилання на оплату ще не сформоване. Поверніться назад і оформіть замовлення знову.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
              <span style={{ width: 42, height: 42, borderRadius: 10, background: '#FFF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={20} color={ORange} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>Оплата карткою</div>
                <div style={{ fontSize: 13, color: Gray }}>Картка, {WALLET}, PayPal — на захищеній сторінці</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: Gray, fontSize: 12, marginBottom: 16 }}>
              <ShieldCheck size={15} color="#4CAF50" />
              Дані картки в додатку не зберігаються.
            </div>

            <button onClick={handlePay} style={{
              width: '100%', padding: 17, background: ORange, color: '#fff', border: 'none',
              borderRadius: 14, fontWeight: 800, fontSize: 17, cursor: 'pointer',
            }}>
              Оплатити {total} {currencySign}
            </button>
          </>
        )}
      </div>

      {/* Overlay передачі в захищений браузер */}
      {paying && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,28,58,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setPaying(false)} aria-label="Закрити" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: Gray }}><X size={20} /></button>
            <div style={{ width: 56, height: 56, margin: '4px auto 16px', borderRadius: '50%', background: '#FFF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} color={ORange} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Оплата відкрита в новому вікні</div>
            <div style={{ fontSize: 14, color: Gray, lineHeight: 1.5, marginBottom: 18 }}>
              Завершіть оплату на захищеній сторінці. Після успішної оплати сформуємо квиток.
            </div>
            <button onClick={() => nav('/order-success')} style={{ width: '100%', padding: 14, background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Перевірити оплату
            </button>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        </div>
      )}
    </div>
  )
}
