// Визначення нативний застосунок (Android/iOS через Capacitor) чи PWA/веб. Динамічний
// import того ж патерну, що й push.ts/openReturn.ts — не роздуваємо бандл для всіх, хто
// цим не користується. Використовується для функцій, які МАЮТЬ бути видимі ТІЛЬКИ на PWA
// (напр. "бали" — ще не готові до продакшену в мобільних білдах Android/iOS, але потрібні
// для тестування на веб-версії).
export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}
