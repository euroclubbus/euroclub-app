import { useState } from 'react'
import { useT } from '../i18n'

const ORange = '#F5A623'

export default function CookieBanner() {
  const t = useT()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('eclub_cookie_ok') === '1' } catch { return false }
  })
  if (hidden) return null
  const accept = () => { try { localStorage.setItem('eclub_cookie_ok', '1') } catch {}; setHidden(true) }
  return (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 12px)', zIndex: 9000, background: '#0B2E5E', color: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180, fontSize: 13, lineHeight: 1.5 }}>
        {t('cookie.text')}{' '}
        <a href="https://eclub.com.ua/ua/oferta/" target="_blank" rel="noreferrer" style={{ color: ORange, textDecoration: 'underline' }}>{t('cookie.terms')}</a>.
      </div>
      <button onClick={accept} style={{ background: ORange, color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
        {t('cookie.accept')}
      </button>
    </div>
  )
}
