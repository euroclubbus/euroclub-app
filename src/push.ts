import { saveDeviceToken } from './api/auth'
import { useAuthStore } from './authStore'
import { getFirebaseApp } from './firebaseApp'
import { addNotif } from './notifications'

const DEVICE_ID_KEY = 'eclub_device_id'

// Стабільний ID цього конкретного пристрою/інсталяції — генерується один раз і
// зберігається в localStorage, живе, поки застосунок не перевстановлять. Потрібен,
// щоб один user_id міг мати кілька одночасно активних пристроїв (кожен зі своїм
// токеном) замість того, щоб новий вхід затирав токен попереднього пристрою.
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// Крім eclub.com.ua (де вже давно приймається токен через addtoken), пишемо той самий
// токен і в Firestore — прив'язаний до ID користувача з логіну EuroClub (той самий id,
// що йде в reportTrip) ТА до ID цього конкретного пристрою. Без цього кроку панель
// адміністратора не може надіслати push конкретному користувачу — вона знає тільки
// Firestore, а не бекенд бронювання. Підколекція (не один документ на юзера) дозволяє
// одному user_id мати кілька активних пристроїв одночасно.
async function saveTokenToFirestore(token: string, platform: 'android' | 'ios') {
  try {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return // ще не залогінений — токен піде в Firestore пізніше, при наступній реєстрації
    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, doc, setDoc } = await import('firebase/firestore')
    const db = getFirestore(app)
    const deviceId = getDeviceId()
    await setDoc(doc(db, 'device_tokens', String(userId), 'devices', deviceId), { token, platform, updatedAt: Date.now() })
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

    // Записуємо повідомлення локально (з точним часом), щоб воно було видно у
    // вкладці "Сповіщення" — раніше це ніде не зберігалось, спливаюче показувала
    // тільки сама ОС, і після закриття банера повідомлення губилось назавжди.
    // 'pushNotificationReceived' — застосунок був відкритий (foreground).
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      addNotif({ title: notification.title || '', body: notification.body || '' })
    })
    // 'pushNotificationActionPerformed' — користувач тапнув на повідомлення, коли
    // застосунок був згорнутий/закритий (тут дані лежать у вкладеному .notification).
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const n = action.notification
      addNotif({ title: n?.title || '', body: n?.body || '' })
    })
  } catch (e) {
    console.error('[Push] setup failed', e)
  }
}
