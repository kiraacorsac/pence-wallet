import { vi } from 'vitest'

// ── Obsidian API stubs ────────────────────────────────────────────────────────

class TFile {
  path: string = ''
  basename: string = ''
  extension: string = ''
  constructor(path: string = '') {
    this.path = path
    const leaf = path ? path.split('/').pop()! : ''
    this.basename = leaf.replace(/\.[^.]+$/, '')
    this.extension = leaf.includes('.') ? leaf.split('.').pop()! : ''
  }
}

vi.mock('obsidian', () => ({
  normalizePath: (p: string) => p.replace(/\\/g, '/'),
  TFile,
  App: class App {},
  Modal: class Modal {
    app: unknown
    contentEl = { empty: vi.fn(), createEl: vi.fn(), createDiv: vi.fn(), addClass: vi.fn() }
    constructor(app: unknown) { this.app = app }
    open() {}
    close() {}
  },
  Notice: class Notice { constructor(_: string) {} },
  Plugin: class Plugin {},
  // Never actually called: every test injects its own RateFetcher.
  requestUrl: vi.fn(),
}))

// ── window.moment stub (used by getLocaleCashName) ────────────────────────────
Object.defineProperty(global, 'window', {
  value: { moment: { locale: () => 'en' } },
  writable: true,
})
