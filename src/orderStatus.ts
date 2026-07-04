// Значення статусу оплати з order_info поки не 100% відомі (до оплати приходить "active").
// Тому: "оплачено" = будь-що, крім явно неоплаченого. Точні значення підставимо, коли будуть.
const UNPAID = ['active', 'new', 'reserved', 'waiting', '0', '']

export function isCompleted(status?: string): boolean {
  return ['completed', 'done', 'finished', '2'].includes(String(status || '').toLowerCase())
}
export function isCancelled(status?: string): boolean {
  const s = String(status || '').toLowerCase()
  return s.includes('cancel') || s.includes('скасов')
}
export function isPaid(status?: string): boolean {
  if (!status) return false
  const s = String(status).toLowerCase()
  if (isCancelled(s)) return false
  if (isCompleted(s)) return true
  return !UNPAID.includes(s)
}
export function statusLabel(status?: string): { text: string; color: string; bg: string } {
  if (isCancelled(status)) return { text: 'Скасовано', color: '#E53935', bg: '#FDECEA' }
  if (isCompleted(status)) return { text: 'Виконане', color: '#555', bg: '#EEEEEE' }
  if (isPaid(status)) return { text: 'Оплачено', color: '#2E7D32', bg: '#E8F5E9' }
  return { text: 'Чекає оплати', color: '#B8860B', bg: '#FFF3DC' }
}
