import { useEffect, useState } from 'react'
import { getFirebaseApp } from './firebaseApp'

// Курс EUR→UAH — живий, з Firestore (settings/exchangeRate, поле eurToUah), змінюваний в
// панелі керування без оновлення застосунку. 50 — дефолт на випадок, якщо документ ще не
// створено або Firebase недоступний.
const DEFAULT_RATE = 50

export function useExchangeRate(): number {
  const [rate, setRate] = useState(DEFAULT_RATE)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const app = await getFirebaseApp()
      if (!app || cancelled) return
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      unsub = onSnapshot(doc(db, 'settings', 'exchangeRate'), snap => {
        if (cancelled) return
        const v = Number(snap.data()?.eurToUah)
        if (v > 0) setRate(v)
      }, () => {})
    })()
    return () => { cancelled = true; unsub?.() }
  }, [])

  return rate
}
