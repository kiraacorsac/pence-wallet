// Scan src/i18n.ts en dictionary for sentence-case violations.
// Flags values where a non-first word starts with an uppercase letter
// (likely Title Case), unless the word is in the allowlist below.

import { readFile } from 'node:fs/promises'

const SOURCE = 'src/i18n.ts'

// Proper nouns / acronyms allowed mid-sentence.
const ALLOWLIST = new Set([
  'Obsidian', 'PennyWallet', 'Penny', 'Wallet',
  'API', 'URL', 'CSV', 'JSON', 'PWA', 'iOS', 'macOS', 'Android',
  'Markdown',
  'Twelve', 'Data', // Twelve Data, the price provider
  'BTCUSD', // the crypto pair example, BTC/USD, with its slash stripped
  'Stage',
  'LinePay', 'PayPal',
  'TWD', 'USD', 'JPY', 'EUR',
  'Enter', 'Esc', 'Tab', 'Shift', 'Ctrl', 'Alt', 'Cmd', // keyboard keycaps
])

// Key prefixes whose values are treated as noun-phrase labels where Title Case
// is conventionally acceptable. New i18n keys that fit this role should be
// added under `label.*` to inherit this exemption.
const SKIP_KEY_PREFIXES = ['label.']

function shouldSkip(key) {
  return SKIP_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
}

const content = await readFile(SOURCE, 'utf8')

const enMatch = content.match(/'en':\s*\{/)
if (!enMatch) {
  console.error(`Could not locate 'en' block in ${SOURCE}`)
  process.exit(2)
}

const startIdx = enMatch.index + enMatch[0].length
let depth = 1
let endIdx = startIdx
while (endIdx < content.length && depth > 0) {
  const ch = content[endIdx]
  if (ch === '{') depth++
  else if (ch === '}') depth--
  endIdx++
}
const enBlock = content.slice(startIdx, endIdx - 1)

const pairs = []
const pairRegex = /'([^']+)':\s*'([^']*)'/g
let m
while ((m = pairRegex.exec(enBlock)) !== null) {
  const [, key, value] = m
  const absoluteIdx = startIdx + m.index
  const line = content.slice(0, absoluteIdx).split('\n').length
  pairs.push({ key, value, line })
}

// Split into sentences first; capitalized first word of each sentence is OK.
// A "sentence start" is the start of the value or anything after . ? !
function splitSentences(text) {
  return text.split(/(?<=[.?!])\s+/).filter(s => s.length > 0)
}

const violations = []
let skipped = 0
for (const { key, value, line } of pairs) {
  if (shouldSkip(key)) { skipped++; continue }
  const sentences = splitSentences(value)
  let found = false
  for (const sentence of sentences) {
    // Get letter-bearing words only (strips "+", numbers, punctuation prefixes).
    const words = sentence.split(/\s+/)
      .map(w => w.replace(/[^A-Za-z']/g, ''))
      .filter(w => /[A-Za-z]/.test(w))
    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      if (/^[A-Z]/.test(word) && !ALLOWLIST.has(word)) {
        violations.push({ key, value, word, line })
        found = true
        break
      }
    }
    if (found) break
  }
}

const scanned = pairs.length - skipped
if (violations.length === 0) {
  console.log(`✓ ${scanned} en strings — all sentence-case (${skipped} label.* keys skipped)`)
  process.exit(0)
}

console.log(`Found ${violations.length} possible sentence-case violations (scanned ${scanned}, skipped ${skipped} label.* keys):\n`)
for (const v of violations) {
  console.log(`  ${SOURCE}:${v.line}  '${v.key}': '${v.value}'  (mid-sentence uppercase: ${v.word})`)
}
console.log(`\nReview manually. Proper nouns can be added to ALLOWLIST in scripts/lint-i18n.mjs.`)
process.exit(1)
