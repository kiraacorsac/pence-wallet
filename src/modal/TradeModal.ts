import { App, Modal, Notice, setIcon } from 'obsidian'
import type { PennyWalletConfig, Trade, TradeAction, Wallet } from '../types'
import { WalletFile } from '../io/WalletFile'
import { t, tn } from '../i18n'
import { baseCurrency, formatPrice, formatQuantity, getCurrency, walletCurrency } from '../money'
import { findTradeIndex, normalizeSymbol, sharesHeldOn } from '../io/investments'
import { buildTradePayload, impliedSharePrice, knownSymbols, validateTradeForm, type TradeFormState } from './tradeState'
import { ConfirmModal } from './ConfirmModal'
import { todayString } from './TransactionModal'

export interface TradeModalParams {
  wallet?: string
  symbol?: string
  action?: TradeAction
}

/** The trade being edited and the ledger it was read from. */
export interface EditingTrade {
  wallet: string
  trade: Trade
}

const ACTIONS: TradeAction[] = ['buy', 'sell', 'adjust']

let datalistSeq = 0

/**
 * Add or edit one trade in an investment account's ledger. A single modal
 * serves desktop and mobile: trades are rare enough that the transaction
 * form's calculator sheet would be more than they need.
 */
export class TradeModal extends Modal {
  private walletFile: WalletFile
  private params: TradeModalParams
  private editing: EditingTrade | null
  private onSuccess: (() => void) | null

  private state!: TradeFormState
  private ledgers = new Map<string, Trade[]>()

  private tabsEl!: HTMLElement
  private fieldsEl!: HTMLElement
  private errorEl!: HTMLElement
  private datalistEl!: HTMLDataListElement
  private priceEl: HTMLElement | null = null
  private heldEl: HTMLElement | null = null
  private busy = false

  constructor(
    app: App,
    walletFile: WalletFile,
    params: TradeModalParams = {},
    editing: EditingTrade | null = null,
    onSuccess: (() => void) | null = null,
  ) {
    super(app)
    this.walletFile = walletFile
    this.params = params
    this.editing = editing
    this.onSuccess = onSuccess
  }

  onOpen() {
    const config = this.walletFile.getConfig()
    this.initState(config)

    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('pw-modal')
    contentEl.addClass('pw-trade-modal')

    const titleEl = contentEl.createEl('h2', {
      text: this.editing ? t('trade.editTitle') : t('trade.addTitle'),
    })
    if (this.editing) setIcon(titleEl.createSpan('pw-modal-title-icon'), 'pencil')

    this.tabsEl = contentEl.createDiv('pw-type-tabs')
    this.fieldsEl = contentEl.createDiv('pw-fields')
    this.datalistEl = contentEl.createEl('datalist')
    this.datalistEl.id = `pw-trade-symbols-${++datalistSeq}`

    this.errorEl = contentEl.createDiv('pw-error')
    this.errorEl.hide()

    const btnRow = contentEl.createDiv('pw-btn-row')
    if (this.editing) {
      const deleteBtn = btnRow.createEl('button', { text: t('ui.delete'), cls: 'pw-btn-delete' })
      deleteBtn.dataset['action'] = 'delete'
      deleteBtn.addEventListener('click', () => this.handleDelete())
    }
    const confirmBtn = btnRow.createEl('button', { text: t('ui.confirm'), cls: 'mod-cta' })
    confirmBtn.dataset['action'] = 'confirm'
    confirmBtn.addEventListener('click', () => { void this.handleConfirm() })
    const cancelBtn = btnRow.createEl('button', { text: t('ui.cancel') })
    cancelBtn.dataset['action'] = 'cancel'
    cancelBtn.addEventListener('click', () => this.close())

    // Lift the modal clear of the on-screen keyboard while a text field has focus.
    contentEl.addEventListener('focusin', (e) => {
      const target = e.target
      const typing = target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')
      this.containerEl.toggleClass('pw-modal-keyboard-open', typing)
    })

    this.renderTabs()
    this.renderFields(config)
    void this.loadLedgers(config)
  }

  private initState(config: PennyWalletConfig) {
    if (this.editing) {
      const { wallet, trade } = this.editing
      this.state = {
        action: trade.action,
        date: trade.date,
        wallet,
        symbol: trade.symbol,
        quantity: String(trade.quantity),
        amount: trade.amount != null ? String(trade.amount) : '',
        fee: trade.fee != null ? String(trade.fee) : '',
        note: trade.note,
      }
      return
    }
    const accounts = this.accounts(config)
    const wallet = accounts.find(w => w.name === this.params.wallet) ?? accounts[0]
    this.state = {
      action: this.params.action ?? 'buy',
      date: todayString(),
      wallet: wallet?.name ?? '',
      symbol: this.params.symbol ?? '',
      quantity: '',
      amount: '',
      fee: '',
      note: '',
    }
  }

  /** Active investment accounts, plus the one being edited even if it is archived. */
  private accounts(config: PennyWalletConfig): Wallet[] {
    return config.wallets.filter(w =>
      w.type === 'investment' && (w.status === 'active' || w.name === this.editing?.wallet))
  }

  /** Ledgers load after the form is up: they feed suggestions and the held hint only. */
  private async loadLedgers(config: PennyWalletConfig) {
    this.ledgers = await this.walletFile.readAllTrades()
    const symbols = knownSymbols(this.ledgers.values(), (config.prices ?? []).map(p => p.symbol))
    this.datalistEl.empty()
    for (const symbol of symbols) this.datalistEl.createEl('option', { value: symbol })
    this.updateHints()
  }

  private renderTabs() {
    this.tabsEl.empty()
    for (const action of ACTIONS) {
      const tab = this.tabsEl.createEl('button', {
        text: t(`label.trade.${action}`),
        cls: 'pw-type-tab' + (this.state.action === action ? ' is-active' : ''),
      })
      tab.dataset['type'] = action
      tab.addEventListener('click', () => {
        if (this.state.action === action) return
        this.state.action = action
        this.clearError()
        this.renderTabs()
        this.renderFields(this.walletFile.getConfig())
      })
    }
  }

  private renderFields(config: PennyWalletConfig) {
    this.fieldsEl.empty()
    this.priceEl = null
    this.heldEl = null
    const { action } = this.state
    const code = this.accountCurrency(config)
    const symbol = getCurrency(code).symbol

    this.addRow(t('modal.date'), true, row => {
      const input = row.createEl('input', { type: 'date', cls: 'pw-field-input' })
      input.value = this.state.date
      input.addEventListener('change', () => { this.state.date = input.value; this.updateHints() })
    })

    this.addRow(t('modal.wallet'), true, row => {
      const wrapper = row.createDiv('pw-select-wrapper')
      const select = wrapper.createEl('select', { cls: 'pw-field-input' })
      for (const w of this.accounts(config)) {
        select.createEl('option', { value: w.name, text: `${w.name} (${walletCurrency(w, config)})` })
      }
      select.value = this.state.wallet
      select.addEventListener('change', () => {
        this.state.wallet = select.value
        // The amounts are in the account's currency, whose symbol may differ.
        this.renderFields(this.walletFile.getConfig())
      })
    })

    this.addRow(t('trade.symbol'), true, row => {
      const input = row.createEl('input', {
        type: 'text',
        cls: 'pw-field-input pw-trade-symbol',
        placeholder: t('trade.symbolPlaceholder'),
      })
      input.value = this.state.symbol
      input.setAttribute('list', this.datalistEl.id)
      input.setAttribute('autocapitalize', 'characters')
      input.setAttribute('autocomplete', 'off')
      input.setAttribute('spellcheck', 'false')
      input.addEventListener('input', () => { this.state.symbol = input.value; this.updateHints() })
      if (!this.editing && !this.state.symbol) window.setTimeout(() => input.focus(), 50)
    })

    this.addRow(t('trade.quantity'), true, row => {
      const input = this.numberInput(row, this.state.quantity, value => { this.state.quantity = value })
      if (action !== 'adjust') input.setAttribute('min', '0')
      if (!this.editing && this.state.symbol) window.setTimeout(() => input.focus(), 50)
    })
    if (action === 'adjust') {
      this.fieldsEl.createDiv({ cls: 'pw-balance-hint pw-trade-hint', text: t('trade.adjustHint') })
    }

    this.addRow(action === 'adjust' ? t('trade.costBasis') : t('trade.amount'), action !== 'adjust', row => {
      this.moneyInput(row, symbol, this.state.amount, value => { this.state.amount = value })
    })

    if (action !== 'adjust') {
      this.addRow(t('trade.fee'), false, row => {
        this.moneyInput(row, symbol, this.state.fee, value => { this.state.fee = value })
      })
      this.addRow(t('trade.pricePerShare'), false, row => {
        this.priceEl = row.createDiv('pw-exchange-rate pw-field-input')
      })
    }

    if (action !== 'buy') {
      this.heldEl = this.fieldsEl.createDiv('pw-balance-hint pw-trade-hint')
    }

    this.addRow(t('modal.note'), false, row => {
      const input = row.createEl('input', { type: 'text', cls: 'pw-field-input', placeholder: t('modal.note') })
      input.value = this.state.note
      input.setAttribute('enterkeyhint', 'done')
      input.addEventListener('input', () => { this.state.note = input.value })
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); void this.handleConfirm() }
      })
    })

    this.updateHints()
  }

  private addRow(label: string, required: boolean, build: (row: HTMLElement) => void) {
    const row = this.fieldsEl.createDiv('pw-field-row')
    const labelEl = row.createEl('label', { text: label, cls: 'pw-field-label' })
    if (required) labelEl.createEl('span', { text: '*', cls: 'pw-field-required', attr: { 'aria-hidden': 'true' } })
    build(row)
  }

  private numberInput(parent: HTMLElement, value: string, onInput: (value: string) => void): HTMLInputElement {
    const input = parent.createEl('input', { type: 'number', cls: 'pw-field-input' })
    input.value = value
    input.setAttribute('step', 'any')
    input.setAttribute('inputmode', 'decimal')
    input.setAttribute('enterkeyhint', 'done')
    input.addEventListener('input', () => { onInput(input.value); this.updateHints() })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.handleConfirm() }
    })
    return input
  }

  private moneyInput(row: HTMLElement, symbol: string, value: string, onInput: (value: string) => void) {
    const wrapper = row.createDiv('pw-amount-field-wrapper pw-field-input')
    wrapper.createSpan({ cls: 'pw-amount-currency', text: symbol })
    const input = this.numberInput(wrapper, value, onInput)
    input.removeClass('pw-field-input')
    input.setAttribute('min', '0')
  }

  /** The live read-outs: price per share, and how many shares were held that day. */
  private updateHints() {
    const config = this.walletFile.getConfig()
    if (this.priceEl) {
      const price = impliedSharePrice(this.state.quantity, this.state.amount)
      this.priceEl.textContent = price === null ? '—' : formatPrice(price, this.accountCurrency(config))
    }
    if (this.heldEl) {
      const symbol = normalizeSymbol(this.state.symbol)
      let ledger = this.ledgers.get(this.state.wallet) ?? []
      // What was held without this trade, so editing a sell does not count itself.
      if (this.editing && this.editing.wallet === this.state.wallet) {
        const idx = findTradeIndex(ledger, this.editing.trade)
        if (idx !== -1) ledger = ledger.filter((_, i) => i !== idx)
      }
      const held = symbol ? sharesHeldOn(ledger, symbol, this.state.date) : null
      this.heldEl.textContent = held === null ? '' : tn('trade.held', { quantity: formatQuantity(held) })
      this.heldEl.toggle(held !== null)
    }
  }

  private accountCurrency(config: PennyWalletConfig): string {
    const wallet = config.wallets.find(w => w.name === this.state.wallet)
    return wallet ? walletCurrency(wallet, config) : baseCurrency(config)
  }

  private showError(msg: string) {
    this.errorEl.textContent = msg
    this.errorEl.show()
  }

  private clearError() {
    this.errorEl.hide()
  }

  private async handleConfirm() {
    if (this.busy) return
    this.busy = true
    this.clearError()
    try {
      // Validate against the ledger as it is now, not as it was when the form opened.
      const ledger = await this.walletFile.readTrades(this.state.wallet)
      const editingHere = this.editing && this.editing.wallet === this.state.wallet ? this.editing.trade : null
      const result = validateTradeForm(this.state, ledger, editingHere)
      if (!result.ok) {
        this.showError(result.vars ? tn(result.errorKey, result.vars) : t(result.errorKey))
        return
      }

      const trade = buildTradePayload(this.state)
      if (this.editing) {
        await this.walletFile.updateTrade(this.editing.wallet, this.editing.trade, this.state.wallet, trade)
      } else {
        await this.walletFile.writeTrade(this.state.wallet, trade)
      }
      this.close()
      this.onSuccess?.()
      new Notice(t(this.editing ? 'notice.tradeUpdated' : 'notice.tradeAdded'))
    } catch (e) {
      this.showError(String(e))
    } finally {
      this.busy = false
    }
  }

  private handleDelete() {
    const editing = this.editing
    if (!editing || this.busy) return
    new ConfirmModal(this.app, t('confirm.deleteTrade'), async () => {
      this.busy = true
      try {
        await this.walletFile.deleteTrade(editing.wallet, editing.trade)
        this.close()
        this.onSuccess?.()
        new Notice(t('notice.tradeDeleted'))
      } catch (e) {
        this.showError(String(e))
      } finally {
        this.busy = false
      }
    }).open()
  }

  onClose() {
    this.containerEl.removeClass('pw-modal-keyboard-open')
    this.contentEl.empty()
  }
}
