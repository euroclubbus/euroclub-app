// Ключ API більше НЕ у фронтенді — його підставляє Cloudflare Worker із секрету EUROCLUB_KEY.
import { currentUidKey } from '../authStore'

const BASE = 'https://curly-voice-8a71.eclubbus21.workers.dev/v1/json'

async function call(method: string, params: Record<string,string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/${method}/${qs ? '?' + qs : ''}`
  console.log('[EuroClub API] →', url)
  const res = await fetch(url)
  const json = await res.json()
  console.log('[EuroClub API] ←', method, json)
  return json
}

export const getCities = (p?: Record<string,string>) => call('cities', p)
export const getDiscounts = () => call('discount')
export const getRoutesDays = (from: string, to: string, month?: string) =>
  call('routes_day', { from, to, ...(month ? {month} : {}) })
export const getRoutes = (from: string, to: string, date: string, crc = 'auto') =>
  call('routes', { from, to, date, crc })
export const confirmOrder = (hash: string) => call('order_confirm', { hash })
export const cancelOrder = (hash: string) => call('order_cancel', { hash })
export const restoreOrder = (hash: string) => call('order_restore', { hash })
// order_info видалено (прогер підтвердив: метод застарів, замінено на user-orders,
// див. findUserOrder у api/auth.ts).

export async function createOrder(params: Record<string,string>) {
  if (!params.uidkey) params.uidkey = currentUidKey()
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/order_new/?${qs}`
  console.log('[EuroClub API] → (order_new)', url)
  const res = await fetch(url)
  const json = await res.json()
  console.log('[EuroClub API] ← order_new', json)
  return json
}

export function saveOrderLocally(hash: string, data: Record<string,unknown>) {
  const orders = getLocalOrders()
  orders[hash] = { hash, savedAt: Date.now(), ...data }
  localStorage.setItem('euroclub_orders', JSON.stringify(orders))
}
export function getLocalOrders(): Record<string, Record<string,unknown>> {
  try { return JSON.parse(localStorage.getItem('euroclub_orders') || '{}') } catch { return {} }
}
