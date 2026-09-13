import { describe, it, expect } from 'vitest'
import {
  isRefund,
  buildWalletText,
  buildAmountDisplay,
  buildLine3Display,
} from '../../src/view/detailRow'
import type { Transaction } from '../../src/types'

const base: Transaction = {
  date: '05/05',
  type: 'expense',
  wallet: 'Richart',
  category: 'food',
  note: '',
  amount: 330,
}

describe('isRefund', () => {
  it('expense with negative amount → refund', () => {
    expect(isRefund({ ...base, amount: -1380 })).toBe(true)
  })
  it('expense with positive amount → not refund', () => {
    expect(isRefund({ ...base, amount: 330 })).toBe(false)
  })
  it('income with negative amount → not refund', () => {
    expect(isRefund({ ...base, type: 'income', amount: -100 })).toBe(false)
  })
})

describe('buildWalletText', () => {
  it('returns wallet for expense / income', () => {
    expect(buildWalletText({ ...base, wallet: 'Richart' })).toBe('Richart')
  })
  it('returns "from → to" for transfer', () => {
    expect(buildWalletText({
      ...base, type: 'transfer', wallet: undefined,
      fromWallet: '台新', toWallet: 'Richart',
    })).toBe('台新 → Richart')
  })
  it('returns em-dash when nothing available', () => {
    expect(buildWalletText({
      ...base, wallet: undefined, fromWallet: undefined, toWallet: undefined,
    })).toBe('—')
  })
})

describe('buildAmountDisplay', () => {
  it('expense: prefix "-" + is-expense', () => {
    const r = buildAmountDisplay({ ...base, type: 'expense', amount: 330 }, 0)
    expect(r).toEqual({ text: '-330', className: 'pw-tx-amount is-expense' })
  })
  it('income: prefix "+" + is-income', () => {
    const r = buildAmountDisplay({ ...base, type: 'income', amount: 1035 }, 0)
    expect(r).toEqual({ text: '+1,035', className: 'pw-tx-amount is-income' })
  })
  it('refund (expense + negative): prefix "+" + is-refund + abs amount', () => {
    const r = buildAmountDisplay({ ...base, type: 'expense', amount: -1380 }, 0)
    expect(r).toEqual({ text: '+1,380', className: 'pw-tx-amount is-refund' })
  })
  it('transfer: no prefix + plain class', () => {
    const r = buildAmountDisplay({
      ...base, type: 'transfer', wallet: undefined,
      fromWallet: 'A', toWallet: 'B', amount: 50000,
    }, 0)
    expect(r).toEqual({ text: '50,000', className: 'pw-tx-amount' })
  })
  it('respects dp=2', () => {
    const r = buildAmountDisplay({ ...base, amount: 12.5 }, 2)
    expect(r.text).toBe('-12.50')
  })
})

describe('buildLine3Display', () => {
  it('tags present → kind tags', () => {
    const tx = { ...base, tags: ['晚餐', '7-11'], note: '' }
    expect(buildLine3Display(tx)).toEqual({ kind: 'tags', tags: ['晚餐', '7-11'] })
  })
  it('tags + note → tags wins', () => {
    const tx = { ...base, tags: ['晚餐'], note: '備註內容' }
    expect(buildLine3Display(tx)).toEqual({ kind: 'tags', tags: ['晚餐'] })
  })
  it('no tags + note present → kind note (trimmed)', () => {
    const tx = { ...base, tags: [], note: '  餃匠  ' }
    expect(buildLine3Display(tx)).toEqual({ kind: 'note', text: '餃匠' })
  })
  it('whitespace-only note + no tags → kind empty', () => {
    const tx = { ...base, tags: [], note: '   ' }
    expect(buildLine3Display(tx)).toEqual({ kind: 'empty' })
  })
  it('empty note + no tags → kind empty', () => {
    const tx = { ...base, tags: [], note: '' }
    expect(buildLine3Display(tx)).toEqual({ kind: 'empty' })
  })
  it('undefined tags + empty note → kind empty', () => {
    const tx = { ...base, tags: undefined, note: '' }
    expect(buildLine3Display(tx as Transaction)).toEqual({ kind: 'empty' })
  })
})

// ── currency-aware amounts ────────────────────────────────────────────────────

describe('buildAmountDisplay with currencies', () => {
  it('prefixes the account symbol after the sign', () => {
    const tx: Transaction = { date: '04/01', type: 'expense', wallet: 'HSBC', note: '', amount: 1200 }
    expect(buildAmountDisplay(tx, 2, { symbol: '£' }).text).toBe('-£1,200.00')
  })

  it('shows both legs of a cross-currency transfer', () => {
    const tx: Transaction = {
      date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Chase',
      note: '', amount: 200, amountTo: 254,
    }
    const display = buildAmountDisplay(tx, 2, { symbol: '£', toSymbol: '$', toDp: 2 })
    expect(display.text).toBe('£200.00 → $254.00')
  })

  it('honours a different precision on each leg', () => {
    const tx: Transaction = {
      date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Tokyo',
      note: '', amount: 200, amountTo: 38000,
    }
    const display = buildAmountDisplay(tx, 2, { symbol: '£', toSymbol: '¥', toDp: 0 })
    expect(display.text).toBe('£200.00 → ¥38,000')
  })

  it('leaves a same-currency transfer as a single amount', () => {
    const tx: Transaction = {
      date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Cash',
      note: '', amount: 200,
    }
    expect(buildAmountDisplay(tx, 2, { symbol: '£' }).text).toBe('£200.00')
  })

  it('still marks a refund with a plus', () => {
    const tx: Transaction = { date: '04/01', type: 'expense', wallet: 'HSBC', note: '', amount: -50 }
    expect(buildAmountDisplay(tx, 2, { symbol: '£' }).text).toBe('+£50.00')
  })
})
