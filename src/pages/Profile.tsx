import { useNavigate } from 'react-router-dom'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

const MENU = [
  { icon: '🎁', label: 'Cash Back', sub: 'Ведуться технічні роботи', disabled: true },
  { icon: '🚌', label: 'Автопарк', sub: '', disabled: false },
  { icon: '🛡', label: 'Страхування', sub: 'Ведуться технічні роботи', disabled: true },
  { icon: '📄', label: 'Умови подорожі', sub: '', disabled: false },
  { icon: '❓', label: 'FAQ', sub: '', disabled: false },
  { icon: '📞', label: 'Контакти', sub: '', disabled: false },
]

export default function Profile() {
  const nav = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 80 }}>
      <div style={{ background: '#1A1A1A', padding: '20px 16px 16px' }}>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Профіль</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>👤</div>
          <p style={{ color: Gray, fontSize: 15 }}>Увійдіть для доступу до особистого кабінету</p>
          <p style={{ color: Gray, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>Особистий кабінет — ведуться технічні роботи</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden' }}>
          {MENU.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderBottom: i < MENU.length-1 ? '1px solid #F5F5F5' : 'none', opacity: item.disabled ? 0.5 : 1 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 12, color: Gray, marginTop: 2 }}>{item.sub}</div>}
              </div>
              <span style={{ color: Gray }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
