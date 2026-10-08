import { useEffect, useState } from 'react'
import { FileText, Gift, Map, Bus, Star, Share2, Info, X, Gamepad2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'
import { openInternalBrowser } from '../internalBrowser'
import { getFirebaseApp } from '../firebaseApp'

const Navy = '#0A4684'
const ORange = '#F5A623'

// Кеп (08.10): бокове меню і блок «Акції та Новини» керуються з адмінки (Firestore
// side_menu_items, side_promos, settings/sidePromos) — зміни без публікації в сторах.
// Якщо в адмінці пунктів меню ще немає — показуємо вбудований список (як раніше).
const ICONS: Record<string, any> = { FileText, Gift, Map, Bus, Star, Share2, Info, Gamepad2 }

interface MenuItem { id: string; order: number; icon: string; label: string; url: string; hidden?: boolean }
interface Promo { id: string; order: number; active: boolean; image?: string; title?: string; text?: string; buttonLabel?: string; buttonUrl?: string; from?: string; to?: string }

let cache: { items: MenuItem[] | null; promos: Promo[]; promosOn: boolean; title: string } | null = null

async function loadMenu() {
  const app = await getFirebaseApp()
  if (!app) return null
  const { getFirestore, collection, getDocs, doc, getDoc } = await import('firebase/firestore')
  const db = getFirestore(app)
  const [m, p, s] = await Promise.all([
    getDocs(collection(db, 'side_menu_items')).catch(() => null),
    getDocs(collection(db, 'side_promos')).catch(() => null),
    getDoc(doc(db, 'settings', 'sidePromos')).catch(() => null),
  ])
  const items = m && !m.empty ? m.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((i: MenuItem) => !i.hidden).sort((a: MenuItem, b: MenuItem) => a.order - b.order) : null
  const today = new Date().toISOString().slice(0, 10)
  const promos = p ? p.docs.map(d => ({ id: d.id, ...(d.data() as any) }) as Promo)
    .filter(x => x.active && (!x.from || x.from <= today) && (!x.to || x.to >= today))
    .sort((a, b) => a.order - b.order) : []
  const sd = s && s.exists() ? (s.data() as any) : {}
  return { items, promos, promosOn: sd.enabled !== false, title: sd.title || 'Акції та Новини' }
}

export default function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const [data, setData] = useState(cache)
  useEffect(() => {
    if (!open) return
    loadMenu().then(d => { if (d) { cache = d; setData(d) } }).catch(() => {})
  }, [open])

  const FALLBACK: MenuItem[] = [
    { id: 'game', order: 0, icon: 'Gamepad2', label: '🎮 Гра EuroClub Racer', url: '/game' },
    { id: 'rules', order: 1, icon: 'FileText', label: t('home.rules'), url: 'https://eclub.com.ua/ua/oferta/' },
    { id: 'cashback', order: 2, icon: 'Gift', label: t('home.cashback'), url: 'https://eclub.com.ua/ua/' },
    { id: 'routes', order: 3, icon: 'Map', label: t('home.routes'), url: '/routes' },
    { id: 'fleet', order: 4, icon: 'Bus', label: t('home.fleet'), url: '/fleet' },
    { id: 'feedback', order: 5, icon: 'Star', label: t('home.feedback'), url: '/feedback' },
    { id: 'social', order: 6, icon: 'Share2', label: t('home.social'), url: '/page/social' },
    { id: 'info', order: 7, icon: 'Info', label: t('home.usefulInfo'), url: 'https://eclub.com.ua/ua/' },
  ]
  const items = data?.items || FALLBACK
  const go = (url: string) => { onClose(); url.startsWith('/') ? nav(url) : openInternalBrowser(url) }

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.4)' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: 320, background: '#fff', boxShadow: '2px 0 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 20px) 18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/logo-lockup.png" alt="EuroClub" style={{ height: 34 }} />
          <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#fff" /></button>
        </div>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #F4F4F4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#8A8A8A', fontWeight: 600 }}>{t('profile.language')}</span>
          <LanguageSwitcher />
        </div>
        <div style={{ padding: '8px 0', overflowY: 'auto', flex: 1 }}>
          {data?.promosOn && data.promos.length > 0 && (
            <div style={{ padding: '10px 0 14px', borderBottom: '1px solid #F4F4F4' }}>
              <div style={{ padding: '0 18px 8px', fontSize: 13, fontWeight: 800, color: Navy, textTransform: 'uppercase', letterSpacing: 0.4 }}>{data.title}</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 18px', scrollSnapType: 'x mandatory' }}>
                {data.promos.map(p => (
                  <div key={p.id} style={{ flex: '0 0 210px', scrollSnapAlign: 'start', borderRadius: 14, overflow: 'hidden', background: '#F7F8FA', border: '1px solid #EEE', display: 'flex', flexDirection: 'column' }}>
                    {p.image && <img src={p.image} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {p.title && <div style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>{p.title}</div>}
                      {p.text && <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.text}</div>}
                      {p.buttonLabel && p.buttonUrl && (
                        <button onClick={() => go(p.buttonUrl!)} style={{ marginTop: 'auto', padding: '9px 10px', borderRadius: 10, border: 'none', background: ORange, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{p.buttonLabel}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {items.map(it => {
            const Icon = ICONS[it.icon] || Info
            return (
              <button key={it.id} onClick={() => go(it.url)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', borderBottom: '1px solid #F4F4F4', cursor: 'pointer', textAlign: 'left' }}>
                <Icon size={20} color={ORange} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{it.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
