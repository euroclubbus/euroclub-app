const API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_KEY) || 'apitest_joieerv65v6j'
// Use Vite dev proxy (configured in vite.config.ts) to bypass CORS during development.
// In production (Vercel), this needs server-side proxy too — see vercel.json rewrites.
const BASE = 'https://curly-voice-8a71.eclubbus21.workers.dev/v1/json'

async function call(method: string, params: Record<string,string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/${method}/${API_KEY}/${qs ? '?' + qs : ''}`
  const res = await fetch(url)
  return res.json()
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
export const getOrderInfo = (hash: string) => call('order_info', { hash })

export async function createOrder(params: Record<string,string>) {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/order_new/${API_KEY}/?${qs}`
  const res = await fetch(url)
  return res.json()
}

export function saveOrderLocally(hash: string, data: Record<string,unknown>) {
  const orders = getLocalOrders()
  orders[hash] = { hash, savedAt: Date.now(), ...data }
  localStorage.setItem('euroclub_orders', JSON.stringify(orders))
}
export function getLocalOrders(): Record<string, Record<string,unknown>> {
  try { return JSON.parse(localStorage.getItem('euroclub_orders') || '{}') } catch { return {} }
}
