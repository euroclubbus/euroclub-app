import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu, ThumbsUp, ThumbsDown, ArrowLeft } from 'lucide-react'
import { useNotificationsStore, markNotifRead, setNotifFeedback, formatNotifDate, FolderNotif } from '../notificationsFolder'
import SideMenu from '../components/SideMenu'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

// Кеп (04.09): "як у поштовому агенті" — окремий, повноекранний вигляд одного
// повідомлення, відкривається кліком зі списку. Список показує лише короткий
// прев'ю (1 рядок), тут — увесь текст.
function NotifDetail({ n, onClose }: { n: FolderNotif; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#F5F5F5', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0A4684', padding: 'calc(env(safe-area-inset-top) + 16px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>Сповіщення</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <Bell size={18} color={ORange} />
            {n.type === 'service' && (
              <span style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: '#E53935', border: '2px solid #fff' }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#1A1A1A' }}>{n.title}</div>
            <div style={{ color: Gray, fontSize: 12.5 }}>{formatNotifDate(n.createdAt)}</div>
          </div>
        </div>
        <p style={{ color: '#333', fontSize: 15.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.body}</p>
        {n.deepLink && (
          <button
            onClick={() => navigate(n.deepLink!)}
            style={{ marginTop: 20, background: ORange, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', width: '100%' }}
          >
            Перейти
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'center' }}>
          <button
            onClick={() => setNotifFeedback(n.id, 'like')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: n.feedback === 'like' ? '#E8F5E9' : '#fff', border: '1px solid #EEE', borderRadius: 12, padding: '10px 18px', cursor: 'pointer' }}
          >
            <ThumbsUp size={16} color={n.feedback === 'like' ? '#43A047' : Gray} fill={n.feedback === 'like' ? '#43A047' : 'none'} />
            <span style={{ fontSize: 13.5, color: n.feedback === 'like' ? '#43A047' : Gray }}>Корисно</span>
          </button>
          <button
            onClick={() => setNotifFeedback(n.id, 'dislike')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: n.feedback === 'dislike' ? '#FFEBEE' : '#fff', border: '1px solid #EEE', borderRadius: 12, padding: '10px 18px', cursor: 'pointer' }}
          >
            <ThumbsDown size={16} color={n.feedback === 'dislike' ? '#E53935' : Gray} fill={n.feedback === 'dislike' ? '#E53935' : 'none'} />
            <span style={{ fontSize: 13.5, color: n.feedback === 'dislike' ? '#E53935' : Gray }}>Не корисно</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Notifications() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openedNotif, setOpenedNotif] = useState<FolderNotif | null>(null)
  const items = useNotificationsStore(s => s.items)
  // Фіксуємо, які були непрочитані ДО того, як позначимо все прочитаним —
  // щоб користувач встиг побачити, що саме було новим (той самий підхід, що й раніше).
  const unreadIdsBefore = useRef<Set<string> | null>(null)
  if (unreadIdsBefore.current === null) {
    unreadIdsBefore.current = new Set(items.filter(n => !n.read).map(n => n.id))
  }

  useEffect(() => {
    // Позначаємо прочитаним кожен запис, який на момент відкриття екрана був непрочитаним.
    const ids = unreadIdsBefore.current
    if (!ids) return
    ids.forEach(id => markNotifRead(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {items.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bell size={30} color={Gray} />
            </div>
            <p style={{ color: Gray, fontSize: 16 }}>{t('notif.empty')}</p>
          </div>
        )}

        {items.map(n => {
          const isNew = unreadIdsBefore.current?.has(n.id) ?? false
          return (
            <div
              key={n.id}
              onClick={() => setOpenedNotif(n)}
              style={{ background: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', position: 'relative', cursor: 'pointer' }}
            >
              {isNew && (
                <span style={{ position: 'absolute', top: 16, right: 16, width: 9, height: 9, borderRadius: '50%', background: ORange }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingRight: 20 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Bell size={16} color={ORange} />
                  {n.type === 'service' && (
                    // Кеп (20.08): червона мітка для сервісних (транзакційних, по замовленню/
                    // рейсу) сповіщень — окремо від оранжевого "непрочитано" в кутку картки.
                    <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#E53935', border: '2px solid #fff' }} title="Сервісне сповіщення" />
                  )}
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{n.title}</span>
              </div>
              {/* Кеп (04.09): "як у поштовому агенті" — тут лише короткий прев'ю в 1 рядок,
                  повний текст відкривається кліком (NotifDetail). */}
              <p style={{ color: '#555', fontSize: 14, lineHeight: 1.4, margin: '0 0 8px', paddingLeft: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>
              <div style={{ color: Gray, fontSize: 12, paddingLeft: 44 }}>{formatNotifDate(n.createdAt)}</div>
            </div>
          )
        })}
      </div>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      {openedNotif && <NotifDetail n={openedNotif} onClose={() => setOpenedNotif(null)} />}
    </div>
  )
}
