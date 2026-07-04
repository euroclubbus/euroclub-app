import { useEffect, useState } from 'react'

const BLUE = '#0A4684'

export default function Splash({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 80)      // fade-in логотипу
    const t2 = setTimeout(onDone, 1900)                 // перехід далі
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  return (
    <div style={{ position: 'fixed', inset: 0, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <img src="/logo-lockup.png" alt="EuroClub" style={{ width: 240, maxWidth: '62%', opacity: show ? 1 : 0, transform: show ? 'scale(1)' : 'scale(0.92)', transition: 'opacity 0.7s ease, transform 0.7s ease' }} />
    </div>
  )
}
