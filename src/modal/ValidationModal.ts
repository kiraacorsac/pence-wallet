import { App, Modal, Notice } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import type { ValidationIssue } from '../types'
import { t, tn } from '../i18n'
import { formatMoneyMap, formatQuantity } from '../money'

export class ValidationModal extends Modal {
  private issues: ValidationIssue[]
  private walletFile: WalletFile

  constructor(app: App, walletFile: WalletFile, issues: ValidationIssue[]) {
    super(app)
    this.walletFile = walletFile
    this.issues = issues
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('pw-validation-modal')

    // Header: [X] [title] [spacer]
    const header = contentEl.createDiv('pw-validation-header')
    const closeBtn = header.createDiv('pw-validation-close-btn')
    closeBtn.setText('✕')
    closeBtn.addEventListener('click', () => this.close())
    header.createEl('h2', { text: t('validation.modalTitle'), cls: 'pw-validation-title' })
    header.createDiv('pw-validation-header-spacer')

    // Content
    const content = contentEl.createDiv('pw-validation-content')
    this.renderIssues(content)

    // Divider + footer
    contentEl.createDiv('pw-validation-divider')
    const footer = contentEl.createDiv('pw-validation-footer')
    const fixAllBtn = footer.createEl('button', {
      text: t('validation.fixAll'),
      cls: 'pw-validation-fix-all-btn',
    })
    fixAllBtn.addEventListener('click', () => void this.fixAll())
  }

  private renderIssues(container: HTMLElement) {
    const frontmatterIssues = this.issues.filter(i => i.type === 'frontmatter')
    const orphanIssues = this.issues.filter(i => i.type === 'orphanedWallet')

    const config = this.walletFile.getConfig()

    if (frontmatterIssues.length > 0) {
      const sectionA = container.createDiv('pw-validation-section')
      sectionA.createEl('span', { text: t('validation.frontmatterSection'), cls: 'pw-validation-section-label' })
      for (const issue of frontmatterIssues) {
        if (issue.type !== 'frontmatter') continue
        const card = sectionA.createDiv('pw-validation-card')
        card.createEl('p', {
          text: tn('validation.frontmatterDesc', {
            month: issue.yearMonth,
            actualIncome: formatMoneyMap(issue.actualIncome, config),
            storedIncome: formatMoneyMap(issue.storedIncome, config),
            actualExpense: formatMoneyMap(issue.actualExpense, config),
            storedExpense: formatMoneyMap(issue.storedExpense, config),
          }),
          cls: 'pw-validation-card-text',
        })
        const cardFooter = card.createDiv('pw-validation-card-footer')
        const btn = cardFooter.createEl('button', { text: t('validation.fix'), cls: 'pw-validation-fix-btn' })
        btn.addEventListener('click', () => void (async () => {
          await this.walletFile.recalculateFrontmatter(issue.yearMonth)
          btn.setText('✓')
          btn.disabled = true
        })())
      }
    }

    if (orphanIssues.length > 0) {
      const sectionB = container.createDiv('pw-validation-section')
      sectionB.createEl('span', { text: t('validation.orphanSection'), cls: 'pw-validation-section-label' })
      const activeWallets = this.walletFile.getConfig().wallets.filter(w => w.status === 'active')
      for (const issue of orphanIssues) {
        if (issue.type !== 'orphanedWallet') continue
        const card = sectionB.createDiv('pw-validation-card')
        card.createEl('p', {
          text: tn('validation.orphanDesc', {
            wallet: issue.walletName,
            count: String(issue.transactionCount),
            months: issue.yearMonths.join(', '),
          }),
          cls: 'pw-validation-card-text',
        })
        const actions = card.createDiv('pw-validation-card-actions')
        const select = actions.createEl('select', { cls: 'pw-validation-remap-select' })
        select.createEl('option', { value: '', text: `— ${t('validation.remapTo')} —` })
        for (const w of activeWallets) {
          select.createEl('option', { value: w.name, text: w.name })
        }
        const fixBtn = actions.createEl('button', { text: t('validation.fix'), cls: 'pw-validation-fix-btn' })
        fixBtn.addEventListener('click', () => void (async () => {
          const remapTarget = select.value
          if (remapTarget) {
            await this.walletFile.renameWalletInTransactions(issue.walletName, remapTarget)
          } else {
            await this.walletFile.repairOrphanedWallet(issue.walletName)
          }
          fixBtn.setText('✓')
          fixBtn.disabled = true
          select.disabled = true
        })())
      }
    }

    const ledgerIssues = this.issues.filter(i => i.type === 'orphanedLedger' || i.type === 'negativeHolding')
    if (ledgerIssues.length > 0) {
      const sectionC = container.createDiv('pw-validation-section')
      sectionC.createEl('span', { text: t('validation.ledgerSection'), cls: 'pw-validation-section-label' })
      for (const issue of ledgerIssues) {
        const card = sectionC.createDiv('pw-validation-card')
        if (issue.type === 'negativeHolding') {
          // Only the trades themselves can say which row is wrong, so there is no fix.
          card.createEl('p', {
            text: tn('validation.negativeHoldingDesc', {
              wallet: issue.walletName,
              symbol: issue.symbol,
              quantity: formatQuantity(issue.quantity),
              date: issue.date,
              path: this.walletFile.ledgerPath(issue.walletName),
            }),
            cls: 'pw-validation-card-text',
          })
          continue
        }
        if (issue.type !== 'orphanedLedger') continue
        card.createEl('p', {
          text: tn('validation.orphanLedgerDesc', { path: issue.path, count: String(issue.tradeCount) }),
          cls: 'pw-validation-card-text',
        })
        if (!this.walletFile.canRepairOrphanedLedger(issue)) {
          card.createEl('p', { text: t('validation.orphanLedgerManual'), cls: 'pw-validation-card-text' })
          continue
        }
        card.createEl('p', {
          text: tn('validation.orphanLedgerFix', { wallet: issue.accountName ?? '' }),
          cls: 'pw-validation-card-text',
        })
        const cardFooter = card.createDiv('pw-validation-card-footer')
        const btn = cardFooter.createEl('button', { text: t('validation.fix'), cls: 'pw-validation-fix-btn' })
        btn.addEventListener('click', () => void (async () => {
          await this.walletFile.repairOrphanedLedger(issue.path)
          btn.setText('✓')
          btn.disabled = true
        })())
      }
    }
  }

  private async fixAll() {
    let count = 0
    for (const issue of this.issues) {
      if (issue.type === 'frontmatter') {
        await this.walletFile.recalculateFrontmatter(issue.yearMonth)
        count++
      } else if (issue.type === 'orphanedWallet') {
        await this.walletFile.repairOrphanedWallet(issue.walletName)
        count++
      } else if (issue.type === 'orphanedLedger') {
        if (await this.walletFile.repairOrphanedLedger(issue.path)) count++
      }
    }
    new Notice(tn('validation.repaired', { count: String(count) }))
    this.close()
  }

  onClose() {
    this.contentEl.empty()
  }
}
