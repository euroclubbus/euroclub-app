import { useEffect, useState } from 'react'
import { getFirebaseApp } from './firebaseApp'

export interface RegistryPassenger {
  index: number
  ticketNumber: string
  discountName: string
  discountPercent: number
  tariff: number
  price: number
}
export interface RegistrySurcharge {
  amount: number
  reason: string
  at: string
}
export interface RegistryOrder {
  orderNo: string
  passengers: RegistryPassenger[]
  surcharges?: RegistrySurcharge[]
}

// Реєстр замовлень (панель керування) — тепер основне джерело ціни для показу в застосунку.
// Адмін редагує тариф/знижку в панелі — застосунок читає це живо (onSnapshot), тож зміна
// видна одразу при оновленні сторінки замовлення, як і просив Кеп.
export function useOrderRegistry(orderNo: string | undefined): RegistryOrder | null {
  const [data, setData] = useState<RegistryOrder | null>(null)

  useEffect(() => {
    setData(null)
    if (!orderNo) return
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const app = await getFirebaseApp()
      if (!app || cancelled) return
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      const db = getFirestore(app)
      unsub = onSnapshot(doc(db, 'order_registry', orderNo), snap => {
        if (cancelled) return
        setData(snap.exists() ? (snap.data() as RegistryOrder) : null)
      }, () => setData(null))
    })()
    return () => { cancelled = true; unsub?.() }
  }, [orderNo])

  return data
}
