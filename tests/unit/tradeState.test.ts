import { describe, it, expect } from 'vitest'
import {
  buildTradePayload,
  impliedSharePrice,
  knownSymbols,
  validateTradeForm,
  type TradeFormState,
} from '../../src/modal/tradeState'
import { sharesHeldOn } from '../../src/io/investments'
import type { Trade } from '../../src/types'

const BUY: Trade = {
  date: '2026-10-02', action: 'buy', symbol: 'NVDA', quantity: 4, amount: 800, fee: 1,
  note: '', createdAt: '2026-10-02T14:00:00.000Z',
}

function form(patch: Partial<TradeFormState> = {}): TradeFormState {
  return {
    action: 'buy', date: '2026-11-03', wallet: 'IBKR', symbol: 'nvda',
    quantity: '2', amount: '380', fee: '', note: ' trim ', ...patch,
  }
}

describe('buildTradePayload', () => {
  it('normalizes the symbol and parses the numbers', () => {
    expect(buildTradePayload(form({ fee: '1.5' }))).toEqual<Trade>({
      date: '2026-11-03', action: 'buy', symbol: 'NVDA', quantity: 2, amount: 380, fee: 1.5, note: 'trim',
    })
  })

  it('leaves blank optional fields out, and never gives an adjust a fee', () => {
    const adjust = buildTradePayload(form({ action: 'adjust', quantity: '-3', amount: '', fee: '5' }))
    expect(adjust.quantity).toBe(-3)
    expect(adjust.amount).toBeUndefined()
    expect(adjust.fee).toBeUndefined()
  })
})

describe('validateTradeForm', () => {
  const ok = (state: TradeFormState, ledger: Trade[] = [BUY], editing: Trade | null = null) =>
    validateTradeForm(state, ledger, editing)
  const key = (state: TradeFormState, ledger: Trade[] = [BUY], editing: Trade | null = null) => {
    const result = ok(state, ledger, editing)
    return result.ok ? null : result.errorKey
  }

  it('accepts a complete buy', () => {
    expect(ok(form())).toEqual({ ok: true })
  })

  it.each<[Partial<TradeFormState>, string]>([
    [{ date: '2026-11' }, 'err.invalidDate'],
    [{ wallet: '' }, 'err.walletRequired'],
    [{ symbol: '  ' }, 'err.symbolRequired'],
    [{ symbol: 'NV DA' }, 'err.symbolInvalid'],
    [{ quantity: '' }, 'err.quantityRequired'],
    [{ quantity: 'abc' }, 'err.quantityRequired'],
    [{ quantity: '0' }, 'err.quantityPositive'],
    [{ quantity: '-1' }, 'err.quantityPositive'],
    [{ amount: '' }, 'err.tradeAmountRequired'],
    [{ amount: '-5' }, 'err.tradeAmountNegative'],
    [{ fee: '-1' }, 'err.feeNegative'],
    [{ action: 'adjust', quantity: '0' }, 'err.quantityNonZero'],
  ])('rejects %o with %s', (patch, expected) => {
    expect(key(form(patch))).toBe(expected)
  })

  it('lets an adjust move shares out, and leave its amount blank', () => {
    expect(ok(form({ action: 'adjust', quantity: '-2', amount: '' }))).toEqual({ ok: true })
  })

  it('refuses to sell more than is held on that date, saying how many are', () => {
    expect(ok(form({ action: 'sell', quantity: '5' }))).toEqual({
      ok: false, errorKey: 'err.oversold', vars: { symbol: 'NVDA', held: '4', date: '2026-11-03' },
    })
    expect(ok(form({ action: 'sell', quantity: '4' }))).toEqual({ ok: true })
  })

  it('refuses a sell dated before the shares were bought', () => {
    expect(key(form({ action: 'sell', quantity: '1', date: '2026-10-01' }))).toBe('err.oversold')
  })

  it('refuses a change that leaves a later sell short', () => {
    const sell: Trade = { ...BUY, date: '2026-11-03', action: 'sell', quantity: 4, createdAt: 'b' }
    // Cutting the buy to 3 shares leaves November's sell of 4 uncovered.
    expect(key(form({ date: '2026-10-02', quantity: '3', amount: '600' }), [BUY, sell], BUY)).toBe('err.oversold')
    expect(key(form({ date: '2026-10-02', quantity: '5', amount: '1000' }), [BUY, sell], BUY)).toBeNull()
  })

  it('does not count the trade being edited against itself', () => {
    const sell: Trade = { ...BUY, date: '2026-11-03', action: 'sell', quantity: 4, createdAt: 'b' }
    expect(key(form({ action: 'sell', quantity: '4' }), [BUY, sell], sell)).toBeNull()
  })

  it('still accepts a trade when the ledger was already short by hand', () => {
    const short: Trade = { ...BUY, date: '2026-10-05', action: 'sell', quantity: 10, createdAt: 'b' }
    expect(key(form({ action: 'buy', date: '2026-10-03', quantity: '6' }), [BUY, short])).toBeNull()
    expect(key(form({ action: 'buy', date: '2026-12-01', quantity: '1' }), [BUY, short])).toBeNull()
  })
})

describe('sharesHeldOn', () => {
  it('counts the trades up to and including that day', () => {
    const later: Trade = { ...BUY, date: '2026-11-10', quantity: 1, createdAt: 'z' }
    expect(sharesHeldOn([later, BUY], 'NVDA', '2026-10-01')).toBe(0)
    expect(sharesHeldOn([later, BUY], 'NVDA', '2026-10-02')).toBe(4)
    expect(sharesHeldOn([later, BUY], 'NVDA', '2026-12-31')).toBe(5)
    expect(sharesHeldOn([later, BUY], 'SPY', '2026-12-31')).toBe(0)
  })
})

describe('impliedSharePrice', () => {
  it('divides the amount by the share count, or is null while incomplete', () => {
    expect(impliedSharePrice('4', '800')).toBe(200)
    expect(impliedSharePrice('-2', '300')).toBe(150)
    expect(impliedSharePrice('', '800')).toBeNull()
    expect(impliedSharePrice('0', '800')).toBeNull()
    expect(impliedSharePrice('4', '')).toBeNull()
  })
})

describe('knownSymbols', () => {
  it('merges traded and priced symbols without repeats', () => {
    expect(knownSymbols([[BUY], [{ ...BUY, symbol: 'SPY' }]], ['QQQ', 'NVDA'])).toEqual(['NVDA', 'QQQ', 'SPY'])
  })
})
