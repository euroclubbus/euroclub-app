import { saveDeviceToken } from './api/auth'

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
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error', err)
    })
  } catch (e) {
    console.error('[Push] setup failed', e)
  }
}
