import type { Transaction } from '../types'
import { formatAmount } from '../utils'

export type Line3Display =
  | { kind: 'tags'; tags: string[] }
  | { kind: 'note'; text: string }
  | { kind: 'empty' }

export function isRefund(tx: Transaction): boolean {
  return tx.type === 'expense' && tx.amount < 0
}

export function buildWalletText(tx: Transaction): string {
  if (tx.wallet) return tx.wallet
  if (tx.fromWallet && tx.toWallet) return `${tx.fromWallet} → ${tx.toWallet}`
  return '—'
}

export interface AmountDisplayOptions {
  /** Symbol for the account the amount leaves from or lands in. */
  symbol?: string
  /** Symbol and precision of the destination leg of a cross-currency transfer. */
  toSymbol?: string
  toDp?: number
}

export function buildAmountDisplay(
  tx: Transaction,
  dp: number = 0,
  options: AmountDisplayOptions = {},
): { text: string; className: string } {
  const { symbol = '', toSymbol = '', toDp = dp } = options
  const refund = isRefund(tx)
  const className = refund
    ? 'pw-tx-amount is-refund'
    : tx.type === 'income'  ? 'pw-tx-amount is-income'
    : tx.type === 'expense' ? 'pw-tx-amount is-expense'
    : 'pw-tx-amount'
  const prefix = refund
    ? '+'
    : tx.type === 'expense' ? '-'
    : tx.type === 'income'  ? '+'
    : ''
  const displayAmount = refund ? -tx.amount : tx.amount
  const text = prefix + symbol + formatAmount(displayAmount, dp)

  // A cross-currency transfer is only honest if both legs are shown.
  if (tx.amountTo != null) {
    return { text: `${text} → ${toSymbol}${formatAmount(tx.amountTo, toDp)}`, className }
  }
  return { text, className }
}

export function buildLine3Display(tx: Transaction): Line3Display {
  if (tx.tags && tx.tags.length > 0) return { kind: 'tags', tags: tx.tags }
  if (tx.note && tx.note.trim() !== '') return { kind: 'note', text: tx.note.trim() }
  return { kind: 'empty' }
}
