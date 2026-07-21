import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getFirebaseApp } from '../firebaseApp'
import { openInternalBrowser } from '../internalBrowser'

const Navy = '#0A4684'
const Gray = '#9E9E9E'

interface PageBlock { id: string; type: 'image' | 'video' | 'text'; url?: string; html?: string }
interface SocialLink { id: string; platform: string; url: string }
interface PageDoc { id: string; title: string; blocks: PageBlock[]; socialLinks?: SocialLink[] }

export default function StaticPage() {
  const nav = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [page, setPage] = useState<PageDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      if (!slug) { setLoading(false); return }
      const app = await getFirebaseApp()
      if (!app || cancelled) { setLoading(false); return }
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      unsub = onSnapshot(doc(db, 'pages', slug), snap => {
        if (cancelled) return
        setPage(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) }) : null)
        setLoading(false)
      }, () => setLoading(false))
    })()
    return () => { cancelled = true; unsub?.() }
  }, [slug])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingBottom: 20 }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 20px) 16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{page?.title || ''}</span>
      </div>

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Завантаження…</div>}
        {!loading && !page && <div style={{ textAlign: 'center', color: Gray, padding: 40 }}>Сторінка ще не наповнена.</div>}

        {page?.blocks?.map(block => {
          if (block.type === 'image' && block.url) {
            return <img key={block.id} src={block.url} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 14, display: 'block' }} />
          }
          if (block.type === 'video' && block.url) {
            return <video key={block.id} src={block.url} controls autoPlay muted playsInline style={{ width: '100%', borderRadius: 16, marginBottom: 14, display: 'block' }} />
          }
          if (block.type === 'text' && block.html) {
            return <div key={block.id} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: block.html }} />
          }
          return null
        })}

        {page?.socialLinks && page.socialLinks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {page.socialLinks.map(link => (
              <button key={link.id} onClick={() => openInternalBrowser(link.url)} style={{
                textAlign: 'left', background: '#fff', border: 'none', borderRadius: 14, padding: '14px 16px',
                fontSize: 15, fontWeight: 700, color: Navy, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                {link.platform}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
