// Maps each supported currency to its canonical locale so that
// Intl.NumberFormat places the symbol correctly (e.g. USD -> en-US gives $100,
// EUR -> de-DE gives 100 €) regardless of the user's UI language.
const CURRENCY_LOCALE: Record<string, string> = {
  AUD: 'en-AU',
  CAD: 'en-CA',
  CHF: 'de-CH',
  DKK: 'da-DK',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  NOK: 'nb-NO',
  NZD: 'en-NZ',
  SEK: 'sv-SE',
  SGD: 'en-SG',
  USD: 'en-US',
}

export function getCurrencyLocale(currency: string): string {
  return CURRENCY_LOCALE[currency] ?? 'en-US'
}
