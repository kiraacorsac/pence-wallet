import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RateSync,
  countChanges,
  currenciesToPrice,
  isPermanentError,
  mergeAutoRates,
  parseRateResponse,
  shouldFetchRates,
} from '../../src/io/rateSync'
import { WalletFile } from '../../src/io/WalletFile'
import { DEFAULT_CONFIG } from '../../src/types'
import type { PennyWalletConfig, RatePoint, Wallet } from '../../src/types'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-09-13T12:00:00.000Z')

const WALLETS: Wallet[] = [
  { name: 'current', type: 'bank', initialBalance: 0, status: 'active', includeInNetAsset: true, currency: 'GBP' },
  { name: 'dollars', type: 'bank', initialBalance: 0, status: 'active', includeInNetAsset: true, currency: 'USD' },
  { name: 'koruny', type: 'cash', initialBalance: 0, status: 'active', includeInNetAsset: true, currency: 'CZK' },
]

function makeConfig(patch: Partial<PennyWalletConfig> = {}): PennyWalletConfig {
  return { ...DEFAULT_CONFIG, wallets: WALLETS, baseCurrency: 'GBP', ...patch }
}

/** A response shaped like the one open.er-api.com actually returns. */
function apiResponse(rates: Record<string, number>, base = 'GBP') {
  return { result: 'success', base_code: base, time_last_update_unix: 1789257751, rates }
}

// ─── currenciesToPrice ────────────────────────────────────────────────────────

describe('currenciesToPrice', () => {
  it('lists the non-base currencies actually held, sorted', () => {
    expect(currenciesToPrice(makeConfig())).toEqual(['CZK', 'USD'])
  })

  it('is empty when every account holds the base currency', () => {
    const config = makeConfig({ wallets: [WALLETS[0]] })
    expect(currenciesToPrice(config)).toEqual([])
  })

  it('treats an account with no currency as holding the base', () => {
    const legacy: Wallet = { name: 'old', type: 'cash', initialBalance: 0, status: 'active', includeInNetAsset: true }
    expect(currenciesToPrice(makeConfig({ wallets: [legacy] }))).toEqual([])
  })
})

// ─── shouldFetchRates ─────────────────────────────────────────────────────────

describe('shouldFetchRates', () => {
  it('is off until the user opts in', () => {
    expect(shouldFetchRates(makeConfig(), NOW)).toBe(false)
    expect(DEFAULT_CONFIG.autoFetchRates).toBe(false)
  })

  it('stays off when there is nothing to price', () => {
    const config = makeConfig({ autoFetchRates: true, wallets: [WALLETS[0]] })
    expect(shouldFetchRates(config, NOW)).toBe(false)
  })

  it('fetches when it never has', () => {
    expect(shouldFetchRates(makeConfig({ autoFetchRates: true }), NOW)).toBe(true)
  })

  it('waits out the day, then goes', () => {
    const at = (hoursAgo: number) =>
      makeConfig({ autoFetchRates: true, lastRateFetch: new Date(NOW.getTime() - hoursAgo * HOUR).toISOString() })

    expect(shouldFetchRates(at(1), NOW)).toBe(false)
    expect(shouldFetchRates(at(23), NOW)).toBe(false)
    expect(shouldFetchRates(at(24), NOW)).toBe(true)
    expect(shouldFetchRates(at(25), NOW)).toBe(true)
  })

  it('treats a future timestamp as stale, so a fast clock cannot park other devices', () => {
    const config = makeConfig({
      autoFetchRates: true,
      lastRateFetch: new Date(NOW.getTime() + 72 * HOUR).toISOString(),
    })
    expect(shouldFetchRates(config, NOW)).toBe(true)
  })

  it('treats an unparseable timestamp as stale', () => {
    expect(shouldFetchRates(makeConfig({ autoFetchRates: true, lastRateFetch: 'yesterday' }), NOW)).toBe(true)
    expect(shouldFetchRates(makeConfig({ autoFetchRates: true, lastRateFetch: '' }), NOW)).toBe(true)
  })
})

// ─── parseRateResponse ────────────────────────────────────────────────────────

describe('parseRateResponse', () => {
  it('inverts the quote into base-per-unit', () => {
    // 1 GBP = 1.35 USD, so 1 USD = 0.740741 GBP
    const rates = parseRateResponse(apiResponse({ USD: 1.35 }), 'GBP', ['USD'])
    expect(rates.get('USD')).toBeCloseTo(0.740741, 6)
  })

  it('rounds to six significant figures', () => {
    const rates = parseRateResponse(apiResponse({ CZK: 33.7 }), 'GBP', ['CZK'])
    expect(rates.get('CZK')).toBe(0.0296736)
  })

  it('rejects a response quoting a different base', () => {
    expect(parseRateResponse(apiResponse({ USD: 1.35 }, 'EUR'), 'GBP', ['USD']).size).toBe(0)
  })

  it('accepts a base quoted in a different case', () => {
    expect(parseRateResponse(apiResponse({ USD: 1.35 }, 'gbp'), 'GBP', ['USD']).size).toBe(1)
  })

  it('rejects anything that is not a success', () => {
    expect(parseRateResponse({ result: 'error', 'error-type': 'unsupported-code' }, 'GBP', ['USD']).size).toBe(0)
    expect(parseRateResponse(null, 'GBP', ['USD']).size).toBe(0)
    expect(parseRateResponse('not json', 'GBP', ['USD']).size).toBe(0)
    expect(parseRateResponse(apiResponse({ USD: 1.35 }), 'GBP', ['USD']).size).toBe(1)
  })

  it('drops codes it cannot use and keeps the rest', () => {
    const rates = parseRateResponse(
      apiResponse({ USD: 1.35, CZK: 0, JPY: -3, PLN: Infinity }),
      'GBP',
      ['USD', 'CZK', 'JPY', 'PLN', 'TWD'],
    )
    expect([...rates.keys()]).toEqual(['USD'])
  })
})

// ─── isPermanentError ─────────────────────────────────────────────────────────

describe('isPermanentError', () => {
  it('recognises the errors that will never resolve themselves', () => {
    expect(isPermanentError({ result: 'error', 'error-type': 'unsupported-code' })).toBe(true)
    expect(isPermanentError({ result: 'error', 'error-type': 'malformed-request' })).toBe(true)
  })

  it('leaves everything else retryable', () => {
    expect(isPermanentError({ result: 'error', 'error-type': 'quota-reached' })).toBe(false)
    expect(isPermanentError(apiResponse({ USD: 1.35 }))).toBe(false)
    expect(isPermanentError(null)).toBe(false)
  })
})

// ─── mergeAutoRates ───────────────────────────────────────────────────────────

describe('mergeAutoRates', () => {
  it('appends a point for a currency it has never priced', () => {
    const merged = mergeAutoRates([], new Map([['USD', 0.74]]), '2026-09')
    expect(merged).toEqual([{ code: 'USD', effectiveFrom: '2026-09', rate: 0.74, source: 'auto' }])
  })

  it('updates its own point in place rather than piling up duplicates', () => {
    const existing: RatePoint[] = [{ code: 'USD', effectiveFrom: '2026-09', rate: 0.74, source: 'auto' }]
    const merged = mergeAutoRates(existing, new Map([['USD', 0.76]]), '2026-09')
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({ code: 'USD', effectiveFrom: '2026-09', rate: 0.76, source: 'auto' })
  })

  it('never overwrites a rate entered by hand, even for the current month', () => {
    const existing: RatePoint[] = [{ code: 'CZK', effectiveFrom: '2026-09', rate: 20 }]
    const merged = mergeAutoRates(existing, new Map([['CZK', 0.0297]]), '2026-09')
    expect(merged).toEqual(existing)
    expect(merged[0]).toBe(existing[0])
  })

  it('leaves earlier months untouched, so history is never restated', () => {
    const existing: RatePoint[] = [
      { code: 'USD', effectiveFrom: '2025-10', rate: 0.79 },
      { code: 'USD', effectiveFrom: '2026-04', rate: 0.77, source: 'auto' },
    ]
    const merged = mergeAutoRates(existing, new Map([['USD', 0.74]]), '2026-09')
    expect(merged).toHaveLength(3)
    expect(merged[0]).toBe(existing[0])
    expect(merged[1]).toBe(existing[1])
    expect(merged[2]).toEqual({ code: 'USD', effectiveFrom: '2026-09', rate: 0.74, source: 'auto' })
  })

  it('handles a mixed table: one manual, one auto, in the same month', () => {
    const existing: RatePoint[] = [
      { code: 'CZK', effectiveFrom: '2026-09', rate: 20 },
      { code: 'USD', effectiveFrom: '2026-09', rate: 0.74, source: 'auto' },
    ]
    const merged = mergeAutoRates(existing, new Map([['CZK', 0.0297], ['USD', 0.76]]), '2026-09')
    expect(merged).toHaveLength(2)
    expect(merged[0].rate).toBe(20)
    expect(merged[1].rate).toBe(0.76)
  })
})

describe('countChanges', () => {
  it('counts additions and in-place updates, and ignores untouched points', () => {
    const before: RatePoint[] = [
      { code: 'USD', effectiveFrom: '2025-10', rate: 0.79 },
      { code: 'USD', effectiveFrom: '2026-09', rate: 0.74, source: 'auto' },
    ]
    expect(countChanges(before, before)).toBe(0)
    expect(countChanges(before, mergeAutoRates(before, new Map([['USD', 0.76]]), '2026-09'))).toBe(1)
    expect(countChanges(before, mergeAutoRates(before, new Map([['CZK', 0.03]]), '2026-09'))).toBe(1)
  })
})

// ─── RateSync ─────────────────────────────────────────────────────────────────

function makeSync(config: Partial<PennyWalletConfig>, fetcher: (base: string) => Promise<unknown>) {
  const { app, triggered } = createMockApp()
  const { store, read } = createMockStore()
  const walletFile = new WalletFile(app, store)
  walletFile.updateConfig(makeConfig(config))
  return { sync: new RateSync(walletFile, app, fetcher), walletFile, read, triggered }
}

describe('RateSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does nothing at all while the setting is off', async () => {
    const fetcher = vi.fn()
    const { sync, read } = makeSync({}, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('skipped')
    expect(fetcher).not.toHaveBeenCalled()
    expect(read()).toBeNull()
  })

  it('writes the rates, stamps the fetch, and refreshes the views', async () => {
    const fetcher = vi.fn().mockResolvedValue(apiResponse({ USD: 1.35, CZK: 33.7 }))
    const { sync, walletFile, read, triggered } = makeSync({ autoFetchRates: true }, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('ok')
    expect(fetcher).toHaveBeenCalledWith('GBP')

    const config = walletFile.getConfig()
    expect(config.rates).toEqual([
      { code: 'CZK', effectiveFrom: '2026-09', rate: 0.0296736, source: 'auto' },
      { code: 'USD', effectiveFrom: '2026-09', rate: 0.740741, source: 'auto' },
    ])
    expect(config.lastRateFetch).toBe(NOW.toISOString())
    expect(read()).not.toBeNull()
    expect(triggered).toContain('penny-wallet:refresh')
  })

  it('skips a second run the same day, which is what keeps a synced vault quiet', async () => {
    const fetcher = vi.fn().mockResolvedValue(apiResponse({ USD: 1.35, CZK: 33.7 }))
    const { sync } = makeSync({ autoFetchRates: true }, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('ok')
    expect(await sync.syncIfDue(new Date(NOW.getTime() + 23 * HOUR))).toBe('skipped')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('skips when another device has already fetched today', async () => {
    const fetcher = vi.fn()
    const { sync } = makeSync({
      autoFetchRates: true,
      lastRateFetch: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
    }, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('skipped')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('retries a flaky network, then succeeds', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(apiResponse({ USD: 1.35, CZK: 33.7 }))
    const { sync, walletFile } = makeSync({ autoFetchRates: true }, fetcher)

    const done = sync.syncIfDue(NOW)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(await done).toBe('ok')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(walletFile.getConfig().rates).toHaveLength(2)
  })

  it('gives up after three tries and leaves the stamp alone, so tomorrow retries', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sync, walletFile, read } = makeSync({ autoFetchRates: true }, fetcher)

    const done = sync.syncIfDue(NOW)
    await vi.advanceTimersByTimeAsync(30_000 + 120_000)

    expect(await done).toBe('failed')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(walletFile.getConfig().lastRateFetch).toBeUndefined()
    expect(read()).toBeNull()
  })

  it('backs off between failed rounds instead of retrying on every tick', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sync } = makeSync({ autoFetchRates: true }, fetcher)

    const done = sync.syncIfDue(NOW)
    await vi.advanceTimersByTimeAsync(30_000 + 120_000)
    await done
    expect(fetcher).toHaveBeenCalledTimes(3)

    // The hourly tick 30 minutes later must not start another round.
    expect(await sync.syncIfDue(new Date(NOW.getTime() + HOUR / 2))).toBe('skipped')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('does not retry an error the provider will only repeat', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: 'error', 'error-type': 'unsupported-code' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sync } = makeSync({ autoFetchRates: true, baseCurrency: 'ZZZ' }, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('failed')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reports an unsupported base back to the caller', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: 'error', 'error-type': 'unsupported-code' })
    const { sync } = makeSync({ baseCurrency: 'ZZZ' }, fetcher)

    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'unsupportedBase' })
  })

  it('lets the manual button ignore the daily gate', async () => {
    const fetcher = vi.fn().mockResolvedValue(apiResponse({ USD: 1.35, CZK: 33.7 }))
    const { sync } = makeSync({ lastRateFetch: NOW.toISOString() }, fetcher)

    expect(await sync.syncNow()).toEqual({ ok: true, updated: 2 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves a hand-entered rate through a real sync', async () => {
    const manual: RatePoint = { code: 'CZK', effectiveFrom: '2026-09', rate: 20 }
    const fetcher = vi.fn().mockResolvedValue(apiResponse({ USD: 1.35, CZK: 33.7 }))
    const { sync, walletFile } = makeSync({ rates: [manual] }, fetcher)

    expect(await sync.syncNow()).toEqual({ ok: true, updated: 1 })
    expect(walletFile.getConfig().rates).toEqual([
      manual,
      { code: 'USD', effectiveFrom: '2026-09', rate: 0.740741, source: 'auto' },
    ])
  })

  it('makes one request when two ticks overlap', async () => {
    let release: (value: unknown) => void = () => {}
    const fetcher = vi.fn().mockReturnValue(new Promise(resolve => { release = resolve }))
    const { sync } = makeSync({ autoFetchRates: true }, fetcher)

    const first = sync.syncIfDue(NOW)
    expect(await sync.syncIfDue(NOW)).toBe('skipped')
    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'network' })

    release(apiResponse({ USD: 1.35, CZK: 33.7 }))
    expect(await first).toBe('ok')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not call out when there is nothing to price', async () => {
    const fetcher = vi.fn()
    const { sync } = makeSync({ wallets: [WALLETS[0]] }, fetcher)

    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'nothingToPrice' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
