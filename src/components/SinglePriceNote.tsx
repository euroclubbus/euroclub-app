import { useState } from 'react'
import { Info } from 'lucide-react'
import { computeLegPricing } from '../pricing'

// Кеп (01.10): рейс без жодної фіксованої знижки (пенсіонери, діти, УБД…) і без онлайн-
// знижки — окремий клікабельний рядок під ціною + попап-пояснення.
const isOnlineDiscountName = (n: string) => /^\s*(SALE|MOB)\b/i.test(n)

export function hasNoFixedDiscounts(trip: any): boolean {
  if (!trip) return false
  // "доп. место" (8) і "Тварина" (51) — службові тарифи, не знижки для категорій пасажирів.
  const SERVICE_IDS = new Set(['8', '51', '43'])
  const fixed = (trip.discounts || []).filter((d: any) =>
    Number(d?.discount) > 0 && !SERVICE_IDS.has(String(d?.id)) &&
    !/доп\.?\s*мест|тварин|zusätzlich|tierplatz/i.test(String(d?.name || '')) &&
    !isOnlineDiscountName(String(d?.name || '')))
  const result = fixed.length === 0 && computeLegPricing(trip).знижкаПроц === 0
  return result
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
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
            width: '100%', maxWidth: 340, background: 'rgba(0,0,0,0.95)', borderRadius: 20,
            padding: '28px 22px 22px', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          }}>
            <p style={{ color: '#fff', fontSize: 16, lineHeight: 1.5, margin: '0 0 22px' }}>
              {route
                ? 'На цьому маршруті діє єдина ціна для всіх категорій пасажирів.'
                : 'На цьому рейсі діє єдина ціна для всіх категорій пасажирів.'}
            </p>
            <button onClick={() => setOpen(false)} style={{ width: '100%', padding: 14, background: '#F5A623', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Зрозуміло
            </button>
          </div>
        </div>
      )}
    </>
  )
}
