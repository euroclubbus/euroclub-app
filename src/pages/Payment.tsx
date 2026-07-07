import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useBookingStore } from '../store'
import { getOrderInfo } from '../api/euroclub'
import { payInfo } from '../orderStatus'
import { useOrderPolling } from '../useOrderPolling'

const ORange = '#F5A623'
const Navy = '#0A4684'
const Gray = '#9E9E9E'
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function Payment() {
  const nav = useNavigate()
  const { orderData, orderHash, setOrderResult } = useBookingStore()
  const data = orderData as any
  const payUrl = data?.link_liqpay || (isIOS ? data?.link2 : data?.link1) || ''
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

  // Автовідкриття при заході на екран оплати
  useEffect(() => {
    openPay()
    const t = setTimeout(() => { if (!doneRef.current) { closeBrowser(); nav('/booking') } }, 5 * 60 * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [])

  // Опитування order_info — щойно оплата >=70% → закриваємо вікно й ведемо на успіх
  useOrderPolling(hash, !!payUrl && !doneRef.current, (o) => {
    setOrderResult(hash, o)
    if (payInfo(o).ticketReady) goSuccess()
  })

  const checkPaid = async () => {
    if (!hash) return
    setChecking(true)
    try {
      const res: any = await getOrderInfo(hash)
      const o = res.orders?.[0] || res
      if (o && (o.hash || o.status)) setOrderResult(hash, o)
      if (payInfo(o).ticketReady) { goSuccess(); return }
    } catch {}
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

  if (!payUrl) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#E53935', marginBottom: 8 }}>Оплата недоступна</div>
        <div style={{ fontSize: 14, color: Gray, marginBottom: 20 }}>Замовлення скасоване або посилання ще не сформоване.</div>
        <button onClick={() => nav(-1)} style={{ padding: '12px 26px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Назад</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 16px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Оплата</span>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Оплата відкрита в окремому вікні</div>
          <div style={{ fontSize: 14, color: Gray, lineHeight: 1.5, marginBottom: 20 }}>
            Оберіть платіжну систему та завершіть оплату. Після оплати ми автоматично повернемо вас сюди й покажемо квиток.
          </div>
          <button onClick={openPay} style={{ width: '100%', padding: 15, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
            Відкрити оплату
          </button>
          <button onClick={checkPaid} disabled={checking} style={{ width: '100%', padding: 13, background: 'none', border: `2px solid ${ORange}`, color: ORange, borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {checking ? 'Перевірка…' : 'Я оплатив'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: Gray, fontSize: 12, marginTop: 16 }}>
          <ShieldCheck size={15} color="#4CAF50" /> Дані картки в додатку не зберігаються
        </div>
      </div>
    </div>
  )
}
