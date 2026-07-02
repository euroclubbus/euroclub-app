import { NavLink } from 'react-router-dom'
import { Search, Ticket, User, Info } from 'lucide-react'

const TABS = [
  { to: '/', icon: Search, label: 'Пошук', end: true },
  { to: '/tickets', icon: Ticket, label: 'Квитки' },
  { to: '/profile', icon: User, label: 'Профіль' },
  { to: '/more', icon: Info, label: 'Інформація' },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, background: '#fff',
      borderTop: '1px solid #eee', display: 'flex', zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {TABS.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to} to={to} end={end} aria-label={label} style={({ isActive }) => ({
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px 0', textDecoration: 'none',
          color: isActive ? '#F5A623' : '#9E9E9E',
        })}>
          {({ isActive }) => <Icon size={24} strokeWidth={isActive ? 2.4 : 1.9} />}
        </NavLink>
      ))}
    </nav>
  )
}
