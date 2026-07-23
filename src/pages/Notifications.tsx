import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { DEMO_NOTIFS, getReadIds, markAllRead } from '../notifications'
import SideMenu from '../components/SideMenu'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function Notifications() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  // Фіксуємо, які були непрочитані ДО того, як позначимо все прочитаним —
  // щоб користувач встиг побачити, що саме було новим.
  const [readBefore] = useState<string[]>(() => getReadIds())

  useEffect(() => {
    markAllRead()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMenuOpen(true)} aria-label="Меню" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('nav.notifications')}</span>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {DEMO_NOTIFS.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bell size={30} color={Gray} />
            </div>
            <p style={{ color: Gray, fontSize: 16 }}>{t('notif.empty')}</p>
          </div>
        )}

        {DEMO_NOTIFS.map(n => {
          const isNew = !readBefore.includes(n.id)
          return (
            <div key={n.id} style={{ background: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', position: 'relative' }}>
              {isNew && (
                <span style={{ position: 'absolute', top: 16, right: 16, width: 9, height: 9, borderRadius: '50%', background: ORange }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingRight: 20 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={16} color={ORange} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{n.title}</span>
              </div>
              <p style={{ color: '#555', fontSize: 14, lineHeight: 1.4, margin: '0 0 8px', paddingLeft: 44 }}>{n.body}</p>
              <div style={{ color: Gray, fontSize: 12, paddingLeft: 44 }}>{n.date}</div>
            </div>
          )
        })}
      </div>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}
