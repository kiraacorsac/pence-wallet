import { Events, ItemView, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, formatMonthLabel, formatYearMonth } from '../i18n'
import { currentYearMonth } from '../utils'
import { createMetric, renderCard } from './components'
import { TransactionType } from '../types'
import { DETAIL_VIEW_TYPE } from './DetailView'
import { renderSharedHeader } from './SharedHeader'
import { Chart } from 'chart.js'
import { MonthData, drawIncExpChart, drawPie, getMonthRangeEndingAt } from './charts'
import { baseCurrency, currencyDecimals, sumToBase } from '../money'

export const DASHBOARD_VIEW_TYPE = 'penny-wallet-dashboard'

export class DashboardView extends ItemView {
  private walletFile: WalletFile
  private currentYearMonth: string
  private charts: Chart[] = []

  private clearCharts() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
  }

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
    this.currentYearMonth = currentYearMonth()
  }

  getViewType() { return DASHBOARD_VIEW_TYPE }
  getDisplayText() { return t('dashboard.title') }
  getIcon() { return 'wallet' }

  async onOpen() {
    this.registerEvent(
      (this.app.workspace as Events).on('penny-wallet:refresh', () => { void this.render() })
    )
    this.registerEvent(
      (this.app.workspace as Events).on('css-change', () => { void this.render() })
    )
    await this.render()
  }

  onClose(): Promise<void> {
    this.clearCharts()
    this.contentEl.empty()
    return Promise.resolve()
  }

  async render() {
    const { contentEl } = this
    this.clearCharts()
    contentEl.empty()
    contentEl.addClass('pw-dashboard')

    const months = getMonthRangeEndingAt(this.currentYearMonth, 6)

    const [transactions, summaries, netTimeline] = await Promise.all([
      this.walletFile.readMonth(this.currentYearMonth),
      this.walletFile.getMonthSummaries(months),
      this.walletFile.getNetAssetTimeline(months),
    ])

    renderSharedHeader(contentEl, {
      view: this,
      walletFile: this.walletFile,
      activeView: 'dashboard',
      yearMonth: this.currentYearMonth,
      onMonthChange: (ym) => { this.currentYearMonth = ym; void this.render() },
    })

    const config = this.walletFile.getConfig()
    const dp = currencyDecimals(baseCurrency(config), config)

    // ── Monthly metrics ──────────────────────────────────────────────────────
    let monthIncome = 0, monthExpense = 0
    for (const tx of transactions) {
      if (tx.type === 'income') monthIncome += tx.amount
      if (tx.type === 'expense') monthExpense += tx.amount
    }
    const monthBalance = monthIncome - monthExpense

    const metricsEl = contentEl.createDiv('pw-metrics')
    createMetric(metricsEl, t('dash.income'),  monthIncome,  'income',  { dp })
    createMetric(metricsEl, t('dash.expense'), monthExpense, 'expense', { dp })
    createMetric(metricsEl, t('dash.balance'), monthBalance,
      monthBalance >= 0 ? 'positive' : 'negative',
      { dp, hero: true },
    )

    // ── 6-month bar chart ────────────────────────────────────────────────────
    const data: MonthData[] = months.map(ym => ({
      monthLabel: formatMonthLabel(ym),
      tooltipLabel: formatYearMonth(ym, 'short'),
      income: sumToBase(summaries.get(ym)?.income ?? new Map<string, number>(), config, ym),
      expense: sumToBase(summaries.get(ym)?.expense ?? new Map<string, number>(), config, ym),
      net: netTimeline.get(ym) ?? null,
    }))

    // ── 2-column grid: bar chart left, pie charts right ─────────────────────
    const grid2 = contentEl.createDiv('pw-grid-2')

    const incExpCard = renderCard(grid2, {
      title: t('trend.monthlyIncomeExpense'),
      className: 'pw-inc-exp-card',
    })
    const incExpChartWrap = incExpCard.createDiv('pw-chart-wrap')
    this.charts.push(drawIncExpChart(incExpChartWrap, data, dp))

    // ── Category pies ────────────────────────────────────────────────────────
    const gridRight = grid2.createDiv('pw-grid-right')

    const expenseMap = this.walletFile.groupByCategory(transactions, 'expense', this.currentYearMonth)
    const incomeMap  = this.walletFile.groupByCategory(transactions, 'income', this.currentYearMonth)

    const expCard = renderCard(gridRight, { title: t('dash.expenseByCategory') })
    if (expenseMap.size > 0) this.charts.push(drawPie(expCard, expenseMap, dp, (cat) => { void this.openDetailWithFilter('expense', cat) }, 200))
    else expCard.createEl('p', { text: t('dash.noData'), cls: 'pw-no-data' })

    const incCard = renderCard(gridRight, { title: t('dash.incomeByCategory') })
    if (incomeMap.size > 0) this.charts.push(drawPie(incCard, incomeMap, dp, (cat) => { void this.openDetailWithFilter('income', cat) }, 200))
    else incCard.createEl('p', { text: t('dash.noData'), cls: 'pw-no-data' })
  }

  private async openDetailWithFilter(type: TransactionType, category: string) {
    await this.openOrRevealView(DETAIL_VIEW_TYPE, {
      state: { yearMonth: this.currentYearMonth, filterType: type, filterCategory: category, resetFilters: true },
    })
  }

  private async openOrRevealView(type: string, options?: { state?: Record<string, unknown> }) {
    const existing = this.app.workspace.getLeavesOfType(type)
    const leaf = existing[0] ?? this.app.workspace.getLeaf('tab')

    await leaf.setViewState({
      type,
      active: true,
      state: options?.state,
    })

    void this.app.workspace.revealLeaf(leaf)
  }
}
