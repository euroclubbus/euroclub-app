import { Capacitor } from '@capacitor/core'
import { useAuthStore } from './authStore'
import { getFirebaseApp } from './firebaseApp'

// Кеп (01.09): своя статистика встановлень — усього/зареєстрованих, БЕЗ прив'язки до
// логіну чи push-дозволу (той механізм, чому 2000 встановлень давали лише 13
// зареєстрованих push-токенів — люди, які НЕ логінились чи не дали дозвіл на
// сповіщення, взагалі не потрапляли в жодну нашу статистику). Пишеться в Firestore
// app_installs/{deviceId} — той самий стабільний deviceId, що вже є в push.ts (не
// вигадуємо окремий installId, це вже те саме поняття).
const DEVICE_ID_KEY = 'eclub_device_id'

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// Пишемо не частіше разу на 6 годин — щоб не бити по Firestore при кожному
// відкритті/переключенні застосунку, і водночас "lastSeenAt" лишався достатньо свіжим
// для аналітики активності.
const THROTTLE_KEY = 'eclub_install_ping_at'
const THROTTLE_MS = 6 * 60 * 60 * 1000

export async function pingInstall(userId?: string | null) {
  try {
    const last = Number(localStorage.getItem(THROTTLE_KEY) || 0)
    const now = Date.now()
    if (now - last < THROTTLE_MS && !userId) return // userId з'явився вперше — пишемо одразу, ігноруючи throttle
    localStorage.setItem(THROTTLE_KEY, String(now))

    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    const db = getFirestore(app)

    const deviceId = getDeviceId()
    const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'pwa' // 'android' | 'ios' | 'pwa'
    const appVersion = (window as any).__APP_VERSION__ || 'unknown'

    const isFirstPing = !localStorage.getItem('eclub_install_first_seen')
    if (isFirstPing) localStorage.setItem('eclub_install_first_seen', String(now))

    await setDoc(doc(db, 'app_installs', deviceId), {
      platform,
      appVersion,
      lastSeenAt: serverTimestamp(),
      ...(isFirstPing ? { firstSeenAt: serverTimestamp() } : {}),
      ...(userId ? { userId: String(userId) } : {}),
    }, { merge: true })
  } catch (e) {
    // Кеп (01.09): тимчасово логуємо — сторінка "Встановлення" в адмінці порожня,
    // причина ще не з'ясована (найімовірніше — Firestore security rules не покривають
    // цю НОВУ колекцію app_installs, дефолтна заборона). Приберемо після діагностики.
    console.error('[InstallTracking] pingInstall failed:', e)
  }
}
