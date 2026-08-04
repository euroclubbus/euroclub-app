export interface Notif { id: string; title: string; body: string; date: string }

const LIST_KEY = 'eclub_notif_list'
const READ_KEY = 'eclub_notif_read'
const MAX_STORED = 50

// Реальні push-повідомлення (отримані на цьому пристрої) зберігаються тут з точним
// часом отримання. Записує їх push.ts при вході 'pushNotificationReceived'/
// 'pushNotificationActionPerformed'. Найновіші — першими.
export function getNotifs(): Notif[] {
  try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]') } catch { return [] }
}

function setNotifs(list: Notif[]) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_STORED))) } catch {}
}

export function addNotif(n: { title: string; body: string }) {
  const notif: Notif = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: n.title || '',
    body: n.body || '',
    date: new Date().toISOString(),
  }
  setNotifs([notif, ...getNotifs()])
}

export function getReadIds(): string[] {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]') } catch { return [] }
}
export function setReadIds(ids: string[]) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(ids)) } catch {}
}
export function markAllRead() {
  setReadIds(getNotifs().map(n => n.id))
}
export function getUnreadCount(): number {
  const r = getReadIds()
  return getNotifs().filter(n => !r.includes(n.id)).length
}

// Людський формат дати/часу для картки сповіщення: "03.08.2026 21:54".
export function formatNotifDate(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return iso }
}
