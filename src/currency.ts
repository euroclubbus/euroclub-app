// Внутрішній курс конвертації EUR/UAH (фіксований, не ринковий)
export const EUR_UAH_RATE = 50

export function toUAH(amount: number, currency: string): number {
  return /eur/i.test(currency) ? Math.round(amount * EUR_UAH_RATE) : amount
}

export function toEUR(amount: number, currency: string): number {
  return /eur/i.test(currency) ? amount : Math.round(amount / EUR_UAH_RATE)
}

// Кеп (28.08): "залишаємо числа як є до сотих" — це стосується показу ВСІХ даних всюди
// (включно з живими значеннями бекенду, які можуть бути дробовими — напр. тестовий
// сценарій із tariff=1 давав prc=0.8). Округлення до ЦІЛОГО тут (як було раніше,
// "запобіжник") ЛОМАЛО живі суми бекенду — прибрано. Округлення до 2 знаків лишається
// тільки для прибирання артефактів плаваючої коми (3849.9999999999995 і подібне) — не
// для реального обрізання копійок. Наші ВЛАСНІ розрахунки (pricing.ts) і далі
// повертають цілі через власний roundPrice() ДО того, як число сюди потрапляє — тут
// нічого не ламається.
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Конвертувати суму з однієї валюти в іншу (за кодом валюти джерела)
export function convert(amount: number, fromCurrency: string, toCurrency: 'UAH' | 'EUR'): number {
  const isEur = /eur/i.test(fromCurrency)
  if (isEur && toCurrency === 'UAH') return round2(amount * EUR_UAH_RATE)
  if (!isEur && toCurrency === 'EUR') return round2(amount / EUR_UAH_RATE)
  return round2(amount)
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
