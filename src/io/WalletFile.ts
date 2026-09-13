import { App, TFile, normalizePath } from 'obsidian'
import {
  Transaction,
  TransactionType,
  WalletBalance,
  MonthSummary,
  PennyWalletConfig,
  PennyWalletOptions,
  SettingsStore,
  DEFAULT_CONFIG,
} from '../types'
import type { Wallet, FrontmatterIssue, OrphanedWalletIssue, ValidationIssue } from '../types'
import { seedDefaultCategories } from '../i18n'
import { baseCurrency, moneyMapsEqual, toBase, walletCurrency } from '../money'

const TABLE_HEADER = `| Date | Type | Wallet | From | To | Category | Note | Tags | Amount | AmountTo | CreatedAt |
|------|------|--------|------|----|----------|------|------|--------|----------|-----------|`

// ─── Markdown Table Parsing ───────────────────────────────────────────────────

/**
 * Accepts both the 11-column layout and the 10-column one written before
 * AmountTo existed, so a vault is readable without being rewritten.
 */
export function parseRow(line: string): Transaction | null {
  const cols = line.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
  // date type wallet from to category note tags amount [amountTo] createdAt
  if (cols.length !== 10 && cols.length !== 11) return null
  const [date, type, wallet, fromWallet, toWallet, category, note, tagsStr, amountStr] = cols
  const amountToStr = cols.length === 11 ? cols[9] : '-'
  const createdAtStr = cols.length === 11 ? cols[10] : cols[9]
  if (!date || !type) return null

  const amount = parseFloat(amountStr)
  if (isNaN(amount)) return null

  const amountTo = (amountToStr && amountToStr !== '-') ? parseFloat(amountToStr) : NaN

  return {
    date,
    type: type as TransactionType,
    wallet:     wallet     === '-' ? undefined : wallet,
    fromWallet: fromWallet === '-' ? undefined : fromWallet,
    toWallet:   toWallet   === '-' ? undefined : toWallet,
    category:   category === '-' ? undefined : category,
    note:       note       === '-' ? '' : note,
    tags:       (tagsStr && tagsStr !== '-') ? tagsStr.split(',').filter(t => t.length > 0) : undefined,
    amount,
    amountTo:   isNaN(amountTo) ? undefined : amountTo,
    createdAt:  (createdAtStr && createdAtStr !== '-') ? createdAtStr : undefined,
  }
}

export function formatRow(tx: Transaction): string {
  const d = tx.date
  const type = tx.type
  const wallet = tx.wallet ?? '-'
  const from = tx.fromWallet ?? '-'
  const to = tx.toWallet ?? '-'
  const cat = tx.category ?? '-'
  const note = tx.note || '-'
  const tags = tx.tags?.length ? tx.tags.join(',') : '-'
  const amount = tx.amount
  const amountTo = tx.amountTo ?? '-'
  const createdAt = tx.createdAt ?? '-'
  return `| ${d} | ${type} | ${wallet} | ${from} | ${to} | ${cat} | ${note} | ${tags} | ${amount} | ${amountTo} | ${createdAt} |`
}

export function parseMonthFile(content: string): Transaction[] {
  const lines = content.split('\n')
  const transactions: Transaction[] = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    // Match both English and Chinese table headers
    if (!inTable && (trimmed.startsWith('| Date') || trimmed.startsWith('| 日期'))) {
      inTable = true
      continue
    }
    if (inTable && trimmed.startsWith('|---')) continue
    if (inTable && trimmed.startsWith('|')) {
      const tx = parseRow(trimmed)
      if (tx) transactions.push(tx)
    } else if (inTable && trimmed === '') {
      // empty line ends the table; stop parsing entirely
      break
    }
  }
  return transactions
}

/**
 * Totals are stored per currency as `income.GBP: 3100`. A bare `income:` key is
 * how every file written before multi-currency looks; it is read as the base
 * currency, which is exactly right for a vault that had only one until now.
 */
export function parseFrontmatter(content: string, baseCurrencyCode: string): Partial<MonthSummary> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const income = new Map<string, number>()
  const expense = new Map<string, number>()
  let netAsset: number | undefined

  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = parseFloat(line.slice(idx + 1).trim())
    if (!key || isNaN(value)) continue

    if (key === 'netAsset') netAsset = value
    else if (key === 'income') income.set(baseCurrencyCode, value)
    else if (key === 'expense') expense.set(baseCurrencyCode, value)
    else if (key.startsWith('income.')) income.set(key.slice('income.'.length), value)
    else if (key.startsWith('expense.')) expense.set(key.slice('expense.'.length), value)
  }

  return { income, expense, netAsset }
}

function frontmatterLines(prefix: string, amounts: Map<string, number>): string {
  return [...amounts.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, amount]) => `${prefix}.${code}: ${amount}\n`)
    .join('')
}

export function buildMonthContent(yearMonth: string, transactions: Transaction[], summary: MonthSummary): string {
  const frontmatter = '---\n'
    + frontmatterLines('income', summary.income)
    + frontmatterLines('expense', summary.expense)
    + `netAsset: ${summary.netAsset}\n---\n`
  const heading = `\n## ${yearMonth}\n\n`
  const rows = transactions.map(formatRow).join('\n')
  return frontmatter + heading + TABLE_HEADER + (rows ? '\n' + rows : '') + '\n'
}

// ─── Validation Helpers (pure functions) ─────────────────────────────────────

/**
 * Compares per-currency totals, so the check stays exact and is unaffected by
 * later edits to the exchange-rate table.
 */
export function detectFrontmatterIssues(
  yearMonth: string,
  transactions: Transaction[],
  stored: { income: Map<string, number>; expense: Map<string, number> },
  currencyOf: (tx: Transaction) => string,
): FrontmatterIssue[] {
  const actualIncome = new Map<string, number>()
  const actualExpense = new Map<string, number>()
  for (const tx of transactions) {
    const target = tx.type === 'income' ? actualIncome : tx.type === 'expense' ? actualExpense : null
    if (!target) continue
    const code = currencyOf(tx)
    target.set(code, (target.get(code) ?? 0) + tx.amount)
  }
  if (moneyMapsEqual(actualIncome, stored.income) && moneyMapsEqual(actualExpense, stored.expense)) return []
  return [{
    type: 'frontmatter',
    yearMonth,
    storedIncome: stored.income,
    storedExpense: stored.expense,
    actualIncome,
    actualExpense,
  }]
}

export function detectOrphanedWallets(
  monthData: Map<string, Transaction[]>,
  wallets: Wallet[],
): OrphanedWalletIssue[] {
  const knownNames = new Set(wallets.map(w => w.name))
  const orphanMap = new Map<string, { count: number; months: Set<string> }>()

  for (const [ym, txs] of monthData) {
    for (const tx of txs) {
      for (const name of [tx.wallet, tx.fromWallet, tx.toWallet]) {
        if (!name || knownNames.has(name)) continue
        if (!orphanMap.has(name)) orphanMap.set(name, { count: 0, months: new Set() })
        const entry = orphanMap.get(name)!
        entry.count++
        entry.months.add(ym)
      }
    }
  }

  return [...orphanMap.entries()].map(([walletName, { count, months }]) => ({
    type: 'orphanedWallet' as const,
    walletName,
    transactionCount: count,
    yearMonths: [...months].sort(),
  }))
}

// ─── WalletFile class ─────────────────────────────────────────────────────────

function txDateOrder(a: Transaction, b: Transaction): number {
  const d = a.date.localeCompare(b.date)
  return d !== 0 ? d : (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
}

export class WalletFile {
  private app: App
  private store: SettingsStore
  private config: PennyWalletConfig = { ...DEFAULT_CONFIG }
  private createdDefaultConfigOnLastLoad = false

  constructor(app: App, store: SettingsStore) {
    this.app = app
    this.store = store
  }

  get folderName(): string {
    return this.config.folderName
  }

  // ── Config ──────────────────────────────────────────────────────────────────

  async loadConfig(): Promise<PennyWalletConfig> {
    this.createdDefaultConfigOnLastLoad = false

    let parsed: Partial<PennyWalletConfig> | null = null
    let readFailed = false
    try {
      const raw = await this.store.loadData()
      if (raw && typeof raw === 'object') parsed = raw as Partial<PennyWalletConfig>
    } catch {
      readFailed = true
    }

    // Unreadable store: fall back in memory, but never overwrite what is on disk.
    if (readFailed) {
      this.config = { ...DEFAULT_CONFIG, options: { categories: seedDefaultCategories() } }
      return this.config
    }

    if (!parsed) {
      // First launch: locale-aware default config, persisted immediately.
      await this.ensureFolder()
      const cashName = this.getLocaleCashName()
      this.config = {
        ...DEFAULT_CONFIG,
        wallets: [{ ...DEFAULT_CONFIG.wallets[0], name: cashName }],
        defaultWallet: cashName,
        // New vaults follow each currency's own convention. DEFAULT_CONFIG keeps
        // 0 because it also back-fills vaults that predate the setting, and those
        // must keep rendering exactly as they did.
        decimalPlaces: 'auto',
        options: { categories: seedDefaultCategories() },
      }
      await this.saveConfig()
      this.createdDefaultConfigOnLastLoad = true
      return this.config
    }

    this.config = { ...DEFAULT_CONFIG, ...parsed, options: this.normalizeOptions(parsed) }
    return this.config
  }

  didCreateDefaultConfigOnLastLoad(): boolean {
    return this.createdDefaultConfigOnLastLoad
  }

  updateCategories(type: 'expense' | 'income' | 'transfer', categories: string[]): void {
    const { options } = this.config
    this.config = {
      ...this.config,
      options: {
        ...options,
        categories: { ...options.categories, [type]: categories },
      },
    }
  }

  /**
   * A missing category list falls back to the seed; an empty one is left empty,
   * since removing every category is a legitimate state.
   */
  private normalizeOptions(parsed: Partial<PennyWalletConfig>): PennyWalletOptions {
    const stored = parsed.options?.categories
    const categories = seedDefaultCategories()

    for (const bucket of ['expense', 'income', 'transfer'] as const) {
      if (Array.isArray(stored?.[bucket])) categories[bucket] = [...stored[bucket]]
    }

    return { categories }
  }

  private mergeTags(newTags: string[]): void {
    if (!newTags.length) return
    const existing = new Set(this.config.tags)
    for (const tag of newTags) {
      existing.add(tag)
    }
    this.config = { ...this.config, tags: [...existing].sort() }
  }

  async addTag(name: string): Promise<{ ok: true } | { ok: false, reason: 'empty' | 'duplicate' }> {
    const trimmed = name.trim().replace(/^#/, '').trim()
    if (!trimmed) return { ok: false, reason: 'empty' }
    if (this.config.tags.includes(trimmed)) return { ok: false, reason: 'duplicate' }
    this.config = { ...this.config, tags: [...this.config.tags, trimmed].sort() }
    await this.saveConfig()
    return { ok: true }
  }

  async saveConfig(): Promise<void> {
    await this.store.saveData(this.config)
  }

  getConfig(): PennyWalletConfig {
    return this.config
  }

  updateConfig(patch: Partial<PennyWalletConfig>): void {
    this.config = { ...this.config, ...patch }
  }

  // ── Month file helpers ───────────────────────────────────────────────────────

  private monthFilePath(yearMonth: string): string {
    return normalizePath(`${this.config.folderName}/${yearMonth}.md`)
  }

  // List month files within the plugin folder only (avoids enumerating the whole vault).
  private listMonthFiles(): TFile[] {
    const folder = this.app.vault.getFolderByPath(this.config.folderName)
    if (!folder) return []
    return folder.children.filter((f): f is TFile =>
      f instanceof TFile &&
      f.extension === 'md' &&
      /^\d{4}-\d{2}$/.test(f.basename),
    )
  }

  private async ensureFolder(): Promise<void> {
    const folder = this.config.folderName
    if (!this.app.vault.getFolderByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder)
      } catch (e: unknown) {
        // Ignore "Folder already exists" error from race condition
        if (!(e instanceof Error) || !e.message?.includes('already exists')) {
          throw e
        }
      }
    }
  }

  private async readMonthFile(yearMonth: string): Promise<string | null> {
    const path = this.monthFilePath(yearMonth)
    const file = this.app.vault.getFileByPath(path)
    if (file) {
      return await this.app.vault.read(file)
    }
    return null
  }

  private async writeMonthFile(yearMonth: string, content: string): Promise<void> {
    await this.ensureFolder()
    const path = this.monthFilePath(yearMonth)
    await this.vaultWrite(path, content)
  }

  private async vaultWrite(path: string, content: string): Promise<void> {
    const file = this.app.vault.getFileByPath(path)
    if (file) {
      await this.app.vault.process(file, () => content)
      return
    }
    try {
      await this.app.vault.create(path, content)
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message?.includes('already exists')) throw e
      const retryFile = this.app.vault.getFileByPath(path)
      if (retryFile) {
        await this.app.vault.process(retryFile, () => content)
      }
    }
  }

  // ── Read Transactions ────────────────────────────────────────────────────────

  async readMonth(yearMonth: string): Promise<Transaction[]> {
    const content = await this.readMonthFile(yearMonth)
    if (!content) return []
    return parseMonthFile(content)
  }

  async readMonthSummary(yearMonth: string): Promise<MonthSummary | null> {
    const content = await this.readMonthFile(yearMonth)
    if (!content) return null
    const fm = parseFrontmatter(content, baseCurrency(this.config))
    // netAsset is always written, so its absence is what marks an uncached month.
    if (fm.netAsset === undefined) return null
    return { income: fm.income ?? new Map<string, number>(), expense: fm.expense ?? new Map<string, number>(), netAsset: fm.netAsset }
  }

  // ── Write / Edit / Delete ────────────────────────────────────────────────────

  /**
   * Write a new transaction. `tx.date` must be "MM/DD" format.
   * `yearMonth` is "yyyy-mm".
   */
  async writeTransaction(tx: Transaction, yearMonth: string): Promise<void> {
    const content = await this.readMonthFile(yearMonth)
    const transactions = content ? parseMonthFile(content) : []
    transactions.push({ ...tx, createdAt: tx.createdAt ?? new Date().toISOString() })
    transactions.sort(txDateOrder)
    if (tx.tags?.length) {
      this.mergeTags(tx.tags)
      await this.saveConfig()
    }
    const summary = this.computeSummary(transactions)
    await this.writeMonthFile(yearMonth, buildMonthContent(yearMonth, transactions, summary))
  }

  /**
   * Update an existing transaction. Handles cross-month moves automatically.
   * `oldYearMonth` and `newYearMonth` are "yyyy-mm".
   */
  async updateTransaction(
    oldTx: Transaction,
    oldYearMonth: string,
    newTx: Transaction,
    newYearMonth: string,
  ): Promise<void> {
    if (oldYearMonth === newYearMonth) {
      // Same month: replace in-place
      const content = await this.readMonthFile(oldYearMonth)
      const transactions = content ? parseMonthFile(content) : []
      const idx = this.findTransactionIndex(transactions, oldTx)
      if (idx !== -1) transactions[idx] = { ...newTx, createdAt: newTx.createdAt ?? oldTx.createdAt ?? new Date().toISOString() }
      transactions.sort(txDateOrder)
      if (newTx.tags?.length) {
        this.mergeTags(newTx.tags)
        await this.saveConfig()
      }
      const summary = this.computeSummary(transactions)
      await this.writeMonthFile(oldYearMonth, buildMonthContent(oldYearMonth, transactions, summary))
    } else {
      // Cross-month: delete from old, insert into new
      await this.deleteTransactionFromMonth(oldTx, oldYearMonth)
      await this.writeTransaction(newTx, newYearMonth)
    }
  }

  async deleteTransaction(tx: Transaction, yearMonth: string): Promise<void> {
    await this.deleteTransactionFromMonth(tx, yearMonth)
  }

  async renameWalletInTransactions(oldName: string, newName: string): Promise<void> {
    const months = this.getAllYearMonths()
    await Promise.all(months.map(async (ym) => {
      const content = await this.readMonthFile(ym)
      if (!content) return
      const transactions = parseMonthFile(content)
      const updated = transactions.map(tx => ({
        ...tx,
        wallet:     tx.wallet     === oldName ? newName : tx.wallet,
        fromWallet: tx.fromWallet === oldName ? newName : tx.fromWallet,
        toWallet:   tx.toWallet   === oldName ? newName : tx.toWallet,
      }))
      const hasChange = updated.some((tx, i) =>
        tx.wallet !== transactions[i].wallet ||
        tx.fromWallet !== transactions[i].fromWallet ||
        tx.toWallet !== transactions[i].toWallet,
      )
      if (!hasChange) return
      const summary = this.computeSummary(updated)
      await this.writeMonthFile(ym, buildMonthContent(ym, updated, summary))
    }))
  }

  private async deleteTransactionFromMonth(tx: Transaction, yearMonth: string): Promise<void> {
    const content = await this.readMonthFile(yearMonth)
    if (!content) return
    const transactions = parseMonthFile(content)
    const idx = this.findTransactionIndex(transactions, tx)
    if (idx !== -1) transactions.splice(idx, 1)
    const summary = this.computeSummary(transactions)
    await this.writeMonthFile(yearMonth, buildMonthContent(yearMonth, transactions, summary))
  }

  private findTransactionIndex(transactions: Transaction[], target: Transaction): number {
    return transactions.findIndex(tx =>
      tx.date === target.date &&
      tx.type === target.type &&
      tx.amount === target.amount &&
      (tx.amountTo ?? null) === (target.amountTo ?? null) &&
      tx.note === target.note &&
      (tx.wallet ?? '') === (target.wallet ?? '') &&
      (tx.fromWallet ?? '') === (target.fromWallet ?? '') &&
      (tx.toWallet ?? '') === (target.toWallet ?? '') &&
      (tx.category ?? '') === (target.category ?? '') &&
      (tx.tags ?? []).join(',') === (target.tags ?? []).join(',') &&
      (tx.createdAt === undefined || target.createdAt === undefined || tx.createdAt === target.createdAt),
    )
  }

  // ── Frontmatter Cache ────────────────────────────────────────────────────────

  /**
   * On plugin load: only recalculate months that are missing frontmatter.
   */
  async bootstrapFrontmatter(): Promise<void> {
    const files = this.listMonthFiles()
    if (files.length === 0) return

    for (const file of files) {
      const content = await this.app.vault.read(file)
      const fm = parseFrontmatter(content, baseCurrency(this.config))
      if (fm.netAsset === undefined) {
        const yearMonth = file.basename
        await this.recalculateFrontmatter(yearMonth)
      }
    }
  }

  /**
   * Recompute income/expense/netAsset for a given month and persist to frontmatter.
   */
  async recalculateFrontmatter(yearMonth: string): Promise<void> {
    const content = await this.readMonthFile(yearMonth)
    if (!content) return
    const transactions = parseMonthFile(content)
    const summary = this.computeSummary(transactions)
    await this.writeMonthFile(yearMonth, buildMonthContent(yearMonth, transactions, summary))
  }

  // ── Data Validation ──────────────────────────────────────────────────────────

  async validateAllData(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = []
    const files = this.listMonthFiles()

    const monthData = new Map<string, Transaction[]>()

    for (const file of files) {
      const content = await this.app.vault.read(file)
      const ym = file.basename
      const transactions = parseMonthFile(content)
      monthData.set(ym, transactions)

      const fm = parseFrontmatter(content, baseCurrency(this.config))
      if (fm.netAsset !== undefined) {
        const fmIssues = detectFrontmatterIssues(
          ym,
          transactions,
          { income: fm.income ?? new Map<string, number>(), expense: fm.expense ?? new Map<string, number>() },
          tx => this.txCurrency(tx),
        )
        issues.push(...fmIssues)
      }
    }

    const orphanIssues = detectOrphanedWallets(monthData, this.config.wallets)
    issues.push(...orphanIssues)

    return issues
  }

  async repairOrphanedWallet(walletName: string): Promise<void> {
    const already = this.config.wallets.find(w => w.name === walletName)
    if (already) return  // 已存在，不重複建立
    this.config = {
      ...this.config,
      wallets: [
        ...this.config.wallets,
        {
          name: walletName,
          type: 'bank',
          initialBalance: 0,
          status: 'archived',
          includeInNetAsset: false,
        },
      ],
    }
    await this.saveConfig()
  }

  // ── Net Asset & Wallet Balance Calculation ────────────────────────────────────

  /**
   * Compute the current balance of every wallet across all available months.
   */
  async calculateAllWalletBalances(): Promise<WalletBalance[]> {
    const { balances } = await this.calculateWalletData()
    return balances
  }

  async calculateWalletData(): Promise<{ balances: WalletBalance[]; walletsWithTransactions: Set<string> }> {
    const allMonths = this.getAllYearMonths()
    const monthTransactions = await Promise.all(allMonths.map(ym => this.readMonth(ym)))
    const allTransactions: Transaction[] = []
    for (const txs of monthTransactions) allTransactions.push(...txs)

    const walletsWithTransactions = new Set<string>()
    for (const tx of allTransactions) {
      if (tx.wallet)      walletsWithTransactions.add(tx.wallet)
      if (tx.fromWallet)  walletsWithTransactions.add(tx.fromWallet)
      if (tx.toWallet)    walletsWithTransactions.add(tx.toWallet)
    }

    return { balances: this.computeWalletBalances(allTransactions), walletsWithTransactions }
  }

  /** The currency an expense or income row is denominated in. */
  private txCurrency(tx: Transaction): string {
    const name = tx.wallet ?? tx.fromWallet
    const wallet = this.config.wallets.find(w => w.name === name)
    return wallet ? walletCurrency(wallet, this.config) : baseCurrency(this.config)
  }

  computeWalletBalances(transactions: Transaction[]): WalletBalance[] {
    const { wallets } = this.config

    const balanceMap = new Map<string, number>()
    for (const w of wallets) {
      balanceMap.set(w.name, w.initialBalance)
    }

    for (const tx of transactions) {
      this.applyTxToBalanceMap(tx, balanceMap)
    }

    return wallets.map(w => ({
      wallet: w,
      balance: balanceMap.get(w.name) ?? w.initialBalance,
      currency: walletCurrency(w, this.config),
    }))
  }

  /** Net worth in the base currency, priced at `yearMonth`'s rates. */
  computeNetAsset(walletBalances: WalletBalance[], yearMonth: string): number {
    let net = 0
    for (const { wallet, balance, currency } of walletBalances) {
      if (!wallet.includeInNetAsset) continue
      net += toBase(balance, currency, this.config, yearMonth)
    }
    return net
  }

  /** Net worth split by the currency it is actually held in. */
  netAssetByCurrency(walletBalances: WalletBalance[]): Map<string, number> {
    const result = new Map<string, number>()
    for (const { wallet, balance, currency } of walletBalances) {
      if (!wallet.includeInNetAsset) continue
      result.set(currency, (result.get(currency) ?? 0) + balance)
    }
    return result
  }

  // ── Summary for a single month ───────────────────────────────────────────────

  computeSummary(transactions: Transaction[]): MonthSummary {
    const income = new Map<string, number>()
    const expense = new Map<string, number>()
    for (const tx of transactions) {
      const target = tx.type === 'income' ? income : tx.type === 'expense' ? expense : null
      if (!target) continue
      const code = this.txCurrency(tx)
      target.set(code, (target.get(code) ?? 0) + tx.amount)
    }
    // netAsset in monthly frontmatter = approximation; Dashboard re-computes from walletBalances
    return { income, expense, netAsset: 0 }
  }

  /** Group transactions by category for pie chart, totalled in the base currency. */
  groupByCategory(transactions: Transaction[], type: 'expense' | 'income', yearMonth: string): Map<string, number> {
    const map = new Map<string, number>()
    for (const tx of transactions) {
      if (tx.type !== type) continue
      const key = tx.category ?? ''
      const value = toBase(tx.amount, this.txCurrency(tx), this.config, yearMonth)
      map.set(key, (map.get(key) ?? 0) + value)
    }
    return map
  }

  /** Per-wallet balance at each target month end, for every active account */
  async getWalletBalanceTrend(targetMonths: string[]): Promise<Map<string, Map<string, number>>> {
    const trackedWallets = this.config.wallets.filter(w => w.status === 'active')
    const allAvailableMonths = this.getAllYearMonths()
    const lastTarget = targetMonths[targetMonths.length - 1]
    const relevantMonths = allAvailableMonths.filter(m => m <= lastTarget).sort()
    const monthTransactions = await Promise.all(relevantMonths.map(ym => this.readMonth(ym)))

    const balanceMap = new Map<string, number>()
    for (const w of this.config.wallets) balanceMap.set(w.name, w.initialBalance)

    // result: walletName → (yearMonth → balance)
    const result = new Map<string, Map<string, number>>()
    for (const w of trackedWallets) result.set(w.name, new Map())

    for (let i = 0; i < relevantMonths.length; i++) {
      for (const tx of monthTransactions[i]) this.applyTxToBalanceMap(tx, balanceMap)
      if (targetMonths.includes(relevantMonths[i])) {
        for (const w of trackedWallets) {
          result.get(w.name)!.set(relevantMonths[i], balanceMap.get(w.name) ?? 0)
        }
      }
    }

    return result
  }

  async getCategoryTrend(yearMonths: string[], category: string): Promise<Map<string, number>> {
    const allTxs = await Promise.all(yearMonths.map(ym => this.readMonth(ym)))
    const result = new Map<string, number>()
    yearMonths.forEach((ym, i) => {
      const total = allTxs[i]
        .filter(tx => tx.category === category)
        .reduce((sum, tx) => sum + toBase(tx.amount, this.txCurrency(tx), this.config, ym), 0)
      result.set(ym, total)
    })
    return result
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  /** Check if a wallet name is used in any transaction */
  async walletHasTransactions(walletName: string): Promise<boolean> {
    const months = this.getAllYearMonths()
    for (const ym of months) {
      const txs = await this.readMonth(ym)
      const found = txs.some(tx =>
        tx.wallet === walletName ||
        tx.fromWallet === walletName ||
        tx.toWallet === walletName,
      )
      if (found) return true
    }
    return false
  }

  getAllYearMonths(): string[] {
    return this.listMonthFiles().map((f: TFile) => f.basename).sort()
  }

  /** Get all month summaries for trend view (reads frontmatter only) */
  async getMonthSummaries(yearMonths: string[]): Promise<Map<string, MonthSummary>> {
    const result = new Map<string, MonthSummary>()
    for (const ym of yearMonths) {
      const summary = await this.readMonthSummary(ym)
      if (summary) result.set(ym, summary)
    }
    return result
  }

  async getNetAssetTimeline(targetMonths: string[]): Promise<Map<string, number>> {
    const allAvailableMonths = this.getAllYearMonths()
    const lastTarget = targetMonths[targetMonths.length - 1]
    const relevantMonths = allAvailableMonths.filter(m => m <= lastTarget).sort()

    const monthTransactions = await Promise.all(relevantMonths.map(ym => this.readMonth(ym)))

    // Seed the balance map from each wallet's initialBalance
    const balanceMap = new Map<string, number>()
    for (const w of this.config.wallets) {
      balanceMap.set(w.name, w.initialBalance)
    }

    const result = new Map<string, number>()

    for (let i = 0; i < relevantMonths.length; i++) {
      for (const tx of monthTransactions[i]) {
        this.applyTxToBalanceMap(tx, balanceMap)
      }
      if (targetMonths.includes(relevantMonths[i])) {
        result.set(relevantMonths[i], this.computeNetAssetFromMap(balanceMap, relevantMonths[i]))
      }
    }

    return result
  }

  private applyTxToBalanceMap(tx: Transaction, map: Map<string, number>): void {
    const add = (name: string | undefined, amount: number) => {
      if (name && map.has(name)) map.set(name, (map.get(name) ?? 0) + amount)
    }
    switch (tx.type) {
      case 'expense':
        add(tx.wallet, -tx.amount)
        break
      case 'income':
        add(tx.wallet, tx.amount)
        break
      case 'transfer':
        // A cross-currency transfer credits what actually arrived, not what left.
        add(tx.fromWallet, -tx.amount)
        add(tx.toWallet, tx.amountTo ?? tx.amount)
        break
    }
  }

  private computeNetAssetFromMap(map: Map<string, number>, yearMonth: string): number {
    let net = 0
    for (const w of this.config.wallets) {
      if (!w.includeInNetAsset) continue
      net += toBase(map.get(w.name) ?? 0, walletCurrency(w, this.config), this.config, yearMonth)
    }
    return net
  }

  private getLocaleCashName(): string {
    try {
      const lang = (window as Window & { moment?: { locale?: () => string } }).moment?.locale?.() ?? ''
      if (lang.startsWith('zh')) return '預設錢包'
    } catch { /* ignore */ }
    return 'Default Wallet'
  }

}
