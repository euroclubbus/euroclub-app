import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Bus } from 'lucide-react'
import { useBookingStore } from '../store'
import { findUserOrder } from '../api/auth'
import { payInfo, keepOurPrice, passengerDisplayPrices, formatSeat, surchargeInfo } from '../orderStatus'
import BankTransferBox from '../components/BankTransferBox'
import { useOrderPolling } from '../useOrderPolling'
import { useDisplayPrice } from '../currency'
import { useT } from '../i18n'
import { openInternalBrowser, closeInternalBrowser } from '../internalBrowser'

const ORange = '#F5A623'
const Navy = '#0A4684'
const Gray = '#9E9E9E'
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function Payment() {
  const nav = useNavigate()
  const t = useT()
  const { orderData, orderHash, setOrderResult } = useBookingStore()
  const data = orderData as any
  const payUrlUah = data?.link_liqpay || (isIOS ? data?.link2 : data?.link1) || ''
  const payUrlEur = data?.link_stripe || ''
  const payUrl = payUrlUah || payUrlEur
  const hash = orderHash || data?.hash || ''
  const { format } = useDisplayPrice()
  const rawPax = data?.passengers?.length ? data.passengers : data?.passangers
  const passengers = (rawPax || []).map((p: any) => ({ name: p.name, place: p.plc ?? p.place, price: p.prc ?? p.price }))
  const passengerPrices = passengerDisplayPrices(Number(data?.summ ?? data?.price ?? 0) || 0, passengers)
  const [checking, setChecking] = useState(false)
  const doneRef = useRef(false)

  // Відкрити сторінку оплати у системному браузері (Safari View Controller / Custom Tabs) —
  // НЕ у внутрішньому WebView застосунку. Apple (Guideline 5.1.2(i), ATT) трактує вебвміст,
  // відкритий у власному in-app browser, як "контент застосунку" — якщо там є cookies,
  // потрібен запит ATT-дозволу. Системний браузер такою вимогою не покривається.
  const openPay = (url: string) => {
    if (!url) return
    openInternalBrowser(url)
  }

  const closeBrowser = () => { closeInternalBrowser() }

  const goSuccess = () => { if (doneRef.current) return; doneRef.current = true; closeBrowser(); nav('/order-success') }

  const [waited, setWaited] = useState(false)

  // Раніше тут було автовідкриття однієї з посилань одразу при заході на екран —
  // прибрано, бо тепер є ДВА способи оплати (LiqPay/грн і Stripe/євро) і користувач
  // сам обирає, натискаючи відповідну кнопку нижче.

  useEffect(() => {
    const t = setTimeout(() => { if (!doneRef.current) { closeBrowser(); nav('/booking') } }, 5 * 60 * 1000)
    const w = setTimeout(() => setWaited(true), 6000) // після 6с без посилання показуємо реальну помилку, не крутимо вічно
    return () => { clearTimeout(t); clearTimeout(w) }
    // eslint-disable-next-line
  }, [])

  // Опитування order_info — доки нема посилання (могло ще не підвантажитись у фоні після
  // бронювання) АБО оплата ще не підтверджена. Раніше умова вимагала payUrl вже готовим —
  // тобто якщо посилання ще не підвантажилось, опитування взагалі не стартувало (глухий кут).
  // ВИМКНЕНО, коли активна доплата (paid_uah від'ємний): живе опитування підміняло правильну
  // суму до сплати на needpay_uah з наступного циклу, що вело до неправильної ціни на екрані.
  useOrderPolling(hash, !doneRef.current && !surchargeInfo(data).active, (o) => {
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

  // Сигнал від сторінки оплати (коли прогер додасть): піти на платіжку / оплата пройшла
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data || {}
      if (d && d.eclubPayUrl) openInternalBrowser(String(d.eclubPayUrl))
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
    // Немає жодного посилання на LiqPay/Stripe — це не завжди помилка: для замовлення,
    // яке вже раз оплачене й потім отримало ДОПЛАТУ (менеджер підняв ціну/додав
    // послугу), бекенд може не видавати нову платіжну сторінку взагалі. Пряма умова
    // доплати (без ticketReady/status): paid_uah/eur від'ємний, summ>0, needpay>0.
    const si = surchargeInfo(data)
    const currency = String(data?.crc || 'uah').toUpperCase()
    const orderNo = data?.oid || hash
    if (si.active) {
      return (
        <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 22, maxWidth: 400, margin: '40px auto 0' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, background: '#EAF7ED', borderRadius: 16, padding: '12px 14px' }}>
                <div style={{ fontSize: 10.5, color: Gray, fontWeight: 600, textTransform: 'uppercase' }}>Оплачено</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, color: '#2E7D32' }}>{format(si.paidLabel, currency)}</div>
              </div>
              <div style={{ flex: 1, background: '#FFF5E6', borderRadius: 16, padding: '12px 14px' }}>
                <div style={{ fontSize: 10.5, color: Gray, fontWeight: 600, textTransform: 'uppercase' }}>Доплата</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, color: '#B8860B' }}>{format(si.needpay, currency)}</div>
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: Navy, textAlign: 'center', marginBottom: 4 }}>
              {format(si.needpay, currency)} — при посадці в автобус або на рахунок
            </div>
            <BankTransferBox oid={orderNo} amount={si.needpay} currencyLabel={currency === 'EUR' ? '€' : 'грн'} />
          </div>
          <button onClick={() => nav(-1)} style={{ display: 'block', margin: '20px auto 0', padding: '12px 26px', background: 'none', border: 'none', color: Gray, fontWeight: 600, cursor: 'pointer' }}>{t('common.back')}</button>
        </div>
      )
    }
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
        {(data?.from_city || data?.to_city) && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bus size={16} color={Navy} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{data?.from_city} → {data?.to_city}</span>
            </div>
            <div style={{ fontSize: 13, color: Gray, marginBottom: data?.roundTrip ? 4 : 0 }}>{data?.ftime} → {data?.ttime}</div>
            {data?.roundTrip && data?.ftime2 && (
              <div style={{ fontSize: 13, color: Gray }}>🔄 {data.ftime2} → {data?.ttime2}</div>
            )}
            {passengers.length > 0 && (
              <div style={{ borderTop: '1px solid #F5F5F5', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {passengers.map((p: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ fontWeight: 600 }}>{p.name}{p.place ? ` · місце ${formatSeat(p.place)}` : ''}</span>
                    <span style={{ color: Gray }}>{format(passengerPrices[i], data?.crc)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 20, padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{t('payment.openedSeparately')}</div>
          <div style={{ fontSize: 14, color: Gray, lineHeight: 1.5, marginBottom: 20 }}>
            {t('payment.instructions')}
          </div>
          <button onClick={() => openPay(payUrlUah)} disabled={!payUrlUah} style={{ width: '100%', padding: 15, background: payUrlUah ? ORange : '#EEE', color: payUrlUah ? '#fff' : Gray, border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: payUrlUah ? 'pointer' : 'default', marginBottom: 8 }}>
            {t('payment.payUah')}
          </button>
          <div style={{ fontSize: 12, color: Gray, marginBottom: 16 }}>{t('payment.payUahHint')}</div>
          <button onClick={() => openPay(payUrlEur)} disabled={!payUrlEur} style={{ width: '100%', padding: 15, background: 'none', border: `2px solid ${payUrlEur ? Navy : '#EEE'}`, color: payUrlEur ? Navy : Gray, borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: payUrlEur ? 'pointer' : 'default', marginBottom: 8 }}>
            {t('payment.payEur')}
          </button>
          <div style={{ fontSize: 12, color: Gray, marginBottom: 16 }}>{t('payment.payEurHint')}</div>
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
