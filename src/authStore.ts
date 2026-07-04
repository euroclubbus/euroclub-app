import { create } from 'zustand'

export interface AuthUser {
  id: string
  header: string   // ПІБ
  email: string
  phone: string
  key: string      // токен сесії (uidkey для замовлень)
}

interface AuthState {
  user: AuthUser | null
  setUser: (u: AuthUser) => void
  logout: () => void
}

const stored = (() => {
  try { const s = localStorage.getItem('eclub_user'); return s ? JSON.parse(s) as AuthUser : null } catch { return null }
})()

export const useAuthStore = create<AuthState>((set) => ({
  user: stored,
  setUser: (user) => { try { localStorage.setItem('eclub_user', JSON.stringify(user)) } catch {}; set({ user }) },
  logout: () => { try { localStorage.removeItem('eclub_user') } catch {}; set({ user: null }) },
}))

// uidkey для замовлень: ключ сесії або 0
export function currentUidKey(): string {
  try { const s = localStorage.getItem('eclub_user'); return s ? (JSON.parse(s).key || '0') : '0' } catch { return '0' }
}
