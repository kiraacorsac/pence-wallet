export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function stepMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function isAfterCurrentMonth(ym: string): boolean {
  return ym > currentYearMonth()
}

export function formatAmount(n: number, dp: number = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

// Upper bound on a tag name, counted in code points so CJK and ASCII share
// one budget. Tags sit in a single wallet-table cell and render as chips, so
// they are capped rather than unbounded.
export const TAG_MAX_LEN = 64

export function validateTag(tag: string): boolean {
  if (!tag.trim()) return false
  if (tag.includes(',') || tag.includes('|')) return false
  return [...tag].length <= TAG_MAX_LEN
}

export function formatHeroAmount(raw: string): string {
  if (!raw) return '0'
  const dotIdx = raw.indexOf('.')
  const intPart = dotIdx === -1 ? raw : raw.slice(0, dotIdx)
  const decPart = dotIdx === -1 ? null : raw.slice(dotIdx + 1)

  const intNum = intPart === '' ? 0 : Number(intPart)
  const intStr = Number.isFinite(intNum)
    ? intNum.toLocaleString()
    : intPart

  if (dotIdx === -1) return intStr
  return `${intStr}.${decPart}`
}

export function formatMobileHeroAmount(raw: string, isRefund: boolean, symbol = '$'): string {
  const amount = `${symbol}${formatHeroAmount(raw)}`
  return isRefund && raw !== '' ? `+ ${amount}` : amount
}

export function dateToYearMonth(date: string): string {
  return date.substring(0, 7)
}

export function dateToMonthDay(date: string): string {
  return date.substring(5).replace('-', '/')
}
