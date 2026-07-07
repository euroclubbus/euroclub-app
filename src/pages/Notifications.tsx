export interface Notif { id: string; title: string; body: string; date: string }

// Демо-дані (реальні прилітатимуть з бекенду/FCM на етапі APK)
export const DEMO_NOTIFS: Notif[] = []

const KEY = 'eclub_notif_read'

export function getReadIds(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
export function setReadIds(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch {}
}
export function markAllRead() {
  setReadIds(DEMO_NOTIFS.map(n => n.id))
}
export function getUnreadCount(): number {
  const r = getReadIds()
  return DEMO_NOTIFS.filter(n => !r.includes(n.id)).length
}
