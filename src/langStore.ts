import { create } from 'zustand'

export type Lang = 'uk' | 'en' | 'de' | 'ru'

const STORAGE_KEY = 'eclub_lang'

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'uk' || saved === 'en' || saved === 'de' || saved === 'ru') return saved
  } catch {}
  return 'uk'
}

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
    set({ lang })
  },
}))
