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
  userId?: string // = device_tokens/{userId} — потрібен для адресної розсилки сповіщень
  // по конкретному замовленню з адмінки (userEmail самого по собі не досить, токени
  // прив'язані до userId, не email)
  appPlatform?: '1' | '2' // = APP_PLATFORM, той самий "app" параметр, що йде на бекенд у
  // КОЖНОМУ запиті (api/auth.ts). 1 = Android/PWA (не розрізняються бекендом), 2 = iOS.
  // Кеп (17.08): хоче бачити джерело кожного замовлення в реєстрі.
  backendAppPlatform?: string // те саме, але з ЖИВОЇ відповіді бекенду (user-orders
  // повертає власне поле "app" по кожному замовленню) — джерело правди, синхронізується
  // автоматично щоразу, коли юзер відкриває застосунок (навіть для СТАРИХ замовлень,
  // зроблених до того, як ми взагалі почали щось записувати самі).
  backendUserId?: string // те саме, але бекенд повертає "user_id" напряму в user-orders
  // ({"oid":"992176","app":"0","user_id":"331124",...}) — джерело правди для ідентифікації
  // юзера, синхронізується тим самим механізмом, ретроактивно для старих замовлень теж.
  route1: string // = trip.id.split('-')[0], те саме значення, що йде на бекенд у createOrderNew
  // — дозволяє фільтрувати всі замовлення одного конкретного рейсу в адмінці
  totalOrdersCount?: number // повна історія юзера (всі канали) на момент цього бронювання —
  // забирається одразу тут, поки жива сесія юзера (він щойно залогінений), бо окремого
  // адмін-методу для довільного email на бекенді нема
  viaApp?: boolean // true = нативний Android/iOS застосунок, false = PWA/сайт у браузері —
  // Booking.tsx однаковий для обох, тому без цього поля "з додатку" в адмінці рахувало б і
  // сайт теж
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
export async function syncOrderRegistryStatus(orderNo: string, status: number | string | undefined, paidUah: number, paidEur: number, backendApp?: string | number, backendUserId?: string | number) {
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
      // Кеп (17.08): бекенд ТАКИ повертає "app" (1|2) в user-orders — підтверджено живим
      // прикладом ({"oid":"906727","app":"1",...}). Це джерело правди, на відміну від
      // нашого власного appPlatform (пишеться тільки в момент бронювання клієнтом). Синк
      // відбувається щоразу, коли юзер відкриває застосунок — тому це працює НАВІТЬ для
      // старих замовлень, зроблених до того, як ми взагалі почали щось записувати.
      ...(backendApp !== undefined && backendApp !== null && backendApp !== '' ? { backendAppPlatform: String(backendApp) } : {}),
      // Кеп (17.08, той самий вечір): бекенд ТАКОЖ повертає "user_id" в user-orders
      // ({"oid":"992176","app":"0","user_id":"331124",...}) — той самий механізм, той
      // самий ретроактивний ефект для старих замовлень.
      ...(backendUserId !== undefined && backendUserId !== null && backendUserId !== '' ? { backendUserId: String(backendUserId) } : {}),
    }, { merge: true })
  } catch (e) {
    console.error('[OrderRegistry] status sync failed', e)
  }
}

// Кеп (19.08): user-orders ЗАВЖДИ повертає ПОВНИЙ масив усіх замовлень юзера — не тільки
// те, за яким ми зараз слідкуємо. Досі ми (useOrderPolling/findUserOrder) брали з цього
// масиву ОДНЕ замовлення і викидали решту — хоча кожен елемент масиву вже має
// status/paid_uah/paid_eur/app/user_id, тобто МОЖНА синхронізувати ВЕСЬ список за один
// прохід, без жодного додаткового запиту до бекенду. Той самий підхід уже був у
// MyTickets.tsx (по колу) — тут виносимо його в спільну функцію, щоб не дублювати логіку,
// і починаємо застосовувати її й на useOrderPolling (Payment/Ticket/OrderSuccess) — це
// набагато частіше використовуваний шлях, ніж відкриття "Моїх замовлень", тому реально
// прискорює "прогрівання" реєстру для ВСІХ замовлень юзера, не лише поточного.
const lastSyncedPerOrder = new Map<string, string>()
export function syncAllOrdersInList(list: any[]) {
  for (const o of list) {
    const id = o?.oid ?? o?.hash
    if (!id) continue
    const orderNo = String(id)
    const key = `${o.status}|${o.paid_uah}|${o.paid_eur}|${o.app ?? ''}|${o.user_id ?? ''}`
    if (lastSyncedPerOrder.get(orderNo) === key) continue
    lastSyncedPerOrder.set(orderNo, key)
    syncOrderRegistryStatus(orderNo, o.status, Number(o.paid_uah) || 0, Number(o.paid_eur) || 0, o.app, o.user_id)
  }
}
