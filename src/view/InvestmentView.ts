import { Events, ItemView, WorkspaceLeaf } from 'obsidian'
import { WalletFile } from '../io/WalletFile'
import { t, tn } from '../i18n'
import { currentYearMonth } from '../utils'
import { renderSharedHeader } from './SharedHeader'
import { renderCard } from './components'
import { TradeModal } from '../modal/TradeModal'
import { tradeOrder } from '../io/investments'
import {
  convert, formatMoney, formatPrice, formatQuantity, positionWorth, priceFor,
} from '../money'
import type { PennyWalletConfig, Position, Trade, Wallet, WalletBalance } from '../types'

export const INVESTMENT_VIEW_TYPE = 'penny-wallet-investments'

/** "+£12.30" / "−£4.00": a gain always shows which way it went. */
function signedMoney(n: number, code: string, config: PennyWalletConfig): string {
  return (n < 0 ? '−' : '+') + formatMoney(Math.abs(n), code, config)
}

function moneyWithSign(n: number, code: string, config: PennyWalletConfig): string {
  return (n < 0 ? '−' : '') + formatMoney(Math.abs(n), code, config)
}

/**
 * Every investment account: what it is worth, what it holds, and the trades
 * that got it there. Values are in each account's own currency, at the
 * current month's prices and rates.
 */
export class InvestmentView extends ItemView {
  private walletFile: WalletFile

  constructor(leaf: WorkspaceLeaf, walletFile: WalletFile) {
    super(leaf)
    this.walletFile = walletFile
  }

  getViewType() { return INVESTMENT_VIEW_TYPE }
  getDisplayText() { return t('invest.title') }
  getIcon() { return 'trending-up' }

  async onOpen() {
    this.registerEvent(
      (this.app.workspace as Events).on('penny-wallet:refresh', () => { void this.render() })
    )
    await this.render()
  }

  onClose(): Promise<void> {
    this.contentEl.empty()
    return Promise.resolve()
  }

  async render() {
    const { contentEl } = this
    const savedScroll = contentEl.scrollTop

    const [balances, ledgers] = await Promise.all([
      this.walletFile.calculateAllWalletBalances(),
      this.walletFile.readAllTrades(),
    ])

    contentEl.empty()
    contentEl.addClass('pw-investments')
    renderSharedHeader(contentEl, {
      view: this,
      walletFile: this.walletFile,
      activeView: 'investments',
      yearMonth: null,
    })

    const config = this.walletFile.getConfig()
    const accounts = config.wallets.filter(w => w.type === 'investment' && w.status === 'active')
    const body = contentEl.createDiv('pw-investments-body')

    if (accounts.length === 0) {
      renderCard(body).createEl('p', { text: t('invest.empty'), cls: 'pw-no-data' })
      return
    }

    const ym = currentYearMonth()
    for (const wallet of accounts) {
      const wb = balances.find(b => b.wallet.name === wallet.name)
      if (!wb) continue
      this.renderAccount(body, wallet, wb, ledgers.get(wallet.name) ?? [], config, ym)
    }
    contentEl.scrollTop = savedScroll
  }

  private renderAccount(
    parent: HTMLElement,
    wallet: Wallet,
    wb: WalletBalance,
    trades: Trade[],
    config: PennyWalletConfig,
    ym: string,
  ) {
    const code = wb.currency
    const card = renderCard(parent, { className: 'pw-invest-account' })

    const header = card.createDiv('pw-card-header-row')
    const title = header.createDiv('pw-invest-title')
    title.createEl('div', { text: wallet.name, cls: 'pw-card-title' })
    title.createSpan({ text: code, cls: 'pw-wallet-badge pw-badge-currency' })
    const addBtn = header.createEl('button', { text: '+ ' + t('ui.addTrade'), cls: 'pw-action-btn' })
    addBtn.dataset['action'] = 'add-trade'
    addBtn.addEventListener('click', () => this.openTrade({ wallet: wallet.name }))

    // Each holding valued once, in the account's currency, and reused below.
    const rows = [...(wb.holdings ?? new Map<string, Position>()).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([symbol, pos]) => {
        const worth = positionWorth(pos, symbol, code, config, ym)
        const value = convert(worth.amount, worth.currency, code, config, ym)
        return { symbol, pos, value, priced: worth.priced, price: priceFor(config, symbol, ym) }
      })

    const holdingsValue = rows.reduce((sum, r) => sum + r.value, 0)
    const holdingsCost = rows.reduce((sum, r) => sum + r.pos.cost, 0)
    const gain = holdingsValue - holdingsCost

    const summary = card.createDiv('pw-invest-summary')
    this.summaryItem(summary, t('invest.totalValue'), moneyWithSign(wb.balance + holdingsValue, code, config), 'is-total')
    this.summaryItem(summary, t('invest.cash'), moneyWithSign(wb.balance, code, config), wb.balance < 0 ? 'is-negative' : '')
    this.summaryItem(summary, t('invest.holdingsValue'), formatMoney(holdingsValue, code, config), '')
    this.summaryItem(summary, t('invest.gain'), signedMoney(gain, code, config), gain < 0 ? 'is-negative' : gain > 0 ? 'is-positive' : '')

    card.createEl('div', { text: t('invest.holdings'), cls: 'pw-invest-section-title' })
    if (rows.length === 0) {
      card.createEl('p', { text: t('invest.noHoldings'), cls: 'pw-no-data' })
    } else {
      const table = card.createDiv('pw-holdings')
      const head = table.createDiv('pw-holdings-row pw-holdings-head')
      for (const key of ['symbol', 'shares', 'price', 'value', 'cost', 'gain'] as const) {
        head.createSpan({ text: t(`invest.col.${key}`), cls: `pw-holdings-${key}` })
      }
      for (const r of rows) {
        const row = table.createDiv('pw-holdings-row')
        row.createSpan({ text: r.symbol, cls: 'pw-holdings-symbol' })
        row.createSpan({ text: formatQuantity(r.pos.quantity), cls: 'pw-holdings-shares' + (r.pos.quantity < 0 ? ' is-negative' : '') })

        const priceCell = row.createSpan({ cls: 'pw-holdings-price' })
        if (r.price) {
          priceCell.createSpan({ text: formatPrice(r.price.price, r.price.currency) })
          priceCell.createSpan({ text: tn('invest.priceAsOf', { month: r.price.effectiveFrom }), cls: 'pw-holdings-sub' })
        } else {
          priceCell.createSpan({ text: '—' })
          priceCell.createSpan({ text: t('invest.atCost'), cls: 'pw-holdings-sub' })
        }

        row.createSpan({ text: moneyWithSign(r.value, code, config), cls: 'pw-holdings-value' })
        row.createSpan({ text: formatMoney(r.pos.cost, code, config), cls: 'pw-holdings-cost' })

        const gainCell = row.createSpan({ cls: 'pw-holdings-gain' })
        if (r.priced) {
          const g = r.value - r.pos.cost
          gainCell.addClass(g < 0 ? 'is-negative' : 'is-positive')
          gainCell.createSpan({ text: signedMoney(g, code, config) })
          if (r.pos.cost > 0) {
            gainCell.createSpan({ text: `${g < 0 ? '−' : '+'}${(Math.abs(g) / r.pos.cost * 100).toFixed(1)}%`, cls: 'pw-holdings-sub' })
          }
        } else {
          gainCell.setText('—')
        }
      }
    }

    card.createEl('div', { text: t('invest.trades'), cls: 'pw-invest-section-title' })
    if (trades.length === 0) {
      card.createEl('p', { text: t('invest.noTrades'), cls: 'pw-no-data' })
      return
    }
    const list = card.createDiv('pw-trade-list')
    for (const trade of [...trades].sort(tradeOrder).reverse()) {
      const row = list.createDiv('pw-trade-row')
      row.dataset['action'] = 'edit-trade'
      row.addEventListener('click', () => this.openTrade({}, { wallet: wallet.name, trade }))

      row.createSpan({ text: trade.date, cls: 'pw-trade-date' })
      row.createSpan({ text: t(`label.trade.${trade.action}`), cls: `pw-wallet-badge pw-trade-badge pw-trade-${trade.action}` })
      const main = row.createSpan({ cls: 'pw-trade-main' })
      main.createSpan({ text: `${formatQuantity(trade.quantity)} ${trade.symbol}`, cls: 'pw-trade-what' })
      if (trade.note) main.createSpan({ text: trade.note, cls: 'pw-trade-note' })

      const amount = trade.amount != null ? formatMoney(trade.amount, code, config) : ''
      const fee = trade.fee ? ` + ${formatMoney(trade.fee, code, config)}` : ''
      row.createSpan({ text: amount + fee, cls: 'pw-trade-amount' })
    }
  }

  private summaryItem(parent: HTMLElement, label: string, value: string, cls: string) {
    const item = parent.createDiv('pw-invest-summary-item' + (cls ? ` ${cls}` : ''))
    item.createDiv({ text: label, cls: 'pw-metric-label' })
    item.createDiv({ text: value, cls: 'pw-invest-summary-value' })
  }

  private openTrade(params: { wallet?: string }, editing: { wallet: string; trade: Trade } | null = null) {
    new TradeModal(this.app, this.walletFile, params, editing, () => {
      this.app.workspace.trigger('penny-wallet:refresh')
    }).open()
  }
}
