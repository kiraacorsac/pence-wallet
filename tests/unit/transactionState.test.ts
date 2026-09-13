import { describe, it, expect } from 'vitest'
import { parseAmountForEdit, getCategoryOptions, addTagToList, validateTransactionForm, type TransactionFormState } from '../../src/modal/transactionState'
import type { PennyWalletConfig } from '../../src/types'
import { DEFAULT_CONFIG } from '../../src/types'

describe('parseAmountForEdit', () => {
  it('positive integer → display string + isRefund=false', () => {
    expect(parseAmountForEdit(100)).toEqual({ display: '100', isRefund: false })
  })

  it('negative integer → absolute display + isRefund=true', () => {
    expect(parseAmountForEdit(-100)).toEqual({ display: '100', isRefund: true })
  })

  it('zero → display="0", isRefund=false', () => {
    expect(parseAmountForEdit(0)).toEqual({ display: '0', isRefund: false })
  })

  it('positive float → display preserves decimal', () => {
    expect(parseAmountForEdit(12.5)).toEqual({ display: '12.5', isRefund: false })
  })

  it('negative float → absolute display + isRefund=true', () => {
    expect(parseAmountForEdit(-12.5)).toEqual({ display: '12.5', isRefund: true })
  })
})

describe('getCategoryOptions', () => {
  const baseConfig = {
    wallets: [],
    defaultWallet: '',
    decimalPlaces: 0,
    tags: [],
    options: {
      categories: {
        expense: ['Food', 'Transport', 'Gift'],
        income: ['Salary'],
        transfer: ['Credit Card Payment', 'Custom Transfer'],
      },
    },
  } as unknown as PennyWalletConfig

  it('expense type → the configured list, key === label', () => {
    const result = getCategoryOptions(baseConfig, 'expense')
    expect(result.map(r => r.key)).toEqual(['Food', 'Transport', 'Gift'])
    expect(result.every(r => r.key === r.label)).toBe(true)
  })

  it('income type → returns income categories', () => {
    const result = getCategoryOptions(baseConfig, 'income')
    expect(result.map(r => r.key)).toEqual(['Salary'])
  })

  it('transfer type → returns transfer categories', () => {
    const result = getCategoryOptions(baseConfig, 'transfer')
    expect(result.map(r => r.key)).toEqual(['Credit Card Payment', 'Custom Transfer'])
  })

  it('empty list → no options', () => {
    const cfg = { ...baseConfig,
      options: { categories: { expense: [], income: [], transfer: [] } },
    } as unknown as PennyWalletConfig
    expect(getCategoryOptions(cfg, 'expense')).toEqual([])
  })
})

describe('addTagToList', () => {
  it('empty input → kind=empty, list unchanged', () => {
    const result = addTagToList(['a'], '')
    expect(result).toEqual({ kind: 'empty' })
  })

  it('whitespace-only input → kind=empty', () => {
    expect(addTagToList(['a'], '   ')).toEqual({ kind: 'empty' })
  })

  it('# prefix stripped before processing', () => {
    const result = addTagToList(['a'], '#foo')
    expect(result).toEqual({ kind: 'added', next: ['a', 'foo'] })
  })

  it('whitespace trimmed', () => {
    const result = addTagToList([], '  bar  ')
    expect(result).toEqual({ kind: 'added', next: ['bar'] })
  })

  it('invalid tag (contains comma) → kind=invalid', () => {
    const result = addTagToList([], 'foo,bar')
    expect(result.kind).toBe('invalid')
  })

  it('duplicate → kind=duplicate, list unchanged', () => {
    const result = addTagToList(['foo'], 'foo')
    expect(result).toEqual({ kind: 'duplicate' })
  })

  it('at max 3 → kind=max, list unchanged', () => {
    const result = addTagToList(['a', 'b', 'c'], 'd')
    expect(result).toEqual({ kind: 'max' })
  })

  it('valid new tag → kind=added with next list', () => {
    const result = addTagToList(['a'], 'b')
    expect(result).toEqual({ kind: 'added', next: ['a', 'b'] })
  })
})

describe('validateTransactionForm', () => {
  const validExpenseState: TransactionFormState = {
    date: '2026-05-03',
    type: 'expense',
    wallet: 'cash',
    fromWallet: '',
    toWallet: '',
    toAmount: '',
    category: 'food',
    note: '',
    tags: [],
    amount: '100',
    isRefund: false,
  }

  const config0dp: PennyWalletConfig = {
    wallets: [
      { name: 'cash', type: 'cash', status: 'active', initialBalance: 0, includeInNetAsset: true },
      { name: 'visa', type: 'bank', status: 'active', initialBalance: -500, includeInNetAsset: true },
      { name: 'bank', type: 'bank', status: 'active', initialBalance: 0, includeInNetAsset: true },
    ],
    defaultWallet: 'cash',
    decimalPlaces: 0,
    tags: [],
    folderName: 'PennyWallet',
    autoValidateOnLoad: true,
    autoFetchRates: false,
    baseCurrency: 'USD',
    rates: [],
    options: {} as never,
  } as PennyWalletConfig

  const config2dp: PennyWalletConfig = { ...config0dp, decimalPlaces: 2 }

  it('valid expense → ok', () => {
    expect(validateTransactionForm(validExpenseState, config0dp)).toEqual({ ok: true })
  })

  it('invalid date format → invalidDate', () => {
    const s = { ...validExpenseState, date: '2026/5/3' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.invalidDate' })
  })

  it('empty amount → amountRequired', () => {
    const s = { ...validExpenseState, amount: '' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.amountRequired' })
  })

  it('NaN amount → amountRequired', () => {
    const s = { ...validExpenseState, amount: 'abc' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.amountRequired' })
  })

  it('zero amount → amountPositive', () => {
    const s = { ...validExpenseState, amount: '0' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.amountPositive' })
  })

  it('negative amount → amountPositive', () => {
    const s = { ...validExpenseState, amount: '-5' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.amountPositive' })
  })

  it('dp=0 with non-integer → amountInteger', () => {
    const s = { ...validExpenseState, amount: '12.5' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.amountInteger' })
  })

  it('dp=2 with non-integer → ok', () => {
    const s = { ...validExpenseState, amount: '12.5' }
    expect(validateTransactionForm(s, config2dp)).toEqual({ ok: true })
  })

  it('expense missing wallet → walletRequired', () => {
    const s = { ...validExpenseState, wallet: '' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.walletRequired' })
  })

  it('income missing wallet → walletRequired', () => {
    const s = { ...validExpenseState, type: 'income' as const, wallet: '' }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.walletRequired' })
  })

  it('transfer missing fromWallet → fromWalletRequired', () => {
    const s: TransactionFormState = {
      ...validExpenseState,
      type: 'transfer',
      wallet: '',
      fromWallet: '',
      toWallet: 'bank',
    }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.fromWalletRequired' })
  })

  it('transfer missing toWallet → toWalletRequired', () => {
    const s: TransactionFormState = {
      ...validExpenseState,
      type: 'transfer',
      wallet: '',
      fromWallet: 'cash',
      toWallet: '',
    }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.toWalletRequired' })
  })

  it('credit card payment carries no wallet constraints', () => {
    const s: TransactionFormState = {
      ...validExpenseState,
      type: 'transfer',
      wallet: '',
      fromWallet: 'visa',
      toWallet: 'bank',
      category: 'Credit Card Payment',
    }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: true })
  })

  it('transfer same wallet → sameWallet', () => {
    const s: TransactionFormState = {
      ...validExpenseState,
      type: 'transfer',
      wallet: '',
      fromWallet: 'cash',
      toWallet: 'cash',
    }
    expect(validateTransactionForm(s, config0dp)).toEqual({ ok: false, errorKey: 'err.sameWallet' })
  })
})

import { buildTransactionPayload } from '../../src/modal/transactionState'

const payloadConfig: PennyWalletConfig = {
  ...DEFAULT_CONFIG,
  wallets: [
    { name: 'cash', type: 'cash', status: 'active', initialBalance: 0, includeInNetAsset: true },
    { name: 'bank', type: 'bank', status: 'active', initialBalance: 0, includeInNetAsset: true },
  ],
}

describe('buildTransactionPayload', () => {
  const baseState: TransactionFormState = {
    date: '2026-05-03',
    type: 'expense',
    wallet: 'cash',
    fromWallet: '',
    toWallet: '',
    toAmount: '',
    category: 'food',
    note: 'lunch',
    tags: [],
    amount: '100',
    isRefund: false,
  }

  it('expense → wallet set, fromWallet/toWallet undefined', () => {
    const tx = buildTransactionPayload(baseState, payloadConfig)
    expect(tx.wallet).toBe('cash')
    expect(tx.fromWallet).toBeUndefined()
    expect(tx.toWallet).toBeUndefined()
    expect(tx.amount).toBe(100)
    expect(tx.category).toBe('food')
    expect(tx.tags).toBeUndefined()
  })

  it('income → wallet set, fromWallet/toWallet undefined', () => {
    const tx = buildTransactionPayload({ ...baseState, type: 'income' }, payloadConfig)
    expect(tx.wallet).toBe('cash')
    expect(tx.fromWallet).toBeUndefined()
    expect(tx.toWallet).toBeUndefined()
  })

  it('transfer → fromWallet/toWallet set, wallet undefined', () => {
    const tx = buildTransactionPayload({
      ...baseState,
      type: 'transfer',
      wallet: '',
      fromWallet: 'cash',
      toWallet: 'bank',
    }, payloadConfig)
    expect(tx.wallet).toBeUndefined()
    expect(tx.fromWallet).toBe('cash')
    expect(tx.toWallet).toBe('bank')
  })

  it('refund → amount negative', () => {
    const tx = buildTransactionPayload({ ...baseState, isRefund: true }, payloadConfig)
    expect(tx.amount).toBe(-100)
  })

  it('empty category → undefined', () => {
    const tx = buildTransactionPayload({ ...baseState, category: '' }, payloadConfig)
    expect(tx.category).toBeUndefined()
  })

  it('non-empty tags → preserved', () => {
    const tx = buildTransactionPayload({ ...baseState, tags: ['#food'] }, payloadConfig)
    expect(tx.tags).toEqual(['#food'])
  })

  it('date formatted to MM/DD via dateToMonthDay', () => {
    const tx = buildTransactionPayload(baseState, payloadConfig)
    expect(tx.date).toBe('05/03')
  })

  it('decimal amount preserved as float', () => {
    const tx = buildTransactionPayload({ ...baseState, amount: '12.5' }, payloadConfig)
    expect(tx.amount).toBe(12.5)
  })
})
