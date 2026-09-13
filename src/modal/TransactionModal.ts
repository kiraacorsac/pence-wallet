import { App, Modal, Notice, setIcon } from 'obsidian'
import { Transaction, TransactionType, TransactionModalParams, PennyWalletConfig } from '../types'
import { WalletFile } from '../io/WalletFile'
import { dateToYearMonth } from '../utils'
import { t } from '../i18n'
import { parseAmountForEdit, getCategoryOptions as getCategoryOptionsFromState, validateTransactionForm, buildTransactionPayload, transferCurrencies, impliedRate, type TransactionFormState } from './transactionState'
import { baseCurrency, currencyDecimals, getCurrency, walletCurrency } from '../money'
import { buildTagInput } from './TagInput'
import { ConfirmModal } from './ConfirmModal'

export class TransactionModal extends Modal {
  protected walletFile: WalletFile
  private params: TransactionModalParams
  protected editingTx: Transaction | null
  private editingYearMonth: string | null
  private onSuccess: (() => void) | null
  private onDismiss: (() => void) | null

  // Form state
  protected type: TransactionType = 'expense'
  protected date: string = ''       // yyyy-mm-dd
  protected wallet: string = ''
  protected fromWallet: string = ''
  protected toWallet: string = ''
  protected category: string = ''
  protected note: string = ''
  protected tags: string[] = []
  protected amount: string = ''
  protected toAmount: string = ''
  protected isRefund: boolean = false

  // DOM refs
  private typeTabsEl!: HTMLElement
  private fieldsEl!: HTMLElement
  protected errorEl!: HTMLElement
  private amountPrefixEl: HTMLElement | null = null
  private isConfirming = false
  private isDeleting = false

  constructor(
    app: App,
    walletFile: WalletFile,
    params: TransactionModalParams = {},
    editingTx: Transaction | null = null,
    editingYearMonth: string | null = null,
    onSuccess: (() => void) | null = null,
    onDismiss: (() => void) | null = null,
  ) {
    super(app)
    this.walletFile = walletFile
    this.params = params
    this.editingTx = editingTx
    this.editingYearMonth = editingYearMonth
    this.onSuccess = onSuccess
    this.onDismiss = onDismiss
  }

  onOpen() {
    const config = this.walletFile.getConfig()
    this.initState(config)
    this.buildUI(config)
  }

  protected initState(config: PennyWalletConfig) {
    if (this.editingTx) {
      const tx = this.editingTx
      this.type = tx.type
      // editingYearMonth is "yyyy-mm", tx.date is "MM/DD" e.g. "04/03"
      const ym = this.editingYearMonth ?? ''
      const day = tx.date.split('/')[1]
      this.date = ym && day ? `${ym}-${day}` : todayString()
      this.wallet = tx.wallet ?? ''
      this.fromWallet = tx.fromWallet ?? ''
      this.toWallet = tx.toWallet ?? ''
      this.category = tx.category ?? ''
      this.note = tx.note
      this.tags = tx.tags ? [...tx.tags] : []
      const parsed = parseAmountForEdit(tx.amount)
      this.amount = parsed.display
      this.toAmount = tx.amountTo != null ? String(tx.amountTo) : ''
      this.isRefund = parsed.isRefund
    } else {
      this.type = (this.params.type as TransactionType) ?? 'expense'
      this.date = this.params.date ?? todayString()
      const activeWallets = this.getActiveWallets(config)
      const defaultWallet = activeWallets.find(w => w.name === config.defaultWallet)
        ?? activeWallets[0]
      this.wallet = this.params.wallet ?? defaultWallet?.name ?? ''
      this.fromWallet = this.params.fromWallet ?? ''
      this.toWallet = this.params.toWallet ?? ''
      this.category = this.params.category ?? ''
      this.note = this.params.note ?? ''
      this.tags = this.params.tags ? [...this.params.tags] : []
      this.amount = this.params.amount != null ? String(this.params.amount) : ''
      this.toAmount = ''
    }
  }

  private buildUI(config: PennyWalletConfig) {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('pw-modal')

    const titleRow = contentEl.createDiv('pw-modal-title-row')
    const titleEl = titleRow.createEl('h2', {
      text: this.editingTx ? t('modal.editTitle') : t('modal.addTitle'),
    })
    if (this.editingTx) {
      const iconEl = titleEl.createSpan('pw-modal-title-icon')
      setIcon(iconEl, 'pencil')
    }

    this.typeTabsEl = contentEl.createDiv('pw-type-tabs')
    this.renderTypeTabs()

    this.fieldsEl = contentEl.createDiv('pw-fields')
    this.renderFields(config)

    this.errorEl = contentEl.createDiv('pw-error')
    this.errorEl.hide()

    const btnRow = contentEl.createDiv('pw-btn-row')
    if (this.editingTx) {
      const deleteBtn = btnRow.createEl('button', { text: t('ui.delete'), cls: 'pw-btn-delete' })
      deleteBtn.dataset['action'] = 'delete'
      deleteBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.handleDelete() })
      deleteBtn.addEventListener('click', () => this.handleDelete())
    }
    const confirmBtn = btnRow.createEl('button', { text: t('ui.confirm'), cls: 'mod-cta' })
    confirmBtn.dataset['action'] = 'confirm'
    const cancelBtn = btnRow.createEl('button', { text: t('ui.cancel') })
    cancelBtn.dataset['action'] = 'cancel'

    // touchend fires before blur (keyboard dismissal), preventing the double-tap issue on iOS
    confirmBtn.addEventListener('touchend', (e) => { e.preventDefault(); void this.handleConfirm() })
    cancelBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.close() })
    confirmBtn.addEventListener('click', () => { void this.handleConfirm() })
    cancelBtn.addEventListener('click', () => this.close())

    // Also fix Obsidian's built-in X close button
    const closeBtn = this.modalEl.querySelector<HTMLElement>('.modal-close-button')
    closeBtn?.addEventListener('touchend', (e) => { e.preventDefault(); this.close() })

    this.contentEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      this.close()
    })

    // Sync modal position with keyboard visibility:
    // - text/number input focused → keyboard opens → modal moves to top
    // - select/date focused → keyboard closes → modal returns to center
    this.contentEl.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')) {
        this.containerEl.addClass('pw-modal-keyboard-open')
      } else if (target instanceof HTMLSelectElement ||
                 (target instanceof HTMLInputElement && target.type === 'date')) {
        this.containerEl.removeClass('pw-modal-keyboard-open')
      }
    })
  }

  private renderTypeTabs() {
    this.typeTabsEl.empty()
    const types: TransactionType[] = ['expense', 'income', 'transfer']
    for (const tp of types) {
      const tab = this.typeTabsEl.createEl('button', {
        text: t(`label.type.${tp}`),
        cls: 'pw-type-tab' + (this.type === tp ? ' is-active' : ''),
      })
      tab.dataset['type'] = tp
    // Update active tab immediately on touch, rebuild after touch ends
      tab.addEventListener('touchend', (e) => {
        e.preventDefault()
        this.containerEl.removeClass('pw-modal-keyboard-open')
        this.resetStateForType(tp)
        Array.from(this.typeTabsEl.children).forEach((el, i) => {
          el.classList.toggle('is-active', types[i] === tp)
        })
        this.renderFields(this.walletFile.getConfig(), false)
        // Defer full tab rebuild until after touch sequence ends
        setTimeout(() => this.renderTypeTabs(), 50)
      })
      tab.addEventListener('click', () => {
        this.resetStateForType(tp)
        this.renderTypeTabs()
        this.renderFields(this.walletFile.getConfig(), false)
      })
    }
  }

  private renderFields(config: PennyWalletConfig, autoFocus = true) {
    this.fieldsEl.empty()
    this.amountPrefixEl = null

    // Refund row first (expense only) — sub-option of the type tab, visually adjacent.
    if (this.type === 'expense') {
      this.addRefundRow(this.fieldsEl)
    }

    // Date field (always shown)
    this.addField(this.fieldsEl, t('modal.date'), () => {
      const input = createEl('input', { type: 'date' })
      input.value = this.date
      input.addEventListener('change', () => { this.date = input.value })
      this.attachPickerTouch(input)
      return input
    })

    const activeWallets = this.getActiveWallets(config)
    const categories = this.getCategoryOptions(config)
    const isTransferOrPayment = this.type !== 'expense' && this.type !== 'income'
    const onCategoryChange = isTransferOrPayment
      ? (val: string) => { this.category = val; this.renderFields(config, false) }
      : (val: string) => { this.category = val }

    this.addField(this.fieldsEl, t('modal.category'), () =>
      this.buildSelect(
        categories.map(c => ({ value: c.key, label: c.label })),
        this.category,
        onCategoryChange
      ), true)

    if (this.type === 'expense' || this.type === 'income') {
      this.addField(this.fieldsEl, t('modal.wallet'), () => {
        return this.buildSelect(
          activeWallets.map(w => ({ value: w.name, label: this.walletLabel(w.name, config) })),
          this.wallet,
          val => { this.wallet = val; this.renderFields(config, false) }
        )
      }, true)

    } else {
      const fromWallets = activeWallets
      const toWallets = activeWallets

      this.addField(this.fieldsEl, t('modal.fromWallet'), () =>
        this.buildSelect(
          fromWallets.map(w => ({ value: w.name, label: this.walletLabel(w.name, config) })),
          this.fromWallet,
          val => { this.fromWallet = val; this.renderFields(config, false) }
        ), true)

      this.addField(this.fieldsEl, t('modal.toWallet'), () =>
        this.buildSelect(
          toWallets.map(w => ({ value: w.name, label: this.walletLabel(w.name, config) })),
          this.toWallet,
          val => { this.toWallet = val; this.renderFields(config, false) }
        ), true)
    }

    this.addField(this.fieldsEl, t('modal.tags'), () =>
      buildTagInput(this.tags, this.walletFile.getConfig().tags, (next) => { this.tags = next })
    )

    this.addField(this.fieldsEl, t('modal.note'), () => {
      const input = createEl('input', { type: 'text', placeholder: t('modal.note') })
      input.value = this.note
      input.setAttribute('enterkeyhint', 'done')
      input.addEventListener('input', () => { this.note = input.value })
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur() })
      return input
    })

    this.buildAmountRow(config, autoFocus)
  }

  /** Account name, annotated with its currency once more than one is in play. */
  protected walletLabel(name: string, config: PennyWalletConfig): string {
    const wallet = config.wallets.find(w => w.name === name)
    if (!wallet) return name
    const codes = new Set(this.getActiveWallets(config).map(w => walletCurrency(w, config)))
    if (codes.size < 2) return name
    return `${name} (${walletCurrency(wallet, config)})`
  }

  private buildAmountRow(config: PennyWalletConfig, autoFocus: boolean) {
    const { from, to, isCross } = transferCurrencies(this.getFormState(), config)

    const sentCode = this.type === 'transfer' ? from : this.currentAccountCurrency(config)
    const sentLabel = isCross ? t('modal.sentAmount') : t('modal.amount')

    const amountInput = this.buildAmountInput(sentLabel, sentCode, config, this.amount, (value) => {
      this.amount = value
      this.updateDesktopAmountPrefix()
      updateRate()
    }, true)

    let rateEl: HTMLElement | null = null
    let updateRate = () => { /* replaced below when a second amount exists */ }

    if (isCross) {
      this.buildAmountInput(t('modal.receivedAmount'), to, config, this.toAmount, (value) => {
        this.toAmount = value
        updateRate()
      }, false)

      const rateRow = this.fieldsEl.createDiv('pw-field-row')
      rateRow.createEl('label', { text: t('modal.exchangeRate'), cls: 'pw-field-label' })
      rateEl = rateRow.createDiv('pw-exchange-rate pw-field-input')

      updateRate = () => {
        if (!rateEl) return
        const rate = impliedRate(this.amount, this.toAmount)
        rateEl.textContent = rate === null
          ? '—'
          : `1 ${from} = ${rate.toFixed(4)} ${to}`
      }
      updateRate()
    }

    this.updateDesktopAmountPrefix()
    if (autoFocus) setTimeout(() => amountInput.focus(), 50) // wait for modal open animation to complete
  }

  /** One labelled amount field. `isSent` owns the refund prefix and submit-on-Enter. */
  private buildAmountInput(
    label: string,
    code: string,
    config: PennyWalletConfig,
    value: string,
    onInput: (value: string) => void,
    isSent: boolean,
  ): HTMLInputElement {
    const row = this.fieldsEl.createDiv('pw-field-row')
    row.createEl('label', { text: label, cls: 'pw-field-label' })
    const wrapper = row.createDiv('pw-amount-field-wrapper pw-field-input')

    if (isSent) {
      this.amountPrefixEl = wrapper.createSpan({ cls: 'pw-amount-prefix', text: '+' })
    } else {
      wrapper.createSpan({ cls: 'pw-amount-currency', text: getCurrency(code).symbol })
    }

    const dp = currencyDecimals(code, config)
    const input = wrapper.createEl('input', {
      type: 'number',
      placeholder: dp > 0 ? `0.${'0'.repeat(dp)}` : '0',
    })
    input.value = value
    input.setAttribute('min', '0')
    input.setAttribute('step', dp > 0 ? `0.${'0'.repeat(dp - 1)}1` : '1')
    input.setAttribute('enterkeyhint', 'done')
    input.addEventListener('input', () => { onInput(input.value) })
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (!input.value) {
        input.blur()
        return
      }
      void this.handleConfirm()
    })
    return input
  }

  /** Currency of the account this expense or income is booked against. */
  protected currentAccountCurrency(config: PennyWalletConfig): string {
    const wallet = config.wallets.find(w => w.name === this.wallet)
    return wallet ? walletCurrency(wallet, config) : baseCurrency(config)
  }

  private addField(container: HTMLElement, label: string, buildInput: () => HTMLElement, required = false) {
    const row = container.createDiv('pw-field-row')
    const labelEl = row.createEl('label', { text: label, cls: 'pw-field-label' })
    if (required) labelEl.createEl('span', { text: '*', cls: 'pw-field-required', attr: { 'aria-hidden': 'true' } })
    const input = buildInput()
    input.addClass('pw-field-input')
    if (input instanceof HTMLSelectElement) {
      const wrapper = row.createDiv('pw-select-wrapper')
      wrapper.appendChild(input)
      return
    }
    row.appendChild(input)
  }

  private addRefundRow(container: HTMLElement) {
    const block = container.createDiv('pw-refund-block')
    const row = block.createDiv('pw-field-row pw-refund-row')
    row.setAttribute('title', t('modal.isRefund.hint'))
    const checkboxId = 'pw-refund-checkbox'
    row.createEl('label', { text: t('modal.isRefund'), cls: 'pw-field-label', attr: { for: checkboxId } })
    const checkbox = createEl('input', { type: 'checkbox' })
    checkbox.id = checkboxId
    checkbox.checked = this.isRefund
    checkbox.addClass('pw-field-input')
    checkbox.addEventListener('change', () => {
      this.isRefund = checkbox.checked
      this.updateDesktopAmountPrefix()
    })
    row.appendChild(checkbox)
  }

  private updateDesktopAmountPrefix() {
    if (!this.amountPrefixEl) return
    const shouldShow = this.isRefund && this.amount !== ''
    this.amountPrefixEl.toggleClass('is-visible', shouldShow)
  }

  private attachPickerTouch(el: HTMLElement) {
    el.addEventListener('touchstart', () => {
      this.containerEl.removeClass('pw-modal-keyboard-open')
    }, { passive: true })
  }

  private buildSelect(
    options: { value: string; label: string }[],
    current: string,
    onChange: (val: string) => void
  ): HTMLSelectElement {
    const sel = createEl('select')
    sel.createEl('option', { text: '—', value: '' })
    for (const { value, label } of options) {
      const opt = sel.createEl('option', { text: label, value })
      if (value === current) opt.selected = true
    }
    sel.addEventListener('change', () => onChange(sel.value))
    this.attachPickerTouch(sel)
    return sel
  }

  protected getActiveWallets(config: PennyWalletConfig) {
    return config.wallets.filter(w => w.status === 'active')
  }

  protected resetStateForType(newType: TransactionType): void {
    this.type = newType
    if (newType !== 'expense') this.isRefund = false
    if (newType === 'expense' || newType === 'income') {
      this.fromWallet = ''
      this.toWallet = ''
      this.toAmount = ''
    } else {
      this.wallet = ''
    }
    const config = this.walletFile.getConfig()
    const validCategories = getCategoryOptionsFromState(config, newType)
    if (this.category && !validCategories.some(c => c.key === this.category)) {
      this.category = ''
    }
  }

  protected getCategoryOptions(config: PennyWalletConfig): { key: string; label: string }[] {
    return getCategoryOptionsFromState(config, this.type)
  }



  protected showError(msg: string) {
    this.errorEl.textContent = msg
    this.errorEl.show()
  }

  protected clearError() {
    this.errorEl.hide()
  }

  protected getFormState(): TransactionFormState {
    return {
      date: this.date,
      type: this.type,
      wallet: this.wallet,
      fromWallet: this.fromWallet,
      toWallet: this.toWallet,
      category: this.category,
      note: this.note,
      tags: this.tags,
      amount: this.amount,
      toAmount: this.toAmount,
      isRefund: this.isRefund,
    }
  }

  private validate(): boolean {
    this.clearError()
    const result = validateTransactionForm(this.getFormState(), this.walletFile.getConfig())
    if (!result.ok) {
      this.showError(t(result.errorKey))
      return false
    }
    return true
  }

  protected handleDelete(): void {
    if (this.isDeleting) return
    if (!this.editingTx || !this.editingYearMonth) return
    const tx = this.editingTx
    const ym = this.editingYearMonth
    const confirm = new ConfirmModal(this.app, t('confirm.deleteTransaction'), async () => {
      this.isDeleting = true
      try {
        await this.walletFile.deleteTransaction(tx, ym)
        this.close()
        this.onSuccess?.()
        new Notice(t('notice.transactionDeleted'))
      } catch (e) {
        this.showError(String(e))
      } finally {
        this.isDeleting = false
      }
    })
    confirm.open()
  }

  protected async handleConfirm() {
    if (this.isConfirming) return
    if (!this.validate()) return
    this.isConfirming = true

    const newTx = buildTransactionPayload(this.getFormState(), this.walletFile.getConfig())
    const newYearMonth = dateToYearMonth(this.date)

    try {
      if (this.editingTx && this.editingYearMonth) {
        await this.walletFile.updateTransaction(
          this.editingTx, this.editingYearMonth,
          newTx, newYearMonth,
        )
      } else {
        await this.walletFile.writeTransaction(newTx, newYearMonth)
      }

      this.close()
      this.onSuccess?.()
      new Notice(t(this.editingTx ? 'notice.transactionUpdated' : 'notice.transactionAdded'))
    } catch (e) {
      this.showError(String(e))
    } finally {
      this.isConfirming = false
    }
  }

  onClose() {
    this.containerEl.removeClass('pw-modal-keyboard-open')
    this.contentEl.empty()
    this.onDismiss?.()
  }
}

export function todayString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
