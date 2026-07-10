import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Ticket, Mail, Phone, Pencil, Check, X, Plus, Trash2, Users } from 'lucide-react'
import { useAuthStore } from '../authStore'
import { editProfile } from '../api/auth'
import { getSavedPassengers, addSavedPassenger, removeSavedPassenger, setSavedPassengerBirthday, SavedPassenger } from '../savedPassengers'
import Auth from './Auth'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function Profile() {
  const nav = useNavigate()
  const { user, logout, setUser } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState<string>(() => { try { return localStorage.getItem('eclub_avatar') || '' } catch { return '' } })
  const pickAvatar = (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { const d = String(reader.result); setAvatar(d); try { localStorage.setItem('eclub_avatar', d) } catch {} }
    reader.readAsDataURL(file)
  }

  // Редагування особистих даних
  const [editing, setEditing] = useState(false)
  const [header, setHeader] = useState(user?.header || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Збережені пасажири (родина, ті кому часто купуєш квитки)
  const [passengers, setPassengers] = useState<SavedPassenger[]>(() => getSavedPassengers())
  const [newPax, setNewPax] = useState('')
  const [newPaxBday, setNewPaxBday] = useState('')

  if (!user) return <Auth />

  const startEdit = () => {
    setHeader(user.header || ''); setEmail(user.email || ''); setPhone(user.phone || '')
    setSaveError(''); setEditing(true)
  }

  const save = async () => {
    if (!header.trim() || !email.trim() || !phone.trim()) { setSaveError("Заповніть усі поля"); return }
    setSaving(true); setSaveError('')
    try {
      const res: any = await editProfile({ header: header.trim(), email: email.trim(), phone: phone.trim() })
      if (res?.error && String(res.error) !== '0') { setSaveError('Не вдалось зберегти. Спробуйте ще раз.'); setSaving(false); return }
      setUser({ ...user, header: header.trim(), email: email.trim(), phone: phone.trim() })
      setEditing(false)
    } catch { setSaveError('Помилка мережі. Спробуйте ще раз.') }
    finally { setSaving(false) }
  }

  const addPax = () => {
    if (!newPax.trim()) return
    setPassengers(addSavedPassenger(newPax, newPaxBday))
    setNewPax(''); setNewPaxBday('')
  }
  const delPax = (id: string) => setPassengers(removeSavedPassenger(id))
  const setBday = (id: string, val: string) => setPassengers(setSavedPassengerBirthday(id, val))

  const row = (icon: any, label: string, value: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid #F2F2F2' }}>
      {icon}
      <div>
        <div style={{ fontSize: 12, color: Gray }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{value || '—'}</div>
      </div>
    </div>
  )

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #EEE', borderRadius: 10, fontSize: 14, marginTop: 4 }

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
          {!editing ? (
            <>
              {row(<User size={20} color={ORange} />, "Ім'я", user.header)}
              {row(<Mail size={20} color={ORange} />, 'Пошта', user.email)}
              {row(<Phone size={20} color={ORange} />, 'Телефон', user.phone)}
              <button onClick={startEdit} style={{ width: '100%', margin: '10px 0 6px', padding: 12, background: 'none', border: `1.5px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Pencil size={15} /> Редагувати
              </button>
            </>
          ) : (
            <div style={{ padding: '14px 0' }}>
              <label style={{ fontSize: 12, color: Gray }}>Ім'я</label>
              <input value={header} onChange={e => setHeader(e.target.value)} style={inputStyle} placeholder="Ім'я та прізвище" />
              <label style={{ fontSize: 12, color: Gray, display: 'block', marginTop: 12 }}>Пошта</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} placeholder="email@example.com" />
              <label style={{ fontSize: 12, color: Gray, display: 'block', marginTop: 12 }}>Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inputStyle} placeholder="+380..." />
              {saveError && <div style={{ color: '#E53935', fontSize: 12.5, marginTop: 10 }}>{saveError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, padding: 12, background: 'none', border: '1.5px solid #EEE', borderRadius: 12, color: '#555', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <X size={15} /> Скасувати
                </button>
                <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                  <Check size={15} /> {saving ? 'Збереження...' : 'Зберегти'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Збережені пасажири */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Users size={18} color={ORange} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Пасажири</span>
          </div>
          <div style={{ fontSize: 12, color: Gray, marginBottom: 12 }}>
            Діти, дружина, батьки — кому часто купуєш квитки. З'являться списком при заповненні бронювання. Дата народження — для привітань і спецпропозицій у майбутньому.
          </div>

          {passengers.map(p => (
            <div key={p.id} style={{ padding: '10px 0', borderTop: '1px solid #F5F5F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                <button onClick={() => delPax(p.id)} aria-label="Видалити" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={16} color="#E53935" />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: Gray, whiteSpace: 'nowrap' }}>Дата народження</span>
                <input type="date" value={p.birthday || ''} onChange={e => setBday(p.id, e.target.value)}
                  style={{ fontSize: 12.5, padding: '4px 8px', border: '1px solid #EEE', borderRadius: 8, color: '#555' }} />
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: passengers.length ? 12 : 0 }}>
            <input value={newPax} onChange={e => setNewPax(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPax()}
              placeholder="Ім'я та прізвище (латиницею)" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
            <button onClick={addPax} style={{ width: 44, height: 44, background: ORange, border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12, color: Gray, whiteSpace: 'nowrap' }}>Дата народження (не обов'язково)</span>
            <input type="date" value={newPaxBday} onChange={e => setNewPaxBday(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', border: '1.5px solid #EEE', borderRadius: 8, color: '#555' }} />
          </div>
        </div>

        <button onClick={() => nav('/tickets')} style={{ width: '100%', marginTop: 14, padding: 16, background: '#fff', border: 'none', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
          <Ticket size={20} color={ORange} /> Мої замовлення
        </button>

        <button onClick={logout} style={{ width: '100%', marginTop: 14, padding: 16, background: 'none', border: '1.5px solid #EEE', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: '#E53935', fontWeight: 700, fontSize: 15 }}>
          <LogOut size={18} /> Вийти
        </button>
      </div>
    </div>
  )
}
