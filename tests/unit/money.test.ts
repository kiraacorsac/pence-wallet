import { describe, it, expect } from 'vitest'
import {
  CURRENCIES,
  getCurrency,
  baseCurrency,
  walletCurrency,
  currencyDecimals,
  formatMoneyValue,
  formatMoney,
  hasRate,
  rateFor,
  convert,
  toBase,
} from '../../src/money'
import { DEFAULT_CONFIG } from '../../src/types'
import type { PennyWalletConfig, RatePoint, Wallet } from '../../src/types'

function makeConfig(patch: Partial<PennyWalletConfig> = {}): PennyWalletConfig {
  return { ...DEFAULT_CONFIG, baseCurrency: 'GBP', decimalPlaces: 'auto', rates: [], ...patch }
}

const USD_RATES: RatePoint[] = [
  { code: 'USD', effectiveFrom: '2026-01', rate: 0.80 },
  { code: 'USD', effectiveFrom: '2026-06', rate: 0.75 },
]

// ── getCurrency ───────────────────────────────────────────────────────────────

describe('getCurrency', () => {
  it('returns the ISO entry for a known code', () => {
    expect(getCurrency('GBP')).toEqual({ code: 'GBP', symbol: '£', decimals: 2 })
  })

  it('normalizes case and surrounding space', () => {
    expect(getCurrency(' usd ').code).toBe('USD')
  })

  it('synthesises a 2-decimal entry for an unknown code', () => {
    expect(getCurrency('ZZZ')).toEqual({ code: 'ZZZ', symbol: 'ZZZ', decimals: 2 })
  })

  it('knows the zero-decimal currencies', () => {
    expect(getCurrency('JPY').decimals).toBe(0)
    expect(getCurrency('KRW').decimals).toBe(0)
  })

  it('knows the three-decimal currencies', () => {
    expect(getCurrency('KWD').decimals).toBe(3)
  })

  it('has no duplicate codes in the table', () => {
    const codes = CURRENCIES.map(c => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

// ── walletCurrency / baseCurrency ─────────────────────────────────────────────

describe('walletCurrency', () => {
  const wallet = (currency?: string) => ({ currency }) as Wallet

  it('uses the account currency when set', () => {
    expect(walletCurrency(wallet('JPY'), makeConfig())).toBe('JPY')
  })

  it('falls back to the base currency for accounts predating the field', () => {
    expect(walletCurrency(wallet(undefined), makeConfig())).toBe('GBP')
  })

  it('defaults the base currency to USD when unset', () => {
    expect(baseCurrency({ ...makeConfig(), baseCurrency: '' })).toBe('USD')
  })
})

// ── currencyDecimals ──────────────────────────────────────────────────────────

describe('currencyDecimals', () => {
  it('defers to the currency under auto', () => {
    const config = makeConfig({ decimalPlaces: 'auto' })
    expect(currencyDecimals('USD', config)).toBe(2)
    expect(currencyDecimals('JPY', config)).toBe(0)
    expect(currencyDecimals('KWD', config)).toBe(3)
  })

  it('honours a numeric global override for every currency', () => {
    expect(currencyDecimals('JPY', makeConfig({ decimalPlaces: 2 }))).toBe(2)
    expect(currencyDecimals('USD', makeConfig({ decimalPlaces: 0 }))).toBe(0)
  })
})

// ── formatting ────────────────────────────────────────────────────────────────

describe('formatMoneyValue', () => {
  it('groups and pads to the currency decimals', () => {
    expect(formatMoneyValue(1234.5, 'USD', makeConfig())).toBe('1,234.50')
  })

  it('renders a zero-decimal currency without a fraction', () => {
    expect(formatMoneyValue(1234, 'JPY', makeConfig())).toBe('1,234')
  })

  it('prefixes the symbol in formatMoney', () => {
    expect(formatMoney(1234.5, 'GBP', makeConfig())).toBe('£1,234.50')
  })
})

// ── rateFor ───────────────────────────────────────────────────────────────────

describe('rateFor', () => {
  const config = makeConfig({ rates: USD_RATES })

  it('is 1 for the base currency', () => {
    expect(rateFor(config, 'GBP', '2026-03')).toBe(1)
  })

  it('is 1 for a currency with no rate at all', () => {
    expect(rateFor(config, 'JPY', '2026-03')).toBe(1)
  })

  it('picks the rate effective in that month', () => {
    expect(rateFor(config, 'USD', '2026-03')).toBe(0.80)
    expect(rateFor(config, 'USD', '2026-09')).toBe(0.75)
  })

  it('treats effectiveFrom as inclusive', () => {
    expect(rateFor(config, 'USD', '2026-06')).toBe(0.75)
    expect(rateFor(config, 'USD', '2026-05')).toBe(0.80)
  })

  it('falls back to the earliest rate for a month before any of them', () => {
    expect(rateFor(config, 'USD', '2025-01')).toBe(0.80)
  })

  it('ignores zero, negative and non-finite rates', () => {
    const broken = makeConfig({
      rates: [
        { code: 'USD', effectiveFrom: '2026-01', rate: 0.80 },
        { code: 'USD', effectiveFrom: '2026-06', rate: 0 },
        { code: 'USD', effectiveFrom: '2026-07', rate: -1 },
        { code: 'USD', effectiveFrom: '2026-08', rate: NaN },
      ],
    })
    expect(rateFor(broken, 'USD', '2026-09')).toBe(0.80)
  })

  it('does not depend on the stored order of rate points', () => {
    const shuffled = makeConfig({ rates: [...USD_RATES].reverse() })
    expect(rateFor(shuffled, 'USD', '2026-03')).toBe(0.80)
    expect(rateFor(shuffled, 'USD', '2026-09')).toBe(0.75)
  })
})

describe('hasRate', () => {
  const config = makeConfig({ rates: USD_RATES })

  it('is true for the base currency', () => {
    expect(hasRate(config, 'GBP')).toBe(true)
  })

  it('is true for a priced currency', () => {
    expect(hasRate(config, 'USD')).toBe(true)
  })

  it('is false for an unpriced currency', () => {
    expect(hasRate(config, 'JPY')).toBe(false)
  })
})

// ── convert ───────────────────────────────────────────────────────────────────

describe('convert', () => {
  const config = makeConfig({
    rates: [...USD_RATES, { code: 'JPY', effectiveFrom: '2026-01', rate: 0.005 }],
  })

  it('is a no-op between identical currencies', () => {
    expect(convert(100, 'USD', 'USD', config, '2026-03')).toBe(100)
  })

  it('converts into the base currency', () => {
    expect(convert(100, 'USD', 'GBP', config, '2026-03')).toBeCloseTo(80, 10)
  })

  it('converts out of the base currency', () => {
    expect(convert(80, 'GBP', 'USD', config, '2026-03')).toBeCloseTo(100, 10)
  })

  it('converts between two non-base currencies via the base', () => {
    // 10000 JPY = 50 GBP = 62.5 USD at 0.80
    expect(convert(10000, 'JPY', 'USD', config, '2026-03')).toBeCloseTo(62.5, 10)
  })

  it('uses the rate in force for the given month', () => {
    expect(convert(100, 'USD', 'GBP', config, '2026-09')).toBeCloseTo(75, 10)
  })

  it('round-trips a value back to its original currency', () => {
    const there = convert(137.42, 'USD', 'JPY', config, '2026-09')
    expect(convert(there, 'JPY', 'USD', config, '2026-09')).toBeCloseTo(137.42, 8)
  })

  it('leaves amounts untouched when nothing is priced', () => {
    const bare = makeConfig({ rates: [] })
    expect(convert(100, 'USD', 'GBP', bare, '2026-03')).toBe(100)
  })

  it('preserves sign for negative balances', () => {
    expect(convert(-100, 'USD', 'GBP', config, '2026-03')).toBeCloseTo(-80, 10)
  })

  it('toBase is convert into the base currency', () => {
    expect(toBase(100, 'USD', config, '2026-03')).toBeCloseTo(80, 10)
  })
})
