import type { TransactionType, PennyWalletConfig, Transaction } from '../types'
import { validateTag, dateToMonthDay } from '../utils'
import { baseCurrency, currencyDecimals, walletCurrency } from '../money'

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
  toAmount: string     // received amount, only used by a cross-currency transfer
  isRefund: boolean
}

/** Currency of a named account, or the base currency when it is unknown. */
export function accountCurrency(name: string, config: PennyWalletConfig): string {
  const wallet = config.wallets.find(w => w.name === name)
  return wallet ? walletCurrency(wallet, config) : baseCurrency(config)
}

/**
 * The two sides of a transfer. `isCross` is what decides whether the received
 * amount is asked for, stored, and used to credit the destination.
 */
export function transferCurrencies(
  state: Pick<TransactionFormState, 'type' | 'fromWallet' | 'toWallet'>,
  config: PennyWalletConfig,
): { from: string; to: string; isCross: boolean } {
  const from = accountCurrency(state.fromWallet, config)
  const to = accountCurrency(state.toWallet, config)
  const isCross = state.type === 'transfer'
    && !!state.fromWallet && !!state.toWallet
    && from !== to
  return { from, to, isCross }
}

/** Rate implied by what was sent and what arrived, or null while incomplete. */
export function impliedRate(sent: string, received: string): number | null {
  const from = parseFloat(sent)
  const to = parseFloat(received)
  if (!isFinite(from) || !isFinite(to) || from <= 0 || to <= 0) return null
  return to / from
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
  | 'err.receivedAmountRequired'
  | 'err.receivedAmountPositive'
  | 'err.receivedAmountInteger'
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
  // The amount leaving is denominated in the source account's currency.
  const sentCode = state.type === 'transfer'
    ? accountCurrency(state.fromWallet, config)
    : accountCurrency(state.wallet, config)
  const dp = currencyDecimals(sentCode, config)
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

    const { to, isCross } = transferCurrencies(state, config)
    if (isCross) {
      const received = parseFloat(state.toAmount)
      if (!state.toAmount || isNaN(received)) {
        return { ok: false, errorKey: 'err.receivedAmountRequired' }
      }
      if (received <= 0) {
        return { ok: false, errorKey: 'err.receivedAmountPositive' }
      }
      if (currencyDecimals(to, config) === 0 && !Number.isInteger(received)) {
        return { ok: false, errorKey: 'err.receivedAmountInteger' }
      }
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
export function buildTransactionPayload(
  state: TransactionFormState,
  config: PennyWalletConfig,
): Transaction {
  const { isCross } = transferCurrencies(state, config)
  return {
    date: dateToMonthDay(state.date),
    type: state.type,
    wallet:     (state.type === 'expense' || state.type === 'income') ? state.wallet : undefined,
    fromWallet: state.type === 'transfer' ? state.fromWallet : undefined,
    toWallet:   state.type === 'transfer' ? state.toWallet : undefined,
    category:   state.category || undefined,
    note: state.note,
    amount: state.isRefund ? -parseFloat(state.amount) : parseFloat(state.amount),
    // Only a cross-currency transfer needs a second amount recorded.
    amountTo: isCross ? parseFloat(state.toAmount) : undefined,
    tags: state.tags.length ? state.tags : undefined,
  }
}
