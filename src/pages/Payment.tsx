import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useBookingStore } from '../store'
import { getOrderInfo } from '../api/euroclub'
import { payInfo, keepOurPrice } from '../orderStatus'
import { useOrderPolling } from '../useOrderPolling'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Navy = '#0A4684'
const Gray = '#9E9E9E'
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function Payment() {
  const nav = useNavigate()
  const t = useT()
  const { orderData, orderHash, setOrderResult } = useBookingStore()
  const data = orderData as any
  const payUrl = data?.link_liqpay || data?.link_stripe || (isIOS ? data?.link2 : data?.link1) || ''
  const hash = orderHash || data?.hash || ''
  const [checking, setChecking] = useState(false)
  const browserRef = useRef<any>(null)
  const doneRef = useRef(false)

  // Відкрити сторінку оплати у власному вікні (не у фреймі — щоб LiqPay вантажився без обмежень)
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

  // Автовідкриття при заході на екран оплати (і повторно, якщо посилання підвантажилось пізніше)
  useEffect(() => {
    if (payUrl && !openedRef.current) { openedRef.current = true; openPay() }
    // eslint-disable-next-line
  }, [payUrl])

  useEffect(() => {
    const t = setTimeout(() => { if (!doneRef.current) { closeBrowser(); nav('/booking') } }, 5 * 60 * 1000)
    const w = setTimeout(() => setWaited(true), 6000) // після 6с без посилання показуємо реальну помилку, не крутимо вічно
    return () => { clearTimeout(t); clearTimeout(w) }
    // eslint-disable-next-line
  }, [])

  // Опитування order_info — доки нема посилання (могло ще не підвантажитись у фоні після
  // бронювання) АБО оплата ще не підтверджена. Раніше умова вимагала payUrl вже готовим —
  // тобто якщо посилання ще не підвантажилось, опитування взагалі не стартувало (глухий кут).
  useOrderPolling(hash, !doneRef.current, (o) => {
    const merged = keepOurPrice(data, o)
    setOrderResult(hash, merged)
    if (payInfo(merged).ticketReady) goSuccess()
  })

  const checkPaid = async () => {
    if (!hash) return
    setChecking(true)
    try {
      // Запобіжник: якщо сам запит підвисне (мережа), кнопка не має лишатись
      // "Перевірка..." назавжди — за 10с скидаємо стан незалежно від результату.
      const res: any = await Promise.race([
        getOrderInfo(hash),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
      const o = res.orders?.[0] || res
      const merged = keepOurPrice(data, o)
      if (o && (o.hash || o.status)) setOrderResult(hash, merged)
      if (payInfo(merged).ticketReady) { goSuccess(); return }
    } catch (e) {
      console.error('[Payment] checkPaid failed', e)
    }
    setChecking(false)
  }

  // Сигнал від сторінки оплати (коли прогер додасть): піти на платіжку / оплата пройшла
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
      <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #EEE', borderTopColor: ORange, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!payUrl) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#E53935', marginBottom: 8 }}>{t('payment.unavailable')}</div>
        <div style={{ fontSize: 14, color: Gray, marginBottom: 20 }}>{t('payment.unavailableNote')}</div>
        <button onClick={() => nav(-1)} style={{ padding: '12px 26px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>{t('common.back')}</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 16px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label={t('common.back')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('payment.title')}</span>
      </div>

      <div style={{ padding: 20 }}>
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
    </div>
  )
}
