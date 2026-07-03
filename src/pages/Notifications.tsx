import { useState } from 'react'
import { Bell } from 'lucide-react'
import { DEMO_NOTIFS, getReadIds, setReadIds, markAllRead } from '../notifications'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function Notifications() {
  const [read, setRead] = useState<string[]>(getReadIds())

  const markOne = (id: string) => {
    if (read.includes(id)) return
    const r = [...read, id]
    setRead(r); setReadIds(r)
  }
  const readAll = () => { markAllRead(); setRead(DEMO_NOTIFS.map(n => n.id)) }
  const unread = DEMO_NOTIFS.filter(n => !read.includes(n.id)).length

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Сповіщення</span>
          {unread > 0 && <button onClick={readAll} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer' }}>Прочитати всі</button>}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {DEMO_NOTIFS.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: Gray }}>
            <Bell size={40} color="#CFCFCF" />
            <p style={{ marginTop: 12 }}>Сповіщень поки немає</p>
          </div>
        )}
        {DEMO_NOTIFS.map(n => {
          const isUnread = !read.includes(n.id)
          return (
            <button key={n.id} onClick={() => markOne(n.id)} style={{
              width: '100%', textAlign: 'left', display: 'flex', gap: 12, padding: 16, marginBottom: 10,
              background: '#fff', border: 'none', borderRadius: 16, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', background: isUnread ? '#FFF3DC' : '#F2F2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={18} color={isUnread ? ORange : Gray} />
                </span>
                {isUnread && <span style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#E53935', border: '2px solid #fff' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: isUnread ? 800 : 600, color: '#1A1A1A' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: Gray, whiteSpace: 'nowrap' }}>{n.date}</span>
                </div>
                <div style={{ fontSize: 13, color: '#555', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
