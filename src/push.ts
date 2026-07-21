import { saveDeviceToken } from './api/auth'
import { useAuthStore } from './authStore'
import { getFirebaseApp } from './firebaseApp'

// Крім eclub.com.ua (де вже давно приймається токен через addtoken), пишемо той самий
// токен і в Firestore — прив'язаний до ID користувача з логіну EuroClub (той самий id,
// що йде в reportTrip). Без цього кроку панель адміністратора не може надіслати push
// конкретному користувачу — вона знає тільки Firestore, а не бекенд бронювання.
async function saveTokenToFirestore(token: string, platform: 'android' | 'ios') {
  try {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return // ще не залогінений — токен піде в Firestore пізніше, при наступній реєстрації
    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, doc, setDoc } = await import('firebase/firestore')
    const db = getFirestore(app)
    await setDoc(doc(db, 'device_tokens', String(userId)), { token, platform, updatedAt: Date.now() })
  } catch (e) {
    console.error('[Push] Firestore token save failed', e)
  }
}

// Реєстрація push-токена працює тільки в нативному застосунку (Capacitor), не в браузері/PWA.
// Викликати після того, як користувач дав дозвіл на сповіщення.
export async function registerPushToken() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return // PWA/веб — токена нема, пропускаємо тихо

    const { PushNotifications } = await import('@capacitor/push-notifications')
    const platform = Capacitor.getPlatform() // 'android' | 'ios'
    const appCode: '1' | '2' = platform === 'ios' ? '2' : '1'

    const perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      const req = await PushNotifications.requestPermissions()
      if (req.receive !== 'granted') return
    }

    await PushNotifications.register()

    PushNotifications.addListener('registration', (token) => {
      saveDeviceToken(token.value, appCode).catch(() => {})
      saveTokenToFirestore(token.value, platform === 'ios' ? 'ios' : 'android')
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error', err)
    })
  } catch (e) {
    console.error('[Push] setup failed', e)
  }
}
