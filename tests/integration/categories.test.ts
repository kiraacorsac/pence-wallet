import { describe, it, expect } from 'vitest'
import { WalletFile } from '../../src/io/WalletFile'
import { DEFAULT_CONFIG } from '../../src/types'
import { seedDefaultCategories } from '../../src/i18n'
import { createMockApp } from '../helpers/mockApp'

const CONFIG_PATH = '.penny-wallet.json'

describe('category options', () => {
  it('seeds localized labels on first launch', async () => {
    const { app } = createMockApp()
    const config = await new WalletFile(app).loadConfig()

    expect(config.options.categories).toEqual(seedDefaultCategories())
  })

  it('reads the stored lists back verbatim', async () => {
    const saved = JSON.stringify({
      ...DEFAULT_CONFIG,
      options: { categories: { expense: ['Coffee', 'Rent'], income: ['Salary'], transfer: [] } },
    })
    const { app } = createMockApp({ [CONFIG_PATH]: saved })
    const config = await new WalletFile(app).loadConfig()

    expect(config.options.categories.expense).toEqual(['Coffee', 'Rent'])
    expect(config.options.categories.income).toEqual(['Salary'])
  })

  it('leaves an empty list empty rather than re-seeding it', async () => {
    const saved = JSON.stringify({
      ...DEFAULT_CONFIG,
      options: { categories: { expense: [], income: ['Salary'], transfer: [] } },
    })
    const { app } = createMockApp({ [CONFIG_PATH]: saved })
    const config = await new WalletFile(app).loadConfig()

    expect(config.options.categories.expense).toEqual([])
  })

  it('seeds a bucket that is absent from the stored config', async () => {
    const saved = JSON.stringify({ ...DEFAULT_CONFIG, options: { categories: { income: ['Salary'] } } })
    const { app } = createMockApp({ [CONFIG_PATH]: saved })
    const config = await new WalletFile(app).loadConfig()

    expect(config.options.categories.expense).toEqual(seedDefaultCategories().expense)
    expect(config.options.categories.income).toEqual(['Salary'])
  })

  it('seeds categories when the config file is malformed', async () => {
    const { app } = createMockApp({ [CONFIG_PATH]: '{ invalid json }' })
    const config = await new WalletFile(app).loadConfig()

    expect(config.options.categories).toEqual(seedDefaultCategories())
  })

  it('updateCategories replaces one list and persists it', async () => {
    const { app, store } = createMockApp()
    const wf = new WalletFile(app)
    await wf.loadConfig()

    wf.updateCategories('expense', ['Coffee'])
    await wf.saveConfig()

    expect(wf.getConfig().options.categories.expense).toEqual(['Coffee'])
    expect(JSON.parse(store.get(CONFIG_PATH)!).options.categories.expense).toEqual(['Coffee'])
  })
})
