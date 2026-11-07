import { describe, it, expect } from 'vitest'
import {
  applyTrade,
  buildInvestmentContent,
  findTradeIndex,
  formatTradeRow,
  investmentFileName,
  isValidSymbol,
  normalizeSymbol,
  parseInvestmentAccount,
  parseInvestmentFile,
  parseTradeRow,
  replayTrades,
  tradeCashEffect,
} from '../../src/io/investments'
import type { Position, Trade } from '../../src/types'

const BUY: Trade = {
  date: '2026-10-02',
  action: 'buy',
  symbol: 'NVDA',
  quantity: 10,
  amount: 1812.4,
  fee: 1,
  note: '',
  createdAt: '2026-10-02T14:31:00.000Z',
}

// ── Rows ──────────────────────────────────────────────────────────────────────

describe('parseTradeRow / formatTradeRow', () => {
  it('round-trips a full row', () => {
    const line = formatTradeRow(BUY)
    expect(line).toBe('| 2026-10-02 | buy | NVDA | 10 | 1812.4 | 1 | - | 2026-10-02T14:31:00.000Z |')
    expect(parseTradeRow(line)).toEqual(BUY)
  })

  it('reads dashes as absent', () => {
    const tx = parseTradeRow('| 2026-10-15 | adjust | NVDA | 90 | - | - | 10-for-1 split | - |')
    expect(tx).toEqual<Trade>({
      date: '2026-10-15', action: 'adjust', symbol: 'NVDA', quantity: 90,
      amount: undefined, fee: undefined, note: '10-for-1 split', createdAt: undefined,
    })
  })

  it('keeps a negative adjust quantity and fractional shares', () => {
    expect(parseTradeRow('| 2026-10-15 | adjust | SPY | -0.125 | - | - | - | - |')?.quantity).toBe(-0.125)
  })

  it('upper-cases the symbol read from a hand-edited file', () => {
    expect(parseTradeRow('| 2026-10-15 | buy | spy | 1 | 600 | - | - | - |')?.symbol).toBe('SPY')
  })

  it.each([
    ['wrong column count', '| 2026-10-02 | buy | NVDA | 10 | 1812.4 | 1 | - |'],
    ['month-file style date', '| 10/02 | buy | NVDA | 10 | 1812.4 | 1 | - | - |'],
    ['unknown action', '| 2026-10-02 | dividend | NVDA | 10 | 1812.4 | 1 | - | - |'],
    ['missing symbol', '| 2026-10-02 | buy | - | 10 | 1812.4 | 1 | - | - |'],
    ['non-numeric quantity', '| 2026-10-02 | buy | NVDA | ten | 1812.4 | 1 | - | - |'],
  ])('rejects a row with %s', (_, line) => {
    expect(parseTradeRow(line)).toBeNull()
  })

  it('cannot be broken by a pipe or newline in the note', () => {
    const line = formatTradeRow({ ...BUY, note: 'a | b\nc' })
    expect(parseTradeRow(line)?.note).toBe('a / b c')
  })
})

describe('findTradeIndex', () => {
  it('matches on every field, ignoring createdAt when one side lacks it', () => {
    const trades = [BUY, { ...BUY, quantity: 5 }]
    expect(findTradeIndex(trades, { ...BUY, quantity: 5, createdAt: undefined })).toBe(1)
    expect(findTradeIndex(trades, { ...BUY, createdAt: 'other' })).toBe(-1)
  })
})

// ── Symbols and file names ────────────────────────────────────────────────────

describe('symbols', () => {
  it('normalizes and validates', () => {
    expect(normalizeSymbol('  brk-b ')).toBe('BRK-B')
    for (const ok of ['NVDA', 'BRK-B', 'VUSA.L', 'BTC/USD', '^GSPC', '7203']) expect(isValidSymbol(ok)).toBe(true)
    for (const bad of ['', 'NV DA', 'A|B', 'A,B', '.NVDA']) expect(isValidSymbol(bad)).toBe(false)
  })
})

describe('investmentFileName', () => {
  it('keeps ordinary names as they are', () => {
    expect(investmentFileName('IBKR')).toBe('IBKR')
    expect(investmentFileName('Fidelity 401k')).toBe('Fidelity 401k')
  })

  it('replaces characters a file name or link cannot hold', () => {
    expect(investmentFileName('IBKR: US/EU #1')).toBe('IBKR- US-EU -1')
    expect(investmentFileName('.hidden')).toBe('-hidden')
    expect(investmentFileName('???')).toBe('---')
  })
})

// ── Files ─────────────────────────────────────────────────────────────────────

describe('buildInvestmentContent / parseInvestmentFile', () => {
  const sell: Trade = { ...BUY, date: '2026-11-03', action: 'sell', quantity: 2, amount: 401.1, note: 'trim', createdAt: '2026-11-03T15:02:00.000Z' }
  const spy: Trade = { date: '2026-10-15', action: 'adjust', symbol: 'SPY', quantity: 3.5, amount: 2100, note: 'from Vanguard', createdAt: '2026-10-15T09:00:00.000Z' }

  it('writes sorted rows and current holdings, and reads the rows back', () => {
    const content = buildInvestmentContent('IBKR', 'USD', [sell, BUY, spy])
    expect(content).toContain('account: "IBKR"\ncurrency: USD\nholdings.NVDA: 8\nholdings.SPY: 3.5\n---')
    expect(content).toContain('\n## IBKR\n')
    expect(parseInvestmentFile(content)).toEqual([BUY, spy, sell])
  })

  it('writes an empty ledger with just the header', () => {
    const content = buildInvestmentContent('IBKR', 'USD', [])
    expect(parseInvestmentFile(content)).toEqual([])
    expect(content).not.toContain('holdings.')
  })

  it('leaves sold-out positions out of the frontmatter', () => {
    const all = { ...sell, quantity: 10 }
    expect(buildInvestmentContent('IBKR', 'USD', [BUY, all])).not.toContain('holdings.NVDA')
  })

  it('never writes float residue', () => {
    const trades: Trade[] = [
      { ...BUY, quantity: 0.1, createdAt: 'a' },
      { ...BUY, quantity: 0.2, createdAt: 'b' },
    ]
    expect(buildInvestmentContent('IBKR', 'USD', trades)).toContain('holdings.NVDA: 0.3\n')
  })

  it('stops reading at the first blank line after the table', () => {
    const content = buildInvestmentContent('IBKR', 'USD', [BUY]) + '\nNotes below\n| 2026-12-01 | buy | X | 1 | 1 | - | - | - |\n'
    expect(parseInvestmentFile(content)).toHaveLength(1)
  })

  it('records the account, quoting names YAML would misread', () => {
    const content = buildInvestmentContent('IBKR: main #1', 'USD', [])
    expect(content).toContain('account: "IBKR: main #1"\n')
    expect(parseInvestmentAccount(content)).toBe('IBKR: main #1')
    expect(parseInvestmentAccount('---\naccount: Plain\n---\n')).toBe('Plain')
    expect(parseInvestmentAccount('no frontmatter')).toBeNull()
  })
})

// ── Replay ────────────────────────────────────────────────────────────────────

function replayOne(trades: Trade[]): Map<string, Position> {
  const holdings = new Map<string, Position>()
  for (const t of trades) applyTrade(holdings, t)
  return holdings
}

describe('tradeCashEffect', () => {
  it('spends amount plus fee on a buy, returns amount less fee on a sell', () => {
    expect(tradeCashEffect(BUY)).toBeCloseTo(-1813.4)
    expect(tradeCashEffect({ ...BUY, action: 'sell', amount: 400, fee: 1 })).toBe(399)
  })

  it('moves no cash on an adjust, and treats missing amounts as zero', () => {
    expect(tradeCashEffect({ ...BUY, action: 'adjust', amount: 2100, fee: 5 })).toBe(0)
    expect(tradeCashEffect({ ...BUY, amount: undefined, fee: undefined })).toBe(-0)
  })
})

describe('applyTrade', () => {
  it('adds the fee to the cost of a buy', () => {
    expect(replayOne([BUY]).get('NVDA')).toEqual({ quantity: 10, cost: 1813.4 })
  })

  it('takes cost out of a sell at the average cost', () => {
    const second: Trade = { ...BUY, quantity: 10, amount: 2186.6, fee: 0 }
    const sell: Trade = { ...BUY, action: 'sell', quantity: 5, amount: 1000, fee: 1 }
    const pos = replayOne([BUY, second, sell]).get('NVDA')!
    expect(pos.quantity).toBe(15)
    expect(pos.cost).toBeCloseTo(4000 * 0.75)
  })

  it('drops a position sold down to nothing, float residue included', () => {
    const trades: Trade[] = [
      { ...BUY, quantity: 0.1 },
      { ...BUY, quantity: 0.2 },
      { ...BUY, action: 'sell', quantity: 0.3 },
    ]
    expect(replayOne(trades).has('NVDA')).toBe(false)
  })

  it('keeps total cost through a split', () => {
    const split: Trade = { ...BUY, action: 'adjust', quantity: 90, amount: undefined, fee: undefined }
    expect(replayOne([BUY, split]).get('NVDA')).toEqual({ quantity: 100, cost: 1813.4 })
  })

  it('adds the stated basis for shares moved in, and removes average cost for shares moved out', () => {
    const moveIn: Trade = { ...BUY, action: 'adjust', quantity: 10, amount: 1000, fee: undefined }
    const moveOut: Trade = { ...BUY, action: 'adjust', quantity: -5, amount: undefined, fee: undefined }
    expect(replayOne([moveIn, moveOut]).get('NVDA')).toEqual({ quantity: 5, cost: 500 })
  })

  it('lets an oversold position go negative instead of hiding it', () => {
    const sell: Trade = { ...BUY, action: 'sell', quantity: 12 }
    expect(replayOne([BUY, sell]).get('NVDA')).toEqual({ quantity: -2, cost: 0 })
  })
})

describe('replayTrades', () => {
  const nov: Trade = { ...BUY, date: '2026-11-03', action: 'sell', quantity: 4, amount: 800, fee: 0, createdAt: 'z' }
  const dec: Trade = { ...BUY, date: '2026-12-01', symbol: 'SPY', quantity: 1, amount: 600, fee: 0, createdAt: 'z' }

  it('applies trades in date order whatever order they arrive in', () => {
    const { holdings, cash } = replayTrades([dec, nov, BUY])
    expect(holdings.get('NVDA')?.quantity).toBe(6)
    expect(holdings.get('SPY')?.quantity).toBe(1)
    expect(cash).toBeCloseTo(-1813.4 + 800 - 600)
  })

  it('stops at the end of the given month', () => {
    const { holdings, cash } = replayTrades([dec, nov, BUY], '2026-11')
    expect(holdings.get('NVDA')?.quantity).toBe(6)
    expect(holdings.has('SPY')).toBe(false)
    expect(cash).toBeCloseTo(-1813.4 + 800)
    expect(replayTrades([dec, nov, BUY], '2026-09').holdings.size).toBe(0)
  })

  it('orders same-day trades by when they were entered', () => {
    const buy: Trade = { ...BUY, date: '2026-11-03', createdAt: '2026-11-03T10:00:00Z' }
    const sell: Trade = { ...BUY, date: '2026-11-03', action: 'sell', quantity: 10, createdAt: '2026-11-03T11:00:00Z' }
    expect(replayTrades([sell, buy]).holdings.has('NVDA')).toBe(false)
  })
})
