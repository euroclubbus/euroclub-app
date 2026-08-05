// Авторизація йде на eclub.com.ua/input.php через проксі Worker (/input), щоб не було CORS.
const WORKER = 'https://curly-voice-8a71.eclubbus21.workers.dev'

// app=1 для Android/web, app=2 для iOS — бекенд розрізняє платформу саме за цим полем
// (домовлено з розробником бекенду 04.08). iOS-застосунок ЗАВЖДИ app=2, незалежно від
// того, PWA це чи нативний білд — визначаємо через navigator.userAgent (простіше й
// надійніше за Capacitor.getPlatform(), бо ця функція викликається і поза React-деревом,
// де синхронний імпорт @capacitor/core в усіх контекстах гарантувати важче).
const APP_PLATFORM: '1' | '2' = /iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? '2' : '1'

async function inputPost(fields: Record<string, string>) {
  const body = new URLSearchParams({
    work: 'work', app: APP_PLATFORM, lng: 'uk', uidkey: '0', ...fields,
  }).toString()
  console.log('[EuroClub AUTH] →', fields.opr, fields.email || '')
  const res = await fetch(`${WORKER}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  const raw = await res.text()
  console.log('[EuroClub AUTH] ← RAW', fields.opr, 'status:', res.status, 'body:', raw)
  let json: any
  try {
    json = JSON.parse(raw)
  } catch (e) {
    console.error('[EuroClub AUTH] JSON parse failed for', fields.opr, e)
    throw e
  }
  console.log('[EuroClub AUTH] ←', fields.opr, json)
  return json
}

import { currentUidKey } from '../authStore'

export const authLogin = (email: string, pass: string) => inputPost({ opr: 'login', email, pass, mod: 'apimobile' })
export const authRegister = (email: string, pass: string, header: string) => inputPost({ opr: 'reg', email, pass, header, mod: 'apimobile' })
export const authRepass1 = (email: string) => inputPost({ opr: 'repass_1', email, mod: 'apimobile' })
export const authRepass2 = (email: string, code: string) => inputPost({ opr: 'repass_2', email, code, mod: 'apimobile' })
export const authRepass3 = (email: string, pass: string, code: string) => inputPost({ opr: 'repass_3', email, pass, code, mod: 'apimobile' })

// Історія всіх замовлень користувача (не тільки ті, що збережені локально на цьому пристрої)
// _ts — унікальне число в кожному запиті, щоб пробити можливий сервер-сайд кеш на боці
// eclub.com.ua (якщо там кешуються POST-відповіді з однаковим тілом). Бекенд це поле не
// використовує, просто ігнорує — воно тут тільки для унікальності запиту.
export const getUserOrders = () => inputPost({ mod: 'apimobile', opr: 'user-orders', uidkey: currentUidKey(), _ts: String(Date.now()) })

// Скасування і відновлення замовлення — підтверджено прогером: НЕ старий /v1/json/
// order_cancel|order_restore (застарілий, з полем hash), а /input з mod=apimobile,
// opr=cancel|restore, і oid (номер замовлення). Відповідь: {status:'ok'} або
// {status:'error', text}. Раніше застосунок бив у мертвий ендпоінт і сліпо показував
// "успіх", щойно запит не падав мережево — не перевіряючи РЕАЛЬНУ відповідь бекенду.
export async function cancelOrderApi(oid: string): Promise<{ ok: boolean; error?: string }> {
  const res: any = await inputPost({ mod: 'apimobile', opr: 'cancel', oid, uidkey: currentUidKey() })
  if (res?.status === 'ok') return { ok: true }
  return { ok: false, error: res?.text || 'Не вдалося скасувати замовлення' }
}
export async function restoreOrderApi(oid: string): Promise<{ ok: boolean; error?: string }> {
  const res: any = await inputPost({ mod: 'apimobile', opr: 'restore', oid, uidkey: currentUidKey() })
  if (res?.status === 'ok') return { ok: true }
  return { ok: false, error: res?.text || 'Не вдалося відновити замовлення' }
}

// order_info вже НЕ використовується (підтверджено прогером) — замість нього user-orders,
// звідти шукаємо потрібне замовлення за oid. Це єдиний офіційний спосіб оновити статус/
// оплату конкретного замовлення тепер.
export async function findUserOrder(oid: string): Promise<any | null> {
  const res: any = await getUserOrders()
  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
  return list.find((o: any) => String(o.oid ?? o.hash) === String(oid)) || null
}

// Редагування профілю. Поля можна передавати разом або окремо: header/email/pass/phone
export const editProfile = (fields: Partial<{ header: string; email: string; pass: string; phone: string }>) =>
  inputPost({ mod: 'apimobile', opr: 'edit', uidkey: currentUidKey(), ...fields })

// Зберегти FCM-токен пристрою для push-сповіщень
export const saveDeviceToken = (token: string, app: '1' | '2') =>
  inputPost({ mod: 'apimobile', opr: 'addtoken', token, app, uidkey: currentUidKey() })

// Оплата бонусами: списати bonuse грн з рахунку користувача на замовлення oid.
// Ліміт (10% від вартості) перевіряє сам бекенд, ми тут нічого не рахуємо самі.
export const addBonusPayment = (bonuse: string, crc: 'uah' | 'eur', oid: string) =>
  inputPost({ mod: 'addbonus', bonuse, crc, oid, uidkey: currentUidKey() })

// Офіційне застосування промокоду до вже створеного замовлення (не наш ігровий, а справжній
// метод бекенду). Працює інакше, ніж наш тимчасовий: списує знижку ПІСЛЯ створення замовлення,
// по oid (номер замовлення), а не як зменшення ціни заздалегідь.
export const applyPromoCode = (code: string, oid: string) =>
  inputPost({ mod: 'procode', code, oid, uidkey: currentUidKey() })

// Нове замовлення (задокументована версія, opr=neworder). На відміну від старого order_new
// (окремий /v1/json/order_new/ ендпоінт), це йде через /input. ПІДТВЕРДЖЕНО прогером:
// відповідь дає `oid` (номер замовлення), НЕ `hash` — order_info більше не використовується
// взагалі (застарілий метод), для оновлення статусу/оплати — тільки user-orders + пошук за oid
// (див. findUserOrder нижче).
export interface NewOrderPassenger { name: string; discount: string; place1?: string; place2?: string }

export async function createOrderNew(
  fields: { email: string; phone: string; header: string; price: string; crc: 'uah' | 'eur'; from: string; to: string; route1: string; route2?: string },
  passengers: NewOrderPassenger[]
) {
  const body = new URLSearchParams()
  body.set('work', 'work')
  body.set('app', APP_PLATFORM)
  body.set('lng', 'uk')
  body.set('uidkey', currentUidKey())
  body.set('mod', 'apimobile')
  body.set('opr', 'neworder')
  for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
    const v = fields[k]
    if (v !== undefined) body.set(k, String(v))
  }
  passengers.forEach(p => {
    body.append('psgr_name[]', p.name)
    body.append('psgr_dscnt[]', p.discount)
    body.append('place_1[]', p.place1 ?? '')
    if (p.place2 !== undefined) body.append('place_2[]', p.place2)
  })
  console.log('[EuroClub AUTH] → neworder', body.toString())
  const res = await fetch(`${WORKER}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const raw = await res.text()
  console.log('[EuroClub AUTH] ← RAW neworder status:', res.status, 'body:', raw)
  return JSON.parse(raw)
}
