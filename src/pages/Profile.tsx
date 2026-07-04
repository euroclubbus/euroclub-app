import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Ticket, Mail, Phone } from 'lucide-react'
import { useAuthStore } from '../authStore'
import Auth from './Auth'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function Profile() {
  const nav = useNavigate()
  const { user, logout } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState<string>(() => { try { return localStorage.getItem('eclub_avatar') || '' } catch { return '' } })
  const pickAvatar = (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { const d = String(reader.result); setAvatar(d); try { localStorage.setItem('eclub_avatar', d) } catch {} }
    reader.readAsDataURL(file)
  }

  if (!user) return <Auth />

  const row = (icon: any, label: string, value: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid #F2F2F2' }}>
      {icon}
      <div>
        <div style={{ fontSize: 12, color: Gray }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{value || '—'}</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => fileRef.current?.click()} style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={28} color="#fff" />}
            <span style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: ORange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>✎</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} style={{ display: 'none' }} />
          <div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{user.header || 'Мій профіль'}</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{user.email}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '4px 18px 8px' }}>
          {row(<User size={20} color={ORange} />, "Прізвище та ім'я", user.header)}
          {row(<Mail size={20} color={ORange} />, 'Пошта', user.email)}
          {row(<Phone size={20} color={ORange} />, 'Телефон', user.phone)}
        </div>

        <button onClick={() => nav('/tickets')} style={{ width: '100%', marginTop: 14, padding: 16, background: '#fff', border: 'none', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
          <Ticket size={20} color={ORange} /> Мої квитки
        </button>

        <button onClick={logout} style={{ width: '100%', marginTop: 14, padding: 16, background: 'none', border: '1.5px solid #EEE', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: '#E53935', fontWeight: 700, fontSize: 15 }}>
          <LogOut size={18} /> Вийти
        </button>
      </div>
    </div>
  )
}
