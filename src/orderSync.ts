// Управління списком синхронізованих замовлень в localStorage

const SYNCED_OIDS_KEY = 'euroclub_synced_oids'

/**
 * Отримати список уже синхронізованих oid
 */
export function getSyncedOids(): string[] {
  try {
    console.log('[OrderSync] getSyncedOids called')
    const raw = localStorage.getItem(SYNCED_OIDS_KEY)
    console.log('[OrderSync] Raw localStorage value:', raw)
    const data = raw ? JSON.parse(raw) : []
    console.log('[OrderSync] Parsed data:', data)
    return data
  } catch (e) {
    console.error('[OrderSync] Error in getSyncedOids:', e)
    return []
  }
}

/**
 * Додати oid в список синхронізованих
 */
export function addSyncedOid(oid: string): void {
  try {
    const oids = getSyncedOids()
    if (!oids.includes(String(oid))) {
      oids.push(String(oid))
      localStorage.setItem(SYNCED_OIDS_KEY, JSON.stringify(oids))
    }
  } catch (e) {
    console.error('[OrderSync] Failed to add oid:', e)
  }
}

/**
 * Додати кілька oid одразу
 */
export function addSyncedOids(oidList: (string | number)[]): void {
  console.log('[OrderSync] Adding oids:', oidList)
  try {
    const oids = getSyncedOids()
    console.log('[OrderSync] Current synced:', oids)
    let changed = false
    for (const oid of oidList) {
      const oidStr = String(oid)
      if (!oids.includes(oidStr)) {
        oids.push(oidStr)
        changed = true
      }
    }
    if (changed) {
      localStorage.setItem(SYNCED_OIDS_KEY, JSON.stringify(oids))
      console.log('[OrderSync] Saved to localStorage:', oids)
    } else {
      console.log('[OrderSync] No changes, all oids already synced')
    }
  } catch (e) {
    console.error('[OrderSync] Failed to add oids:', e)
  }
}

/**
 * Чи це замовлення вже синхронізоване?
 */
export function isOidSynced(oid: string | number): boolean {
  return getSyncedOids().includes(String(oid))
}

/**
 * Очистити список синхронізованих (для логауту)
 */
export function clearSyncedOids(): void {
  try {
    localStorage.removeItem(SYNCED_OIDS_KEY)
  } catch (e) {
    console.error('[OrderSync] Failed to clear oids:', e)
  }
}
