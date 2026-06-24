import { useEffect, useState } from 'react'

const ORange = '#F5A623'

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone()) return // already installed, don't bother

    const dismissed = localStorage.getItem('euroclub_install_dismissed')
    if (dismissed) return

    if (isIOS()) {
      setShowBanner(true)
      return
    }

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS()) {
      setShowIosHelp(true)
      return
    }
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShowBanner(false)
    }
  }

  const dismiss = () => {
    setShowBanner(false)
    localStorage.setItem('euroclub_install_dismissed', '1')
  }

  if (!showBanner) return null

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: '#1A1A1A', color: '#fff',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 500, paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
      }}>
        <img src="/icon-192.png" alt="" style={{ width: 36, height: 36, borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Встановити EuroClub</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Швидкий доступ з головного екрану</div>
        </div>
        <button onClick={handleInstall} style={{
          background: ORange, color: '#fff', border: 'none', borderRadius: 10,
          padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap'
        }}>Встановити</button>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {showIosHelp && (
        <div onClick={() => setShowIosHelp(false)} style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, height: '100%', zIndex: 600, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 24px 40px',
            width: '100%', maxWidth: 430,
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Встановити на iPhone</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: ORange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>1</div>
              <span style={{ fontSize: 15 }}>Натисніть кнопку <b>Поділитися</b> ⬆️ внизу екрану Safari</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: ORange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>2</div>
              <span style={{ fontSize: 15 }}>Виберіть <b>"На головний екран"</b></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: ORange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>3</div>
              <span style={{ fontSize: 15 }}>Натисніть <b>"Додати"</b></span>
            </div>
            <button onClick={() => setShowIosHelp(false)} style={{
              width: '100%', padding: 14, background: ORange, color: '#fff',
              border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer'
            }}>Зрозуміло</button>
          </div>
        </div>
      )}
    </>
  )
}
