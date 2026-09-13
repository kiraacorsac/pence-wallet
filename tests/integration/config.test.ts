import { describe, it, expect } from 'vitest'
import { WalletFile } from '../../src/io/WalletFile'
import { DEFAULT_CONFIG, PennyWalletConfig } from '../../src/types'
import { createMockApp } from '../helpers/mockApp'
import { createMockStore, createFailingStore } from '../helpers/mockStore'

// ── loadConfig ────────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('creates a default config on first launch (no stored data)', async () => {
    const { app } = createMockApp() // empty vault
    const { store, read } = createMockStore() // no data.json yet
    const wf = new WalletFile(app, store)
    const config = await wf.loadConfig()

    expect(config.wallets).toHaveLength(1)
    // setup.ts stubs window.moment.locale() → 'en', so default wallet name is 'Cash'
    expect(config.wallets[0].name).toBeTruthy()
    expect(read()).not.toBeNull()
    expect((read() as PennyWalletConfig).wallets[0].name).toBe(config.wallets[0].name)
  })

  it('loads config from stored data', async () => {
    const saved = { ...DEFAULT_CONFIG, defaultWallet: 'MyBank', wallets: [
      { name: 'MyBank', type: 'bank' as const, initialBalance: 9999, status: 'active' as const, includeInNetAsset: true },
    ]}
    const { app } = createMockApp()
    const { store } = createMockStore(saved)
    const wf = new WalletFile(app, store)
    const config = await wf.loadConfig()

    expect(config.defaultWallet).toBe('MyBank')
    expect(config.wallets[0].initialBalance).toBe(9999)
  })

  it('falls back to DEFAULT_CONFIG when the store cannot be read', async () => {
    const { app } = createMockApp()
    const wf = new WalletFile(app, createFailingStore())
    const config = await wf.loadConfig()

    expect(config.wallets).toEqual(DEFAULT_CONFIG.wallets)
    expect(config.folderName).toBe(DEFAULT_CONFIG.folderName)
    expect(wf.didCreateDefaultConfigOnLastLoad()).toBe(false)
  })
})

// ── saveConfig / updateConfig ─────────────────────────────────────────────────

describe('saveConfig + updateConfig', () => {
  it('persists a patched config to the store', async () => {
    const { app } = createMockApp()
    const { store, read } = createMockStore({ ...DEFAULT_CONFIG })
    const wf = new WalletFile(app, store)
    await wf.loadConfig()

    wf.updateConfig({ defaultWallet: 'Updated' })
    await wf.saveConfig()

    expect((read() as PennyWalletConfig).defaultWallet).toBe('Updated')
  })

  it('getConfig returns the in-memory config after updateConfig', async () => {
    const { app } = createMockApp()
    const { store } = createMockStore({ ...DEFAULT_CONFIG })
    const wf = new WalletFile(app, store)
    await wf.loadConfig()

    wf.updateConfig({ folderName: 'MyLedgers' })
    expect(wf.getConfig().folderName).toBe('MyLedgers')
  })
})

// ── addTag ────────────────────────────────────────────────────────────────────

describe('addTag', () => {
  async function setup() {
    const { app } = createMockApp()
    const { store, read } = createMockStore({ ...DEFAULT_CONFIG })
    const wf = new WalletFile(app, store)
    await wf.loadConfig()
    return { wf, read, app }
  }

  it('adds new tag to config.tags', async () => {
    const { wf } = await setup()
    const result = await wf.addTag('coffee')
    expect(result).toEqual({ ok: true })
    expect(wf.getConfig().tags).toContain('coffee')
  })

  it('keeps config.tags alphabetically sorted', async () => {
    const { wf } = await setup()
    await wf.addTag('zebra')
    await wf.addTag('apple')
    await wf.addTag('mango')
    const tags = wf.getConfig().tags
    expect(tags).toEqual([...tags].sort())
    expect(tags.indexOf('apple')).toBeLessThan(tags.indexOf('mango'))
    expect(tags.indexOf('mango')).toBeLessThan(tags.indexOf('zebra'))
  })

  it('trims whitespace', async () => {
    const { wf } = await setup()
    await wf.addTag('  coffee  ')
    expect(wf.getConfig().tags).toContain('coffee')
    expect(wf.getConfig().tags).not.toContain('  coffee  ')
  })

  it('strips leading #', async () => {
    const { wf } = await setup()
    await wf.addTag('#coffee')
    expect(wf.getConfig().tags).toContain('coffee')
    expect(wf.getConfig().tags).not.toContain('#coffee')
  })

  it('rejects empty string', async () => {
    const { wf } = await setup()
    expect(await wf.addTag('')).toEqual({ ok: false, reason: 'empty' })
    expect(await wf.addTag('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(await wf.addTag('#')).toEqual({ ok: false, reason: 'empty' })
    expect(wf.getConfig().tags).toEqual([])
  })

  it('rejects duplicate (case-sensitive)', async () => {
    const { wf } = await setup()
    await wf.addTag('coffee')
    expect(await wf.addTag('coffee')).toEqual({ ok: false, reason: 'duplicate' })
    expect(await wf.addTag('#coffee')).toEqual({ ok: false, reason: 'duplicate' })
    expect(wf.getConfig().tags.filter(t => t === 'coffee').length).toBe(1)
  })

  it('persists to the store', async () => {
    const { wf, read } = await setup()
    await wf.addTag('coffee')
    expect((read() as PennyWalletConfig).tags).toContain('coffee')
  })
})
