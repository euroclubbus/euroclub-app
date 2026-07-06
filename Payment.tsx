import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ExternalLink } from 'lucide-react'
import { useBookingStore } from '../store'
import { getOrderInfo } from '../api/euroclub'
import { payInfo } from '../orderStatus'
import { useOrderPolling } from '../useOrderPolling'

const ORange = '#F5A623'
const Navy = '#0A4684'
const Gray = '#9E9E9E'
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const PAY_TIMEOUT_MS = 5 * 60 * 1000 // 5 хвилин на оплату — якщо не оплачено, повертаємось назад

export default function Payment() {
  const nav = useNavigate()
  const { orderData, orderHash, setOrderResult } = useBookingStore()
  const data = orderData as any
  const payUrl = (isIOS ? data?.link2 : data?.link1) || ''
  const hash = orderHash || data?.hash || ''
  const [checking, setChecking] = useState(false)
  const [opened, setOpened] = useState(false)

  const winRef = useRef<any>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneRef = useRef(false)

  const clearPayTimer = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  const closeExternal = () => {
    try { winRef.current?.close?.() } catch {}
    winRef.current = null
  }

  // Платіжку провайдера відкриваємо ЗОВНІ, без фрейму (там фрейм і не потрібен, і блокується)
  const openExternal = (url: string) => {
    const iab = (window as any).cordova?.InAppBrowser
    if (iab?.open) {
      winRef.current = iab.open(url, '_blank', 'location=yes,toolbarposition=bottom,closebuttoncaption=Готово,toolbarcolor=#0A4684,closebuttoncolor=#ffffff')
    } else {
      winRef.current = window.open(url, '_blank')
    }
    setOpened(true)
  }

  const goBack = () => {
    clearPayTimer()
    closeExternal()
    nav(-1)
  }

  // Оплата підтверджена (>=70%): закриваємо вікно оплати й ведемо на успіх/квиток
  const handlePaid = () => {
    if (doneRef.current) return
    doneRef.current = true
    clearPayTimer()
    closeExternal()
    nav('/order-success')
  }

  // Опитування order_info кожні 3с — головний, надійний сигнал про оплату
  useOrderPolling(hash, !!payUrl, (o) => {
    setOrderResult(hash, o)
    if (payInfo(o).ticketReady) handlePaid()
  })

  const checkPaid = async () => {
    if (!hash) return
    setChecking(true)
    try {
      const res: any = await getOrderInfo(hash)
      const o = res.orders?.[0] || res
      if (o && (o.hash || o.status)) setOrderResult(hash, o)
      if (payInfo(o).ticketReady) { handlePaid(); return }
    } catch {}
    setChecking(false)
  }

  // Сайт/провайдер може повідомити додаток напряму (postMessage) — лишаємо для сумісності на майбутнє
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

  // Заходимо на екран → одразу відкриваємо оплату зовні + запускаємо таймер 5 хв
  useEffect(() => {
    if (!payUrl) return
    doneRef.current = false
    openExternal(payUrl)
    timeoutRef.current = setTimeout(() => {
      if (!doneRef.current) goBack()
    }, PAY_TIMEOUT_MS)
    return () => { clearPayTimer(); closeExternal() }
    // eslint-disable-next-line
  }, [payUrl])

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
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 14px) 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={goBack} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 800, flex: 1 }}>Оплата</span>
        <button onClick={checkPaid} disabled={checking} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} /> {checking ? 'Перевірка' : 'Я оплатив'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <ExternalLink size={28} color={ORange} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: Navy, marginBottom: 8 }}>
          {opened ? 'Вікно оплати відкрито' : 'Відкриваємо оплату…'}
        </div>
        <div style={{ fontSize: 14, color: Gray, marginBottom: 24, maxWidth: 320 }}>
          Завершіть оплату у вікні, яке відкрилось окремо. Щойно оплата пройде — ми автоматично покажемо квиток.
          Якщо вікно не оплачено за 5 хвилин, ми повернемо вас до замовлення.
        </div>
        <button onClick={() => openExternal(payUrl)} style={{ padding: '13px 28px', background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Відкрити оплату ще раз
        </button>
      </div>

      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
