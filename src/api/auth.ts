// Авторизація йде на eclub.com.ua/input.php через проксі Worker (/input), щоб не було CORS.
const WORKER = 'https://curly-voice-8a71.eclubbus21.workers.dev'

async function inputPost(fields: Record<string, string>) {
  const body = new URLSearchParams({
    work: 'work', app: '1', lng: 'uk', uidkey: '0', ...fields,
  }).toString()
  console.log('[EuroClub AUTH] →', fields.opr, fields.email || '')
  const res = await fetch(`${WORKER}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
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
export const getUserOrders = () => inputPost({ opr: 'user-orders', uidkey: currentUidKey() })

// Редагування профілю. Поля можна передавати разом або окремо: header/email/pass/phone
export const editProfile = (fields: Partial<{ header: string; email: string; pass: string; phone: string }>) =>
  inputPost({ opr: 'edit', uidkey: currentUidKey(), ...fields })

// Офіційне застосування промокоду до вже створеного замовлення (не наш ігровий, а справжній
// метод бекенду). Працює інакше, ніж наш тимчасовий: списує знижку ПІСЛЯ створення замовлення,
// по oid (номер замовлення), а не як зменшення ціни заздалегідь.
export const applyPromoCode = (code: string, oid: string) =>
  inputPost({ mod: 'procode', code, oid, uidkey: currentUidKey() })
