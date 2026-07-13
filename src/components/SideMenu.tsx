import { FileText, Gift, Map, Bus, Star, Share2, Info, X, Gamepad2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import LanguageSwitcher from './LanguageSwitcher'

const Navy = '#0A4684'
const ORange = '#F5A623'

// Відкрити URL: у APK — InAppBrowser (тулбар знизу), у PWA — нова вкладка
function openUrl(url: string) {
  const iab = (window as any).cordova?.InAppBrowser
  if (iab?.open) { iab.open(url, '_blank', 'location=yes,toolbarposition=bottom,closebuttoncaption=Готово,toolbarcolor=#0A4684,closebuttoncolor=#ffffff'); return }
  window.open(url, '_blank')
}

export default function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const ITEMS: { icon: any; label: string; url?: string; internal?: string }[] = [
    { icon: Gamepad2, label: '🎮 Гра EuroClub Racer', internal: '/game' },
    { icon: FileText, label: t('home.rules'), url: 'https://eclub.com.ua/ua/oferta/' },
    { icon: Gift, label: t('home.cashback'), url: 'https://eclub.com.ua/ua/' },
    { icon: Map, label: t('home.routes'), url: 'https://eclub.com.ua/ua/' },
    { icon: Bus, label: t('home.fleet'), url: 'https://eclub.com.ua/ua/bus/' },
    { icon: Star, label: t('home.feedback'), url: 'https://eclub.com.ua/ua/' },
    { icon: Share2, label: t('home.social'), url: 'https://eclub.com.ua/ua/' },
    { icon: Info, label: t('home.usefulInfo'), url: 'https://eclub.com.ua/ua/' },
  ]
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
        <div style={{ padding: '8px 0', overflowY: 'auto' }}>
          {ITEMS.map((it, i) => (
            <button key={i} onClick={() => { onClose(); it.internal ? nav(it.internal) : openUrl(it.url!) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'none', border: 'none', borderBottom: '1px solid #F4F4F4', cursor: 'pointer', textAlign: 'left' }}>
              <it.icon size={20} color={ORange} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
