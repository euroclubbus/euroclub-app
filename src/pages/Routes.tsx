import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Waypoints } from 'lucide-react'
import { getFirebaseApp } from '../firebaseApp'

const Navy = '#0A4684'
const ORange = '#F5A623'
const Gray = '#9E9E9E'

interface HubBranch { cityId: string; name: string }
interface RouteCity { id: string; cityId: string; name: string; arrivalTime: string; departureTime: string; isHub: boolean; hubBranches: HubBranch[] }
interface RouteDoc { id: string; order: number; name: string; cities: RouteCity[]; description: string }

function CityRow({ city, isLast }: { city: RouteCity; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: isLast ? 'none' : '1px solid #F2F2F2' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: ORange, flexShrink: 0 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1A1A1A' }}>{city.name}</div>
          <div style={{ fontSize: 12, color: Gray }}>
            {city.arrivalTime && `прибуття ${city.arrivalTime}`}
            {city.arrivalTime && city.departureTime && ' · '}
            {city.departureTime && `відправлення ${city.departureTime}`}
          </div>
        </div>
        {city.isHub && (
          <button onClick={() => setOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 4, background: '#FFF3DC', border: 'none',
            borderRadius: 20, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: ORange, cursor: 'pointer',
          }}>
            Хаб {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>
      {city.isHub && open && (
        <div style={{ marginLeft: 24, marginBottom: 10, padding: '8px 12px', background: '#FAFAFA', borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, color: Gray, marginBottom: 6 }}>Пересадка з {city.name}:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {city.hubBranches.map(b => (
              <span key={b.cityId} style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', background: '#fff', borderRadius: 20, padding: '4px 10px' }}>{b.name}</span>
            ))}
            {city.hubBranches.length === 0 && <span style={{ fontSize: 12, color: Gray }}>Немає даних</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Routes() {
  const nav = useNavigate()
  const [routes, setRoutes] = useState<RouteDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const app = await getFirebaseApp()
      if (!app || cancelled) { setLoading(false); return }
      const { getFirestore, collection, query, orderBy, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      const q = query(collection(db, 'routes'), orderBy('order', 'asc'))
      unsub = onSnapshot(q, snap => {
        if (cancelled) return
        setRoutes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
        setLoading(false)
      }, () => setLoading(false))
    })()
    return () => { cancelled = true; unsub?.() }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 20 }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 20px) 16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Маршрути</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Завантаження…</div>}
        {!loading && routes.length === 0 && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Маршрути з'являться найближчим часом.</div>}

        {routes.map(route => {
          const isOpen = openId === route.id
          return (
            <div key={route.id} style={{ background: '#fff', borderRadius: 20, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <button onClick={() => setOpenId(isOpen ? null : route.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <Waypoints size={18} color={Navy} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800 }}>{route.name}</div>
                  <div style={{ fontSize: 12, color: Gray, marginTop: 2 }}>{route.cities.map(c => c.name).join(' → ')}</div>
                </div>
                {isOpen ? <ChevronDown size={18} color={Gray} /> : <ChevronRight size={18} color={Gray} />}
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px' }}>
                  {route.cities.map((city, i) => (
                    <CityRow key={city.id} city={city} isLast={i === route.cities.length - 1} />
                  ))}
                  {route.description && (
                    <div style={{ marginTop: 12, padding: 12, background: '#FAFAFA', borderRadius: 12, fontSize: 13, color: '#444', lineHeight: 1.5 }}>
                      {route.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
