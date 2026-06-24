import { create } from 'zustand'

interface City { id: string; name: string; country: string }

interface SearchState {
  from: City | null; to: City | null
  dateFrom: string; dateTo: string; isOpenReturn: boolean
  passengerCount: number
  setFrom: (c: City | null) => void; setTo: (c: City | null) => void
  setDateFrom: (d: string) => void; setDateTo: (d: string) => void
  setOpenReturn: (v: boolean) => void
  setPassengerCount: (n: number) => void
  swap: () => void; reset: () => void
}

// Per-passenger discount is chosen on the Booking screen, where the real
// trip.discounts list (specific to the selected route) is available.
export interface PassengerDiscount { discountId: string; discount: number }

interface BookingState {
  selectedTrip: Record<string,unknown> | null
  selectedSeats: number[]
  passengerNames: Record<number, string>
  passengerDiscounts: Record<number, string> // index -> discountId (from trip.discounts)
  contactEmail: string; contactPhone: string; contactPhone2: string
  promoCode: string
  extraBaggage: number; oversizeBaggage: number
  orderHash: string; orderData: Record<string,unknown> | null
  setTrip: (t: Record<string,unknown> | null) => void
  setSeats: (s: number[]) => void
  setPassengerName: (idx: number, name: string) => void
  setPassengerDiscount: (idx: number, discountId: string) => void
  setContact: (field: 'email'|'phone'|'phone2', val: string) => void
  setPromo: (p: string) => void
  setBaggage: (type: 'extra'|'oversize', val: number) => void
  setOrderResult: (hash: string, data: Record<string,unknown>) => void
  resetBooking: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  from: null, to: null, dateFrom: '', dateTo: '', isOpenReturn: false,
  passengerCount: 1,
  setFrom: from => set({ from }),
  setTo: to => set({ to }),
  setDateFrom: dateFrom => set({ dateFrom }),
  setDateTo: dateTo => set({ dateTo }),
  setOpenReturn: isOpenReturn => set({ isOpenReturn }),
  setPassengerCount: (n) => set({ passengerCount: Math.max(1, n) }),
  swap: () => set(s => ({ from: s.to, to: s.from })),
  reset: () => set({ from: null, to: null, dateFrom: '', dateTo: '', passengerCount: 1 }),
}))

export const useBookingStore = create<BookingState>((set) => ({
  selectedTrip: null, selectedSeats: [], passengerNames: {}, passengerDiscounts: {},
  contactEmail: '', contactPhone: '', contactPhone2: '',
  promoCode: '', extraBaggage: 0, oversizeBaggage: 0,
  orderHash: '', orderData: null,
  setTrip: t => set({ selectedTrip: t, selectedSeats: [], passengerNames: {}, passengerDiscounts: {} }),
  setSeats: s => set({ selectedSeats: s }),
  setPassengerName: (idx, name) => set(s => ({ passengerNames: { ...s.passengerNames, [idx]: name } })),
  setPassengerDiscount: (idx, discountId) => set(s => ({ passengerDiscounts: { ...s.passengerDiscounts, [idx]: discountId } })),
  setContact: (field, val) => set(field === 'email' ? { contactEmail: val } : field === 'phone' ? { contactPhone: val } : { contactPhone2: val }),
  setPromo: promoCode => set({ promoCode }),
  setBaggage: (type, val) => type === 'extra' ? set({ extraBaggage: val }) : set({ oversizeBaggage: val }),
  setOrderResult: (hash, data) => set({ orderHash: hash, orderData: data }),
  resetBooking: () => set({ selectedTrip: null, selectedSeats: [], passengerNames: {}, passengerDiscounts: {}, contactEmail: '', contactPhone: '', contactPhone2: '', promoCode: '', extraBaggage: 0, oversizeBaggage: 0, orderHash: '', orderData: null }),
}))
