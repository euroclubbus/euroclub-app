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
