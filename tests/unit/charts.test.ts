import { afterEach, describe, it, expect, vi } from 'vitest'
import { categoryColor, filterPieData, formatK, getThemeColors } from '../../src/view/charts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getThemeColors', () => {
  it('reads chart colors from CSS variables', () => {
    const values = new Map<string, string>([
      ['--pw-income', 'income-var'],
      ['--pw-expense', 'expense-var'],
      ['--pw-bank', 'bank-var'],
      ['--pw-cash', 'cash-var'],
      ['--pw-credit', 'credit-var'],
      ['--pw-transfer', 'transfer-var'],
      ['--pw-payment', 'payment-var'],
      ['--pw-expense-tint', 'expense-tint-var'],
      ['--pw-transfer-tint', 'transfer-tint-var'],
    ])

    vi.stubGlobal('document', {
      documentElement: {},
      body: { classList: { contains: (name: string) => name === 'theme-light' } },
    })
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => values.get(name) ?? '',
    }))

    const colors = getThemeColors()

    expect(colors.income).toBe('income-var')
    expect(colors.expense).toBe('expense-var')
    expect(colors.net).toBe('payment-var')
    expect(colors.pie).toEqual([
      'expense-var',
      'bank-var',
      'payment-var',
      'cash-var',
      'income-var',
      'transfer-var',
      'credit-var',
      '#888780',
    ])
  })

  it('reads theme overrides from body computed style', () => {
    const body = { classList: { contains: (name: string) => name === 'theme-light' } }
    const documentElement = {}
    const getComputedStyle = vi.fn(() => ({
      getPropertyValue: (name: string) => name,
    }))

    vi.stubGlobal('document', { documentElement, body })
    vi.stubGlobal('getComputedStyle', getComputedStyle)

    getThemeColors()

    expect(getComputedStyle).toHaveBeenCalledWith(body)
  })
})

describe('formatK', () => {
  it('formats values >= 10000 as Nk', () => {
    expect(formatK(50000)).toBe('50k')
    expect(formatK(97000)).toBe('97k')
    expect(formatK(10000)).toBe('10k')
  })

  it('formats negative values >= 10000 abs as -Nk', () => {
    expect(formatK(-50000)).toBe('-50k')
  })

  it('formats values < 10000 with locale string (abs)', () => {
    expect(formatK(9999)).toBe('9,999')
    expect(formatK(1500)).toBe('1,500')
  })

  it('respects dp=2 for < 10000', () => {
    expect(formatK(1500, 2)).toBe('1,500.00')
  })
})

describe('filterPieData', () => {
  it('keeps segments >= 1%', () => {
    const data = new Map([['food', 90], ['transport', 10]])
    const result = filterPieData(data)
    expect(result.get('food')).toBe(90)
    expect(result.get('transport')).toBe(10)
  })

  it('keeps segments < 1% as their own slice', () => {
    // total=1000: food=990 (99%), misc=5 (0.5%), fees=5 (0.5%)
    const data = new Map([['food', 990], ['misc', 5], ['fees', 5]])
    const result = filterPieData(data)
    expect(result.get('food')).toBe(990)
    expect(result.get('misc')).toBe(5)
    expect(result.get('fees')).toBe(5)
    expect([...result.keys()]).toEqual(['food', 'misc', 'fees'])
  })

  it('keeps uncategorized ("") regardless of share', () => {
    expect(filterPieData(new Map([['food', 80], ['', 20]])).get('')).toBe(20)
    expect(filterPieData(new Map([['food', 999], ['', 1]])).get('')).toBe(1)
  })

  it('returns empty map for empty input', () => {
    const result = filterPieData(new Map())
    expect(result.size).toBe(0)
  })

  it('orders segments largest-first', () => {
    const data = new Map([['food', 900], ['tiny', 9], ['transport', 91]])
    expect([...filterPieData(data).keys()]).toEqual(['food', 'transport', 'tiny'])
  })

  it('drops zero-value segments', () => {
    const data = new Map([['food', 100], ['transport', 0]])
    const result = filterPieData(data)
    expect(result.get('food')).toBe(100)
    expect(result.has('transport')).toBe(false)
  })

  it('returns empty map when all values are zero', () => {
    const data = new Map([['food', 0], ['transport', 0]])
    const result = filterPieData(data)
    expect(result.size).toBe(0)
  })
})

describe('categoryColor', () => {
  const palette = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  it('is determined by the category key, not its position', () => {
    expect(categoryColor('food', palette)).toBe(categoryColor('food', palette))
    const withOthers = ['transport', 'food'].map(k => categoryColor(k, palette))
    expect(withOthers[1]).toBe(categoryColor('food', palette))
  })

  it('always returns a color from the palette', () => {
    for (const key of ['', 'food', 'transport', '飲食', 'a very long category name']) {
      expect(palette).toContain(categoryColor(key, palette))
    }
  })

  it('spreads keys across the palette', () => {
    const keys = ['food', 'clothing', 'housing', 'transport', 'education', 'medical', 'shopping', 'insurance']
    const used = new Set(keys.map(k => categoryColor(k, palette)))
    expect(used.size).toBeGreaterThan(1)
  })
})
