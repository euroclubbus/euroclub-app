import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import PaymentPanel from '../components/PaymentPanel'
import { useT } from '../i18n'

const Navy = '#0A4684'

// Пряма сторінка оплати — для заходу з квитка/екрану успіху ("Перейти до оплати"),
// коли користувач ще не на екрані бронювання. Саме полотно оплати — в PaymentPanel,
// яке так само вбудовується прямо в Booking.tsx для єдиного безшовного флоу.
export default function Payment() {
  const nav = useNavigate()
  const t = useT()

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 16px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label={t('common.back')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('payment.title')}</span>
      </div>
      <div style={{ padding: 20 }}>
        <PaymentPanel />
      </div>
    </div>
  )
}
