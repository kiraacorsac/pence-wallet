import { Notice, ObsidianProtocolData, Platform, Plugin, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from './io/WalletFile'
import { RateSync } from './io/rateSync'
import { TransactionModal } from './modal/TransactionModal'
import { MobileTransactionModal } from './modal/MobileTransactionModal'
import { DashboardView, DASHBOARD_VIEW_TYPE } from './view/DashboardView'
import { DetailView, DETAIL_VIEW_TYPE } from './view/DetailView'
import { AssetView, ASSET_VIEW_TYPE } from './view/AssetView'
import { PennyWalletSettingTab } from './settings/SettingTab'
import { ValidationModal } from './modal/ValidationModal'
import { TransactionModalParams, TransactionType } from './types'
import { initI18n, t } from './i18n'

export default class PennyWalletPlugin extends Plugin {
  walletFile!: WalletFile
  rateSync!: RateSync

  async onload() {
    initI18n()

    this.walletFile = new WalletFile(this.app, this)
    this.rateSync = new RateSync(this.walletFile, this.app)

    // ── All synchronous registrations FIRST (so ribbon/commands survive restart) ──
    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this.walletFile))
    this.registerView(DETAIL_VIEW_TYPE, (leaf) => new DetailView(leaf, this.walletFile))
    this.registerView(ASSET_VIEW_TYPE, (leaf) => new AssetView(leaf, this.walletFile))

    this.addRibbonIcon('wallet', 'Penny wallet', () => { void this.openDashboard() })

    this.addCommand({ id: 'open-dashboard', name: 'Open finance overview', callback: () => { void this.openDashboard() } })
    this.addCommand({ id: 'open-asset', name: 'Open assets', callback: () => { void this.openAssetView() } })
    this.addCommand({ id: 'open-detail', name: 'Open transactions', callback: () => { void this.openDetailView() } })
    this.addCommand({ id: 'add-transaction', name: 'Add transaction', callback: () => this.openTransactionModal() })
    this.addCommand({ id: 'validate-data', name: 'Validate data', callback: () => void this.runValidation(true) })
    this.addCommand({ id: 'refresh', name: 'Refresh views', callback: () => {
      this.app.workspace.trigger('penny-wallet:refresh')
    } })
    this.addCommand({ id: 'open-settings', name: 'Open settings', callback: () => {
      const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting
      setting.open()
      setting.openTabById(this.manifest.id)
    } })

    this.addSettingTab(new PennyWalletSettingTab(this.app, this, this.walletFile, this.rateSync))

    // Hourly tick, so an Obsidian left open for days still refreshes its rates.
    // Nothing leaves the vault unless the user has opted in and a day has passed.
    this.registerInterval(window.setInterval(() => {
      void this.rateSync.syncIfDue()
    }, 60 * 60 * 1000))

    this.registerObsidianProtocolHandler('penny-wallet', (params: ObsidianProtocolData) => {
      this.handleURI(params)
    })

    // ── Async work AFTER all synchronous registrations ──
    try {
      await this.walletFile.loadConfig()
      await this.walletFile.bootstrapFrontmatter()

      // First-launch onboarding: only when config is created in this load
      if (this.walletFile.didCreateDefaultConfigOnLastLoad()) {
        new Notice(t('onboard.welcome'), 8000)
      }

      if (this.walletFile.getConfig().autoValidateOnLoad) {
        void this.runValidation(false)
      }

      // Not awaited: a slow or hanging request must never delay plugin load.
      void this.rateSync.syncIfDue()
    } catch (e) {
      console.error('PennyWallet: failed to load config', e)
      new Notice(t('notice.loadFailed'))
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  async runValidation(showNoticeIfClean: boolean) {
    const issues = await this.walletFile.validateAllData()
    if (issues.length === 0) {
      if (showNoticeIfClean) new Notice(t('notice.validationClean'))
      return
    }
    new ValidationModal(this.app, this.walletFile, issues).open()
  }

  // ── Open Views ──────────────────────────────────────────────────────────────

  async openDashboard() {
    await this.openOrRevealView(DASHBOARD_VIEW_TYPE)
  }

  async openDetailView(yearMonth?: string) {
    await this.openOrRevealView(DETAIL_VIEW_TYPE, yearMonth ? { yearMonth } : undefined)
  }

  async openAssetView() {
    await this.openOrRevealView(ASSET_VIEW_TYPE)
  }

  openTransactionModal(params: TransactionModalParams = {}) {
    const ModalClass = Platform.isMobile ? MobileTransactionModal : TransactionModal
    new ModalClass(
      this.app,
      this.walletFile,
      params,
      null,
      null,
      () => this.refreshViews(),
    ).open()
  }

  // ── URI Handler ─────────────────────────────────────────────────────────────

  private handleURI(data: ObsidianProtocolData) {
    const params: TransactionModalParams = {}

    if (data['type']) params.type = data['type'] as TransactionType
    if (data['amount']) {
      const amount = parseFloat(data['amount'])
      if (!Number.isNaN(amount)) params.amount = amount
    }
    if (data['note']) params.note = data['note']
    if (data['category']) params.category = data['category']
    if (data['wallet']) params.wallet = data['wallet']
    if (data['fromWallet']) params.fromWallet = data['fromWallet']
    if (data['toWallet']) params.toWallet = data['toWallet']
    if (data['date']) params.date = data['date']

    this.openTransactionModal(params)
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  private refreshViews() {
    // Refresh all open PennyWallet leaves
    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach((leaf: WorkspaceLeaf) => {
      void (leaf.view as DashboardView).render()
    })
    this.app.workspace.getLeavesOfType(DETAIL_VIEW_TYPE).forEach((leaf: WorkspaceLeaf) => {
      void (leaf.view as DetailView).render()
    })
    this.app.workspace.getLeavesOfType(ASSET_VIEW_TYPE).forEach((leaf: WorkspaceLeaf) => {
      void (leaf.view as AssetView).render()
    })
  }

  private async openOrRevealView(type: string, state?: Record<string, unknown>) {
    const existing = this.app.workspace.getLeavesOfType(type)
    const leaf = existing[0] ?? this.app.workspace.getLeaf('tab')

    await leaf.setViewState({
      type,
      active: true,
      state,
    })

    void this.app.workspace.revealLeaf(leaf)
  }
}
