import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CHUNK_SIZE,
  PriceSync,
  chunk,
  mergeAutoPrices,
  normalizeQuote,
  parseQuoteResponse,
  pricesMayBeDue,
  readApiKey,
  requestErrorCode,
  symbolsToPrice,
  type Quote,
} from '../../src/io/priceSync'
import { RateSync } from '../../src/io/rateSync'
import { WalletFile } from '../../src/io/WalletFile'
import { buildInvestmentContent } from '../../src/io/investments'
import { DEFAULT_CONFIG } from '../../src/types'
import type { PennyWalletConfig, Position, PricePoint, Trade, Wallet, WalletBalance } from '../../src/types'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-11-07T12:00:00.000Z')
const KEY = 'test-key'

const IBKR: Wallet = { name: 'IBKR', type: 'investment', initialBalance: 0, status: 'active', includeInNetAsset: true, currency: 'USD' }

function trade(symbol: string, quantity = 1): Trade {
  return { date: '2026-10-02', action: 'buy', symbol, quantity, amount: 100, note: '', createdAt: `2026-10-02T10:00:00.000Z-${symbol}` }
}

/** A batch answer shaped like the one Twelve Data actually returns. */
function batch(quotes: Record<string, { close: string; currency: string } | { code: number }>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const [symbol, q] of Object.entries(quotes)) {
    body[symbol] = 'code' in q
      ? { code: q.code, message: `**symbol** ${symbol} refused`, status: 'error' }
      : { symbol, name: symbol, exchange: 'NASDAQ', currency: q.currency, datetime: '2026-11-06', close: q.close, is_market_open: false }
  }
  return body
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('symbolsToPrice', () => {
  const pos = (quantity: number): Position => ({ quantity, cost: 100 })
  const wb = (wallet: Partial<Wallet>, holdings: [string, number][]): WalletBalance => ({
    wallet: { ...IBKR, ...wallet },
    balance: 0,
    currency: 'USD',
    holdings: new Map(holdings.map(([s, q]) => [s, pos(q)])),
  })

  it('lists every held symbol once, sorted', () => {
    expect(symbolsToPrice([
      wb({}, [['SPY', 2], ['NVDA', 1]]),
      wb({ name: 'Other' }, [['NVDA', 3], ['QQQ', 1]]),
    ])).toEqual(['NVDA', 'QQQ', 'SPY'])
  })

  it('skips archived accounts left out of net assets, but prices those still counted', () => {
    expect(symbolsToPrice([
      wb({ status: 'archived', includeInNetAsset: false }, [['PFE', 5]]),
      wb({ status: 'archived', includeInNetAsset: true }, [['TDOC', 5]]),
    ])).toEqual(['TDOC'])
  })

  it('ignores accounts with no holdings', () => {
    expect(symbolsToPrice([{ wallet: { ...IBKR, type: 'bank' }, balance: 10, currency: 'USD' }])).toEqual([])
  })
})

describe('pricesMayBeDue', () => {
  const config = (patch: Partial<PennyWalletConfig>) => ({ ...DEFAULT_CONFIG, ...patch })

  it('is off until the user opts in', () => {
    expect(DEFAULT_CONFIG.autoFetchPrices).toBe(false)
    expect(pricesMayBeDue(config({}), NOW)).toBe(false)
    expect(pricesMayBeDue(config({ autoFetchPrices: true }), NOW)).toBe(true)
  })

  it('waits out the day, and treats a future stamp as stale', () => {
    const at = (hours: number) => config({ autoFetchPrices: true, lastPriceFetch: new Date(NOW.getTime() + hours * HOUR).toISOString() })
    expect(pricesMayBeDue(at(-23), NOW)).toBe(false)
    expect(pricesMayBeDue(at(-24), NOW)).toBe(true)
    expect(pricesMayBeDue(at(48), NOW)).toBe(true)
  })
})

describe('chunk', () => {
  it('never asks for more symbols than a minute of credits covers', () => {
    const symbols = Array.from({ length: 17 }, (_, i) => `S${i}`)
    expect(chunk(symbols, CHUNK_SIZE).map(c => c.length)).toEqual([8, 8, 1])
    expect(chunk([], CHUNK_SIZE)).toEqual([])
  })
})

describe('normalizeQuote', () => {
  it('turns minor-unit quotes into the major unit', () => {
    expect(normalizeQuote(7512, 'GBp')).toEqual({ price: 75.12, currency: 'GBP' })
    expect(normalizeQuote(7512, 'GBX')).toEqual({ price: 75.12, currency: 'GBP' })
    expect(normalizeQuote(4200, 'ZAc')).toEqual({ price: 42, currency: 'ZAR' })
    expect(normalizeQuote(1500, 'ILA')).toEqual({ price: 15, currency: 'ILS' })
  })

  it('leaves major units alone, upper-casing the code', () => {
    expect(normalizeQuote(186.64, 'USD')).toEqual({ price: 186.64, currency: 'USD' })
    expect(normalizeQuote(10, 'gbp')).toEqual({ price: 10, currency: 'GBP' })
  })
})

describe('parseQuoteResponse', () => {
  it('reads a batch keyed by symbol, dropping the ones refused', () => {
    const body = batch({
      NVDA: { close: '186.64000', currency: 'USD' },
      SPY: { close: '735.28998', currency: 'USD' },
      'VUSA:LSE': { code: 403 },
      NOTREAL: { code: 404 },
    })
    const quotes = parseQuoteResponse(body, ['NOTREAL', 'NVDA', 'SPY', 'VUSA:LSE'])
    expect([...quotes.entries()]).toEqual([
      ['NVDA', { price: 186.64, currency: 'USD' }],
      ['SPY', { price: 735.29, currency: 'USD' }],
    ])
  })

  it('reads the unkeyed answer to a single-symbol request', () => {
    const body = { symbol: 'SPY', currency: 'USD', close: '735.28998', datetime: '2026-11-06' }
    expect(parseQuoteResponse(body, ['SPY']).get('SPY')).toEqual({ price: 735.29, currency: 'USD' })
  })

  it('accepts a numeric close and rejects unusable ones', () => {
    const body = {
      A: { currency: 'USD', close: 12.5 },
      B: { currency: 'USD', close: '0' },
      C: { currency: 'USD', close: 'n/a' },
      D: { close: '10' },
    }
    expect([...parseQuoteResponse(body, ['A', 'B', 'C', 'D']).keys()]).toEqual(['A'])
  })

  it('is empty for an error about the whole request', () => {
    const bad = { code: 401, message: '**apikey** parameter is incorrect', status: 'error' }
    expect(parseQuoteResponse(bad, ['SPY']).size).toBe(0)
    expect(parseQuoteResponse(null, ['SPY']).size).toBe(0)
    expect(parseQuoteResponse('nope', ['SPY']).size).toBe(0)
  })
})

describe('requestErrorCode', () => {
  it('reads the code of a whole-request error, and nothing else', () => {
    expect(requestErrorCode({ code: 401, status: 'error', message: 'x' })).toBe(401)
    expect(requestErrorCode({ code: 429, status: 'error', message: 'x' })).toBe(429)
    expect(requestErrorCode(batch({ NVDA: { code: 404 } }))).toBeNull()
    expect(requestErrorCode({ symbol: 'SPY', close: '1', currency: 'USD' })).toBeNull()
  })
})

describe('mergeAutoPrices', () => {
  const q = (price: number, currency = 'USD'): Quote => ({ price, currency })

  it('appends a point for a symbol never priced', () => {
    expect(mergeAutoPrices([], new Map([['NVDA', q(186.64)]]), '2026-11')).toEqual([
      { symbol: 'NVDA', effectiveFrom: '2026-11', price: 186.64, currency: 'USD', source: 'auto' },
    ])
  })

  it('updates its own point for the month, currency included', () => {
    const existing: PricePoint[] = [{ symbol: 'NVDA', effectiveFrom: '2026-11', price: 180, currency: 'EUR', source: 'auto' }]
    expect(mergeAutoPrices(existing, new Map([['NVDA', q(186.64)]]), '2026-11')).toEqual([
      { symbol: 'NVDA', effectiveFrom: '2026-11', price: 186.64, currency: 'USD', source: 'auto' },
    ])
  })

  it('never overwrites a price entered by hand, nor touches an earlier month', () => {
    const manual: PricePoint = { symbol: 'NVDA', effectiveFrom: '2026-11', price: 150, currency: 'USD' }
    const october: PricePoint = { symbol: 'SPY', effectiveFrom: '2026-10', price: 700, currency: 'USD', source: 'auto' }
    const merged = mergeAutoPrices([manual, october], new Map([['NVDA', q(186.64)], ['SPY', q(735.29)]]), '2026-11')
    expect(merged[0]).toBe(manual)
    expect(merged[1]).toBe(october)
    expect(merged[2]).toEqual({ symbol: 'SPY', effectiveFrom: '2026-11', price: 735.29, currency: 'USD', source: 'auto' })
  })
})

describe('readApiKey', () => {
  const config = { ...DEFAULT_CONFIG, priceApiKeySecret: 'twelve-data-api-key' }

  it('reads the named keychain entry', () => {
    const app = { secretStorage: { getSecret: (id: string) => id === 'twelve-data-api-key' ? 'k' : null } }
    expect(readApiKey(app as never, config)).toBe('k')
  })

  it('reads the proposed entry until another is chosen', () => {
    const app = { secretStorage: { getSecret: (id: string) => id === 'twelve-data-api-key' ? 'k' : null } }
    expect(readApiKey(app as never, DEFAULT_CONFIG)).toBe('k')
    expect(readApiKey(app as never, { ...DEFAULT_CONFIG, priceApiKeySecret: 'elsewhere' })).toBeNull()
  })

  it('is null on an Obsidian without a keychain, or a keychain that throws', () => {
    expect(readApiKey({} as never, config)).toBeNull()
    const broken = { secretStorage: { getSecret: () => { throw new Error('locked') } } }
    expect(readApiKey(broken as never, config)).toBeNull()
  })
})

// ─── PriceSync ────────────────────────────────────────────────────────────────

function makeSync(
  patch: Partial<PennyWalletConfig>,
  fetcher: (symbols: string[], key: string) => Promise<unknown>,
  options: { trades?: Trade[]; key?: string | null; rateFetcher?: (base: string) => Promise<unknown> } = {},
) {
  const trades = options.trades ?? [trade('NVDA', 2), trade('SPY', 1)]
  const { app, triggered } = createMockApp({
    'PennyWallet/Investments/IBKR.md': buildInvestmentContent('IBKR', 'USD', trades),
  })
  const { store, read } = createMockStore()
  const walletFile = new WalletFile(app, store)
  const config: PennyWalletConfig = { ...DEFAULT_CONFIG, baseCurrency: 'GBP', wallets: [IBKR], ...patch }
  walletFile.updateConfig(config)
  const rateSync = new RateSync(walletFile, app, options.rateFetcher ?? vi.fn())
  const key = options.key === undefined ? KEY : options.key
  const sync = new PriceSync(walletFile, app, rateSync, fetcher, () => key)
  return { sync, walletFile, read, triggered }
}

const BOTH = batch({ NVDA: { close: '186.64', currency: 'USD' }, SPY: { close: '735.29', currency: 'USD' } })

describe('PriceSync', () => {
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

  it('stays quiet without a key, and says so when asked directly', async () => {
    const fetcher = vi.fn()
    const { sync } = makeSync({ autoFetchPrices: true }, fetcher, { key: null })
    expect(await sync.syncIfDue(NOW)).toBe('skipped')
    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'noKey' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('sends only the held symbols and the key, then writes, stamps and refreshes', async () => {
    const fetcher = vi.fn().mockResolvedValue(BOTH)
    const { sync, walletFile, triggered } = makeSync({ autoFetchPrices: true }, fetcher)

    expect(await sync.syncIfDue(NOW)).toBe('ok')
    expect(fetcher).toHaveBeenCalledWith(['NVDA', 'SPY'], KEY)

    const config = walletFile.getConfig()
    expect(config.prices).toEqual([
      { symbol: 'NVDA', effectiveFrom: '2026-11', price: 186.64, currency: 'USD', source: 'auto' },
      { symbol: 'SPY', effectiveFrom: '2026-11', price: 735.29, currency: 'USD', source: 'auto' },
    ])
    expect(config.lastPriceFetch).toBe(NOW.toISOString())
    expect(triggered).toContain('penny-wallet:refresh')
  })

  it('skips a second run the same day', async () => {
    const fetcher = vi.fn().mockResolvedValue(BOTH)
    const { sync } = makeSync({ autoFetchPrices: true }, fetcher)
    await sync.syncIfDue(NOW)
    expect(await sync.syncIfDue(new Date(NOW.getTime() + 23 * HOUR))).toBe('skipped')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reports the symbols the plan or provider refused, and still stamps the day', async () => {
    const fetcher = vi.fn().mockResolvedValue(batch({ NVDA: { close: '186.64', currency: 'USD' }, SPY: { code: 403 } }))
    const { sync, walletFile } = makeSync({}, fetcher)
    expect(await sync.syncNow()).toEqual({ ok: true, updated: 1, missing: ['SPY'] })
    expect(walletFile.getConfig().lastPriceFetch).toBe(NOW.toISOString())
  })

  it('stops at a bad key without stamping, so a corrected key fetches at once', async () => {
    const fetcher = vi.fn().mockResolvedValue({ code: 401, message: '**apikey** parameter is incorrect', status: 'error' })
    const { sync, walletFile, read } = makeSync({}, fetcher)
    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'badKey' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(walletFile.getConfig().lastPriceFetch).toBeUndefined()
    expect(read()).toBeNull()
  })

  it('splits more than a minute of credits into requests a minute apart', async () => {
    const symbols = Array.from({ length: 10 }, (_, i) => `T${i}`)
    const fetcher = vi.fn().mockImplementation((asked: string[]) =>
      Promise.resolve(batch(Object.fromEntries(asked.map(s => [s, { close: '10', currency: 'USD' }])))))
    const { sync, walletFile } = makeSync({}, fetcher, { trades: symbols.map(s => trade(s)) })

    const done = sync.syncNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toHaveLength(8)

    await vi.advanceTimersByTimeAsync(61_000)
    expect(await done).toEqual({ ok: true, updated: 10, missing: [] })
    expect(fetcher.mock.calls[1][0]).toEqual(['T8', 'T9'])
    expect(walletFile.getConfig().prices).toHaveLength(10)
  })

  it('gives up after three tries on a dead network, leaves the stamp, and backs off', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sync, walletFile } = makeSync({ autoFetchPrices: true }, fetcher)

    const done = sync.syncIfDue(NOW)
    await vi.advanceTimersByTimeAsync(30_000 + 120_000)
    expect(await done).toBe('failed')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(walletFile.getConfig().lastPriceFetch).toBeUndefined()

    expect(await sync.syncIfDue(new Date(NOW.getTime() + HOUR / 2))).toBe('skipped')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('preserves a hand-entered price through a real sync', async () => {
    const manual: PricePoint = { symbol: 'NVDA', effectiveFrom: '2026-11', price: 150, currency: 'USD' }
    const fetcher = vi.fn().mockResolvedValue(BOTH)
    const { sync, walletFile } = makeSync({ prices: [manual] }, fetcher)
    expect(await sync.syncNow()).toEqual({ ok: true, updated: 1, missing: [] })
    expect(walletFile.getConfig().prices?.[0]).toEqual(manual)
  })

  it('has nothing to do when nothing is held', async () => {
    const fetcher = vi.fn()
    const { sync } = makeSync({ autoFetchPrices: true }, fetcher, { trades: [] })
    expect(await sync.syncIfDue(NOW)).toBe('skipped')
    expect(await sync.syncNow()).toEqual({ ok: false, reason: 'nothingToPrice' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetches a rate straight away for a newly quoted currency, when rate downloads are on', async () => {
    const fetcher = vi.fn().mockResolvedValue(BOTH)
    const rateFetcher = vi.fn().mockResolvedValue({ result: 'success', base_code: 'GBP', rates: { USD: 1.25 } })
    const { sync, walletFile } = makeSync({ autoFetchRates: true }, fetcher, { rateFetcher })

    await sync.syncNow()
    expect(rateFetcher).toHaveBeenCalledWith('GBP')
    expect(walletFile.getConfig().rates).toEqual([{ code: 'USD', effectiveFrom: '2026-11', rate: 0.8, source: 'auto' }])
  })

  it('leaves rates alone when their download is off', async () => {
    const fetcher = vi.fn().mockResolvedValue(BOTH)
    const rateFetcher = vi.fn()
    const { sync } = makeSync({}, fetcher, { rateFetcher })
    await sync.syncNow()
    expect(rateFetcher).not.toHaveBeenCalled()
  })
})
