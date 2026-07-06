import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
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
  const payUrl = (isIOS ? data?.link2 : data?.link1) || ''
  const hash = orderHash || data?.hash || ''
  const [checking, setChecking] = useState(false)

  // Платіжку провайдера відкриваємо ЗОВНІ (там фрейм не потрібен)
  const openExternal = (url: string) => {
    const iab = (window as any).cordova?.InAppBrowser
    if (iab?.open) { iab.open(url, '_blank', 'location=yes,toolbarposition=bottom,closebuttoncaption=Готово,toolbarcolor=#0A4684,closebuttoncolor=#ffffff'); return }
    window.open(url, '_blank')
  }

  useOrderPolling(hash, !!payUrl, (o) => { setOrderResult(hash, o); if (payInfo(o).ticketReady) nav('/order-success') })

  const checkPaid = async () => {
    if (!hash) return
    setChecking(true)
    try {
      const res: any = await getOrderInfo(hash)
      const o = res.orders?.[0] || res
      if (o && (o.hash || o.status)) setOrderResult(hash, o)
      if (payInfo(o).ticketReady) { nav('/order-success'); return }
    } catch {}
    setChecking(false)
  }

  // Сайт може повідомити додаток: піти на платіжку зовні / оплата пройшла
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data || {}
      if (d && d.eclubPayUrl) openExternal(String(d.eclubPayUrl))
      if (d && d.eclubPaid) checkPaid()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line
  }, [hash])

  // Якщо фрейм повернувся на наш домен з ознакою успіху — перевіряємо статус
  const onIframeLoad = (e: any) => {
    try {
      const href = e.target?.contentWindow?.location?.href || ''
      if (/success|thank|complete|paid|done/i.test(href)) checkPaid()
    } catch { /* cross-origin (пішли на платіжку) — ігноруємо */ }
  }

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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 64, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 14px) 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 800, flex: 1 }}>Оплата</span>
        <button onClick={checkPaid} disabled={checking} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} /> {checking ? 'Перевірка' : 'Я оплатив'}
        </button>
      </div>
      <iframe
        src={payUrl}
        onLoad={onIframeLoad}
        title="Оплата"
        allow="payment"
        style={{ flex: 1, width: '100%', border: 'none' }}
      />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
