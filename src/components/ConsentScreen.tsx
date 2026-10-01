import { useState } from 'react'
import { setConsent } from '../tracking'

const BLUE = '#0A4684'
const ORange = '#F5A623'

// Кеп (29.09): згода на відстеження реклами — один раз, при першому запуску після
// встановлення, ДО будь-яких інших екранів. Відповідь пишеться в Firestore
// tracking_consents (лічильник в адмінці). Змінити рішення — у Профілі.
export default function ConsentScreen({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const answer = async (granted: boolean) => {
    setBusy(true)
    try { await setConsent(granted, 'first_launch') } catch {}
    onDone()
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: BLUE, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <p style={{ color: '#cfe0f2', fontSize: 15, marginBottom: 12, maxWidth: 340, lineHeight: 1.45 }}>
        Дозвольте нам бачити, яка реклама привела вас до EuroClub. Так ми показуватимемо вам
        тільки актуальні знижки й рейси, а не зайву рекламу.
      </p>
      <p style={{ color: '#9fbadb', fontSize: 12, marginBottom: 28, maxWidth: 340, lineHeight: 1.4 }}>
        Дані передаються Meta (Facebook, Instagram) лише для вимірювання реклами. Змінити
        рішення можна будь-коли в Профілі.
      </p>
      <button
        onClick={() => answer(true)}
        disabled={busy}
        style={{
          background: ORange, color: '#fff', fontWeight: 700, fontSize: 16,
          padding: '14px 36px', borderRadius: 12, border: 'none', cursor: busy ? 'default' : 'pointer',
          marginBottom: 14, width: '100%', maxWidth: 280,
        }}
      >
        {busy ? '…' : 'Погоджуюсь'}
      </button>
      <button
        onClick={() => answer(false)}
        disabled={busy}
        style={{ background: 'none', border: 'none', color: '#cfe0f2', fontSize: 14, cursor: busy ? 'default' : 'pointer' }}
      >
        Не зараз
      </button>
    </div>
  )
}
