import type { TransactionType, PennyWalletConfig, Transaction } from '../types'
import { validateTag, dateToMonthDay } from '../utils'

/**
 * Form state shared between TransactionModal and helpers in this module.
 * Mirrors the protected fields on TransactionModal class (date, type, ...).
 */
export interface TransactionFormState {
  date: string         // 'yyyy-mm-dd'
  type: TransactionType
  wallet: string
  fromWallet: string
  toWallet: string
  category: string
  note: string
  tags: string[]
  amount: string       // raw input string (not parsed yet)
  isRefund: boolean
}

/**
 * Parse a stored Transaction.amount (which may be negative for refunds)
 * back into modal form state. Mirrors initState's refund unwrap.
 */
export function parseAmountForEdit(rawAmount: number): { display: string; isRefund: boolean } {
  if (rawAmount < 0) {
    return { display: String(-rawAmount), isRefund: true }
  }
  return { display: String(rawAmount), isRefund: false }
}

/**
 * Build category dropdown options for a given transaction type.
 * Categories are plain user-editable strings, so key and label are the same.
 */
export function getCategoryOptions(
  config: PennyWalletConfig,
  type: TransactionType,
): { key: string; label: string }[] {
  const categories = type === 'expense'
    ? config.options.categories.expense
    : type === 'income'
      ? config.options.categories.income
      : config.options.categories.transfer

  return categories.map(c => ({ key: c, label: c }))
}

export type AddTagResult =
  | { kind: 'added'; next: string[] }
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'duplicate' }
  | { kind: 'max' }

/**
 * Pure tag-list update. Modal callsite handles input.value clearing,
 * dropdown hiding, and chip rendering as side effects based on the kind.
 */
export function addTagToList(current: string[], raw: string): AddTagResult {
  const normalized = raw.replace(/^#/, '').trim()
  if (!normalized) return { kind: 'empty' }
  if (!validateTag(normalized)) return { kind: 'invalid' }
  if (current.includes(normalized)) return { kind: 'duplicate' }
  if (current.length >= 3) return { kind: 'max' }
  return { kind: 'added', next: [...current, normalized] }
}

export type ValidationErrorKey =
  | 'err.invalidDate'
  | 'err.amountRequired'
  | 'err.amountPositive'
  | 'err.amountInteger'
  | 'err.walletRequired'
  | 'err.fromWalletRequired'
  | 'err.toWalletRequired'
  | 'err.sameWallet'

export type ValidationResult =
  | { ok: true }
  | { ok: false; errorKey: ValidationErrorKey }

/**
 * Pure validation. Mirrors the original branching order in
 * TransactionModal.validate so error messages appear in the same priority.
 */
export function validateTransactionForm(
  state: TransactionFormState,
  config: PennyWalletConfig,
): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
    return { ok: false, errorKey: 'err.invalidDate' }
  }
  const dp = config.decimalPlaces ?? 0
  const amount = parseFloat(state.amount)
  if (!state.amount || isNaN(amount)) {
    return { ok: false, errorKey: 'err.amountRequired' }
  }
  if (amount <= 0) {
    return { ok: false, errorKey: 'err.amountPositive' }
  }
  if (dp === 0 && !Number.isInteger(amount)) {
    return { ok: false, errorKey: 'err.amountInteger' }
  }

  if (state.type === 'expense' || state.type === 'income') {
    if (!state.wallet) return { ok: false, errorKey: 'err.walletRequired' }
  } else {
    if (!state.fromWallet) return { ok: false, errorKey: 'err.fromWalletRequired' }
    if (!state.toWallet) return { ok: false, errorKey: 'err.toWalletRequired' }
    if (state.fromWallet === state.toWallet) {
      return { ok: false, errorKey: 'err.sameWallet' }
    }
  }
  return { ok: true }
}

/**
 * Build a Transaction payload from form state. Mirrors the inline
 * object literal that used to live in handleConfirm.
 *
 * Refund handling: isRefund=true → amount stored as negative.
 */
export function buildTransactionPayload(state: TransactionFormState): Transaction {
  return {
    date: dateToMonthDay(state.date),
    type: state.type,
    wallet:     (state.type === 'expense' || state.type === 'income') ? state.wallet : undefined,
    fromWallet: state.type === 'transfer' ? state.fromWallet : undefined,
    toWallet:   state.type === 'transfer' ? state.toWallet : undefined,
    category:   state.category || undefined,
    note: state.note,
    amount: state.isRefund ? -parseFloat(state.amount) : parseFloat(state.amount),
    tags: state.tags.length ? state.tags : undefined,
  }
}
