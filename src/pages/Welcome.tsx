import { useT } from '../i18n'

const ORange = '#F5A623'
const Navy = '#0A4684'
const Gray = '#9E9E9E'

export default function Welcome({ onRegister, onGuest }: { onRegister: () => void; onGuest: () => void }) {
  const t = useT()
  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px' }}>
      <img src="/app-icon.png" alt="EuroClub" style={{ width: 88, height: 88, borderRadius: 20, display: 'block', margin: '0 auto 20px' }} />
      <div style={{ fontSize: 26, fontWeight: 900, textAlign: 'center', marginBottom: 12, color: Navy }}>{t('welcome.title')}</div>
      <div style={{ textAlign: 'center', color: Gray, fontSize: 15, lineHeight: 1.5, marginBottom: 32, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
        {t('welcome.subtitle')}
      </div>
      <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
        <button onClick={onRegister} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
          {t('welcome.register')}
        </button>
        <button onClick={onGuest} style={{ width: '100%', padding: 16, background: 'none', color: Navy, border: '1.5px solid #E6E6E6', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {t('welcome.continueGuest')}
        </button>
      </div>
    </div>
  )
}
