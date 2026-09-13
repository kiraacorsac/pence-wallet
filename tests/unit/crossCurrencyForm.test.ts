import { describe, it, expect } from 'vitest'
import {
  transferCurrencies,
  impliedRate,
  accountCurrency,
  validateTransactionForm,
  buildTransactionPayload,
  type TransactionFormState,
} from '../../src/modal/transactionState'
import { DEFAULT_CONFIG } from '../../src/types'
import type { PennyWalletConfig } from '../../src/types'

const config: PennyWalletConfig = {
  ...DEFAULT_CONFIG,
  baseCurrency: 'GBP',
  decimalPlaces: 'auto',
  wallets: [
    { name: 'HSBC', type: 'bank', status: 'active', initialBalance: 0, includeInNetAsset: true, currency: 'GBP' },
    { name: 'Chase', type: 'bank', status: 'active', initialBalance: 0, includeInNetAsset: true, currency: 'USD' },
    { name: 'Tokyo', type: 'bank', status: 'active', initialBalance: 0, includeInNetAsset: true, currency: 'JPY' },
    // no currency field: an account created before the feature existed
    { name: 'Cash', type: 'cash', status: 'active', initialBalance: 0, includeInNetAsset: true },
  ],
}

const transfer = (patch: Partial<TransactionFormState> = {}): TransactionFormState => ({
  date: '2026-09-08',
  type: 'transfer',
  wallet: '',
  fromWallet: 'HSBC',
  toWallet: 'Chase',
  category: 'Account Transfer',
  note: '',
  tags: [],
  amount: '200',
  toAmount: '254',
  isRefund: false,
  ...patch,
})

// ── currency resolution ───────────────────────────────────────────────────────

describe('accountCurrency', () => {
  it('reads the account currency', () => {
    expect(accountCurrency('Chase', config)).toBe('USD')
  })

  it('falls back to the base currency for an account without one', () => {
    expect(accountCurrency('Cash', config)).toBe('GBP')
  })

  it('falls back to the base currency for an unknown account', () => {
    expect(accountCurrency('Nope', config)).toBe('GBP')
  })
})

describe('transferCurrencies', () => {
  it('flags a transfer between different currencies', () => {
    expect(transferCurrencies(transfer(), config)).toEqual({ from: 'GBP', to: 'USD', isCross: true })
  })

  it('does not flag a transfer within one currency', () => {
    const state = transfer({ toWallet: 'Cash' })
    expect(transferCurrencies(state, config).isCross).toBe(false)
  })

  it('does not flag an expense', () => {
    const state = transfer({ type: 'expense', wallet: 'Chase', fromWallet: '', toWallet: '' })
    expect(transferCurrencies(state, config).isCross).toBe(false)
  })

  it('does not flag a half-filled transfer', () => {
    expect(transferCurrencies(transfer({ toWallet: '' }), config).isCross).toBe(false)
  })
})

// ── implied rate ──────────────────────────────────────────────────────────────

describe('impliedRate', () => {
  it('divides received by sent', () => {
    expect(impliedRate('200', '254')).toBeCloseTo(1.27, 10)
  })

  it('is null while either side is missing', () => {
    expect(impliedRate('200', '')).toBeNull()
    expect(impliedRate('', '254')).toBeNull()
  })

  it('is null for zero or negative input', () => {
    expect(impliedRate('0', '254')).toBeNull()
    expect(impliedRate('200', '-5')).toBeNull()
  })

  it('is null for junk input', () => {
    expect(impliedRate('abc', '254')).toBeNull()
  })
})

// ── validation ────────────────────────────────────────────────────────────────

describe('validateTransactionForm across currencies', () => {
  it('accepts a complete cross-currency transfer', () => {
    expect(validateTransactionForm(transfer(), config)).toEqual({ ok: true })
  })

  it('requires the received amount', () => {
    expect(validateTransactionForm(transfer({ toAmount: '' }), config))
      .toEqual({ ok: false, errorKey: 'err.receivedAmountRequired' })
  })

  it('rejects a zero received amount', () => {
    expect(validateTransactionForm(transfer({ toAmount: '0' }), config))
      .toEqual({ ok: false, errorKey: 'err.receivedAmountPositive' })
  })

  it('rejects decimals for a zero-decimal destination currency', () => {
    const state = transfer({ toWallet: 'Tokyo', toAmount: '38000.5' })
    expect(validateTransactionForm(state, config))
      .toEqual({ ok: false, errorKey: 'err.receivedAmountInteger' })
  })

  it('allows decimals for a two-decimal destination currency', () => {
    expect(validateTransactionForm(transfer({ toAmount: '254.37' }), config)).toEqual({ ok: true })
  })

  it('ignores the received amount for a same-currency transfer', () => {
    const state = transfer({ toWallet: 'Cash', toAmount: '' })
    expect(validateTransactionForm(state, config)).toEqual({ ok: true })
  })

  it('judges the sent amount by the source account currency', () => {
    // JPY takes no decimals, so a fractional amount leaving Tokyo is invalid
    const state = transfer({ fromWallet: 'Tokyo', toWallet: 'HSBC', amount: '100.5', toAmount: '0.55' })
    expect(validateTransactionForm(state, config))
      .toEqual({ ok: false, errorKey: 'err.amountInteger' })
  })

  it('still rejects a transfer to the same account', () => {
    const state = transfer({ toWallet: 'HSBC' })
    expect(validateTransactionForm(state, config))
      .toEqual({ ok: false, errorKey: 'err.sameWallet' })
  })
})

// ── payload ───────────────────────────────────────────────────────────────────

describe('buildTransactionPayload across currencies', () => {
  it('records the received amount for a cross-currency transfer', () => {
    const tx = buildTransactionPayload(transfer(), config)
    expect(tx.amount).toBe(200)
    expect(tx.amountTo).toBe(254)
  })

  it('leaves amountTo unset for a same-currency transfer', () => {
    const tx = buildTransactionPayload(transfer({ toWallet: 'Cash', toAmount: '999' }), config)
    expect(tx.amount).toBe(200)
    expect(tx.amountTo).toBeUndefined()
  })

  it('leaves amountTo unset for an expense', () => {
    const state = transfer({ type: 'expense', wallet: 'Chase', fromWallet: '', toWallet: '', toAmount: '999' })
    expect(buildTransactionPayload(state, config).amountTo).toBeUndefined()
  })
})
