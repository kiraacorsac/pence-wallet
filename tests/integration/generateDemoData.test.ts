import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('generate-demo-data', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
  })

  it('writes fixed tags and assigns them to generated transactions', async () => {
    const vaultRoot = await mkdtemp(path.join(tmpdir(), 'penny-wallet-demo-'))
    tempDirs.push(vaultRoot)

    await execFileAsync('node', ['scripts/generate-demo-data.mjs', vaultRoot], {
      cwd: path.resolve(__dirname, '../..'),
    })

    const config = JSON.parse(await readFile(path.join(vaultRoot, '.obsidian', 'plugins', 'penny-wallet', 'data.json'), 'utf8'))
    expect(config.tags).toEqual(['daily', 'essential', 'family', 'fun', 'health', 'invest', 'online', 'outing', 'travel', 'work'])

    const dataDir = path.join(vaultRoot, 'PennyWallet')
    const monthFiles = await readdir(dataDir)
    const monthContent = (await Promise.all(
      monthFiles
        .filter(fileName => fileName.endsWith('.md'))
        .map(fileName => readFile(path.join(dataDir, fileName), 'utf8')),
    )).join('\n')

    expect(monthContent).toContain('| Date | Type | Wallet | From | To | Category | Note | Tags | Amount | AmountTo | CreatedAt |')

    // The demo vault is multi-currency, so it must exercise both of those paths.
    expect(config.baseCurrency).toBe('TWD')
    expect(config.wallets.some((w: { currency?: string }) => w.currency === 'USD')).toBe(true)
    expect(config.rates.length).toBeGreaterThan(1)
    expect(monthContent).toMatch(/income\.TWD: \d+/)
    expect(monthContent).toMatch(/expense\.USD: [\d.]+/)

    const tagSet = new Set(config.tags)
    const tagCells = monthContent
      .split('\n')
      .filter(line => line.startsWith('| ') && !line.includes('---') && !line.includes('Date | Type'))
      .map(line => line.split('|').map(cell => cell.trim())[8])

    expect(tagCells.some(tags => tags !== '-')).toBe(true)
    for (const tags of tagCells.filter(tags => tags !== '-')) {
      expect(tags.split(',').every(tag => tagSet.has(tag))).toBe(true)
    }
  })
})
