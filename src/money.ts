import type { PennyWalletConfig, RatePoint, Wallet } from './types'

export interface CurrencyInfo {
  code: string
  symbol: string
  decimals: 0 | 2 | 3
}

/**
 * A working subset of ISO 4217 - the codes people are realistically likely to
 * hold an account in. `decimals` follows the standard's minor-unit count, which
 * is why JPY and KRW are 0 and the Gulf dinars are 3.
 *
 * An unlisted code still works: getCurrency synthesises a 2-decimal entry that
 * uses the code itself as its symbol.
 */
export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'AED', symbol: 'د.إ', decimals: 2 },
  { code: 'ARS', symbol: '$', decimals: 2 },
  { code: 'AUD', symbol: 'A$', decimals: 2 },
  { code: 'BGN', symbol: 'лв', decimals: 2 },
  { code: 'BHD', symbol: '.د.ب', decimals: 3 },
  { code: 'BRL', symbol: 'R$', decimals: 2 },
  { code: 'CAD', symbol: 'C$', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', decimals: 2 },
  { code: 'CLP', symbol: '$', decimals: 0 },
  { code: 'CNY', symbol: '¥', decimals: 2 },
  { code: 'COP', symbol: '$', decimals: 2 },
  { code: 'CZK', symbol: 'Kč', decimals: 2 },
  { code: 'DKK', symbol: 'kr', decimals: 2 },
  { code: 'EGP', symbol: 'E£', decimals: 2 },
  { code: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', symbol: '£', decimals: 2 },
  { code: 'HKD', symbol: 'HK$', decimals: 2 },
  { code: 'HUF', symbol: 'Ft', decimals: 2 },
  { code: 'IDR', symbol: 'Rp', decimals: 2 },
  { code: 'ILS', symbol: '₪', decimals: 2 },
  { code: 'INR', symbol: '₹', decimals: 2 },
  { code: 'ISK', symbol: 'kr', decimals: 0 },
  { code: 'JOD', symbol: 'JD', decimals: 3 },
  { code: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'KRW', symbol: '₩', decimals: 0 },
  { code: 'KWD', symbol: 'KD', decimals: 3 },
  { code: 'MAD', symbol: 'DH', decimals: 2 },
  { code: 'MXN', symbol: 'MX$', decimals: 2 },
  { code: 'MYR', symbol: 'RM', decimals: 2 },
  { code: 'NGN', symbol: '₦', decimals: 2 },
  { code: 'NOK', symbol: 'kr', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', decimals: 2 },
  { code: 'OMR', symbol: 'ر.ع.', decimals: 3 },
  { code: 'PEN', symbol: 'S/', decimals: 2 },
  { code: 'PHP', symbol: '₱', decimals: 2 },
  { code: 'PKR', symbol: '₨', decimals: 2 },
  { code: 'PLN', symbol: 'zł', decimals: 2 },
  { code: 'QAR', symbol: 'ر.ق', decimals: 2 },
  { code: 'RON', symbol: 'lei', decimals: 2 },
  { code: 'RSD', symbol: 'дин', decimals: 2 },
  { code: 'RUB', symbol: '₽', decimals: 2 },
  { code: 'SAR', symbol: '﷼', decimals: 2 },
  { code: 'SEK', symbol: 'kr', decimals: 2 },
  { code: 'SGD', symbol: 'S$', decimals: 2 },
  { code: 'THB', symbol: '฿', decimals: 2 },
  { code: 'TRY', symbol: '₺', decimals: 2 },
  { code: 'TWD', symbol: 'NT$', decimals: 2 },
  { code: 'UAH', symbol: '₴', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2 },
  { code: 'VND', symbol: '₫', decimals: 0 },
  { code: 'ZAR', symbol: 'R', decimals: 2 },
]

const BY_CODE = new Map(CURRENCIES.map(c => [c.code, c]))

/** Never throws: an unknown code becomes a 2-decimal entry symbolised by itself. */
export function getCurrency(code: string): CurrencyInfo {
  const normalized = (code || '').trim().toUpperCase()
  return BY_CODE.get(normalized) ?? { code: normalized, symbol: normalized, decimals: 2 }
}

/** The account's own currency, falling back to the base for wallets predating the field. */
export function walletCurrency(wallet: Pick<Wallet, 'currency'>, config: PennyWalletConfig): string {
  return wallet.currency || baseCurrency(config)
}

export function baseCurrency(config: PennyWalletConfig): string {
  return config.baseCurrency || 'USD'
}

/**
 * Decimal places to render `code` with. A numeric `decimalPlaces` setting is a
 * deliberate global override (and is what every pre-multi-currency vault
 * stores); 'auto' defers to the currency's own minor units.
 */
export function currencyDecimals(code: string, config: PennyWalletConfig): number {
  const setting = config.decimalPlaces ?? 0
  if (setting === 0 || setting === 2) return setting
  return getCurrency(code).decimals
}

/** Grouped digits only, no symbol - the direct replacement for formatAmount. */
export function formatMoneyValue(n: number, code: string, config: PennyWalletConfig): string {
  const dp = currencyDecimals(code, config)
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Symbol + grouped digits, e.g. "£1,234.50". */
export function formatMoney(n: number, code: string, config: PennyWalletConfig): string {
  return getCurrency(code).symbol + formatMoneyValue(n, code, config)
}

function ratesFor(config: PennyWalletConfig, code: string): RatePoint[] {
  return (config.rates ?? [])
    .filter(r => r.code === code && Number.isFinite(r.rate) && r.rate > 0)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
}

/** Whether the user has priced `code` at all. Base currency is trivially priced. */
export function hasRate(config: PennyWalletConfig, code: string): boolean {
  if (code === baseCurrency(config)) return true
  return ratesFor(config, code).length > 0
}

/**
 * Units of the base currency that one unit of `code` was worth in `yearMonth`:
 * the latest rate effective on or before that month. A month earlier than every
 * recorded rate uses the earliest one rather than failing, and an unpriced
 * currency returns 1 so a half-configured vault degrades to raw numbers instead
 * of NaN.
 */
export function rateFor(config: PennyWalletConfig, code: string, yearMonth: string): number {
  if (code === baseCurrency(config)) return 1
  const points = ratesFor(config, code)
  if (points.length === 0) return 1

  let match: RatePoint | undefined
  for (const point of points) {
    if (point.effectiveFrom <= yearMonth) match = point
    else break
  }
  return (match ?? points[0]).rate
}

/** Convert between any two currencies via the base, at `yearMonth`'s rates. */
export function convert(
  amount: number,
  from: string,
  to: string,
  config: PennyWalletConfig,
  yearMonth: string,
): number {
  if (from === to) return amount
  const inBase = amount * rateFor(config, from, yearMonth)
  if (to === baseCurrency(config)) return inBase
  const toRate = rateFor(config, to, yearMonth)
  return toRate === 0 ? 0 : inBase / toRate
}

/** Convert into the config's base currency - the common case at every rollup. */
export function toBase(
  amount: number,
  from: string,
  config: PennyWalletConfig,
  yearMonth: string,
): number {
  return convert(amount, from, baseCurrency(config), config, yearMonth)
}
