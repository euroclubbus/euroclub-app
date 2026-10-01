import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { X, Search, Check } from 'lucide-react'
import { useAuthStore } from '../authStore'
import { editProfile } from '../api/auth'
import { getAllCities } from '../cityNames'
import { getFirebaseApp } from '../firebaseApp'

const ORange = '#F5A623'
const Gray = '#9E9E9E'
const LS_KEY = 'eclub_interests'

// Кеп (01.10): дата народження + "цікаві міста" в профілі. Зберігаємо одночасно:
//  • на бекенд (opr=edit: birthday YYYY-MM-DD, favcity "id;id"),
//  • в адмінку — Firestore user_profiles/{userId} (та сама таблиця, куди бекенд шле
//    дані з сайту через euroclub-admin/api/profile-sync).
export default function InterestsForm() {
  const user = useAuthStore(s => s.user)
  const [birthday, setBirthday] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { getAllCities().then(setCities).catch(() => {}) }, [])

  // Підставляємо вже збережене: спершу локально (миттєво), потім з адмінки (могли заповнити на сайті).
  useEffect(() => {
    if (!user?.id) return
    try {
      const l = JSON.parse(localStorage.getItem(`${LS_KEY}_${user.id}`) || 'null')
      if (l) { setBirthday(l.birthday || ''); setSelected(l.favCities || []) }
    } catch {}
    ;(async () => {
      try {
        const app = await getFirebaseApp(); if (!app) return
        const { getFirestore, doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(getFirestore(app), 'user_profiles', String(user.id)))
        const d: any = snap.data()
        if (d) {
          if (typeof d.birthday === 'string') setBirthday(d.birthday)
          if (Array.isArray(d.favCities)) setSelected(d.favCities.map(String))
        }
      } catch (e) { console.warn('[Interests] load', e) }
    })()
  }, [user?.id])

  const nameOf = (id: string) => cities.find(c => c.id === id)?.name || id
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cities.filter(c => c.name.toLowerCase().includes(q)) : cities
  }, [cities, query])
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const save = async () => {
    if (!user?.id) return
    setSaving(true); setMsg(null)
    const favcity = selected.join(';')
    try {
      const res: any = await editProfile({ birthday, favcity })
      if (res?.error && String(res.error) !== '0') throw new Error(String(res.error))
    } catch {
      setSaving(false); setMsg({ ok: false, text: 'Не вдалось зберегти. Спробуйте ще раз.' }); return
    }
    try { localStorage.setItem(`${LS_KEY}_${user.id}`, JSON.stringify({ birthday, favCities: selected })) } catch {}
    try {
      const app = await getFirebaseApp()
      if (app) {
        const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
        const platform = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'pwa'
        await setDoc(doc(getFirestore(app), 'user_profiles', String(user.id)), {
          userId: String(user.id),
          header: user.header || '',
          email: user.email || '',
          phone: user.phone || '',
          birthday,
          favCities: selected,
          favCityNames: selected.map(nameOf),
          source: 'app',
          platform,
          hasApp: platform !== 'pwa',
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
    } catch (e) { console.error('[Interests] firestore', e) }
    setSaving(false); setMsg({ ok: true, text: 'Збережено' })
  }

  if (!user) return null
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Про вас</div>
      <div style={{ fontSize: 12, color: Gray, marginBottom: 14 }}>Привітаємо з днем народження і повідомимо про персональні знижки</div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Дата народження</label>
      <input type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={e => setBirthday(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #E5E5E5', fontSize: 15, background: '#F9F9F9', marginBottom: 16 }} />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>Оберіть міста, які ви використовуєте в маршрутах, і отримуйте персональні знижки для поїздок</label>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selected.map(id => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF3DC', border: `1px solid ${ORange}`, borderRadius: 16, padding: '5px 8px 5px 12px', fontSize: 13 }}>
              {nameOf(id)}
              <button onClick={() => toggle(id)} aria-label="Прибрати" style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }}><X size={14} color="#7A5A00" /></button>
            </span>
          ))}
        </div>
      )}
      <button onClick={() => setPickerOpen(o => !o)} style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px dashed #CCC', background: '#fff', fontSize: 14, color: '#555', cursor: 'pointer', textAlign: 'left' }}>
        {pickerOpen ? 'Сховати список міст' : '+ Обрати міста'}
      </button>
      {pickerOpen && (
        <div style={{ marginTop: 8, border: '1px solid #EEE', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #EEE' }}>
            <Search size={16} color={Gray} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук міста" style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14 }} />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map(c => {
              const on = selected.includes(c.id)
              return (
                <button key={c.id} onClick={() => toggle(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: on ? '#FFF8EA' : '#fff', border: 'none', borderBottom: '1px solid #F4F4F4', cursor: 'pointer', fontSize: 14, textAlign: 'left' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? ORange : '#DDD'}`, background: on ? ORange : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={13} color="#fff" />}
                  </span>
                  {c.name}
                </button>
              )
            })}
            {filtered.length === 0 && <div style={{ padding: 14, fontSize: 13, color: Gray }}>Нічого не знайдено</div>}
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving} style={{ width: '100%', marginTop: 16, padding: 14, background: ORange, border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer' }}>
        {saving ? 'Зберігаю…' : 'Зберегти'}
      </button>
      {msg && <div style={{ marginTop: 8, fontSize: 13, color: msg.ok ? '#2E7D32' : '#E53935', textAlign: 'center' }}>{msg.text}</div>}
    </div>
  )
}
