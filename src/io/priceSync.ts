import { App, requestUrl } from 'obsidian'
import type { PennyWalletConfig, PricePoint, WalletBalance } from '../types'
import { CURRENCIES, hasRate } from '../money'
import { currentYearMonth } from '../utils'
import type { WalletFile } from './WalletFile'
import type { RateSync } from './rateSync'
import { RoundGate, attemptWithRetries, countChanges, isFetchDue, mergeAutoPoints, sleep } from './dailySync'

/**
 * Automatic price downloads, from Twelve Data with the user's own free key.
 *
 * Opt-in and separate from exchange rates, because it sends more: the ticker
 * symbols held, and the key. Nothing else - no quantities, no accounts, no
 * amounts. The key is read from Obsidian's keychain, never from the synced
 * config, and goes in a header rather than the URL.
 */

const ENDPOINT = 'https://api.twelvedata.com/quote'

/**
 * The free plan allows 8 credits a minute, at one credit per symbol, so no
 * request asks for more than 8 and consecutive ones wait out the minute.
 */
export const CHUNK_SIZE = 8
const CHUNK_GAP_MS = 61_000

/** Keychain entry the settings field proposes; the user may pick any other. */
export const DEFAULT_KEY_SECRET = 'twelve-data-api-key'

export type QuoteFetcher = (symbols: string[], apiKey: string) => Promise<unknown>

export interface Quote {
  price: number
  currency: string
}

export type PriceSyncOutcome =
  | { ok: true; updated: number; missing: string[] }
  | { ok: false; reason: 'network' | 'badKey' | 'noKey' | 'nothingToPrice' }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Securities worth pricing: every non-zero holding in an account that counts. */
export function symbolsToPrice(balances: WalletBalance[]): string[] {
  const symbols = new Set<string>()
  for (const { wallet, holdings } of balances) {
    if (wallet.status !== 'active' && !wallet.includeInNetAsset) continue
    for (const [symbol, pos] of holdings ?? []) {
      if (pos.quantity !== 0) symbols.add(symbol)
    }
  }
  return [...symbols].sort((a, b) => a.localeCompare(b))
}

/** The cheap half of the due check: everything short of reading the ledgers. */
export function pricesMayBeDue(config: PennyWalletConfig, now: Date): boolean {
  return config.autoFetchPrices === true && isFetchDue(config.lastPriceFetch, now)
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Some exchanges quote in a minor unit: London in pence (GBp), Johannesburg in
 * cents (ZAc), Tel Aviv in agorot (ILA). Prices are stored in the major unit
 * so the exchange-rate table can convert them like any other.
 */
export function normalizeQuote(price: number, currency: string): Quote {
  switch (currency) {
    case 'GBp': case 'GBX': return { price: price / 100, currency: 'GBP' }
    case 'ZAc': case 'ZAC': return { price: price / 100, currency: 'ZAR' }
    case 'ILA': return { price: price / 100, currency: 'ILS' }
    default: return { price, currency: currency.toUpperCase() }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** The `code` of an error answer for the whole request, or null if it is not one. */
export function requestErrorCode(body: unknown): number | null {
  const root = asRecord(body)
  if (!root || root['status'] !== 'error') return null
  return typeof root['code'] === 'number' ? root['code'] : 0
}

/** Seven significant figures: a share price needs more than a rate's six. */
function roundPrice(n: number): number {
  return Number(n.toPrecision(7))
}

/**
 * Stocks and ETFs state their currency; a crypto pair does not, so it is read
 * off the pair itself: BTC/EUR is quoted in EUR.
 */
function quoteCurrency(quote: Record<string, unknown>, symbol: string): string | null {
  const stated = quote['currency']
  if (typeof stated === 'string' && stated) return stated
  const [, quoted] = symbol.split('/')
  return quoted && CURRENCIES.some(c => c.code === quoted) ? quoted : null
}

function parseOne(entry: unknown, symbol: string): Quote | null {
  const quote = asRecord(entry)
  if (!quote || quote['status'] === 'error') return null
  const close = typeof quote['close'] === 'number' ? quote['close'] : parseFloat(String(quote['close']))
  const currency = quoteCurrency(quote, symbol)
  if (!Number.isFinite(close) || close <= 0 || !currency) return null
  const normalized = normalizeQuote(close, currency)
  return { price: roundPrice(normalized.price), currency: normalized.currency }
}

/**
 * Quotes for `wanted`. A request for one symbol is answered with the quote
 * itself; a request for several, with an object keyed by each symbol exactly
 * as asked. A symbol the plan does not cover, or the provider does not know,
 * comes back as an error entry of its own and is simply left out.
 */
export function parseQuoteResponse(body: unknown, wanted: string[]): Map<string, Quote> {
  const result = new Map<string, Quote>()
  const root = asRecord(body)
  if (!root || root['status'] === 'error') return result

  const single = wanted.length === 1 && 'close' in root
  for (const symbol of wanted) {
    const quote = parseOne(single ? root : root[symbol], symbol)
    if (quote) result.set(symbol, quote)
  }
  return result
}

/**
 * Fold downloaded prices in as points effective from `yearMonth`. As with
 * rates, a price typed by hand wins, even for the current month.
 */
export function mergeAutoPrices(
  existing: PricePoint[],
  fetched: Map<string, Quote>,
  yearMonth: string,
): PricePoint[] {
  return mergeAutoPoints(
    existing,
    fetched,
    yearMonth,
    point => point.symbol,
    (point, quote) => ({ ...point, price: quote.price, currency: quote.currency }),
    (symbol, quote) => ({ symbol, effectiveFrom: yearMonth, price: quote.price, currency: quote.currency, source: 'auto' as const }),
  )
}

// ─── Transport ────────────────────────────────────────────────────────────────

/** An answer that retrying will not change: a bad key, or a request it refuses outright. */
function isDefinitive(code: number | null): boolean {
  return code !== null && code !== 0 && code !== 429 && code < 500
}

/** requestUrl, not fetch, to sidestep CORS. The key travels in a header, not the URL. */
export const requestQuotes: QuoteFetcher = async (symbols: string[], apiKey: string) => {
  const res = await requestUrl({
    url: `${ENDPOINT}?symbol=${encodeURIComponent(symbols.join(','))}`,
    method: 'GET',
    headers: { Authorization: `apikey ${apiKey}` },
    throw: false,
  })
  let body: unknown
  try {
    body = res.json
  } catch {
    throw new Error(`HTTP ${res.status}: not JSON`)
  }
  // Rate limits and server errors are worth another try; a refusal is not.
  const code = requestErrorCode(body)
  if ((res.status !== 200 || code !== null) && !isDefinitive(code ?? res.status)) {
    throw new Error(`HTTP ${res.status}${code ? ` (${code})` : ''}`)
  }
  return body
}

/**
 * The user's key, if this Obsidian has a keychain and the entry is filled in.
 * With no entry chosen yet, the one the settings field proposes is read.
 */
export function readApiKey(app: App, config: PennyWalletConfig): string | null {
  const storage = (app as Partial<Pick<App, 'secretStorage'>>).secretStorage
  const id = config.priceApiKeySecret || DEFAULT_KEY_SECRET
  if (!storage) return null
  try {
    return storage.getSecret(id) || null
  } catch {
    return null
  }
}

/** Keychains arrived in Obsidian 1.11.4; without one, prices are entered by hand. */
export function hasKeychain(app: App): boolean {
  return !!(app as Partial<Pick<App, 'secretStorage'>>).secretStorage
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export class PriceSync {
  private walletFile: WalletFile
  private app: App
  private rateSync: RateSync | null
  private fetcher: QuoteFetcher
  private readKey: (app: App, config: PennyWalletConfig) => string | null
  private gate = new RoundGate()

  constructor(
    walletFile: WalletFile,
    app: App,
    rateSync: RateSync | null,
    fetcher: QuoteFetcher = requestQuotes,
    readKey: (app: App, config: PennyWalletConfig) => string | null = readApiKey,
  ) {
    this.walletFile = walletFile
    this.app = app
    this.rateSync = rateSync
    this.fetcher = fetcher
    this.readKey = readKey
  }

  /** The scheduled path: silent unless something is genuinely due. */
  async syncIfDue(now: Date = new Date()): Promise<'skipped' | 'ok' | 'failed'> {
    if (!this.gate.isOpen(now)) return 'skipped'
    const config = this.walletFile.getConfig()
    if (!pricesMayBeDue(config, now) || !this.readKey(this.app, config)) return 'skipped'

    const outcome = await this.run(now)
    if (outcome.ok) return 'ok'
    if (outcome.reason === 'nothingToPrice') return 'skipped'

    this.gate.failed(now)
    console.error('PennyWallet: price download failed', outcome.reason)
    return 'failed'
  }

  /** The user-initiated path: ignores the daily gate and reports back. */
  async syncNow(): Promise<PriceSyncOutcome> {
    if (this.gate.inFlight) return { ok: false, reason: 'network' }
    return await this.run(new Date())
  }

  private async run(now: Date): Promise<PriceSyncOutcome> {
    const apiKey = this.readKey(this.app, this.walletFile.getConfig())
    if (!apiKey) return { ok: false, reason: 'noKey' }

    this.gate.inFlight = true
    try {
      const symbols = symbolsToPrice(await this.walletFile.calculateAllWalletBalances())
      if (symbols.length === 0) return { ok: false, reason: 'nothingToPrice' }

      const fetched = new Map<string, Quote>()
      let everyChunkAnswered = true
      const chunks = chunk(symbols, CHUNK_SIZE)
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await sleep(CHUNK_GAP_MS)
        const attempt = await attemptWithRetries(() => this.fetcher(chunks[i], apiKey), 'price')
        if (!attempt.reached) {
          everyChunkAnswered = false
          break
        }
        if (requestErrorCode(attempt.body) === 401) return { ok: false, reason: 'badKey' }
        for (const [symbol, quote] of parseQuoteResponse(attempt.body, chunks[i])) fetched.set(symbol, quote)
      }
      if (!everyChunkAnswered && fetched.size === 0) return { ok: false, reason: 'network' }

      const before = this.walletFile.getConfig().prices ?? []
      const after = mergeAutoPrices(before, fetched, currentYearMonth())
      // Stamped only once every symbol has had its answer, even a "not on your
      // plan" one, so a round cut short by the network is tried again.
      this.walletFile.updateConfig(everyChunkAnswered
        ? { prices: after, lastPriceFetch: now.toISOString() }
        : { prices: after })
      await this.walletFile.saveConfig()

      // A security quoted in a currency nothing else uses has no rate yet;
      // fetch one now rather than count it 1:1 until tomorrow.
      const config = this.walletFile.getConfig()
      if (this.rateSync && config.autoFetchRates
        && [...fetched.values()].some(q => !hasRate(config, q.currency))) {
        await this.rateSync.syncNow()
      }

      this.app.workspace.trigger('penny-wallet:refresh')
      this.gate.succeeded()
      return { ok: true, updated: countChanges(before, after), missing: symbols.filter(s => !fetched.has(s)) }
    } finally {
      this.gate.inFlight = false
    }
  }
}
