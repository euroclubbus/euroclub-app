// Спільний лінивий ініціалізатор Firebase App — той самий підхід, що й у reporting.ts:
// підвантажуємо firebase/app лише коли реально потрібно (сторінка з Firestore-контентом),
// не роздуваємо основний бандл для всіх, хто цим не користується.
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

export async function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null
  const { initializeApp, getApps } = await import('firebase/app')
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
}
