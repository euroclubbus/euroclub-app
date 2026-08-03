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

// Бекенд повертає departures1/arrivals1/departures2/arrivals2 то як масив [{...}]
// (напр. для замовлень з пересадкою — кілька зупинок), то як просто об'єкт {...}
// (пряме сполучення, одна зупинка) — залежно від маршруту й ендпоінту (user-orders
// частіше віддає об'єкт). Код усюди читав це як масив (?.[0]?.field) — для об'єктного
// варіанту [0] завжди давав undefined, і час/станція зникали повністю. Ця функція
// приводить обидва варіанти до одного вигляду.
export function legInfo(v: any): any {
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
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
  const displayFields = {
    from_city: fresh?.from_city || current?.from_city,
    to_city: fresh?.to_city || current?.to_city,
    fstation: fresh?.fstation || current?.fstation,
    tstation: fresh?.tstation || current?.tstation,
    ftime: fresh?.ftime || current?.ftime,
    ttime: fresh?.ttime || current?.ttime,
    roundTrip: current?.roundTrip,
    ftime2: current?.ftime2,
    ttime2: current?.ttime2,
    // Дата бронювання — суто наша, локальна позначка (бекенд її не віддає) для сортування
    // "останнє зверху". Раніше губилась при кожному мержі зі свіжими даними з сервера.
    bookingDate: current?.bookingDate,
  }
  // Двобічні замовлення: summ/price/tariff більше НЕ заморожуються тут назавжди — це
  // тепер керується на рівні екрана (OrderSuccess.tsx/Payment.tsx), де є доступ до часу й
  // кількості оновлень: спочатку показуємо нашу передану суму, і лише після ПЕРШОГО реального
  // оновлення І щонайменше 5с з моменту показу — переходимо на живі дані бекенду. Одностороннім
  // завжди довіряємо бекенду одразу, без жодних умов.
  return { ...fresh, hash: current?.hash, oid: current?.oid, ...displayFields }
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

// Розподіл живої суми (summ) між пасажирами ПРОПОРЦІЙНО до співвідношення їхніх цін одна
// до одної. Абсолютні значення prc/price з бекенду можуть бути застарілими (менеджер
// поміняв загальну суму замовлення, а рядки пасажирів лишились зі старого стану) — але
// СПІВВІДНОШЕННЯ між пасажирами (хто на повному тарифі, хто зі знижкою) лишається вірним.
// Приклад: summ=1.9, один повний, інший зі знижкою -10% (вага 1 і 0.9) → 1 і 0.9.
// ОДНЕ місце для цієї формули — більше ніде price/prc пасажира напряму для показу не береться.
export function passengerDisplayPrices(summ: number, passengers: any[]): number[] {
  const weights = passengers.map(p => Number(p?.prc ?? p?.price ?? 0))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (!(totalWeight > 0) || !passengers.length) {
    const equal = passengers.length ? summ / passengers.length : 0
    return passengers.map(() => equal)
  }
  return weights.map(w => summ * w / totalWeight)
}
// Прогер підтвердив офіційні числові коди status: 0=скасовано, 1=не сплачено,
// 2=оплачено (поїздка ще не відбулася, або відбулася лише частково — напр. round-trip
// назад ще попереду), 3=оплачено, поїздка повністю відбулася.
// РАНІШЕ тут була перевірка рядків ('cancel'/'скасов') — з реальних даних бекенд віддає
// status числом, і ця перевірка НІКОЛИ не спрацьовувала (скасовані замовлення показувались
// як "очікує оплати"). Виправлено.
export function isCancelled(o: any): boolean {
  return Number(o?.status) === 0
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
  if (o?.status != null && o.status !== '') return Number(o.status) === 3
  // status відсутній (напр. локальний ще не підтверджений об'єкт) — фолбек по часу відправлення
  const d = parseDT(o?.ttime)
  return d ? d.getTime() < Date.now() : false
}

// Годин до відправлення (null якщо дату не розпізнано)
export function hoursUntilDeparture(o: any): number | null {
  const d = parseDT(o?.ftime)
  return d ? (d.getTime() - Date.now()) / 3600000 : null
}

// Відновити можна лише неоплачене і скасоване замовлення, і лише якщо до рейсу > 24 год.
// ВАЖЛИВО: якщо ftime невідомий (не завжди повертається в user-orders — див. коментарі
// в keepOurPrice), це НЕ означає "менше 24 годин" — це "не можемо перевірити". Раніше обидва
// випадки показували один і той самий текст "менше 24 годин", що вводило в оману, коли
// причина була просто у відсутніх даних, а не в реальній близькості рейсу.
export type RestoreBlockReason = 'ok' | 'too_close' | 'unknown_date' | 'paid' | 'not_cancelled'
export function restoreEligibility(o: any): RestoreBlockReason {
  if (!isCancelled(o)) return 'not_cancelled'
  if (payInfo(o).paid > 0) return 'paid'
  const h = hoursUntilDeparture(o)
  if (h === null) return 'unknown_date'
  return h > 24 ? 'ok' : 'too_close'
}
export function canRestore(o: any): boolean {
  return restoreEligibility(o) === 'ok'
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

// Синхронізація даних про рейс з бекенду — гарантує що інформація завжди свіжа
// незалежно від того, з якого пристрою зроблено замовлення.
// Це chiamadо при завантаженні квитка щоб переконатись що дані отримані з сервера,
// а не з локального кешу.
export function ensureRoundTripSync(orderData: any): any {
  // Перевіряємо що дані про другу поїздку присутні для round-trip замовлень
  if (!orderData) return orderData
  
  // Якщо це round-trip замовління але дані про другу поїздку відсутні — дані неповні
  // і потребують оновлення з бекенду
  const isRoundTrip = orderData?.plc && (orderData.plc.includes('/') || orderData.plc.includes('47'))
  
  if (isRoundTrip) {
    // Логування для діагностики
    if (!orderData?.ftime2 || !orderData?.ttime2) {
      console.warn('[Ticket] Round-trip order missing return trip data - requires backend sync')
    }
  }
  
  return orderData
}
