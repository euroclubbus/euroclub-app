import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useBookingStore } from '../store'
import { findUserOrder } from '../api/auth'
import { payInfo, keepOurPrice } from '../orderStatus'
import { useOrderPolling } from '../useOrderPolling'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

// Ядро оплати — і сторінка /payment (прямий заxід з квитка/успіху), і Booking.tsx
// (одне полотно: бронювання → оплата без переходу на новий екран) рендерять саме це.
export default function PaymentPanel() {
  const nav = useNavigate()
  const t = useT()
  const { orderData, orderHash, setOrderResult } = useBookingStore()
  const data = orderData as any
  const payUrl = data?.link_liqpay || data?.link_stripe || (isIOS ? data?.link2 : data?.link1) || ''
  const hash = orderHash || data?.hash || ''
  const [checking, setChecking] = useState(false)
  const browserRef = useRef<any>(null)
  const doneRef = useRef(false)

  const openPay = () => {
    if (!payUrl) return
    const iab = (window as any).cordova?.InAppBrowser
    if (iab?.open) {
      browserRef.current = iab.open(payUrl, '_blank', 'location=yes,toolbarposition=bottom,closebuttoncaption=Готово,toolbarcolor=#0A4684,closebuttoncolor=#ffffff,navigationbuttoncolor=#ffffff')
    } else {
      window.open(payUrl, '_blank')
    }
  }

  const closeBrowser = () => { try { browserRef.current?.close?.() } catch {} browserRef.current = null }

  const goSuccess = () => { if (doneRef.current) return; doneRef.current = true; closeBrowser(); nav('/order-success') }

  const [waited, setWaited] = useState(false)
  const openedRef = useRef(false)

  useEffect(() => {
    if (payUrl && !openedRef.current) { openedRef.current = true; openPay() }
    // eslint-disable-next-line
  }, [payUrl])

  useEffect(() => {
    const timeout = setTimeout(() => { if (!doneRef.current) closeBrowser() }, 5 * 60 * 1000)
    const w = setTimeout(() => setWaited(true), 6000)
    return () => { clearTimeout(timeout); clearTimeout(w) }
    // eslint-disable-next-line
  }, [])

  useOrderPolling(hash, !doneRef.current, (o) => {
    const merged = keepOurPrice(data, o)
    setOrderResult(hash, merged)
    if (payInfo(merged).ticketReady) goSuccess()
  })

  const checkPaid = async () => {
    if (!hash) return
    setChecking(true)
    try {
      const o: any = await Promise.race([
        findUserOrder(hash),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
      if (!o) { setChecking(false); return }
      const merged = keepOurPrice(data, o)
      setOrderResult(hash, merged)
      if (payInfo(merged).ticketReady) { goSuccess(); return }
    } catch (e) {
      console.error('[Payment] checkPaid failed', e)
    }
    setChecking(false)
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data || {}
      if (d && d.eclubPayUrl) { const iab = (window as any).cordova?.InAppBrowser; if (iab?.open) browserRef.current = iab.open(String(d.eclubPayUrl), '_blank', 'location=yes,toolbarposition=bottom,closebuttoncaption=Готово,toolbarcolor=#0A4684,closebuttoncolor=#ffffff'); else window.open(String(d.eclubPayUrl), '_blank') }
      if (d && d.eclubPaid) checkPaid()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line
  }, [hash])

  if (!payUrl && !waited) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #EEE', borderTopColor: ORange, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!payUrl) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#E53935', marginBottom: 8 }}>{t('payment.unavailable')}</div>
        <div style={{ fontSize: 14, color: Gray }}>{t('payment.unavailableNote')}</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 20, padding: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{t('payment.openedSeparately')}</div>
        <div style={{ fontSize: 14, color: Gray, lineHeight: 1.5, marginBottom: 20 }}>
          {t('payment.instructions')}
        </div>
        <button onClick={openPay} style={{ width: '100%', padding: 15, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
          {t('payment.open')}
        </button>
        <button onClick={checkPaid} disabled={checking} style={{ width: '100%', padding: 13, background: 'none', border: `2px solid ${ORange}`, color: ORange, borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {checking ? t('payment.checking') : t('payment.iPaid')}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: Gray, fontSize: 12, marginTop: 16 }}>
        <ShieldCheck size={15} color="#4CAF50" /> {t('payment.noCardStorage')}
      </div>
    </div>
  )
}
