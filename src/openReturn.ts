// "Відкрита дата повернення" — фіксація зворотної дати після бронювання.
// -----------------------------------------------------------------------------
// Бекенд (neworder) не має типу замовлення "round trip з невизначеною датою назад" —
// коли пасажир на пошуку обирає "Відкрита дата повернення", застосунок бронює лише
// квиток "туди" (звичайне одностороннє замовлення). Щоб пасажир міг пізніше сам
// зафіксувати дату повернення, зберігаємо окремий маркер у Firestore
// (open_returns/{oid}) — саме замовлення на бекенді про це нічого не знає.
//
// Флоу: маркер створюється одразу після успішного бронювання (Booking.tsx). На екрані
// квитка (Ticket.tsx) кнопка "Зафіксувати дату повернення" видима, поки: маркер існує,
// requested === false, і дедлайн (180 днів від дати поїздки туди) ще не минув. Пасажир
// обирає дату в календарі → тиснемо "Зафіксувати" → відкривається mailto (лист на
// euroclubbus@gmail.com з даними) → маркер позначається requested: true. Саму фіксацію
// на бекенді робить менеджер вручну (додає route2/date2/departures2 до замовлення) —
// щойно це станеться, Ticket.tsx САМ покаже зворотний рейс (isRoundTrip там вже
// визначається живими даними з бекенду, не залежить від цього маркера).
// -----------------------------------------------------------------------------
import { getFirebaseApp } from './firebaseApp'

export interface OpenReturnMarker {
  oid: string
  passengers: string[]
  contactEmail: string
  firstTripDateISO: string // дата поїздки "туди", YYYY-MM-DD
  deadlineISO: string // firstTripDateISO + 180 днів
  requested: boolean
  chosenDateISO?: string
  createdAt: number
  requestedAt?: number
}

const DEADLINE_DAYS = 180

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// Викликається одразу після успішного одностороннього бронювання, коли на пошуку була
// обрана "Відкрита дата повернення". Мовчки не робить нічого при недоступності Firestore.
export async function saveOpenReturnMarker(params: {
  oid: string
  passengers: string[]
  contactEmail: string
  firstTripDateISO: string
}) {
  try {
    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, doc, setDoc } = await import('firebase/firestore')
    const db = getFirestore(app)
    const marker: OpenReturnMarker = {
      oid: params.oid,
      passengers: params.passengers,
      contactEmail: params.contactEmail,
      firstTripDateISO: params.firstTripDateISO,
      deadlineISO: addDaysISO(params.firstTripDateISO, DEADLINE_DAYS),
      requested: false,
      createdAt: Date.now(),
    }
    await setDoc(doc(db, 'open_returns', params.oid), marker)
  } catch (e) {
    console.error('[OpenReturn] save marker failed', e)
  }
}

// Читає маркер для конкретного замовлення. null — якщо немає (звичайне замовлення без
// відкритої дати) або Firestore недоступний.
export async function fetchOpenReturnMarker(oid: string): Promise<OpenReturnMarker | null> {
  if (!oid) return null
  try {
    const app = await getFirebaseApp()
    if (!app) return null
    const { getFirestore, doc, getDoc } = await import('firebase/firestore')
    const db = getFirestore(app)
    const snap = await getDoc(doc(db, 'open_returns', oid))
    if (!snap.exists()) return null
    return snap.data() as OpenReturnMarker
  } catch (e) {
    console.error('[OpenReturn] fetch marker failed', e)
    return null
  }
}

// Позначає, що пасажир обрав дату й запит на фіксацію надіслано (лист відкрито).
// Ховає кнопку на екрані квитка, щоб не слати дублікати запитів.
export async function markOpenReturnRequested(oid: string, chosenDateISO: string) {
  try {
    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, doc, updateDoc } = await import('firebase/firestore')
    const db = getFirestore(app)
    await updateDoc(doc(db, 'open_returns', oid), { requested: true, chosenDateISO, requestedAt: Date.now() })
  } catch (e) {
    console.error('[OpenReturn] mark requested failed', e)
  }
}

function fmtUA(dateISO: string): string {
  const [y, m, d] = dateISO.split('-')
  return `${d}.${m}.${y}`
}

// Формує mailto:-посилання з темою й тілом листа для фіксації дати повернення.
export function buildFixationMailto(marker: OpenReturnMarker, chosenDateISO: string): string {
  const subject = 'Фіксація вільної дати з додатку'
  const bodyLines = [
    `Номер замовлення (oid): ${marker.oid}`,
    `Пасажири: ${marker.passengers.filter(Boolean).join(', ') || '—'}`,
    `Email замовника: ${marker.contactEmail || '—'}`,
    `Дата поїздки "туди": ${fmtUA(marker.firstTripDateISO)}`,
    `Обрана дата зворотного квитка: ${fmtUA(chosenDateISO)}`,
  ]
  const body = bodyLines.join('\n')
  return `mailto:euroclubbus@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
