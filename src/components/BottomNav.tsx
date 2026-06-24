import { NavLink } from 'react-router-dom'
import { Search, Ticket, User, MoreHorizontal } from 'lucide-react'

const TABS = [
  { to: '/', icon: Search, label: 'Пошук' },
  { to: '/tickets', icon: Ticket, label: 'Квитки' },
  { to: '/profile', icon: User, label: 'Профіль' },
  { to: '/more', icon: MoreHorizontal, label: 'Ще' },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, background: '#fff',
      borderTop: '1px solid #eee', display: 'flex', zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 0 8px', textDecoration: 'none', gap: 3,
          color: isActive ? '#F5A623' : '#9E9E9E',
        })}>
          {({ isActive }) => <>
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{label}</span>
          </>}
        </NavLink>
      ))}
    </nav>
  )
}
