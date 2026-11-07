import { describe, it, expect } from 'vitest'
import { WalletFile, buildMonthContent } from '../../src/io/WalletFile'
import { buildInvestmentContent, parseInvestmentFile, parseLedgerMeta } from '../../src/io/investments'
import { DEFAULT_CONFIG } from '../../src/types'
import type { PennyWalletConfig, PricePoint, Trade, Transaction, Wallet } from '../../src/types'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'

// ── Setup ─────────────────────────────────────────────────────────────────────

const CURRENT: Wallet = { name: 'Current', type: 'bank', initialBalance: 5000, status: 'active', includeInNetAsset: true, currency: 'GBP' }
const IBKR: Wallet = { name: 'IBKR', type: 'investment', initialBalance: 0, status: 'active', includeInNetAsset: true, currency: 'USD' }

const LEDGER = 'Ledgers/Investments/IBKR.md'

async function makeWalletFile(
  initialFiles: Record<string, string> = {},
  patch: Partial<PennyWalletConfig> = {},
) {
  const config: PennyWalletConfig = {
    ...DEFAULT_CONFIG,
    folderName: 'Ledgers',
    baseCurrency: 'GBP',
    wallets: [CURRENT, IBKR],
    rates: [{ code: 'USD', effectiveFrom: '2026-01', rate: 0.75 }],
    ...patch,
  }
  const { app, store } = createMockApp(initialFiles)
  const wf = new WalletFile(app, createMockStore(config).store)
  await wf.loadConfig()
  return { wf, store }
}

/** £800 sent from Current arrives as $1,000 in IBKR. */
const FUNDING: Transaction = {
  date: '10/01', type: 'transfer', fromWallet: 'Current', toWallet: 'IBKR',
  note: 'fund', amount: 800, amountTo: 1000, createdAt: '2026-10-01T09:00:00.000Z',
}

const BUY_NVDA: Trade = {
  date: '2026-10-02', action: 'buy', symbol: 'NVDA', quantity: 4, amount: 800, fee: 1,
  note: '', createdAt: '2026-10-02T14:00:00.000Z',
}

const SELL_NVDA: Trade = {
  date: '2026-11-03', action: 'sell', symbol: 'NVDA', quantity: 1, amount: 190, fee: 1,
  note: 'trim', createdAt: '2026-11-03T14:00:00.000Z',
}

const PRICES: PricePoint[] = [
  { symbol: 'NVDA', effectiveFrom: '2026-10', price: 210, currency: 'USD' },
  { symbol: 'NVDA', effectiveFrom: '2026-11', price: 190, currency: 'USD' },
]

function monthFile(ym: string, txs: Transaction[]): string {
  return buildMonthContent(ym, txs, { income: new Map(), expense: new Map(), netAsset: 0 })
}

// ── Ledger I/O ────────────────────────────────────────────────────────────────

describe('trade I/O', () => {
  it('writes a trade into the account\'s own ledger, not a month file', async () => {
    const { wf, store } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)

    expect([...store.keys()]).toEqual([LEDGER])
    const content = store.get(LEDGER)!
    expect(parseLedgerMeta(content)).toEqual({ account: 'IBKR', currency: 'USD' })
    expect(parseInvestmentFile(content)).toEqual([BUY_NVDA])
    expect(content).toContain('holdings.NVDA: 4\n')
    expect(await wf.readTrades('IBKR')).toEqual([BUY_NVDA])
  })

  it('stamps createdAt on a new trade', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', { ...BUY_NVDA, createdAt: undefined })
    expect((await wf.readTrades('IBKR'))[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('keeps the ledger in date order whatever order trades are added', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', SELL_NVDA)
    await wf.writeTrade('IBKR', BUY_NVDA)
    expect((await wf.readTrades('IBKR')).map(t => t.action)).toEqual(['buy', 'sell'])
  })

  it('edits a trade in place, keeping its createdAt', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.updateTrade('IBKR', BUY_NVDA, 'IBKR', { ...BUY_NVDA, quantity: 5, createdAt: undefined })
    const trades = await wf.readTrades('IBKR')
    expect(trades).toHaveLength(1)
    expect(trades[0]).toEqual({ ...BUY_NVDA, quantity: 5 })
  })

  it('moves a trade to another investment account', async () => {
    const other: Wallet = { ...IBKR, name: 'Vanguard' }
    const { wf, store } = await makeWalletFile({}, { wallets: [CURRENT, IBKR, other] })
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.updateTrade('IBKR', BUY_NVDA, 'Vanguard', BUY_NVDA)
    expect(await wf.readTrades('IBKR')).toEqual([])
    expect(await wf.readTrades('Vanguard')).toEqual([BUY_NVDA])
    expect(store.has('Ledgers/Investments/Vanguard.md')).toBe(true)
  })

  it('deletes a trade', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.writeTrade('IBKR', SELL_NVDA)
    await wf.deleteTrade('IBKR', BUY_NVDA)
    expect(await wf.readTrades('IBKR')).toEqual([SELL_NVDA])
  })

  it('detects names that would share a ledger file', async () => {
    const { wf } = await makeWalletFile()
    expect(wf.ledgerNameTaken('ibkr')).toBe(true)        // case-insensitive file systems
    expect(wf.ledgerNameTaken('IBKR', 'IBKR')).toBe(false)  // renaming onto itself
    expect(wf.ledgerNameTaken('Vanguard')).toBe(false)
    expect(wf.ledgerPath('IBKR: US/EU')).toBe('Ledgers/Investments/IBKR- US-EU.md')
  })
})

// ── Renaming ──────────────────────────────────────────────────────────────────

describe('renaming an investment account', () => {
  it('moves its ledger and restates the owner', async () => {
    const { wf, store } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)

    wf.updateConfig({ wallets: [CURRENT, { ...IBKR, name: 'Interactive' }] })
    await wf.renameWalletInTransactions('IBKR', 'Interactive')

    expect(store.has(LEDGER)).toBe(false)
    const content = store.get('Ledgers/Investments/Interactive.md')!
    expect(parseLedgerMeta(content).account).toBe('Interactive')
    expect(await wf.readTrades('Interactive')).toEqual([BUY_NVDA])
  })

  it('leaves an orphaned ledger alone when a non-investment account takes its name', async () => {
    const orphan = buildInvestmentContent('Old Broker', 'USD', [BUY_NVDA])
    const { wf, store } = await makeWalletFile({ 'Ledgers/Investments/Old Broker.md': orphan })

    wf.updateConfig({ wallets: [{ ...CURRENT, name: 'Savings' }, IBKR] })
    await wf.renameWalletInTransactions('Old Broker', 'Savings')

    expect(store.get('Ledgers/Investments/Old Broker.md')).toBe(orphan)
    expect(store.has('Ledgers/Investments/Savings.md')).toBe(false)
  })

  it('never moves a ledger onto another account\'s file', async () => {
    const theirs = buildInvestmentContent('Vanguard', 'USD', [SELL_NVDA])
    const { wf, store } = await makeWalletFile({ 'Ledgers/Investments/Vanguard.md': theirs })
    await wf.writeTrade('IBKR', BUY_NVDA)

    await wf.renameWalletInTransactions('IBKR', 'Vanguard')

    expect(store.get('Ledgers/Investments/Vanguard.md')).toBe(theirs)
    expect(parseInvestmentFile(store.get(LEDGER)!)).toEqual([BUY_NVDA])
  })
})

// ── Balances and net worth ────────────────────────────────────────────────────

describe('balances', () => {
  it('splits an investment account into cash and holdings', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) })
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.writeTrade('IBKR', SELL_NVDA)

    const { balances } = await wf.calculateWalletData()
    const current = balances.find(b => b.wallet.name === 'Current')!
    const ibkr = balances.find(b => b.wallet.name === 'IBKR')!

    expect(current.balance).toBe(4200)
    expect(current.holdings).toBeUndefined()
    // $1,000 in, $801 on the buy, $189 back from the sell
    expect(ibkr.balance).toBeCloseTo(388, 10)
    expect(ibkr.currency).toBe('USD')
    expect(ibkr.holdings?.get('NVDA')?.quantity).toBe(3)
    // three of the four shares remain, so three quarters of their $801 cost
    expect(ibkr.holdings?.get('NVDA')?.cost).toBeCloseTo(801 * 3 / 4, 10)
  })

  it('counts an account with only trades as having history', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)
    const { walletsWithTransactions } = await wf.calculateWalletData()
    expect(walletsWithTransactions.has('IBKR')).toBe(true)
    expect(await wf.walletHasTransactions('IBKR')).toBe(true)
    expect(await wf.walletHasTransactions('Current')).toBe(false)
  })

  it('values holdings at the price, converted through the exchange rate', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) }, { prices: PRICES })
    await wf.writeTrade('IBKR', BUY_NVDA)
    const balances = await wf.calculateAllWalletBalances()
    const ibkr = balances.find(b => b.wallet.name === 'IBKR')!

    // $199 cash + 4 × $190 = $959
    expect(wf.walletValue(ibkr, '2026-11')).toBeCloseTo(959, 10)
    // £4,200 + $959 × 0.75
    expect(wf.computeNetAsset(balances, '2026-11')).toBeCloseTo(4200 + 959 * 0.75, 10)
    // October's price for the same holdings: 4 × $210
    expect(wf.computeNetAsset(balances, '2026-10')).toBeCloseTo(4200 + (199 + 840) * 0.75, 10)
  })

  it('values an unpriced holding at cost, so a purchase does not read as a loss', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) })
    const before = wf.computeNetAsset(await wf.calculateAllWalletBalances(), '2026-10')
    await wf.writeTrade('IBKR', BUY_NVDA)
    const after = wf.computeNetAsset(await wf.calculateAllWalletBalances(), '2026-10')
    expect(after).toBeCloseTo(before, 10)
  })

  it('breaks net worth down so the parts add up to the total', async () => {
    const prices: PricePoint[] = [...PRICES, { symbol: 'ASML', effectiveFrom: '2026-10', price: 700, currency: 'EUR' }]
    const { wf } = await makeWalletFile(
      { 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) },
      { prices, rates: [{ code: 'USD', effectiveFrom: '2026-01', rate: 0.75 }, { code: 'EUR', effectiveFrom: '2026-01', rate: 0.85 }] },
    )
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.writeTrade('IBKR', { ...BUY_NVDA, symbol: 'ASML', quantity: 0.1, amount: 80, fee: 0, createdAt: 'x' })
    await wf.writeTrade('IBKR', { ...BUY_NVDA, symbol: 'TDOC', quantity: 10, amount: 70, fee: 0, createdAt: 'y' })
    const balances = await wf.calculateAllWalletBalances()

    const parts = wf.netAssetByCurrency(balances, '2026-11')
    expect(parts.get('EUR')).toBeCloseTo(70, 10)          // ASML in the currency it trades in
    expect(parts.get('USD')).toBeCloseTo(49 + 760 + 70, 10)  // cash, NVDA, and TDOC at cost
    expect(parts.get('GBP')).toBe(4200)
    const total = 4200 + (49 + 760 + 70) * 0.75 + 70 * 0.85
    expect(wf.computeNetAsset(balances, '2026-11')).toBeCloseTo(total, 10)
  })
})

// ── Timelines ─────────────────────────────────────────────────────────────────

describe('getNetAssetTimeline with investments', () => {
  it('values each month-end with the holdings and price of that month', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) }, { prices: PRICES })
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.writeTrade('IBKR', SELL_NVDA)  // November, which has no month file

    const timeline = await wf.getNetAssetTimeline(['2026-10', '2026-11'])
    // October: $199 cash + 4 × $210
    expect(timeline.get('2026-10')).toBeCloseTo(4200 + (199 + 840) * 0.75, 10)
    // November: $388 cash + 3 × $190, reported despite no month file
    expect(timeline.get('2026-11')).toBeCloseTo(4200 + (388 + 570) * 0.75, 10)
  })

  it('leaves trades after a month out of that month', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-09.md': monthFile('2026-09', []) }, { prices: PRICES })
    await wf.writeTrade('IBKR', BUY_NVDA)
    expect((await wf.getNetAssetTimeline(['2026-09'])).get('2026-09')).toBe(5000)
  })

  it('reports each account\'s worth in its own currency in the balance trend', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) }, { prices: PRICES })
    await wf.writeTrade('IBKR', BUY_NVDA)
    const trend = await wf.getWalletBalanceTrend(['2026-10'])
    expect(trend.get('IBKR')?.get('2026-10')).toBeCloseTo(199 + 840, 10)
    expect(trend.get('Current')?.get('2026-10')).toBe(4200)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('validating ledgers', () => {
  it('is clean for a healthy ledger', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)
    expect(await wf.validateAllData()).toEqual([])
  })

  it('flags the first trade that takes a holding below zero', async () => {
    const { wf } = await makeWalletFile()
    await wf.writeTrade('IBKR', BUY_NVDA)
    await wf.writeTrade('IBKR', { ...SELL_NVDA, quantity: 6 })
    await wf.writeTrade('IBKR', { ...SELL_NVDA, date: '2026-12-01', quantity: 1, createdAt: 'z' })

    expect(await wf.validateAllData()).toEqual([
      { type: 'negativeHolding', walletName: 'IBKR', symbol: 'NVDA', date: '2026-11-03', quantity: -2 },
    ])
  })

  it('flags a ledger no account owns, and recreates its account on repair', async () => {
    const orphan = buildInvestmentContent('Old Broker', 'EUR', [BUY_NVDA])
    const { wf } = await makeWalletFile({ 'Ledgers/Investments/Old Broker.md': orphan })

    const issues = await wf.validateAllData()
    expect(issues).toEqual([
      { type: 'orphanedLedger', path: 'Ledgers/Investments/Old Broker.md', accountName: 'Old Broker', tradeCount: 1 },
    ])

    expect(await wf.repairOrphanedLedger('Ledgers/Investments/Old Broker.md')).toBe(true)
    const restored = wf.getConfig().wallets.find(w => w.name === 'Old Broker')
    expect(restored).toEqual({
      name: 'Old Broker', type: 'investment', initialBalance: 0,
      status: 'archived', includeInNetAsset: false, currency: 'EUR',
    })
    expect(await wf.validateAllData()).toEqual([])
  })

  it('will not repair a ledger whose named account maps to a different file', async () => {
    // Renamed by hand: the frontmatter still says IBKR, whose ledger lives elsewhere.
    const moved = buildInvestmentContent('IBKR', 'USD', [BUY_NVDA])
    const { wf } = await makeWalletFile({ 'Ledgers/Investments/Copy.md': moved })
    const [issue] = await wf.validateAllData()
    expect(issue.type).toBe('orphanedLedger')
    expect(wf.canRepairOrphanedLedger({ path: 'Ledgers/Investments/Copy.md', accountName: 'IBKR' })).toBe(false)
    expect(await wf.repairOrphanedLedger('Ledgers/Investments/Copy.md')).toBe(false)
  })

  it('leaves month-file folders and month files out of ledger checks', async () => {
    const { wf } = await makeWalletFile({ 'Ledgers/2026-10.md': monthFile('2026-10', [FUNDING]) })
    await wf.writeTrade('IBKR', BUY_NVDA)
    expect(wf.getAllYearMonths()).toEqual(['2026-10'])
    expect(await wf.validateAllData()).toEqual([])
  })
})
