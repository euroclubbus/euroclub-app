import { useState } from 'react'
import { Info } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { computeLegPricing } from '../pricing'

// Кеп (01.10): рейс без жодної фіксованої знижки (пенсіонери, діти, УБД…) і без онлайн-
// знижки — окремий клікабельний рядок під ціною + попап-пояснення.
const isOnlineDiscountName = (n: string) => /^\s*(SALE|MOB)\b/i.test(n)

export function hasNoFixedDiscounts(trip: any): boolean {
  if (!trip) return false
  const fixed = (trip.discounts || []).filter((d: any) =>
    Number(d?.discount) > 0 && String(d?.id) !== '43' && !isOnlineDiscountName(String(d?.name || '')))
  return fixed.length === 0 && computeLegPricing(trip).знижкаПроц === 0
}

export const isChisinau = (name?: string) => /кишин|кишен|chi[sș]in|kischin/i.test(String(name || ''))

export default function SinglePriceNote({ route }: { route: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: 0,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 12.5, color: '#0A4684', textDecoration: 'underline', textUnderlineOffset: 2,
      }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        Рейс за повною ціною. Фіксовані знижки на рейсі відсутні.
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Єдина ціна">
        <p style={{ fontSize: 15, lineHeight: 1.5, color: '#1A1A1A', margin: '4px 0 16px' }}>
          {route
            ? 'На цьому маршруті діє єдина ціна для всіх категорій пасажирів.'
            : 'На цьому рейсі діє єдина ціна для всіх категорій пасажирів.'}
        </p>
        <button onClick={() => setOpen(false)} style={{ width: '100%', padding: 14, background: '#F5A623', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Зрозуміло
        </button>
      </BottomSheet>
    </>
  )
}
