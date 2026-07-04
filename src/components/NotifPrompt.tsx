import { useState } from 'react'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function NotifPrompt() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('eclub_notif_asked') === '1' } catch { return false }
  })
  if (hidden) return null
  const done = () => { try { localStorage.setItem('eclub_notif_asked', '1') } catch {}; setHidden(true) }
  const allow = async () => {
    try { if (typeof Notification !== 'undefined' && Notification.requestPermission) await Notification.requestPermission() } catch {}
    done()
  }
  return (
    <div style={{ background: '#fff', margin: '12px 16px 0', borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 26 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Увімкнути сповіщення?</div>
        <div style={{ fontSize: 12, color: Gray }}>Статус оплати, нагадування про рейс, акції.</div>
      </div>
      <button onClick={done} style={{ background: 'none', border: 'none', color: Gray, fontSize: 13, cursor: 'pointer' }}>Пізніше</button>
      <button onClick={allow} style={{ background: ORange, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Дозволити</button>
    </div>
  )
}
