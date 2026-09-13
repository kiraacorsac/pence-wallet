import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { WalletFile, parseMonthFile, parseFrontmatter } from '../../src/io/WalletFile'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore } from '../helpers/mockStore'
import { sumToBase, rateFor } from '../../src/money'
import type { PennyWalletConfig, Transaction } from '../../src/types'

const DIR = 'demo-vault/PennyWallet'
const CFG = 'demo-vault/.obsidian/plugins/penny-wallet/data.json'

// The demo vault is generated, not committed, so this only runs where it exists
// (locally after `npm run demo:data`). CI has no vault and skips it.
const hasVault = existsSync(CFG) && existsSync(DIR)

describe.skipIf(!hasVault)('the generated demo vault, read through the real code path', () => {
  it('computes multi-currency balances and net worth end to end', () => {
    const config = JSON.parse(readFileSync(CFG, 'utf8')) as PennyWalletConfig

    const { app } = createMockApp()
    const wf = new WalletFile(app, createMockStore().store)
    wf.updateConfig(config)

    const months = readdirSync(DIR).filter(f => /^\d{4}-\d{2}\.md$/.test(f)).sort()
    const all: Transaction[] = []
    for (const f of months) all.push(...parseMonthFile(readFileSync(`${DIR}/${f}`, 'utf8')))

    // every row parsed, including the 11-column ones
    expect(all.length).toBeGreaterThan(400)

    const crossCurrency = all.filter(tx => tx.amountTo != null)
    expect(crossCurrency.length).toBe(months.length)  // one FX purchase a month

    const balances = wf.computeWalletBalances(all)
    const usd = balances.find(b => b.wallet.name === 'Chase USD')!
    expect(usd.currency).toBe('USD')
    // seeded 1500 USD and fed ~500/month, minus small USD spends
    expect(usd.balance).toBeGreaterThan(5000)
    expect(usd.balance).toBeLessThan(7000)

    // Net worth is the sum of its per-currency parts, each priced at that
    // month's rate. Written over whatever currencies the vault happens to hold,
    // since one opened in Obsidian may have had accounts added by hand.
    const last = months[months.length - 1]
    const net = wf.computeNetAsset(balances, last)
    const byCurrency = wf.netAssetByCurrency(balances)
    expect(byCurrency.get('USD')).toBeCloseTo(usd.balance, 6)

    let expected = 0
    for (const [code, amount] of byCurrency) expected += amount * rateFor(config, code, last)
    expect(net).toBeCloseTo(expected, 4)

    // the dated rate table actually bites: same holdings, two different prices
    expect(rateFor(config, 'USD', '2025-11')).toBe(31.5)
    expect(rateFor(config, 'USD', '2026-09')).toBe(32.4)
    expect(wf.computeNetAsset(balances, '2025-11')).toBeLessThan(net)

    // each month's cached frontmatter matches what the transactions actually say
    for (const f of months) {
      const content = readFileSync(`${DIR}/${f}`, 'utf8')
      const ym = f.replace('.md', '')
      const fm = parseFrontmatter(content, config.baseCurrency)
      const summary = wf.computeSummary(parseMonthFile(content))
      expect([...summary.expense.entries()].sort()).toEqual([...(fm.expense ?? new Map()).entries()].sort())
      expect(sumToBase(summary.income, config, ym)).toBeGreaterThanOrEqual(0)
    }
  })
})
