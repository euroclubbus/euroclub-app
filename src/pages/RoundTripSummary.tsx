import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSearchStore, useBookingStore } from '../store'
import { findTwoWayGroupPrice } from '../priceEngine'
import { useDisplayPrice } from '../currency'
import CurrencyToggle from '../components/CurrencyToggle'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

function calcDuration(depStr?: string, arrStr?: string) {
  if (!depStr || !arrStr) return ''
  const parse = (s: string) => {
    const [d, t] = s.split(' ')
    const [dd, mm, yyyy] = (d || '').split('.').map(Number)
    const [h, min] = (t || '0:0').split(':').map(Number)
    return new Date(yyyy, (mm || 1) - 1, dd, h, min)
  }
  const diffMin = Math.round((parse(arrStr).getTime() - parse(depStr).getTime()) / 60000)
  if (diffMin <= 0) return ''
  const h = Math.floor(diffMin / 60), m = diffMin % 60
  return m > 0 ? `${h}г ${m}хв` : `${h}г`
}

function perPassengerPrices(trip: any, cats: string[]): number[] {
  const opts: any[] = trip?.discounts || []
  const def = opts.find(d => d.default === 1 || d.default === '1') || opts[0]
  const fullPrice = Number(def?.price ?? trip?.price ?? 0)
  const list = cats.length ? cats : ['__one__']
  return list.map(catId => {
    const opt = opts.find(d => String(d.id) === String(catId))
    return Number(opt?.price ?? fullPrice)
  })
}

function LegCard({ title, trip }: { title: string; trip: any }) {
  const dep = trip?.departure?.[0]
  const arr = trip?.arrival?.[0]
  const depDT = (dep?.time || '').split(' ')
  const arrDT = (arr?.time || '').split(' ')
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: ORange, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: Gray, marginBottom: 8 }}>
        <span>{depDT[0]} → {arrDT[0]}</span>
        <span>⏱ {calcDuration(dep?.time, arr?.time)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>{depDT[1] || ''}</div>
          <div style={{ fontSize: 13 }}>{dep?.city_ua || dep?.city}</div>
          <div style={{ fontSize: 11, color: Gray }}>{dep?.name}</div>
        </div>
        <span style={{ fontSize: 24 }}>🚌</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 22 }}>{arrDT[1] || ''}</div>
          <div style={{ fontSize: 13 }}>{arr?.city_ua || arr?.city}</div>
          <div style={{ fontSize: 11, color: Gray }}>{arr?.name}</div>
        </div>
      </div>
    </div>
  )
}

export default function RoundTripSummary() {
  const nav = useNavigate()
  const t = useT()
  const { from, to, passengerCategories } = useSearchStore()
  const { selectedTrip, selectedTrip2 } = useBookingStore()
  const trip = selectedTrip as any
  const trip2 = selectedTrip2 as any
  const { format } = useDisplayPrice()

  if (!trip || !trip2) {
    // немає обох рейсів — нема що показувати, повертаємось на пошук
    nav('/')
    return null
  }

  const direction: 'ua' | 'eu' = from?.i2 === 'ua' ? 'ua' : 'eu'
  const twoWay = from && to ? findTwoWayGroupPrice(perPassengerPrices(trip, passengerCategories), from.id, to.id, direction) : null
  const total = twoWay?.total ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: '0 0 40px' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/bus-hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(7px) brightness(0.7)', transform: 'scale(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,28,58,0.45)' }} />
        <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 20px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('rts.title')}</span>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <LegCard title={t('booking.outbound')} trip={trip} />
        <LegCard title={t('booking.return')} trip={trip2} />

        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: Gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
              {t('rts.priceLabel')}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{format(total, trip?.currency)}</div>
          </div>
          <CurrencyToggle />
        </div>

        <button onClick={() => nav('/booking')} style={{
          width: '100%', padding: 18, background: ORange, color: '#fff',
          border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 17, cursor: 'pointer'
        }}>{t('rts.book')}</button>
      </div>
    </div>
  )
}
