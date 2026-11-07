import { App, requestUrl } from 'obsidian'
import type { PennyWalletConfig, RatePoint } from '../types'
import { baseCurrency, walletCurrency } from '../money'
import { currentYearMonth } from '../utils'
import type { WalletFile } from './WalletFile'
import { RoundGate, attemptWithRetries, countChanges, isFetchDue, mergeAutoPoints } from './dailySync'

export { countChanges }

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

export type RateFetcher = (base: string) => Promise<unknown>

export type SyncOutcome =
  | { ok: true; updated: number }
  | { ok: false; reason: 'network' | 'unsupportedBase' | 'nothingToPrice' }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * The non-base currencies actually in use - the only ones worth pricing: those
 * a wallet is held in, and those a security is quoted in, since a GBP vault
 * holding NVDA needs USD priced even with no USD account.
 */
export function currenciesToPrice(config: PennyWalletConfig): string[] {
  const base = baseCurrency(config)
  const held = (config.wallets ?? []).map(w => walletCurrency(w, config))
  const quoted = (config.prices ?? []).map(p => p.currency)
  return [...new Set([...held, ...quoted])]
    .filter(code => !!code && code !== base)
    .sort((a, b) => a.localeCompare(b))
}

/** Whether a scheduled download is due: opted in, something to price, and a day gone by. */
export function shouldFetchRates(config: PennyWalletConfig, now: Date): boolean {
  if (!config.autoFetchRates) return false
  if (currenciesToPrice(config).length === 0) return false
  return isFetchDue(config.lastRateFetch, now)
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
 * A rate typed by hand wins, even for the current month.
 */
export function mergeAutoRates(
  existing: RatePoint[],
  fetched: Map<string, number>,
  yearMonth: string,
): RatePoint[] {
  return mergeAutoPoints(
    existing,
    fetched,
    yearMonth,
    point => point.code,
    (point, rate) => ({ ...point, rate }),
    (code, rate) => ({ code, effectiveFrom: yearMonth, rate, source: 'auto' as const }),
  )
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

// ─── Orchestration ────────────────────────────────────────────────────────────

export class RateSync {
  private walletFile: WalletFile
  private app: App
  private fetcher: RateFetcher
  private gate = new RoundGate()

  constructor(walletFile: WalletFile, app: App, fetcher: RateFetcher = requestRates) {
    this.walletFile = walletFile
    this.app = app
    this.fetcher = fetcher
  }

  /** The scheduled path: silent unless something is genuinely due. */
  async syncIfDue(now: Date = new Date()): Promise<'skipped' | 'ok' | 'failed'> {
    if (!this.gate.isOpen(now)) return 'skipped'
    if (!shouldFetchRates(this.walletFile.getConfig(), now)) return 'skipped'

    const outcome = await this.run(now)
    if (outcome.ok) return 'ok'

    this.gate.failed(now)
    console.error('PennyWallet: exchange-rate download failed', outcome.reason)
    return 'failed'
  }

  /** The user-initiated path: ignores the daily gate and reports back. */
  async syncNow(): Promise<SyncOutcome> {
    if (this.gate.inFlight) return { ok: false, reason: 'network' }
    return await this.run(new Date())
  }

  private async run(now: Date): Promise<SyncOutcome> {
    const config = this.walletFile.getConfig()
    const base = baseCurrency(config)
    const wanted = currenciesToPrice(config)
    if (wanted.length === 0) return { ok: false, reason: 'nothingToPrice' }

    this.gate.inFlight = true
    try {
      const attempt = await attemptWithRetries(() => this.fetcher(base), 'exchange-rate')
      if (!attempt.reached) return { ok: false, reason: 'network' }
      if (isPermanentError(attempt.body)) return { ok: false, reason: 'unsupportedBase' }

      const fetched = parseRateResponse(attempt.body, base, wanted)
      if (fetched.size === 0) return { ok: false, reason: 'network' }

      const before = this.walletFile.getConfig().rates ?? []
      const after = mergeAutoRates(before, fetched, currentYearMonth())
      this.walletFile.updateConfig({ rates: after, lastRateFetch: now.toISOString() })
      await this.walletFile.saveConfig()
      this.app.workspace.trigger('penny-wallet:refresh')

      this.gate.succeeded()
      return { ok: true, updated: countChanges(before, after) }
    } finally {
      this.gate.inFlight = false
    }
  }
}
