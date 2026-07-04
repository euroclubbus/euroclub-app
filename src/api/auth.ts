// Авторизація йде на eclub.com.ua/input.php через проксі Worker (/input), щоб не було CORS.
const WORKER = 'https://curly-voice-8a71.eclubbus21.workers.dev'

async function inputPost(fields: Record<string, string>) {
  const body = new URLSearchParams({
    work: 'work', app: '1', lng: 'uk', uidkey: '0', mod: 'apimobile', ...fields,
  }).toString()
  console.log('[EuroClub AUTH] →', fields.opr, fields.email || '')
  const res = await fetch(`${WORKER}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  console.log('[EuroClub AUTH] ←', fields.opr, json)
  return json
}

export const authLogin = (email: string, pass: string) => inputPost({ opr: 'login', email, pass })
export const authRegister = (email: string, pass: string, header: string) => inputPost({ opr: 'reg', email, pass, header })
export const authRepass1 = (email: string) => inputPost({ opr: 'repass_1', email })
export const authRepass2 = (email: string, code: string) => inputPost({ opr: 'repass_2', email, code })
export const authRepass3 = (email: string, pass: string, code: string) => inputPost({ opr: 'repass_3', email, pass, code })
