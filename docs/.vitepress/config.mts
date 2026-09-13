import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/penny-wallet/',
  head: [
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/penny-wallet/favicon-32.png?v=2' }],
    ['link', { rel: 'shortcut icon', href: '/penny-wallet/favicon-32.png?v=2' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/penny-wallet/apple-touch-icon.png?v=2' }],
  ],

  markdown: {
    config(md) {
      const originalFence = md.renderer.rules.fence
      md.renderer.rules.fence = (...args) => {
        const [tokens, idx] = args
        const info = tokens[idx]?.info?.trim()
        if (info === 'dataview') {
          tokens[idx].info = 'sql'
        }
        return originalFence
          ? originalFence(...args)
          : md.renderer.renderToken(tokens, idx, args[2])
      }
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      title: 'PennyWallet',
      description: 'Personal finance tracker Obsidian plugin — log expenses, income, and transfers as plain Markdown files in your vault.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/getting-started' },
          { text: 'GitHub', link: 'https://github.com/twrusstw/penny-wallet' },
        ],
        sidebar: [
          {
            text: 'User Guide',
            items: [
              { text: 'Getting Started', link: '/getting-started' },
              { text: 'Accounts', link: '/accounts' },
              { text: 'Transactions', link: '/transactions' },
              { text: 'Tracking a Credit Card', link: '/credit-card-workflow' },
              { text: 'Views', link: '/views' },
              { text: 'Settings', link: '/settings' },
              { text: 'URI Handler & iOS Shortcuts', link: '/uri-handler' },
              { text: 'Data Format', link: '/data-format' },
              { text: 'FAQ', link: '/faq' },
            ],
          },
          {
            text: 'Developer',
            items: [
              { text: 'Developer Guide', link: '/developer-guide' },
              { text: 'Testing', link: '/testing' },
            ],
          },
        ],
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/twrusstw/penny-wallet' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 twrusstw',
    },
  },
})
