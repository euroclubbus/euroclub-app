import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { getFirebaseApp } from '../firebaseApp'
import { useAuthStore } from '../authStore'
import { useT } from '../i18n'

const Navy = '#0A4684'
const ORange = '#F5A623'
const Gray = '#9E9E9E'

interface FeedbackMessage { id: string; from: 'user' | 'admin'; text: string; at: number }

export default function Feedback() {
  const nav = useNavigate()
  const t = useT()
  const user = useAuthStore(s => s.user)
  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      if (!user?.id) { setLoading(false); return }
      const app = await getFirebaseApp()
      if (!app || cancelled) { setLoading(false); return }
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      unsub = onSnapshot(doc(db, 'feedback_threads', String(user.id)), snap => {
        if (cancelled) return
        const data = snap.data() as any
        setMessages(data?.messages || [])
        setLoading(false)
      }, () => setLoading(false))
    })()
    return () => { cancelled = true; unsub?.() }
  }, [user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!text.trim() || !user?.id || sending) return
    setSending(true)
    try {
      const app = await getFirebaseApp()
      if (!app) return
      const { getFirestore, doc, setDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore')
      const db = getFirestore(app)
      const msg: FeedbackMessage = { id: crypto.randomUUID(), from: 'user', text: text.trim(), at: Date.now() }
      await setDoc(doc(db, 'feedback_threads', String(user.id)), {
        userId: user.id,
        lastMessageAt: serverTimestamp(),
        messages: arrayUnion(msg),
      }, { merge: true })
      setText('')
    } catch (e) {
      console.error('[Feedback] send failed', e)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: Navy, padding: 'calc(env(safe-area-inset-top) + 20px) 16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Залишити відгук</span>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', color: Gray, padding: 20 }}>Завантаження…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: Gray, padding: 20, fontSize: 13.5, lineHeight: 1.5 }}>
            Напишіть нам, якщо є питання, пропозиція чи скарга. Ми відповімо тут і надішлемо сповіщення.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            background: m.from === 'user' ? ORange : '#fff',
            color: m.from === 'user' ? '#fff' : '#1A1A1A',
            borderRadius: 16,
            padding: '10px 14px',
            fontSize: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, background: '#fff', display: 'flex', gap: 8, borderTop: '1px solid #EEE', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ваше повідомлення…"
          style={{ flex: 1, padding: '12px 14px', border: '1.5px solid #EEE', borderRadius: 20, fontSize: 14, outline: 'none' }}
        />
        <button onClick={send} disabled={!text.trim() || sending} style={{
          width: 44, height: 44, borderRadius: '50%', background: ORange, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          opacity: !text.trim() || sending ? 0.5 : 1, flexShrink: 0,
        }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
