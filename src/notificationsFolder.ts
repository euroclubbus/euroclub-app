import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'
import { useAuthStore } from './authStore'

// Кеп (19.08): "папка сповіщень" юзера — колекція notifications/{userId}/messages/{id}.
// Пишеться адмінкою ЗАВЖДИ при надсиланні (Push-розсилки, Вхідні, "Надіслати сповіщення"),
// незалежно від того, чи є в юзера токен пристрою для push-банера — це окремі, незалежні
// дії. Тут — тільки читання (застосунок сам нічого сюди не пише).
//
// Кеп (04.09): НЕЗАЛЕЖНИЙ від FCM спосіб показати "справжнє" сповіщення — коли живий
// onSnapshot приносить НОВИЙ запис (не з першого завантаження!), показуємо локальний
// системний банер зі звуком (@capacitor/local-notifications). Працює, поки застосунок
// живий (відкритий чи згорнутий у фоні) — на відміну від FCM, тут НЕМА токенів, серверних
// ключів, FCM-реєстрації — тому й не залежить від усього того, що сьогодні ламалось.

export interface FolderNotif {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string // ISO
  type: 'marketing' | 'service' // service = транзакційне (по замовленню/рейсу), червона мітка
  deepLink: string | null // Кеп (04.09): куди перейти по кліку, якщо адмін вказав
  feedback: 'like' | 'dislike' | null // Кеп (04.09): реакція юзера — для статистики в адмінці
}

interface NotificationsState {
  items: FolderNotif[]
  unreadCount: number
  loading: boolean
  unsubscribe: (() => void) | null
  start: () => void
  stop: () => void
}

let localNotifIdCounter = 1

async function showLocalNotification(n: FolderNotif) {
  if (!Capacitor.isNativePlatform()) return // PWA/веб — немає системних банерів
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions()
      if (req.display !== 'granted') return
    }
    // Кеп: звук уже підготовлений з обох боків — android/app/src/main/res/raw/notification_sound.mp3,
    // ios/App/App/Sounds/notification_sound.caf. Capacitor сам підбирає правильний формат
    // по платформі (для Android достатньо імені файлу, плагін сам резолвить у raw/).
    const soundFile = Capacitor.getPlatform() === 'ios' ? 'notification_sound.caf' : 'notification_sound.mp3'
    await LocalNotifications.schedule({
      notifications: [{
        id: localNotifIdCounter++,
        title: n.title,
        body: n.body,
        sound: soundFile,
        schedule: { at: new Date(Date.now() + 100) },
      }],
    })
  } catch (e) {
    console.error('[Notifications] local notification failed', e)
  }
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
    let isFirstSnapshot = true // перше завантаження — старі записи, не сповіщаємо про них
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
          return { id: d.id, title: data.title || '', body: data.body || '', read: !!data.read, createdAt: data.createdAt || '', type: data.type === 'service' ? 'service' : 'marketing', deepLink: data.deepLink || null, feedback: data.feedback === 'like' || data.feedback === 'dislike' ? data.feedback : null }
        })
        if (!isFirstSnapshot) {
          const prevIds = new Set(get().items.map((n) => n.id))
          const freshItems = items.filter((n) => !prevIds.has(n.id))
          for (const n of freshItems) showLocalNotification(n)
        }
        isFirstSnapshot = false
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

// Кеп (04.09): лайк/дизлайк — на самому документі повідомлення, для статистики в
// адмінці. Записуємо ОДРАЗУ обрану реакцію (без окремого підтвердження) — можна
// змінити думку пізніше, перезаписом того самого поля.
export async function setNotifFeedback(notifId: string, feedback: 'like' | 'dislike') {
  const userId = useAuthStore.getState().user?.id
  if (!userId || !isFirebaseConfigured()) return
  try {
    const [{ initializeApp, getApps }, { getFirestore, doc, updateDoc }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    const db = getFirestore(app)
    await updateDoc(doc(db, 'notifications', String(userId), 'messages', notifId), { feedback })
  } catch (e) {
    console.error('[Notifications] setFeedback failed', e)
  }
}

export function formatNotifDate(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return iso }
}
