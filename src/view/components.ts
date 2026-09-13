import { formatAmount } from '../utils'
import { getCurrency } from '../money'

export type MetricVariant = 'income' | 'expense' | 'positive' | 'negative' | 'neutral'

export interface MetricOptions {
  hero?: boolean
  dp?: number
  /** ISO code whose symbol prefixes the value; omitted renders a bare number. */
  currency?: string
}

export function createMetric(
  container: HTMLElement,
  label: string,
  value: number,
  variant: MetricVariant,
  options: MetricOptions = {},
): HTMLElement {
  const { hero = false, dp = 0, currency } = options
  const card = container.createDiv('pw-metric')
  if (hero) {
    card.addClass('pw-metric--hero')
    if (variant !== 'neutral') card.addClass(variant)
  }
  card.createEl('div', { text: label, cls: 'pw-metric-label' })

  const prefix =
    variant === 'income' || variant === 'positive' ? '+' :
    variant === 'expense' || variant === 'negative' ? '-' :
    ''

  const valueClass = variant === 'neutral' ? 'pw-metric-value' : `pw-metric-value ${variant}`

  card.createEl('div', {
    text: prefix + (currency ? getCurrency(currency).symbol : '') + formatAmount(Math.abs(value), dp),
    cls: valueClass,
  })

  return card
}

export interface CardOptions {
  title?: string
  elevation?: 'flat' | 'raised'
  className?: string
}

export function renderCard(parent: HTMLElement, options: CardOptions = {}): HTMLElement {
  const { title, elevation = 'flat', className } = options
  const classes = ['pw-card']
  if (elevation === 'raised') classes.push('pw-card--raised')
  if (className) classes.push(className)
  const card = parent.createDiv(classes.join(' '))
  if (title) card.createEl('div', { text: title, cls: 'pw-card-title' })
  return card
}

export function renderLegendItem(
  parent: HTMLElement,
  color: string,
  name: string,
  amount: string,
  pct: string,
): HTMLElement {
  const row = parent.createDiv('pw-legend-item')
  const dot = row.createDiv('pw-legend-dot')
  dot.style.backgroundColor = color
  row.createEl('span', { text: name, cls: 'pw-legend-name' })
  row.createEl('span', { text: amount, cls: 'pw-legend-amt' })
  row.createEl('span', { text: pct, cls: 'pw-legend-pct' })
  return row
}
