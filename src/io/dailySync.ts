/**
 * What the plugin's two opt-in downloads, exchange rates and security prices,
 * have in common: a once-a-day gate whose marker syncs with the config, a few
 * retries inside a round, a backoff between failed rounds, and a merge that
 * only ever touches the current month's downloaded points.
 */

/** One day between successful downloads - the providers update about that often. */
export const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Delays before the 2nd and 3rd attempt of a single round. */
const RETRY_DELAYS_MS = [30_000, 120_000]

/** Backoff between failed rounds, so a dead network costs a handful of calls a day. */
const ROUND_BACKOFF_MS = [60 * 60 * 1000, 2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000]

/**
 * Whether a day has passed since `last`. An unparseable or future timestamp
 * counts as stale rather than fresh: a device whose clock runs ahead must not
 * be able to park every other device indefinitely.
 */
export function isFetchDue(last: string | undefined, now: Date): boolean {
  const at = last ? Date.parse(last) : NaN
  if (!Number.isFinite(at)) return true
  if (at > now.getTime()) return true
  return now.getTime() - at >= FETCH_INTERVAL_MS
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

/** Up to three tries; `reached` is false only when every one of them threw. */
export async function attemptWithRetries<T>(
  request: () => Promise<T>,
  label: string,
): Promise<{ reached: true; body: T } | { reached: false }> {
  for (let i = 0; ; i++) {
    try {
      return { reached: true, body: await request() }
    } catch (e) {
      if (i >= RETRY_DELAYS_MS.length) {
        console.error(`PennyWallet: ${label} request failed`, e)
        return { reached: false }
      }
      await sleep(RETRY_DELAYS_MS[i])
    }
  }
}

/**
 * The in-memory gate between rounds. A failed round is never recorded as a
 * fetch, so tomorrow - or a restart - still tries; this is what stops an
 * offline vault retrying on every hourly tick in between.
 */
export class RoundGate {
  inFlight = false
  private failedRounds = 0
  private nextAttemptAt = 0

  isOpen(now: Date): boolean {
    return !this.inFlight && now.getTime() >= this.nextAttemptAt
  }

  failed(now: Date): void {
    const backoff = ROUND_BACKOFF_MS[Math.min(this.failedRounds, ROUND_BACKOFF_MS.length - 1)]
    this.failedRounds++
    this.nextAttemptAt = now.getTime() + backoff
  }

  succeeded(): void {
    this.failedRounds = 0
    this.nextAttemptAt = 0
  }
}

/**
 * Fold downloaded values into a dated table as points effective from
 * `yearMonth`, keyed by `keyOf`.
 *
 * Only that month is ever touched, and only points the downloader itself
 * wrote: a point typed by hand wins, even for the current month, and keeps
 * winning until the user deletes it.
 */
export function mergeAutoPoints<P extends { effectiveFrom: string; source?: 'auto' }, V>(
  existing: P[],
  fetched: Map<string, V>,
  yearMonth: string,
  keyOf: (point: P) => string,
  withValue: (point: P, value: V) => P,
  create: (key: string, value: V) => P,
): P[] {
  const manual = new Set(
    existing
      .filter(p => p.effectiveFrom === yearMonth && p.source !== 'auto')
      .map(keyOf),
  )

  const pending = new Map([...fetched].filter(([key]) => !manual.has(key)))

  const merged = existing.map(point => {
    if (point.effectiveFrom !== yearMonth || point.source !== 'auto') return point
    const key = keyOf(point)
    if (!pending.has(key)) return point
    const value = pending.get(key) as V
    pending.delete(key)
    return withValue(point, value)
  })

  for (const [key, value] of pending) merged.push(create(key, value))

  return merged
}

/** How many points a merge actually changed - for the "n updated" notice. */
export function countChanges<P>(before: P[], after: P[]): number {
  let changed = after.length - before.length
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) changed++
  }
  return changed
}
