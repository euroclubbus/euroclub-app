// Додаток — лише транзит агрегованих даних для звіту в адмін-панелі.
// Нічого з цього НЕ зберігається на пристрої і не використовується для будь-чого,
// окрім одноразової відправки в Firestore (панель керування).
//
// Дозволені поля (узгоджено з Кепом) — тільки нечутливі, агреговані:
//   userId, orderNo, ticketNumbers, tripDate, direction, fromCity/toCity, passengerCount,
//   discountIds (коди знижок, не імена), roundTrip
// НІЯКИХ імен пасажирів, телефонів, email, адрес — цього тут бути не повинно.
//
// Дані з локального списку "збережені пасажири" (діти/родина, src/savedPassengers.ts)
// НЕ передаються сюди і ніде не зберігаються, поки прогер не додасть офіційні поля
// для додаткових пасажирів в особистому кабінеті на бекенді eclub.com.ua.
//
// Firebase SDK підвантажується ЛІНИВО (dynamic import) — щоб не роздувати основний
// бандл додатку, поки Firebase взагалі не підключений (конфіг порожній) або не потрібен.

import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

export interface TripReportData {
  userId: string
  orderNo: string
  ticketNumbers: string[]
  tripDate: string // dd.mm.yyyy
  direction: string // "Kyiv → Berlin" — лишається для зворотної сумісності з тим, що вже показувалось
  fromCity: string // окремим полем — для фільтра "місто відправлення" у звіті
  toCity: string // окремим полем — для фільтра "місто прибуття"
  passengerCount: number
  discountIds: string[] // код знижки кожного пасажира ("0" = повний тариф, без фіксованої знижки)
  roundTrip: boolean
  bookingDate: string // ISO — момент, коли додаток зафіксував бронювання (не з API)
}

export async function reportTrip(data: TripReportData) {
  if (!isFirebaseConfigured()) return // Firebase ще не підключений — тихий no-op, нічого не вантажимо
  try {
    const [{ initializeApp, getApps }, { getFirestore, collection, addDoc, serverTimestamp }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    await addDoc(collection(db, 'trip_reports'), { ...data, reportedAt: serverTimestamp() })
  } catch {
    // мовчки ігноруємо помилки звітності — не критичний шлях для користувача
  }
}
