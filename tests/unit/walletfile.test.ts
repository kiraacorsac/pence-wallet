import { describe, it, expect } from 'vitest'
import { WalletFile, buildMonthContent } from '../../src/io/WalletFile'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'
import type { Transaction, Wallet } from '../../src/types'

const FOLDER = 'PennyWallet'
const CASH: Wallet = { name: 'Cash', type: 'cash', initialBalance: 1000, status: 'active', includeInNetAsset: true }

function monthFile(ym: string, txs: Transaction[], income = 0, expense = 0): string {
  return buildMonthContent(ym, txs, {
    income: new Map([['USD', income]]),
    expense: new Map([['USD', expense]]),
    netAsset: 0,
  })
}

const TX: Transaction = {
  date: '04/01', type: 'expense', wallet: 'Cash', category: 'food', note: 'lunch', amount: 100,
}

// ── deleteTransaction ─────────────────────────────────────────────────────────

describe('deleteTransaction', () => {
  it('removes matching transaction from file', async () => {
    const { app, store } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    await wf.deleteTransaction(TX, '2026-04')
    expect(store.get(`${FOLDER}/2026-04.md`)).not.toContain('lunch')
  })

  it('keeps existing transactions when target is not found', async () => {
    const { app, store } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    await wf.deleteTransaction({ ...TX, note: 'ghost' }, '2026-04')
    expect(store.get(`${FOLDER}/2026-04.md`)).toContain('lunch')
  })
})

// ── recalculateFrontmatter ────────────────────────────────────────────────────

describe('recalculateFrontmatter', () => {
  it('rewrites frontmatter from actual transactions', async () => {
    const { app, store } = createMockApp({
      [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 999, 999),
    })
    const wf = new WalletFile(app, createMockStore().store)
    await wf.recalculateFrontmatter('2026-04')
    const content = store.get(`${FOLDER}/2026-04.md`) ?? ''
    expect(content).toContain('expense.USD: 100')
    // zero totals are simply absent from the per-currency frontmatter
    expect(content).not.toContain('income.')
  })

  it('returns early when month file does not exist', async () => {
    const { app } = createMockApp()
    const wf = new WalletFile(app, createMockStore().store)
    await expect(wf.recalculateFrontmatter('2026-99')).resolves.toBeUndefined()
  })
})

// ── bootstrapFrontmatter ──────────────────────────────────────────────────────

describe('bootstrapFrontmatter', () => {
  it('returns early when folder does not exist', async () => {
    const { app } = createMockApp()
    const wf = new WalletFile(app, createMockStore().store)
    await expect(wf.bootstrapFrontmatter()).resolves.toBeUndefined()
  })

  it('skips files that already have netAsset in frontmatter', async () => {
    const { app, store } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    const before = store.get(`${FOLDER}/2026-04.md`)
    await wf.bootstrapFrontmatter()
    expect(store.get(`${FOLDER}/2026-04.md`)).toBe(before)
  })

  it('recalculates files missing netAsset', async () => {
    const noNetAsset = `---\nincome: 0\nexpense: 0\n---\n\n## 2026-04\n\n| Date | Type | Wallet | From | To | Category | Note | Tags | Amount | CreatedAt |\n|------|------|--------|------|----|----------|------|------|--------|-----------|`
    const { app, store } = createMockApp({ [`${FOLDER}/2026-04.md`]: noNetAsset })
    const wf = new WalletFile(app, createMockStore().store)
    await wf.bootstrapFrontmatter()
    expect(store.get(`${FOLDER}/2026-04.md`)).toContain('netAsset:')
  })
})

// ── validateAllData ───────────────────────────────────────────────────────────

describe('validateAllData', () => {
  it('returns empty when data is clean', async () => {
    const { app } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    expect(await wf.validateAllData()).toHaveLength(0)
  })

  it('detects frontmatter mismatch', async () => {
    const { app } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 999, 999) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    const issues = await wf.validateAllData()
    expect(issues.some(i => i.type === 'frontmatter')).toBe(true)
  })

  it('detects orphaned wallet', async () => {
    const { app } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [] })
    const issues = await wf.validateAllData()
    expect(issues.some(i => i.type === 'orphanedWallet')).toBe(true)
  })
})

// ── calculateAllWalletBalances ────────────────────────────────────────────────

describe('calculateAllWalletBalances', () => {
  it('aggregates balances across all months', async () => {
    const { app } = createMockApp({ [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100) })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    const balances = await wf.calculateAllWalletBalances()
    const cash = balances.find(b => b.wallet.name === 'Cash')
    expect(cash?.balance).toBe(900) // 1000 initial - 100 expense
  })
})

// ── updateTransaction (tags path) ────────────────────────────────────────────

const BASE_CONFIG = {
  wallets: [{ name: 'Cash', type: 'cash', initialBalance: 1000, status: 'active', includeInNetAsset: true }],
  defaultWallet: 'Cash',
  folderName: FOLDER,
  decimalPlaces: 0,
  options: { categories: { expense: [], income: [], transfer: [] } },
  tags: [],
  autoValidateOnLoad: false,
}

describe('updateTransaction', () => {
  it('merges new tags into config when updated tx has tags', async () => {
    const { app } = createMockApp({
      [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100),
    })
    const wf = new WalletFile(app, createMockStore(BASE_CONFIG).store)
    await wf.loadConfig()
    const updated: Transaction = { ...TX, tags: ['food', 'work'] }
    await wf.updateTransaction(TX, '2026-04', updated, '2026-04')
    expect(wf.getConfig().tags).toContain('food')
    expect(wf.getConfig().tags).toContain('work')
  })
})

// ── renameWalletInTransactions ────────────────────────────────────────────────

describe('renameWalletInTransactions', () => {
  it('renames wallet references across month files', async () => {
    const { app, store } = createMockApp({
      [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [TX], 0, 100),
    })
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig({ wallets: [CASH] })
    await wf.renameWalletInTransactions('Cash', 'Wallet2')
    const content = store.get(`${FOLDER}/2026-04.md`) ?? ''
    expect(content).toContain('Wallet2')
    expect(content).not.toContain('| Cash |')
  })

  it('skips months where wallet name does not appear', async () => {
    const other: Transaction = { ...TX, wallet: 'Bank' }
    const { app, store } = createMockApp({
      [`${FOLDER}/2026-04.md`]: monthFile('2026-04', [other], 0, 100),
    })
    const wf = new WalletFile(app, createMockStore().store)
    const before = store.get(`${FOLDER}/2026-04.md`)
    await wf.renameWalletInTransactions('Cash', 'Wallet2')
    expect(store.get(`${FOLDER}/2026-04.md`)).toBe(before)
  })
})
