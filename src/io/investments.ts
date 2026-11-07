import type { Position, Trade, TradeAction } from '../types'

/**
 * Investment ledgers.
 *
 * Each investment account keeps its trades in a file of its own, separate from
 * the month files: `<folder>/Investments/<account>.md`. The month files still
 * carry every cash movement in and out of the account; a ledger only records
 * what happens inside it - cash exchanged for shares and back.
 *
 * Everything here is pure. The file I/O lives in WalletFile.
 */

/** Subfolder of the plugin folder holding one ledger per investment account. */
export const INVESTMENTS_FOLDER = 'Investments'

export const TRADE_TABLE_HEADER = `| Date | Action | Symbol | Quantity | Amount | Fee | Note | CreatedAt |
|------|--------|--------|----------|--------|-----|------|-----------|`

const ACTIONS: readonly TradeAction[] = ['buy', 'sell', 'adjust']

/**
 * Below this a share count is float residue, not a holding: selling 0.1 + 0.2
 * shares out of 0.3 must leave nothing behind.
 */
const QUANTITY_EPSILON = 1e-9

// ─── Symbols and file names ──────────────────────────────────────────────────

/**
 * Upper-cased and trimmed. Exchange suffixes and pair separators (`VUSA.L`,
 * `BRK-B`, `BTC/USD`) survive; anything that would break a table cell does not.
 */
export function normalizeSymbol(raw: string): string {
  return (raw || '').trim().toUpperCase()
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9^][A-Z0-9.\-:/=^]{0,23}$/.test(symbol)
}

/**
 * The ledger's file name for an account, without extension. Characters that
 * are illegal in a file name, or that Obsidian treats as link syntax, become
 * dashes, so two names can map to the same file - callers check for that.
 */
export function investmentFileName(accountName: string): string {
  const cleaned = accountName
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .trim()
    .replace(/^\./, '-')
  return cleaned || '-'
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function optionalNumber(cell: string): number | undefined {
  if (!cell || cell === '-') return undefined
  const n = parseFloat(cell)
  return Number.isFinite(n) ? n : undefined
}

/** A table cell can hold neither a pipe nor a line break. */
function cell(text: string): string {
  return text.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim()
}

export function parseTradeRow(line: string): Trade | null {
  const cols = line.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  if (cols.length !== 8) return null
  const [date, action, symbol, quantityStr, amountStr, feeStr, note, createdAt] = cols

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!ACTIONS.includes(action as TradeAction)) return null
  if (!symbol || symbol === '-') return null
  const quantity = parseFloat(quantityStr)
  if (!Number.isFinite(quantity)) return null

  return {
    date,
    action: action as TradeAction,
    symbol: normalizeSymbol(symbol),
    quantity,
    amount: optionalNumber(amountStr),
    fee: optionalNumber(feeStr),
    note: note === '-' ? '' : note,
    createdAt: (createdAt && createdAt !== '-') ? createdAt : undefined,
  }
}

export function formatTradeRow(trade: Trade): string {
  const amount = trade.amount ?? '-'
  const fee = trade.fee ?? '-'
  const note = cell(trade.note) || '-'
  const createdAt = trade.createdAt ?? '-'
  return `| ${trade.date} | ${trade.action} | ${cell(trade.symbol)} | ${trade.quantity} | ${amount} | ${fee} | ${note} | ${createdAt} |`
}

export function tradeOrder(a: Trade, b: Trade): number {
  const d = a.date.localeCompare(b.date)
  return d !== 0 ? d : (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
}

/** Same matching rule as a month file's: every field, and createdAt when both have one. */
export function findTradeIndex(trades: Trade[], target: Trade): number {
  return trades.findIndex(t =>
    t.date === target.date &&
    t.action === target.action &&
    t.symbol === target.symbol &&
    t.quantity === target.quantity &&
    (t.amount ?? null) === (target.amount ?? null) &&
    (t.fee ?? null) === (target.fee ?? null) &&
    t.note === target.note &&
    (t.createdAt === undefined || target.createdAt === undefined || t.createdAt === target.createdAt),
  )
}

// ─── Files ───────────────────────────────────────────────────────────────────

export function parseInvestmentFile(content: string): Trade[] {
  const trades: Trade[] = []
  let inTable = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!inTable && trimmed.startsWith('| Date') && trimmed.includes('Action')) {
      inTable = true
      continue
    }
    if (!inTable) continue
    if (trimmed.startsWith('|---')) continue
    if (trimmed.startsWith('|')) {
      const trade = parseTradeRow(trimmed)
      if (trade) trades.push(trade)
    } else if (trimmed === '') {
      break
    }
  }
  return trades
}

function parseScalar(raw: string): string | null {
  if (!raw.startsWith('"')) return raw || null
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

/**
 * The account a ledger belongs to and the currency it settles in, from its
 * frontmatter. Either is null when the file does not say.
 */
export function parseLedgerMeta(content: string): { account: string | null; currency: string | null } {
  const meta = { account: null as string | null, currency: null as string | null }
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return meta
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (key === 'account' || key === 'currency') meta[key] = parseScalar(line.slice(idx + 1).trim())
  }
  return meta
}

/** Eight decimals: enough for any fractional share, and no float residue in the file. */
function roundQuantity(n: number): number {
  return Number(n.toFixed(8))
}

/**
 * The frontmatter's `holdings.*` keys are written for Dataview and for anyone
 * reading the file. The plugin never reads them back - it replays the rows -
 * so a stale or hand-edited value cannot drift from the truth.
 */
export function buildInvestmentContent(account: string, currency: string, trades: Trade[]): string {
  const sorted = [...trades].sort(tradeOrder)
  const { holdings } = replayTrades(sorted)
  const holdingLines = [...holdings.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, pos]) => `holdings.${symbol}: ${roundQuantity(pos.quantity)}\n`)
    .join('')

  const frontmatter = '---\n'
    + `account: ${JSON.stringify(account)}\n`
    + `currency: ${currency}\n`
    + holdingLines
    + '---\n'
  const heading = `\n## ${cell(account)}\n\n`
  const rows = sorted.map(formatTradeRow).join('\n')
  return frontmatter + heading + TRADE_TABLE_HEADER + (rows ? '\n' + rows : '') + '\n'
}

// ─── Replay ──────────────────────────────────────────────────────────────────

/** Cash a trade moves, in the account's currency: buying spends it, selling returns it. */
export function tradeCashEffect(trade: Trade): number {
  const amount = trade.amount ?? 0
  const fee = trade.fee ?? 0
  switch (trade.action) {
    case 'buy': return -(amount + fee)
    case 'sell': return amount - fee
    case 'adjust': return 0
  }
}

/** Remove `quantity` shares, taking cost out in proportion (average cost). */
function reduce(pos: Position, quantity: number): Position {
  const share = pos.quantity > 0 ? Math.min(quantity / pos.quantity, 1) : 0
  return { quantity: pos.quantity - quantity, cost: pos.cost - pos.cost * share }
}

export function applyTrade(holdings: Map<string, Position>, trade: Trade): void {
  const pos = holdings.get(trade.symbol) ?? { quantity: 0, cost: 0 }
  let next: Position
  switch (trade.action) {
    case 'buy':
      next = { quantity: pos.quantity + trade.quantity, cost: pos.cost + (trade.amount ?? 0) + (trade.fee ?? 0) }
      break
    case 'sell':
      next = reduce(pos, trade.quantity)
      break
    case 'adjust':
      // Shares moving out take their share of the cost with them; shares moving
      // in bring whatever basis was stated, which for a split is none.
      next = trade.quantity < 0
        ? reduce(pos, -trade.quantity)
        : { quantity: pos.quantity + trade.quantity, cost: pos.cost + (trade.amount ?? 0) }
      break
  }

  // A negative count is kept, not clamped: it is a data problem to be shown.
  if (Math.abs(next.quantity) < QUANTITY_EPSILON) holdings.delete(trade.symbol)
  else holdings.set(trade.symbol, next)
}

/**
 * Holdings and net cash after every trade dated in or before `upToYearMonth`
 * (all of them when omitted). `cash` is the trades' effect alone; the account's
 * opening balance and its month-file transactions are added by the caller.
 */
export function replayTrades(
  trades: Trade[],
  upToYearMonth?: string,
): { holdings: Map<string, Position>; cash: number } {
  const holdings = new Map<string, Position>()
  let cash = 0
  const included = upToYearMonth
    ? trades.filter(t => t.date.slice(0, 7) <= upToYearMonth)
    : trades
  for (const trade of [...included].sort(tradeOrder)) {
    applyTrade(holdings, trade)
    cash += tradeCashEffect(trade)
  }
  return { holdings, cash }
}
