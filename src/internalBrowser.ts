// Відкриває зовнішнє посилання у внутрішньому браузері застосунку (не системний браузер) —
// на нативних платформах через @capacitor/browser (SFSafariViewController/Custom Tabs),
// на вебі/ПВА — звичайний window.open, бо іншого браузера там і нема.
export async function openInternalBrowser(url: string) {
  if (!url) return
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    }
  } catch {
    // якщо плагін недоступний з якоїсь причини — фолбек нижче
  }
  window.open(url, '_blank')
}
