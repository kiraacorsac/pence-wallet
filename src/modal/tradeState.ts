import type { Trade, TradeAction } from '../types'
import { detectNegativeHoldings, findTradeIndex, isValidSymbol, normalizeSymbol, sharesHeldOn } from '../io/investments'

/** Form state for TradeModal. Numbers stay raw strings until submitted. */
export interface TradeFormState {
  action: TradeAction
  date: string      // 'yyyy-mm-dd'
  wallet: string
  symbol: string
  quantity: string  // signed for adjust
  amount: string    // buy / sell: total; adjust: cost basis added, optional
  fee: string       // buy / sell only, optional
  note: string
}

export type TradeErrorKey =
  | 'err.invalidDate'
  | 'err.walletRequired'
  | 'err.symbolRequired'
  | 'err.symbolInvalid'
  | 'err.quantityRequired'
  | 'err.quantityPositive'
  | 'err.quantityNonZero'
  | 'err.tradeAmountRequired'
  | 'err.tradeAmountNegative'
  | 'err.feeNegative'
  | 'err.oversold'

export type TradeValidation =
  | { ok: true }
  | { ok: false; errorKey: TradeErrorKey; vars?: Record<string, string> }

function parseOptional(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : NaN
}

/** A Trade from the form, without createdAt: the store stamps or keeps that. */
export function buildTradePayload(state: TradeFormState): Trade {
  const trades = state.action !== 'adjust'
  return {
    date: state.date,
    action: state.action,
    symbol: normalizeSymbol(state.symbol),
    quantity: parseFloat(state.quantity),
    amount: parseOptional(state.amount),
    // An adjust moves no cash, so it has no fee to pay.
    fee: trades ? parseOptional(state.fee) : undefined,
    note: state.note.trim(),
  }
}

/** Sorts after any real ISO timestamp, so a new trade lands last on its day. */
const AFTER_EVERY_TIMESTAMP = '9999-12-31T23:59:59.999Z'

/**
 * Pure validation. `ledger` is the account's trades as stored, `editing` the
 * trade being replaced (null for a new one): the check replays the ledger with
 * this trade in place, so a sell that would leave the holding negative - now
 * or after a later trade - is refused here rather than flagged afterwards.
 * A ledger that is already negative for the symbol (edited by hand) is left
 * to validation, so the trade that repairs it can still be entered.
 */
export function validateTradeForm(
  state: TradeFormState,
  ledger: Trade[],
  editing: Trade | null,
): TradeValidation {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date)) return { ok: false, errorKey: 'err.invalidDate' }
  if (!state.wallet) return { ok: false, errorKey: 'err.walletRequired' }

  const symbol = normalizeSymbol(state.symbol)
  if (!symbol) return { ok: false, errorKey: 'err.symbolRequired' }
  if (!isValidSymbol(symbol)) return { ok: false, errorKey: 'err.symbolInvalid' }

  const quantity = parseFloat(state.quantity)
  if (state.quantity.trim() === '' || !Number.isFinite(quantity)) return { ok: false, errorKey: 'err.quantityRequired' }
  if (state.action === 'adjust') {
    if (quantity === 0) return { ok: false, errorKey: 'err.quantityNonZero' }
  } else if (quantity <= 0) {
    return { ok: false, errorKey: 'err.quantityPositive' }
  }

  const amount = parseOptional(state.amount)
  if (state.action !== 'adjust' && amount === undefined) return { ok: false, errorKey: 'err.tradeAmountRequired' }
  if (amount !== undefined && !(amount >= 0)) return { ok: false, errorKey: 'err.tradeAmountNegative' }
  const fee = state.action === 'adjust' ? undefined : parseOptional(state.fee)
  if (fee !== undefined && !(fee >= 0)) return { ok: false, errorKey: 'err.feeNegative' }

  const others = [...ledger]
  if (editing) {
    const idx = findTradeIndex(others, editing)
    if (idx !== -1) others.splice(idx, 1)
  }
  const candidate: Trade = { ...buildTradePayload(state), createdAt: editing?.createdAt ?? AFTER_EVERY_TIMESTAMP }
  const negativeFor = (trades: Trade[]) =>
    detectNegativeHoldings(state.wallet, trades).find(issue => issue.symbol === symbol)
  // Judged against the ledger as stored, edited trade included: taking that
  // trade out on its own can make a later sell look short when it is not.
  const negative = negativeFor(ledger) ? undefined : negativeFor([...others, candidate])
  if (negative) {
    return {
      ok: false,
      errorKey: 'err.oversold',
      vars: { symbol, held: String(Math.max(0, sharesHeldOn(others, symbol, state.date))), date: negative.date },
    }
  }
  return { ok: true }
}

/** Price per share the amount implies, or null while the form is incomplete. */
export function impliedSharePrice(quantity: string, amount: string): number | null {
  const q = parseFloat(quantity)
  const a = parseFloat(amount)
  if (!Number.isFinite(q) || !Number.isFinite(a) || q === 0 || a < 0) return null
  return a / Math.abs(q)
}

/** Symbols worth offering as suggestions: everything ever traded or priced, sorted. */
export function knownSymbols(ledgers: Iterable<Trade[]>, priced: Iterable<string>): string[] {
  const all = new Set<string>(priced)
  for (const trades of ledgers) for (const t of trades) all.add(t.symbol)
  return [...all].sort((a, b) => a.localeCompare(b))
}
