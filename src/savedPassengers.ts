export interface SavedPassenger { id: string; name: string; birthday?: string }

const KEY = 'eclub_saved_passengers'

export function getSavedPassengers(): SavedPassenger[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addSavedPassenger(name: string, birthday?: string): SavedPassenger[] {
  const clean = name.trim().toUpperCase()
  if (!clean) return getSavedPassengers()
  const list = getSavedPassengers()
  if (list.some(p => p.name === clean)) return list
  const next = [...list, { id: Date.now().toString(36), name: clean, birthday: birthday || undefined }]
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}

export function removeSavedPassenger(id: string): SavedPassenger[] {
  const next = getSavedPassengers().filter(p => p.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}

export function setSavedPassengerBirthday(id: string, birthday: string): SavedPassenger[] {
  const next = getSavedPassengers().map(p => p.id === id ? { ...p, birthday: birthday || undefined } : p)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}
