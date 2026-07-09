// Логіка оплати/статусів/квитка EuroClub.
// Джерело оплати — pay_uah / pay_eur з order_info (конвертує система бронювання).
// Квиток формується при оплаті >= 70% від суми і далі НЕ зникає (фіксуємо на пристрої).

const THRESHOLD = 0.70

function num(v: any): number {
  const n = parseFloat(String(v ?? '').replace(',', '.').trim())
  return isNaN(n) ? 0 : n
}

export function currencySign(o: any): string {
  return String(o?.crc || 'uah').toLowerCase() === 'eur' ? '€' : '₴'
}

function paidAmount(o: any): number {
  const cur = String(o?.crc || 'uah').toLowerCase()
  return cur === 'eur' ? num(o?.pay_eur) : num(o?.pay_uah)
}

export interface PayInfo { summ: number; paid: number; ratio: number; remainder: number; ticketReady: boolean; fullyPaid: boolean; sign: string }

export function payInfo(o: any): PayInfo {
  const summ = num(o?.summ ?? o?.price)
  const paid = paidAmount(o)
  const ratio = summ > 0 ? paid / summ : 0
  const remainder = Math.max(0, +(summ - paid).toFixed(2))
  return { summ, paid, ratio, remainder, ticketReady: summ > 0 && ratio >= THRESHOLD, fullyPaid: summ > 0 && paid + 0.01 >= summ, sign: currencySign(o) }
}

export function isCancelled(o: any): boolean {
  const s = String(o?.status || '').toLowerCase()
  return s.includes('cancel') || s.includes('скасов')
}
export function cancelledByPassenger(o: any): boolean {
  // TODO: потрібне поле cancel_by від прогера (passenger/manager). Поки — завжди false.
  return String(o?.cancel_by || '').toLowerCase() === 'passenger'
}

function parseDT(str: any): Date | null {
  const m = String(str || '').match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0))
}
export function isCompleted(o: any): boolean {
  const d = parseDT(o?.ttime)
  return d ? d.getTime() < Date.now() : false
}

// Годин до відправлення (null якщо дату не розпізнано)
export function hoursUntilDeparture(o: any): number | null {
  const d = parseDT(o?.ftime)
  return d ? (d.getTime() - Date.now()) / 3600000 : null
}

// Відновити можна лише неоплачене і скасоване замовлення, і лише якщо до рейсу > 24 год
export function canRestore(o: any): boolean {
  if (!isCancelled(o)) return false
  if (payInfo(o).paid > 0) return false
  const h = hoursUntilDeparture(o)
  return h !== null && h > 24
}

// --- «Квиток сформовано» — фіксація на пристрої (не зникає) ---
function formedMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('eclub_ticket_formed') || '{}') } catch { return {} }
}
export function markTicketFormed(hash?: string) {
  if (!hash) return
  try { const k = formedMap(); k[hash] = 1; localStorage.setItem('eclub_ticket_formed', JSON.stringify(k)) } catch {}
}
export function wasTicketFormed(hash?: string): boolean {
  if (!hash) return false
  return !!formedMap()[hash]
}

// Квиток доступний: оплата >=70% АБО вже був сформований раніше
export function ticketAvailable(o: any, hash?: string): boolean {
  if (isCancelled(o)) return false
  if (payInfo(o).ticketReady) { markTicketFormed(hash || o?.hash); return true }
  return wasTicketFormed(hash || o?.hash)
}

export function statusLabel(o: any): { text: string; color: string; bg: string } {
  if (isCancelled(o)) return cancelledByPassenger(o)
    ? { text: 'Скасовано пасажиром', color: '#E53935', bg: '#FDECEA' }
    : { text: 'Скасовано', color: '#E53935', bg: '#FDECEA' }
  if (isCompleted(o)) return { text: 'Виконано', color: '#555', bg: '#EEEEEE' }
  const pi = payInfo(o)
  if (pi.fullyPaid) return { text: 'Оплачено', color: '#2E7D32', bg: '#E8F5E9' }
  if (pi.ticketReady) return { text: 'Очікує доплати', color: '#B8860B', bg: '#FFF3DC' }
  return { text: 'Очікує оплати', color: '#B8860B', bg: '#FFF3DC' }
}

// Чи потрібно опитувати order_info (екран очікування оплати/доплати)
export function needsPolling(o: any): boolean {
  if (isCancelled(o) || isCompleted(o)) return false
  return !payInfo(o).fullyPaid
}
