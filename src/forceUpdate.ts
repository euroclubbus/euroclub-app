import { useEffect, useState } from 'react'
import { getFirebaseApp } from './firebaseApp'

// Обов'язкове оновлення — settings/appVersion, поля minAndroidVersion / minIosVersion
// (керується з Firebase Console вручну, той самий підхід що й exchangeRate.ts).
// При релізі нової версії — піднімаємо відповідне поле, і всі нижче будуть заблоковані
// до оновлення. Fail-open: будь-яка помилка мережі/Firebase — застосунок не блокуємо.

export interface ForceUpdateState {
  blocked: boolean
  storeUrl: string
}

const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.eclub.app',
  ios: 'https://apps.apple.com/app/id6797055348',
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na !== nb) return na - nb
  }
  return 0
}

export function useForceUpdate(): ForceUpdateState {
  const [state, setState] = useState<ForceUpdateState>({ blocked: false, storeUrl: '' })

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined
    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web'
        if (platform !== 'android' && platform !== 'ios') return

        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        const currentVersion = info.version

        const app = await getFirebaseApp()
        if (!app || cancelled) return
        const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
        const db = getFirestore(app)
        unsub = onSnapshot(doc(db, 'settings', 'appVersion'), snap => {
          if (cancelled) return
          const data = snap.data()
          const minVersion = platform === 'android' ? data?.minAndroidVersion : data?.minIosVersion
          if (typeof minVersion !== 'string' || !minVersion) return
          const blocked = compareVersions(currentVersion, minVersion) < 0
          setState({ blocked, storeUrl: STORE_URLS[platform] })
        }, () => {})
      } catch {
        // fail-open
      }
    })()
    return () => { cancelled = true; unsub?.() }
  }, [])

  return state
}
