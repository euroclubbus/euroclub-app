import { useState } from 'react'
import { useT } from '../i18n'
import { registerPushToken } from '../push'
import { APP_VERSION } from '../appVersion'

const BLUE = '#0A4684'
const ORange = '#F5A623'

// Кеп (04.09): ПОВНОЕКРАННИЙ, обов'язковий екран замість маленького банера знизу — його
// "майже не видно". Немає кнопки "Пропустити"/хрестика — єдиний спосіб піти далі:
// натиснути "Дозволити" (реальний дозвіл) чи "Не зараз" (теж закриває, але свідомо, тим
// самим button tap, не випадковим свайпом повз). Системний діалог ОС усе одно матиме
// свою кнопку відмови — це поза нашим контролем (вимога платформи), але НАШ екран більше
// не можна оминути повз, не побачивши.
//
// Рендериться ЯК ГЕЙТ у main.tsx (не самостійно вирішує ховатись) — інакше "return null"
// зсередини зламав би послідовність гейтів (Welcome/Auth/ForceUpdate) там, де він
// вставлений. shouldShowNotifScreen() — окрема функція, яку викликає main.tsx, щоб
// вирішити, чи взагалі рендерити цей гейт.
const RESET_KEY = 'eclub_notif_reset_version'
const ASKED_KEY = 'eclub_notif_asked'

export function shouldShowNotifScreen(): boolean {
  try {
    const lastReset = localStorage.getItem(RESET_KEY)
    if (lastReset !== APP_VERSION) {
      localStorage.setItem(RESET_KEY, APP_VERSION)
      localStorage.removeItem(ASKED_KEY)
    }
    return localStorage.getItem(ASKED_KEY) !== '1'
  } catch { return false }
}

export default function NotifScreen({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)

  const done = () => { try { localStorage.setItem(ASKED_KEY, '1') } catch {}; onDone() }
  const allow = async () => {
    setBusy(true)
    try { if (typeof Notification !== 'undefined' && Notification.requestPermission) await Notification.requestPermission() } catch {}
    try { await registerPushToken() } catch {}
    done()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: BLUE, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <span style={{ fontSize: 56, marginBottom: 24 }}>🔔</span>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>{t('notifPrompt.title')}</h2>
      <p style={{ color: '#cfe0f2', fontSize: 15, marginBottom: 28, maxWidth: 320 }}>{t('notifPrompt.subtitle')}</p>
      <button
        onClick={allow}
        disabled={busy}
        style={{
          background: ORange, color: '#fff', fontWeight: 700, fontSize: 16,
          padding: '14px 36px', borderRadius: 12, border: 'none', cursor: busy ? 'default' : 'pointer',
          marginBottom: 14, width: '100%', maxWidth: 280,
        }}
      >
        {busy ? '…' : t('notifPrompt.allow')}
      </button>
      <button
        onClick={done}
        disabled={busy}
        style={{ background: 'none', border: 'none', color: '#cfe0f2', fontSize: 14, cursor: busy ? 'default' : 'pointer' }}
      >
        {t('notifPrompt.later')}
      </button>
    </div>
  )
}
