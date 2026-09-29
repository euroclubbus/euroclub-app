// Кеп (29.09): Meta-відстеження — ОДИН сервіс для всіх платформ.
//  • Android/iOS — нативний Meta SDK через локальний плагін MetaEvents (App ID 1423691416357260).
//  • Веб (PWA)   — Meta Pixel (fbq) у всі активні пікселі з адмінки ("Meta-кабінети").
//  • Сервер      — Conversions API через euroclub-admin/api/meta-capi (веб-події + Purchase з усіх
//                  платформ) у всі активні кабінети. Токени живуть ТІЛЬКИ на сервері.
// Нічого не відправляється, поки користувач не погодився на екрані згоди (ConsentScreen).
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getDeviceId } from './installTracking'
import { getFirebaseApp } from './firebaseApp'
import { APP_VERSION } from './appVersion'
import { payInfo, isCancelled } from './orderStatus'

interface MetaEventsPlugin {
  setConsent(o: { granted: boolean }): Promise<void>
  logEvent(o: { name: string; params?: Record<string, string | number>; valueToSum?: number }): Promise<void>
  logPurchase(o: { amount: number; currency: string; params?: Record<string, string | number> }): Promise<void>
  requestTracking(): Promise<{ status: 'authorized' | 'denied' | 'restricted' | 'notDetermined' }>
}
const MetaEvents = registerPlugin<MetaEventsPlugin>('MetaEvents')

export const ADMIN_API = 'https://euroclub-admin.vercel.app/api'
const CONSENT_KEY = 'eclub_tracking_consent'
const platform = (): 'android' | 'ios' | 'pwa' => (Capacitor.isNativePlatform() ? (Capacitor.getPlatform() as 'android' | 'ios') : 'pwa')

export type Consent = 'granted' | 'denied'
export function getConsent(): Consent | null {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === 'granted' || v === 'denied' ? v : null } catch { return null }
}
export function needsConsentScreen(): boolean { return getConsent() === null }

// ─── ініціалізація ───────────────────────────────────────────────────────────
let started = false
export async function initTracking() {
  if (started || getConsent() !== 'granted') return
  started = true
  if (Capacitor.isNativePlatform()) {
    try { await MetaEvents.setConsent({ granted: true }) } catch (e) { console.warn('[Meta] setConsent', e) }
  } else {
    loadPixels().catch(() => {})
  }
}

// Відповідь на екрані згоди (source: 'first_launch') або перемикач у профілі ('profile').
export async function setConsent(granted: boolean, source: 'first_launch' | 'profile'): Promise<void> {
  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied') } catch {}
  let att: string | null = null
  if (Capacitor.isNativePlatform()) {
    if (granted && platform() === 'ios') {
      try { att = (await MetaEvents.requestTracking()).status } catch { att = null }
    }
    try { await MetaEvents.setConsent({ granted }) } catch {}
  }
  if (granted) { started = false; await initTracking() }
  else started = false
  recordConsent(granted, att, source).catch(e => console.error('[Meta] recordConsent', e))
}

// Лічильник для адмінки: tracking_consents/{deviceId}
async function recordConsent(granted: boolean, att: string | null, source: string) {
  const app = await getFirebaseApp()
  if (!app) return
  const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
  const firstKey = 'eclub_tracking_consent_first'
  const first = !localStorage.getItem(firstKey)
  if (first) localStorage.setItem(firstKey, String(Date.now()))
  await setDoc(doc(getFirestore(app), 'tracking_consents', getDeviceId()), {
    platform: platform(),
    consent: granted ? 'granted' : 'denied',
    att: att ?? null,
    source,
    appVersion: APP_VERSION,
    updatedAt: serverTimestamp(),
    ...(first ? { firstAnsweredAt: serverTimestamp(), firstConsent: granted ? 'granted' : 'denied' } : {}),
  }, { merge: true })
}

// ─── веб-пікселі ──────────────────────────────────────────────────────────────
interface PixelCfg { id: string; events: string[] }
let pixels: PixelCfg[] = []
async function loadPixels() {
  const res = await fetch(`${ADMIN_API}/meta-pixels`).then(r => r.json()).catch(() => null)
  pixels = Array.isArray(res?.pixels) ? res.pixels : []
  if (!pixels.length) return
  const w = window as any
  if (!w.fbq) {
    /* eslint-disable */
    ;(function (f: any, b: any, e: any, v: any) { if (f.fbq) return; const n: any = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; const t = b.createElement(e); t.async = !0; t.src = v; const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    /* eslint-enable */
  }
  for (const p of pixels) w.fbq('init', p.id, { external_id: getDeviceId() })
  for (const p of pixels) w.fbq('trackSingle', p.id, 'PageView')
}

// ─── події ────────────────────────────────────────────────────────────────────
export type MetaEvent = 'CompleteRegistration' | 'Search' | 'ViewContent' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase'
export interface EventData {
  value?: number
  currency?: string        // 'UAH' | 'EUR'
  contentId?: string       // id рейсу / маршруту
  searchString?: string    // "Київ → Берлін, 30.11.2026"
  numItems?: number        // кількість квитків
  orderId?: string
  email?: string
  phone?: string
}

// Стандартні імена Meta App Events (нативний SDK)
const NATIVE: Record<Exclude<MetaEvent, 'Purchase'>, string> = {
  CompleteRegistration: 'fb_mobile_complete_registration',
  Search: 'fb_mobile_search',
  ViewContent: 'fb_mobile_content_view',
  InitiateCheckout: 'fb_mobile_initiated_checkout',
  AddPaymentInfo: 'fb_mobile_add_payment_info',
}

export function track(event: MetaEvent, data: EventData = {}): void {
  if (getConsent() !== 'granted') return
  const eventId = `${event}-${data.orderId || ''}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const currency = (data.currency || 'UAH').toUpperCase()
  if (Capacitor.isNativePlatform()) {
    const params: Record<string, string | number> = { fb_currency: currency }
    if (data.contentId) { params.fb_content_id = data.contentId; params.fb_content_type = 'product' }
    if (data.searchString) params.fb_search_string = data.searchString
    if (data.numItems) params.fb_num_items = data.numItems
    if (data.orderId) params.fb_order_id = data.orderId
    const p = event === 'Purchase'
      ? MetaEvents.logPurchase({ amount: data.value || 0, currency, params })
      : MetaEvents.logEvent({ name: NATIVE[event], params, ...(data.value ? { valueToSum: data.value } : {}) })
    p.catch(e => console.warn('[Meta] native', event, e))
  } else if ((window as any).fbq && pixels.length) {
    const params: Record<string, unknown> = { currency }
    if (data.value) params.value = data.value
    if (data.contentId) { params.content_ids = [data.contentId]; params.content_type = 'product' }
    if (data.searchString) params.search_string = data.searchString
    if (data.numItems) params.num_items = data.numItems
    if (data.orderId) params.order_id = data.orderId
    for (const px of pixels) {
      if (px.events.length && !px.events.includes(event)) continue
      ;(window as any).fbq('trackSingle', px.id, event, params, { eventID: eventId })
    }
  }
  // Сервер (CAPI): усі події з вебу + Purchase з будь-якої платформи.
  if (!Capacitor.isNativePlatform() || event === 'Purchase') {
    fetch(`${ADMIN_API}/meta-capi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ event, eventId, platform: platform(), deviceId: getDeviceId(), url: location.href, data: { ...data, currency } }),
    }).catch(() => {})
  }
}

// ─── Purchase: один раз на оплачене замовлення з застосунку ─────────────────
const PURCHASED_KEY = 'eclub_meta_purchased'
const PURCHASED_INIT_KEY = 'eclub_meta_purchased_init'
function readSet(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(PURCHASED_KEY) || '[]')) } catch { return new Set() } }
function writeSet(s: Set<string>) { try { localStorage.setItem(PURCHASED_KEY, JSON.stringify(Array.from(s).slice(-500))) } catch {} }

const isAppOrder = (o: any) => !!o?.bookingDate || String(o?.app ?? '') === '1' || String(o?.app ?? '') === '2'

// Викликати з будь-якого місця, де приходить свіжий список/замовлення з бекенду.
// ПЕРШИЙ запуск після оновлення: усі вже оплачені замовлення лише запам'ятовуємо, без
// відправки — інакше Meta отримала б купу старих покупок разом.
export function checkPurchases(orders: any[]): void {
  if (!Array.isArray(orders) || !orders.length) return
  const done = readSet()
  const paid = orders.filter(o => o && (o.oid || o.hash) && isAppOrder(o) && !isCancelled(o) && payInfo(o).fullyPaid)
  let initialized = false
  try { initialized = localStorage.getItem(PURCHASED_INIT_KEY) === '1' } catch {}
  if (!initialized) {
    paid.forEach(o => done.add(String(o.oid ?? o.hash)))
    writeSet(done)
    try { localStorage.setItem(PURCHASED_INIT_KEY, '1') } catch {}
    return
  }
  for (const o of paid) {
    const id = String(o.oid ?? o.hash)
    if (done.has(id)) continue
    done.add(id)
    writeSet(done)
    if (getConsent() !== 'granted') continue
    const uah = Number(o.paid_uah) || 0
    const eur = Number(o.paid_eur) || 0
    const passengers = Array.isArray(o.passengers) ? o.passengers.length : (Array.isArray(o.psgrs) ? o.psgrs.length : undefined)
    track('Purchase', {
      value: uah > 0 ? uah : eur,
      currency: uah > 0 ? 'UAH' : 'EUR',
      orderId: id,
      numItems: passengers,
      email: o.email, phone: o.phone,
    })
  }
}
