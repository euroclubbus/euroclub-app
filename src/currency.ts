// Внутрішній курс конвертації EUR/UAH (фіксований, не ринковий)
export const EUR_UAH_RATE = 50

export function toUAH(amount: number, currency: string): number {
  return /eur/i.test(currency) ? Math.round(amount * EUR_UAH_RATE) : amount
}

export function toEUR(amount: number, currency: string): number {
  return /eur/i.test(currency) ? amount : Math.round(amount / EUR_UAH_RATE)
}

// Конвертувати суму з однієї валюти в іншу (за кодом валюти джерела)
export function convert(amount: number, fromCurrency: string, toCurrency: 'UAH' | 'EUR'): number {
  const isEur = /eur/i.test(fromCurrency)
  if (isEur && toCurrency === 'UAH') return Math.round(amount * EUR_UAH_RATE)
  if (!isEur && toCurrency === 'EUR') return Math.round(amount / EUR_UAH_RATE)
  // Кеп (28.08): навіть без конвертації валют — округлюємо тут теж, як останній
  // запобіжник. Якщо десь в pricing.ts закралось неокруглене число (як сталось із
  // legPriceWithFixedCategory) — воно все одно не дійде до екрана як плаваюча кома.
  return Math.round(amount)
}

import { useUiStore } from './store'

// Хук: повертає { displayCurrency, setDisplayCurrency, format }
// format конвертує суму з валюти рейсу (trip.currency) у вибрану валюту показу і додає символ.
export function useDisplayPrice() {
  const { displayCurrency, setDisplayCurrency } = useUiStore()
  const format = (amount: number, sourceCurrency?: string) => {
    const converted = convert(amount, sourceCurrency || 'uah', displayCurrency)
    const sign = displayCurrency === 'EUR' ? '€' : '₴'
    return `${converted} ${sign}`
  }
  return { displayCurrency, setDisplayCurrency, format }
}
