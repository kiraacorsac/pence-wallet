import { describe, it, expect } from 'vitest'
import { WalletFile, parseRow, formatRow, parseFrontmatter, buildMonthContent } from '../../src/io/WalletFile'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'
import type { PennyWalletConfig, RatePoint, Transaction, Wallet } from '../../src/types'

const GBP: Wallet = { name: 'HSBC', type: 'bank', initialBalance: 1000, status: 'active', includeInNetAsset: true, currency: 'GBP' }
const USD: Wallet = { name: 'Chase', type: 'bank', initialBalance: 500, status: 'active', includeInNetAsset: true, currency: 'USD' }
// No currency field - the shape every account written before this feature has.
const LEGACY: Wallet = { name: 'Cash', type: 'cash', initialBalance: 200, status: 'active', includeInNetAsset: true }

const RATES: RatePoint[] = [
  { code: 'USD', effectiveFrom: '2026-01', rate: 0.80 },
  { code: 'USD', effectiveFrom: '2026-06', rate: 0.50 },
]

function makeWalletFile(wallets: Wallet[], patch: Partial<PennyWalletConfig> = {}): WalletFile {
  const { app } = createMockApp()
  const wf = new WalletFile(app, createMockStore().store)
  wf.updateConfig({ wallets, baseCurrency: 'GBP', rates: RATES, ...patch })
  return wf
}

// ── the row format ────────────────────────────────────────────────────────────

describe('AmountTo column', () => {
  const crossCurrency: Transaction = {
    date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Chase',
    category: 'Account Transfer', note: 'Moving funds', amount: 200, amountTo: 254,
    createdAt: '2026-09-08T22:05:08.143Z',
  }

  it('round-trips a cross-currency transfer', () => {
    const parsed = parseRow(formatRow(crossCurrency))
    expect(parsed).toEqual(crossCurrency)
  })

  it('writes a dash when there is no second amount', () => {
    const plain: Transaction = { date: '09/01', type: 'expense', wallet: 'HSBC', category: 'Food', note: 'Lunch', amount: 12 }
    const row = formatRow(plain)
    expect(row.split('|').map(c => c.trim())[10]).toBe('-')
    expect(parseRow(row)?.amountTo).toBeUndefined()
  })

  it('still parses a 10-column row written before AmountTo existed', () => {
    const legacy = '| 09/08 | transfer | - | HSBC | Chase | Account Transfer | Cash Withdrawal | - | 9650 | 2026-09-08T22:05:08.143Z |'
    const parsed = parseRow(legacy)
    expect(parsed?.amount).toBe(9650)
    expect(parsed?.amountTo).toBeUndefined()
    expect(parsed?.createdAt).toBe('2026-09-08T22:05:08.143Z')
  })

  it('reads the trailing column of a 10-column row as CreatedAt, not AmountTo', () => {
    const legacy = '| 09/01 | expense | Cash | - | - | Food | Lunch | - | 264 | 2026-09-01T22:14:55.261Z |'
    expect(parseRow(legacy)?.amountTo).toBeUndefined()
    expect(parseRow(legacy)?.createdAt).toBe('2026-09-01T22:14:55.261Z')
  })

  it('rejects a row with any other column count', () => {
    expect(parseRow('| 09/01 | expense | Cash |')).toBeNull()
  })
})

// ── balances ──────────────────────────────────────────────────────────────────

describe('cross-currency transfers', () => {
  it('debits what left and credits what arrived', () => {
    const wf = makeWalletFile([GBP, USD])
    const txs: Transaction[] = [
      { date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Chase', note: '', amount: 200, amountTo: 254 },
    ]
    const balances = wf.computeWalletBalances(txs)
    expect(balances.find(b => b.wallet.name === 'HSBC')?.balance).toBe(800)
    expect(balances.find(b => b.wallet.name === 'Chase')?.balance).toBe(754)
  })

  it('moves the same amount on both legs when amountTo is absent', () => {
    const wf = makeWalletFile([GBP, USD])
    const txs: Transaction[] = [
      { date: '09/08', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Chase', note: '', amount: 200 },
    ]
    const balances = wf.computeWalletBalances(txs)
    expect(balances.find(b => b.wallet.name === 'HSBC')?.balance).toBe(800)
    expect(balances.find(b => b.wallet.name === 'Chase')?.balance).toBe(700)
  })

  it('reports each balance in its own currency', () => {
    const wf = makeWalletFile([GBP, USD, LEGACY])
    const balances = wf.computeWalletBalances([])
    expect(balances.find(b => b.wallet.name === 'HSBC')?.currency).toBe('GBP')
    expect(balances.find(b => b.wallet.name === 'Chase')?.currency).toBe('USD')
    // an account predating the currency field is held in the base currency
    expect(balances.find(b => b.wallet.name === 'Cash')?.currency).toBe('GBP')
  })
})

// ── net asset ─────────────────────────────────────────────────────────────────

describe('computeNetAsset across currencies', () => {
  it('converts every balance into the base currency', () => {
    const wf = makeWalletFile([GBP, USD])
    const balances = wf.computeWalletBalances([])
    // 1000 GBP + (500 USD * 0.80) = 1400 GBP
    expect(wf.computeNetAsset(balances, '2026-03')).toBeCloseTo(1400, 10)
  })

  it('prices the same balances differently in a month with a different rate', () => {
    const wf = makeWalletFile([GBP, USD])
    const balances = wf.computeWalletBalances([])
    // 1000 GBP + (500 USD * 0.50) = 1250 GBP
    expect(wf.computeNetAsset(balances, '2026-09')).toBeCloseTo(1250, 10)
  })

  it('still excludes accounts flagged out of net worth', () => {
    const excluded: Wallet = { ...USD, includeInNetAsset: false }
    const wf = makeWalletFile([GBP, excluded])
    const balances = wf.computeWalletBalances([])
    expect(wf.computeNetAsset(balances, '2026-03')).toBe(1000)
  })

  it('breaks net worth down by the currency it is held in', () => {
    const wf = makeWalletFile([GBP, USD])
    const byCurrency = wf.netAssetByCurrency(wf.computeWalletBalances([]))
    expect(byCurrency.get('GBP')).toBe(1000)
    expect(byCurrency.get('USD')).toBe(500)
  })
})

// ── month summaries ───────────────────────────────────────────────────────────

describe('per-currency month summary', () => {
  const txs: Transaction[] = [
    { date: '09/01', type: 'expense', wallet: 'HSBC', category: 'Food', note: '', amount: 30 },
    { date: '09/02', type: 'expense', wallet: 'Chase', category: 'Food', note: '', amount: 40 },
    { date: '09/03', type: 'income', wallet: 'HSBC', category: 'Salary', note: '', amount: 2000 },
    { date: '09/04', type: 'transfer', fromWallet: 'HSBC', toWallet: 'Chase', note: '', amount: 100, amountTo: 125 },
  ]

  it('keeps each currency separate rather than adding unlike units', () => {
    const wf = makeWalletFile([GBP, USD])
    const summary = wf.computeSummary(txs)
    expect(summary.expense.get('GBP')).toBe(30)
    expect(summary.expense.get('USD')).toBe(40)
    expect(summary.income.get('GBP')).toBe(2000)
  })

  it('leaves transfers out of income and expense', () => {
    const wf = makeWalletFile([GBP, USD])
    const summary = wf.computeSummary(txs)
    expect(summary.income.has('USD')).toBe(false)
  })

  it('survives a write/read round trip through the frontmatter', () => {
    const wf = makeWalletFile([GBP, USD])
    const summary = wf.computeSummary(txs)
    const content = buildMonthContent('2026-09', txs, summary)
    const read = parseFrontmatter(content, 'GBP')
    expect(read.expense?.get('GBP')).toBe(30)
    expect(read.expense?.get('USD')).toBe(40)
    expect(read.income?.get('GBP')).toBe(2000)
  })

  it('reads a legacy bare income key as the base currency', () => {
    const legacy = '---\nincome: 60000\nexpense: 12450\nnetAsset: 0\n---\n\n## 2026-04'
    const read = parseFrontmatter(legacy, 'GBP')
    expect(read.income?.get('GBP')).toBe(60000)
    expect(read.expense?.get('GBP')).toBe(12450)
  })

  it('groups categories into the base currency at that month rate', () => {
    const wf = makeWalletFile([GBP, USD])
    // 30 GBP + (40 USD * 0.80) = 62 GBP
    expect(wf.groupByCategory(txs, 'expense', '2026-03').get('Food')).toBeCloseTo(62, 10)
    // 30 GBP + (40 USD * 0.50) = 50 GBP
    expect(wf.groupByCategory(txs, 'expense', '2026-09').get('Food')).toBeCloseTo(50, 10)
  })
})
