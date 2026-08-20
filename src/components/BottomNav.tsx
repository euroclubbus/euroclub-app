import { NavLink } from 'react-router-dom'
import { Search, Ticket, User, Bell } from 'lucide-react'
import { useNotificationsStore } from '../notificationsFolder'
import { useUnpaidOrdersStore } from '../unpaidOrders'
import { useT } from '../i18n'

export default function BottomNav() {
  const t = useT()
  const unpaidCount = useUnpaidOrdersStore(s => s.orders.length)
  const unreadNotifCount = useNotificationsStore(s => s.unreadCount)
  const TABS = [
    { to: '/', icon: Search, label: t('nav.search'), end: true, badge: false, count: 0, color: '#E53935' },
    { to: '/tickets', icon: Ticket, label: t('nav.orders'), badge: unpaidCount > 0, count: unpaidCount, color: '#F5A623' },
    { to: '/profile', icon: User, label: t('nav.profile'), badge: false, count: 0, color: '#E53935' },
    { to: '/notifications', icon: Bell, label: t('nav.notifications'), badge: true, count: unreadNotifCount || 3, color: '#E53935' }, // Кеп (19.08): тимчасово || 3 — тільки щоб побачити вигляд бейджа наживо, поки папка ще порожня. Прибрати, щойно з'явиться реальний потік записів.
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, background: '#fff',
      borderTop: '1px solid #eee', display: 'flex', zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {TABS.map(({ to, icon: Icon, label, end, badge, count, color }) => (
        <NavLink key={to} to={to} end={end} aria-label={label} style={({ isActive }) => ({
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px 0', textDecoration: 'none',
          color: isActive ? '#F5A623' : '#9E9E9E', position: 'relative',
        })}>
          {({ isActive }) => (
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={24} strokeWidth={isActive ? 2.4 : 1.9} />
              {badge && count > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, padding: '0 4px',
                  background: color, color: '#fff', fontSize: 10, fontWeight: 700,
                  borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{count > 9 ? '9+' : count}</span>
              )}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
