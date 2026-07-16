import { create } from 'zustand'

interface City { id: string; name: string; country: string; i2: string }

interface SearchState {
  from: City | null; to: City | null
  dateFrom: string; dateTo: string; isOpenReturn: boolean
  passengerCount: number
  passengerCategories: string[] // склад по категоріях (id з глобального discount)
  setFrom: (c: City | null) => void; setTo: (c: City | null) => void
  setDateFrom: (d: string) => void; setDateTo: (d: string) => void
  setOpenReturn: (v: boolean) => void
  setPassengerCount: (n: number) => void
  setPassengerCategories: (c: string[]) => void
  addPassengerCategory: (catId: string) => void
  removePassengerCategoryAt: (idx: number) => void
  swap: () => void; reset: () => void
}

// Per-passenger discount is chosen on the Booking screen, where the real
// trip.discounts list (specific to the selected route) is available.
export interface PassengerDiscount { discountId: string; discount: number }

interface BookingState {
  selectedTrip: Record<string,unknown> | null
  selectedSeats: number[]
  // Зворотний напрямок (двобічне замовлення, route2/open/price — незадокументовані поля)
  selectedTrip2: Record<string,unknown> | null
  selectedSeats2: number[]
  passengerNames: Record<number, string>
  passengerDiscounts: Record<number, string> // index -> discountId (from trip.discounts)
  contactEmail: string; contactPhone: string; contactPhone2: string; payerName: string
  promoCode: string
  extraBaggage: number; oversizeBaggage: number
  orderHash: string; orderData: Record<string,unknown> | null
  setTrip: (t: Record<string,unknown> | null) => void
  setTrip2: (t: Record<string,unknown> | null) => void
  setSeats: (s: number[]) => void
  setSeats2: (s: number[]) => void
  setPassengerName: (idx: number, name: string) => void
  setPassengerDiscount: (idx: number, discountId: string) => void
  removePassengerDataAt: (idx: number) => void
  setContact: (field: 'email'|'phone'|'phone2', val: string) => void
  setPayerName: (val: string) => void
  setPromo: (p: string) => void
  setBaggage: (type: 'extra'|'oversize', val: number) => void
  setOrderResult: (hash: string, data: Record<string,unknown>) => void
  resetBooking: () => void
}

// Глобальний перемикач валюти відображення (не залежить від searchStore/bookingStore,
// щоб не скидався при resetBooking() чи новому пошуку)
interface UiState {
  displayCurrency: 'UAH' | 'EUR'
  setDisplayCurrency: (c: 'UAH' | 'EUR') => void
}
export const useUiStore = create<UiState>((set) => ({
  displayCurrency: 'UAH',
  setDisplayCurrency: displayCurrency => set({ displayCurrency }),
}))

export const useSearchStore = create<SearchState>((set) => ({
  from: null, to: null, dateFrom: '', dateTo: '', isOpenReturn: false,
  passengerCount: 1,
  passengerCategories: [],
  setFrom: from => set({ from }),
  setTo: to => set({ to }),
  setDateFrom: dateFrom => set({ dateFrom }),
  setDateTo: dateTo => set({ dateTo }),
  setOpenReturn: isOpenReturn => set({ isOpenReturn }),
  setPassengerCount: (n) => set({ passengerCount: Math.max(1, n) }),
  setPassengerCategories: (c) => set({ passengerCategories: c, passengerCount: Math.max(1, c.length) }),
  addPassengerCategory: (catId) => set(s => { const c = [...s.passengerCategories, catId]; return { passengerCategories: c, passengerCount: c.length } }),
  removePassengerCategoryAt: (idx) => set(s => { const c = s.passengerCategories.filter((_, i) => i !== idx); return { passengerCategories: c, passengerCount: Math.max(1, c.length) } }),
  swap: () => set(s => ({ from: s.to, to: s.from })),
  reset: () => set({ from: null, to: null, dateFrom: '', dateTo: '', passengerCount: 1, passengerCategories: [] }),
}))

export const useBookingStore = create<BookingState>((set) => ({
  selectedTrip: null, selectedSeats: [],
  selectedTrip2: null, selectedSeats2: [],
  passengerNames: {}, passengerDiscounts: {},
  contactEmail: '', contactPhone: '', contactPhone2: '', payerName: '',
  promoCode: '', extraBaggage: 0, oversizeBaggage: 0,
  orderHash: '', orderData: null,
  setTrip: t => set({ selectedTrip: t, selectedSeats: [], passengerNames: {}, passengerDiscounts: {} }),
  setTrip2: t => set({ selectedTrip2: t, selectedSeats2: [] }),
  setSeats: s => set({ selectedSeats: s }),
  setSeats2: s => set({ selectedSeats2: s }),
  setPassengerName: (idx, name) => set(s => ({ passengerNames: { ...s.passengerNames, [idx]: name } })),
  setPassengerDiscount: (idx, discountId) => set(s => ({ passengerDiscounts: { ...s.passengerDiscounts, [idx]: discountId } })),
  removePassengerDataAt: (idx) => set(s => {
    const remap = (obj: Record<number, string>) => {
      const keys = Object.keys(obj).map(Number)
      const maxK = keys.length ? Math.max(...keys) : -1
      const out: Record<number, string> = {}
      let j = 0
      for (let i = 0; i <= maxK; i++) {
        if (i === idx) continue
        if (obj[i] != null) out[j] = obj[i]
        j++
      }
      return out
    }
    return { passengerNames: remap(s.passengerNames), passengerDiscounts: remap(s.passengerDiscounts) }
  }),
  setContact: (field, val) => set(field === 'email' ? { contactEmail: val } : field === 'phone' ? { contactPhone: val } : { contactPhone2: val }),
  setPayerName: (val) => set({ payerName: val }),
  setPromo: promoCode => set({ promoCode }),
  setBaggage: (type, val) => type === 'extra' ? set({ extraBaggage: val }) : set({ oversizeBaggage: val }),
  setOrderResult: (hash, data) => set({ orderHash: hash, orderData: data }),
  resetBooking: () => set({ selectedTrip: null, selectedSeats: [], selectedTrip2: null, selectedSeats2: [], passengerNames: {}, passengerDiscounts: {}, contactEmail: '', contactPhone: '', contactPhone2: '', payerName: '', promoCode: '', extraBaggage: 0, oversizeBaggage: 0, orderHash: '', orderData: null }),
}))
