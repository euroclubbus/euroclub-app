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
  return amount
}
