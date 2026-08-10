// Реєстр замовлень для панелі керування — на відміну від reporting.ts (одноразовий,
// незмінний звіт), цей документ ПОТІМ редагується адміном (знижка/тариф пасажира), тому
// одразу пишемо editHistory: [] і поле createdAt з точним часом створення.
// Ідентифікатори пасажирів анонімні (Пасажир 1/2/3) — жодних імен сюди не йде.
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

export interface OrderRegistryPassenger {
  index: number // 1, 2, 3...
  ticketNumber: string
  discountName: string
  discountPercent: number
  tariff: number // повна ціна квитка (до знижки)
  price: number // ціна з урахуванням знижки — те, що реально бачить і платить пасажир
}

export interface OrderRegistryData {
  orderNo: string
  userEmail?: string // для аналітики в адмінці — скільки замовлень цього юзера через застосунок
  totalOrdersCount?: number // повна історія юзера (всі канали) на момент цього бронювання —
  // забирається одразу тут, поки жива сесія юзера (він щойно залогінений), бо окремого
  // адмін-методу для довільного email на бекенді нема
  fromCity: string
  toCity: string
  tripDate: string // dd.mm.yyyy — рейс туди
  tripDate2?: string // дата зворотного рейсу, якщо є
  roundTrip: boolean
  createdAt: string // ISO, точна дата й час створення
  passengers: OrderRegistryPassenger[]
}

export async function writeOrderRegistry(data: OrderRegistryData) {
  if (!isFirebaseConfigured()) return
  try {
    const [{ initializeApp, getApps }, { getFirestore, doc, setDoc }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    // Firestore відмовляється писати undefined-поля (наприклад tripDate2 для one-way,
    // де воно свідомо undefined) — раніше через це весь запис мовчки падав (лише
    // console.error, замовлення в реєстрі просто ніколи не з'являлось). Прибираємо такі
    // поля перед записом, а не намагаємось писати undefined.
    const clean: any = {}
    for (const [k, v] of Object.entries({ ...data, editHistory: [] })) {
      if (v !== undefined) clean[k] = v
    }
    await setDoc(doc(db, 'order_registry', data.orderNo), clean)
  } catch (e) {
    console.error('[OrderRegistry] write failed', e)
  }
}

// Реальний статус/оплата з бекенду (status, paid_uah, paid_eur) — пишемо в реєстр окремим,
// легким апдейтом (не переписуючи весь документ) щоразу, коли застосунок і так отримує
// свіжі дані під час опитування. Панель показує це як "реальний статус з бекенду",
// незалежно від нашого власного (ручного) перемикача "Оплачено" в самій панелі.
export async function syncOrderRegistryStatus(orderNo: string, status: number | string | undefined, paidUah: number, paidEur: number) {
  if (!isFirebaseConfigured() || !orderNo) return
  try {
    const [{ initializeApp, getApps }, { getFirestore, doc, setDoc }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    await setDoc(doc(db, 'order_registry', orderNo), {
      backendStatus: status ?? null,
      backendPaidUah: paidUah || 0,
      backendPaidEur: paidEur || 0,
      backendSyncedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (e) {
    console.error('[OrderRegistry] status sync failed', e)
  }
}
