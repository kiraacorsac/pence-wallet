import { describe, it, expect } from 'vitest'
import { WalletFile } from '../../src/io/WalletFile'
import { DEFAULT_CONFIG, PennyWalletConfig } from '../../src/types'
import { seedDefaultCategories } from '../../src/i18n'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore, createFailingStore } from '../helpers/mockStore'

describe('category options', () => {
  it('seeds localized labels on first launch', async () => {
    const { app } = createMockApp()
    const config = await new WalletFile(app, createMockStore().store).loadConfig()

    expect(config.options.categories).toEqual(seedDefaultCategories())
  })

  it('reads the stored lists back verbatim', async () => {
    const saved = {
      ...DEFAULT_CONFIG,
      options: { categories: { expense: ['Coffee', 'Rent'], income: ['Salary'], transfer: [] } },
    }
    const { app } = createMockApp()
    const config = await new WalletFile(app, createMockStore(saved).store).loadConfig()

    expect(config.options.categories.expense).toEqual(['Coffee', 'Rent'])
    expect(config.options.categories.income).toEqual(['Salary'])
  })

  it('leaves an empty list empty rather than re-seeding it', async () => {
    const saved = {
      ...DEFAULT_CONFIG,
      options: { categories: { expense: [], income: ['Salary'], transfer: [] } },
    }
    const { app } = createMockApp()
    const config = await new WalletFile(app, createMockStore(saved).store).loadConfig()

    expect(config.options.categories.expense).toEqual([])
  })

  it('seeds a bucket that is absent from the stored config', async () => {
    const saved = { ...DEFAULT_CONFIG, options: { categories: { income: ['Salary'] } } }
    const { app } = createMockApp()
    const config = await new WalletFile(app, createMockStore(saved).store).loadConfig()

    expect(config.options.categories.expense).toEqual(seedDefaultCategories().expense)
    expect(config.options.categories.income).toEqual(['Salary'])
  })

  it('seeds categories when the stored config cannot be read', async () => {
    const { app } = createMockApp()
    const config = await new WalletFile(app, createFailingStore()).loadConfig()

    expect(config.options.categories).toEqual(seedDefaultCategories())
  })

  it('updateCategories replaces one list and persists it', async () => {
    const { app } = createMockApp()
    const { store, read } = createMockStore()
    const wf = new WalletFile(app, store)
    await wf.loadConfig()

    wf.updateCategories('expense', ['Coffee'])
    await wf.saveConfig()

    expect(wf.getConfig().options.categories.expense).toEqual(['Coffee'])
    expect((read() as PennyWalletConfig).options.categories.expense).toEqual(['Coffee'])
  })
})
