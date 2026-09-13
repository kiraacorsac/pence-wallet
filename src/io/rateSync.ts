import { App, requestUrl } from 'obsidian'
import type { PennyWalletConfig, RatePoint } from '../types'
import { baseCurrency, walletCurrency } from '../money'
import { currentYearMonth } from '../utils'
import type { WalletFile } from './WalletFile'

/**
 * Automatic exchange-rate downloads.
 *
 * The plugin makes no other network request, so everything here is opt-in and
 * deliberately quiet: at most one outbound call a day, carrying nothing but the
 * base currency code. The "already fetched" marker lives in the config, which
 * Obsidian syncs, so a second device that syncs after the first has fetched
 * stays silent rather than asking again.
 */

const ENDPOINT = 'https://open.er-api.com/v6/latest/'

/** One day between successful downloads - the provider updates about that often. */
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Delays before the 2nd and 3rd attempt of a single round. */
const RETRY_DELAYS_MS = [30_000, 120_000]

/** Backoff between failed rounds, so a dead network costs a handful of calls a day. */
const ROUND_BACKOFF_MS = [60 * 60 * 1000, 2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000]

export type RateFetcher = (base: string) => Promise<unknown>

export type SyncOutcome =
  | { ok: true; updated: number }
  | { ok: false; reason: 'network' | 'unsupportedBase' | 'nothingToPrice' }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** The non-base currencies actually held by a wallet - the only ones worth pricing. */
export function currenciesToPrice(config: PennyWalletConfig): string[] {
  const base = baseCurrency(config)
  return [...new Set((config.wallets ?? []).map(w => walletCurrency(w, config)))]
    .filter(code => code !== base)
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Whether a scheduled download is due. An unparseable or future `lastRateFetch`
 * counts as stale rather than fresh: a device whose clock runs ahead must not be
 * able to park every other device indefinitely.
 */
export function shouldFetchRates(config: PennyWalletConfig, now: Date): boolean {
  if (!config.autoFetchRates) return false
  if (currenciesToPrice(config).length === 0) return false

  const last = config.lastRateFetch ? Date.parse(config.lastRateFetch) : NaN
  if (!Number.isFinite(last)) return true
  if (last > now.getTime()) return true
  return now.getTime() - last >= FETCH_INTERVAL_MS
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/** An error the provider will keep returning, so retrying it is pointless. */
export function isPermanentError(body: unknown): boolean {
  const root = asRecord(body)
  if (!root || root['result'] !== 'error') return false
  const type = root['error-type']
  return type === 'unsupported-code' || type === 'malformed-request'
}

/** Six significant figures - enough for any real rate, short enough to read. */
function roundRate(n: number): number {
  return Number(n.toPrecision(6))
}

/**
 * Rates for `wanted`, in the units the config stores: base currency per 1 unit
 * of the code. The API quotes the reciprocal (code per 1 base), so each value is
 * inverted. Codes the response omits, or prices at zero, are simply left out.
 */
export function parseRateResponse(body: unknown, base: string, wanted: string[]): Map<string, number> {
  const result = new Map<string, number>()
  const root = asRecord(body)
  if (!root || root['result'] !== 'success') return result

  const quotedBase = root['base_code']
  if (typeof quotedBase !== 'string' || quotedBase.toUpperCase() !== base.toUpperCase()) return result

  const rates = asRecord(root['rates'])
  if (!rates) return result

  for (const code of wanted) {
    const quoted = rates[code]
    if (typeof quoted !== 'number' || !Number.isFinite(quoted) || quoted <= 0) continue
    result.set(code, roundRate(1 / quoted))
  }
  return result
}

/**
 * Fold downloaded rates into the table as points effective from `yearMonth`.
 *
 * Only that month is ever touched, and only rows the downloader itself wrote: a
 * rate typed by hand wins, even for the current month, and keeps winning until
 * the user deletes it.
 */
export function mergeAutoRates(
  existing: RatePoint[],
  fetched: Map<string, number>,
  yearMonth: string,
): RatePoint[] {
  const manual = new Set(
    existing
      .filter(p => p.effectiveFrom === yearMonth && p.source !== 'auto')
      .map(p => p.code),
  )

  const pending = new Map([...fetched].filter(([code]) => !manual.has(code)))

  const merged = existing.map(point => {
    if (point.effectiveFrom !== yearMonth || point.source !== 'auto') return point
    const rate = pending.get(point.code)
    if (rate === undefined) return point
    pending.delete(point.code)
    return { ...point, rate }
  })

  for (const [code, rate] of pending) {
    merged.push({ code, effectiveFrom: yearMonth, rate, source: 'auto' })
  }

  return merged
}

/** How many points `mergeAutoRates` actually changed - for the "n updated" notice. */
export function countChanges(before: RatePoint[], after: RatePoint[]): number {
  let changed = after.length - before.length
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed++
  }
  return changed
}

// ─── Transport ────────────────────────────────────────────────────────────────

/** The only networked code in the plugin. requestUrl, not fetch, to sidestep CORS. */
export const requestRates: RateFetcher = async (base: string) => {
  const res = await requestUrl({
    url: ENDPOINT + encodeURIComponent(base),
    method: 'GET',
    throw: false,
  })
  const body: unknown = res.json
  if (res.status !== 200 && !isPermanentError(body)) {
    throw new Error(`HTTP ${res.status}`)
  }
  return body
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export class RateSync {
  private walletFile: WalletFile
  private app: App
  private fetcher: RateFetcher

  private inFlight = false
  private failedRounds = 0
  private nextAttemptAt = 0

  constructor(walletFile: WalletFile, app: App, fetcher: RateFetcher = requestRates) {
    this.walletFile = walletFile
    this.app = app
    this.fetcher = fetcher
  }

  /** The scheduled path: silent unless something is genuinely due. */
  async syncIfDue(now: Date = new Date()): Promise<'skipped' | 'ok' | 'failed'> {
    if (this.inFlight) return 'skipped'
    if (now.getTime() < this.nextAttemptAt) return 'skipped'
    if (!shouldFetchRates(this.walletFile.getConfig(), now)) return 'skipped'

    const outcome = await this.run(now)
    if (outcome.ok) return 'ok'

    // A failed round is never recorded as a fetch, so tomorrow still tries; the
    // in-memory gate is what stops an offline vault retrying on every tick.
    const backoff = ROUND_BACKOFF_MS[Math.min(this.failedRounds, ROUND_BACKOFF_MS.length - 1)]
    this.failedRounds++
    this.nextAttemptAt = now.getTime() + backoff
    console.error('PennyWallet: exchange-rate download failed', outcome.reason)
    return 'failed'
  }

  /** The user-initiated path: ignores the daily gate and reports back. */
  async syncNow(): Promise<SyncOutcome> {
    if (this.inFlight) return { ok: false, reason: 'network' }
    return await this.run(new Date())
  }

  private async run(now: Date): Promise<SyncOutcome> {
    const config = this.walletFile.getConfig()
    const base = baseCurrency(config)
    const wanted = currenciesToPrice(config)
    if (wanted.length === 0) return { ok: false, reason: 'nothingToPrice' }

    this.inFlight = true
    try {
      const attempt = await this.attempt(base)
      if (!attempt.reached) return { ok: false, reason: 'network' }
      if (isPermanentError(attempt.body)) return { ok: false, reason: 'unsupportedBase' }

      const fetched = parseRateResponse(attempt.body, base, wanted)
      if (fetched.size === 0) return { ok: false, reason: 'network' }

      const before = this.walletFile.getConfig().rates ?? []
      const after = mergeAutoRates(before, fetched, currentYearMonth())
      this.walletFile.updateConfig({ rates: after, lastRateFetch: now.toISOString() })
      await this.walletFile.saveConfig()
      this.app.workspace.trigger('penny-wallet:refresh')

      this.failedRounds = 0
      this.nextAttemptAt = 0
      return { ok: true, updated: countChanges(before, after) }
    } finally {
      this.inFlight = false
    }
  }

  /** Up to three tries; `reached` is false only when every one of them threw. */
  private async attempt(base: string): Promise<{ reached: true; body: unknown } | { reached: false }> {
    for (let i = 0; ; i++) {
      try {
        return { reached: true, body: await this.fetcher(base) }
      } catch (e) {
        if (i >= RETRY_DELAYS_MS.length) {
          console.error('PennyWallet: exchange-rate request failed', e)
          return { reached: false }
        }
        await sleep(RETRY_DELAYS_MS[i])
      }
    }
  }
}
