import { afterEach, describe, it, expect, vi } from 'vitest'
import { categoryColor, filterPieData, formatK, getThemeColors, shadeColor } from '../../src/view/charts'

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

describe('shadeColor', () => {
  it('returns shade 0 verbatim', () => {
    expect(shadeColor('#EF9F27', 0)).toBe('#EF9F27')
  })

  it('keeps hue and saturation, moves only lightness', () => {
    // #EF9F27 is hsl(36, 86%, 55%)
    expect(shadeColor('#EF9F27', 1)).toBe('hsl(36, 86%, 81%)')
    expect(shadeColor('#EF9F27', 2)).toBe('hsl(36, 86%, 30%)')
  })

  it('shades a very light base downwards', () => {
    // #AFA9EC sits at 79% lightness, so both shades come from below it.
    expect(shadeColor('#AFA9EC', 1)).toBe('hsl(245, 64%, 47%)')
    expect(shadeColor('#AFA9EC', 2)).toBe('hsl(245, 64%, 30%)')
  })

  it('spreads the three shades of any base apart', () => {
    for (const base of ['#EF9F27', '#AFA9EC', '#1D9E75', '#000000', '#FFFFFF']) {
      const ls = [0, 1, 2].map(i => {
        const c = shadeColor(base, i)
        return c.startsWith('hsl') ? Number(c.match(/(\d+)%\)$/)![1]) / 100 : lightnessOf(base)
      })
      for (const [a, b] of [[ls[0], ls[1]], [ls[0], ls[2]], [ls[1], ls[2]]]) {
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(0.15)
      }
    }
  })

  it('parses short hex and rgb(), and leaves anything else alone', () => {
    expect(shadeColor('#fa0', 1)).toMatch(/^hsl\(/)
    expect(shadeColor('rgb(239, 159, 39)', 1)).toBe('hsl(36, 86%, 81%)')
    expect(shadeColor('rgba(239, 159, 39, 0.5)', 1)).toBe('hsl(36, 86%, 81%)')
    expect(shadeColor('var(--nope)', 1)).toBe('var(--nope)')
  })
})

describe('categoryColor', () => {
  const palette = ['#EF9F27', '#378ADD', '#AFA9EC', '#1D9E75', '#5DCAA5', '#85B7EB', '#D85A30', '#888780']

  it('is determined by the category key, not its position', () => {
    expect(categoryColor('food', palette)).toBe(categoryColor('food', palette))
    const withOthers = ['transport', 'food'].map(k => categoryColor(k, palette))
    expect(withOthers[1]).toBe(categoryColor('food', palette))
  })

  it('returns a base color or one of its shades', () => {
    for (const key of ['', 'food', 'transport', '飲食', 'a very long category name']) {
      const color = categoryColor(key, palette)
      expect(palette.includes(color) || color.startsWith('hsl(')).toBe(true)
    }
  })

  it('uses more distinct colors than the palette has entries', () => {
    const keys = [
      'food', 'clothing', 'housing', 'transport', 'education', 'entertainment',
      'shopping', 'medical', 'cash_expense', 'insurance', 'fees', 'tax',
    ]
    const used = new Set(keys.map(k => categoryColor(k, palette)))
    expect(used.size).toBeGreaterThan(palette.length)
  })
})

/** Lightness (0-1) of a #rrggbb color, for assertions above. */
function lightnessOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}
