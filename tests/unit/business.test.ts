import { describe, it, expect } from 'vitest'
import { WalletFile } from '../../src/io/WalletFile'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'
import type { Wallet, Transaction, WalletBalance } from '../../src/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWalletFile(wallets: Wallet[]): WalletFile {
  const { app } = createMockApp()
  const wf = new WalletFile(app, createMockStore().store)
  wf.updateConfig({ wallets })
  return wf
}

const CASH: Wallet = { name: 'Cash', type: 'cash', initialBalance: 1000, status: 'active', includeInNetAsset: true }
const BANK: Wallet = { name: 'Bank', type: 'bank', initialBalance: 5000, status: 'active', includeInNetAsset: true }
const CARD: Wallet = { name: 'Card', type: 'bank', initialBalance: 0, status: 'active', includeInNetAsset: true }

// ── computeWalletBalances ─────────────────────────────────────────────────────

describe('computeWalletBalances', () => {
  it('expense on bank reduces balance', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [{ date: '04/01', type: 'expense', wallet: 'Bank', category: 'food', note: '', amount: 200 }]
    const result = wf.computeWalletBalances(txs)
    expect(result[0].balance).toBe(4800)
  })

  it('income on bank increases balance', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [{ date: '04/01', type: 'income', wallet: 'Bank', category: 'salary', note: '', amount: 10000 }]
    const result = wf.computeWalletBalances(txs)
    expect(result[0].balance).toBe(15000)
  })

  it('expense drives an account negative', () => {
    const wf = makeWalletFile([CARD])
    const txs: Transaction[] = [{ date: '04/01', type: 'expense', wallet: 'Card', category: 'Food', note: '', amount: 300 }]
    expect(wf.computeWalletBalances(txs)[0].balance).toBe(-300)
  })

  it('transfer into a negative account brings it back towards zero', () => {
    const wf = makeWalletFile([BANK, CARD])
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Card', category: 'Food', note: '', amount: 500 },
      { date: '04/15', type: 'transfer', category: 'Credit Card Payment', fromWallet: 'Bank', toWallet: 'Card', note: '', amount: 500 },
    ]
    const result = wf.computeWalletBalances(txs)
    expect(result.find(r => r.wallet.name === 'Bank')!.balance).toBe(4500)
    expect(result.find(r => r.wallet.name === 'Card')!.balance).toBe(0)
  })

  it('the category never changes how a transaction moves money', () => {
    const wf = makeWalletFile([BANK, CASH])
    for (const category of ['Credit Card Payment', 'Account Transfer', 'Anything', undefined]) {
      const result = wf.computeWalletBalances([
        { date: '04/01', type: 'transfer', category, fromWallet: 'Bank', toWallet: 'Cash', note: '', amount: 500 },
      ])
      expect(result.find(r => r.wallet.name === 'Bank')!.balance).toBe(4500)
      expect(result.find(r => r.wallet.name === 'Cash')!.balance).toBe(1500)
    }
  })

  it('transfer: fromWallet decreases, toWallet increases', () => {
    const wf = makeWalletFile([BANK, CASH])
    const txs: Transaction[] = [{ date: '04/01', type: 'transfer', fromWallet: 'Bank', toWallet: 'Cash', note: '', amount: 500 }]
    const result = wf.computeWalletBalances(txs)
    const bank = result.find(r => r.wallet.name === 'Bank')!
    const cash = result.find(r => r.wallet.name === 'Cash')!
    expect(bank.balance).toBe(4500)
    expect(cash.balance).toBe(1500)
  })

  it('transfer between non-card wallets is unaffected by the category', () => {
    const wf = makeWalletFile([BANK, CASH])
    const result = wf.computeWalletBalances([
      { date: '04/01', type: 'transfer', category: 'Credit Card Payment', fromWallet: 'Bank', toWallet: 'Cash', note: '', amount: 500 },
    ])
    expect(result.find(r => r.wallet.name === 'Bank')!.balance).toBe(4500)
    expect(result.find(r => r.wallet.name === 'Cash')!.balance).toBe(1500)
  })

  it('negative expense on bank restores balance', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Bank', category: 'shopping', note: '', amount: 500 },
      { date: '04/02', type: 'expense', wallet: 'Bank', category: 'shopping', note: '退款', amount: -200 },
    ]
    const result = wf.computeWalletBalances(txs)
    expect(result[0].balance).toBe(4700) // 5000 - 500 + 200
  })

  it('unknown wallet in transaction is silently ignored', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [{ date: '04/01', type: 'expense', wallet: 'Ghost', category: 'food', note: '', amount: 100 }]
    const result = wf.computeWalletBalances(txs)
    expect(result[0].balance).toBe(5000) // unaffected
  })

  it('accumulates multiple expenses on the same wallet', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Bank', category: 'food', note: '', amount: 100 },
      { date: '04/02', type: 'expense', wallet: 'Bank', category: 'transport', note: '', amount: 200 },
    ]
    const result = wf.computeWalletBalances(txs)
    expect(result[0].balance).toBe(4700) // 5000 - 100 - 200
  })

  it('preserves wallet order from config', () => {
    const wf = makeWalletFile([CASH, BANK])
    const result = wf.computeWalletBalances([])
    expect(result.map(r => r.wallet.name)).toEqual(['Cash', 'Bank'])
  })
})

// ── computeNetAsset ───────────────────────────────────────────────────────────

describe('computeNetAsset', () => {
  it('a negative balance subtracts from net asset', () => {
    const wf = makeWalletFile([BANK, CARD])
    const balances: WalletBalance[] = [
      { wallet: BANK, balance: 5000 },
      { wallet: CARD, balance: -300 },
    ]
    expect(wf.computeNetAsset(balances)).toBe(4700)
  })

  it('sums bank and cash balances', () => {
    const wf = makeWalletFile([BANK, CASH])
    const balances: WalletBalance[] = [
      { wallet: BANK, balance: 5000 },
      { wallet: CASH, balance: 1000 },
    ]
    expect(wf.computeNetAsset(balances)).toBe(6000)
  })

  it('excludes wallet with includeInNetAsset: false', () => {
    const archived: Wallet = { ...BANK, name: 'OldBank', includeInNetAsset: false }
    const wf = makeWalletFile([CASH, archived])
    const balances: WalletBalance[] = [
      { wallet: CASH, balance: 1000 },
      { wallet: archived, balance: 9999 }, // should be excluded
    ]
    expect(wf.computeNetAsset(balances)).toBe(1000)
  })

  it('returns 0 for empty balances', () => {
    const wf = makeWalletFile([])
    expect(wf.computeNetAsset([])).toBe(0)
  })
})

// ── computeSummary ────────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('sums only expense transactions', () => {
    const wf = makeWalletFile([])
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Cash', category: 'food', note: '', amount: 200 },
      { date: '04/02', type: 'expense', wallet: 'Cash', category: 'transport', note: '', amount: 50 },
    ]
    expect(wf.computeSummary(txs)).toEqual({ income: 0, expense: 250, netAsset: 0 })
  })

  it('sums only income transactions', () => {
    const wf = makeWalletFile([])
    const txs: Transaction[] = [
      { date: '04/01', type: 'income', wallet: 'Bank', category: 'salary', note: '', amount: 50000 },
    ]
    expect(wf.computeSummary(txs)).toEqual({ income: 50000, expense: 0, netAsset: 0 })
  })

  it('excludes transfer from totals', () => {
    const wf = makeWalletFile([])
    const txs: Transaction[] = [
      { date: '04/01', type: 'transfer', fromWallet: 'Bank', toWallet: 'Cash', note: '', amount: 1000 },
      { date: '04/02', type: 'transfer', category: 'Credit Card Payment', fromWallet: 'Bank', toWallet: 'Card', note: '', amount: 500 },
    ]
    expect(wf.computeSummary(txs)).toEqual({ income: 0, expense: 0, netAsset: 0 })
  })

  it('always returns netAsset: 0', () => {
    const wf = makeWalletFile([])
    const { netAsset } = wf.computeSummary([])
    expect(netAsset).toBe(0)
  })

  it('negative expense (refund) reduces monthly expense total', () => {
    const wf = makeWalletFile([BANK])
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Bank', category: 'food', note: '', amount: 300 },
      { date: '04/02', type: 'expense', wallet: 'Bank', category: 'food', note: '退款', amount: -100 },
    ]
    expect(wf.computeSummary(txs)).toEqual({ income: 0, expense: 200, netAsset: 0 })
  })
})

// ── groupByCategory ───────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  const wf = makeWalletFile([])

  it('sums amounts for the same category', () => {
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Cash', category: 'food', note: '', amount: 100 },
      { date: '04/02', type: 'expense', wallet: 'Cash', category: 'food', note: '', amount: 200 },
    ]
    const map = wf.groupByCategory(txs, 'expense')
    expect(map.get('food')).toBe(300)
  })

  it('falls back to "" for undefined category', () => {
    const txs: Transaction[] = [
      { date: '04/01', type: 'expense', wallet: 'Cash', note: '', amount: 50 },
    ]
    const map = wf.groupByCategory(txs, 'expense')
    expect(map.get('')).toBe(50)
  })

  it('excludes transactions of the wrong type', () => {
    const txs: Transaction[] = [
      { date: '04/01', type: 'income', wallet: 'Bank', category: 'salary', note: '', amount: 10000 },
      { date: '04/02', type: 'expense', wallet: 'Cash', category: 'food', note: '', amount: 100 },
    ]
    const map = wf.groupByCategory(txs, 'expense')
    expect(map.has('salary')).toBe(false)
    expect(map.get('food')).toBe(100)
  })

  it('returns empty map for no matching transactions', () => {
    const txs: Transaction[] = [
      { date: '04/01', type: 'income', wallet: 'Bank', category: 'salary', note: '', amount: 1000 },
    ]
    const map = wf.groupByCategory(txs, 'expense')
    expect(map.size).toBe(0)
  })
})
