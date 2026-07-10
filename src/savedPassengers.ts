export interface SavedPassenger { id: string; name: string }

const KEY = 'eclub_saved_passengers'

export function getSavedPassengers(): SavedPassenger[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addSavedPassenger(name: string): SavedPassenger[] {
  const clean = name.trim().toUpperCase()
  if (!clean) return getSavedPassengers()
  const list = getSavedPassengers()
  if (list.some(p => p.name === clean)) return list
  const next = [...list, { id: Date.now().toString(36), name: clean }]
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}

export function removeSavedPassenger(id: string): SavedPassenger[] {
  const next = getSavedPassengers().filter(p => p.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}
