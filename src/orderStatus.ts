// Логіка оплати/статусів/квитка EuroClub.
// Джерело оплати — paid_uah / paid_eur (нові поля від прогера, є вже в neworder і в user-orders).
// Фолбек на старі pay_uah / pay_eur — для замовлень, збережених локально до цього оновлення.
// Залишок до сплати — needpay_uah / needpay_eur з бекенду; якщо їх нема (старі локальні дані),
// рахуємо самі як summ - paid.
// Квиток формується при оплаті >= 70% від суми і далі НЕ зникає (фіксуємо на пристрої).

import { useLangStore } from './langStore'
import { dict } from './i18n'

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
  return cur === 'eur' ? num(o?.paid_eur ?? o?.pay_eur) : num(o?.paid_uah ?? o?.pay_uah)
}

// Залишок до сплати з бекенду, якщо є (null, якщо поле відсутнє — тоді рахуємо самі)
function needPayAmount(o: any): number | null {
  const cur = String(o?.crc || 'uah').toLowerCase()
  const v = cur === 'eur' ? o?.needpay_eur : o?.needpay_uah
  if (v === undefined || v === null || v === '') return null
  return num(v)
}

export interface PayInfo { summ: number; paid: number; ratio: number; remainder: number; ticketReady: boolean; fullyPaid: boolean; sign: string }

export function payInfo(o: any): PayInfo {
  const summ = num(o?.summ ?? o?.price)
  const paid = paidAmount(o)
  const ratio = summ > 0 ? paid / summ : 0
  const serverRemainder = needPayAmount(o)
  const remainder = serverRemainder != null ? Math.max(0, serverRemainder) : Math.max(0, +(summ - paid).toFixed(2))
  return { summ, paid, ratio, remainder, ticketReady: summ > 0 && ratio >= THRESHOLD, fullyPaid: summ > 0 && paid + 0.01 >= summ, sign: currencySign(o) }
}

// Зливаємо свіжу відповідь order_info з уже відомим замовленням, АЛЕ навмисно не даємо
// ціновим полям (summ/price/tariff) перезаписатись бекендом — це наша розрахована ціна
// з екрану бронювання, і вона має лишатись незмінною на всіх наступних кроках, незалежно
// від того, що поверне бекенд. Статус оплати/посилання й далі беруться live з fresh.
// Зливаємо свіжу відповідь user-orders з уже відомим замовленням.
// Узгоджено з Кепом: "тариф" = summ (живий, з бекенду — може змінитись: менеджер додав
// платну послугу, знижку, штраф за зміну дати тощо), "оплачено" = paid_uah/paid_eur
// (живе), "доплата" = тариф - оплачено (див. payInfo().remainder). Нічого з цього більше
// не заморожуємо — тільки те, чого user-orders реально не дає під очікуваними іменами:
// ідентифікатор замовлення (hash/oid — все ще підтверджено, що там не hash, а номер) і
// назви міст/час (там лише from1/to1/date1 — id міст і дата без години).
export function keepOurPrice(current: any, fresh: any) {
  return {
    ...fresh,
    hash: current?.hash,
    oid: current?.oid,
    from_city: fresh?.from_city || current?.from_city,
    to_city: fresh?.to_city || current?.to_city,
    fstation: fresh?.fstation || current?.fstation,
    tstation: fresh?.tstation || current?.tstation,
    ftime: fresh?.ftime || current?.ftime,
    ttime: fresh?.ttime || current?.ttime,
    roundTrip: current?.roundTrip,
    ftime2: current?.ftime2,
    ttime2: current?.ttime2,
  }
}

// Формат місця в два боки — бекенд віддає "47/44" (місце туди/місце назад через слеш).
// В один бік — просто число, лишаємо як є.
export function formatSeat(place: any): string {
  const s = String(place ?? '').trim()
  if (!s || s === '0') return '—'
  if (s.includes('/')) {
    const [out, back] = s.split('/')
    return `туди ${out} · назад ${back}`
  }
  return s
}

export function isCancelled(o: any): boolean {
  const s = String(o?.status || '').toLowerCase()
  return s.includes('cancel') || s.includes('скасов')
}

// Оплачене замовлення, яке потім скасували — критичний випадок (гроші вже списані, а
// поїздка не відбудеться), потребує звернення до підтримки, а не просто "скасовано".
export function isPaidCancellation(o: any): boolean {
  return isCancelled(o) && payInfo(o).paid > 0
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
  // Прогер підтвердив офіційні значення status: error/unpaid/complete/active/cancel.
  // 'complete' = "поїздка відбулася" — надійніший сигнал, ніж наша евристика по часу.
  const s = String(o?.status || '').toLowerCase()
  if (s === 'complete') return true
  if (s && s !== 'active') return false // явний інший статус (unpaid/cancel/error) — не complete
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
  const lang = useLangStore.getState().lang
  const L = (key: string) => dict[key]?.[lang] ?? dict[key]?.uk ?? key
  if (isPaidCancellation(o)) return { text: 'Скасовано, кошти сплачено', color: '#fff', bg: '#E53935' }
  if (isCancelled(o)) return cancelledByPassenger(o)
    ? { text: L('orders.cancelledByPassenger'), color: '#E53935', bg: '#FDECEA' }
    : { text: L('orders.cancelledStatus'), color: '#E53935', bg: '#FDECEA' }
  if (isCompleted(o)) return { text: L('orders.done'), color: '#555', bg: '#EEEEEE' }
  const pi = payInfo(o)
  if (pi.fullyPaid) return { text: L('orders.paid'), color: '#2E7D32', bg: '#E8F5E9' }
  if (pi.ticketReady) return { text: L('orders.awaitingSurcharge'), color: '#B8860B', bg: '#FFF3DC' }
  return { text: L('orders.awaitingPayment'), color: '#B8860B', bg: '#FFF3DC' }
}

// Чи потрібно опитувати order_info (екран очікування оплати/доплати)
export function needsPolling(o: any): boolean {
  if (isCancelled(o) || isCompleted(o)) return false
  return !payInfo(o).fullyPaid
}
