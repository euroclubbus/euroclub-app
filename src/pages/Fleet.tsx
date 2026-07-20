import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, ChevronLeft, ChevronRight, Wind, Star, Wifi, Coffee } from 'lucide-react'
import { getFirebaseApp } from '../firebaseApp'
import { useT } from '../i18n'

const Navy = '#0A4684'
const ORange = '#F5A623'
const Gray = '#9E9E9E'

interface FleetAmenities { climate: boolean; vip: boolean; wifi: boolean; toilet: boolean; kitchen: boolean }
interface FleetBus {
  id: string
  order: number
  brandModel: string
  plateNumber: string
  floors: 1 | 2
  seats: number
  euroClass: string
  amenities: FleetAmenities
  photos: string[]
  galleryMode: 'slider' | 'collage'
}

const AMENITY_ICONS: { key: keyof FleetAmenities; label: string; icon: any }[] = [
  { key: 'climate', label: 'Клімат-контроль', icon: Wind },
  { key: 'vip', label: 'Віп-салон', icon: Star },
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'toilet', label: 'Туалет', icon: null },
  { key: 'kitchen', label: 'Кухня', icon: Coffee },
]

function Lightbox({ photos, index, onClose, onChange }: { photos: string[]; index: number; onClose: () => void; onChange: (i: number) => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} aria-label="Закрити" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
        <X size={26} color="#fff" />
      </button>
      {photos.length > 1 && (
        <button onClick={e => { e.stopPropagation(); onChange((index - 1 + photos.length) % photos.length) }} style={{ position: 'absolute', left: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={32} color="#fff" />
        </button>
      )}
      <img src={photos[index]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain', borderRadius: 8 }} />
      {photos.length > 1 && (
        <button onClick={e => { e.stopPropagation(); onChange((index + 1) % photos.length) }} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronRight size={32} color="#fff" />
        </button>
      )}
      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 20px)', display: 'flex', gap: 6 }}>
          {photos.map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === index ? '#fff' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function BusGallery({ photos, mode, onOpen }: { photos: string[]; mode: 'slider' | 'collage'; onOpen: (i: number) => void }) {
  const [slide, setSlide] = useState(0)
  if (photos.length === 0) return null

  if (mode === 'collage') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: 4, borderRadius: 14, overflow: 'hidden' }}>
        {photos.slice(0, 4).map((url, i) => (
          <div key={i} onClick={() => onOpen(i)} style={{ position: 'relative', aspectRatio: '1', cursor: 'pointer' }}>
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {i === 3 && photos.length > 4 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
                +{photos.length - 4}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Слайдер — горизонтальний scroll-snap із крапками-індикаторами
  return (
    <div>
      <div
        onScroll={e => {
          const el = e.currentTarget
          setSlide(Math.round(el.scrollLeft / el.clientWidth))
        }}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', borderRadius: 14, WebkitOverflowScrolling: 'touch' }}
      >
        {photos.map((url, i) => (
          <img key={i} src={url} alt="" onClick={() => onOpen(i)} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', width: '100%', aspectRatio: '16/10', objectFit: 'cover', cursor: 'pointer' }} />
        ))}
      </div>
      {photos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {photos.map((_, i) => (
            <div key={i} style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, background: i === slide ? ORange : '#DDD', transition: 'all 0.2s' }} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Fleet() {
  const nav = useNavigate()
  const t = useT()
  const [buses, setBuses] = useState<FleetBus[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<{ busId: string; index: number } | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const app = await getFirebaseApp()
      if (!app || cancelled) { setLoading(false); return }
      const { getFirestore, collection, query, orderBy, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      const q = query(collection(db, 'fleet'), orderBy('order', 'asc'))
      unsub = onSnapshot(q, snap => {
        if (cancelled) return
        setBuses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
        setLoading(false)
      }, () => setLoading(false))
    })()
    return () => { cancelled = true; unsub?.() }
  }, [])

  const activeBus = buses.find(b => b.id === lightbox?.busId)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 20 }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 20px) 16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{t('home.fleet')}</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Завантаження…</div>}
        {!loading && buses.length === 0 && (
          <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Інформація про автопарк з'явиться найближчим часом.</div>
        )}
        {buses.map(bus => (
          <div key={bus.id} style={{ background: '#fff', borderRadius: 20, padding: 14, marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {bus.photos?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <BusGallery photos={bus.photos} mode={bus.galleryMode || 'slider'} onOpen={i => setLightbox({ busId: bus.id, index: i })} />
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{bus.brandModel}</div>
            <div style={{ fontSize: 13, color: Gray, marginBottom: 12 }}>
              {bus.plateNumber} · {bus.floors === 2 ? '2 поверхи' : '1 поверх'} · {bus.seats} місць · {bus.euroClass}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AMENITY_ICONS.filter(a => bus.amenities?.[a.key]).map(a => (
                <span key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#FFF3DC', borderRadius: 20, fontSize: 12, fontWeight: 600, color: ORange }}>
                  {a.icon && <a.icon size={13} />}
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightbox && activeBus && (
        <Lightbox
          photos={activeBus.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={i => setLightbox({ busId: activeBus.id, index: i })}
        />
      )}
    </div>
  )
}
