import { create } from 'zustand'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'
import { useAuthStore } from './authStore'

// Кеп (19.08): "папка сповіщень" юзера — колекція notifications/{userId}/messages/{id}.
// Пишеться адмінкою ЗАВЖДИ при надсиланні (Push-розсилки, Вхідні, "Надіслати сповіщення"),
// незалежно від того, чи є в юзера токен пристрою для push-банера — це окремі, незалежні
// дії. Тут — тільки читання (застосунок сам нічого сюди не пише).

export interface FolderNotif {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string // ISO
}

interface NotificationsState {
  items: FolderNotif[]
  unreadCount: number
  loading: boolean
  unsubscribe: (() => void) | null
  start: () => void
  stop: () => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  unsubscribe: null,
  start: async () => {
    if (get().unsubscribe) return // вже підписані
    const userId = useAuthStore.getState().user?.id
    if (!userId || !isFirebaseConfigured()) return
    set({ loading: true })
    try {
      const [{ initializeApp, getApps }, { getFirestore, collection, query, orderBy, onSnapshot }] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ])
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      const db = getFirestore(app)
      const q = query(collection(db, 'notifications', String(userId), 'messages'), orderBy('createdAt', 'desc'))
      const unsub = onSnapshot(q, (snap) => {
        const items: FolderNotif[] = snap.docs.map((d) => {
          const data = d.data() as any
          return { id: d.id, title: data.title || '', body: data.body || '', read: !!data.read, createdAt: data.createdAt || '' }
        })
        set({ items, unreadCount: items.filter((n) => !n.read).length, loading: false })
      }, () => set({ loading: false }))
      set({ unsubscribe: unsub })
    } catch (e) {
      console.error('[Notifications] subscribe failed', e)
      set({ loading: false })
    }
  },
  stop: () => {
    const unsub = get().unsubscribe
    if (unsub) unsub()
    set({ unsubscribe: null, items: [], unreadCount: 0 })
  },
}))

export async function markNotifRead(notifId: string) {
  const userId = useAuthStore.getState().user?.id
  if (!userId || !isFirebaseConfigured()) return
  try {
    const [{ initializeApp, getApps }, { getFirestore, doc, updateDoc }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    await updateDoc(doc(db, 'notifications', String(userId), 'messages', notifId), { read: true })
  } catch (e) {
    console.error('[Notifications] markRead failed', e)
  }
}

export function formatNotifDate(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return iso }
}
