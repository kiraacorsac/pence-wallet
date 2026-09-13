import { App, Modal, Notice } from 'obsidian'
import { Wallet } from '../types'
import { t } from '../i18n'
import { CURRENCIES } from '../money'
import { ConfirmModal } from './ConfirmModal'

export interface WalletEditOptions {
  /** Currency to preselect for an account that predates the field. */
  fallbackCurrency: string
  /** Changing the currency of an account with history only reinterprets it. */
  hasTransactions: boolean
}

export class WalletEditModal extends Modal {
  private wallet: Wallet
  private onSave: (patch: Partial<Wallet>) => void | Promise<void>
  private name: string
  private balance: number
  private currency: string
  private options: WalletEditOptions

  constructor(
    app: App,
    wallet: Wallet,
    onSave: (patch: Partial<Wallet>) => void | Promise<void>,
    options: WalletEditOptions,
  ) {
    super(app)
    this.wallet = wallet
    this.onSave = onSave
    this.options = options
    this.name = wallet.name
    this.balance = wallet.initialBalance
    this.currency = wallet.currency || options.fallbackCurrency
  }

  onOpen() {
    const { contentEl, containerEl } = this
    containerEl.addClass('pw-wallet-edit-modal-container')
    contentEl.addClass('pw-modal')
    contentEl.createEl('h2', { text: t('ui.edit') })

    const formEl = contentEl.createDiv('pw-wallet-edit-form')
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    const syncKeyboardState = () => {
      if (!isTouchDevice) return
      const activeEl = document.activeElement
      const isEditingFieldFocused = !!activeEl && formEl.contains(activeEl)
      if (isEditingFieldFocused) {
        containerEl.setCssProps({ 'padding-bottom': '40vh' })
      } else {
        containerEl.style.removeProperty('padding-bottom')
      }
    }

    formEl.addEventListener('focusin', syncKeyboardState)
    formEl.addEventListener('focusout', () => window.requestAnimationFrame(syncKeyboardState))

    const nameRow = formEl.createDiv('pw-wallet-edit-field')
    nameRow.createEl('label', { text: t('settings.walletName'), cls: 'pw-wallet-edit-label' })
    const nameInput = nameRow.createEl('input', { type: 'text', cls: 'pw-field-input' })
    nameInput.value = this.name
    nameInput.setAttribute('enterkeyhint', 'done')
    nameInput.addEventListener('input', () => { this.name = nameInput.value.trim() })
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur() })

    const currencyRow = formEl.createDiv('pw-wallet-edit-field')
    currencyRow.createEl('label', { text: t('settings.walletCurrency'), cls: 'pw-wallet-edit-label' })
    const currencySelect = currencyRow.createEl('select', { cls: 'pw-field-input' })
    for (const c of CURRENCIES) currencySelect.createEl('option', { value: c.code, text: `${c.code} - ${c.symbol}` })
    if (!CURRENCIES.some(c => c.code === this.currency)) {
      currencySelect.createEl('option', { value: this.currency, text: this.currency })
    }
    currencySelect.value = this.currency
    currencySelect.addEventListener('change', () => { this.currency = currencySelect.value })

    const balanceRow = formEl.createDiv('pw-wallet-edit-field')
    balanceRow.createEl('label', { text: t('settings.initialBalance'), cls: 'pw-wallet-edit-label' })
    const balInput = balanceRow.createEl('input', { type: 'number', cls: 'pw-field-input' })
    balInput.value = String(this.balance)
    balInput.setAttribute('enterkeyhint', 'done')
    balInput.addEventListener('input', () => { this.balance = parseFloat(balInput.value) || 0 })
    balInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') balInput.blur() })

    formEl.createEl('p', {
      text: t('settings.balanceHint'),
      cls: 'pw-balance-hint pw-wallet-edit-hint',
    })

    const btnRow = contentEl.createDiv('pw-btn-row')
    const saveBtn = btnRow.createEl('button', { text: t('ui.save'), cls: 'mod-cta' })
    saveBtn.dataset['action'] = 'save'
    saveBtn.addEventListener('click', () => {
      if (!this.name) { new Notice(t('err.walletNameEmpty')); return }
      const patch: Partial<Wallet> = {
        name: this.name,
        initialBalance: this.balance,
        currency: this.currency,
      }
      const currencyChanged = this.currency !== (this.wallet.currency || this.options.fallbackCurrency)
      if (currencyChanged && this.options.hasTransactions) {
        // Stored amounts are re-read as the new currency, never converted.
        new ConfirmModal(this.app, t('confirm.changeCurrency'), () => {
          void this.onSave(patch)
        }).open()
        this.close()
        return
      }
      void this.onSave(patch)
      this.close()
    })
    const cancelBtn = btnRow.createEl('button', { text: t('ui.cancel') })
    cancelBtn.dataset['action'] = 'cancel'
    cancelBtn.addEventListener('click', () => this.close())
  }

  onClose() {
    this.containerEl.removeClass('pw-wallet-edit-modal-container')
    this.containerEl.style.removeProperty('padding-bottom')
    this.contentEl.empty()
  }
}
