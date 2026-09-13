import { Events, ItemView, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, formatMonthLabel, formatYearMonth } from '../i18n'
import { formatAmount } from '../utils'
import { renderSharedHeader } from './SharedHeader'
import { Chart } from 'chart.js'
import { MonthData, drawNetChart, drawPie, getMonthRange } from './charts'
import { renderCard } from './components'

export const ASSET_VIEW_TYPE = 'penny-wallet-asset'

export class AssetView extends ItemView {
  private walletFile: WalletFile
  private range: number = 6
  private charts: Chart[] = []

  private clearCharts() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
  }

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
  }

  getViewType() { return ASSET_VIEW_TYPE }
  getDisplayText() { return t('asset.title') }
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
    const savedScroll = contentEl.scrollTop
    contentEl.empty()
    contentEl.addClass('pw-asset')

    const months = getMonthRange(this.range)

    const [walletBalances, summaries, netTimeline] = await Promise.all([
      this.walletFile.calculateAllWalletBalances(),
      this.walletFile.getMonthSummaries(months),
      this.walletFile.getNetAssetTimeline(months),
    ])

    const netAsset = this.walletFile.computeNetAsset(walletBalances)
    const dp = this.walletFile.getConfig().decimalPlaces ?? 0

    renderSharedHeader(contentEl, {
      view: this,
      walletFile: this.walletFile,
      activeView: 'asset',
      yearMonth: null,
    })

    // ── 2-column grid ────────────────────────────────────────────────────────
    const grid = contentEl.createDiv('pw-grid-2 pw-asset-grid')

    // ── Left column ─────────────────────────────────────────────────────────
    const leftCol = grid.createDiv('pw-asset-left')

    // Wallet balances card
    const walletCard = renderCard(leftCol, { title: t('dash.walletBalances') })
    const walletList = walletCard.createDiv('pw-wallet-list')

    for (const { wallet, balance } of walletBalances) {
      if (wallet.status === 'archived') continue
      const row = walletList.createDiv('pw-asset-wallet-row')
      const left = row.createDiv('pw-wallet-left')
      left.createEl('span', {
        text: t(`label.walletType.${wallet.type}`),
        cls: `pw-wallet-badge pw-badge-${wallet.type}`,
      })
      left.createEl('span', { text: wallet.name, cls: 'pw-wallet-name' })

      row.createEl('span', {
        text: formatAmount(Math.abs(balance), dp),
        cls: 'pw-wallet-balance' + (balance < 0 ? ' is-negative' : ''),
      })
    }

    const netRow = walletCard.createDiv('pw-asset-wallet-row pw-net-asset-row')
    netRow.createEl('span', { text: t('dash.netAsset'), cls: 'pw-net-label' })
    netRow.createEl('span', {
      text: formatAmount(Math.abs(netAsset), dp),
      cls: 'pw-net-value' + (netAsset < 0 ? ' is-negative' : ''),
    })

    // Asset allocation pie (≥2 positive-balance accounts)
    const assetMap = new Map<string, number>()
    for (const { wallet, balance } of walletBalances) {
      if (wallet.status === 'archived') continue
      if (balance > 0) assetMap.set(wallet.name, balance)
    }
    if (assetMap.size >= 2) {
      const assetCard = renderCard(leftCol, { title: t('dash.assetAllocation') })
      this.charts.push(drawPie(assetCard, assetMap, dp))
    }

    // ── Right column ─────────────────────────────────────────────────────────
    const rightCol = grid.createDiv('pw-asset-right')

    // Net asset trend card (with range picker inside)
    const netCard = renderCard(rightCol)  // no title — header row holds it
    const netCardHeader = netCard.createDiv('pw-card-header-row')
    netCardHeader.createEl('div', { text: t('asset.netAssetTrend'), cls: 'pw-card-title' })
    const rangeRow = netCardHeader.createDiv('pw-range-row')
    for (const r of [3, 6, 12]) {
      rangeRow.createEl('button', {
        text: t(`trend.${r}m` as 'trend.3m' | 'trend.6m' | 'trend.12m'),
        cls: 'pw-range-btn' + (this.range === r ? ' is-active' : ''),
      }).addEventListener('click', () => {
        this.range = r
        void this.render()
      })
    }

    const data: MonthData[] = months.map(ym => ({
      monthLabel: formatMonthLabel(ym),
      tooltipLabel: formatYearMonth(ym, 'short'),
      income: summaries.get(ym)?.income ?? 0,
      expense: summaries.get(ym)?.expense ?? 0,
      net: netTimeline.get(ym) ?? null,
    }))

    const netChartWrap = netCard.createDiv('pw-chart-wrap')
    this.charts.push(drawNetChart(netChartWrap, data, dp))
    contentEl.scrollTop = savedScroll
  }
}
