export interface Notif { id: string; title: string; body: string; date: string }

// Демо-дані (реальні прилітатимуть з бекенду/FCM на етапі APK)
export const DEMO_NOTIFS: Notif[] = [
  { id: 'n1', title: 'Оплата пройшла', body: 'Ваше замовлення 000996546 оплачено. Квиток доступний у додатку.', date: '03.07 10:28' },
  { id: 'n2', title: 'Нагадування про виїзд', body: 'Автобус Київ → Берлін виїжджає завтра о 07:50. Прибудьте на посадку за 30 хвилин.', date: '02.07 18:00' },
  { id: 'n3', title: 'Знижка −10%', body: 'Промокод SUMMER10 на рейси до Європи — діє до кінця місяця.', date: '01.07 12:15' },
]

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
